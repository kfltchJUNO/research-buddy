// /src/app/library/page.tsx
import CountdownTimer from "@/components/library/CountdownTimer";

export default function KnowledgeLibrary() {
  // 실제로는 Firestore에서 데이터를 fetch해오는 로직이 들어갑니다.
  const mockData = [
    { id: '1', title: 'Generative AI in Education.pdf', createdAt: '2026-02-20', deleteAt: new Date(Date.now() + 1800000) }
  ];

  return (
    <div className="max-w-5xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">내 지식 라이브러리 🖋️</h1>
      
      <div className="grid gap-4">
        {mockData.map((item) => (
          <div key={item.id} className="p-6 bg-white border rounded-2xl flex justify-between items-center hover:shadow-md transition-shadow">
            <div>
              <h3 className="font-bold text-lg mb-1">{item.title}</h3>
              <p className="text-sm text-gray-400">분석일시: {item.createdAt}</p>
            </div>
            <CountdownTimer targetDate={item.deleteAt} />
          </div>
        ))}
      </div>
    </div>
  );
}