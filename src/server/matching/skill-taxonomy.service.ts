/**
 * Server-only execution context.
 * Skill Taxonomy and Synonym Normalization Service.
 * Provides deterministic mapping of candidate and job skill aliases to canonical identifiers
 * with category classification, punctuation-aware lookup, and match explainability.
 */
import {
  CandidateSkill,
  CanonicalSkill,
  NormalizedSkill,
  SkillComparisonResult,
  SkillMatchResult,
} from "@/types";

/**
 * Curated initial technology taxonomy mapping common industry aliases
 * and equivalent spellings to canonical skill definitions.
 */
export const INITIAL_SKILL_TAXONOMY: readonly CanonicalSkill[] = [
  // Programming Languages
  {
    id: "javascript",
    name: "JavaScript",
    category: "programming-language",
    aliases: ["JavaScript", "JS", "Javascript", "Vanilla JS", "ECMAScript"],
  },
  {
    id: "typescript",
    name: "TypeScript",
    category: "programming-language",
    aliases: ["TypeScript", "TS", "Typescript"],
  },
  {
    id: "python",
    name: "Python",
    category: "programming-language",
    aliases: ["Python", "Python 3", "Python3", "Py"],
  },
  {
    id: "golang",
    name: "Go",
    category: "programming-language",
    aliases: ["Go", "Golang"],
  },
  {
    id: "cpp",
    name: "C++",
    category: "programming-language",
    aliases: ["C++", "Cpp"],
  },
  {
    id: "csharp",
    name: "C#",
    category: "programming-language",
    aliases: ["C#", "C Sharp", "CSharp"],
  },
  {
    id: "c",
    name: "C",
    category: "programming-language",
    aliases: ["C", "C Language"],
  },
  {
    id: "java",
    name: "Java",
    category: "programming-language",
    aliases: ["Java", "Core Java"],
  },
  {
    id: "ruby",
    name: "Ruby",
    category: "programming-language",
    aliases: ["Ruby"],
  },
  {
    id: "php",
    name: "PHP",
    category: "programming-language",
    aliases: ["PHP"],
  },
  {
    id: "rust",
    name: "Rust",
    category: "programming-language",
    aliases: ["Rust"],
  },

  // Frontend
  {
    id: "react",
    name: "React",
    category: "frontend",
    aliases: ["React", "React.js", "ReactJS", "React JS"],
  },
  {
    id: "vue",
    name: "Vue.js",
    category: "frontend",
    aliases: ["Vue", "Vue.js", "VueJS", "Vue JS"],
  },
  {
    id: "angular",
    name: "Angular",
    category: "frontend",
    aliases: ["Angular", "AngularJS", "Angular.js"],
  },
  {
    id: "nextjs",
    name: "Next.js",
    category: "frontend",
    aliases: ["Next.js", "NextJS", "Next JS", "Next"],
  },
  {
    id: "html",
    name: "HTML",
    category: "frontend",
    aliases: ["HTML", "HTML5"],
  },
  {
    id: "css",
    name: "CSS",
    category: "frontend",
    aliases: ["CSS", "CSS3"],
  },
  {
    id: "tailwind",
    name: "Tailwind CSS",
    category: "frontend",
    aliases: ["Tailwind", "TailwindCSS", "Tailwind CSS"],
  },

  // Backend
  {
    id: "node",
    name: "Node.js",
    category: "backend",
    aliases: ["Node", "Node.js", "NodeJS", "Node JS"],
  },
  {
    id: "dotnet",
    name: ".NET",
    category: "framework",
    aliases: [".NET", "DotNet", ".NET Core", "ASP.NET Core", "ASP.NET", "Dot Net"],
  },
  {
    id: "express",
    name: "Express.js",
    category: "backend",
    aliases: ["Express", "Express.js", "ExpressJS", "Express JS"],
  },
  {
    id: "django",
    name: "Django",
    category: "backend",
    aliases: ["Django"],
  },
  {
    id: "fastapi",
    name: "FastAPI",
    category: "backend",
    aliases: ["FastAPI", "Fast API"],
  },
  {
    id: "spring",
    name: "Spring Boot",
    category: "backend",
    aliases: ["Spring Boot", "Spring", "SpringBoot"],
  },

  // Databases
  {
    id: "postgresql",
    name: "PostgreSQL",
    category: "database",
    aliases: ["PostgreSQL", "Postgres", "PostgreSQL DB", "Postgres DB"],
  },
  {
    id: "mongodb",
    name: "MongoDB",
    category: "database",
    aliases: ["MongoDB", "Mongo", "Mongo DB"],
  },
  {
    id: "mysql",
    name: "MySQL",
    category: "database",
    aliases: ["MySQL", "My SQL"],
  },
  {
    id: "sql",
    name: "SQL",
    category: "database",
    aliases: ["SQL"],
  },
  {
    id: "redis",
    name: "Redis",
    category: "database",
    aliases: ["Redis"],
  },

  // Cloud Providers
  {
    id: "aws",
    name: "AWS",
    category: "cloud",
    aliases: ["AWS", "Amazon Web Services"],
  },
  {
    id: "gcp",
    name: "GCP",
    category: "cloud",
    aliases: ["GCP", "Google Cloud", "Google Cloud Platform"],
  },
  {
    id: "azure",
    name: "Azure",
    category: "cloud",
    aliases: ["Azure", "Microsoft Azure"],
  },

  // DevOps & Tools
  {
    id: "docker",
    name: "Docker",
    category: "devops",
    aliases: ["Docker"],
  },
  {
    id: "kubernetes",
    name: "Kubernetes",
    category: "devops",
    aliases: ["Kubernetes", "K8s"],
  },
  {
    id: "cicd",
    name: "CI/CD",
    category: "devops",
    aliases: [
      "CI/CD",
      "CI CD",
      "CI-CD",
      "Continuous Integration",
      "Continuous Delivery",
      "Continuous Integration / Continuous Delivery",
    ],
  },
  {
    id: "git",
    name: "Git",
    category: "devops",
    aliases: ["Git"],
  },
  {
    id: "linux",
    name: "Linux",
    category: "devops",
    aliases: ["Linux"],
  },

  // APIs & Architecture
  {
    id: "rest",
    name: "REST",
    category: "api",
    aliases: ["REST", "REST API", "REST APIs", "RESTful", "RESTful API", "RESTful APIs"],
  },
  {
    id: "graphql",
    name: "GraphQL",
    category: "api",
    aliases: ["GraphQL", "GQL"],
  },
];

/**
 * Normalizes a raw string token for exact lookup matching.
 * Preserves essential technical punctuation like +, #, ., / while trimming and lowercasing.
 */
export function canonicalizeToken(raw: string): string {
  if (!raw || typeof raw !== "string") {
    return "";
  }
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Generates common punctuation and spacing variants for an alias string.
 */
function getAliasLookupKeys(raw: string): string[] {
  const primary = canonicalizeToken(raw);
  if (!primary) return [];

  const keys = new Set<string>();
  keys.add(primary);

  // 1. JS suffix variations: "react.js" <-> "reactjs" <-> "react js"
  if (primary.endsWith(".js")) {
    keys.add(primary.replace(/\.js$/, "js"));
    keys.add(primary.replace(/\.js$/, " js"));
  } else if (primary.endsWith("js") && primary.length > 2 && !primary.endsWith(".js")) {
    keys.add(primary.slice(0, -2) + ".js");
    keys.add(primary.slice(0, -2) + " js");
  }

  // 2. Dash/slash variations: "ci/cd" <-> "ci cd" <-> "ci-cd"
  if (primary.includes("/") || primary.includes("-")) {
    keys.add(primary.replace(/[\/\-]/g, " "));
    keys.add(primary.replace(/[\/\-]/g, ""));
  }

  return Array.from(keys);
}

/**
 * In-memory index of canonical skills mapped by normalized alias tokens.
 */
class TaxonomyIndex {
  private readonly aliasMap = new Map<string, { skill: CanonicalSkill; matchedAlias: string }>();
  private readonly canonicalMap = new Map<string, CanonicalSkill>();

  constructor(taxonomy: readonly CanonicalSkill[]) {
    for (const skill of taxonomy) {
      this.canonicalMap.set(skill.id, skill);

      // Map canonical name
      for (const key of getAliasLookupKeys(skill.name)) {
        if (!this.aliasMap.has(key)) {
          this.aliasMap.set(key, { skill, matchedAlias: skill.name });
        }
      }

      // Map canonical id
      for (const key of getAliasLookupKeys(skill.id)) {
        if (!this.aliasMap.has(key)) {
          this.aliasMap.set(key, { skill, matchedAlias: skill.name });
        }
      }

      // Map all explicit aliases
      for (const alias of skill.aliases) {
        for (const key of getAliasLookupKeys(alias)) {
          if (!this.aliasMap.has(key)) {
            this.aliasMap.set(key, { skill, matchedAlias: alias });
          }
        }
      }
    }
  }

  public lookup(token: string): { skill: CanonicalSkill; matchedAlias: string } | undefined {
    const clean = canonicalizeToken(token);
    if (!clean) return undefined;

    // Direct match
    const direct = this.aliasMap.get(clean);
    if (direct) return direct;

    // Check generated variants
    const variants = getAliasLookupKeys(token);
    for (const v of variants) {
      const match = this.aliasMap.get(v);
      if (match) return match;
    }

    return undefined;
  }

  public getCanonical(id: string): CanonicalSkill | undefined {
    return this.canonicalMap.get(id);
  }

  public getAll(): readonly CanonicalSkill[] {
    return Array.from(this.canonicalMap.values());
  }
}

const GLOBAL_TAXONOMY_INDEX = new TaxonomyIndex(INITIAL_SKILL_TAXONOMY);

/**
 * Normalizes a single raw skill input against the taxonomy.
 * Returns a typed NormalizedSkill containing canonical ID, display name, and category.
 */
export function normalizeSkill(rawSkill: string): NormalizedSkill {
  if (!rawSkill || typeof rawSkill !== "string" || rawSkill.trim().length === 0) {
    return {
      raw: "",
      canonicalId: "",
      canonicalName: "",
      category: "general",
      isKnown: false,
    };
  }

  const clean = rawSkill.trim();
  const match = GLOBAL_TAXONOMY_INDEX.lookup(clean);

  if (match) {
    return {
      raw: clean,
      canonicalId: match.skill.id,
      canonicalName: match.skill.name,
      category: match.skill.category,
      isKnown: true,
      matchedAlias: match.matchedAlias,
    };
  }

  // Fallback for unknown technologies: deterministic lowercase token
  const fallbackId = canonicalizeToken(clean);
  return {
    raw: clean,
    canonicalId: fallbackId,
    canonicalName: clean,
    category: "general",
    isKnown: false,
  };
}

/**
 * Normalizes an array of skills, deduplicating equivalent canonical skills
 * while preserving first-seen ordering.
 */
export function normalizeSkills(
  skills: readonly (string | CandidateSkill)[]
): NormalizedSkill[] {
  if (!skills || !Array.isArray(skills) || skills.length === 0) {
    return [];
  }

  const seenCanonicalIds = new Set<string>();
  const normalizedList: NormalizedSkill[] = [];

  for (const item of skills) {
    const raw = typeof item === "string" ? item : item?.name;
    if (!raw || typeof raw !== "string" || raw.trim().length === 0) {
      continue;
    }

    const norm = normalizeSkill(raw);
    if (!norm.canonicalId) {
      continue;
    }

    if (!seenCanonicalIds.has(norm.canonicalId)) {
      seenCanonicalIds.add(norm.canonicalId);
      normalizedList.push(norm);
    }
  }

  return normalizedList;
}

/**
 * Resolves a raw skill or alias to its canonical display name, or null if unknown.
 */
export function resolveSkillAlias(skill: string): string | null {
  if (!skill || typeof skill !== "string" || skill.trim().length === 0) {
    return null;
  }
  const norm = normalizeSkill(skill);
  return norm.isKnown ? norm.canonicalName : null;
}

/**
 * Compares candidate skills against job requirements using canonical skill normalization.
 * Accurately recognizes aliases and produces detailed explainability records.
 */
export function compareSkills(
  candidateSkills: readonly (string | CandidateSkill)[],
  jobSkills: readonly string[]
): SkillComparisonResult {
  const normCandidates = normalizeSkills(candidateSkills);
  const candByCanonical = new Map<string, NormalizedSkill>();

  for (const c of normCandidates) {
    if (!candByCanonical.has(c.canonicalId)) {
      candByCanonical.set(c.canonicalId, c);
    }
  }

  const matches: SkillMatchResult[] = [];
  const matchedJobSkills: string[] = [];
  const missingJobSkills: string[] = [];
  const matchedCandidateSkillsSet = new Set<string>();

  for (const req of jobSkills ?? []) {
    if (!req || typeof req !== "string" || req.trim().length === 0) {
      continue;
    }

    const normJd = normalizeSkill(req);
    if (!normJd.canonicalId) {
      continue;
    }

    if (candByCanonical.has(normJd.canonicalId)) {
      const candSkill = candByCanonical.get(normJd.canonicalId)!;
      matchedJobSkills.push(req);
      matchedCandidateSkillsSet.add(candSkill.raw);

      const isExact =
        candSkill.raw.trim().toLowerCase() === req.trim().toLowerCase();

      matches.push({
        candidateSkill: candSkill.raw,
        jobSkill: req,
        canonicalId: normJd.canonicalId,
        canonicalName: normJd.canonicalName,
        isAliasMatch: !isExact,
      });
    } else {
      missingJobSkills.push(req);
    }
  }

  const matchedCandidateSkills = normCandidates
    .map((c) => c.raw)
    .filter((raw) => matchedCandidateSkillsSet.has(raw));

  const unmatchedCandidateSkills = normCandidates
    .map((c) => c.raw)
    .filter((raw) => !matchedCandidateSkillsSet.has(raw));

  const totalReq = (jobSkills ?? []).filter((r) => r && r.trim().length > 0).length;
  const matchRate = totalReq > 0 ? Math.round((matchedJobSkills.length / totalReq) * 1000) / 1000 : 1;
  const matchScore = totalReq > 0 ? Math.round((matchedJobSkills.length / totalReq) * 1000) / 10 : 100;

  return {
    matches,
    matchedJobSkills,
    missingJobSkills,
    matchedCandidateSkills,
    unmatchedCandidateSkills,
    matchRate,
    matchScore,
  };
}

/**
 * Service encapsulating skill taxonomy operations and alias resolution.
 */
export class SkillTaxonomyService {
  public normalize(skill: string): NormalizedSkill {
    return normalizeSkill(skill);
  }

  public normalizeBatch(skills: readonly (string | CandidateSkill)[]): NormalizedSkill[] {
    return normalizeSkills(skills);
  }

  public resolveAlias(skill: string): string | null {
    return resolveSkillAlias(skill);
  }

  public compareSkills(
    candidateSkills: readonly (string | CandidateSkill)[],
    jobSkills: readonly string[]
  ): SkillComparisonResult {
    return compareSkills(candidateSkills, jobSkills);
  }

  public getCanonicalSkill(canonicalId: string): CanonicalSkill | undefined {
    return GLOBAL_TAXONOMY_INDEX.getCanonical(canonicalId);
  }

  public getAllCanonicalSkills(): readonly CanonicalSkill[] {
    return GLOBAL_TAXONOMY_INDEX.getAll();
  }
}

export const skillTaxonomyService = new SkillTaxonomyService();