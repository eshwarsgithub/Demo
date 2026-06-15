# Training Assistant

An AI-powered Q&A tool that lets you upload your own documents and ask questions about them. Built with Next.js, Voyage AI embeddings, and OpenRouter (GPT-4o mini).

---

## What We Built

A **Retrieval-Augmented Generation (RAG)** application. You upload training materials (PDFs, Word docs, etc.), the app reads and indexes them, and then answers your questions based purely on that content — not from general AI knowledge.

Think of it as giving the AI a set of documents to study, then quizzing it on exactly those documents.

---

## How It Works — The Full Process

### 1. Document Upload

You drag and drop a file into the sidebar. The file is sent to `/api/upload`.

```
User drops file → POST /api/upload → server receives the file as FormData
```

### 2. Text Extraction (markitdown)

The server writes the file to a temp folder and runs it through **markitdown**, a Python library that converts any document format into clean plain text.

```
ai_overview.docx  →  markitdown  →  plain text string
```

Supported formats: `.pdf`, `.docx`, `.doc`, `.pptx`, `.ppt`, `.xlsx`, `.xls`, `.csv`, `.html`, `.txt`, `.md`, `.epub`

### 3. Chunking

The extracted text is split into overlapping chunks (~1800 characters each, with 150-character overlap). Overlapping ensures that if a key sentence falls near a chunk boundary, it still appears in full in at least one chunk.

```
"...long document text..."
         ↓
[ chunk 0 ][ chunk 1 ][ chunk 2 ]   ← each ~1800 chars, overlap of 150
```

Smart splitting: the chunker tries to break at paragraph boundaries first, then sentence boundaries, to avoid cutting mid-thought.

### 4. Embedding (Voyage AI)

Each chunk is sent to the **Voyage AI** API (`voyage-3` model) which converts the text into a **vector** — an array of numbers that represents the meaning of that chunk in mathematical space.

```
"AI stands for Artificial Intelligence..."
         ↓  Voyage AI  ↓
[ 0.023, -0.412, 0.887, ... ]   ← 1024-dimensional vector
```

Documents are embedded as `input_type: "document"` so Voyage can optimise them for retrieval.

### 5. Storage

The chunks and their vectors are saved to a local JSON file at `.data/store.json`. This file persists between server restarts.

```json
{
  "chunks": [
    {
      "id": "ai_overview.docx-0-1718000000000",
      "filename": "ai_overview.docx",
      "content": "AI stands for...",
      "embedding": [0.023, -0.412, ...],
      "chunkIndex": 0
    }
  ]
}
```

---

### 6. Asking a Question

When you type a question and hit Enter, it's sent to `/api/chat`.

### 7. Query Embedding

Your question is also converted into a vector using Voyage AI — but this time as `input_type: "query"`, which is optimised for matching against stored document vectors.

```
"What is AI?"  →  Voyage AI  →  [ 0.019, -0.408, 0.881, ... ]
```

### 8. Vector Search (Cosine Similarity)

The query vector is compared against every stored chunk vector using **cosine similarity** — a measure of how close two vectors are in meaning (0 = unrelated, 1 = identical meaning).

```
query vector  ·  chunk_0 vector  =  0.82  ✓  (high match)
query vector  ·  chunk_1 vector  =  0.31  (lower match)
query vector  ·  chunk_2 vector  =  0.76  ✓  (good match)
```

The top 5 chunks by similarity score are selected and passed to the LLM.

### 9. Augmented Prompt

The retrieved chunks are injected into the prompt as context, wrapped in `<training_materials>` tags so the model knows exactly where to look.

```
<training_materials>
--- Source: ai_overview.docx ---
AI stands for Artificial Intelligence...

--- Source: ai_overview.docx ---
Machine learning is a subset of AI...
</training_materials>

User question: What is AI?
```

### 10. LLM Response (OpenRouter → GPT-4o mini)

The augmented prompt is sent to **OpenRouter** which routes it to **GPT-4o mini** — a fast, cost-efficient model. The model responds based only on the provided training materials, not its general knowledge.

The response streams back token-by-token via **Server-Sent Events (SSE)** so you see the answer appear word-by-word in real time.

### 11. Sources Shown

Before the text streams, the API sends a `sources` event listing which document chunks were used and their similarity scores. These appear as badges under the response.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                      Browser (Next.js)                  │
│                                                         │
│   ┌──────────────┐          ┌───────────────────────┐   │
│   │  UploadZone  │          │    ChatInterface      │   │
│   │  (sidebar)   │          │  (streaming messages) │   │
│   └──────┬───────┘          └──────────┬────────────┘   │
│          │ POST /api/upload            │ POST /api/chat  │
└──────────┼─────────────────────────────┼────────────────┘
           │                             │
┌──────────▼─────────────────────────────▼────────────────┐
│                    Next.js API Routes                    │
│                                                         │
│   ┌──────────────────────┐   ┌────────────────────────┐ │
│   │   /api/upload        │   │      /api/chat         │ │
│   │                      │   │                        │ │
│   │  markitdown (Python) │   │  embedQuery (Voyage)   │ │
│   │  → chunkText         │   │  → searchChunks        │ │
│   │  → embedBatch        │   │  → build prompt        │ │
│   │  → saveStore         │   │  → OpenRouter stream   │ │
│   └──────────┬───────────┘   └──────────┬─────────────┘ │
└──────────────┼────────────────────────── │──────────────┘
               │                           │
       ┌───────▼───────┐           ┌───────▼───────┐
       │ .data/         │           │  Voyage AI    │
       │ store.json     │           │  (embeddings) │
       │ (local disk)   │           └───────────────┘
       └───────────────┘
                                    ┌───────────────┐
                                    │  OpenRouter   │
                                    │  GPT-4o mini  │
                                    └───────────────┘
```

---

## Project Structure

```
training-assistant/
│
├── app/
│   ├── page.tsx                  # Main page layout (sidebar + chat panel)
│   ├── layout.tsx                # Root HTML layout, fonts
│   ├── globals.css               # Tailwind base styles
│   └── api/
│       ├── upload/route.ts       # Upload endpoint — parse, chunk, embed, store
│       └── chat/route.ts         # Chat endpoint — search, prompt, stream
│
├── components/
│   ├── ChatInterface.tsx         # Message list + input box, SSE streaming
│   ├── MessageBubble.tsx         # Individual message display with sources
│   ├── UploadZone.tsx            # Drag-and-drop file uploader
│   └── ui/                       # shadcn/ui base components
│       ├── button.tsx
│       ├── card.tsx
│       ├── badge.tsx
│       ├── textarea.tsx
│       ├── scroll-area.tsx
│       └── separator.tsx
│
├── lib/
│   ├── rag.ts                    # chunkText() + ingestDocument()
│   ├── voyage.ts                 # embedQuery() + embedBatch() via Voyage AI API
│   ├── vector-store.ts           # loadStore(), saveStore(), searchChunks()
│   ├── document-parser.ts        # Calls markitdown via child_process
│   └── utils.ts                  # Tailwind class merge utility
│
├── .data/
│   └── store.json                # Local vector store (gitignored)
│
├── .env.local                    # API keys (gitignored)
├── ai_overview.docx              # Sample test document
└── package.json
```

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Framework | Next.js 14 (App Router) | Full-stack React with API routes built-in |
| Language | TypeScript | Type safety across frontend and backend |
| Styling | Tailwind CSS + shadcn/ui | Fast, consistent UI components |
| Document parsing | markitdown (Python) | Handles every common format in one tool |
| Embeddings | Voyage AI — `voyage-3` | High-quality retrieval-optimised embeddings |
| Vector search | Cosine similarity (in-memory) | Simple and fast for small document sets |
| Vector storage | Local JSON file (`.data/store.json`) | Zero infrastructure, persists between restarts |
| LLM | GPT-4o mini via OpenRouter | Cost-efficient, fast, strong reasoning |
| Streaming | Server-Sent Events (SSE) | Real-time token-by-token response display |

---

## Setup

### Prerequisites

- Node.js 18+
- Python 3.8+ with markitdown installed:

```bash
pip install markitdown
```

### 1. Install dependencies

```bash
cd training-assistant
npm install
```

### 2. Add API keys

Create `.env.local` in the project root:

```env
OPENROUTER_API_KEY=sk-or-v1-...    # from openrouter.ai
VOYAGE_API_KEY=pa-...               # from dash.voyageai.com
```

### 3. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Usage

1. **Upload a document** — drag and drop any PDF, Word, Excel, PPT, CSV, or HTML file into the left sidebar. You'll see it appear under "Indexed" with a chunk count.
2. **Ask a question** — type in the chat box and press Enter. The assistant answers based on the document content only.
3. **Multiple documents** — you can upload several files. All are searched on every query and the most relevant chunks are retrieved regardless of which file they came from.
4. **Re-uploading** — uploading a file with the same name replaces the old version automatically.

---

## Key Design Decisions

**Why local JSON instead of a vector database?**
For a demo with a handful of documents, a flat file is faster to set up and has zero external dependencies. A production version would swap `.data/store.json` for something like Pinecone, Supabase pgvector, or Qdrant.

**Why no similarity threshold?**
The original threshold of 0.35 was filtering out valid results. With a small document set, it's better to always pass the top-K chunks to the LLM and let the model decide whether the content answers the question.

**Why Voyage AI over OpenAI embeddings?**
Voyage's `voyage-3` model is purpose-built for retrieval and supports asymmetric search (separate `query` and `document` input types), which improves match quality compared to symmetric embedding models.

**Why OpenRouter instead of the Anthropic API directly?**
OpenRouter gives access to multiple models through a single API key, making it easy to switch models or compare costs without changing integration code.

---

## Data Flow Summary

```
Upload:  File → markitdown → chunks → Voyage (embed) → store.json
Query:   Question → Voyage (embed) → cosine search → top chunks
                 → build prompt → OpenRouter (GPT-4o mini) → stream to UI
```
