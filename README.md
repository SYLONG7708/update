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

## 大檔提醒

目前包內有部分 APK 超過 100 MB。這些大檔不一定能直接放進 GitHub repository；如果上傳失敗，請把 APK 放到 GitHub Release 或其他雲端，然後改 `updates.json` 的 `apkUrl`。
