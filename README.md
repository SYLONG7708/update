# 申悅 APK 更新中心 GitHub 上傳包

把本資料夾內容上傳到 `https://github.com/SYLONG7708/update` 的根目錄。

車機端預設讀取：

```text
https://raw.githubusercontent.com/SYLONG7708/update/main/updates.json
```

## 上傳後根目錄應該包含

- `updates.json`
- `apks/`
- `assets/`
- `index.html`
- `app.js`
- `styles.css`

## App 沒看到檔案時

如果車機顯示雲端清單讀取失敗，先確認這個網址是否能打開：

```text
https://raw.githubusercontent.com/SYLONG7708/update/main/updates.json
```

v1.0.2 已加入 App 內建清單備援；GitHub 尚未上傳或 raw 網址 404 時，畫面仍會顯示內建清單。若要讓「下載安裝」成功，`apkUrl` 指向的 APK 必須真的能被車機下載。

## 修改雲端內容

只要修改 `updates.json` 的 `name`、`description`、`iconUrl`、`imageUrl`、`apkUrl`、`sha256` 後重新上傳，車機端按「重新整理」即可看到，不需要重新安裝獨立更新中心 App。

## 大檔 APK

超過 GitHub 一般 repository 100 MiB 限制的 APK，請放到 GitHub Release 或其他雲端，然後把 `updates.json` 的 `apkUrl` 改成實際下載網址。本包目前的 `updates.json` 已改成使用 GitHub Release `apk-cloud` 的下載網址。
