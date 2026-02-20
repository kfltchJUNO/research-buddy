import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

/**
 * [1단계: Scan] Gemini 1.5 Flash를 사용하여 3초 만에 핵심 파악
 */
export async function quickScan(text: string) {
  const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    generationConfig: { responseMimeType: "application/json" }
  });

  const prompt = `
    당신은 숙련된 연구 조교입니다. 제공된 연구 자료를 분석하여 핵심을 요약하세요.
    결과는 반드시 한국어로 작성하고, 아래 JSON 형식만 반환하세요.
    {
      "keywords": ["키워드1", "키워드2", "키워드3", "키워드4", "키워드5"],
      "oneLineSummary": "연구 내용을 관통하는 명확한 1줄 요약"
    }
    분석할 텍스트: ${text}
  `;

  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text());
}

/**
 * [2/3단계: Understand & Think] 단일 자료 심층 분석
 */
export async function analyzeWithGeminiPro(
  text: string, 
  mode: 'understand' | 'think',
  perspective?: 'critical' | 'easy' | 'counter' | 'alternative'
) {
  const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-pro",
    generationConfig: { responseMimeType: "application/json" }
  });
  
  const modeInstructions = {
    understand: "자료를 [서론, 방법, 결과, 결론] 구조로 상세히 요약하고 핵심 개념을 설명해줘.",
    think: "비판적 연구 분석가로서 숨겨진 전제를 의심하고 한계와 반대 사례를 도출해줘."
  };

  let perspectiveInstruction = "";
  if (perspective === 'critical') perspectiveInstruction = "\n[관점] 논리적 결함을 집중 파헤쳐줘.";
  else if (perspective === 'easy') perspectiveInstruction = "\n[관점] 중학생도 이해하게 쉬운 비유로 설명해줘.";

  const prompt = `
    ${modeInstructions[mode]} ${perspectiveInstruction}
    반드시 한국어로 응답하고 아래 JSON 형식을 지켜줘. 마크다운 사용 금지.
    {
      "summary": "분석 내용...",
      "trustLevel": "높음/중간/낮음",
      "citationRatio": 70, 
      "interpretationRatio": 30,
      "citations": [{ "page": 1, "text": "..." }],
      "visualData": {
        "type": "bar",
        "labels": ["항목1", "항목2"],
        "values": [10, 20],
        "title": "데이터 시각화 제목"
      }
    }
    텍스트: ${text}
  `;

  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text());
}

/**
 * [신규: Multi-Think] 다수 자료 비교 분석
 * 2단계 Map-Reduce 방식을 위해 각 파일의 핵심 요약본들을 입력으로 받습니다.
 */
export async function analyzeMulti(contents: {title: string, text: string}[]) {
  const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-pro",
    generationConfig: { responseMimeType: "application/json" }
  });

  const combinedText = contents.map(c => `[논문: ${c.title}]\n${c.text}`).join("\n\n---\n\n");

  const prompt = `
    당신은 여러 연구의 흐름을 꿰뚫어 보는 통합 분석가입니다. 
    제시된 여러 논문들의 공통점, 차이점, 그리고 주장 간의 충돌 지점을 분석하세요.
    
    반드시 한국어로 아래 JSON 형식을 반환하세요.
    {
      "mainConclusion": "모든 논문을 관통하는 최종 한 줄 결론",
      "comparisonTable": [
        { "criteria": "연구 방법", "findings": "A는 양적, B는 질적 연구 수행" }
      ],
      "conflictPoints": ["주주 간의 의견이 갈리는 지점 1", "2"],
      "visualData": {
        "type": "radar",
        "labels": ["혁신성", "타당성", "실용성", "대중성"],
        "datasets": [
           { "label": "논문A", "data": [80, 70, 90, 60] },
           { "label": "논문B", "data": [60, 90, 70, 80] }
        ]
      }
    }

    자료들:
    ${combinedText}
  `;

  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text());
}