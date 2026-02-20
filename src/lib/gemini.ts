import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function analyzeResearch(text: string, mode: 'scan' | 'understand' | 'think') {
  const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-pro",
    generationConfig: { responseMimeType: "application/json" }
  });

  // 모드별 시스템 프롬프트 설정 로직이 여기에 들어갑니다.
  const prompt = `연구 자료 분석 모드: ${mode}\n다음 텍스트를 분석해줘: ${text}`;
  
  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text());
}