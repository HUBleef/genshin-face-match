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
            return res.status(500).json({ error: 'Vercel 서버에 GEMINI_API_KEY가 설정되지 않았습니다. Vercel Settings > Environment Variables를 확인해 주세요.' });
        }

        const prompt = `당신은 원신(Genshin Impact) 세계관의 마스터 분석가입니다. 플레이어블 캐릭터뿐만 아니라 페이몬, 다인슬레이프, 엔죠, 켄리아 오대 죄인(라인도티르, 수르트알로기 등), 우인단 집행관 전체, 룩카데바타, 스커크 등 모든 비플레이어블(NPC) 및 스토리 핵심 인물을 포함하여 원신에 등장하는 모든 인물 중에서 업로드된 얼굴 사진과 가장 분위기, 눈빛, 헤어스타일, 이목구비 느낌이 닮은 캐릭터를 1명 골라주세요.
반드시 아래 JSON 형식으로만 응답해주세요. (마크다운 백틱 \`\`\`json ... \`\`\` 사용 금지, 순수 JSON 문자열만 출력)
{
  "name": "캐릭터 이름 (예: 종려, 페이몬, 엔죠, 도토레 등)",
  "matchRate": "95%",
  "reason": "닮은 이유와 두 사람의 분위기 공통점에 대한 재치있고 상세한 설명",
  "element": "원소 특성 또는 상징 (예: 바위, 바람, 번개, 풀, 물, 얼음, 불, 심연, 무원소 등)"
}`;

        // 최신 gemini-3.8-flash 모델 직접 호출
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: prompt },
                        {
                            inline_data: {
                                mime_type: mimeType,
                                data: imageBase64
                            }
                        }
                    ]
                }]
            })
        });

        const data = await response.json();

        if (data.error) {
            return res.status(400).json({ error: `Gemini API 에러: ${data.error.message}` });
        }

        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            return res.status(500).json({ error: 'Gemini AI로부터 응답을 제대로 받지 못했습니다.' });
        }

        const textResponse = data.candidates[0].content.parts[0].text;
        const cleanJson = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        const result = JSON.parse(cleanJson);

        return res.status(200).json(result);

    } catch (error) {
        console.error('Match API Error:', error);
        return res.status(500).json({ error: error.message || '서버 분석 중 알 수 없는 오류가 발생했습니다.' });
    }
}