"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, onSnapshot, doc, orderBy } from "firebase/firestore";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { 
  Folder, FolderOpen, Search, Hash, Trash2, Plus, 
  ChevronRight, BrainCircuit, FileText, X, ArrowRight, Loader2
} from "lucide-react";
import Link from "next/link";

import { 
  deleteDocumentAction, updateDocFolderAction, 
  updateDocTagsAction, createUserFolderAction 
} from "@/app/actions/library-actions";

export default function LibraryPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeFolder, setActiveFolder] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  const [newFolderName, setNewFolderName] = useState("");
  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [tagInputs, setTagInputs] = useState<{[key: string]: string}>({});
  const [draggedDocId, setDraggedDocId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.replace("/login");
        return;
      }
      setUser(currentUser);

      const unsubscribeUser = onSnapshot(doc(db, "users", currentUser.uid), (docSnap) => {
        if (docSnap.exists() && docSnap.data().customFolders) {
          setFolders(docSnap.data().customFolders);
        }
      });

      const q = query(collection(db, "knowledge_library"), where("userId", "==", currentUser.uid), orderBy("createdAt", "desc"));
      const unsubscribeDocs = onSnapshot(q, (snapshot) => {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setDocuments(docs);
        setLoading(false);
      });

      return () => { unsubscribeUser(); unsubscribeDocs(); };
    });
    return () => unsubscribeAuth();
  }, [router]);

  // 🚀 [에러 완벽 방어막] 안전한 날짜 포맷 함수
  const formatSafeDate = (dateObj: any) => {
    if (!dateObj) return "방금 전";
    if (typeof dateObj.toDate === 'function') return dateObj.toDate().toLocaleDateString('ko-KR');
    if (dateObj.seconds) return new Date(dateObj.seconds * 1000).toLocaleDateString('ko-KR');
    return new Date(dateObj).toLocaleDateString('ko-KR');
  };

  const getShortSummary = (text: string) => {
    if (!text) return "분석 내용이 없습니다.";
    const match = text.match(/\[한줄요약\]\s*(.+)/);
    return match ? match[1].trim() : text.split('\n')[0].substring(0, 50) + "...";
  };

  const handleAddFolder = async () => {
    if (!newFolderName.trim()) return;
    if (folders.includes(newFolderName.trim())) return toast.error("이미 존재하는 폴더입니다.");
    
    await createUserFolderAction(user.uid, newFolderName.trim());
    setNewFolderName("");
    setIsAddingFolder(false);
    toast.success("새 폴더가 생성되었습니다.");
  };

  const handleDragStart = (e: React.DragEvent, docId: string) => {
    setDraggedDocId(docId);
    e.dataTransfer.setData("docId", docId);
  };

  const handleDrop = async (e: React.DragEvent, targetFolder: string) => {
    e.preventDefault();
    const docId = e.dataTransfer.getData("docId");
    if (docId) {
      const folderName = targetFolder === "unassigned" ? "" : targetFolder;
      await updateDocFolderAction(docId, folderName);
      toast.success(`'${targetFolder === "unassigned" ? "미분류" : targetFolder}'(으)로 이동되었습니다.`);
    }
    setDraggedDocId(null);
  };

  const handleDelete = async (docId: string, storagePaths: string[]) => {
    if (!confirm("정말 이 연구 기록을 영구 삭제하시겠습니까?\n(1시간이 지나지 않았다면 서버의 원본 PDF도 함께 파기됩니다.)")) return;
    
    const loadingToast = toast.loading("서버에서 기록과 원본을 파기 중입니다...");
    const res = await deleteDocumentAction(docId, storagePaths);
    if (res.success) toast.success("완벽하게 영구 파기되었습니다.", { id: loadingToast });
    else toast.error("삭제 실패", { id: loadingToast });
  };

  const handleAddTag = async (e: React.KeyboardEvent<HTMLInputElement>, docId: string) => {
    if (e.key === 'Enter' && tagInputs[docId]?.trim()) {
      await updateDocTagsAction(docId, tagInputs[docId].trim(), 'add');
      setTagInputs({ ...tagInputs, [docId]: "" });
    }
  };

  const handleRemoveTag = async (docId: string, tag: string) => {
    await updateDocTagsAction(docId, tag, 'remove');
  };

  const filteredDocs = documents.filter(doc => {
    const matchesFolder = activeFolder === "all" ? true : (activeFolder === "unassigned" ? !doc.folder : doc.folder === activeFolder);
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = doc.title.toLowerCase().includes(searchLower) || (doc.tags && doc.tags.some((t: string) => t.toLowerCase().includes(searchLower)));
    return matchesFolder && matchesSearch;
  });

  if (loading) return <div className="min-h-screen pt-32 flex justify-center"><Loader2 className="animate-spin text-violet-600" size={40} /></div>;

  return (
    <main className="pt-28 pb-32 px-6 max-w-7xl mx-auto flex flex-col md:flex-row gap-8 animate-in fade-in duration-500">
      <aside className="w-full md:w-64 shrink-0 space-y-6">
        <div className="flex items-center gap-2 text-violet-600 font-black text-2xl mb-8"><BrainCircuit size={28} /> Second Brain</div>
        <div className="space-y-2">
          <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 px-2">Library</div>
          <button onClick={() => setActiveFolder("all")} onDragOver={(e) => e.preventDefault()} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeFolder === "all" ? "bg-black text-white" : "text-gray-600 hover:bg-gray-100"}`}>
            <FolderOpen size={18} /> 모든 연구 ({documents.length})
          </button>
          <button onClick={() => setActiveFolder("unassigned")} onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, "unassigned")} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeFolder === "unassigned" ? "bg-black text-white" : "text-gray-600 hover:bg-gray-100"}`}>
            <Folder size={18} /> 미분류 ({documents.filter(d => !d.folder).length})
          </button>
          <hr className="border-gray-100 my-4" />
          {folders.map(folder => (
            <button key={folder} onClick={() => setActiveFolder(folder)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, folder)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeFolder === folder ? "bg-violet-600 text-white shadow-lg shadow-violet-200" : "text-gray-600 hover:bg-violet-50"}`}>
              <Folder size={18} /> {folder} ({documents.filter(d => d.folder === folder).length})
            </button>
          ))}
          {isAddingFolder ? (
            <div className="px-2 mt-4 animate-in fade-in">
              <input autoFocus type="text" placeholder="새 폴더 이름..." className="w-full px-3 py-2 bg-white border border-violet-200 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-violet-500 mb-2" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddFolder()} />
              <div className="flex gap-2">
                <button onClick={handleAddFolder} className="flex-1 bg-violet-600 text-white text-xs font-bold py-1.5 rounded-md">추가</button>
                <button onClick={() => setIsAddingFolder(false)} className="flex-1 bg-gray-100 text-gray-600 text-xs font-bold py-1.5 rounded-md">취소</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setIsAddingFolder(true)} className="w-full flex items-center gap-2 px-4 py-3 mt-2 rounded-xl font-bold text-sm text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-all border border-dashed border-gray-200"><Plus size={16} /> 새 폴더 추가</button>
          )}
        </div>
      </aside>

      <section className="flex-1">
        <div className="relative mb-8">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Search className="h-5 w-5 text-gray-400" /></div>
          <input type="text" className="block w-full pl-11 pr-4 py-4 bg-white border-2 border-gray-100 rounded-2xl text-sm font-bold text-gray-900 placeholder-gray-400 focus:outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-50 transition-all shadow-sm" placeholder="논문 제목이나 #태그 검색..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>

        {filteredDocs.length === 0 ? (
          <div className="text-center py-20 bg-gray-50 rounded-[2rem] border-2 border-dashed border-gray-200">
            <FolderOpen size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-black text-gray-500 mb-2">이 폴더는 비어있습니다</h3>
            <p className="text-sm font-bold text-gray-400">새로운 논문을 분석하거나 다른 폴더에서 끌어와 보세요.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {filteredDocs.map((doc) => (
              <div key={doc.id} draggable onDragStart={(e) => handleDragStart(e, doc.id)} className={`bg-white border-2 border-gray-100 rounded-[2rem] p-6 shadow-sm hover:shadow-xl hover:border-violet-300 transition-all duration-300 flex flex-col cursor-grab active:cursor-grabbing ${draggedDocId === doc.id ? 'opacity-50 scale-95' : ''}`}>
                <div className="flex justify-between items-start mb-4">
                  <span className="inline-block px-3 py-1 bg-violet-50 text-violet-600 rounded-lg text-[10px] font-black uppercase tracking-widest">{doc.mode} 모드</span>
                  <button onClick={() => handleDelete(doc.id, doc.storagePaths)} className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"><Trash2 size={16} /></button>
                </div>

                <Link href={`/analysis/${doc.id}`} className="flex-1 group">
                  <h3 className="text-lg font-black text-gray-900 leading-snug mb-2 group-hover:text-violet-600 transition-colors line-clamp-2">{doc.title}</h3>
                  <p className="text-sm font-medium text-gray-500 bg-gray-50 p-3 rounded-xl line-clamp-2 border border-gray-100 mb-4">"{getShortSummary(doc.analysisResult)}"</p>
                </Link>

                <div className="mt-auto pt-4 border-t border-gray-100">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    {doc.tags?.map((tag: string) => (
                      <span key={tag} className="flex items-center gap-1 pl-2 pr-1 py-1 bg-gray-900 text-white rounded-lg text-xs font-bold">
                        <Hash size={12} className="opacity-50" /> {tag}
                        <button onClick={() => handleRemoveTag(doc.id, tag)} className="hover:text-red-400 p-0.5"><X size={12}/></button>
                      </span>
                    ))}
                    <input type="text" placeholder="+ 태그 추가 (Enter)" className="text-xs font-bold bg-transparent border border-dashed border-gray-300 rounded-lg px-2 py-1 w-28 focus:outline-none focus:border-violet-500 focus:bg-violet-50" value={tagInputs[doc.id] || ""} onChange={(e) => setTagInputs({ ...tagInputs, [doc.id]: e.target.value })} onKeyDown={(e) => handleAddTag(e, doc.id)} />
                  </div>
                  <div className="flex justify-between items-center text-xs font-bold text-gray-400">
                    <span className="flex items-center gap-1"><FileText size={12}/> {formatSafeDate(doc.createdAt)}</span>
                    <Link href={`/analysis/${doc.id}`} className="text-violet-600 flex items-center gap-1 hover:underline">열어보기 <ArrowRight size={12}/></Link>
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