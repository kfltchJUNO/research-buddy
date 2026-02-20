export interface UserProfile {
  uid: string;
  nickname: string;
  inkBalance: number;
  isTrialUsed: boolean;
  createdAt: Date;
}

export interface Citation {
  page: number;
  text: string;
  relevance: number; // 의미적 유사도 점수
}

export interface AnalysisResult {
  id: string;
  userId: string;
  title: string;
  mode: 'scan' | 'understand' | 'think';
  oneLineSummary: string;
  keywords: string[];
  content: {
    summary: string;
    sections?: { title: string; body: string }[];
    critique?: string; // 비판적 분석 내용
    researchQuestions?: string[]; // AI 제안 질문
  };
  citations: Citation[];
  visualData?: any; // Chart.js용 JSON
  isFavorite: boolean;
  userTags: string[];
  createdAt: any; // Firestore Timestamp
  fileDeletedAt: any;
  isSourceDeleted: boolean;
}