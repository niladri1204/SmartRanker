# SmartRanker

> **AI-powered resume screening and candidate ranking.**

SmartRanker is a modern web application built to help hiring teams, recruiters, and engineering leads screen, evaluate, and rank candidate resumes against target job specifications with transparency and speed.

---

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **UI Library**: [React 19](https://react.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/) (Strict mode)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Package Manager**: [pnpm](https://pnpm.io/)
- **Testing**: [Vitest](https://vitest.dev/)
- **Code Quality**: [ESLint](https://eslint.org/) & [Prettier](https://prettier.io/)
- **Document Processing**: `pdf-parse` (PDF) & `mammoth` (DOCX)

---

## Architectural Structure

The codebase is organized into cleanly decoupled layers:

```
src/
+-- app/                  # Next.js App Router (pages, layout, global CSS)
+-- components/           # Presentation layer
�   +-- common/           # Header, Footer, ErrorBoundary
�   +-- dashboard/        # JobDescriptionPanel, ResumeUploadZone, EmptyResultsState
�   +-- ui/               # Reusable primitives (Button, Card, Badge)
+-- config/               # Configuration boundary and app constants
�   +-- env.ts            # Typed environment variables validation
�   +-- app.ts            # App metadata, limits, and supported formats
+-- features/             # Business logic & workflow management
�   +-- screening/        # Hooks, validators, state types, sample presets
+-- lib/                  # Utilities and domain error classes
�   +-- errors.ts         # Domain error hierarchy
�   +-- utils.ts          # Formatting and Tailwind class merge helper
+-- server/               # Server-only services & contracts
�   +-- documents/        # Document extraction interfaces, utils, & parser stubs
�   �   +-- __tests__/    # Unit tests for document contracts and validation
�   �   +-- document-parser.interface.ts # IDocumentParser, DTOs
�   �   +-- document-utils.ts            # Pure format detection and sanitization
�   �   +-- pdf-parser.service.ts        # PDF parser service stub
�   �   +-- docx-parser.service.ts       # DOCX parser service stub
�   �   +-- document-parser.service.ts   # Composite dispatcher & registry
�   +-- intelligence/     # Candidate entity extractor interfaces & stubs
�   +-- matching/         # Ranking engine interfaces & evaluation stub
+-- types/                # Core domain TypeScript interfaces
    +-- domain.ts         # JobDescription, DocumentMetadataDTO, Candidate, RankingResult
    +-- index.ts          # Public domain types export
```

---

## Core Domain Types & DTOs

- `JobDescription`: Structured and raw job specification with required/preferred skills.
- `SupportedDocumentFormat`: `'pdf' | 'docx' | 'txt'` supported document ingestion formats.
- `DocumentMetadataDTO`: Ingested document metadata (fileName, mimeType, byteSize, format).
- `DocumentParseInput`: In-memory Buffer and validated metadata payload for parsing.
- `ParsedDocumentOutput`: Normalized extracted text, character count, page count, and non-fatal warnings.
- `ResumeDocument`: Uploaded document metadata and raw extracted text status.
- `Candidate`: Extracted candidate profile containing skills, experiences, and education.
- `CandidateSkill`: Individual skill with category and proficiency.
- `CandidateExperience`: Work history item with duration and role achievements.
- `CandidateEducation`: Educational institution, degree, and graduation.
- `RankingResult`: Multi-dimensional evaluation score with match breakdown and missing skills.

---

## Getting Started

### Prerequisites

- Node.js >= 18.x
- pnpm >= 9.x

### Installation

```bash
pnpm install
```

### Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Quality Verification

```bash
# Unit Testing
pnpm test

# Type checking
pnpm typecheck

# Linting
pnpm lint

# Code Formatting Check
pnpm format:check
```

---

## Roadmap

- [x] **Phase 1**: Project Foundation (Next.js, TypeScript, Tailwind CSS, UI & domain types)
- [x] **Phase 2.1**: Document Processing Foundation (contracts, DTOs, `pdf-parse` & `mammoth` dependencies, unit tests)
- [ ] **Phase 2.2**: Document Extraction Engine (implementing `pdf-parse` and `mammoth` extraction)
- [ ] **Phase 2.3**: Candidate Profile Extraction & NER Pipeline
- [ ] **Phase 2.4**: Semantic Matching & Ranking Engine
