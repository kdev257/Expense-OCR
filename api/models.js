// api/models.js

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { clientApiKey } = req.query;
  const apiKey = process.env.GEMINI_API_KEY || 
                 process.env.Gemini_API_Key || 
                 process.env.VITE_GEMINI_API_KEY || 
                 process.env.Vite_Gemini_API_Key || 
                 clientApiKey;

  if (!apiKey) {
    return res.status(200).json({ models: [] });
  }

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`);
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch models from Google' });
    }
    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
