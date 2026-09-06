import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IEvidence extends Document {
  submissionId: Types.ObjectId;
  eventId: Types.ObjectId;
  discovery: {
    languages: Record<string, number>;
    primaryLanguage: string;
    sbomPackageCount: number;
    topDependencies: string[];
    hasOpenApi: boolean;
    openApiEndpointsCount: number;
    openApiEndpoints: string[];
    detectedFrameworks: string[];
    fileList?: string[];
    keyFileSnippets?: Record<string, string>;
  };
  codeAnalysis: {
    semgrep: {
      tool: string;
      totalIssues: number;
      criticalCount: number;
      highCount: number;
      mediumCount: number;
      lowCount: number;
      findings: Array<{
        ruleId: string;
        message: string;
        path: string;
        line: number;
        severity: string;
      }>;
    };
    gitleaks: {
      tool: string;
      secretsFoundCount: number;
      leaks: Array<{
        rule: string;
        file: string;
        line: number;
        commit?: string;
      }>;
    };
    trivy: {
      tool: string;
      vulnerabilityCount: number;
      critical: number;
      high: number;
      medium: number;
      low: number;
      cves: Array<{
        cveId: string;
        package: string;
        severity: string;
        fixedIn?: string;
      }>;
    };
  };
  frontendEval?: {
    tool: string;
    lighthouse: {
      performance: number; // 0-100
      accessibility: number; // 0-100
      bestPractices: number; // 0-100
      seo: number; // 0-100
    };
    axeViolationsCount: number;
    consoleErrorsCount: number;
    failedRequestsCount: number;
  };
  backendEval?: {
    tool: string;
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
  };
  createdAt: Date;
  updatedAt: Date;
}

const EvidenceSchema = new Schema<IEvidence>(
  {
    submissionId: {
      type: Schema.Types.ObjectId,
      ref: 'ReviewSubmission',
      required: true,
      index: true
    },
    eventId: { type: Schema.Types.ObjectId, ref: 'ReviewEvent', required: true, index: true },
    discovery: {
      languages: { type: Schema.Types.Mixed, default: {} },
      primaryLanguage: { type: String, default: 'unknown' },
      sbomPackageCount: { type: Number, default: 0 },
      topDependencies: { type: [String], default: [] },
      hasOpenApi: { type: Boolean, default: false },
      openApiEndpointsCount: { type: Number, default: 0 },
      openApiEndpoints: { type: [String], default: [] },
      detectedFrameworks: { type: [String], default: [] },
      fileList: { type: [String], default: [] },
      keyFileSnippets: { type: Schema.Types.Mixed, default: {} }
    },
    codeAnalysis: {
      semgrep: {
        tool: { type: String, default: 'Semgrep' },
        totalIssues: { type: Number, default: 0 },
        criticalCount: { type: Number, default: 0 },
        highCount: { type: Number, default: 0 },
        mediumCount: { type: Number, default: 0 },
        lowCount: { type: Number, default: 0 },
        findings: { type: [Schema.Types.Mixed], default: [] }
      },
      gitleaks: {
        tool: { type: String, default: 'Gitleaks' },
        secretsFoundCount: { type: Number, default: 0 },
        leaks: { type: [Schema.Types.Mixed], default: [] }
      },
      trivy: {
        tool: { type: String, default: 'Trivy' },
        vulnerabilityCount: { type: Number, default: 0 },
        critical: { type: Number, default: 0 },
        high: { type: Number, default: 0 },
        medium: { type: Number, default: 0 },
        low: { type: Number, default: 0 },
        cves: { type: [Schema.Types.Mixed], default: [] }
      }
    },
    frontendEval: {
      tool: { type: String, default: 'Playwright + Lighthouse + axe-core' },
      lighthouse: {
        performance: { type: Number, default: 0 },
        accessibility: { type: Number, default: 0 },
        bestPractices: { type: Number, default: 0 },
        seo: { type: Number, default: 0 }
      },
      axeViolationsCount: { type: Number, default: 0 },
      consoleErrorsCount: { type: Number, default: 0 },
      failedRequestsCount: { type: Number, default: 0 }
    },
    backendEval: {
      tool: { type: String, default: 'Schemathesis + OWASP ZAP + k6' },
      schemathesis: {
        totalTests: { type: Number, default: 0 },
        passed: { type: Number, default: 0 },
        failed: { type: Number, default: 0 },
        flaky: { type: Number, default: 0 },
        endpointsTested: { type: Number, default: 0 },
        failures: { type: [Schema.Types.Mixed], default: [] }
      },
      k6: {
        avgResponseTimeMs: { type: Number, default: 0 },
        p95ResponseTimeMs: { type: Number, default: 0 },
        requestsPerSec: { type: Number, default: 0 },
        errorRatePercent: { type: Number, default: 0 }
      },
      owaspZap: {
        totalAlerts: { type: Number, default: 0 },
        highRisk: { type: Number, default: 0 },
        mediumRisk: { type: Number, default: 0 },
        lowRisk: { type: Number, default: 0 },
        informational: { type: Number, default: 0 }
      }
    }
  },
  { timestamps: true }
);

export const Evidence = mongoose.model<IEvidence>('Evidence', EvidenceSchema);
export default Evidence;
