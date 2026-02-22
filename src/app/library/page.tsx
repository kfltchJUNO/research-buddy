"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, onSnapshot, doc, orderBy } from "firebase/firestore";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { 
  Folder, FolderOpen, Search, Hash, Trash2, Plus, 
  BrainCircuit, FileText, X, ArrowRight, Loader2, Star
} from "lucide-react";
import Link from "next/link";

// 서버 액션 불러오기
import { 
  deleteDocumentAction, updateDocFolderAction, 
  updateDocTagsAction, createUserFolderAction 
} from "@/app/actions/library-actions";

// 🚀 [빌드 에러 해결] 카드 컴포넌트의 타입 정의 (즐겨찾기 토글 추가)
interface LibraryCardProps {
  item: any;
  onFavoriteToggle?: () => Promise<void> | void;
}

export default function LibraryPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // 필터 및 검색 상태
  const [activeFolder, setActiveFolder] = useState<string>("전체");
  const [searchQuery, setSearchQuery] = useState("");
  
  // UI 상태
  const [newFolderName, setNewFolderName] = useState("");
  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [tagInputs, setTagInputs] = useState<{[key: string]: string}>({});
  const [draggedDocId, setDraggedDocId] = useState<string | null>(null);

  // 1️⃣ 초기 데이터 로드 (실시간 동기화)
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.replace("/login");
        return;
      }
      setUser(currentUser);

      // 유저의 커스텀 폴더 목록 가져오기
      const unsubscribeUser = onSnapshot(doc(db, "users", currentUser.uid), (docSnap) => {
        if (docSnap.exists() && docSnap.data().customFolders) {
          setFolders(docSnap.data().customFolders);
        }
      });

      // 모든 연구 기록 가져오기
      const q = query(
        collection(db, "knowledge_library"), 
        where("userId", "==", currentUser.uid), 
        orderBy("createdAt", "desc")
      );
      const unsubscribeDocs = onSnapshot(q, (snapshot) => {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setDocuments(docs);
        setLoading(false);
      });

      return () => { unsubscribeUser(); unsubscribeDocs(); };
    });
    return () => unsubscribeAuth();
  }, [router]);

  // 2️⃣ 한글 날짜 포맷 함수
  const formatKoreanDate = (dateObj: any) => {
    if (!dateObj) return "방금 전";
    let d = dateObj.toDate ? dateObj.toDate() : new Date(dateObj.seconds * 1000 || dateObj);
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
  };

  // 3️⃣ 한줄요약 파싱 (카드 가독성 최적화)
  const getShortSummary = (text: string) => {
    if (!text) return "분석된 내용이 아직 없습니다.";
    const match = text.match(/\[한줄요약\]\s*(.+)/);
    return match ? match[1].trim() : text.split('\n')[0].substring(0, 50) + "...";
  };

  // 4️⃣ 액션: 새 폴더 추가 (한글)
  const handleAddFolder = async () => {
    if (!newFolderName.trim()) return;
    if (folders.includes(newFolderName.trim())) return toast.error("이미 있는 폴더 이름입니다.");
    
    await createUserFolderAction(user.uid, newFolderName.trim());
    setNewFolderName("");
    setIsAddingFolder(false);
    toast.success("새 연구 폴더가 생성되었습니다.");
  };

  // 5️⃣ 액션: 드래그 앤 드롭 이동
  const handleDragStart = (e: React.DragEvent, docId: string) => {
    setDraggedDocId(docId);
    e.dataTransfer.setData("docId", docId);
  };

  const handleDrop = async (e: React.DragEvent, targetFolder: string) => {
    e.preventDefault();
    const docId = e.dataTransfer.getData("docId");
    if (docId) {
      const folderName = targetFolder === "미분류" ? "" : targetFolder;
      await updateDocFolderAction(docId, folderName);
      toast.success(`'${targetFolder}' 폴더로 이동되었습니다.`);
    }
    setDraggedDocId(null);
  };

  // 6️⃣ 액션: 완전 삭제
  const handleDelete = async (docId: string, storagePaths: string[]) => {
    if (!confirm("이 연구 기록을 영구 삭제하시겠습니까?\n삭제 시 서버의 원본 파일도 즉시 파기됩니다.")) return;
    
    const loadingToast = toast.loading("기록과 원본 파일을 파기하는 중...");
    const res = await deleteDocumentAction(docId, storagePaths);
    if (res.success) toast.success("성공적으로 파기되었습니다.", { id: loadingToast });
    else toast.error("삭제에 실패했습니다.", { id: loadingToast });
  };

  // 7️⃣ 액션: 태그 관리
  const handleAddTag = async (e: React.KeyboardEvent<HTMLInputElement>, docId: string) => {
    if (e.key === 'Enter' && tagInputs[docId]?.trim()) {
      await updateDocTagsAction(docId, tagInputs[docId].trim(), 'add');
      setTagInputs({ ...tagInputs, [docId]: "" });
    }
  };

  // 🔍 검색 및 폴더 필터링 로직
  const filteredDocs = documents.filter(doc => {
    const matchesFolder = activeFolder === "전체" ? true : (activeFolder === "미분류" ? !doc.folder : doc.folder === activeFolder);
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = doc.title.toLowerCase().includes(searchLower) || (doc.tags && doc.tags.some((t: string) => t.toLowerCase().includes(searchLower)));
    return matchesFolder && matchesSearch;
  });

  if (loading) return (
    <div className="min-h-screen pt-32 flex flex-col items-center justify-center">
      <Loader2 className="animate-spin text-violet-600 mb-4" size={40} />
      <p className="text-gray-500 font-bold">서재를 정리하고 있습니다...</p>
    </div>
  );

  return (
    <main className="pt-28 pb-32 px-6 max-w-7xl mx-auto flex flex-col md:flex-row gap-8 animate-in fade-in duration-500">
      
      {/* 📂 사이드바: 나의 연구 폴더 */}
      <aside className="w-full md:w-64 shrink-0 space-y-6">
        <div className="flex items-center gap-2 text-violet-600 font-black text-2xl mb-8 italic">
          <BrainCircuit size={28} /> 나의 지식 서재
        </div>

        <div className="space-y-1">
          <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 px-2">분류 목록</div>
          
          <button 
            onClick={() => setActiveFolder("전체")}
            onDragOver={(e) => e.preventDefault()}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeFolder === "전체" ? "bg-black text-white shadow-lg" : "text-gray-600 hover:bg-gray-100"}`}
          >
            <FolderOpen size={18} /> 모든 연구 기록 ({documents.length})
          </button>
          
          <button 
            onClick={() => setActiveFolder("미분류")}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, "미분류")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeFolder === "미분류" ? "bg-black text-white shadow-lg" : "text-gray-600 hover:bg-gray-100"}`}
          >
            <Folder size={18} /> 미분류 문서 ({documents.filter(d => !d.folder).length})
          </button>

          <div className="py-2"><hr className="border-gray-100" /></div>

          {/* 유저가 직접 만든 한글 폴더들 */}
          {folders.map(folder => (
            <button 
              key={folder}
              onClick={() => setActiveFolder(folder)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, folder)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeFolder === folder ? "bg-violet-600 text-white shadow-xl shadow-violet-200" : "text-gray-600 hover:bg-violet-50"}`}
            >
              <Folder size={18} /> {folder} ({documents.filter(d => d.folder === folder).length})
            </button>
          ))}

          {/* 폴더 추가 UI */}
          {isAddingFolder ? (
            <div className="px-2 mt-4 animate-in slide-in-from-top-1">
              <input 
                autoFocus
                type="text" 
                placeholder="폴더 이름 입력..."
                className="w-full px-3 py-2 bg-white border border-violet-200 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-violet-500 mb-2"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddFolder()}
              />
              <div className="flex gap-2">
                <button onClick={handleAddFolder} className="flex-1 bg-violet-600 text-white text-xs font-bold py-2 rounded-md hover:bg-violet-700">생성</button>
                <button onClick={() => setIsAddingFolder(false)} className="flex-1 bg-gray-100 text-gray-600 text-xs font-bold py-2 rounded-md hover:bg-gray-200">취소</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setIsAddingFolder(true)} className="w-full flex items-center gap-2 px-4 py-3 mt-2 rounded-xl font-bold text-sm text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-all border border-dashed border-gray-200">
              <Plus size={16} /> 새 폴더 만들기
            </button>
          )}
        </div>
      </aside>

      {/* 📚 메인 영역: 검색 및 연구 카드 */}
      <section className="flex-1">
        {/* 한글 검색바 */}
        <div className="relative mb-8">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-11 pr-4 py-4 bg-white border-2 border-gray-100 rounded-2xl text-sm font-bold text-gray-900 placeholder-gray-400 focus:outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-50 transition-all shadow-sm"
            placeholder="논문 제목이나 태그(#연구방법)로 검색하세요..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* 결과 그리드 */}
        {filteredDocs.length === 0 ? (
          <div className="text-center py-24 bg-gray-50 rounded-[3rem] border-2 border-dashed border-gray-200">
            <FolderOpen size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-black text-gray-500 mb-2">기록이 발견되지 않았습니다</h3>
            <p className="text-sm font-bold text-gray-400">새로운 논문을 분석하거나 검색어를 확인해 보세요.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {filteredDocs.map((doc) => (
              <div 
                key={doc.id}
                draggable
                onDragStart={(e) => handleDragStart(e, doc.id)}
                className={`bg-white border-2 border-gray-100 rounded-[2.5rem] p-7 shadow-sm hover:shadow-2xl hover:border-violet-300 transition-all duration-300 flex flex-col cursor-grab active:cursor-grabbing ${draggedDocId === doc.id ? 'opacity-50 scale-95' : ''}`}
              >
                <div className="flex justify-between items-start mb-5">
                  <span className="inline-block px-3 py-1 bg-violet-50 text-violet-600 rounded-lg text-[10px] font-black uppercase tracking-widest">
                    {doc.mode === 'scan' ? '신속 스캔' : doc.mode === 'understand' ? '심층 분석' : '비판적 사고'}
                  </span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleDelete(doc.id, doc.storagePaths)} className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                <Link href={`/analysis/${doc.id}`} className="flex-1 group">
                  <h3 className="text-xl font-black text-gray-900 leading-snug mb-3 group-hover:text-violet-600 transition-colors line-clamp-2">
                    {doc.title}
                  </h3>
                  <p className="text-sm font-medium text-gray-500 bg-gray-50 p-4 rounded-2xl line-clamp-2 border border-gray-100 mb-5 leading-relaxed">
                    "{getShortSummary(doc.analysisResult)}"
                  </p>
                </Link>

                {/* 해시태그 및 정보 */}
                <div className="mt-auto pt-5 border-t border-gray-100">
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    {doc.tags?.map((tag: string) => (
                      <span key={tag} className="flex items-center gap-1 pl-2 pr-1 py-1 bg-gray-900 text-white rounded-lg text-xs font-bold">
                        <Hash size={12} className="opacity-50" /> {tag}
                        <button onClick={() => updateDocTagsAction(doc.id, tag, 'remove')} className="hover:text-red-400 p-0.5"><X size={12}/></button>
                      </span>
                    ))}
                    
                    <input 
                      type="text" 
                      placeholder="+ 태그 추가"
                      className="text-xs font-bold bg-transparent border border-dashed border-gray-300 rounded-lg px-2 py-1 w-24 focus:outline-none focus:border-violet-500 focus:bg-violet-50 transition-all"
                      value={tagInputs[doc.id] || ""}
                      onChange={(e) => setTagInputs({ ...tagInputs, [doc.id]: e.target.value })}
                      onKeyDown={(e) => handleAddTag(e, doc.id)}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[11px] font-bold text-gray-400">
                    <span className="flex items-center gap-1.5"><FileText size={14}/> {formatKoreanDate(doc.createdAt)} 분석됨</span>
                    <Link href={`/analysis/${doc.id}`} className="text-violet-600 flex items-center gap-1 hover:underline font-black">기록 보기 <ArrowRight size={12}/></Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}