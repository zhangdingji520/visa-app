// api/generate.js
export default async function handler(req, res) {
  // *** 处理 CORS 预检请求 ***
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  // *************************

  // 1. 只接受 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '只接受 POST 请求' });
  }

  // 2. 获取请求体
  const body = req.body;

  // 3. 检查环境变量
  const apiKey = process.env.ZHIPU_API_KEY;
  if (!apiKey) {
    console.error('❌ ZHIPU_API_KEY 环境变量未设置');
    return res.status(500).json({ error: '服务器配置错误：未设置 ZHIPU_API_KEY' });
  }

  try {
    const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
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

⚠️ 重要：只返回JSON，不要包含任何解释文字。JSON格式如下：
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

    const data = await response.json();

    if (!response.ok) {
      console.error('智谱 API 返回错误:', response.status, data);
      return res.status(response.status).json({ error: data.error?.message || '智谱 API 调用失败' });
    }

    if (!data.choices || !data.choices[0]) {
      throw new Error('智谱 API 返回异常：' + JSON.stringify(data));
    }

    let content = data.choices[0].message.content;
    content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const json = JSON.parse(content);
    
    return res.status(200).json(json);

  } catch (error) {
    console.error('生成失败：', error);
    return res.status(500).json({ error: error.message });
  }
}
