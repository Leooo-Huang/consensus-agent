import { describe, it, expect } from "vitest";

import {
  EvidenceRetriever,
  EMBEDDING_DIM,
  type EvidenceCardCache,
} from "@/lib/evidence/retriever";
import { buildCitations } from "@/lib/evidence/citation-builder";
import type { Citation } from "@/lib/schema/citation";

// ---- fixtures ----

// 构造一个 1536 维 embedding:前几位指定,其余补 0
function embed(...head: number[]): number[] {
  const tail = new Array(EMBEDDING_DIM - head.length).fill(0) as number[];
  return [...head, ...tail];
}

function card(
  id: string,
  embedding: number[],
  overrides: Partial<EvidenceCardCache> = {},
): EvidenceCardCache {
  return {
    id,
    source_id: `src-${id}`,
    title: `title-${id}`,
    snippet: `snippet for ${id} (>=10 chars)`,
    full_content: `full content for ${id}`,
    embedding,
    tags: [],
    cited_count: 0,
    ...overrides,
  };
}

describe("EvidenceRetriever.search — top-k cosine 排序", () => {
  it("query=[1,0,0,...] → 最相似卡片排第一,score≈1.0", () => {
    const retriever = new EvidenceRetriever();
    // ec1 与 query 同方向(相似度≈1),ec2 正交(0),ec3 反向(-1)
    retriever.load([
      card("ec1", embed(1, 0, 0)),
      card("ec2", embed(0, 1, 0)),
      card("ec3", embed(-1, 0, 0)),
    ]);

    const query = embed(1, 0, 0); // [1,0,0, ...new Array(1533).fill(0)]
    const results = retriever.search(query, 3);

    expect(results).toHaveLength(3);
    expect(results[0]?.id).toBe("ec1");
    expect(results[0]?.score).toBeCloseTo(1.0, 5);
    expect(results[1]?.id).toBe("ec2");
    expect(results[1]?.score).toBeCloseTo(0.0, 5);
    expect(results[2]?.id).toBe("ec3");
  });

  it("topK 截断:只返回前 k 条", () => {
    const retriever = new EvidenceRetriever();
    retriever.load([
      card("ec1", embed(1, 0, 0)),
      card("ec2", embed(0, 1, 0)),
      card("ec3", embed(0, 0, 1)),
    ]);
    const results = retriever.search(embed(1, 0, 0), 1);
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe("ec1");
  });

  it("size() 返回已载入卡片数", () => {
    const retriever = new EvidenceRetriever();
    expect(retriever.size()).toBe(0);
    retriever.load([card("ec1", embed(1, 0, 0))]);
    expect(retriever.size()).toBe(1);
  });
});

describe("EvidenceRetriever.search — 维度校验", () => {
  it("query 维度不匹配(传 [1,0])抛 Dim mismatch", () => {
    const retriever = new EvidenceRetriever();
    retriever.load([card("ec1", embed(1, 0, 0))]);
    expect(() => retriever.search([1, 0], 3)).toThrow(/Dim mismatch/);
  });
});

describe("buildCitations — 防幻觉引用", () => {
  const validCitation: Citation = {
    source_type: "internal_doc",
    source_id: "src-ec1",
    snippet: "这是一段合法的引用摘录,长度超过十个字符。",
    relevance: 0.9,
  };

  it("source_id 不在 recalled 集合 → 抛 not in recalled", () => {
    const recalled = new Set<string>(["src-ec1"]);
    const hallucinated: Citation = {
      ...validCitation,
      source_id: "src-fake-999", // 不在召回集
    };
    expect(() => buildCitations([hallucinated], recalled)).toThrow(
      /not in recalled/,
    );
  });

  it("合法 citation(source_id ∈ recalled)通过校验", () => {
    const recalled = new Set<string>(["src-ec1"]);
    const result = buildCitations([validCitation], recalled);
    expect(result).toHaveLength(1);
    expect(result[0]?.source_id).toBe("src-ec1");
  });

  it("空 citations 数组 → CitationsArraySchema 抛错(min 1)", () => {
    const recalled = new Set<string>(["src-ec1"]);
    expect(() => buildCitations([], recalled)).toThrow();
  });
});
