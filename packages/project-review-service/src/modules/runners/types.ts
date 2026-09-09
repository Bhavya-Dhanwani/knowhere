export type ToolExecutionStatus =
  'SUCCEEDED' | 'FAILED' | 'TIMED_OUT' | 'UNAVAILABLE' | 'NOT_APPLICABLE';

export interface ToolExecutionRecord {
  status: ToolExecutionStatus;
  attempted: boolean;
  tool: string;
  version?: string;
  exitCode?: number;
  durationMs: number;
  observedAt: string;
  error?: string;
  stdoutSha256?: string;
  stderrSha256?: string;
}

export interface RepositorySnapshot {
  repositoryUrl: string;
  requestedBranch: string;
  commitSha: string;
  localPath: string;
  workspacePath: string;
  clonedAt: string;
  clone: ToolExecutionRecord;
}

export type FileClassification =
  | 'SOURCE'
  | 'TEST'
  | 'CONFIGURATION'
  | 'DOCUMENTATION'
  | 'ASSET'
  | 'GENERATED'
  | 'BINARY'
  | 'IGNORED';

export interface RepositoryFileRecord {
  path: string;
  sizeBytes: number;
  classification: FileClassification;
  language?: string;
  ignoredReason?: string;
  sha256?: string;
}

export interface RepositoryManifest {
  totalFiles: number;
  relevantFiles: number;
  analyzedFiles: number;
  ignoredFiles: number;
  failedFiles: number;
  binaryFiles: number;
  generatedFiles: number;
  totalBytes: number;
  truncated: boolean;
  truncationReason?: string;
  files: RepositoryFileRecord[];
}

export interface DiscoveryResult {
  execution: ToolExecutionRecord;
  languages: Record<string, number>;
  primaryLanguage: string;
  sbomPackageCount: number;
  topDependencies: string[];
  hasOpenApi: boolean;
  openApiEndpointsCount: number;
  openApiEndpoints: string[];
  detectedFrameworks: string[];
  detectedPackageManagers: string[];
  detectedBuildSystems: string[];
  detectedTestFrameworks: string[];
  detectedDatabases: string[];
  rawReadme?: string;
  fileList: string[];
  keyFileSnippets: Record<string, string>;
  manifest: RepositoryManifest;
}

export interface SemgrepFinding {
  ruleId: string;
  message: string;
  path: string;
  line: number;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface GitleaksSecret {
  rule: string;
  file: string;
  line: number;
  commit?: string;
}

export interface TrivyVulnerability {
  cveId: string;
  package: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  fixedIn?: string;
}

export interface CodeAnalysisResult {
  semgrep: {
    tool: 'Semgrep';
    execution: ToolExecutionRecord;
    totalIssues: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    findings: SemgrepFinding[];
  };
  gitleaks: {
    tool: 'Gitleaks';
    execution: ToolExecutionRecord;
    secretsFoundCount: number;
    leaks: GitleaksSecret[];
  };
  trivy: {
    tool: 'Trivy';
    execution: ToolExecutionRecord;
    vulnerabilityCount: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    cves: TrivyVulnerability[];
  };
}

export interface BuildTestEvalResult {
  tool: 'isolated-build-test-runtime';
  execution: ToolExecutionRecord;
  build?: {
    execution: ToolExecutionRecord;
    command: string[];
    artifactRefs?: string[];
  };
  tests?: {
    execution: ToolExecutionRecord;
    command: string[];
    total?: number;
    passed?: number;
    failed?: number;
    skipped?: number;
    coveragePercent?: number;
    reportArtifactRef?: string;
  };
  runtime?: {
    execution: ToolExecutionRecord;
    healthChecksPassed?: number;
    healthChecksFailed?: number;
    logsArtifactRef?: string;
  };
}

export interface FrontendEvalResult {
  tool: 'Playwright + Lighthouse + axe-core';
  execution: ToolExecutionRecord;
  lighthouse?: {
    performance: number;
    accessibility: number;
    bestPractices: number;
    seo: number;
  };
  axeViolationsCount?: number;
  consoleErrorsCount?: number;
  failedRequestsCount?: number;
  journeysExecuted?: number;
  screenshots?: string[];
  traceArtifact?: string;
}

export interface BackendEvalResult {
  tool: 'Schemathesis';
  execution: ToolExecutionRecord;
  schemathesis?: {
    totalTests: number;
    passed: number;
    failed: number;
    flaky: number;
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
  owaspZap?: {
    totalAlerts: number;
    highRisk: number;
    mediumRisk: number;
    lowRisk: number;
    informational: number;
  };
}
