import * as pdfjsLib from 'pdfjs-dist';
import Tesseract from 'tesseract.js';

// Configure the worker for PDF.js using the exact matching version from CDN
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

/**
 * Converts a file to base64 string.
 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
}

/**
 * Helper to read PDF.js text layer.
 */
async function extractTextFromTextLayer(pdfDoc) {
  let fullText = '';
  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item) => item.str).join(' ');
    fullText += pageText + '\n';
  }
  return fullText.trim();
}

/**
 * Helper to render PDF page onto canvas and perform OCR via Tesseract.js.
 */
async function extractTextWithOCR(pdfDoc, onProgress) {
  let fullText = '';
  const totalPages = pdfDoc.numPages;

  for (let i = 1; i <= totalPages; i++) {
    if (onProgress) {
      onProgress({ stage: 'OCR', message: `Performing OCR on page ${i} of ${totalPages}...`, progress: (i / totalPages) * 100 });
    }

    const page = await pdfDoc.getPage(i);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    // Scale up for better OCR accuracy
    const scale = 2.0;
    const viewport = page.getViewport({ scale });
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: context, viewport }).promise;

    // Perform OCR on this page's canvas
    const { data: { text } } = await Tesseract.recognize(canvas, 'eng', {
      logger: (m) => {
        if (m.status === 'recognizing' && onProgress) {
          const pageProgress = (i - 1) / totalPages * 100 + (m.progress / totalPages * 100);
          onProgress({ stage: 'OCR', message: `Page ${i} OCR: ${Math.round(m.progress * 100)}%`, progress: pageProgress });
        }
      }
    });

    fullText += text + '\n';
  }
  return fullText.trim();
}

/**
 * Helper function to parse a PDF file.
 */
async function parsePDF(file, onProgress) {
  if (onProgress) onProgress({ stage: 'LOADING', message: 'Loading PDF file...', progress: 10 });
  
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdfDoc = await loadingTask.promise;
  
  if (onProgress) onProgress({ stage: 'TEXT_EXTRACTION', message: 'Extracting text layer...', progress: 40 });
  
  let text = await extractTextFromTextLayer(pdfDoc);
  
  // If no text was found (scanned PDF), use OCR
  if (text.length < 50) {
    if (onProgress) onProgress({ stage: 'OCR_START', message: 'No text layer found. Initializing OCR scanner...', progress: 50 });
    text = await extractTextWithOCR(pdfDoc, onProgress);
  }
  
  if (!text || text.trim().length < 5) {
    throw new Error('Unable to extract any text from this PDF.');
  }
  
  return text;
}

/**
 * Main parser entrypoint. Supports both PDFs and standard Images.
 */
export async function parseDocument(file, apiKey, onProgress, modelName = 'gemini-1.5-flash') {
  if (file.type === 'application/pdf') {
    // 1. Parse PDF to extract text
    const text = await parsePDF(file, onProgress);
    // 2. Call Gemini stable API with text content
    return await extractInvoiceDetails(text, apiKey, onProgress, false, '', modelName);
  } else if (file.type.startsWith('image/')) {
    if (onProgress) onProgress({ stage: 'LOADING', message: 'Reading photo contents...', progress: 30 });
    
    // Convert photo to base64
    const base64Data = await fileToBase64(file);
    
    // Call Gemini API directly with the image data (Multimodal Vision API)
    return await extractInvoiceDetails(base64Data, apiKey, onProgress, true, file.type, modelName);
  } else {
    throw new Error('Unsupported file type. Please upload a PDF or an Image (JPG/PNG).');
  }
}

/**
 * Calls Gemini to retrieve structured invoice details.
 * Supports text prompt or multimodal base64 image data.
 */
export async function extractInvoiceDetails(content, apiKey, onProgress, isImage = false, mimeType = '', modelName = 'gemini-1.5-flash') {
  if (onProgress) onProgress({ stage: 'AI_EXTRACTION', message: 'Analyzing document with Gemini AI...', progress: 85 });

  const response = await fetch('/api/extract', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      content,
      isImage,
      mimeType,
      modelName,
      clientApiKey: apiKey
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.error || `HTTP error ${response.status}`;
    throw new Error(`Extraction Error: ${errorMessage}`);
  }

  const extractedData = await response.json();
  
  if (onProgress) onProgress({ stage: 'COMPLETE', message: 'Extraction completed successfully!', progress: 100 });
  
  return {
    bill_number: extractedData.bill_number || '',
    bill_date: extractedData.bill_date || '',
    amount: extractedData.amount !== null && extractedData.amount !== undefined ? Number(extractedData.amount) : '',
    supplier_name: extractedData.supplier_name || '',
    expense_type: extractedData.expense_type || 'Fuel Bill'
  };
}
