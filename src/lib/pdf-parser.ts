import pdf from 'pdf-parse';

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    const data = await pdf(buffer);
    // 분석 효율을 위해 너무 긴 텍스트는 앞부분 10,000자 정도만 먼저 사용 (초고속 스캔용)
    return data.text.substring(0, 10000);
  } catch (error) {
    console.error('PDF parsing error:', error);
    throw new Error('PDF 텍스트를 추출하는 데 실패했습니다.');
  }
}