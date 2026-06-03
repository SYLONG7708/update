const updateUrlInput = document.querySelector("[data-update-url]");
const updateStatus = document.querySelector("[data-update-status]");
const updateDevice = document.querySelector("[data-update-device]");
const updateList = document.querySelector("[data-update-list]");
const updateDetail = document.querySelector("[data-update-detail]");

const updateUrlKey = "shenYueIndependentUpdateManifestUrl";
const defaultUpdateManifestUrl = "https://raw.githubusercontent.com/SYLONG7708/update/main/updates.json";
let currentUpdateManifestUrl = "updates.json";
let currentUpdateItems = [];
let currentInstalledMap = new Map();

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function hasNativeUpdater() {
  return Boolean(window.ShenYueUpdater);
}

function parseNativeResult(raw) {
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return { ok: false, message: "Android 回傳資料格式錯誤。" };
  }
}

function getPreferredManifestUrl() {
  return localStorage.getItem(updateUrlKey) || defaultUpdateManifestUrl;
}

function getErrorMessage(error) {
  return error?.message || String(error || "未知錯誤");
}

function resolveManifestRelativeUrl(value, fallback = "") {
  const url = String(value || "").trim();
  if (!url) return fallback;
  if (/^(https?:|file:|data:|blob:)/i.test(url)) return url;

  try {
    const manifestBase = new URL(currentUpdateManifestUrl || "updates.json", location.href);
    return new URL(url, manifestBase).href;
  } catch {
    return url;
  }
}

function renderDeviceState() {
  if (!updateDevice) return;
  if (!hasNativeUpdater()) {
    updateDevice.textContent = "瀏覽器模式：可查看清單；版本偵測與安裝需在 Android APK 內使用。";
    return;
  }

  const state = parseNativeResult(window.ShenYueUpdater.getDeviceState());
  if (!state.ok) {
    updateDevice.textContent = `Android 狀態讀取失敗：${state.message || "未知錯誤"}`;
    return;
  }

  const permission = state.canRequestPackageInstalls ? "已允許安裝 APK" : "尚未允許安裝未知來源";
  updateDevice.textContent = `本機更新中心：${state.packageName}｜版本 ${state.versionName} (${state.versionCode})｜${permission}${state.lastInstallStatus ? `｜${state.lastInstallStatus}` : ""}`;
}

function loadBundledManifest(remoteError) {
  if (!hasNativeUpdater() || typeof window.ShenYueUpdater.getBundledManifest !== "function") {
    return false;
  }

  try {
    const manifest = JSON.parse(window.ShenYueUpdater.getBundledManifest() || "{}");
    const items = Array.isArray(manifest.apps) ? manifest.apps : [];
    if (!items.length && manifest.error) throw new Error(manifest.error);
    currentUpdateManifestUrl = "updates.json";
    updateStatus.textContent = `雲端清單讀取失敗（${getErrorMessage(remoteError)}），已使用 App 內建清單。項目：${items.length}`;
    renderUpdateItems(items);
    return true;
  } catch {
    return false;
  }
}

async function loadUpdateManifest() {
  const manifestUrl = (updateUrlInput?.value || defaultUpdateManifestUrl).trim();
  localStorage.setItem(updateUrlKey, manifestUrl);
  updateStatus.textContent = "正在讀取雲端更新清單...";
  updateList.innerHTML = "";
  updateDetail.hidden = true;
  updateDetail.innerHTML = "";

  try {
    const response = await fetch(`${manifestUrl}${manifestUrl.includes("?") ? "&" : "?"}t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const manifest = await response.json();
    currentUpdateManifestUrl = manifestUrl;
    const items = Array.isArray(manifest.apps) ? manifest.apps : [];
    updateStatus.textContent = `已讀取 ${items.length} 個雲端 APK。更新時間：${manifest.updatedAt || "未標示"}`;
    renderUpdateItems(items);
  } catch (error) {
    if (loadBundledManifest(error)) {
      return;
    }

    try {
      const fallback = await fetch(`updates.json?t=${Date.now()}`, { cache: "no-store" });
      if (!fallback.ok) throw new Error(`HTTP ${fallback.status}`);
      const manifest = await fallback.json();
      currentUpdateManifestUrl = "updates.json";
      const items = Array.isArray(manifest.apps) ? manifest.apps : [];
      updateStatus.textContent = `雲端清單讀取失敗（${getErrorMessage(error)}），已使用內建清單。項目：${items.length}`;
      renderUpdateItems(items);
    } catch (fallbackError) {
      updateStatus.textContent = `更新清單讀取失敗：雲端 ${getErrorMessage(error)}；內建 ${getErrorMessage(fallbackError)}`;
      renderUpdateItems([]);
    }
  }
}

function getInstalledMap(items) {
  const map = new Map();
  if (!hasNativeUpdater()) return map;

  const packageNames = [...new Set(items.map((item) => item.packageName).filter(Boolean))];
  const batch = parseNativeResult(window.ShenYueUpdater.getInstalledBatch(JSON.stringify(packageNames)));
  if (!batch.ok || !Array.isArray(batch.items)) return map;

  batch.items.forEach((item) => map.set(item.packageName, item));
  return map;
}

function getUpdateState(item, installed) {
  const remoteCode = Number(item.versionCode || 0);
  const currentCode = Number(installed?.versionCode || 0);
  const apkUrl = item.apkUrl || "";

  let pill = "可安裝";
  let pillClass = "ready";
  let buttonText = installed?.installed ? "下載更新" : "下載安裝";
  let disabled = !hasNativeUpdater() || !apkUrl || !item.packageName;
  let reason = "";

  if (!hasNativeUpdater()) {
    pill = "瀏覽器模式";
    pillClass = "browser";
    reason = "請在 Android APK 內啟用，才能偵測版本與安裝 APK。";
  } else if (!apkUrl || !item.packageName) {
    pill = "資料不完整";
    pillClass = "error";
    reason = "updates.json 缺少 packageName 或 apkUrl。";
  } else if (installed?.installed && remoteCode > 0 && currentCode >= remoteCode) {
    pill = "已是最新";
    pillClass = "current";
    buttonText = "排除重複安裝";
    disabled = true;
    reason = "遠端版本碼未高於目前版本，已排除重複安裝。";
  } else if (!installed?.installed) {
    pill = "未安裝";
    pillClass = "missing";
  }

  return { pill, pillClass, buttonText, disabled, reason };
}

function renderUpdateItems(items) {
  currentUpdateItems = items;
  currentInstalledMap = getInstalledMap(items);
  if (!items.length) {
    updateList.innerHTML = `<article class="empty-card">沒有可顯示的 APK。</article>`;
    return;
  }

  updateList.innerHTML = items.map((item, index) => {
    const installed = currentInstalledMap.get(item.packageName);
    const state = getUpdateState(item, installed);
    const iconUrl = resolveManifestRelativeUrl(item.iconUrl || item.imageUrl, "assets/update-splash.png");
    return `
      <button class="app-tile" type="button" data-update-open="${index}">
        <img src="${escapeHtml(iconUrl)}" alt="${escapeHtml(item.name || "APK")} 圖標" loading="lazy" onerror="this.onerror=null;this.src='assets/update-splash.png';">
        <span class="status-pill ${state.pillClass}">${state.pill}</span>
        <strong>${escapeHtml(item.name || item.id || "未命名 APK")}</strong>
        <small>${escapeHtml(item.versionName || "版本未標示")}</small>
      </button>
    `;
  }).join("");
}

function renderDetail(index) {
  const item = currentUpdateItems[index];
  if (!item) return;

  const installed = currentInstalledMap.get(item.packageName);
  const state = getUpdateState(item, installed);
  const remoteCode = Number(item.versionCode || 0);
  const currentCode = Number(installed?.versionCode || 0);
  const installedText = installed?.installed ? `${escapeHtml(installed.versionName || "")} (${currentCode})` : "尚未安裝";
  const remoteText = `${escapeHtml(item.versionName || "")} (${remoteCode || "未填"})`;
  const changelog = Array.isArray(item.changelog) ? item.changelog.join("、") : (item.changelog || item.note || "");
  const apkUrl = resolveManifestRelativeUrl(item.apkUrl);
  const imageUrl = resolveManifestRelativeUrl(item.imageUrl, "assets/update-splash.png");
  const description = item.description || item.introduction || changelog || item.note || "此 APK 尚未填寫介紹。";
  const targetSdkText = item.targetSdk ? `SDK ${escapeHtml(item.targetSdk)}` : "未標示";

  updateDetail.hidden = false;
  updateDetail.innerHTML = `
    <div class="detail-top">
      <button type="button" data-update-back>返回圖標清單</button>
      <span class="status-pill ${state.pillClass}">${state.pill}</span>
    </div>
    <article class="detail-card" data-update-card="${index}">
      <header>
        <h2>${escapeHtml(item.name || item.id || "未命名 APK")}</h2>
        <p>${escapeHtml(item.packageName || "")}</p>
      </header>
      <div class="detail-body">
        <img class="detail-image" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(item.name || "APK")} 圖片" loading="lazy" onerror="this.onerror=null;this.src='assets/update-splash.png';">
        <div class="copyable-text">
          <p class="description">${escapeHtml(description)}</p>
          <div class="info-list">
            <div><strong>來源檔案</strong><span>${escapeHtml(item.sourceFile || "未標示")}</span></div>
            <div><strong>下載檔名</strong><span>${escapeHtml(item.downloadFileName || "依網址")}</span></div>
            <div><strong>包名</strong><span>${escapeHtml(item.packageName || "未標示")}</span></div>
            <div><strong>下載網址</strong><span>${escapeHtml(apkUrl || "未標示")}</span></div>
            <div><strong>SHA-256</strong><span>${escapeHtml(item.sha256 || "未填寫")}</span></div>
          </div>
        </div>
      </div>
      <div class="meta-grid">
        <span><strong>目前版本</strong><br>${installedText}</span>
        <span><strong>雲端版本</strong><br>${remoteText}</span>
        <span><strong>大小</strong><br>${escapeHtml(item.sizeLabel || item.size || "未標示")}</span>
        <span><strong>最低 / 目標 SDK</strong><br>${escapeHtml(item.minAndroid || "未標示")} / ${targetSdkText}</span>
      </div>
      <p class="note copyable-text">${escapeHtml(state.reason || changelog || "沒有填寫更新內容。")}</p>
      <div class="progress" data-update-progress><span></span></div>
      <button class="install-button" type="button" data-update-install="${index}" ${state.disabled ? "disabled" : ""}>${state.buttonText}</button>
    </article>
  `;
  updateDetail.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function installUpdate(index) {
  const item = currentUpdateItems[index];
  if (!item) throw new Error("找不到更新項目。");

  const card = document.querySelector(`[data-update-card="${index}"]`);
  const button = document.querySelector(`[data-update-install="${index}"]`);
  const note = card?.querySelector(".note");
  const progress = card?.querySelector("[data-update-progress] span");
  if (!card || !button || !hasNativeUpdater()) return;

  button.disabled = true;
  if (note) note.textContent = "正在交給 Android 下載安裝服務...";
  const started = parseNativeResult(window.ShenYueUpdater.downloadAndInstall(JSON.stringify({
    ...item,
    apkUrl: resolveManifestRelativeUrl(item.apkUrl)
  })));

  if (!started.ok) {
    if (note) note.textContent = started.message || "無法開始下載。";
    button.disabled = false;
    renderDeviceState();
    return;
  }

  const timer = setInterval(() => {
    const task = parseNativeResult(window.ShenYueUpdater.getTaskStatus(started.taskId));
    if (progress) progress.style.setProperty("--progress", `${task.progress || 0}%`);
    if (note) note.textContent = task.message || "";
    if (["failed", "complete", "installing"].includes(task.status)) {
      clearInterval(timer);
      renderDeviceState();
    }
  }, 700);
}

document.addEventListener("click", (event) => {
  const refresh = event.target.closest("[data-refresh-updates]");
  if (refresh) {
    loadUpdateManifest();
    return;
  }

  const permission = event.target.closest("[data-open-install-permission]");
  if (permission) {
    if (hasNativeUpdater()) window.ShenYueUpdater.openInstallPermission();
    else updateStatus.textContent = "瀏覽器模式無法開啟 Android 安裝權限。";
    return;
  }

  const open = event.target.closest("[data-update-open]");
  if (open) {
    renderDetail(Number(open.dataset.updateOpen));
    return;
  }

  const back = event.target.closest("[data-update-back]");
  if (back) {
    updateDetail.hidden = true;
    updateDetail.innerHTML = "";
    document.querySelector(".catalog-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  const install = event.target.closest("[data-update-install]");
  if (install) {
    installUpdate(Number(install.dataset.updateInstall)).catch((error) => {
      const card = document.querySelector(`[data-update-card="${install.dataset.updateInstall}"]`);
      const note = card?.querySelector(".note");
      if (note) note.textContent = `無法開始更新：${error.message || error}`;
      install.disabled = false;
    });
  }
});

updateUrlInput.value = getPreferredManifestUrl();
renderDeviceState();
loadUpdateManifest();
