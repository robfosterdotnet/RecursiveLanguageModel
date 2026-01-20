# LinkedIn Article - Full Version

**~1000 words | Best as a LinkedIn Article (not post)**

---

# Your 128K Context Window Is Lying to You

## The Hidden Problem Killing Your Document Analysis

Your 128K context window is lying to you.

Here's what's actually happening inside.

I've been building document analysis systems for legal contracts—the kind where missing a single clause can cost millions. And I kept hitting the same wall.

The "lost in the middle" problem.

Research from Stanford and elsewhere confirmed what I was seeing: LLMs pay strong attention to the beginning and end of their context. The middle? It fades. Information decays. Critical clauses get missed.

I call this **context rot**.

I built an open-source implementation to solve it. The repo is called **RecursiveLanguageModel** on GitHub (link in comments).

Let me walk you through the architecture.

---

## The Math Doesn't Lie

Even with 128K token windows, attention isn't uniform.

Stuff at position 60K gets roughly 40% less attention than stuff at position 1K. Your indemnification clause buried on page 47? The model might as well be skimming.

The naive solution: truncate to ~12K characters.

The result: you're literally throwing away 90% of the document.

In code, this is the `base` mode in `src/lib/analyze.ts`—it just concatenates and truncates. Simple. Lossy.

---

## RAG Doesn't Solve This Either

"Just use retrieval!" they said.

BM25 or vector search grabs your top-K chunks. Feed them to the LLM. Problem solved, right?

Wrong.

RAG has three fatal flaws for complex documents:

1. **Query-dependent tunnel vision** — You only retrieve what matches your query. Cross-references between Section 4.2 and Exhibit B? Missed.

2. **No synthesis across chunks** — Each chunk is retrieved independently. The relationship between Party A's obligation in chunk 12 and the termination clause in chunk 47? Invisible.

3. **Top-K is a lossy filter** — Set K=8 and you're betting the answer lives in 8 chunks. In a 200-chunk contract, that's a 96% information discard rate.

The `retrieval` mode in the repo (`src/lib/retrieval.ts`) implements BM25-style term frequency ranking. It works for simple queries. It fails for complex legal analysis.

I needed something different.

---

## Recursive Language Models: Divide and Conquer

Here's the architecture that actually works.

### Step 1: Chunk Intelligently

Split documents into ~1800 character segments at paragraph boundaries. Not arbitrary token splits—semantic units.

From `src/lib/chunking.ts`:
```typescript
const splitParagraphs = (text: string) =>
  text.split(/\n\s*\n/g)
    .map((part) => part.trim())
    .filter(Boolean);
```

Paragraph-aware chunking preserves logical units. A clause stays together.

### Step 2: Parallel Sub-calls

Each chunk gets its own dedicated LLM call. The sub-model sees ONLY that chunk plus the question.

No context competition. Full attention. Zero middle-of-context loss.

The sub-model returns structured output:
```json
{
  "relevant": true,
  "summary": "Section 4.2 grants Licensor right to audit...",
  "citations": ["doc-1-chunk-12"]
}
```

### Step 3: Root Aggregation

A senior model receives ALL the distilled findings—not the raw text.

It sees:
- 24 focused summaries (not 24 raw chunks)
- Relevance-filtered signal (irrelevant chunks already discarded)
- Citation trails for every claim

### Step 4: Rewrite Pass

Final pass optimizes for legal precision AND plain-language clarity.

---

## Why This Beats Context Rot

The insight is simple:

Each sub-call operates with FULL attention on a small window.

There's no "middle" to get lost in when your context is 1800 characters.

The root model never sees raw text at all. It sees pre-digested findings. Efficient attention on synthesized information.

Irrelevant chunks (`relevant: false`) get filtered before aggregation. Signal-to-noise ratio goes up dramatically.

And citations flow through the entire pipeline. Every claim traces back to a specific chunk ID.

---

## RLM + Knowledge Graph: The Advanced Mode

For complex multi-party contracts, I added a second layer: `rlm-graph` mode.

During each sub-call, the model also extracts entities and relationships.

**Entity types:**
- Parties (companies, signatories)
- Dates (effective, expiration, deadlines)
- Amounts (dollar figures, percentages)
- Clauses (indemnification, termination, force majeure)
- Obligations, rights, conditions

**Relationship types:**
- `has_obligation`: Party → Obligation
- `has_right`: Party → Right
- `depends_on`: Obligation → Condition
- `references`: Clause → Clause (cross-references)

Entities get merged across chunks using Jaccard similarity (threshold: 0.7). "Acme Corp" in chunk 3 and "Acme Corporation" in chunk 47? Same node.

The root model receives both findings AND graph context.

Now you can answer: "What obligations does Party A have that depend on conditions controlled by Party B?"

Across a 100-page contract. With citations.

---

## The Numbers from Production

| Parameter | Value |
|-----------|-------|
| Chunk size | 1800 chars |
| Max parallel sub-calls | 24 |
| Sub-model | Lightweight (gpt-4o-mini class) |
| Root model | Full capability |
| Similarity threshold | 0.7 |
| Retrieval top-K (for comparison) | 8 |

Cost structure: Sub-calls use cheap, fast models. Only the root aggregation needs the expensive model. You get 24x coverage at roughly 3x the cost of a single large-context call.

---

## The Contrarian Take

Everyone's chasing bigger context windows.

1M tokens. 10M tokens. "Infinite context."

I think that's the wrong direction.

Attention doesn't scale linearly with context. Bigger windows mean more diluted focus. More context rot, not less.

The answer isn't bigger windows.

It's smarter decomposition.

Recursive architectures that guarantee full attention on every segment. Structured aggregation that preserves signal. Knowledge graphs that capture relationships the raw text obscures.

The best legal AI won't have the biggest context window.

It'll have the smartest architecture.

---

## Try It Yourself

The full implementation is open source: **robfosterdotnet/RecursiveLanguageModel** on GitHub.

Four modes to compare:
- `base` — truncated context (the naive approach)
- `retrieval` — BM25 top-K (traditional RAG)
- `rlm` — recursive sub-calls + root aggregation
- `rlm-graph` — RLM + knowledge graph extraction

Upload a contract. Ask a question. Watch the difference.

---

What's your experience with long-document analysis? Have you hit the "lost in the middle" problem?

Drop a comment—I'm curious what approaches are working for you.

#AI #LegalTech #LLM #MachineLearning #OpenSource

---

## Posting Instructions

1. Create as a LinkedIn **Article** (not a post)
2. Add the infographic as the cover image
3. Comment with repo link after publishing: `https://github.com/robfosterdotnet/RecursiveLanguageModel`
