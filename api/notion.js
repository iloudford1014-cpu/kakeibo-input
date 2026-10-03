// Notion API proxy (CORS回避用)
// action: "create"（デフォルト）= ページ作成 / "query" = DBクエリ
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token, action = 'create', databaseId, payload } = req.body || {};

  if (!token) {
    return res.status(400).json({ error: 'Missing token' });
  }

  let url;
  let body;
  if (action === 'query') {
    if (!databaseId) return res.status(400).json({ error: 'Missing databaseId' });
    url = `https://api.notion.com/v1/databases/${databaseId}/query`;
    body = payload || {};
  } else {
    if (!payload) return res.status(400).json({ error: 'Missing payload' });
    url = 'https://api.notion.com/v1/pages';
    body = payload;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    return res.status(response.ok ? 200 : response.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
