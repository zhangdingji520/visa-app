// api/generate.js
export default async function handler(req, res) {
  // CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '只接受 POST 请求' });
  }

  const apiKey = process.env.ZHIPU_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ZHIPU_API_KEY 未设置' });
  }

  try {
    const body = req.body;

    // 调用智谱 API，设置 25 秒超时
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

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
            content: `你是一个签证行程单生成专家。请根据用户提供的航班、国家、酒店等信息，生成一个逻辑严密的每日行程单。
要求：
1. 每天景点2-4个，张弛有度
2. 城市顺序符合地理逻辑
3. 首日生成【入境抵达】，最后一日生成【离境返程】
4. 城市间插入交通提示
5. 返回纯JSON，不要解释
6. 景点中英文名及预估时间`
          },
          {
            role: 'user',
            content: `请生成以下行程：
- 国家：${body.country}
- 日期：${body.startDate} 至 ${body.endDate}
- 去程航班：${body.outFlight}，出发机场：${body.departureAirport}
- 回程航班：${body.returnFlight}，抵达机场：${body.arrivalAirport}
- 酒店：${body.hotels}
- 交通偏好：${body.transportPref}
- 额外要求：${body.extraNotes || '无'}

返回格式：
{
  "days": [
    {
      "day": 1,
      "date": "2026/04/24",
      "city": "罗马",
      "attractions": [{"name":"斗兽场","nameEn":"Colosseum","time":"2h"}],
      "hotel": "Hotel Roma",
      "transport": ["火车","步行"],
      "arrivalInfo": "【入境抵达】...",
      "departureInfo": "",
      "transitNote": ""
    }
  ]
}`
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
      return res.status(504).json({ error: 'AI 响应超时（25秒），请稍后重试' });
    }
    return res.status(500).json({ error: '服务器错误: ' + error.message });
  }
}
