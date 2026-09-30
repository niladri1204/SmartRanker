# SmartRanker

> **AI-powered resume screening and candidate ranking.**

SmartRanker is a modern web application built to help hiring teams, recruiters, and engineering leads screen, evaluate, and rank candidate resumes against target job specifications with transparency and speed.

---

## Tech Stack (Phase 1 Foundation)

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **UI Library**: [React 19](https://react.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/) (Strict mode)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Package Manager**: [pnpm](https://pnpm.io/)
- **Code Quality**: [ESLint](https://eslint.org/) & [Prettier](https://prettier.io/)

---

## Architectural Structure

The codebase is organized into cleanly decoupled layers:

```
src/
├── app/                  # Next.js App Router (pages, layout, global CSS)
├── components/           # Presentation layer
│   ├── common/           # Header, Footer, ErrorBoundary
│   ├── dashboard/        # JobDescriptionPanel, ResumeUploadZone, EmptyResultsState
│   └── ui/               # Reusable primitives (Button, Card, Badge)
├── config/               # Configuration boundary and app constants
│   ├── env.ts            # Typed environment variables validation
│   └── app.ts            # App metadata, limits, and supported formats
├── features/             # Business logic & workflow management
│   └── screening/        # Hooks, validators, state types, sample presets
├── lib/                  # Utilities and domain error classes
│   ├── errors.ts         # Domain error hierarchy
│   └── utils.ts          # Formatting and Tailwind class merge helper
├── server/               # Server-only services & contracts
│   ├── documents/        # Document extraction interfaces & PDF parser stub
│   ├── intelligence/     # Candidate entity extractor interfaces & stubs
│   └── matching/         # Ranking engine interfaces & evaluation stub
└── types/                # Core domain TypeScript interfaces
    ├── domain.ts         # JobDescription, ResumeDocument, Candidate, RankingResult
    └── index.ts          # Public domain types export
```

---

## Core Domain Types

- `JobDescription`: Structured and raw job specification with required/preferred skills.
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
# Type checking
pnpm typecheck

# Linting
pnpm lint

# Code Formatting
pnpm format:check
```

---

## Phase 2 Roadmap (Intentionally Deferred)

- [ ] Production PDF/DOCX text extraction engine (`server/documents/pdf-parser.service.ts`)
- [ ] Candidate profile extraction & NER pipeline (`server/intelligence/candidate-extractor.service.ts`)
- [ ] Hybrid TF-IDF / Embedding semantic ranking engine (`server/matching/ranking-engine.service.ts`)
- [ ] Persistence layer / database abstraction for candidate history
- [ ] Interactive candidate score inspection modal with matched skill highlights
