// src/services/kci-service.ts
const KCI_API_KEY = process.env.KCI_API_KEY || "";
const KCI_BASE_URL = "https://open.kci.go.kr/po/openapi";

export interface KciArticleInfo {
  articleId: string;
  title: string;
  authors: string[];
  journal: string;
  year: string;
  volume?: string;
  issue?: string;
  startPage?: string;
  endPage?: string;
  citationCount: number;
  isKciRegistered: boolean;
  isKciIndexed: boolean;
  doi?: string;
  abstract?: string;
  publisher?: string;
}

export interface KciReference {
  title: string;
  authors: string[];
  journal: string;
  year: string;
  citationCount?: number;
}

export interface KciEnrichment {
  isVerified: boolean;
  article?: KciArticleInfo;
  references?: KciReference[];
  relatedPapers?: KciArticleInfo[];
  reliabilityBoost: number;
  badgeLabel?: string;
  apacitation?: string;   // ✅ APA 7th 인용문
  doiUrl?: string;        // ✅ DOI 링크
}

// ─── XML 파싱 유틸 ──────────────────────────────────────────────
function parseKciXml(xmlText: string): any[] {
  try {
    const results: any[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xmlText)) !== null) {
      const item = match[1];
      const get = (tag: string) => {
        const m = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
        return m ? m[1].trim() : "";
      };
      results.push({
        articleId:    get("article-id") || get("articleId"),
        title:        get("article-title") || get("title"),
        authors:      (get("author") || get("authors") || "").split(";").map((a: string) => a.trim()).filter(Boolean),
        journal:      get("journal-title") || get("journal"),
        year:         get("pub-year") || get("year"),
        volume:       get("volume"),
        issue:        get("issue"),
        startPage:    get("start-page") || get("startPage"),
        endPage:      get("end-page") || get("endPage"),
        citationCount: parseInt(get("citation-count") || "0"),
        doi:          get("doi"),
        abstract:     get("abstract"),
        publisher:    get("publisher"),
        isIndexed:    get("kci-indexed") === "Y",
      });
    }
    return results;
  } catch {
    return [];
  }
}

// ─── APA 7th 인용문 생성 ────────────────────────────────────────
export function buildApaCitation(article: KciArticleInfo): string {
  // 저자 포맷: 성, 이름 이니셜. (한국어는 그대로)
  const authorStr = article.authors.length === 0
    ? "저자 미상"
    : article.authors.length <= 20
      ? article.authors.join(", ")
      : article.authors.slice(0, 19).join(", ") + ", ... " + article.authors[article.authors.length - 1];

  const year = article.year || "n.d.";
  const title = article.title || "제목 없음";
  const journal = article.journal || "";
  const volume = article.volume ? `, ${article.volume}` : "";
  const issue = article.issue ? `(${article.issue})` : "";
  const pages = (article.startPage && article.endPage)
    ? `, ${article.startPage}–${article.endPage}`
    : article.startPage ? `, ${article.startPage}` : "";
  const doi = article.doi ? ` https://doi.org/${article.doi}` : "";

  return `${authorStr}. (${year}). ${title}. *${journal}*${volume}${issue}${pages}.${doi}`;
}

// ─── 논문 제목으로 KCI 검색 ──────────────────────────────────────
export async function searchKciByTitle(title: string): Promise<KciArticleInfo | null> {
  if (!KCI_API_KEY || !title) return null;
  try {
    const query = encodeURIComponent(title.slice(0, 80));
    const url = `${KCI_BASE_URL}/articleSearch?apiKey=${KCI_API_KEY}&title=${query}&displayCount=3&startCount=1`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const xml = await res.text();
    const items = parseKciXml(xml);
    if (items.length === 0) return null;

    const best = items.find((item) =>
      item.title.toLowerCase().includes(title.toLowerCase().slice(0, 20))
    ) || items[0];

    return {
      articleId:     best.articleId,
      title:         best.title,
      authors:       best.authors,
      journal:       best.journal,
      year:          best.year,
      volume:        best.volume,
      issue:         best.issue,
      startPage:     best.startPage,
      endPage:       best.endPage,
      citationCount: best.citationCount || 0,
      isKciRegistered: true,
      isKciIndexed:  best.isIndexed || false,
      doi:           best.doi,
      abstract:      best.abstract,
      publisher:     best.publisher,
    };
  } catch (err) {
    console.error("KCI 논문 검색 오류:", err);
    return null;
  }
}

// ─── 참고문헌 조회 ────────────────────────────────────────────────
export async function fetchKciReferences(articleId: string): Promise<KciReference[]> {
  if (!KCI_API_KEY || !articleId) return [];
  try {
    const url = `${KCI_BASE_URL}/referenceSearch?apiKey=${KCI_API_KEY}&articleId=${articleId}&displayCount=10&startCount=1`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseKciXml(xml).map((item) => ({
      title: item.title, authors: item.authors,
      journal: item.journal, year: item.year, citationCount: item.citationCount,
    }));
  } catch {
    return [];
  }
}

// ─── 관련 논문 추천 ───────────────────────────────────────────────
export async function fetchRelatedKciPapers(keywords: string[]): Promise<KciArticleInfo[]> {
  if (!KCI_API_KEY || keywords.length === 0) return [];
  try {
    const query = encodeURIComponent(keywords.slice(0, 3).join(" "));
    const url = `${KCI_BASE_URL}/articleSearch?apiKey=${KCI_API_KEY}&keyword=${query}&displayCount=5&startCount=1`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    return parseKciXml(await res.text()).map((item) => ({
      articleId: item.articleId, title: item.title, authors: item.authors,
      journal: item.journal, year: item.year, citationCount: item.citationCount || 0,
      isKciRegistered: true, isKciIndexed: item.isIndexed || false, doi: item.doi,
    }));
  } catch {
    return [];
  }
}

// ─── 신뢰도 보정치 계산 ───────────────────────────────────────────
function computeReliabilityBoost(article: KciArticleInfo): { boost: number; badge: string } {
  let boost = 0;
  let badge = "KCI 등록 논문";
  if (article.isKciIndexed) { boost += 10; badge = "KCI 등재 학술지"; }
  if (article.citationCount >= 100)      { boost += 15; badge = "고인용 논문 (100회+)"; }
  else if (article.citationCount >= 50)  { boost += 10; badge = "주목 논문 (50회+)"; }
  else if (article.citationCount >= 10)  { boost += 5;  badge = "인용 논문 (10회+)"; }
  return { boost, badge };
}

// ─── 통합 enrichment ─────────────────────────────────────────────
export async function enrichWithKci(
  title: string,
  keywords: string[] = []
): Promise<KciEnrichment> {
  const [article, relatedPapers] = await Promise.all([
    searchKciByTitle(title),
    fetchRelatedKciPapers(keywords),
  ]);

  if (!article) return { isVerified: false, relatedPapers, reliabilityBoost: 0 };

  const references = await fetchKciReferences(article.articleId);
  const { boost, badge } = computeReliabilityBoost(article);
  const apacitation = buildApaCitation(article);
  const doiUrl = article.doi ? `https://doi.org/${article.doi}` : undefined;

  return {
    isVerified: true,
    article,
    references,
    relatedPapers,
    reliabilityBoost: boost,
    badgeLabel: badge,
    apacitation: apacitation,
    doiUrl,
  };
}