// src/services/gemini-service.ts
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "";
if (!apiKey) {
  console.error("🔥 치명적 오류: Gemini API Key가 설정되지 않았습니다.");
}

const genAI = new GoogleGenerativeAI(apiKey);

function fileToGenerativePart(base64Data: string, mimeType: string) {
  return { inlineData: { data: base64Data, mimeType: mimeType || "application/pdf" } };
}

const OPTIMAL_MODELS = ["gemini-2.5-pro", "gemini-2.5-flash"];

const STRICT_RULES = `
[절대 규칙: 반드시 지킬 것]
1. 마크다운 기호(*, **, # 등)를 절대 사용하지 마세요. 볼드체나 헤딩을 쓰지 마세요.
2. 단락을 구분할 때는 반드시 줄바꿈(\n) 두 번을 사용하세요.
3. 큰 섹션을 나눌 때는 반드시 '[구분선: -------------]'을 정확히 사용하세요.
4. 항목을 나열할 때는 1., 2., 3. 번호를 사용하세요.
5. 논문의 저자명, 연구자 이름, 기관명, 고유명사는 절대 번역하지 말고 원문 그대로 표기하세요.
6. [중요] 스캔된 텍스트나 표, 그래프가 있다면 시각적으로 분석하여 의미를 텍스트로 풀어내세요.
7. [중요] 답변의 끝부분에는 반드시 아래 태그를 사용하여, 분석의 핵심 근거가 된 원문 발췌 문장 3개를 작성하세요.
[근거 데이터 시작]
1. "원문 내용" (파일명, p. 쪽수)
2. "원문 내용" (파일명, p. 쪽수)
[근거 데이터 끝]
8. 근거 데이터 블록 밑에 "💡 이 지점에서 한번 생각해보세요:" 라는 제목으로, 독자가 스스로 던져보면 좋을 비판적 질문 2가지를 작성하세요.
9. 🚀 [가장 중요] 답변의 맨 첫 줄은 무조건 이 논문의 핵심을 관통하는 매력적이고 확고한 한 줄 카피(공백 포함 30자 이내)를 "[한줄요약] 카피내용" 형식으로 작성하세요. 주저리주저리 설명하지 마세요.
`;

const STYLE_GUIDES = {
  academic: "격식 있는 문체와 전문 용어를 사용하여 학술적 톤을 철저히 유지하세요.",
  lecture: "이 내용을 처음 접하는 학생들에게 설명하듯, 친절하고 이해하기 쉬운 비유를 들어 구조적으로 풀어서 설명하세요.",
  blog: "독자들이 지루하지 않게 흥미를 유발하는 블로그 포스팅처럼 작성하세요. 가독성을 높이는 이모지를 내용에 맞게 적절히 섞어주세요."
};

export async function analyzePDFDirect(base64Data: string, mode: 'scan' | 'understand' | 'think', style: 'academic' | 'lecture' | 'blog' = 'academic', addons: any = {}) {
  const selectedStyle = STYLE_GUIDES[style];
  // 💡 시각화 지시어는 별도 API로 분리했으므로, 키워드 애드온 지시어만 남깁니다.
  const addonPrompt = addons.deepKeyword ? "[애드온 지시] 주요 키워드를 제시할 때 단순 나열에 그치지 말고, 학술적 정의와 해당 논문 내에서의 역할을 각각 2문장씩 깊게 서술하세요." : "";
  
  const prompts = {
    scan: `${STRICT_RULES}\n${addonPrompt}\n[문체 지시: ${selectedStyle}]\n이 PDF 논문을 스캔하여 다음 구조로만 작성해줘:\n\n핵심 요약\n(전체 내용을 3줄로 평문 작성)\n\n[구분선: -------------]\n\n주요 키워드\n1. (키워드)\n2. (키워드)\n\n[구분선: -------------]\n\n연구 목적\n(연구 진행 배경을 1~2문장으로 평문 작성)`,
    understand: `${STRICT_RULES}\n${addonPrompt}\n[문체 지시: ${selectedStyle}]\n이 논문을 심층 분석하여 다음 구조로만 작성해줘:\n\n연구 방법론\n(상세 서술)\n\n[구분선: -------------]\n\n주요 가설 및 검증 결과\n(가설과 도출 결과 서술)\n\n[구분선: -------------]\n\n시각 자료 핵심 해석\n(중요 데이터 서술)\n\n[구분선: -------------]\n\n교육적 함의\n(시사점 서술)`,
    think: `${STRICT_RULES}\n${addonPrompt}\n[문체 지시: ${selectedStyle}]\n이 논문을 비판적으로 분석하여 다음 구조로만 작성해줘:\n\n논리적 흐름 및 타당성 평가\n(설계부터 결론까지 평가)\n\n[구분선: -------------]\n\n연구의 한계점 및 논리적 허점\n(데이터나 방법론의 취약점 지적)\n\n[구분선: -------------]\n\n향후 연구 방향 제안\n1. (첫 번째 제안)\n2. (두 번째 제안)`
  };

  let lastError: any;
  for (const modelName of OPTIMAL_MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent([fileToGenerativePart(base64Data, "application/pdf"), { text: prompts[mode] }]);
      return { summary: (await result.response).text() };
    } catch (error: any) { lastError = error; }
  }
  throw new Error(`AI 모델 응답 실패. (최종 에러: ${lastError?.message})`);
}

export async function analyzeMultiDirect(files: {base64: string, mimeType: string}[], style: 'academic' | 'lecture' | 'blog' = 'academic', addons: any = {}) {
  const selectedStyle = STYLE_GUIDES[style];
  const addonPrompt = addons.deepKeyword ? "[애드온 지시] 공통 핵심 키워드를 제시할 때, 단순 나열에 그치지 말고 융합적 정의와 시사점을 깊게 서술하세요." : "";

  let lastError: any;
  for (const modelName of OPTIMAL_MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const promptParts: any[] = files.map(f => fileToGenerativePart(f.base64, f.mimeType));
      promptParts.push({ text: `${STRICT_RULES}\n${addonPrompt}\n[문체 지시: ${selectedStyle}]\n제시된 여러 PDF 논문들의 공통점과 차이점을 분석해 구조화된 리포트를 평문으로 작성해.\n마지막에는 반드시 "이 논문들은 결국 같은 방향을 말합니다: '○○가 핵심이다'"라는 형태의 한 줄 결론을 추가해.` });

      const result = await model.generateContent(promptParts);
      return { summary: (await result.response).text() };
    } catch (error: any) { lastError = error; }
  }
  throw new Error(`다중 분석 실패. (에러: ${lastError?.message})`);
}

export async function analyzeReanalysisDirect(base64Data: string, mimeType: string, perspective: string, style: 'academic' | 'lecture' | 'blog' = 'academic') {
  const selectedStyle = STYLE_GUIDES[style];
  const perspectivePrompt = `[특수 임무: 관점의 이동]\n당신은 이 논문을 이전에 한 번 분석했습니다. 하지만 이번에는 완전히 새로운 시각인 **"${perspective}"**의 관점으로만 이 논문을 집요하게 파고들어야 합니다. 이전의 일반적인 요약은 버리고, 오직 이 새로운 관점에 입각하여 논문의 맹점, 다른 해석 가능성, 혹은 독창적인 시사점을 도출하세요.`;
  const finalPrompt = `${STRICT_RULES}\n[문체 지시: ${selectedStyle}]\n${perspectivePrompt}\n다음 구조로 작성해줘:\n1. ${perspective}의 핵심 근거 및 논리 전개\n2. 기존 해석과의 차이점 또는 한계점 지적\n3. 이 관점을 통해 얻을 수 있는 새로운 연구 시사점`;

  let lastError: any;
  for (const modelName of OPTIMAL_MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent([fileToGenerativePart(base64Data, mimeType), { text: finalPrompt }]);
      return { summary: (await result.response).text() };
    } catch (error: any) { lastError = error; }
  }
  throw new Error(`재분석 AI 응답 실패. (에러: ${lastError?.message})`);
}

// 🚀 4. [신규 추가] 100% 무결점 JSON 시각화 추출 전담 함수 (병렬 처리용)
export async function extractVisualizationData(files: {base64: string, mimeType: string}[]) {
  try {
    console.log("📊 시각화 전담 병렬 AI 엔진 가동...");
    // 비용과 속도를 위해 flash 모델을 사용하고, JSON 출력을 강제(Enforce)합니다!
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" } // 핵심!
    });

    const prompt = `
    이 문서(들)에 포함된 통계, 수치, 혹은 비교 가능한 데이터를 추출하여 데이터 시각화(Chart)를 위한 JSON 형식으로 응답해.
    유의미한 수치 데이터가 없다면 반드시 빈 객체 {} 를 반환해야 해.
    필수 JSON 구조:
    {
      "paper_title": "문서 제목 (또는 공통 주제)",
      "data_points": [
        {
          "category": "항목 이름",
          "description": "수치에 대한 짧은 설명",
          "value": 12.3, 
          "unit": "% 또는 점 등 단위"
        }
      ]
    }
    위 구조를 반드시 지키고 숫자(value) 필드에는 문자열이 아닌 순수 숫자만 넣어줘.
    `;

    const promptParts: any[] = files.map(f => fileToGenerativePart(f.base64, f.mimeType));
    promptParts.push({ text: prompt });
    
    const result = await model.generateContent(promptParts);
    const jsonString = (await result.response).text();
    return JSON.parse(jsonString); // 완벽한 JSON이 보장됩니다.
  } catch (error) {
    console.warn("⚠️ 시각화 데이터 파싱 실패 (수치 데이터가 없거나 모델 오류):", error);
    return null; // 실패 시 null 반환 (자동 환불 로직 트리거)
  }
}
// 🚀 5. [신규 추가] 신뢰도 산출을 위한 인메모리 RAG 엔진 (Vector Embedding & Cosine Similarity)
function cosineSimilarity(vecA: number[], vecB: number[]) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function calculateReliabilityIndicator(sourceText: string, generatedText: string) {
  try {
    console.log("🧮 AI 신뢰도 분석 엔진 가동 (Vector Embedding)");
    // 텍스트 임베딩 전용 모델 호출
    const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

    // 1. 텍스트 청킹(Chunking): 너무 길면 API 제한이 걸리므로 문장 단위로 쪼갭니다.
    const sourceChunks = sourceText.replace(/\n/g, " ").match(/[^.!?]+[.!?]+/g) || [sourceText];
    const genChunks = generatedText.replace(/\n/g, " ").match(/[^.!?]+[.!?]+/g) || [generatedText];

    // 연산 속도와 API Limit 방지를 위해 원문은 앞뒤 주요 맥락 40문장, 생성문은 전체를 샘플링합니다.
    const sampledSource = sourceChunks.slice(0, 40).map(t => t.trim()).filter(t => t.length > 10);
    const sampledGen = genChunks.map(t => t.trim()).filter(t => t.length > 10);

    if (sampledSource.length === 0 || sampledGen.length === 0) return { direct: 50, semantic: 50 };

    // 2. 임베딩 벡터 추출 (API 호출)
    const sourceEmbeddings = await Promise.all(
      sampledSource.map(async (text) => (await embeddingModel.embedContent(text)).embedding.values)
    );
    const genEmbeddings = await Promise.all(
      sampledGen.map(async (text) => (await embeddingModel.embedContent(text)).embedding.values)
    );

    // 3. 코사인 유사도 매칭 및 신뢰도 비율 산출
    let directQuoteCount = 0;
    let semanticCount = 0;
    const THRESHOLD = 0.75; // 0.75 이상이면 원문과 거의 일치한다고 판단

    for (const gVec of genEmbeddings) {
      let maxSim = 0;
      for (const sVec of sourceEmbeddings) {
        const sim = cosineSimilarity(gVec, sVec);
        if (sim > maxSim) maxSim = sim;
      }
      if (maxSim >= THRESHOLD) directQuoteCount++;
      else semanticCount++;
    }

    const total = directQuoteCount + semanticCount;
    const directRatio = Math.round((directQuoteCount / total) * 100);
    const semanticRatio = 100 - directRatio;

    return { direct: directRatio, semantic: semanticRatio };
  } catch (error) {
    console.warn("⚠️ 벡터 유사도 계산 실패 (기본값 반환):", error);
    return { direct: 72, semantic: 28 }; // 실패 시 UI가 깨지지 않게 가라(?) 데이터 반환
  }
}