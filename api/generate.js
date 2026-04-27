// api/generate.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: '只接受 POST 请求' });

  const apiKey = process.env.ZHIPU_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ZHIPU_API_KEY 未设置' });

  try {
    const body = req.body;
    // 接收自然语言消息
    const userMessage = body.message || '';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 40000);

    const aiResponse = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'glm-4-flash',
        messages: [
          {
            role: 'system',
            content: `你是一个专业的欧洲签证行程规划师。用户会告诉你他们想去哪些国家、旅行天数、偏好等信息。你需要根据这些信息，生成一份完整的每日行程单。

要求：
1. 每天安排 2-4 个景点，张弛有度，避免过度劳累
2. 城市顺序符合地理逻辑，大城市至少停留 1-2 天
3. 首日自动生成【入境抵达】信息，包含航班、机场、入住酒店
4. 最后一日自动生成【离境返程】信息
5. 城市间插入交通提示（火车/飞机，注明大概时间）
6. 住宿以酒店为主，交通以火车和飞机为主
7. 返回严格的 JSON 格式，不要任何额外解释
8. 景点名称使用中文，同时提供英文名
9. 每天标注景点预估游览时间

JSON 格式如下：
{
  "days": [
    {
      "day": 1,
      "date": "2026/04/24",
      "city": "罗马",
      "attractions": [
        {"name": "斗兽场", "nameEn": "Colosseum", "time": "2h"}
      ],
      "hotel": "Hotel Roma",
      "transport": ["火车", "步行"],
      "arrivalInfo": "【入境抵达】乘坐某航班从某地起飞，抵达某机场，前往酒店办理入住",
      "departureInfo": "",
      "transitNote": ""
    }
  ]
}`
          },
          {
            role: 'user',
            content: userMessage
          }
        ],
        temperature: 0.7,
        max_tokens: 4000
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      return res.status(502).json({ error: `智谱 API 错误 (${aiResponse.status}): ${errText}` });
    }

    const data = await aiResponse.json();
    if (!data.choices?.[0]) {
      return res.status(502).json({ error: '智谱 API 返回数据异常' });
    }

    let content = data.choices[0].message.content;
    content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const json = JSON.parse(content);
    return res.status(200).json(json);

  } catch (error) {
    if (error.name === 'AbortError') {
      return res.status(504).json({ error: 'AI 响应超时（40秒），请稍后重试' });
    }
    return res.status(500).json({ error: error.message });
  }
}
