// api/extract.js

export default async function handler(req, res) {
  // CORS Headers support
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { content, isImage, mimeType, modelName, clientApiKey } = req.body;
  
  // Use the server-side env variable, falling back to client-provided key if available
  const apiKey = process.env.GEMINI_API_KEY || clientApiKey;

  if (!apiKey) {
    return res.status(500).json({ 
      error: 'Gemini API Key is not configured on the server. Please add GEMINI_API_KEY to Vercel Environment Variables.' 
    });
  }

  const selectedModel = modelName || 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1/models/${selectedModel}:generateContent?key=${apiKey}`;

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

  // Build payload
  const parts = [];
  if (isImage) {
    parts.push({
      inlineData: {
        mimeType: mimeType,
        data: content
      }
    });
    parts.push({ text: prompt });
  } else {
    parts.push({ text: `${prompt}\n\nInvoice Text Content:\n${content}` });
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{ parts: parts }]
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: errorData.error?.message || 'Gemini API Error' });
    }

    const responseData = await response.json();
    const rawText = responseData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      return res.status(500).json({ error: 'Gemini API returned an empty response.' });
    }

    let cleanText = rawText.trim();
    if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/^```(json)?/i, '').replace(/```$/, '').trim();
    }

    const extractedData = JSON.parse(cleanText);
    return res.status(200).json(extractedData);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Server error processing extraction.' });
  }
}
