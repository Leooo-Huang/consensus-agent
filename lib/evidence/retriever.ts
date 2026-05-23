// lib/evidence/retriever.ts
// 证据引擎 — in-memory cosine retriever(architecture.md §证据引擎)
//
// P0 设计:证据卡片(含 1536 维 embedding)全部载入内存,search 用 cosine 排序取 top-k。
// 关键约束:Agent 推理时只能从已召回的证据集中选用(防幻觉引用),search 返回的
// SearchResult.id 集合即为"召回集",供 citation-builder 校验。
//
// embedding 维度固定 1536(OpenAI text-embedding-3-small 默认)。维度不匹配抛错。
//
// 注意:db 客户端在 loadFromDB 内部动态 import。db 模块在 import 时即构造 neon()
// 连接(校验连接串格式),而本模块的纯内存路径(load/search/buildCitations 链路)
// 不应依赖 DB 环境,故延迟到真正用到时才加载。

export const EMBEDDING_DIM = 1536;

/** 内存中的证据卡片(embedding 必为 1536 维)。 */
export interface EvidenceCardCache {
  id: string;
  source_id: string;
  title: string;
  snippet: string;
  full_content: string;
  embedding: number[]; // 1536 维
  tags: string[];
  cited_count: number;
}

export interface SearchResult {
  id: string;
  source_id: string;
  title: string;
  snippet: string;
  score: number; // cosine 相似度 [-1, 1]
}

/**
 * 余弦相似度。两向量长度必须一致(调用方保证已是 1536 维)。
 * 任一向量模为 0 时返回 0(无法定义,保守处理)。
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i] ?? 0; // noUncheckedIndexedAccess
    const bi = b[i] ?? 0;
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export class EvidenceRetriever {
  private cards: EvidenceCardCache[] = [];

  /** 直接载入(测试 / fixture 用)。 */
  load(cards: EvidenceCardCache[]): void {
    this.cards = cards;
  }

  /**
   * 从 DB 读 evidence_cards,只保留 embedding.length === 1536 的卡片载入内存(P0 in-memory)。
   * embedding 为 null 或维度不符的卡片被静默跳过(它们无法参与 cosine 检索)。
   */
  async loadFromDB(): Promise<void> {
    const { db } = await import("@/lib/db");
    const { evidence_cards } = await import("@/lib/db/schema");
    const rows = await db.select().from(evidence_cards);
    this.cards = rows
      .filter(
        (r): r is typeof r & { embedding: number[] } =>
          Array.isArray(r.embedding) && r.embedding.length === EMBEDDING_DIM,
      )
      .map((r) => ({
        id: r.id,
        source_id: r.source_id,
        title: r.title,
        snippet: r.snippet,
        full_content: r.full_content,
        embedding: r.embedding,
        tags: r.tags,
        cited_count: r.cited_count,
      }));
  }

  /**
   * cosine 排序取 top-k。queryEmbedding 维度必须与卡片一致(1536),否则抛 `Dim mismatch`。
   */
  search(queryEmbedding: number[], topK: number): SearchResult[] {
    if (queryEmbedding.length !== EMBEDDING_DIM) {
      throw new Error(
        `Dim mismatch: query embedding has ${queryEmbedding.length} dims, expected ${EMBEDDING_DIM}`,
      );
    }
    const scored = this.cards.map((c) => {
      if (c.embedding.length !== EMBEDDING_DIM) {
        throw new Error(
          `Dim mismatch: card ${c.id} embedding has ${c.embedding.length} dims, expected ${EMBEDDING_DIM}`,
        );
      }
      return {
        id: c.id,
        source_id: c.source_id,
        title: c.title,
        snippet: c.snippet,
        score: cosineSimilarity(queryEmbedding, c.embedding),
      };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, Math.max(0, topK));
  }

  size(): number {
    return this.cards.length;
  }
}

// 进程级单例(P0 in-memory cache)
let _retriever: EvidenceRetriever | null = null;

export function getRetriever(): EvidenceRetriever {
  if (_retriever === null) {
    _retriever = new EvidenceRetriever();
  }
  return _retriever;
}
