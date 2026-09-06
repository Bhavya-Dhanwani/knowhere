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
}

export interface FrontendEvalResult {
  tool: 'Playwright + Lighthouse + axe-core';
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
  tool: 'Schemathesis + OWASP ZAP + k6';
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
