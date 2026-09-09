import { ProjectDeepDiscovery } from '../ai/discovery.agent.js';

export interface DiscoveryResult {
  languages: Record<string, number>;
  primaryLanguage: string;
  sbomPackageCount: number;
  topDependencies: string[];
  hasOpenApi: boolean;
  openApiEndpointsCount: number;
  openApiEndpoints: string[];
  detectedFrameworks: string[];
  rawReadme?: string;
  fileList?: string[];
  keyFileSnippets?: Record<string, string>;
  deepAnalysis?: ProjectDeepDiscovery;
  repoValid?: boolean;
  repoErrorMessage?: string;
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

export interface DeterministicStaticMetrics {
  linesOfCode: {
    totalLines: number;
    codeLines: number;
    commentLines: number;
    blankLines: number;
  };
  fileCount: number;
  moduleCount: number;
  cyclomaticComplexity: {
    averagePerFunction: number;
    maxComplexity: number;
    complexFunctionsCount: number;
    highComplexityFunctions: Array<{
      file: string;
      line: number;
      name: string;
      complexity: number;
    }>;
  };
  codeDuplication: {
    duplicatedBlockCount: number;
    estimatedDuplicationPercentage: number;
    duplicateInstances: Array<{
      fileA: string;
      lineA: number;
      fileB: string;
      lineB: number;
      lineCount: number;
    }>;
  };
  testMetrics: {
    hasTests: boolean;
    testFileCount: number;
    testCaseCount: number;
    testFrameworks: string[];
    assertionCount: number;
    testTypes: ('unit' | 'integration' | 'e2e')[];
  };
  typeSafety: {
    usesTypeScript: boolean;
    typeCoveragePercent: number;
    anyTypeCount: number;
    strictModeEnabled: boolean;
  };
  codeSmellsAndTechDebt: {
    todoCount: number;
    fixmeCount: number;
    hackCount: number;
    workaroundCount: number;
    largeFilesCount: number;
    largeFunctionsCount: number;
    deepNestingCount: number;
    markers: Array<{
      type: 'TODO' | 'FIXME' | 'HACK' | 'WORKAROUND';
      file: string;
      line: number;
      text: string;
    }>;
    largeEntities: Array<{
      type: 'FILE' | 'FUNCTION';
      name: string;
      file: string;
      line: number;
      lineCount: number;
    }>;
  };
  securityAndLint: {
    secretLeaksCount: number;
    criticalVulnsCount: number;
    highVulnsCount: number;
    mediumVulnsCount: number;
    syntaxIssuesCount: number;
    dangerousSinksCount: number;
  };
  observedFacts: Array<{
    dimension: string;
    fact: string;
    interpretation: string;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
    sourceFile: string;
    line?: number;
  }>;
}

export interface CodeAnalysisResult {
  semgrep: {
    tool: 'Semgrep';
    totalIssues: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    findings: SemgrepFinding[];
  };
  gitleaks: {
    tool: 'Gitleaks';
    secretsFoundCount: number;
    leaks: GitleaksSecret[];
  };
  trivy: {
    tool: 'Trivy';
    vulnerabilityCount: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    cves: TrivyVulnerability[];
  };
  deterministicMetrics?: DeterministicStaticMetrics;
}

export interface FrontendEvalResult {
  /** The tools actually used. Never imply a browser audit when one was not run. */
  tool: string;
  assessmentMode?: 'BROWSER' | 'HTTP_PROBE' | 'STATIC' | 'NOT_RUN';
  staticAuditScore?: number;
  isReachable?: boolean;
  httpStatus?: number;
  liveError?: string;
  lighthouse: {
    performance: number; // 0 - 100
    accessibility: number; // 0 - 100
    bestPractices: number; // 0 - 100
    seo: number; // 0 - 100
  };
  axeViolationsCount: number;
  consoleErrorsCount: number;
  failedRequestsCount: number;
}

export interface BackendEvalResult {
  /** The tools actually used. Never report fabricated Schemathesis/k6/ZAP output. */
  tool: string;
  assessmentMode?: 'OPENAPI_STATIC' | 'HTTP_PROBE' | 'NOT_RUN';
  assessmentNote?: string;
  schemathesis: {
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
