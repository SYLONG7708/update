const recordForm = document.querySelector("[data-record-form]");
const recordCard = document.querySelector("[data-record-card]");
const checklist = document.querySelector("[data-checklist]");
const installButton = document.querySelector("[data-install]");
const cloudStatus = document.querySelector("[data-cloud-status]");
const adminPanel = document.querySelector("[data-admin-panel]");
const adminOutput = document.querySelector("[data-admin-output]");
const adminShortcut = document.querySelector("[data-admin-shortcut]");
const videoGrid = document.querySelector("[data-video-grid]");
const videoSearch = document.querySelector("[data-video-search]");
const serviceGrid = document.querySelector("[data-service-grid]");
const photoInput = document.querySelector("[data-photo-input]");
const photoPreview = document.querySelector("[data-photo-preview]");
const updateUrlInput = document.querySelector("[data-update-url]");
const updateStatus = document.querySelector("[data-update-status]");
const updateDevice = document.querySelector("[data-update-device]");
const updateList = document.querySelector("[data-update-list]");
const updateDetail = document.querySelector("[data-update-detail]");

const storageKey = "shenYueCarRecord";
const checklistKey = "shenYueDeliveryChecklist";
const adminKey = "shenYueAdminSettings";
const updateUrlKey = "shenYueUpdateManifestUrl";
const adminPin = "7708";
const defaultCloudEndpoint = "https://script.google.com/macros/s/AKfycbxxtXq2JnoqYHU7rHDo4Ddfe_ZfPzwDolglZsbBmY2j1YUkV1fbqcFv8KhNh-stPL8/exec";
const defaultContentConfigUrl = "https://shen-yue.com.tw/shen-yue-assistant-content.json";
const legacyUpdateManifestUrl = "https://sylong7708.github.io/shen-yue-iphone-assistant/updates.json";
const defaultUpdateManifestUrl = "https://raw.githubusercontent.com/SYLONG7708/update/main/updates.json";
let deferredInstallPrompt = null;
let activeVideoCategory = "all";
let lastRemoteContentCheck = 0;
let warrantyPhotos = [];
let updateCenterLoaded = false;
let currentUpdateItems = [];
let currentInstalledMap = new Map();
let currentUpdateManifestUrl = "updates.json";

const defaultContent = {
  heroTitle: "車機教學、保固資料、售後聯絡。",
  services: [
    { number: "01", title: "車載安卓機", description: "13 吋高解析大螢幕升級，整合導航、影音、CarPlay、倒車顯影與原車控制，讓車艙變成直覺好用的智慧中控。", iconClass: "custom-icon android-icon" },
    { number: "02", title: "360 環景系統", description: "四鏡頭全景輔助搭配專業校正，停車、窄巷、會車更有掌握，降低視線死角與碰撞風險。", iconClass: "custom-icon surround-icon" },
    { number: "03", title: "行車記錄器", description: "前後雙錄與車機整合，清楚保存行車關鍵畫面，安裝走線俐落，日常通勤與長途行車都更安心。", iconClass: "custom-icon dashcam-icon" },
    { number: "04", title: "汽車音響", description: "喇叭、DSP、擴大機與隔音制震整體規劃，依車艙空間調整音場，讓音樂細節、層次與低頻更有質感。", iconClass: "custom-icon audio-icon" },
    { number: "05", title: "電動尾門", description: "支援按鍵、遙控與高度記憶設定，開關更便利，施工依車款整合原車訊號，兼顧安全與使用質感。", iconClass: "custom-icon tailgate-icon" },
    { number: "06", title: "盲點偵測", description: "後視鏡警示與雷達偵測輔助變換車道，提醒側後方來車，提升高速、公路與市區行駛安全。", iconClass: "custom-icon blind-icon" }
  ]
};

const videos = [
  { title: "新 UI 介面", category: "介面", url: "https://youtu.be/ir2H40ENsKY?si=B3FHIlE9rz7aLW7m" },
  { title: "環景教學播放清單", category: "設定", url: "https://www.youtube.com/playlist?list=PLOoMP1Ydm1eVVIntvqtHyGJS7ONe7faG5" },
  { title: "樂克導航（免開網路）", category: "導航", url: "https://youtu.be/k9laYNbPRVI?si=Btzhb4ISUNE-7e1A" },
  { title: "iPhone 連接網路", category: "連線", url: "https://youtu.be/xJgQTR-GbN8" },
  { title: "iPhone 連接藍芽", category: "連線", url: "https://youtu.be/fVOtS2oUsqY" },
  { title: "Android Auto 使用", category: "連線", url: "https://youtu.be/TecO-20i3Pw" },
  { title: "Apple CarPlay 使用", category: "連線", url: "https://youtu.be/JEAjZBDokhU" },
  { title: "使用隨身碟聽音樂", category: "影音", url: "https://youtu.be/jHSQ7cxW7nw" },
  { title: "電台存取", category: "影音", url: "https://youtu.be/Ra_2am4m5Ck" },
  { title: "調整亮度", category: "設定", url: "https://youtu.be/ALDFaQSQJFA" },
  { title: "神盾測速照相", category: "導航", url: "https://youtu.be/9O96HSQbNvc" },
  { title: "尋找應用程式", category: "介面", url: "https://youtu.be/kTzVXGc-f5g" },
  { title: "2024 申悅更新站", category: "設定", url: "https://youtu.be/pkBAlJrBwVE?si=REzKfead9FvQaNdD" },
  { title: "分屏模式教學 - 安卓 13", category: "介面", url: "https://youtu.be/B2whM6w4VCI" },
  { title: "分屏模式", category: "介面", url: "https://youtu.be/IbuzzVY6EVc" },
  { title: "Google 語音搜尋", category: "導航", url: "https://youtu.be/DROmImKCRNg" },
  { title: "安卓機桌布更換", category: "介面", url: "https://youtu.be/BcVmxELU4hU" },
  { title: "iPhone 網路重置", category: "故障排除", url: "https://youtu.be/lNMnJmawFXk" },
  { title: "觸控校正", category: "故障排除", url: "https://youtu.be/jvoYxWxzf90" },
  { title: "APP 自動啟動", category: "設定", url: "https://youtu.be/aq6SUYLWJto" },
  { title: "安卓機秒開模式", category: "設定", url: "https://youtu.be/P5jIoubuB7Y" },
  { title: "螢幕亮度內建再次調整", category: "設定", url: "https://youtu.be/s3KGI2J_TB4" },
  { title: "倒車顯影顛倒", category: "故障排除", url: "https://youtu.be/sL2oFKqVRNY" },
  { title: "方向盤設定", category: "設定", url: "https://youtu.be/esI70gCzASU" },
  { title: "主機當機重啟", category: "故障排除", url: "https://youtu.be/C9Qs85Un8lY?si=dE5VO4_fQ2lOxaR0" }
];

function formatDate(value) {
  if (!value) return "未設定";
  return new Date(`${value}T00:00:00`).toLocaleDateString("zh-TW");
}

function getRecord() {
  return JSON.parse(localStorage.getItem(storageKey) || "{}");
}

function getAdminSettings() {
  const saved = JSON.parse(localStorage.getItem(adminKey) || "{}");
  return {
    cloudEndpoint: defaultCloudEndpoint,
    contentConfigUrl: defaultContentConfigUrl,
    heroTitle: defaultContent.heroTitle,
    shopPhone: "0970-117-708",
    lineId: "@585eeefp",
    ...saved
  };
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getPreferredUpdateManifestUrl() {
  const savedUrl = localStorage.getItem(updateUrlKey);
  if (savedUrl && savedUrl !== legacyUpdateManifestUrl && !savedUrl.includes("shen-yue-iphone-assistant")) {
    return savedUrl;
  }
  localStorage.setItem(updateUrlKey, defaultUpdateManifestUrl);
  return defaultUpdateManifestUrl;
}

function resolveManifestRelativeUrl(value, fallback = "") {
  const url = String(value || "").trim();
  if (!url) return fallback;
  if (/^(https?:|file:|data:|blob:)/i.test(url)) return url;

  try {
    const manifestBase = new URL(currentUpdateManifestUrl || "updates.json", location.href);
    return new URL(url, manifestBase).href;
  } catch (error) {
    return url;
  }
}

function applyContent(content = {}) {
  const settings = getAdminSettings();
  const merged = {
    ...defaultContent,
    ...content,
    heroTitle: content.heroTitle || settings.heroTitle || defaultContent.heroTitle
  };

  document.querySelector('[data-content="heroTitle"]').textContent = merged.heroTitle;
  renderServices(merged.services || defaultContent.services);
}

function renderServices(services) {
  serviceGrid.innerHTML = services.map((service) => `
    <article>
      <div class="service-icon ${escapeHtml(service.iconClass)}"></div>
      <strong>${escapeHtml(service.number)}</strong>
      <h3>${escapeHtml(service.title)}</h3>
      <p>${escapeHtml(service.description)}</p>
    </article>
  `).join("");
}

async function loadRemoteContent(showMessage = false) {
  const { contentConfigUrl } = getAdminSettings();
  if (!contentConfigUrl) {
    applyContent();
    if (showMessage) adminOutput.textContent = "尚未設定遠端內容 JSON 網址，已使用 App 內建內容。";
    return;
  }

  try {
    const response = await fetch(`${contentConfigUrl}?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const content = await response.json();
    localStorage.setItem("shenYueRemoteContentCache", JSON.stringify(content));
    applyContent(content);
    if (showMessage) adminOutput.textContent = "已讀取遠端內容並更新畫面。";
  } catch (error) {
    const cached = localStorage.getItem("shenYueRemoteContentCache");
    if (cached) {
      applyContent(JSON.parse(cached));
      if (showMessage) adminOutput.textContent = `遠端讀取失敗，已使用上次快取內容：${error.message}`;
      return;
    }
    applyContent();
    if (showMessage) adminOutput.textContent = `遠端讀取失敗，已使用 App 內建內容：${error.message}`;
  }
}

function checkRemoteContentNow() {
  const now = Date.now();
  if (now - lastRemoteContentCheck < 3000) return;
  lastRemoteContentCheck = now;
  loadRemoteContent();
}

function getPayload(type, data = {}) {
  return {
    type,
    app: "申悅助手",
    createdAt: new Date().toISOString(),
    ...data
  };
}

async function sendToCloud(payload) {
  const { cloudEndpoint } = getAdminSettings();
  if (!cloudEndpoint) throw new Error("尚未設定 Google Apps Script 雲端網址");

  await fetch(cloudEndpoint, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  });
}

function renderRecord() {
  const record = getRecord();
  if (!Object.keys(record).length) return;

  recordCard.innerHTML = `
    <h3>${record.owner || "姓名未設定"}</h3>
    <p><strong>聯繫電話：</strong>${record.phone || "未設定"}</p>
    <p><strong>車牌號碼：</strong>${record.plate || "未設定"}</p>
    <p><strong>車款年份：</strong>${record.car || "未設定"}</p>
    <p><strong>安裝項目：</strong>${record.items || "未設定"}</p>
    <p><strong>主機規格：</strong>${record.model || record.productSpec || "未設定"}</p>
    <p><strong>安裝日期：</strong>${record.installDate ? formatDate(record.installDate) : "未設定"}</p>
    <p><strong>保固到期日：</strong>${record.warrantyDate ? formatDate(record.warrantyDate) : "未設定"}</p>
    <p><strong>備註：</strong>${record.note || "未設定"}</p>
    <p><strong>照片：</strong>${warrantyPhotos.length ? `${warrantyPhotos.length} 張待上傳` : "未選擇"}</p>
  `;

  for (const [key, value] of Object.entries(record)) {
    const input = recordForm.elements[key];
    if (input) input.value = value;
  }
}

function readImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function compressImage(dataUrl) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, 1280 / image.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.72));
    };
    image.src = dataUrl;
  });
}

async function prepareWarrantyPhotos(files) {
  warrantyPhotos = [];
  const selected = [...files].slice(0, 6);

  for (const file of selected) {
    const raw = await readImage(file);
    warrantyPhotos.push({
      name: file.name,
      type: "image/jpeg",
      dataUrl: await compressImage(raw)
    });
  }

  photoPreview.innerHTML = warrantyPhotos.length
    ? warrantyPhotos.map((photo) => `<img src="${photo.dataUrl}" alt="${escapeHtml(photo.name)}">`).join("")
    : "<p>尚未選擇照片。</p>";
  renderRecord();
}

function youtubeId(url) {
  const shortMatch = url.match(/youtu\.be\/([^?&]+)/);
  if (shortMatch) return shortMatch[1];
  const normalMatch = url.match(/[?&]v=([^?&]+)/);
  return normalMatch ? normalMatch[1] : "";
}

function thumbUrl(url) {
  const id = youtubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : "assets/hero-car-audio.png";
}

function normalizeText(value) {
  return value.toLowerCase().replace(/\s+/g, "");
}

function renderVideos() {
  const query = normalizeText(videoSearch.value || "");
  const filtered = videos.filter((video) => {
    const inCategory = activeVideoCategory === "all" || video.category === activeVideoCategory;
    const inQuery = normalizeText(`${video.title} ${video.category}`).includes(query);
    return inCategory && inQuery;
  });

  videoGrid.innerHTML = filtered.map((video) => `
    <article class="video-card">
      <a class="video-thumb" href="${video.url}" target="_blank" rel="noopener">
        <img src="${thumbUrl(video.url)}" alt="${video.title}" loading="lazy">
        <span>播放</span>
      </a>
      <div class="video-body">
        <h3>${video.title}</h3>
        <p>${video.category}</p>
        <a href="${video.url}" target="_blank" rel="noopener">開啟教學</a>
      </div>
    </article>
  `).join("");
}

function hasNativeUpdater() {
  return Boolean(window.ShenYueUpdater);
}

function parseNativeResult(raw) {
  try {
    return JSON.parse(raw || "{}");
  } catch (error) {
    return { ok: false, message: "Android 回傳資料格式錯誤。" };
  }
}

function getErrorMessage(error) {
  return error?.message || String(error || "未知錯誤");
}

function initUpdateCenter(force = false) {
  if (!updateUrlInput || (!force && updateCenterLoaded)) return;
  updateCenterLoaded = true;
  updateUrlInput.value = getPreferredUpdateManifestUrl();
  renderUpdateDeviceState();
  loadUpdateManifest(force);
}

function renderUpdateDeviceState() {
  if (!updateDevice) return;
  if (!hasNativeUpdater()) {
    updateDevice.textContent = "目前是瀏覽器模式，只能查看清單；安裝與版本偵測需在 Android APK 內使用。";
    return;
  }

  const state = parseNativeResult(window.ShenYueUpdater.getDeviceState());
  if (!state.ok) {
    updateDevice.textContent = `Android 狀態讀取失敗：${state.message || "未知錯誤"}`;
    return;
  }

  const permission = state.canRequestPackageInstalls ? "已允許安裝 APK" : "尚未允許安裝未知來源";
  updateDevice.textContent = `本機助手：${state.packageName}｜目前版本 ${state.versionName} (${state.versionCode})｜${permission}${state.lastInstallStatus ? `｜${state.lastInstallStatus}` : ""}`;
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

async function loadUpdateManifest(force = false) {
  if (!updateStatus || !updateList || !updateUrlInput) return;
  const manifestUrl = updateUrlInput.value.trim() || defaultUpdateManifestUrl;
  localStorage.setItem(updateUrlKey, manifestUrl);
  updateStatus.textContent = "正在讀取雲端更新清單...";
  updateList.innerHTML = "";

  try {
    const response = await fetch(`${manifestUrl}${manifestUrl.includes("?") ? "&" : "?"}t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const manifest = await response.json();
    const items = Array.isArray(manifest.apps) ? manifest.apps : [];
    currentUpdateManifestUrl = manifestUrl;
    updateStatus.textContent = `已讀取 ${items.length} 個更新項目。更新時間：${manifest.updatedAt || "未標示"}`;
    renderUpdateItems(items);
  } catch (error) {
    if (loadBundledManifest(error)) {
      return;
    }

    if (manifestUrl !== "updates.json") {
      try {
        const fallbackResponse = await fetch(`updates.json?t=${Date.now()}`, { cache: "no-store" });
        if (!fallbackResponse.ok) throw new Error(`HTTP ${fallbackResponse.status}`);
        const fallbackManifest = await fallbackResponse.json();
        const fallbackItems = Array.isArray(fallbackManifest.apps) ? fallbackManifest.apps : [];
        currentUpdateManifestUrl = "updates.json";
        updateStatus.textContent = `雲端清單讀取失敗，已使用 APK 內建清單。項目：${fallbackItems.length}`;
        renderUpdateItems(fallbackItems);
        return;
      } catch (fallbackError) {
        updateStatus.textContent = `雲端與內建清單都讀取失敗：${getErrorMessage(fallbackError)}`;
      }
    } else {
      updateStatus.textContent = `雲端清單讀取失敗：${getErrorMessage(error)}`;
    }
    if (force) renderUpdateItems([]);
  }
}

function getInstalledMap(items) {
  const map = new Map();
  if (!hasNativeUpdater()) return map;

  const packageNames = [...new Set(items.map((item) => item.packageName).filter(Boolean))];
  const batch = parseNativeResult(window.ShenYueUpdater.getInstalledBatch(JSON.stringify(packageNames)));
  if (!batch.ok || !Array.isArray(batch.items)) return map;

  batch.items.forEach((item) => {
    map.set(item.packageName, item);
  });
  return map;
}

function renderUpdateItems(items) {
  if (!updateList) return;
  currentUpdateItems = items;
  if (!items.length) {
    updateList.innerHTML = `<article class="update-card"><h3>沒有可顯示的更新項目</h3><p>請確認 updates.json 的 apps 陣列格式是否正確。</p></article>`;
    if (updateDetail) updateDetail.hidden = true;
    return;
  }

  currentInstalledMap = getInstalledMap(items);
  updateList.innerHTML = items.map((item, index) => renderUpdateIcon(item, currentInstalledMap.get(item.packageName), index)).join("");
  if (updateDetail) {
    updateDetail.hidden = true;
    updateDetail.innerHTML = "";
  }
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
    pillClass = "error";
    reason = "請在 Android APK 內開啟才可偵測與安裝。";
  } else if (!apkUrl || !item.packageName) {
    pill = "資料不完整";
    pillClass = "error";
    reason = "updates.json 缺少 packageName 或 apkUrl。";
  } else if (installed?.installed && remoteCode > 0 && currentCode >= remoteCode) {
    pill = "已是最新";
    pillClass = "current";
    buttonText = "排除重複安裝";
    disabled = true;
    reason = "遠端版本碼未高於目前版本，已自動排除重複安裝。";
  } else if (!installed?.installed) {
    pill = "未安裝";
    pillClass = "missing";
  }

  return { pill, pillClass, buttonText, disabled, reason, remoteCode, currentCode };
}

function renderUpdateIcon(item, installed, index) {
  const state = getUpdateState(item, installed);
  const imageUrl = resolveManifestRelativeUrl(item.iconUrl || item.imageUrl, "assets/update-splash.png");

  return `
    <button class="update-icon-card" type="button" data-update-open="${index}">
      <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(item.name || "APK")} 圖標" loading="lazy" onerror="this.onerror=null;this.src='assets/update-splash.png';">
      <span class="status-pill ${state.pillClass}">${state.pill}</span>
      <strong>${escapeHtml(item.name || item.id || "未命名 APK")}</strong>
      <small>${escapeHtml(item.versionName || "版本未標示")}</small>
    </button>
  `;
}

function renderUpdateDetailPage(index) {
  if (!updateDetail) return;
  const item = currentUpdateItems[index];
  if (!item) return;

  const installed = currentInstalledMap.get(item.packageName);
  const state = getUpdateState(item, installed);
  const remoteCode = Number(item.versionCode || 0);
  const currentCode = Number(installed?.versionCode || 0);
  const installedText = installed?.installed ? `${escapeHtml(installed.versionName || "")} (${currentCode})` : "尚未安裝";
  const remoteText = `${escapeHtml(item.versionName || "")} (${remoteCode || "未填"})`;
  const changelog = Array.isArray(item.changelog) ? item.changelog.join("、") : (item.changelog || item.note || "");
  const iconUrl = resolveManifestRelativeUrl(item.iconUrl || item.imageUrl, "assets/app-logo.png");
  const description = item.description || item.introduction || changelog || item.note || "此 APK 尚未填寫介紹。";
  const targetSdkText = item.targetSdk ? `SDK ${escapeHtml(item.targetSdk)}` : "未標示";
  const galleryImages = Array.isArray(item.galleryImages) ? item.galleryImages.slice(0, 2) : [];
  while (galleryImages.length < 2) galleryImages.push("");
  const galleryHtml = galleryImages.map((url, slot) => {
    const imageUrl = resolveManifestRelativeUrl(url, "assets/update-splash.png");
    return `
      <figure class="update-gallery-slot">
        <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(item.name || "APK")} 圖片位置 ${slot + 1}" loading="lazy" onerror="this.onerror=null;this.src='assets/update-splash.png';">
        <figcaption>圖片位置 ${slot + 1}</figcaption>
      </figure>
    `;
  }).join("");

  updateDetail.hidden = false;
  updateDetail.innerHTML = `
    <div class="update-detail-top">
      <button class="secondary-button" type="button" data-update-back>返回圖標清單</button>
      <span class="status-pill ${state.pillClass}">${state.pill}</span>
    </div>
    <article class="update-card" data-update-card="${index}">
      <header>
        <div>
          <h3>${escapeHtml(item.name || item.id || "未命名 APK")}</h3>
        </div>
      </header>
      <div class="update-card-body">
        <div class="update-icon-panel">
          <img class="update-detail-icon" src="${escapeHtml(iconUrl)}" alt="${escapeHtml(item.name || "APK")} 圖標" loading="lazy" onerror="this.onerror=null;this.src='assets/app-logo.png';">
          <span>${escapeHtml(item.name || "APK")}</span>
        </div>
        <div class="update-copy-area copyable-text">
          <p class="update-description">${escapeHtml(description)}</p>
        </div>
      </div>
      <div class="update-gallery-grid">${galleryHtml}</div>
      <div class="update-meta">
        <span><strong>目前版本</strong><br>${installedText}</span>
        <span><strong>雲端版本</strong><br>${remoteText}</span>
        <span><strong>大小</strong><br>${escapeHtml(item.sizeLabel || item.size || "未標示")}</span>
        <span><strong>最低 / 目標 SDK</strong><br>${escapeHtml(item.minAndroid || "未標示")} / ${targetSdkText}</span>
      </div>
      <p class="update-note copyable-text">${escapeHtml(state.reason || changelog || "沒有填寫更新內容。")}</p>
      <div class="update-progress" data-update-progress><span></span></div>
      <button type="button" data-update-install="${index}" ${state.disabled ? "disabled" : ""}>${state.buttonText}</button>
    </article>
  `;
  updateDetail.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderUpdateCard(item, installed, index) {
  const state = getUpdateState(item, installed);
  const remoteCode = Number(item.versionCode || 0);
  const currentCode = Number(installed?.versionCode || 0);
  const installedText = installed?.installed ? `${escapeHtml(installed.versionName || "")} (${currentCode})` : "尚未安裝";
  const remoteText = `${escapeHtml(item.versionName || "")} (${remoteCode || "未填"})`;
  const changelog = Array.isArray(item.changelog) ? item.changelog.join("、") : (item.changelog || item.note || "");
  const iconUrl = resolveManifestRelativeUrl(item.iconUrl || item.imageUrl, "assets/app-logo.png");
  const description = item.description || item.introduction || changelog || item.note || "此 APK 尚未填寫介紹。";
  const targetSdkText = item.targetSdk ? `SDK ${escapeHtml(item.targetSdk)}` : "未標示";
  const galleryImages = Array.isArray(item.galleryImages) ? item.galleryImages.slice(0, 2) : [];
  while (galleryImages.length < 2) galleryImages.push("");
  const galleryHtml = galleryImages.map((url, slot) => {
    const imageUrl = resolveManifestRelativeUrl(url, "assets/update-splash.png");
    return `
      <figure class="update-gallery-slot">
        <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(item.name || "APK")} 圖片位置 ${slot + 1}" loading="lazy" onerror="this.onerror=null;this.src='assets/update-splash.png';">
        <figcaption>圖片位置 ${slot + 1}</figcaption>
      </figure>
    `;
  }).join("");

  return `
    <article class="update-card" data-update-card="${index}">
      <header>
        <div>
          <h3>${escapeHtml(item.name || item.id || "未命名 APK")}</h3>
        </div>
        <span class="status-pill ${state.pillClass}">${state.pill}</span>
      </header>
      <div class="update-card-body">
        <div class="update-icon-panel">
          <img class="update-detail-icon" src="${escapeHtml(iconUrl)}" alt="${escapeHtml(item.name || "APK")} 圖標" loading="lazy" onerror="this.onerror=null;this.src='assets/app-logo.png';">
          <span>${escapeHtml(item.name || "APK")}</span>
        </div>
        <div class="update-copy-area copyable-text">
          <p class="update-description">${escapeHtml(description)}</p>
        </div>
      </div>
      <div class="update-gallery-grid">${galleryHtml}</div>
      <div class="update-meta">
        <span><strong>目前版本</strong><br>${installedText}</span>
        <span><strong>雲端版本</strong><br>${remoteText}</span>
        <span><strong>大小</strong><br>${escapeHtml(item.sizeLabel || item.size || "未標示")}</span>
        <span><strong>最低 / 目標 SDK</strong><br>${escapeHtml(item.minAndroid || "未標示")} / ${targetSdkText}</span>
      </div>
      <p class="update-note copyable-text">${escapeHtml(state.reason || changelog || "沒有填寫更新內容。")}</p>
      <div class="update-progress" data-update-progress><span></span></div>
      <button type="button" data-update-install="${index}" ${state.disabled ? "disabled" : ""}>${state.buttonText}</button>
    </article>
  `;
}

async function installUpdateFromCard(index) {
  const item = currentUpdateItems[index];
  if (!item) throw new Error("找不到更新項目。");
  const nativeItem = {
    ...item,
    apkUrl: resolveManifestRelativeUrl(item.apkUrl)
  };

  const card = document.querySelector(`[data-update-card="${index}"]`);
  const button = document.querySelector(`[data-update-install="${index}"]`);
  const note = card?.querySelector(".update-note");
  const progress = card?.querySelector("[data-update-progress] span");
  if (!card || !button || !hasNativeUpdater()) return;

  button.disabled = true;
  if (note) note.textContent = "正在交給 Android 下載安裝服務...";
  const started = parseNativeResult(window.ShenYueUpdater.downloadAndInstall(JSON.stringify(nativeItem)));
  if (!started.ok) {
    if (note) note.textContent = started.message || "無法開始下載。";
    button.disabled = false;
    renderUpdateDeviceState();
    return;
  }

  const timer = setInterval(() => {
    const task = parseNativeResult(window.ShenYueUpdater.getTaskStatus(started.taskId));
    if (progress) progress.style.setProperty("--progress", `${task.progress || 0}%`);
    if (note) note.textContent = task.message || "";
    if (["failed", "complete", "installing"].includes(task.status)) {
      clearInterval(timer);
      renderUpdateDeviceState();
    }
  }, 700);
}

function switchTab(tabId) {
  document.querySelectorAll("[data-tab-panel]").forEach((panel) => {
    panel.classList.toggle("active", panel.id === tabId);
  });
  document.querySelectorAll("[data-tab-target]").forEach((button) => {
    button.classList.toggle("active", button.dataset.tabTarget === tabId);
  });
  if (tabId === "updates") {
    initUpdateCenter();
  }
  document.getElementById(tabId)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function restoreChecklist() {
  const saved = JSON.parse(localStorage.getItem(checklistKey) || "[]");
  checklist.querySelectorAll("input").forEach((input, index) => {
    input.checked = Boolean(saved[index]);
  });
}

recordForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(recordForm).entries());
  delete data.photos;
  localStorage.setItem(storageKey, JSON.stringify(data));
  renderRecord();
  cloudStatus.textContent = "保固資料已儲存，可上傳到 Apps Script。";
});

document.querySelector("[data-save-upload-warranty]").addEventListener("click", async () => {
  if (!recordForm.reportValidity()) return;
  const data = Object.fromEntries(new FormData(recordForm).entries());
  delete data.photos;
  localStorage.setItem(storageKey, JSON.stringify(data));
  renderRecord();
  cloudStatus.textContent = "正在上傳保固資料與照片到 Apps Script...";
  try {
    await sendToCloud(getPayload("iphone-warranty", { ...data, photos: warrantyPhotos }));
    cloudStatus.textContent = "保固資料已儲存並上傳到申悅 Apps Script。";
    photoInput.value = "";
    warrantyPhotos = [];
    photoPreview.innerHTML = "<p>尚未選擇照片。</p>";
    renderRecord();
  } catch (error) {
    cloudStatus.textContent = `上傳失敗：${error.message}`;
  }
});

document.querySelector("[data-upload-warranty]").addEventListener("click", async () => {
  const record = getRecord();
  if (!Object.keys(record).length) {
    cloudStatus.textContent = "請先填寫並儲存保固紀錄。";
    return;
  }
  try {
    await sendToCloud(getPayload("iphone-warranty", { ...record, photos: warrantyPhotos }));
    cloudStatus.textContent = "保固資料與照片已送出到申悅雲端。";
  } catch (error) {
    cloudStatus.textContent = `上傳失敗：${error.message}`;
  }
});

photoInput.addEventListener("change", async () => {
  cloudStatus.textContent = "照片處理中...";
  await prepareWarrantyPhotos(photoInput.files);
  cloudStatus.textContent = `已選擇 ${warrantyPhotos.length} 張照片。`;
});

document.addEventListener("click", (event) => {
  const tabButton = event.target.closest("[data-tab-target]");
  if (tabButton) {
    switchTab(tabButton.dataset.tabTarget);
    return;
  }

  const refreshUpdates = event.target.closest("[data-refresh-updates]");
  if (refreshUpdates) {
    initUpdateCenter(true);
    return;
  }

  const updateBack = event.target.closest("[data-update-back]");
  if (updateBack) {
    if (updateDetail) {
      updateDetail.hidden = true;
      updateDetail.innerHTML = "";
    }
    updateList?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  const updateOpen = event.target.closest("[data-update-open]");
  if (updateOpen) {
    renderUpdateDetailPage(Number(updateOpen.dataset.updateOpen));
    return;
  }

  const installPermission = event.target.closest("[data-open-install-permission]");
  if (installPermission) {
    if (hasNativeUpdater()) {
      window.ShenYueUpdater.openInstallPermission();
    } else if (updateStatus) {
      updateStatus.textContent = "瀏覽器模式無法開啟 Android 安裝權限，請在 APK 內使用。";
    }
    return;
  }

  const updateInstall = event.target.closest("[data-update-install]");
  if (updateInstall) {
    const index = Number(updateInstall.dataset.updateInstall);
    installUpdateFromCard(index).catch((error) => {
      const card = document.querySelector(`[data-update-card="${index}"]`);
      const note = card?.querySelector(".update-note");
      if (note) note.textContent = `無法開始更新：${error.message || error}`;
      updateInstall.disabled = false;
    });
    return;
  }

  const videoFilter = event.target.closest("[data-video-filter]");
  if (videoFilter) {
    activeVideoCategory = videoFilter.dataset.videoFilter;
    document.querySelectorAll("[data-video-filter]").forEach((button) => {
      button.classList.toggle("active", button === videoFilter);
    });
    renderVideos();
  }
});

videoSearch.addEventListener("input", renderVideos);

checklist.addEventListener("change", () => {
  const values = [...checklist.querySelectorAll("input")].map((input) => input.checked);
  localStorage.setItem(checklistKey, JSON.stringify(values));
});

document.querySelector("[data-reset-checklist]").addEventListener("click", () => {
  localStorage.removeItem(checklistKey);
  restoreChecklist();
});

adminShortcut.addEventListener("click", () => {
  switchTab("admin");
  const input = document.querySelector("[data-admin-pin]");
  input.focus();
});

document.querySelector("[data-admin-login]").addEventListener("click", () => {
  const input = document.querySelector("[data-admin-pin]");
  if (input.value !== adminPin) {
    input.value = "";
    input.placeholder = "PIN 錯誤";
    return;
  }

  adminPanel.hidden = false;
  const settings = getAdminSettings();
  const form = document.querySelector("[data-admin-form]");
  form.elements.cloudEndpoint.value = settings.cloudEndpoint || "";
  form.elements.contentConfigUrl.value = settings.contentConfigUrl || "";
  form.elements.heroTitle.value = settings.heroTitle || defaultContent.heroTitle;
  form.elements.shopPhone.value = settings.shopPhone || "0970-117-708";
  form.elements.lineId.value = settings.lineId || "7708LUNG";
  adminOutput.textContent = "管理模式已開啟。\n可設定雲端網址、測試連線、匯出本機資料。";
});

document.querySelector("[data-admin-form]").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget).entries());
  localStorage.setItem(adminKey, JSON.stringify(data));
  applyContent({ heroTitle: data.heroTitle });
  adminOutput.textContent = `已儲存管理設定：\n${JSON.stringify(data, null, 2)}`;
  cloudStatus.textContent = "已設定雲端網址，可上傳保固資料。";
});

document.querySelector("[data-load-content]").addEventListener("click", () => {
  loadRemoteContent(true);
});

document.querySelector("[data-test-cloud]").addEventListener("click", async () => {
  try {
    await sendToCloud(getPayload("test", { message: "申悅助手雲端測試" }));
    adminOutput.textContent = "測試資料已送出。請到 Google 試算表確認。";
  } catch (error) {
    adminOutput.textContent = `測試失敗：${error.message}`;
  }
});

document.querySelector("[data-export-data]").addEventListener("click", () => {
  const data = {
    warranty: getRecord(),
    admin: getAdminSettings(),
    checklist: JSON.parse(localStorage.getItem(checklistKey) || "[]")
  };
  adminOutput.textContent = JSON.stringify(data, null, 2);
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installButton.hidden = false;
});

installButton.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installButton.hidden = true;
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js");
  });
}

window.addEventListener("pageshow", checkRemoteContentNow);
window.addEventListener("focus", checkRemoteContentNow);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) checkRemoteContentNow();
});

renderRecord();
restoreChecklist();
renderVideos();
if (updateUrlInput) {
  updateUrlInput.value = getPreferredUpdateManifestUrl();
}
if (location.hash === "#updates") {
  switchTab("updates");
}
checkRemoteContentNow();
cloudStatus.textContent = "已設定申悅雲端網址，可上傳保固資料。";
