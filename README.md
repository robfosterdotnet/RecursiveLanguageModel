# Document Analysis with Recursive Language Models

A Next.js application that implements the **Recursive Language Models (RLM)** approach from MIT research for analyzing documents that exceed typical LLM context limits. This pilot demonstrates four analysis modes—Base, Retrieval, RLM, and RLM + Graph—allowing direct comparison of their effectiveness on document analysis tasks.

## The Problem: Context Limits and "Context Rot"

Large Language Models have a fundamental limitation: as input context grows, response quality degrades. This phenomenon, called **"context rot"**, occurs because:

- Attention becomes diluted across too many tokens
- Models struggle to locate relevant information in long documents
- Important details get lost in the middle of large contexts

Traditional approaches have significant drawbacks:

| Approach | How it works | Failure mode |
|----------|--------------|--------------|
| **Summarization** | Compress documents before analysis | Loses critical details needed for dense tasks |
| **Retrieval (RAG)** | Fetch top-K relevant chunks | Fails when answers depend on most of the document |
| **Larger context windows** | Use models with 100K+ token limits | Still degrades; just delays the problem |

## The Solution: Recursive Language Models

RLMs treat the document as an **external environment** rather than stuffing it into the model's context. The key insight is that the full document never enters the model—instead, the model programmatically inspects and processes small slices.

### How RLM Works

```
┌─────────────────────────────────────────────────────────────────┐
│                        Document Store                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ Chunk 1  │ │ Chunk 2  │ │ Chunk 3  │ │ Chunk N  │  ...      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
└─────────────────────────────────────────────────────────────────┘
        │              │              │              │
        ▼              ▼              ▼              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Sub-Model (parallel)                          │
│                                                                  │
│   "Analyze this snippet. Return JSON with:                      │
│    - relevant: boolean                                          │
│    - summary: factual summary grounded in snippet               │
│    - citations: [chunk-id]"                                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
        │              │              │              │
        └──────────────┴──────────────┴──────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Root Model                                │
│                                                                  │
│   "Aggregate these findings into a structured answer.           │
│    Preserve citations. State what's missing."                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                      ┌──────────────┐
                      │ Final Answer │
                      │ + Citations  │
                      └──────────────┘
```

### The Four Analysis Modes

This application implements four modes to demonstrate the RLM advantage:

#### 1. Base Mode
Direct LLM call with the entire document concatenated. Simple but limited.

- **How**: Concatenate all documents, truncate to 12K chars, send to LLM
- **Best for**: Short documents that fit in context
- **Limitation**: Truncates content; misses information beyond the limit

#### 2. Retrieval Mode
Classic RAG approach—rank chunks by relevance, send top-K to LLM.

- **How**: Chunk documents → BM25-style ranking → Top-K chunks → LLM
- **Best for**: Questions where the answer is in a small portion of the document
- **Limitation**: Fails when answers require information spread across many chunks

#### 3. RLM Mode (Recursive)
The full recursive approach from the MIT paper.

- **How**:
  1. Chunk documents into ~1800 character segments
  2. Run sub-model on each chunk in parallel batches
  3. Sub-model extracts relevant findings with citations
  4. Root model aggregates findings into structured answer
  5. Optional rewrite pass for clarity

- **Best for**:
  - Documents exceeding context limits
  - Dense analysis requiring most of the document
  - Tasks needing cross-reference between sections
  - Legal, compliance, or comprehensive review tasks

- **Why it works**: Each sub-call operates on a small, focused snippet. The sub-model can't hallucinate facts from other parts of the document because it literally doesn't see them.

#### 4. RLM + Graph Mode (Recursive with Knowledge Graph)
Enhances RLM with structured knowledge graph extraction for relationship-heavy documents.

- **How**:
  1. Chunk documents into ~1800 character segments
  2. Run sub-model on each chunk in parallel batches
  3. Sub-model extracts both:
     - Relevant findings with citations (standard RLM)
     - Structured entities and relationships (graph extraction)
  4. Build unified knowledge graph by merging entities across chunks
  5. Root model receives findings + graph summary for aggregation
  6. Optional rewrite pass for clarity

- **Best for**:
  - Legal contracts with multiple parties and obligations
  - Documents with complex cross-references
  - Compliance reviews requiring relationship tracking
  - Questions about how entities interact ("Who has obligations to whom?")
  - Understanding document structure and dependencies

- **Knowledge Graph Features**:
  - **Entity Types**: parties, dates, amounts, clauses, obligations, rights, conditions, documents, sections
  - **Relationship Types**: has_obligation, has_right, references, depends_on, effective_on, expires_on, involves_amount, defined_in, related_to
  - **Entity Merging**: Automatically merges similar entities across chunks using fuzzy name matching
  - **Confidence Scoring**: Each entity and relationship includes a confidence score
  - **Source Tracking**: Tracks which chunks contributed to each entity/relationship

- **Why it works**: Combines the scalability of RLM with structured relationship extraction. The knowledge graph provides a semantic map of the document, making it easier to answer questions about relationships, dependencies, and cross-references that span multiple sections.

## When to Use Each Mode

| Scenario | Recommended Mode |
|----------|------------------|
| Document < 10K chars, simple question | Base |
| Large document, answer in one section | Retrieval |
| Large document, answer spread throughout | RLM |
| Legal contract review | RLM or RLM + Graph |
| "Summarize all risks" across 100 pages | RLM |
| "What is the termination clause?" | Retrieval |
| Quick summary of short memo | Base |
| "Who has obligations to whom?" | RLM + Graph |
| "Map all parties and their relationships" | RLM + Graph |
| "Find all cross-references between sections" | RLM + Graph |
| Multi-party contract with dependencies | RLM + Graph |

## Example Prompts by Document Type

Below are example prompts you can use to test the application with different types of documents. Each example includes the document type, sample questions, and the recommended analysis mode.

### Legal Contracts

**Document**: Service Agreement, Master Service Agreement, Purchase Agreement, License Agreement

**Questions**:
- Base Mode:
  - "What is the effective date of this agreement?"
  - "Who are the parties to this contract?"

- Retrieval Mode:
  - "What is the termination clause?"
  - "What are the payment terms?"
  - "What warranties are provided?"

- RLM Mode:
  - "Summarize all obligations for both parties"
  - "What are all the liability limitations throughout the contract?"
  - "List all conditions under which either party can terminate"
  - "What are all the penalties and remedies mentioned in this agreement?"

- RLM + Graph Mode:
  - "Who has obligations to whom, and what are they?"
  - "Map all parties involved and their relationships"
  - "What obligations depend on specific conditions being met?"
  - "Which clauses reference or depend on other clauses?"
  - "Create a complete map of all parties, their rights, and obligations"

### Technical Documentation

**Document**: API Documentation, Software Architecture Document, System Design Specification

**Questions**:
- Base Mode:
  - "What is the main purpose of this system?"
  - "Which version is this documentation for?"

- Retrieval Mode:
  - "How do I authenticate with the API?"
  - "What is the rate limiting policy?"
  - "What does the /users endpoint do?"

- RLM Mode:
  - "List all available API endpoints and their functions"
  - "What are all the error codes and their meanings?"
  - "Summarize the security requirements across all endpoints"
  - "What are all the dependencies and their versions?"

- RLM + Graph Mode:
  - "Map the relationships between all system components"
  - "Which services depend on which other services?"
  - "Show all data flows between components"
  - "What are all the external integrations and how do they connect?"

### Financial Reports

**Document**: Annual Report, Quarterly Earnings Report, Financial Statement

**Questions**:
- Base Mode:
  - "What is the total revenue for this period?"
  - "What is the company name in this report?"

- Retrieval Mode:
  - "What were the operating expenses?"
  - "What does the CEO letter say about future outlook?"
  - "What are the risk factors mentioned?"

- RLM Mode:
  - "Summarize all revenue streams mentioned in the report"
  - "List all risks and challenges identified across the entire document"
  - "What are all the growth initiatives mentioned?"
  - "Compare year-over-year changes across all metrics"

- RLM + Graph Mode:
  - "Map all business segments and their financial relationships"
  - "Which segments depend on which markets or products?"
  - "Show all subsidiaries and their parent-child relationships"
  - "What are all the partnerships and how do they relate to revenue?"

### Research Papers

**Document**: Academic Paper, Research Study, Technical White Paper

**Questions**:
- Base Mode:
  - "What is the title and author of this paper?"
  - "When was this published?"

- Retrieval Mode:
  - "What methodology was used in this study?"
  - "What were the main findings?"
  - "What is the conclusion?"

- RLM Mode:
  - "Summarize all experiments and their results"
  - "What are all the limitations mentioned throughout the paper?"
  - "List all hypotheses tested and their outcomes"
  - "Compare all data points across different experimental conditions"

- RLM + Graph Mode:
  - "Map all variables and their relationships tested in the study"
  - "Which outcomes depend on which conditions?"
  - "Show all citations and how they relate to different claims"
  - "What are all the causal relationships identified?"

### Compliance & Policy Documents

**Document**: Privacy Policy, Terms of Service, GDPR Compliance Document, SOC 2 Report

**Questions**:
- Base Mode:
  - "What company is this policy for?"
  - "When was this policy last updated?"

- Retrieval Mode:
  - "How is user data collected?"
  - "What are the cookie policies?"
  - "How can users delete their data?"

- RLM Mode:
  - "List all types of personal data collected and how they're used"
  - "What are all the user rights mentioned in this document?"
  - "Summarize all security measures described"
  - "What are all the third parties that receive user data?"

- RLM + Graph Mode:
  - "Map all data flows: what data goes where and to whom"
  - "Which processing activities depend on which legal bases?"
  - "Show all third-party relationships and data sharing arrangements"
  - "What are all the user rights and which data categories do they apply to?"

### Multi-Document Analysis

**Documents**: Multiple related contracts, project documentation set, compliance package

**Questions**:
- RLM Mode:
  - "What are the common obligations across all these contracts?"
  - "Identify any conflicting terms between these documents"
  - "Summarize the timeline of deliverables across all project docs"

- RLM + Graph Mode:
  - "Map all parties across all contracts and show their relationships"
  - "Which obligations in one contract relate to obligations in others?"
  - "Show all cross-references between documents"
  - "Create a unified view of all deadlines and their dependencies"

### Medical/Clinical Documents

**Document**: Clinical Trial Protocol, Patient Records, Medical Guidelines

**Questions**:
- Retrieval Mode:
  - "What are the inclusion criteria?"
  - "What is the primary endpoint?"
  - "What adverse events are monitored?"

- RLM Mode:
  - "Summarize all safety monitoring procedures"
  - "List all dosing schedules and modifications"
  - "What are all the contraindications mentioned?"

- RLM + Graph Mode:
  - "Map all patient cohorts and their treatment paths"
  - "Which procedures depend on which test results?"
  - "Show all medication interactions and dependencies"
  - "What are all the escalation criteria and resulting actions?"

## Key Implementation Details

### Chunking Strategy

Documents are split by paragraph boundaries (double newlines) and accumulated until reaching the chunk size limit (default: 1800 characters). This preserves semantic units while keeping chunks small enough for focused analysis.

```typescript
type Chunk = {
  id: string;       // "doc-1-chunk-3"
  docId: string;    // Parent document ID
  index: number;    // Order in document
  text: string;     // Chunk content
  start: number;    // Character offset
  end: number;      // Character offset
};
```

### Sub-Model Output Schema

Each sub-call returns structured JSON:

```json
{
  "relevant": true,
  "summary": "This section establishes a 30-day cure period for material breaches...",
  "citations": ["doc-1-chunk-7"]
}
```

The sub-model is instructed to:
- Only use facts from the provided snippet
- Never speculate beyond what's in the text
- Always include the chunk ID in citations
- Return `relevant: false` if the snippet doesn't address the question

### Knowledge Graph Schema (RLM + Graph Mode)

In RLM + Graph mode, each sub-call extracts both findings and structured entities/relationships:

```json
{
  "relevant": true,
  "summary": "This section establishes obligations for Party A...",
  "citations": ["doc-1-chunk-7"],
  "entities": [
    {
      "type": "party",
      "name": "Party A",
      "properties": { "role": "buyer" },
      "confidence": 0.95
    },
    {
      "type": "obligation",
      "name": "Payment within 30 days",
      "properties": { "deadline": "30 days" },
      "confidence": 0.9
    }
  ],
  "relationships": [
    {
      "type": "has_obligation",
      "sourceName": "Party A",
      "targetName": "Payment within 30 days",
      "properties": {},
      "confidence": 0.9
    }
  ]
}
```

After all sub-calls complete, the system:
1. **Merges entities** across chunks using fuzzy name matching (e.g., "Party A" and "party a" are merged)
2. **Builds a unified graph** with deduplicated nodes and edges
3. **Generates a graph summary** showing entity counts by type and key relationships
4. **Passes the graph summary to the root model** along with the findings for graph-aware aggregation

### Root Model Aggregation

The root model receives all relevant findings and must:
- Combine summaries into a coherent answer
- Preserve citations exactly as provided
- Explicitly state if findings are insufficient
- Structure the response with clear organization

In RLM + Graph mode, the root model also receives:
- **Graph summary**: Entity counts by type and key relationships
- This enables the model to answer relationship-based questions more accurately by understanding the document's semantic structure

### Parallel Processing

Sub-calls are processed in parallel batches (configurable concurrency, default: 6). This dramatically reduces total analysis time:

```
Sequential (24 chunks): ████████████████████████ ~48 seconds
Parallel (6 concurrent): ████████ ~8 seconds
```

### Citation Format

All answers include bracketed citations linking claims to source chunks:

> The agreement includes a 30-day cure period [doc-1-chunk-7] and automatic renewal provisions [doc-1-chunk-12] unless terminated with 90 days notice [doc-1-chunk-15].

## Configuration Options

| Parameter | Default | Applies To | Description |
|-----------|---------|------------|-------------|
| `chunkSize` | 1800 | Retrieval, RLM, RLM + Graph | Characters per chunk |
| `topK` | 8 | Retrieval | Chunks for retrieval mode |
| `maxSubcalls` | 24 | RLM, RLM + Graph | Maximum chunks to analyze in RLM modes |
| `concurrency` | 6 | RLM, RLM + Graph | Parallel sub-calls |

## Architecture

### Data Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │────▶│  /api/parse  │────▶│  Text Store  │
│  (Upload)    │     │ PDF/DOCX/TXT │     │              │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                  │
┌──────────────┐     ┌──────────────┐            │
│   Frontend   │────▶│ /api/analyze │◀───────────┘
│  (Analyze)   │     │   -stream    │
└──────────────┘     └──────┬───────┘
                            │
                     ┌──────▼───────┐
                     │  Orchestrator │
                     │  (analyze.ts) │
                     └──────┬───────┘
                            │
              ┌─────────────┼─────────────┬─────────────┐
              ▼             ▼             ▼             ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
        │   Base   │ │ Retrieval│ │   RLM    │ │RLM+Graph │
        │   Mode   │ │   Mode   │ │   Mode   │ │   Mode   │
        └──────────┘ └──────────┘ └────┬─────┘ └────┬─────┘
                                       │            │
                            ┌──────────┼────────────┤
                            ▼          ▼            ▼
                      ┌─────────┐┌─────────┐┌─────────┐
                      │Sub-call ││Sub-call ││Sub-call │
                      │ Batch 1 ││ Batch 2 ││ Batch N │
                      │         ││         ││ +Graph  │
                      └─────────┘└─────────┘└────┬────┘
                            │          │          │
                            └──────────┼──────────┘
                                       ▼
                              ┌──────────────┐
                              │ Graph Merge  │
                              │  (RLM+Graph) │
                              └──────┬───────┘
                                     ▼
                              ┌──────────────┐
                              │  Root Model  │
                              │  Aggregation │
                              │ (+Graph Sum) │
                              └──────────────┘
                                       │
                                       ▼
                              ┌──────────────┐
                              │   Rewrite    │
                              │  (optional)  │
                              └──────────────┘
```

### Project Structure

```
src/
├── app/
│   ├── page.tsx              # 3-step workflow UI (Documents → Configure → Results)
│   ├── globals.css           # Tailwind + custom glass morphism styles
│   └── api/
│       ├── analyze-stream/   # SSE streaming endpoint (primary)
│       ├── analyze/          # Synchronous endpoint
│       └── parse/            # File upload (PDF/DOCX/TXT → text)
├── components/
│   └── ui/                   # shadcn/ui components
├── lib/
│   ├── analyze.ts            # Core orchestration logic for all four modes
│   ├── chunking.ts           # Paragraph-based document chunking
│   ├── retrieval.ts          # BM25-style term frequency ranking
│   ├── graph.ts              # Knowledge graph construction and entity merging
│   ├── azure.ts              # Azure OpenAI client wrapper
│   ├── prompts.ts            # System prompts for sub/root models and extraction
│   └── types.ts              # TypeScript type definitions
```

### Key Modules

| Module | Purpose |
|--------|---------|
| `analyze.ts` | Orchestrates all four modes; state machine for INIT → CHUNK → SUBCALL → AGGREGATE → RESPOND |
| `chunking.ts` | Splits documents by paragraph, respects chunk size limits |
| `retrieval.ts` | Simple BM25-like scoring: tokenize → term frequency → rank |
| `graph.ts` | Builds knowledge graphs from entity extractions; merges entities using fuzzy name matching; supports entity types (party, date, amount, etc.) and relationship types (has_obligation, references, etc.) |
| `azure.ts` | Thin wrapper around Azure OpenAI client |
| `prompts.ts` | System prompts constraining sub-model, root-model, and entity extraction behavior |

## Getting Started

### Prerequisites

- Node.js 18+
- Azure OpenAI deployment (or modify `azure.ts` for OpenAI/Anthropic)

### Environment Variables

Create a `.env.local` file:

```bash
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_API_KEY=your-api-key
AZURE_OPENAI_DEPLOYMENT=gpt-4o              # Root model
AZURE_OPENAI_DEPLOYMENT_SUB=gpt-4o-mini     # Sub model (optional, defaults to gpt-5-nano)
AZURE_OPENAI_API_VERSION=2025-03-01-preview
```

### Installation

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Usage

1. **Documents**: Upload PDF, DOCX, or TXT files (or paste text)
2. **Configure**: Enter your question, select mode, adjust parameters
3. **Results**: Watch real-time progress in the terminal panel; review structured answer with citations

## Cost Considerations

RLM and RLM + Graph modes make multiple LLM calls. Cost scales with:

- Number of chunks processed (`maxSubcalls`)
- Root model aggregation complexity
- Optional rewrite pass
- **Graph mode only**: Entity extraction on each chunk (additional tokens in sub-call responses)

**Cost optimization strategies:**
- Use a smaller/cheaper model for sub-calls (e.g., `gpt-4o-mini`)
- Reduce `maxSubcalls` for exploratory questions
- Use Retrieval mode when you know the answer is localized
- Use standard RLM mode instead of RLM + Graph if you don't need relationship mapping

## Theoretical Background

This implementation is based on the MIT paper "Recursive Language Models" which demonstrates:

1. **RLMs scale to 10M+ tokens** while maintaining accuracy
2. **External environment is required** to break context limits—the full prompt never enters the model
3. **Recursive sub-calls are critical** for dense tasks where answers depend on most of the input
4. **Cost variance can be high**; budgets and controls are essential
5. **Base LLM can win on small inputs**; use a decision gate

### Task Density Spectrum

The paper evaluates tasks by "information density"—how much of the input is needed to answer:

| Task Type | Density | Example | Best Approach |
|-----------|---------|---------|---------------|
| Needle-in-haystack | Sparse | "Find the API key" | Retrieval |
| Multi-hop QA | Medium | "Compare sections 3 and 7" | RLM |
| Aggregate all | Dense | "List every obligation" | RLM |
| Pairwise | Quadratic | "Find contradictions" | RLM |

As density increases, base LLMs and RAG degrade faster than RLM.

## License

MIT
