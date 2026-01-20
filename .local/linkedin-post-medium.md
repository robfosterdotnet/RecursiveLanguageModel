# LinkedIn Post - Medium Version (Technical Depth)

**~450 words | Best for thought leadership**

---

24 parallel LLM calls. Zero context rot. 100-page contracts analyzed with full attention.

Here's the architecture.

I kept hitting the same problem with legal document analysis:

LLMs pay attention to the beginning and end of context.

The middle? It fades.

Your indemnification clause on page 47? The model is basically skimming.

RAG doesn't fix this either:

→ Top-K retrieval is query-dependent tunnel vision
→ Misses cross-document relationships
→ Can't synthesize scattered information

So I built something different.

Recursive Language Models (RLM):

1. Chunk documents at paragraph boundaries (~1800 chars)
2. Each chunk gets its own LLM sub-call
3. Sub-model returns: { relevant, summary, citations }
4. Root model aggregates all findings
5. Rewrite pass for legal precision + plain language

The key insight:

Each sub-call has FULL attention on its chunk.

No middle-of-context loss.

The root model sees distilled findings, not raw text.

Irrelevant chunks get filtered (relevant: false).

Citations preserved through the entire pipeline.

I added a knowledge graph layer for complex contracts:

Entity extraction:
→ parties, dates, amounts, clauses
→ obligations, rights, conditions

Relationship extraction:
→ has_obligation, has_right
→ depends_on, references
→ effective_on, expires_on

Entities merge across chunks using Jaccard similarity ≥ 0.7.

"Acme Corp" in chunk 3 = "Acme Corporation" in chunk 47.

The root model receives findings + graph summary.

Now I can answer:

"What obligations does Party A have that expire before the effective date of Section 12?"

With citations. Across 200 chunks.

The numbers:

→ Chunk size: 1800 chars
→ Max sub-calls: 24 parallel
→ Sub-model: lightweight (cost efficient)
→ Root model: full capability
→ Similarity threshold: 0.7

Cost: ~3x a single large-context call for 24x coverage.

Everyone's chasing bigger context windows.

1M tokens. 10M. "Infinite context."

Wrong direction.

Attention doesn't scale linearly. Bigger = more diluted.

The answer isn't bigger windows.

It's recursive decomposition.

Open sourced the implementation: robfosterdotnet/RecursiveLanguageModel

Four modes to compare:
→ base (truncated)
→ retrieval (BM25 top-K)
→ rlm (sub-calls + aggregation)
→ rlm-graph (+ knowledge graph)

Link in comments.

What's your experience with context rot?

#AI #LegalTech #LLM #MachineLearning #OpenSource

---

## Posting Instructions

1. Copy text above (between the `---` markers)
2. Post WITHOUT the GitHub link in the body
3. Immediately comment with: `Repo: https://github.com/robfosterdotnet/RecursiveLanguageModel`
4. Attach the infographic screenshot (see `rlm-infographic.html`)
