# Expense OCR AI - Smart Bill & Invoice Scanner

An elegant, contemporary React.js + Vite web application that automates the process of scanning and parsing expense invoices and receipts. Built using Google Gemini 1.5 Flash for smart entity extraction and classification, and Tesseract.js for robust fallback OCR on scanned documents.

![Screenshot of Dashboard](https://raw.githubusercontent.com/kdev257/Expense-OCR/main/public/dashboard-preview.png) *(Placeholder or reference link)*

## Features

- 📱 **Smart & Contemporary UI:** Fully-responsive dashboard with glassmorphism, glowing states, dark-theme layout, and elegant micro-animations.
- 📂 **Multi-stage Extraction Pipeline:**
  1. **Direct PDF Reading:** Extracts text layers instantly if available.
  2. **Tesseract.js OCR Fallback:** Automatically switches to OCR if the uploaded document is an image/scanned PDF.
  3. **Gemini AI Structured Parsing:** Sends text to Google Gemini 1.5 Flash to retrieve clean JSON mapping of `bill_number`, `bill_date`, `amount`, `supplier_name`, and `expense_type`.
- 📁 **Inline-Editable Data Grid:** View, modify, or add missing details inline with immediate local storage auto-saving.
- 📊 **Visual Statistics Panel:** Review total spend amount, bill counts, and expense split (Fuel Bills vs. Medical Bills).
- 📈 **Excel Sheet Export:** Download all structured records directly into formatted Excel sheets.
- 🔐 **Secure Key Storage:** Key configurations are stored locally inside the user's browser `localStorage`, ensuring API keys are never exposed on servers.

---

## Getting Started

### Prerequisites

- Node.js (tested and optimized for versions `>= 14.17.6`)
- npm

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/kdev257/Expense-OCR.git
   cd Expense-OCR
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the local development server:**
   ```bash
   npm run dev
   ```

4. **Build for production:**
   ```bash
   npm run build
   ```

---

## Node.js 14 Compatibility Wrapper

To run modern Vite 4 builds on Node.js `< 16` (which does not natively support `base64url` buffer encoding), this repository includes a custom wrapper:
- **`vite-wrapper.js`:** Monkey-patches the node `Buffer` prototype to implement standard `base64url` encoding.
- The default `package.json` scripts are updated to run `node vite-wrapper.js` automatically.

---

## Vercel Deployment

This project is fully ready for deployment on **Vercel** free tier:

### Deploy via Vercel Dashboard (Recommended)

1. Go to [Vercel](https://vercel.com/) and sign in.
2. Click **Add New** > **Project**.
3. Import your GitHub repository: `kdev257/Expense-OCR`.
4. Vercel will automatically detect **Vite** and configure the settings.
5. *(Optional)* Under **Environment Variables**, add:
   - `VITE_GEMINI_API_KEY`: Your Google Gemini API Key.
6. Click **Deploy**.

---

## Technologies Used

- **Frontend Core:** React.js, Vite 4
- **OCR Engine:** [Tesseract.js](https://github.com/naptha/tesseract.js)
- **PDF Extraction:** [PDF.js (Mozilla)](https://github.com/mozilla/pdf.js)
- **AI Extraction:** Google Gemini 1.5 Flash (via direct Google Generative AI REST API)
- **Spreadsheet Generation:** [SheetJS (xlsx)](https://github.com/SheetJS/sheetjs)
- **Icons:** Lucide React

<!-- redeploy trigger 2 -->
