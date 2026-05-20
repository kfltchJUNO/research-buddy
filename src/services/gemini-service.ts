// src/services/gemini-service.ts
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "";
if (!apiKey) console.error("🔥 치명적 오류: Gemini API Key 없음");

const genAI = new GoogleGenerativeAI(apiKey);

function fileToGenerativePart(base64Data: string, mimeType: string) {
  return { inlineData: { data: base64Data, mimeType: mimeType || "application/pdf" } };
}

const OPTIMAL_MODELS = ["gemini-2.5-pro", "gemini-2.5-flash"];

const STRICT_RULES = `
[절대 규칙]
1. 마크다운 기호(*, **, # 등) 사용 금지. 볼드체·헤딩 금지.
2. 단락 구분은 줄바꿈 두 번.
3. 큰 섹션 구분은 반드시 '[구분선: -------------]' 사용.
4. 항목 나열은 1., 2., 3. 번호.
5. 저자명·기관명·고유명사는 원문 그대로.
6. 표·그래프가 있으면 시각적으로 분석하여 텍스트로 풀어내기.
7. 답변 끝에 반드시:
[근거 데이터 시작]
1. "원문 내용" (파일명, p. 쪽수)
2. "원문 내용" (파일명, p. 쪽수)
[근거 데이터 끝]
8. 근거 데이터 아래에 "💡 이 지점에서 한번 생각해보세요:" 제목으로 비판적 질문 2가지.
9. 답변 첫 줄은 무조건 "[한줄요약] 30자 이내 핵심 카피" 형식.
`;

const STYLE_GUIDES = {
  academic: "격식 있는 문체와 전문 용어를 사용하여 학술적 톤을 철저히 유지하세요.",
  lecture:  "처음 접하는 학생에게 설명하듯 친절하고 비유를 들어 구조적으로 풀어 설명하세요.",
  blog:     "독자가 지루하지 않게 흥미를 유발하는 블로그처럼 작성하세요. 이모지를 적절히 섞어주세요.",
};

// ─── 메인 분석 ────────────────────────────────────────────────────
export async function analyzePDFDirect(
  base64Data: string,
  mode: "scan" | "understand" | "think",
  style: "academic" | "lecture" | "blog" = "academic",
  addons: any = {},
  kciContext?: string
) {
  const selectedStyle = STYLE_GUIDES[style];
  const addonPrompt = addons.deepKeyword
    ? "[애드온] 주요 키워드는 학술적 정의와 논문 내 역할을 각 2문장씩 깊게 서술하세요."
    : "";
  const kciPrompt = kciContext
    ? `\n[KCI 공식 데이터 참고: ${kciContext}]\n이 정보를 신뢰도 판단 근거로 활용하세요.`
    : "";

  const prompts = {
    scan: `${STRICT_RULES}\n${addonPrompt}${kciPrompt}\n[문체: ${selectedStyle}]\n이 PDF 논문을 스캔하여 다음 구조로만 작성:\n\n핵심 요약\n(3줄 평문)\n\n[구분선: -------------]\n\n주요 키워드\n1.\n2.\n\n[구분선: -------------]\n\n연구 목적\n(1~2문장)`,
    understand: `${STRICT_RULES}\n${addonPrompt}${kciPrompt}\n[문체: ${selectedStyle}]\n이 논문을 심층 분석하여 다음 구조로만 작성:\n\n연구 방법론\n\n[구분선: -------------]\n\n주요 가설 및 검증 결과\n\n[구분선: -------------]\n\n시각 자료 핵심 해석\n\n[구분선: -------------]\n\n교육적 함의`,
    think: `${STRICT_RULES}\n${addonPrompt}${kciPrompt}\n[문체: ${selectedStyle}]\n이 논문을 비판적으로 분석하여 다음 구조로만 작성:\n\n논리적 흐름 및 타당성 평가\n\n[구분선: -------------]\n\n연구의 한계점 및 논리적 허점\n\n[구분선: -------------]\n\n향후 연구 방향 제안\n1.\n2.`,
  };

  let lastError: any;
  for (const modelName of OPTIMAL_MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent([
        fileToGenerativePart(base64Data, "application/pdf"),
        { text: prompts[mode] },
      ]);
      return { summary: (await result.response).text() };
    } catch (err: any) { lastError = err; }
  }
  throw new Error(`AI 응답 실패: ${lastError?.message}`);
}

// ─── 다중 파일 분석 ───────────────────────────────────────────────
export async function analyzeMultiDirect(
  files: { base64: string; mimeType: string }[],
  style: "academic" | "lecture" | "blog" = "academic",
  addons: any = {}
) {
  const selectedStyle = STYLE_GUIDES[style];
  const addonPrompt = addons.deepKeyword
    ? "[애드온] 공통 핵심 키워드는 융합적 정의와 시사점을 깊게 서술하세요."
    : "";
  let lastError: any;
  for (const modelName of OPTIMAL_MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const parts: any[] = files.map((f) => fileToGenerativePart(f.base64, f.mimeType));
      parts.push({
        text: `${STRICT_RULES}\n${addonPrompt}\n[문체: ${selectedStyle}]\n제시된 PDF들의 공통점·차이점을 분석해 구조화된 리포트를 작성해. 마지막에 "이 논문들은 결국: '○○가 핵심이다'"라는 한 줄 결론 추가.`,
      });
      const result = await model.generateContent(parts);
      return { summary: (await result.response).text() };
    } catch (err: any) { lastError = err; }
  }
  throw new Error(`다중 분석 실패: ${lastError?.message}`);
}

// ─── 관점 재분석 ──────────────────────────────────────────────────
export async function analyzeReanalysisDirect(
  base64Data: string,
  mimeType: string,
  perspective: string,
  style: "academic" | "lecture" | "blog" = "academic"
) {
  const selectedStyle = STYLE_GUIDES[style];
  const prompt = `${STRICT_RULES}\n[문체: ${selectedStyle}]\n[특수 임무: 관점의 이동]\n당신은 이 논문을 이전에 분석했습니다. 이번에는 완전히 새로운 시각인 "${perspective}"의 관점으로만 집요하게 파고드세요. 이전 일반 요약은 버리고, 이 관점에서 논문의 맹점·다른 해석 가능성·독창적 시사점을 도출하세요.\n\n1. ${perspective}의 핵심 근거 및 논리 전개\n2. 기존 해석과의 차이점 또는 한계 지적\n3. 이 관점을 통해 얻을 수 있는 새로운 연구 시사점`;

  let lastError: any;
  for (const modelName of OPTIMAL_MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent([
        fileToGenerativePart(base64Data, mimeType),
        { text: prompt },
      ]);
      return { summary: (await result.response).text() };
    } catch (err: any) { lastError = err; }
  }
  throw new Error(`재분석 실패: ${lastError?.message}`);
}

// ─── 시각화 데이터 추출 ───────────────────────────────────────────
export async function extractVisualizationData(files: { base64: string; mimeType: string }[]) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const parts: any[] = files.map((f) => fileToGenerativePart(f.base64, f.mimeType));
    parts.push({
      text: `이 논문에서 수치 데이터를 추출해 순수 JSON으로만 응답:\n{"chart_title":"","data_points":[{"category":"","value":0,"unit":"","description":""}]}\n데이터 없으면: {"data_points":[]}`,
    });
    const result = await model.generateContent(parts);
    const text = (await result.response).text();
    return JSON.parse(text.replace(/```json/g, "").replace(/```/g, "").trim());
  } catch { return { data_points: [] }; }
}

// ─── RAG 신뢰도 계산 ──────────────────────────────────────────────
export async function calculateReliabilityIndicator(
  sourceText: string,
  analysisText: string
): Promise<{ direct: number; semantic: number }> {
  if (!sourceText || !analysisText) return { direct: 65, semantic: 35 };
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(
      `다음 원문과 분석을 비교해 직접인용 비율(direct)과 의미해석 비율(semantic)을 합계 100으로 JSON만 응답:\n원문: ${sourceText.slice(0, 500)}\n분석: ${analysisText.slice(0, 500)}\n형식: {"direct":숫자,"semantic":숫자}`
    );
    const text = (await result.response).text();
    return JSON.parse(text.replace(/```json/g, "").replace(/```/g, "").trim());
  } catch { return { direct: 65, semantic: 35 }; }
}

// ─── ✅ 논문 채팅 (신규) ──────────────────────────────────────────
// 분석 결과 + PDF base64 + 대화 히스토리를 받아 후속 질문에 답변
export async function chatWithPaper(
  base64Data: string | null,        // PDF 원본 (1시간 내) 또는 null (삭제 후)
  analysisContext: string,           // 기존 분석 결과 텍스트
  chatHistory: { role: "user" | "assistant"; content: string }[],
  userQuestion: string,
  style: "academic" | "lecture" | "blog" = "academic"
): Promise<string> {
  const selectedStyle = STYLE_GUIDES[style];

  // 대화 히스토리를 텍스트로 직렬화
  const historyText = chatHistory
    .slice(-6) // 최근 6턴만 컨텍스트에 포함 (토큰 절약)
    .map((h) => `${h.role === "user" ? "연구자" : "AI"}: ${h.content}`)
    .join("\n");

  const systemPrompt = `당신은 논문 분석 전문 AI 어시스턴트입니다.
[문체: ${selectedStyle}]
[절대 규칙]
- 마크다운 기호(*, **, #) 금지. 줄바꿈으로 단락 구분.
- 저자명·기관명은 원문 그대로.
- 답변은 논문 내용에 근거하여 정확하게.
- 추측이 필요하면 "논문에서 명시되지 않았으나..." 라고 전제.
- 답변 끝에 관련 후속 질문 1개를 "💬 이어서 물어볼 수 있어요: ..." 형식으로 제안.

[이전 분석 결과 요약]
${analysisContext.slice(0, 2000)}

[이전 대화]
${historyText}`;

  let lastError: any;
  for (const modelName of OPTIMAL_MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const parts: any[] = [];

      // PDF가 아직 삭제되지 않았으면 함께 전송 (더 정확한 답변)
      if (base64Data) {
        parts.push(fileToGenerativePart(base64Data, "application/pdf"));
      }
      parts.push({ text: `${systemPrompt}\n\n연구자의 질문: ${userQuestion}` });

      const result = await model.generateContent(parts);
      return (await result.response).text();
    } catch (err: any) { lastError = err; }
  }
  throw new Error(`채팅 응답 실패: ${lastError?.message}`);
}

// ─── ✅ 스타일 재렌더링 (신규) ────────────────────────────────────
// 기존 분석 결과를 다른 스타일로 재작성 (INK 소모 없음)
export async function restyleAnalysis(
  analysisText: string,
  newStyle: "academic" | "lecture" | "blog"
): Promise<string> {
  const selectedStyle = STYLE_GUIDES[newStyle];
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(
      `다음 논문 분석 결과를 [${selectedStyle}] 스타일로 재작성해줘.\n원본 구조([한줄요약], [구분선], [근거 데이터])는 그대로 유지하되, 문체와 표현 방식만 바꿔줘.\n마크다운 기호 절대 사용 금지.\n\n원본:\n${analysisText}`
    );
    return (await result.response).text();
  } catch (err: any) {
    throw new Error(`스타일 변환 실패: ${err.message}`);
  }
}