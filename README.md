# Utah-Code-NCIC-Lookup-v1
## 📄 License
# Utah Code / NCIC Lookup App

This is a **Progressive Web App (PWA)** built to provide quick search and filtering over violation and NCIC codes.  
The data is embedded directly from an Excel workbook and works completely offline once installed.

---

## 🚀 Features
- **Jurisdiction filter** (defaults to **STATE OF UTAH**).
- **Free text search** over *Short Description* and *NCIC Code*.
- **Record details modal** with Prev/Next navigation.
- **Pagination** with adjustable page size.
- **Offline support** (service worker caches everything).
- **Installable on iOS/Android** via Add to Home Screen / Install App.
- **Responsive design** for mobile and desktop.

---

## 🌐 Live App
The app is published with GitHub Pages here:

👉 [https://sssamiam2-prog.github.io/Utah-Code-NCIC-Code/](https://sssamiam2-prog.github.io/Utah-Code-NCIC-Lookup-v1/)

---

## 📦 Files in this repo
- `index.html` – App entry point.
- `app.js` – All filtering, search, and UI logic.
- `smot_data.json` – Data converted from Excel (full dataset).
- `manifest.webmanifest` – PWA manifest for installable app.
- `service-worker.js` – Offline caching logic.
- `icon-192.png`, `icon-512.png` – App icons (replace with your logo if desired).

---

## 📱 Installing on your phone
1. Open the live app link above in your mobile browser.  
2. On iPhone (Safari): Share → **Add to Home Screen**.  
3. On Android (Chrome): Menu (⋮) → **Install App** (or **Add to Home Screen**).  

Once installed, the app works offline.

---

## 🛠 Development notes
- Data source: Converted from `SMOT_table.xlsx` into `smot_data.json`.  
- Default jurisdiction: `STATE OF UTAH`.  
- Some dropdown filters are intentionally hidden (e.g., Suggested Fine, Warr Flag, etc.), but their data still displays in results.

---

## 🔧 Customization
- To **update the dataset**, replace `smot_data.json` with new data.  
- To **change app name/icons**, edit:
  - `manifest.webmanifest`
  - `index.html` `<title>` tag
  - Replace `icon-192.png` and `icon-512.png` with your PNGs.

---

## 📄 License
Internal use only. Not intended for public distribution.

