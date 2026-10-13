export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { imageBase64, mimeType } = req.body;

        if (!imageBase64 || !mimeType) {
            return res.status(400).json({ error: '이미지 데이터가 필요합니다.' });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'Vercel 환경변수 GEMINI_API_KEY가 설정되지 않았습니다.' });
        }

        const prompt = `당신은 원신(Genshin Impact) 세계관의 마스터 분석가입니다. 플레이어블 캐릭터뿐만 아니라 페이몬, 다인슬레이프, 엔죠, 켄리아 오대 죄인(라인도티르, 수르트알로기 등), 우인단 집행관 전체, 룩카데바타, 스커크 등 모든 비플레이어블(NPC) 및 스토리 핵심 인물을 포함하여 원신에 등장하는 모든 인물 중에서 업로드된 얼굴 사진과 가장 분위기, 눈빛, 헤어스타일, 이목구비 느낌이 닮은 캐릭터를 1명 골라주세요.
        반드시 아래 JSON 형식으로만 응답해주세요. (마크다운 백틱 \`\`\`json ... \`\`\` 사용 금지, 순수 JSON 문자열만 출력)
        {
          "name": "캐릭터 이름",
          "matchRate": "95%",
          "reason": "닮은 이유와 두 사람의 분위기 공통점에 대한 재치있고 상세한 설명",
          "element": "원소 특성 또는 상징"
        }`;

        const model = 'gemini-3.8-flash';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        
        let response;
        let data;
        let attempts = 3;
        let delayMs = 2000;

        for (let i = 0; i < attempts; i++) {
            response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: prompt },
                            { inline_data: { mime_type: mimeType, data: imageBase64 } }
                        ]
                    }]
                })
            });

            data = await response.json();

            if (data.error && (data.error.message.includes('high demand') || data.error.code === 429)) {
                if (i < attempts - 1) {
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                    delayMs *= 2;
                    continue;
                }
            }
            break;
        }

        if (data.error) {
            return res.status(400).json({ error: `Google API 오류: ${data.error.message}` });
        }

        const textResponse = data.candidates[0].content.parts[0].text;
        const cleanJson = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        const result = JSON.parse(cleanJson);

        return res.status(200).json(result);

    } catch (error) {
        console.error('Server Error:', error);
        return res.status(500).json({ error: error.message || '서버 내부 처리 중 오류가 발생했습니다.' });
    }
}