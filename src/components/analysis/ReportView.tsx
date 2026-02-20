export default function ReportView({ content }: { content: string }) {
  return (
    <div className="reading-section space-y-8">
      {/* 텍스트 내의 특정 패턴을 찾아 자동으로 스타일링 */}
      {content.split('\n\n').map((paragraph, idx) => (
        <p key={idx} className="first-letter:text-2xl first-letter:font-black first-letter:mr-1 first-letter:text-blue-600">
          {paragraph}
        </p>
      ))}
      
      <style jsx>{`
        p {
          margin-bottom: 1.5rem;
          word-break: keep-all; /* 한글 줄바꿈을 단어 단위로 */
        }
      `}</style>
    </div>
  );
}