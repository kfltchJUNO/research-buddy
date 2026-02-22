// src/app/actions/prescan-action.ts
"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

export async function runBackgroundPreScan(base64Data: string, mimeType: string) {
  try {
    // 가장 빠르고 저렴한 flash 모델 사용
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    const prompt = `
이 논문을 아주 빠르게 스캔해서 반드시 유효한 JSON 형식으로만 응답해줘. 마크다운 기호 없이 순수 JSON만 출력해.
형식:
{
  "summary": "논문의 핵심 내용을 한 줄로 요약 (한국어)",
  "keywords": ["키워드1", "키워드2", "키워드3", "키워드4", "키워드5"],
  "recommendMode": "understand 또는 think 중 하나를 소문자로 추천"
}`;

    const result = await model.generateContent([
      { inlineData: { data: base64Data, mimeType } },
      { text: prompt }
    ]);

    const responseText = (await result.response).text();
    // AI가 마크다운(```json)을 붙여서 응답할 경우를 대비한 파싱 방어 로직
    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    return { success: true, data: JSON.parse(cleanJson) };
  } catch (err: any) {
    console.error("Pre-scan Error:", err.message);
    return { success: false };
  }
}