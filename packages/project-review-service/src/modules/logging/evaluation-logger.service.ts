import fs from 'fs';
import path from 'path';
import logger from '../../shared/config/logger.config.js';

export interface StepLogEntry {
  stepIndex: number;
  stepName: string;
  status: 'STARTED' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  input: unknown;
  output?: unknown;
  error?: string;
  details?: Record<string, unknown>;
}

export class EvaluationLogger {
  private static baseDir: string = path.resolve(process.cwd(), 'eval_logs');

  /**
   * Configures the base directory for evaluation logs.
   */
  public static setBaseDirectory(dir: string): void {
    this.baseDir = dir;
  }

  /**
   * Gets the run-specific directory for a submission workflow.
   */
  public static getRunDirectory(submissionId: string, workflowId: string): string {
    const cleanSubId = submissionId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanWfId = workflowId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const dir = path.join(this.baseDir, cleanSubId, cleanWfId);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  /**
   * Initializes log tracking for an evaluation run.
   */
  public static initRun(
    submissionId: string,
    workflowId: string,
    metadata: {
      repoUrl: string;
      branch?: string;
      eventId: string;
      teamName?: string;
      liveSiteUrl?: string;
    }
  ): void {
    try {
      const dir = this.getRunDirectory(submissionId, workflowId);
      const initPayload = {
        workflowId,
        submissionId,
        startedAt: new Date().toISOString(),
        metadata
      };
      fs.writeFileSync(
        path.join(dir, '00_workflow_init.json'),
        JSON.stringify(initPayload, null, 2),
        'utf-8'
      );
      logger.info({ submissionId, workflowId, dir }, 'Evaluation run logging initialized');
    } catch (err) {
      logger.warn(
        { err, submissionId, workflowId },
        'Failed to initialize evaluation run directory'
      );
    }
  }

  /**
   * Logs a single workflow activity step with complete input and output snapshots.
   */
  public static logStep(
    submissionId: string,
    workflowId: string,
    stepIndex: number,
    stepName: string,
    input: unknown,
    output: unknown,
    options?: {
      status?: 'COMPLETED' | 'FAILED' | 'SKIPPED';
      durationMs?: number;
      error?: string;
      details?: Record<string, unknown>;
    }
  ): void {
    try {
      const dir = this.getRunDirectory(submissionId, workflowId);
      const prefix = String(stepIndex).padStart(2, '0');
      const cleanStepName = stepName.toLowerCase().replace(/[^a-z0-9]/g, '_');

      // 1. Write dedicated Step Input JSON
      fs.writeFileSync(
        path.join(dir, `${prefix}_${cleanStepName}_input.json`),
        JSON.stringify(input, null, 2),
        'utf-8'
      );

      // 2. Write dedicated Step Output JSON
      const outputPayload = {
        stepIndex,
        stepName,
        status: options?.status || 'COMPLETED',
        durationMs: options?.durationMs ?? 0,
        recordedAt: new Date().toISOString(),
        error: options?.error,
        details: options?.details,
        output
      };

      fs.writeFileSync(
        path.join(dir, `${prefix}_${cleanStepName}_output.json`),
        JSON.stringify(outputPayload, null, 2),
        'utf-8'
      );

      logger.info(
        { submissionId, workflowId, stepIndex, stepName, durationMs: options?.durationMs },
        `Persisted step log for ${stepName}`
      );
    } catch (err) {
      logger.warn({ err, stepName, submissionId }, 'Failed to write step execution log');
    }
  }

  /**
   * Finalizes the evaluation run with a comprehensive human-readable Markdown summary.
   */
  public static finalizeRunSummary(
    submissionId: string,
    workflowId: string,
    summary: {
      finalStatus: string;
      totalDurationMs: number;
      overallScore?: number;
      rank?: number;
      steps: Array<{
        name: string;
        durationMs: number;
        status: string;
        keyTakeaway?: string;
      }>;
    }
  ): void {
    try {
      const dir = this.getRunDirectory(submissionId, workflowId);
      const mdContent = [
        `# Evaluation Workflow Execution Trace`,
        ``,
        `- **Workflow ID**: \`${workflowId}\``,
        `- **Submission ID**: \`${submissionId}\``,
        `- **Final Status**: **${summary.finalStatus}**`,
        `- **Total Duration**: \`${summary.totalDurationMs} ms\` (~${(summary.totalDurationMs / 1000).toFixed(1)}s)`,
        summary.overallScore !== undefined
          ? `- **Overall Score**: **${summary.overallScore} / 100**`
          : '',
        summary.rank !== undefined ? `- **Assigned Rank**: **#${summary.rank}**` : '',
        `- **Completed At**: \`${new Date().toISOString()}\``,
        ``,
        `---`,
        ``,
        `## Step Execution Breakdown`,
        ``,
        `| Step | Activity Name | Duration | Status | Key Highlights |`,
        `| :---: | :--- | :---: | :---: | :--- |`,
        ...summary.steps.map(
          (s, idx) =>
            `| ${idx + 1} | \`${s.name}\` | \`${s.durationMs}ms\` | **${s.status}** | ${s.keyTakeaway || '-'} |`
        ),
        ``,
        `---`,
        `*Generated by Knowhere Project Review Engine. All step inputs and outputs are preserved in this directory.*`,
        ``
      ]
        .filter(Boolean)
        .join('\n');

      fs.writeFileSync(path.join(dir, 'execution_summary.md'), mdContent, 'utf-8');
      logger.info({ submissionId, workflowId }, 'Persisted execution_summary.md');
    } catch (err) {
      logger.warn({ err, submissionId, workflowId }, 'Failed to write final execution summary');
    }
  }
}

export default EvaluationLogger;
