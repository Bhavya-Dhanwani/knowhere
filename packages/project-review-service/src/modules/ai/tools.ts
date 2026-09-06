import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { Evidence } from '../../models/Evidence.model.js';
import { ReviewEvent } from '../../models/Event.model.js';
import { SanitizationAudit } from '../../models/SanitizationAudit.model.js';
import logger from '../../shared/config/logger.config.js';

/**
 * Zod schema for retrieving tool analysis evidence.
 */
export const RetrieveEvidenceSchema = z.object({
  submissionId: z.string().describe('The MongoDB ObjectId of the submission')
});

/**
 * LangChain Tool: Retrieves structured tool analysis evidence bundle.
 */
export const retrieveEvidenceTool = tool(
  async ({ submissionId }) => {
    logger.info({ submissionId }, 'LangChain Tool: retrieveEvidenceTool executed');
    const evidence = await Evidence.findOne({ submissionId }).lean();
    if (!evidence) {
      return JSON.stringify({ error: 'Evidence bundle not found for submission' });
    }

    return JSON.stringify({
      discovery: {
        primaryLanguage: evidence.discovery.primaryLanguage,
        sbomPackageCount: evidence.discovery.sbomPackageCount,
        openApiEndpoints: evidence.discovery.openApiEndpoints,
        detectedFrameworks: evidence.discovery.detectedFrameworks
      },
      codeAnalysis: {
        semgrep: {
          totalIssues: evidence.codeAnalysis.semgrep.totalIssues,
          criticalCount: evidence.codeAnalysis.semgrep.criticalCount,
          highCount: evidence.codeAnalysis.semgrep.highCount,
          mediumCount: evidence.codeAnalysis.semgrep.mediumCount,
          findings: evidence.codeAnalysis.semgrep.findings.slice(0, 10)
        },
        gitleaks: {
          secretsFoundCount: evidence.codeAnalysis.gitleaks.secretsFoundCount,
          leaks: evidence.codeAnalysis.gitleaks.leaks
        },
        trivy: {
          vulnerabilityCount: evidence.codeAnalysis.trivy.vulnerabilityCount,
          critical: evidence.codeAnalysis.trivy.critical,
          high: evidence.codeAnalysis.trivy.high,
          cves: evidence.codeAnalysis.trivy.cves.slice(0, 10)
        }
      },
      frontend: evidence.frontendEval?.lighthouse,
      backend: {
        schemathesis: evidence.backendEval?.schemathesis,
        k6: evidence.backendEval?.k6
      }
    });
  },
  {
    name: 'retrieve_tool_evidence',
    description:
      'Retrieves pre-computed static, security, frontend, and backend tool outputs (Semgrep, Gitleaks, Trivy, Lighthouse, Schemathesis) for a submission.',
    schema: RetrieveEvidenceSchema
  }
);

/**
 * Zod schema for fetching criteria and requirements.
 */
export const FetchCriteriaSchema = z.object({
  eventId: z.string().describe('The MongoDB ObjectId of the event')
});

/**
 * LangChain Tool: Fetches fixed rubric criteria and problem requirements.
 */
export const fetchCriteriaTool = tool(
  async ({ eventId }) => {
    logger.info({ eventId }, 'LangChain Tool: fetchCriteriaTool executed');
    const event = await ReviewEvent.findById(eventId).lean();
    if (!event) {
      return JSON.stringify({ error: 'Event not found' });
    }

    return JSON.stringify({
      name: event.name,
      problemStatement: event.problemStatement,
      criteria: event.criteria.map((c) => ({
        id: c.id,
        name: c.name,
        category: c.category,
        weight: c.weight,
        description: c.description
      })),
      requirements: event.requirements.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        mandatory: r.mandatory,
        targetEndpointOrFile: r.targetEndpointOrFile
      }))
    });
  },
  {
    name: 'fetch_criteria_and_requirements',
    description:
      'Fetches the fixed rubric criteria, scoring weights, and requirements for an event.',
    schema: FetchCriteriaSchema
  }
);

/**
 * Zod schema for reporting injection anomalies.
 */
export const FlagInjectionSchema = z.object({
  submissionId: z.string().describe('The submission ID being flagged'),
  patternDetected: z.string().describe('The injection pattern name or suspicious phrase'),
  suspiciousTextSnippet: z.string().describe('Snippet of the text attempting prompt injection'),
  reason: z.string().describe('Detailed explanation of why human review is required')
});

/**
 * LangChain Tool: Explicitly flags a submission for human review.
 */
export const flagInjectionAnomalyTool = tool(
  async ({ submissionId, patternDetected, suspiciousTextSnippet, reason }) => {
    logger.warn(
      { submissionId, patternDetected, reason },
      'LangChain Tool: flagInjectionAnomalyTool executed'
    );
    await SanitizationAudit.findOneAndUpdate(
      { submissionId },
      {
        $push: {
          injectionMarkersFound: {
            pattern: patternDetected,
            snippet: suspiciousTextSnippet,
            severity: 'CRITICAL',
            source: 'README',
            detectedAt: new Date()
          }
        },
        $set: {
          flaggedAnomaly: true,
          anomalyReason: reason,
          humanReviewRequired: true
        }
      },
      { upsert: true }
    );

    return JSON.stringify({
      status: 'FLAGGED',
      message: 'Submission marked for mandatory human review.'
    });
  },
  {
    name: 'flag_prompt_injection_anomaly',
    description:
      'Flags a submission for mandatory human review if prompt injection or override directives are encountered.',
    schema: FlagInjectionSchema
  }
);

export const evaluationTools = [retrieveEvidenceTool, fetchCriteriaTool, flagInjectionAnomalyTool];
