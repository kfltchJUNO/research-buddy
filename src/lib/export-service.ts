import jsPDF from "jspdf";
import html2canvas from "html2canvas";

/**
 * 특정 HTML 요소를 PDF로 변환하여 다운로드합니다.
 * @param elementId PDF로 만들 영역의 ID (예: 'report-content')
 * @param fileName 저장될 파일 이름
 */
export const exportToPDF = async (elementId: string, fileName: string) => {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error("PDF로 변환할 요소를 찾을 수 없습니다.");
    return;
  }

  try {
    // 1. HTML 영역을 캔버스로 변환 (고해상도를 위해 scale 조절)
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true, // 외부 이미지 로드 허용
      logging: false,
    });

    const imgData = canvas.toDataURL("image/png");

    // 2. PDF 생성 (A4 사이즈 기준)
    const pdf = new jsPDF("p", "mm", "a4");
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

    // 3. 이미지를 PDF에 삽입 및 저장
    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    pdf.save(`${fileName}.pdf`);
  } catch (error) {
    console.error("PDF 생성 중 오류 발생:", error);
    alert("PDF를 생성하는 데 실패했습니다.");
  }
};