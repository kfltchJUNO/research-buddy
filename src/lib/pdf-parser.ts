import pdf from 'pdf-parse';

/**
 * PDF 버퍼에서 텍스트를 추출하는 함수입니다.
 * pdf-parse의 호출 방식 호환성 문제를 해결했습니다.
 */
export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    // 해결 포인트: pdf를 함수로 직접 호출할 수 있도록 (pdf as any) 처리를 하거나
    // 환경에 따라 pdf.default를 참조해야 할 수 있으므로 안전하게 호출합니다.
    const pdfParser = (pdf as any).default || pdf;
    
    const data = await pdfParser(buffer);
    
    // 분석 효율을 위해 너무 긴 텍스트는 앞부분 10,000자 정도만 먼저 사용 (초고속 스캔용)
    return data.text.substring(0, 10000);
  } catch (error) {
    console.error('PDF parsing error:', error);
    throw new Error('PDF 텍스트를 추출하는 데 실패했습니다.');
  }
}