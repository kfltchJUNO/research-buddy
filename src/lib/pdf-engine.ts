// src/lib/pdf-engine.ts

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    // ✅ Next.js ESM 환경에서 CJS 라이브러리의 충돌을 피하기 위한 동적 호출
    const pdf = require('pdf-parse');
    
    // pdf-parse 구조에 따라 함수 위치를 정확히 탐색
    const parse = typeof pdf === 'function' ? pdf : (pdf.default || pdf);

    if (typeof parse !== 'function') {
      throw new Error("PDF 엔진 함수를 로드할 수 없습니다.");
    }

    const data = await parse(buffer);
    
    if (!data || !data.text) {
      throw new Error("텍스트 추출 실패");
    }

    return data.text.replace(/\n\s*\n/g, '\n\n').trim();
  } catch (error: any) {
    console.error("❌ PDF Engine Critical Error:", error.message);
    throw new Error(`분석 엔진 초기화 실패: ${error.message}`);
  }
}