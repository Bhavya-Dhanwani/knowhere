export type ProjectScope = 'FRONTEND' | 'BACKEND' | 'FULLSTACK' | 'CUSTOM';

export interface Criterion {
  id: string;
  name: string;
  category:
    | 'CODE_QUALITY'
    | 'SECURITY'
    | 'FRONTEND'
    | 'BACKEND_API'
    | 'UI_UX'
    | 'PERFORMANCE'
    | 'API_CONTRACT'
    | 'FUNCTIONAL'
    | 'REQUIREMENTS'
    | 'INNOVATION'
    | string;
  weight: number;
  description: string;
  minScore?: number;
  maxScore?: number;
}

export interface Requirement {
  id: string;
  title: string;
  description: string;
  mandatory: boolean;
  targetEndpointOrFile?: string;
}

export interface ReviewEvent {
  _id: string;
  name: string;
  description: string;
  problemStatement: string;
  projectType: ProjectScope;
  requiresLiveUrl?: boolean;
  requiresApiSpec?: boolean;
  status: 'DRAFT' | 'ACTIVE' | 'EVALUATION' | 'COMPLETED';
  criteria: Criterion[];
  requirements: Requirement[];
  strictScoring: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewSubmission {
  _id: string;
  eventId: string;
  teamName: string;
  teamId: string;
  author: {
    userId: string;
    name?: string;
    email?: string;
  };
  repositoryUrl: string;
  branch: string;
  commitHash?: string;
  liveSiteUrl?: string;
  apiSpecUrl?: string;
  rawReadmeText?: string;
  status:
    | 'SUBMITTED'
    | 'UPDATING'
    | 'QUEUED'
    | 'CLONING'
    | 'DISCOVERING'
    | 'SANITIZING'
    | 'STATIC_ANALYSIS'
    | 'BUILDING'
    | 'TESTING'
    | 'RUNTIME_ANALYSIS'
    | 'BROWSER_ANALYSIS'
    | 'EVIDENCE_COLLECTION'
    | 'AI_EVALUATION'
    | 'SCORING'
    | 'PAIRWISE_COMPARISON'
    | 'RANKING'
    | 'REVIEW_GENERATION'
    | 'VALIDATION'
    | 'REPORT_GENERATION'
    | 'EVALUATED'
    | 'PARTIAL'
    | 'FAILED'
    | 'FLAGGED_FOR_REVIEW';
  flaggedForHumanReview: boolean;
  flagReason?: string;
  currentWorkflowId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CriterionScoreResult {
  criterionId: string;
  name: string;
  rawScore: number;
  weightedScore: number;
  confidence: number;
  evidenceCitations: string[];
  justification: string;
}

export interface RequirementComplianceResult {
  requirementId: string;
  title: string;
  status: 'FULFILLED' | 'PARTIAL' | 'NOT_FULFILLED' | 'UNKNOWN';
  evidenceSummary: string;
}

export interface ReviewEvaluation {
  _id: string;
  submissionId: string;
  eventId: string;
  overallScore: number;
  overallConfidence: number;
  evidenceCoverage: number;
  evaluationStatus: 'COMPLETE' | 'PARTIAL';
  criterionScores: CriterionScoreResult[];
  requirementCompliance: RequirementComplianceResult[];
  synthesisSummary: string;
  review: {
    overview: string;
    strengths: string[];
    weaknesses: string[];
    suggestions: string[];
  };
  provenance: {
    engineVersion: string;
    evaluator: string;
    modelName?: string;
    promptVersion: string;
    criteriaConfigSha256: string;
    evidenceSha256: string;
  };
  judgeOverride?: {
    overridden: boolean;
    judgeId?: string;
    originalScore?: number;
    newScore?: number;
    reason?: string;
    overriddenAt?: string;
  };
}

export interface SanitizationAudit {
  _id: string;
  submissionId: string;
  eventId: string;
  delimitedContext: string;
  extractedClaims: {
    claimedFeatures: string[];
    claimedEndpoints: string[];
    techStackClaims: string[];
    summary: string;
  };
  injectionMarkersFound: Array<{
    pattern: string;
    snippet: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    source: string;
  }>;
  flaggedAnomaly: boolean;
  anomalyReason?: string;
  humanReviewRequired: boolean;
  sanitizationPassed: boolean;
}

export interface EvidenceBundle {
  schemaVersion?: number;
  repository?: {
    repositoryUrl: string;
    requestedBranch: string;
    commitSha: string;
    clonedAt: string;
    clone: ToolExecutionRecord;
  };
  discovery?: {
    execution: ToolExecutionRecord;
    languages: Record<string, number>;
    primaryLanguage: string;
    sbomPackageCount: number;
    openApiEndpoints: string[];
    detectedFrameworks: string[];
    manifest?: {
      totalFiles: number;
      relevantFiles: number;
      analyzedFiles: number;
      ignoredFiles: number;
      failedFiles: number;
      truncated: boolean;
    };
  };
  codeAnalysis?: {
    semgrep?: {
      execution: ToolExecutionRecord;
      totalIssues: number;
      criticalCount: number;
      highCount: number;
      mediumCount: number;
      findings: Array<{
        ruleId: string;
        message: string;
        path: string;
        line: number;
        severity: string;
      }>;
    };
    gitleaks?: {
      execution: ToolExecutionRecord;
      secretsFoundCount: number;
      leaks: Array<{ rule: string; file: string; line: number }>;
    };
    trivy?: {
      execution: ToolExecutionRecord;
      vulnerabilityCount: number;
      critical: number;
      high: number;
      cves: Array<{ cveId: string; package: string; severity: string }>;
    };
  };
  frontendEval?: {
    tool: string;
    execution: ToolExecutionRecord;
    lighthouse?: {
      performance: number;
      accessibility: number;
      bestPractices: number;
      seo: number;
    };
    axeViolationsCount?: number;
  };
  backendEval?: {
    tool: string;
    execution: ToolExecutionRecord;
    schemathesis?: {
      totalTests: number;
      passed: number;
      failed: number;
      endpointsTested: number;
      failures: Array<{
        endpoint: string;
        method: string;
        statusCode: number;
        failureType: string;
      }>;
    };
    k6?: {
      avgResponseTimeMs: number;
      p95ResponseTimeMs: number;
      requestsPerSec: number;
      errorRatePercent: number;
    };
  };
}

export interface ToolExecutionRecord {
  status: 'SUCCEEDED' | 'FAILED' | 'TIMED_OUT' | 'UNAVAILABLE' | 'NOT_APPLICABLE';
  attempted: boolean;
  tool: string;
  durationMs: number;
  observedAt: string;
  error?: string;
  stdoutSha256?: string;
  stderrSha256?: string;
}

export interface ReplayActivityTrace {
  activityId: string;
  activityName: string;
  status: 'COMPLETED' | 'FAILED' | 'SKIPPED';
  startedAt: string;
  completedAt: string;
  durationMs: number;
  inputSnapshot?: unknown;
  outputSnapshot?: unknown;
  error?: string;
}

export interface ReplayTrace {
  workflowId: string;
  submissionId: string;
  eventId: string;
  activities: ReplayActivityTrace[];
  executedBy: string;
  finalStatus: string;
  totalDurationMs: number;
}

export interface RelativeComparison {
  targetSubmissionId: string;
  targetTeamName: string;
  targetRank: number;
  scoreDifference: number; // yourScore - theirScore
  criteriaDeltas: Array<{
    criterionId: string;
    criterionName: string;
    yourScore: number;
    theirScore: number;
    delta: number;
    feedback: string;
  }>;
  summary: string;
}

export interface SelfImprovement {
  title: string;
  currentScore: number;
  potentialScore: number;
  gapPoints: number;
  recommendations: Array<{
    criterionId: string;
    criterionName: string;
    currentScore: number;
    gap: number;
    actionableSteps: string;
  }>;
  industryBestPractices: string[];
  summary: string;
}

export interface SelfStrengths {
  title: string;
  highlights: Array<{
    criterionId: string;
    criterionName: string;
    score: number;
    accomplishment: string;
  }>;
  summary: string;
}

export interface RelativeGrading {
  tier: 'S' | 'A' | 'B' | 'C' | 'D';
  tierLabel: string;
  percentile: number;
  cohortAverage: number;
  cohortMedian: number;
  cohortMin: number;
  cohortMax: number;
  scoreDeltaFromAverage: number;
  whyTheseMarks: string;
  criteriaRelativeMarks: Array<{
    criterionId: string;
    criterionName: string;
    yourScore: number;
    cohortAverage: number;
    deltaFromAverage: number;
    relativeStanding: 'TOP_TIER' | 'ABOVE_AVERAGE' | 'AVERAGE' | 'BELOW_AVERAGE';
    whyThisMark: string;
  }>;
}

export interface LeaderboardEntry {
  rank: number;
  submissionId: string;
  teamName: string;
  absoluteScore: number;
  latentSkillScore: number;
  winRate: number;
  confidenceInterval: [number, number];
  discrepancyAnomalyFlag: boolean;
  rankReason?: string;
  relativeGrading?: RelativeGrading;
  relativeAnalysis?: {
    comparedToAbove?: RelativeComparison | null;
    comparedToBelow?: RelativeComparison | null;
    selfImprovement?: SelfImprovement | null;
    selfStrengths?: SelfStrengths | null;
  };
}

export interface PairwiseMatch {
  subA: string;
  subB: string;
  winner: string;
  margin: number;
  rationale: string;
}

export interface EventRanking {
  eventId: string;
  algorithm: string;
  totalSubmissionsRanked: number;
  totalPairwiseMatches: number;
  leaderboard: LeaderboardEntry[];
  pairwiseMatrix: PairwiseMatch[];
  generatedAt: string;
}

/**
 * Dynamic criteria presets based on Project Scope
 */
export const CRITERIA_PRESETS: Record<ProjectScope, Criterion[]> = {
  FRONTEND: [
    {
      id: 'crit-fe-perf',
      name: 'Lighthouse Performance & SEO',
      category: 'FRONTEND',
      weight: 0.35,
      description: 'Calibrated Lighthouse 0-100 scores for Performance, SEO, Best Practices'
    },
    {
      id: 'crit-fe-a11y',
      name: 'Accessibility & Design',
      category: 'FRONTEND',
      weight: 0.25,
      description: 'axe-core a11y compliance, contrast, and responsive layout'
    },
    {
      id: 'crit-code',
      name: 'Code Quality & Component Architecture',
      category: 'CODE_QUALITY',
      weight: 0.2,
      description: 'Clean modular components, state management, and typing'
    },
    {
      id: 'crit-sec',
      name: 'Security & Secrets Scanning',
      category: 'SECURITY',
      weight: 0.2,
      description: 'Semgrep static analysis and Gitleaks secrets audit'
    }
  ],
  BACKEND: [
    {
      id: 'crit-be-api',
      name: 'API Reliability & Schemathesis',
      category: 'BACKEND_API',
      weight: 0.35,
      description: 'Property-based OpenAPI functional and negative test coverage'
    },
    {
      id: 'crit-be-load',
      name: 'Performance & Load Handling (k6)',
      category: 'BACKEND_API',
      weight: 0.25,
      description: 'Low p95 response times and high throughput under load'
    },
    {
      id: 'crit-sec',
      name: 'Security & Dependency Vulnerabilities',
      category: 'SECURITY',
      weight: 0.25,
      description: 'Semgrep SAST, OWASP ZAP DAST, and Trivy CVE scanning'
    },
    {
      id: 'crit-code',
      name: 'Code Architecture & Clean Code',
      category: 'CODE_QUALITY',
      weight: 0.15,
      description: 'Clean controllers, error handling, and robust schemas'
    }
  ],
  FULLSTACK: [
    {
      id: 'crit-code',
      name: 'Fullstack Architecture & Code Quality',
      category: 'CODE_QUALITY',
      weight: 0.25,
      description: 'End-to-end typing, separation of concerns, and clean structure'
    },
    {
      id: 'crit-sec',
      name: 'Security & CVEs',
      category: 'SECURITY',
      weight: 0.25,
      description: 'Semgrep SAST, Gitleaks secrets, and Trivy vulnerability audit'
    },
    {
      id: 'crit-fe',
      name: 'Frontend Performance & A11y',
      category: 'FRONTEND',
      weight: 0.25,
      description: 'Lighthouse 0-100 metrics and axe-core accessibility compliance'
    },
    {
      id: 'crit-be',
      name: 'API Reliability & Schemathesis',
      category: 'BACKEND_API',
      weight: 0.25,
      description: 'Automated OpenAPI negative and positive tests'
    }
  ],
  CUSTOM: [
    {
      id: 'crit-custom-1',
      name: 'Core Requirements',
      category: 'REQUIREMENTS',
      weight: 0.5,
      description: 'Compliance with problem statement requirements'
    },
    {
      id: 'crit-custom-2',
      name: 'Code & Security Standards',
      category: 'SECURITY',
      weight: 0.5,
      description: 'Static analysis and security checks'
    }
  ]
};
