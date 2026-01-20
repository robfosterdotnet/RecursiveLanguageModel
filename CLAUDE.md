# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server (Next.js hot reload)
npm run build    # Production build
npm run lint     # Run ESLint
```

## Environment Setup

Required environment variables:
```
AZURE_OPENAI_ENDPOINT
AZURE_OPENAI_API_KEY
AZURE_OPENAI_DEPLOYMENT        # Root model deployment name
AZURE_OPENAI_API_VERSION       # Default: 2025-03-01-preview
AZURE_OPENAI_DEPLOYMENT_SUB    # Optional: subcall model (default: gpt-5-nano)
```

## Architecture

This is a Next.js 16 document analysis application using hybrid Recursive Language Models (RLM) with Azure OpenAI.

### Three Analysis Modes

1. **Base**: Direct LLM on combined document text (truncated to 12K chars)
2. **Retrieval**: BM25-style ranking → Top-K chunks → LLM
3. **RLM (Recursive)**: Parallel chunk analysis via sub-calls → Root model aggregation → Answer rewrite

### Data Flow

```
Frontend → /api/analyze-stream (SSE) → Chunk/Rank → Azure OpenAI → Stream logs + result
```

### Key Modules

- `src/lib/analyze.ts` - Core analysis logic orchestrating all three modes
- `src/lib/azure.ts` - Azure OpenAI client wrapper
- `src/lib/chunking.ts` - Paragraph-based document chunking
- `src/lib/retrieval.ts` - BM25-like term frequency ranking
- `src/lib/prompts.ts` - System prompts for sub-calls and root aggregation
- `src/lib/types.ts` - TypeScript types for requests/responses

### API Routes

- `POST /api/parse` - File upload (PDF/DOCX/TXT → text), max 15MB
- `POST /api/analyze-stream` - Primary endpoint with SSE for real-time logs
- `POST /api/analyze` - Synchronous analysis for programmatic use

### Frontend

Single-page app with 3-step workflow (Documents → Configure → Results). Uses React 19 with local state, shadcn/ui components, and a terminal panel showing real-time analysis progress.

## Type Conventions

```typescript
type AnalyzeMode = "base" | "retrieval" | "rlm"
type DocumentInput = { id: string; text: string }
type AnalyzeOptions = { chunkSize?, topK?, maxSubcalls?, concurrency? }
type Chunk = { id, docId, index, text, start, end }
type SubFinding = { relevant, summary, citations[], chunkId, docId }
```

## Path Alias

`@/*` maps to `./src/*` (configured in tsconfig.json)
