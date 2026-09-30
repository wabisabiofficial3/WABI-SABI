# 📦 Vendor Libraries Manual (`/js/vendor`)

This directory houses third-party vendor libraries that are vendored locally to guarantee 100% offline availability, eliminate CDN latency, and avoid external tracking scripts.

---

## 📂 File Index & Technical Details

### 1. [`pdf.min.js`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/js/vendor/pdf.min.js)
- **Source**: Mozilla PDF.js project (`pdfjs-dist`).
- **Role**: The main client-side PDF rendering library. It exposes the global `window.pdfjsLib` object.
- **Used By**: [`js/reader.js`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/js/reader.js) inside [`reader.html`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/reader.html).
- **Functionality**:
  - Fetches the PDF document from `/assets/books/we-should-all-be-feminists.pdf` via `pdfjsLib.getDocument()`.
  - Parses document metadata, total page count, and page dimensions.
  - Renders vector glyphs, typography, and images onto an HTML5 `<canvas id="pdfCanvas">`.

### 2. [`pdf.worker.min.js`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/js/vendor/pdf.worker.min.js)
- **Source**: Mozilla PDF.js Web Worker.
- **Role**: Background execution worker for decoding complex PDF streams, fonts, and decompression without blocking the main browser UI thread.
- **Configured In**: [`js/reader.js`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/js/reader.js) via:
  ```javascript
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/js/vendor/pdf.worker.min.js';
  ```

---

## 🔒 Security & Offline Guarantee

Both files are hosted directly by Express via the static root. No external script tags are loaded from `unpkg.com` or `cdnjs.com`, guaranteeing that reading sessions remain completely functional even in offline or restricted intranet environments.
