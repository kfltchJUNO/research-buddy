"use client";

export default function ReportView({ content }: { content: string }) {
  if (!content) return null;

  return (
    <div className="reading-section space-y-8 animate-in fade-in duration-700">
      {/* 텍스트 내의 특정 패턴을 찾아 자동으로 스타일링 */}
      {content.split('\n\n').map((paragraph, idx) => (
        <p key={idx} className="text-gray-800 leading-relaxed first-letter:text-3xl first-letter:font-black first-letter:mr-2 first-letter:text-violet-600 first-letter:float-left">
          {paragraph}
        </p>
      ))}
      
      <style jsx>{`
        p {
          margin-bottom: 1.8rem;
          word-break: keep-all; /* 한글 줄바꿈을 단어 단위로 */
          font-size: 1.05rem;
        }
      `}</style>
    </div>
  );
}