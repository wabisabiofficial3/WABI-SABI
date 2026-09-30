# 📚 Books & Literature Assets Manual (`/assets/books`)

This directory contains the primary curated e-book literature files served to members in the distraction-free reading canvas ([`reader.html`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/reader.html)).

---

## 📂 File Index & Technical Details

### 1. [`we-should-all-be-feminists.pdf`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/assets/books/we-should-all-be-feminists.pdf)
- **Title**: *We Should All Be Feminists*
- **Author**: Chimamanda Ngozi Adichie
- **Format**: Adobe PDF (Portable Document Format), vector text and typography.
- **Consumption**:
  - Served statically by Express under `/assets/books/we-should-all-be-feminists.pdf`.
  - Loaded into memory by [`js/reader.js`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/js/reader.js) via Mozilla's [`pdf.min.js`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/js/vendor/pdf.min.js).
  - Rendered onto the `<canvas id="pdfCanvas">` with crisp vector scaling, page flipping, and zoom adjustments.

### 2. [`we-should-all-be-feminists.json`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/assets/books/we-should-all-be-feminists.json)
- **Format**: JSON (JavaScript Object Notation).
- **Role**: Companion structural metadata and chapter breakdown.
- **Payload Schema**:
  ```json
  {
    "id": "book-001",
    "title": "We Should All Be Feminists",
    "author": "Chimamanda Ngozi Adichie",
    "year": 2014,
    "totalPages": 32,
    "currentChapter": "Introduction",
    "chapters": [
      { "title": "Prologue: A Conversation in Lagos", "page": 1 },
      { "title": "The Meaning of Gender", "page": 8 },
      { "title": "Unlearning Expectations", "page": 17 },
      { "title": "Conclusion: A Fairer World", "page": 28 }
    ],
    "coverUrl": "/assets/atomic_habits_cover.jpg",
    "pdfUrl": "/assets/books/we-should-all-be-feminists.pdf"
  }
  ```
- **Used By**:
  - [`server/routes/content.js`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/server/routes/content.js): Serves book metadata to `/api/content/current-book`.
  - [`js/reader.js`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/js/reader.js): Populates table of contents, chapter jump dropdowns, and reading progress percentage.
