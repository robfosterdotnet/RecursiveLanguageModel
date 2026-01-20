# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start development server (Next.js hot reload)
npm run build        # Production build
npm run lint         # Run ESLint
npm run test         # Run tests in watch mode
npm run test:run     # Run tests once
npm run test:coverage # Run tests with coverage report
```

## Environment Setup

Required environment variables (create `.env.local`):
```
AZURE_OPENAI_ENDPOINT
AZURE_OPENAI_API_KEY
AZURE_OPENAI_DEPLOYMENT        # Root model deployment name
AZURE_OPENAI_API_VERSION       # Default: 2025-03-01-preview
AZURE_OPENAI_DEPLOYMENT_SUB    # Optional: subcall model (default: gpt-5-nano)
```

## Architecture

Next.js 16 document analysis application implementing Recursive Language Models (RLM) with Azure OpenAI.

### Four Analysis Modes

| Mode | How it works | Parameters used |
|------|--------------|-----------------|
| **Base** | Direct LLM on combined text (truncated to 12K chars) | None |
| **Retrieval** | BM25-style ranking → Top-K chunks → LLM | `chunkSize`, `topK` |
| **RLM** | Parallel sub-calls per chunk → Root aggregation → Rewrite | `chunkSize`, `maxSubcalls` |
| **RLM + Graph** | RLM with entity/relationship extraction → Knowledge graph → Graph-aware aggregation | `chunkSize`, `maxSubcalls` |

### Data Flow

```
Frontend → /api/analyze-stream (SSE) → Chunk/Rank → Azure OpenAI → Stream logs + result
```

### Key Modules

- `src/lib/analysis/analyze.ts` - Core analysis orchestration for all four modes
- `src/lib/llm/azure.ts` - Azure OpenAI client wrapper
- `src/lib/analysis/chunking.ts` - Paragraph-based document chunking
- `src/lib/analysis/retrieval.ts` - BM25-like term frequency ranking
- `src/lib/analysis/graph.ts` - Knowledge graph construction and entity merging
- `src/lib/analysis/prompts.ts` - System prompts for sub-calls, root aggregation, and entity extraction
- `src/lib/analysis/types.ts` - TypeScript types for requests/responses
- `src/config/env.ts` - Environment validation and deployment selection

### API Routes

- `POST /api/parse` - File upload (PDF/DOCX/TXT → text), max 15MB
- `POST /api/analyze-stream` - Primary endpoint with SSE for real-time logs
- `POST /api/analyze` - Synchronous analysis for programmatic use

### Frontend

Single-page app with 3-step workflow (Documents → Configure → Results). Uses React 19, shadcn/ui components, and a terminal panel for real-time analysis progress.

## Type Conventions

```typescript
type AnalyzeMode = "base" | "retrieval" | "rlm" | "rlm-graph"
type DocumentInput = { id: string; text: string }
type AnalyzeOptions = { chunkSize?, topK?, maxSubcalls?, baseMaxChars? }
type Chunk = { id, docId, index, text, start, end }
type SubFinding = { relevant, summary, citations[], chunkId, docId }

// Knowledge Graph types (for rlm-graph mode)
type EntityType = "party" | "date" | "amount" | "clause" | "obligation" | "right" | "condition" | "document" | "section"
type RelationType = "has_obligation" | "has_right" | "references" | "depends_on" | "effective_on" | "expires_on" | "involves_amount" | "defined_in" | "related_to"
type GraphNode = { id, type: EntityType, name, properties, sourceChunks[], confidence }
type GraphEdge = { id, type: RelationType, source, target, properties, sourceChunk, confidence }
type KnowledgeGraph = { nodes: GraphNode[], edges: GraphEdge[], metadata }
```

## Testing

Tests use Vitest with React Testing Library. The test infrastructure includes:
- `src/test/setup.ts` - Global setup with MSW and environment stubs
- `src/test/mocks/` - MSW handlers and fixtures
- `src/test/utils/` - Custom render and SSE testing helpers

Mock the `openai` module using a class pattern to avoid hoisting issues:
```typescript
vi.mock("openai", () => ({
  AzureOpenAI: class { chat = { completions: { create: mockCreate } }; },
}));
```

## Path Alias

`@/*` maps to `./src/*` (configured in tsconfig.json)
