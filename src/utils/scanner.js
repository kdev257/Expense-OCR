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

  const url = `https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=${apiKey}`;

  const prompt = `
You are a highly accurate financial invoice data extractor. Analyze the document provided (text or image) and extract the required fields as a JSON object.

Required Fields to Extract:
1. "bill_number": The invoice, bill, receipt, or reference number (string). If not present or unclear, use null.
2. "bill_date": The date of the invoice/bill formatted as YYYY-MM-DD. If not present or unclear, use null.
3. "amount": The total payable amount as a float/number. Look for "Total", "Grand Total", "Amount Due", or total line items. If not present or unclear, use null.
4. "supplier_name": The name of the vendor, business, shop, hospital, or supplier (string). If not present or unclear, use null.
5. "expense_type": Classify this invoice into exactly one of: "Fuel Bill" or "Medical Bill".
   - Classify as "Fuel Bill" if the text contains keywords related to petrol, diesel, gas station, fuel, oil, toll, vehicle refuel, power, etc.
   - Classify as "Medical Bill" if the text contains hospital, pharmacy, medicine, lab test, clinic, doctor, prescription, treatment, healthcare, etc.
   - If it matches neither or is ambiguous, choose the closest one or use null.

Return ONLY a valid JSON object matching the following schema. Do not output any other text or markdown wrappers.

JSON Schema:
{
  "bill_number": string | null,
  "bill_date": string | null,
  "amount": number | null,
  "supplier_name": string | null,
  "expense_type": "Fuel Bill" | "Medical Bill" | null
}
`;

  // Build the parts payload based on input type
  const parts = [];
  
  if (isImage) {
    // Add image base64 data
    parts.push({
      inlineData: {
        mimeType: mimeType,
        data: content
      }
    });
    // Add prompt instructions
    parts.push({ text: prompt });
  } else {
    // Add text contents and instructions combined
    parts.push({ text: `${prompt}\n\nInvoice Text Content:\n${content}` });
  }

  const requestBody = {
    contents: [
      {
        parts: parts
      }
    ]
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.error?.message || `HTTP error ${response.status}`;
    throw new Error(`Gemini API Error: ${errorMessage}`);
  }

  const responseData = await response.json();
  const rawText = responseData.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawText) {
    throw new Error('Gemini API returned an empty response.');
  }

  try {
    let cleanText = rawText.trim();
    // Strip markdown code fences if Gemini outputs them (e.g. ```json ... ```)
    if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/^```(json)?/i, '').replace(/```$/, '').trim();
    }
    const extractedData = JSON.parse(cleanText);
    
    if (onProgress) onProgress({ stage: 'COMPLETE', message: 'Extraction completed successfully!', progress: 100 });
    
    return {
      bill_number: extractedData.bill_number || '',
      bill_date: extractedData.bill_date || '',
      amount: extractedData.amount !== null && extractedData.amount !== undefined ? Number(extractedData.amount) : '',
      supplier_name: extractedData.supplier_name || '',
      expense_type: extractedData.expense_type || 'Fuel Bill' // default classification fallback
    };
  } catch (error) {
    console.error("JSON parsing error of Gemini output:", rawText, error);
    throw new Error('Failed to parse the structured data from Gemini API.');
  }
}
