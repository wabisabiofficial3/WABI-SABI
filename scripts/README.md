# 🛠️ Build & Maintenance Scripts Manual (`/scripts`)

This directory contains standalone operational, asset compilation, and content generation utility scripts for **Wabi Sabi: A Reading Sanctuary**.

---

## 📂 File Index & Technical Details

### [`build_reference_pdf.js`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/scripts/build_reference_pdf.js)
- **Engine**: Node.js utilizing `pdf-lib`.
- **Purpose**: Generates the complete, high-fidelity reference e-book PDF located at [`assets/books/we-should-all-be-feminists.pdf`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/assets/books/we-should-all-be-feminists.pdf).
- **Execution Command**:
  ```bash
  node scripts/build_reference_pdf.js
  ```
- **What It Generates**:
  - **Cover Page**: Terracotta ochre color palette (`rgb(0.75, 0.40, 0.17)`) with elegant centered serif title layout.
  - **Front Matter**: Title page, publisher imprint (Fourth Estate London), copyright declarations, and Dedication.
  - **Full Chapter Body**: 32 distinct literary pages matching Chimamanda Ngozi Adichie's essay, with running headers, chapter section titles, page footers, and justify-spaced typography.
  - **Target Output**: Writes binary output to `assets/books/we-should-all-be-feminists.pdf`.

---

## 💡 When to Run
Run this script whenever you need to regenerate the default sanctuary book asset, test new PDF typography layouts, or seed a fresh environment where binary book files are absent.
