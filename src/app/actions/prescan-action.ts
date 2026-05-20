// src/app/actions/prescan-action.ts
"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

export async function runBackgroundPreScan(base64Data: string, mimeType: string) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `이 논문을 아주 빠르게 스캔해서 반드시 유효한 JSON 형식으로만 응답해줘. 마크다운 기호 없이 순수 JSON만 출력해.
형식:
{
  "summary": "논문의 핵심 내용을 한 줄로 요약 (한국어, 30자 이내)",
  "keywords": ["키워드1", "키워드2", "키워드3", "키워드4", "키워드5"],
  "recommendMode": "scan 또는 understand 또는 think 중 하나를 소문자로 추천",
  "recommendReason": "추천 이유를 한 문장으로 설명",
  "complexity": "low 또는 medium 또는 high",
  "researchField": "연구 분야 (예: 교육학, 심리학, 공학 등)",
  "estimatedReadTime": 읽는데 걸리는 예상 분 (숫자만),
  "hasQuantitativeData": true 또는 false
}`;

    const result = await model.generateContent([
      { inlineData: { data: base64Data, mimeType } },
      { text: prompt },
    ]);

    const responseText = (await result.response).text();
    const cleanJson = responseText
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    return { success: true, data: JSON.parse(cleanJson) };
  } catch (err: any) {
    console.error("Pre-scan Error:", err.message);
    return { success: false };
  }
}