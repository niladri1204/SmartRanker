export interface SampleJobPreset {
  readonly title: string;
  readonly department: string;
  readonly text: string;
}

export const SAMPLE_JOB_PRESETS: readonly SampleJobPreset[] = [
  {
    title: "Senior Full Stack Engineer (React + Node.js)",
    department: "Engineering",
    text: `Job Title: Senior Full Stack Engineer
Department: Core Platform Engineering
Location: Remote / Hybrid

Role Overview:
We are looking for an experienced Senior Full Stack Engineer to architect, build, and scale our core web platform. You will lead technical design, mentor engineers, and ship critical user-facing features and backend microservices.

Key Responsibilities:
- Design and implement scalable web applications using React, TypeScript, Next.js, and Node.js.
- Build resilient REST and GraphQL APIs, integrating with PostgreSQL, Redis, and message queues.
- Champion frontend best practices: Core Web Vitals, responsive design, accessible components, and modular state management.
- Collaborate closely with product management, design, and DevOps teams in a high-velocity agile environment.
- Maintain comprehensive unit and end-to-end test coverage (Jest, Playwright, Vitest).

Required Qualifications:
- 5+ years of production experience in full stack software development.
- Strong proficiency in modern JavaScript/TypeScript, React 18+, Node.js, and CSS/Tailwind.
- Proven experience designing relational schemas, indexing, and query optimization in PostgreSQL.
- Solid understanding of distributed systems, cloud platforms (AWS/GCP), CI/CD pipelines, and Docker.
- Excellent communication skills and strong technical problem-solving ability.

Preferred Qualifications:
- Experience with AI API integrations (OpenAI, Anthropic, Gemini) and vector databases.
- Familiarity with Next.js App Router, server components, and edge runtimes.
- Experience leading architectural reviews or mentoring junior engineers.`,
  },
  {
    title: "Machine Learning Engineer (NLP & Search)",
    department: "AI & Data Intelligence",
    text: `Job Title: Machine Learning Engineer (NLP & Search)
Department: AI & Data Intelligence
Location: Remote

Role Overview:
We are seeking a Machine Learning Engineer passionate about Natural Language Processing, semantic search, and document intelligence. You will develop models that analyze structured and unstructured text, extract entities, and compute relevance scores.

Key Responsibilities:
- Build and evaluate NLP pipelines for text classification, entity extraction, and embedding generation.
- Implement vector search and hybrid retrieval systems (dense embeddings + sparse lexical search).
- Optimize model latency, throughput, and inference memory for production microservices.
- Design evaluation frameworks and benchmark ranking accuracy against ground-truth datasets.

Required Qualifications:
- 3+ years of experience building and deploying machine learning models in production.
- Deep proficiency in Python, PyTorch/TensorFlow, scikit-learn, and Hugging Face Transformers.
- Practical experience with dense retrieval, sentence-transformers, FAISS/Pinecone/pgvector.
- Familiarity with containerization (Docker, Kubernetes) and deploying inference APIs (FastAPI/Triton).

Preferred Qualifications:
- Experience with LLM fine-tuning, retrieval-augmented generation (RAG), and prompt evaluation.
- Degree in Computer Science, Data Science, or related quantitative field.`,
  },
];
