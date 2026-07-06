# 申悅更新中心 GitHub 上傳包

把本資料夾裡面的內容上傳到 `https://github.com/SYLONG7708/update` 的根目錄。

上傳後車機 App 會讀取：

```text
https://raw.githubusercontent.com/SYLONG7708/update/main/updates.json
```

## 重要檔案

- `updates.json`：雲端更新清單。
- `apks/`：APK 下載檔案。
- `assets/update-icons/`：每個 APK 的方形圖標。
- `assets/update-apps/`：每個 APK 的單獨詳情頁圖片。
- `index.html`、`app.js`、`styles.css`：網頁版更新中心。

## 修改方式

只要修改 `updates.json` 的 `name`、`description`、`iconUrl`、`imageUrl`、`apkUrl`、`sha256` 後重新上傳，車機端按「重新整理」即可看到變更，不必重新安裝更新中心 APK。

## 公開頁一鍵新增或替換 APK

已新增後端工具：

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\start-update-uploader.ps1
```

工具會啟動本機 uploader，透過 Cloudflare Tunnel 產生公開網址。把網址給上傳者後，對方可選擇「替換既有 APK」、「新增新的 APK」或直接更換 App 圖標。選 APK 後會自動：

- 新增全新的更新中心 App 項目，或替換既有項目的 APK。
- 替換 `apk-cloud` GitHub Release 裡同名或同套件 APK。
- 更新本 repo 的 `updates.json`。
- 同步 `shen-yue-iphone-assistant` 的備援 `updates.json`。
- 呼叫 Apps Script `replace-update-manifest`，讓車機更新中心立即讀到新版資料。

新增模式可填 App 顯示名稱、分類、介紹、圖標網址、詳情圖片網址與更新說明；也可直接選圖標圖片檔。圖標圖片會上傳到 `assets/update-icons/`，並同步 `updates.json`、申悅助手備援清單與 Apps Script。

GitHub token 只留在執行工具的電腦端，不寫入公開網頁。

## 開機自動啟動

已提供 Windows 工作排程安裝腳本：

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\install-update-uploader-autostart.ps1
```

安裝後會建立 `ShenYueUpdateUploaderAutoStart` 排程，Windows 登入後約 30 秒自動啟動一鍵上傳工具，無需再手動輸入指令。

每次啟動後會更新：

- 桌面捷徑：`ShenYue Update Uploader.url`
- 桌面網址檔：`ShenYue Update Uploader URL.txt`
- 本機記錄：`output/uploader/latest-upload-url.txt`
- 本機 JSON：`output/uploader/latest-upload-url.json`

Cloudflare quick tunnel 網址重開機後可能會改變，以上檔案會自動寫入最新可用網址。

## 大檔提醒

目前包內有部分 APK 超過 100 MB。這些大檔不一定能直接放進 GitHub repository；如果上傳失敗，請把 APK 放到 GitHub Release 或其他雲端，然後改 `updates.json` 的 `apkUrl`。
