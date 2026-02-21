// src/services/gemini-service.ts
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "";
if (!apiKey) console.error("🔥 치명적 오류: Gemini API Key가 없습니다.");

const genAI = new GoogleGenerativeAI(apiKey);

function fileToGenerativePart(base64Data: string, mimeType: string) {
  return {
    inlineData: {
      data: base64Data,
      mimeType: mimeType || "application/pdf",
    },
  };
}

// 🎯 확실하게 작동하는 2.5 라인업으로만 구성
const OPTIMAL_MODELS = [
  "gemini-2.5-pro",
  "gemini-2.5-flash"
];

// 🚨 AI의 형태를 완벽하게 통제하는 절대 규칙
const STRICT_RULES = `
[절대 규칙: 반드시 지킬 것]
1. 마크다운 기호(*, **, # 등)를 절대 사용하지 마세요. 볼드체나 헤딩을 쓰지 마세요.
2. 단락을 구분할 때는 반드시 줄바꿈(\n) 두 번을 사용하세요.
3. 큰 섹션을 나눌 때는 반드시 '[구분선: -------------]'을 정확히 사용하세요.
4. 항목을 나열할 때는 1., 2., 3. 번호를 사용하세요.
5. Shon (2023), 김철수 등 논문의 저자명, 연구자 이름, 기관명, 고유명사는 절대 다른 언어로 번역하거나 임의로 변경하지 말고 원문 그대로 표기하세요.
`;

export async function analyzePDFDirect(base64Data: string, mode: 'scan' | 'understand' | 'think') {
  const prompts = {
    scan: `${STRICT_RULES}
이 PDF 논문을 스캔하여 다음 구조로만 작성해줘:

핵심 요약
(전체 내용을 3줄로 평문 작성)

[구분선: -------------]

주요 키워드
1. (키워드)
2. (키워드)

[구분선: -------------]

연구 목적
(연구 진행 배경을 1~2문장으로 평문 작성)`,

    understand: `${STRICT_RULES}
이 논문을 심층 분석하여 다음 구조로만 작성해줘:

연구 방법론
(어떤 연구 방법을 사용했는지 상세히 서술)

[구분선: -------------]

주요 가설 및 검증 결과
(가설과 도출 결과를 서술)

[구분선: -------------]

시각 자료(표/그래프) 핵심 해석
(중요한 데이터가 의미하는 바를 서술)

[구분선: -------------]

한국어 교육적 함의
(연구 결과의 교육적 시사점 서술)`,

    think: `${STRICT_RULES}
이 논문을 비판적으로 분석하여 다음 구조로만 작성해줘:

논리적 흐름 및 타당성 평가
(설계부터 결론까지 흐름의 타당성 평가)

[구분선: -------------]

연구의 한계점 및 논리적 허점
(데이터나 방법론의 취약점 지적)

[구분선: -------------]

향후 연구 방향 제안
1. (첫 번째 제안)
2. (두 번째 제안)`
  };

  let lastError: any;

  for (const modelName of OPTIMAL_MODELS) {
    try {
      console.log(`🚀 [${mode.toUpperCase()}] 분석 시도: ${modelName}`);
      const model = genAI.getGenerativeModel({ model: modelName });
      
      const result = await model.generateContent([
        fileToGenerativePart(base64Data, "application/pdf"),
        { text: prompts[mode] }
      ]);

      const response = await result.response;
      return { summary: response.text() };

    } catch (error: any) {
      console.warn(`⚠️ [실패] ${modelName} 오류. (사유: ${error.message})`);
      lastError = error;
    }
  }

  throw new Error(`AI 모델 응답 실패. (최종 에러: ${lastError?.message})`);
}

export async function analyzeMultiDirect(files: {base64: string, mimeType: string}[]) {
  let lastError: any;
  for (const modelName of OPTIMAL_MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const promptParts: any[] = files.map(f => fileToGenerativePart(f.base64, f.mimeType));
      promptParts.push({ 
        text: `${STRICT_RULES}\n제시된 여러 PDF 논문들의 공통점과 차이점을 분석해 구조화된 리포트를 평문으로 작성해.` 
      });

      const result = await model.generateContent(promptParts);
      return { summary: (await result.response).text() };
    } catch (error: any) {
      lastError = error;
    }
  }
  throw new Error(`다중 분석 실패. (에러: ${lastError?.message})`);
}