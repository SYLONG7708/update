import { createHash, randomBytes } from "node:crypto";
import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, statSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import http from "node:http";

const PORT = Number(process.env.PORT || process.env.SHENYUE_UPLOAD_PORT || 7708);
const UPDATE_REPO_PATH = resolve(process.env.UPDATE_REPO_PATH || join(dirname(fileURLToPath(import.meta.url)), ".."));
const ASSISTANT_REPO_PATH = resolve(process.env.ASSISTANT_REPO_PATH || "C:/Users/Administrator/shen-yue-iphone-assistant-live-work");
const GITHUB_REPO = process.env.GITHUB_REPO || "SYLONG7708/update";
const ASSISTANT_REPO = process.env.ASSISTANT_REPO || "SYLONG7708/shen-yue-iphone-assistant";
const RELEASE_TAG = process.env.RELEASE_TAG || "apk-cloud";
const APPS_SCRIPT_ENDPOINT = process.env.APPS_SCRIPT_ENDPOINT || "https://script.google.com/macros/s/AKfycbwrUCUeksZrWOUSDrdKgUGTS1JIPRX3c18PIKgZu_j64jBZGXjI7rnHTFjmIqUljZFzeg/exec";
const UPLOAD_TOKEN = process.env.SHENYUE_UPLOAD_KEY || randomBytes(12).toString("hex");
const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES || 1024 * 1024 * 1024);
const TEMP_ROOT = resolve(process.env.SHENYUE_UPLOAD_TEMP || join(UPDATE_REPO_PATH, "output", "uploader-temp"));
let uploadBusy = false;

mkdirSync(TEMP_ROOT, { recursive: true });

function json(res, status, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, X-Upload-Token, X-File-Name",
    "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function text(res, status, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function redirect(res, location) {
  res.writeHead(302, { Location: location, "Cache-Control": "no-store" });
  res.end();
}

function getOrigin(req) {
  const host = req.headers.host || `127.0.0.1:${PORT}`;
  const proto = req.headers["x-forwarded-proto"] || (host.includes("trycloudflare.com") ? "https" : "http");
  return `${proto}://${host}`;
}

function getToken(req, url) {
  return url.searchParams.get("key") || url.searchParams.get("k") || req.headers["x-upload-token"] || "";
}

function requireToken(req, url) {
  const token = String(getToken(req, url) || "").trim();
  if (token !== UPLOAD_TOKEN) {
    const error = new Error("URL 密鑰不正確，無法執行上傳。");
    error.statusCode = 401;
    throw error;
  }
}

function run(command, args, cwd = UPDATE_REPO_PATH) {
  return execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}

function tryRun(command, args, cwd = UPDATE_REPO_PATH) {
  try {
    return { ok: true, output: run(command, args, cwd) };
  } catch (error) {
    return {
      ok: false,
      output: `${error.stdout || ""}${error.stderr || ""}`.trim() || error.message
    };
  }
}

function readManifest(repoPath = UPDATE_REPO_PATH) {
  const path = join(repoPath, "updates.json");
  const manifest = JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
  if (!Array.isArray(manifest.apps)) manifest.apps = [];
  return manifest;
}

function writeManifest(repoPath, manifest) {
  const path = join(repoPath, "updates.json");
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

function slug(value) {
  const clean = String(value || "shen-yue-app")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return clean || "shen-yue-app";
}

function safeAssetName(value) {
  const name = basename(String(value || "").trim()).replace(/[\\/:*?"<>|]+/g, "_");
  if (!name) return "";
  return /\.apk$/i.test(name) ? name : `${name}.apk`;
}

function cleanText(value, maxLength = 500) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return maxLength > 0 ? text.slice(0, maxLength) : text;
}

function cleanUrl(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^(https?:\/\/|assets\/)/i.test(text)) return text;
  return "";
}

function parseChangelog(value) {
  const lines = String(value || "")
    .split(/\r?\n|[|]{2}/)
    .map((line) => cleanText(line, 160))
    .filter(Boolean);
  return lines.slice(0, 8);
}

function isCreateMode(query) {
  const mode = String(query.mode || query.action || "").trim().toLowerCase();
  return mode === "create" || mode === "new" || query.create === "1";
}

function getAssetNameFromUrl(value) {
  const clean = String(value || "").split("?")[0].split("#")[0];
  const raw = clean.split("/").filter(Boolean).pop() || "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function formatSize(bytes) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function taipeiTimestamp() {
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
  return `${formatter.format(new Date()).replace(" ", "T")}+08:00`;
}

function findAapt() {
  const candidates = [
    process.env.AAPT_PATH,
    "C:/Users/Administrator/Android/Sdk/build-tools/36.0.0/aapt.exe",
    "C:/Users/Administrator/Android/Sdk/build-tools/35.0.0/aapt.exe"
  ].filter(Boolean);
  return candidates.find((path) => existsSync(path)) || "aapt";
}

function parseAaptValue(line, key) {
  const match = line.match(new RegExp(`${key}='([^']*)'`));
  return match ? match[1] : "";
}

function inspectApk(apkPath) {
  const aapt = findAapt();
  const output = run(aapt, ["dump", "badging", apkPath], UPDATE_REPO_PATH);
  const lines = output.split(/\r?\n/);
  const packageLine = lines.find((line) => line.startsWith("package:")) || "";
  const labelLine = lines.find((line) => line.startsWith("application-label:")) || "";
  const sdkLine = lines.find((line) => line.startsWith("sdkVersion:")) || "";
  const targetLine = lines.find((line) => line.startsWith("targetSdkVersion:")) || "";
  return {
    packageName: parseAaptValue(packageLine, "name"),
    versionCode: Number(parseAaptValue(packageLine, "versionCode") || 0),
    versionName: parseAaptValue(packageLine, "versionName"),
    label: parseAaptValue(labelLine, "application-label"),
    minSdk: parseAaptValue(sdkLine, "sdkVersion"),
    targetSdk: parseAaptValue(targetLine, "targetSdkVersion")
  };
}

function hashFile(path) {
  return new Promise((resolveHash, rejectHash) => {
    const hash = createHash("sha256");
    const input = createReadStream(path);
    input.on("data", (chunk) => hash.update(chunk));
    input.on("error", rejectHash);
    input.on("end", () => resolveHash(hash.digest("hex")));
  });
}

function findManifestItem(manifest, query, metadata) {
  if (isCreateMode(query)) return null;
  const itemId = String(query.itemId || "").trim();
  const assetName = safeAssetName(query.assetName || "");
  const packageName = metadata.packageName || "";
  return manifest.apps.find((item) => {
    const currentAsset = getAssetNameFromUrl(item.apkUrl);
    return (
      (itemId && [item.id, item.packageName, item.name, currentAsset].includes(itemId)) ||
      (assetName && currentAsset === assetName) ||
      (packageName && item.packageName === packageName)
    );
  }) || null;
}

function buildUpdatedItem(existing, metadata, assetName, fileStat, sha256, query = {}) {
  const apkUrl = `https://github.com/${GITHUB_REPO}/releases/download/${RELEASE_TAG}/${encodeURIComponent(assetName)}`;
  const versionCode = metadata.versionCode || Number(existing?.versionCode || 0);
  const versionName = metadata.versionName || existing?.versionName || "未標示";
  const packageName = metadata.packageName || existing?.packageName || "";
  const appName = cleanText(query.appName || query.name, 90) || existing?.name || metadata.label || assetName.replace(/\.apk$/i, "");
  const category = cleanText(query.category, 60) || existing?.category || "其他應用";
  const description = cleanText(query.description, 900) || existing?.description || (existing ? "由申悅更新中心一鍵上傳工具替換 APK。" : "由申悅更新中心一鍵上傳工具新增。");
  const iconUrl = cleanUrl(query.iconUrl) || existing?.iconUrl || "assets/app-logo.png";
  const imageUrl = cleanUrl(query.imageUrl) || existing?.imageUrl || existing?.galleryImages?.[0] || "assets/update-splash.png";
  const galleryImages = Array.isArray(existing?.galleryImages) ? existing.galleryImages : [];
  if (cleanUrl(query.imageUrl) && !galleryImages.includes(cleanUrl(query.imageUrl))) {
    galleryImages.unshift(cleanUrl(query.imageUrl));
  }
  const customChangelog = parseChangelog(query.changelog);
  const defaultAction = existing ? "替換 APK" : "新增 APK";
  const changelog = customChangelog.length ? customChangelog : [
    `已於 ${taipeiTimestamp()} 由公開上傳頁${defaultAction}`,
    `版本：${versionName} (${versionCode || "未標示"})`,
    "可在車機內下載安裝"
  ];
  return {
    id: existing?.id || slug(`${packageName || appName}-${versionCode || Date.now()}`),
    name: appName,
    category,
    packageName,
    versionCode,
    versionName,
    minAndroid: metadata.minSdk ? `Android SDK ${metadata.minSdk}` : (existing?.minAndroid || "依 APK 設定"),
    targetSdk: metadata.targetSdk || existing?.targetSdk || "",
    sizeLabel: formatSize(fileStat.size),
    apkUrl,
    sha256,
    imageUrl,
    iconUrl,
    galleryImages,
    description,
    changelog
  };
}

function updateManifestItem(manifest, item) {
  const index = manifest.apps.findIndex((entry) => (
    entry.id === item.id ||
    (item.packageName && entry.packageName === item.packageName) ||
    getAssetNameFromUrl(entry.apkUrl) === getAssetNameFromUrl(item.apkUrl)
  ));
  if (index >= 0) {
    manifest.apps[index] = item;
  } else {
    manifest.apps.unshift(item);
  }
  manifest.schema = 1;
  manifest.channel = manifest.channel || "stable";
  manifest.updatedAt = taipeiTimestamp();
  return index >= 0 ? "replace" : "create";
}

function refreshRepo(repoPath, remoteRepo) {
  const pull = tryRun("git", ["pull", "--ff-only"], repoPath);
  if (!pull.ok) {
    throw new Error(`無法同步 ${remoteRepo}：${pull.output}`);
  }
  return pull.output;
}

function gitSyncRepo(repoPath, remoteRepo, message) {
  const statusBefore = run("git", ["status", "--porcelain"], repoPath);
  if (!statusBefore) {
    return { committed: false, pushed: false, message: "沒有檔案變更" };
  }
  run("git", ["add", "updates.json"], repoPath);
  const commit = tryRun("git", ["commit", "-m", message], repoPath);
  if (!commit.ok && !/nothing to commit/i.test(commit.output)) {
    throw new Error(`Git commit 失敗：${commit.output}`);
  }
  const statusAfterCommit = run("git", ["status", "--porcelain"], repoPath);
  const pushed = tryRun("git", ["push", "origin", "main"], repoPath);
  if (!pushed.ok) {
    throw new Error(`Git push ${remoteRepo} 失敗：${pushed.output}`);
  }
  return {
    committed: !statusAfterCommit,
    pushed: true,
    message: commit.output || "已提交"
  };
}

async function syncAppsScript(manifest) {
  if (!APPS_SCRIPT_ENDPOINT) return { ok: false, skipped: true, message: "未設定 Apps Script endpoint" };
  const response = await fetch(APPS_SCRIPT_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      type: "replace-update-manifest",
      app: "申悅更新中心一鍵上傳",
      createdAt: new Date().toISOString(),
      manifest
    })
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { ok: response.ok, text };
  }
  if (!response.ok || data.ok === false) {
    throw new Error(`Apps Script 同步失敗：${data.message || text || response.status}`);
  }
  return data;
}

function copyAssistantManifest(manifest) {
  if (!existsSync(join(ASSISTANT_REPO_PATH, ".git")) || !existsSync(join(ASSISTANT_REPO_PATH, "updates.json"))) {
    return { ok: false, skipped: true, message: "未找到申悅助手 repo，略過備援清單同步" };
  }
  writeManifest(ASSISTANT_REPO_PATH, manifest);
  return gitSyncRepo(ASSISTANT_REPO_PATH, ASSISTANT_REPO, `Sync update manifest for public uploader`);
}

async function saveIncomingFile(req, originalName) {
  mkdirSync(TEMP_ROOT, { recursive: true });
  const name = safeAssetName(originalName || `upload-${Date.now()}.apk`);
  const path = join(TEMP_ROOT, `${Date.now()}-${name}`);
  let bytes = 0;
  await new Promise((resolveWrite, rejectWrite) => {
    const output = createWriteStream(path);
    req.on("data", (chunk) => {
      bytes += chunk.length;
      if (bytes > MAX_UPLOAD_BYTES) {
        rejectWrite(new Error("APK 檔案超過上傳大小限制。"));
        req.destroy();
        return;
      }
    });
    req.on("error", rejectWrite);
    output.on("error", rejectWrite);
    output.on("finish", resolveWrite);
    req.pipe(output);
  });
  if (!/\.apk$/i.test(path)) {
    throw new Error("只接受 APK 檔案。");
  }
  if (!existsSync(path)) {
    throw new Error(`APK 暫存失敗，找不到已接收檔案：${path}`);
  }
  if (bytes <= 0) {
    throw new Error("APK 暫存失敗，收到的檔案大小為 0。");
  }
  return path;
}

async function processUpload(tempPath, query) {
  mkdirSync(TEMP_ROOT, { recursive: true });
  refreshRepo(UPDATE_REPO_PATH, GITHUB_REPO);
  if (existsSync(join(ASSISTANT_REPO_PATH, ".git"))) {
    refreshRepo(ASSISTANT_REPO_PATH, ASSISTANT_REPO);
  }
  const metadata = inspectApk(tempPath);
  const manifest = readManifest(UPDATE_REPO_PATH);
  const existing = findManifestItem(manifest, query, metadata);
  const queryAsset = safeAssetName(query.assetName || "");
  const existingAsset = existing ? safeAssetName(getAssetNameFromUrl(existing.apkUrl)) : "";
  const defaultAsset = safeAssetName(`${slug(`${metadata.packageName || metadata.label || "shen-yue-app"}-${metadata.versionCode || Date.now()}`)}.apk`);
  const assetName = existingAsset || queryAsset || defaultAsset;
  const uploadPath = join(TEMP_ROOT, assetName);
  copyFileSync(tempPath, uploadPath);

  const fileStat = statSync(uploadPath);
  const sha256 = await hashFile(uploadPath);
  const item = buildUpdatedItem(existing, metadata, assetName, fileStat, sha256, query);

  const releaseView = tryRun("gh", ["release", "view", RELEASE_TAG, "--repo", GITHUB_REPO], UPDATE_REPO_PATH);
  if (!releaseView.ok) {
    run("gh", ["release", "create", RELEASE_TAG, "--repo", GITHUB_REPO, "--title", "ShenYue APK Cloud Downloads", "--notes", "Shen Yue update center APK cloud files"], UPDATE_REPO_PATH);
  }
  run("gh", ["release", "upload", RELEASE_TAG, uploadPath, "--repo", GITHUB_REPO, "--clobber"], UPDATE_REPO_PATH);

  const operation = updateManifestItem(manifest, item);
  writeManifest(UPDATE_REPO_PATH, manifest);
  const updateGit = gitSyncRepo(UPDATE_REPO_PATH, GITHUB_REPO, `${operation === "create" ? "Add" : "Update"} ${item.name} APK asset`);
  const assistantGit = copyAssistantManifest(manifest);
  const appsScript = await syncAppsScript(manifest);

  return {
    ok: true,
    operation,
    message: operation === "create" ? "APK 已新增並同步更新中心" : "APK 已替換並同步更新中心",
    item,
    assetName,
    sha256,
    size: fileStat.size,
    metadata,
    updateGit,
    assistantGit,
    appsScript,
    manifestUpdatedAt: manifest.updatedAt,
    appsCount: manifest.apps.length
  };
}

function serveStatic(req, res, url) {
  const isAsset = url.pathname.startsWith("/assets/");
  const staticRoot = isAsset ? ASSISTANT_REPO_PATH : join(ASSISTANT_REPO_PATH, "update-uploader");
  const relative = isAsset ? url.pathname.replace(/^\//, "") : (url.pathname.replace(/^\/update-uploader\/?/, "") || "index.html");
  const safeRelative = relative.split("/").filter((part) => part && part !== "." && part !== "..").join("/");
  const filePath = join(staticRoot, safeRelative);
  if (!existsSync(filePath)) {
    text(res, 404, "Not found");
    return true;
  }
  const ext = extname(filePath).toLowerCase();
  const contentType = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml"
  }[ext] || "application/octet-stream";
  text(res, 200, readFileSync(filePath), contentType);
  return true;
}

async function handleRequest(req, res) {
  const url = new URL(req.url || "/", getOrigin(req));
  if (req.method === "OPTIONS") {
    json(res, 204, {});
    return;
  }

  try {
    if (url.pathname === "/") {
      const origin = getOrigin(req);
      redirect(res, `/update-uploader/index.html?api=${encodeURIComponent(origin)}&key=${encodeURIComponent(UPLOAD_TOKEN)}`);
      return;
    }

  if (url.pathname.startsWith("/update-uploader/") || url.pathname.startsWith("/assets/")) {
      serveStatic(req, res, url);
      return;
    }

    if (url.pathname === "/api/status" && req.method === "GET") {
      requireToken(req, url);
      const manifest = readManifest(UPDATE_REPO_PATH);
      json(res, 200, {
        ok: true,
        features: {
          createApk: true,
          replaceApk: true,
          metadataFields: ["appName", "category", "description", "iconUrl", "imageUrl", "changelog"]
        },
        githubRepo: GITHUB_REPO,
        releaseTag: RELEASE_TAG,
        appsScriptEndpoint: APPS_SCRIPT_ENDPOINT,
        appsCount: manifest.apps.length,
        manifestUpdatedAt: manifest.updatedAt,
        apps: manifest.apps
      });
      return;
    }

    if (url.pathname === "/api/upload" && (req.method === "PUT" || req.method === "POST")) {
      requireToken(req, url);
      if (uploadBusy) {
        json(res, 409, { ok: false, message: "已有上傳正在處理，請稍後再試。" });
        return;
      }
      uploadBusy = true;
      try {
        const headerName = req.headers["x-file-name"] ? decodeURIComponent(String(req.headers["x-file-name"])) : "";
        const tempPath = await saveIncomingFile(req, headerName || url.searchParams.get("assetName") || "upload.apk");
        const result = await processUpload(tempPath, Object.fromEntries(url.searchParams.entries()));
        json(res, 200, result);
      } finally {
        uploadBusy = false;
      }
      return;
    }

    json(res, 404, { ok: false, message: "找不到 API。" });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] upload request failed`, error);
    const statusCode = error.statusCode || 500;
    json(res, statusCode, {
      ok: false,
      message: error.message || String(error)
    });
  }
}

const server = http.createServer((req, res) => {
  handleRequest(req, res);
});

server.listen(PORT, "127.0.0.1", () => {
  const localBase = `http://127.0.0.1:${PORT}`;
  console.log("Shen Yue update uploader is running.");
  console.log(`Local page: ${localBase}/update-uploader/index.html?api=${encodeURIComponent(localBase)}&key=${UPLOAD_TOKEN}`);
  console.log(`Token: ${UPLOAD_TOKEN}`);
  console.log(`Update repo: ${UPDATE_REPO_PATH}`);
  console.log(`Assistant repo: ${ASSISTANT_REPO_PATH}`);
});
