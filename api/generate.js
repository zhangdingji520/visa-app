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

  // 1. 检查环境变量
  const apiKey = process.env.ZHIPU_API_KEY;
  if (!apiKey) {
    console.error('❌ ZHIPU_API_KEY 未设置');
    return res.status(500).json({ error: '服务器配置错误：ZHIPU_API_KEY 未设置，请在 Vercel 环境变量中添加' });
  }

  try {
    const body = req.body;

    // 2. 调用智谱 API
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
1. 每天景点2-4个，张弛有度，避免过度劳累
2. 城市顺序符合地理逻辑，大城市至少停留1-2天
3. 首日自动生成【入境抵达】信息，包含航班、机场、入住酒店
4. 最后一日自动生成【离境返程】信息
5. 城市间插入交通提示（火车/巴士，注明大概时间）
6. 返回严格的JSON格式，不要任何额外解释
7. 景点名称使用中文，同时提供英文名
8. 每天标注景点预估游览时间`
          },
          {
            role: 'user',
            content: `请根据以下信息生成行程单：
- 国家：${body.country}
- 出发日期：${body.startDate}
- 返回日期：${body.endDate}
- 去程航班：${body.outFlight}
- 回程航班：${body.returnFlight}
- 出发机场：${body.departureAirport}
- 抵达机场：${body.arrivalAirport}
- 酒店：${body.hotels}
- 交通偏好：${body.transportPref}
- 额外要求：${body.extraNotes || '无'}

只返回JSON，不要任何解释文字。JSON格式如下：
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
      })
    });

    // 3. 检查智谱 API 响应状态
    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('智谱 API 返回错误:', aiResponse.status, errorText);
      return res.status(502).json({ error: `智谱 API 返回错误 (${aiResponse.status}): ${errorText}` });
    }

    const data = await aiResponse.json();

    if (!data.choices || !data.choices[0]) {
      return res.status(502).json({ error: '智谱 API 返回数据异常：' + JSON.stringify(data) });
    }

    let content = data.choices[0].message.content;
    content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    let json;
    try {
      json = JSON.parse(content);
    } catch (parseError) {
      return res.status(502).json({ error: 'AI 返回的内容无法解析为 JSON：' + content });
    }

    return res.status(200).json(json);
  } catch (error) {
    console.error('函数执行异常:', error);
    return res.status(500).json({ error: '服务器内部错误: ' + error.message });
  }
}
