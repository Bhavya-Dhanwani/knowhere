import path from 'node:path';
import {
  CodeAnalysisResult,
  RepositorySnapshot,
  SemgrepFinding,
  ToolExecutionRecord,
  TrivyVulnerability
} from './types.js';
import { TrustedProcessRunner, unavailableExecution } from './trusted-process.runner.js';
import { RemoteRunnerClient } from './remote-runner.client.js';
import logger from '../../shared/config/logger.config.js';

const severity = (value: unknown): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' => {
  const normalized = String(value || 'LOW').toUpperCase();
  if (normalized === 'CRITICAL' || normalized === 'ERROR') return 'CRITICAL';
  if (normalized === 'HIGH' || normalized === 'WARNING') return 'HIGH';
  if (normalized === 'MEDIUM') return 'MEDIUM';
  return 'LOW';
};

const parsingFailure = (
  execution: ToolExecutionRecord,
  tool: string,
  error: unknown
): ToolExecutionRecord => ({
  ...execution,
  status: 'FAILED',
  error: `${tool} returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`
});

export class CodeAnalysisRunner {
  public static async analyze(repository: RepositorySnapshot): Promise<CodeAnalysisResult> {
    const absolutePath = path.resolve(repository.localPath);
    logger.info({ repositoryPath: absolutePath }, 'Executing static and dependency analysis');

    if (process.env.STATIC_ANALYSIS_RUNNER_URL) {
      const remote = await RemoteRunnerClient.invoke<CodeAnalysisResult>(
        'isolated-static-analysis',
        process.env.STATIC_ANALYSIS_RUNNER_URL,
        { repositoryUrl: repository.repositoryUrl, commitSha: repository.commitSha },
        Number(process.env.STATIC_ANALYSIS_TIMEOUT_MS || 15 * 60_000)
      );
      const payload = remote.payload;
      const consistent = Boolean(
        payload?.semgrep &&
        payload?.gitleaks &&
        payload?.trivy &&
        payload.semgrep.totalIssues === payload.semgrep.findings.length &&
        payload.semgrep.totalIssues ===
          payload.semgrep.criticalCount +
            payload.semgrep.highCount +
            payload.semgrep.mediumCount +
            payload.semgrep.lowCount &&
        payload.gitleaks.secretsFoundCount === payload.gitleaks.leaks.length &&
        payload.trivy.vulnerabilityCount === payload.trivy.cves.length &&
        payload.trivy.vulnerabilityCount ===
          payload.trivy.critical + payload.trivy.high + payload.trivy.medium + payload.trivy.low
      );
      if (
        remote.execution.status === 'SUCCEEDED' &&
        payload?.semgrep?.execution &&
        payload?.gitleaks?.execution &&
        payload?.trivy?.execution &&
        consistent
      ) {
        return payload;
      }
      return this.unavailableAll(remote.execution.error || 'Static-analysis runner failed');
    }

    if (process.env.ALLOW_LOCAL_TRUSTED_ANALYZERS !== 'true') {
      return this.unavailableAll(
        'STATIC_ANALYSIS_RUNNER_URL is not configured and local analyzer execution is disabled'
      );
    }

    const [semgrepRun, gitleaksRun, trivyRun] = await Promise.all([
      TrustedProcessRunner.run(
        'Semgrep',
        'semgrep',
        ['scan', '--config', 'auto', '--json', '--quiet', '--', absolutePath],
        { timeoutMs: 10 * 60_000 }
      ),
      TrustedProcessRunner.run(
        'Gitleaks',
        'gitleaks',
        [
          'detect',
          '--source',
          absolutePath,
          '--report-format',
          'json',
          '--report-path',
          '-',
          '--exit-code',
          '0',
          '--no-banner'
        ],
        { timeoutMs: 5 * 60_000 }
      ),
      TrustedProcessRunner.run(
        'Trivy',
        'trivy',
        [
          'fs',
          '--format',
          'json',
          '--scanners',
          'vuln,secret,misconfig',
          '--quiet',
          '--',
          absolutePath
        ],
        { timeoutMs: 10 * 60_000 }
      )
    ]);

    const semgrep: CodeAnalysisResult['semgrep'] = {
      tool: 'Semgrep',
      execution: semgrepRun.execution,
      totalIssues: 0,
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
      findings: []
    };
    if (semgrep.execution.status === 'SUCCEEDED') {
      try {
        const parsed = JSON.parse(semgrepRun.stdout) as { results?: Array<Record<string, any>> };
        semgrep.findings = (parsed.results || []).map((finding): SemgrepFinding => ({
          ruleId: String(finding.check_id || 'unknown-rule'),
          message: String(finding.extra?.message || ''),
          path: String(finding.path || ''),
          line: Number(finding.start?.line || 1),
          severity: severity(finding.extra?.severity)
        }));
        semgrep.totalIssues = semgrep.findings.length;
        for (const finding of semgrep.findings) {
          if (finding.severity === 'CRITICAL') semgrep.criticalCount++;
          else if (finding.severity === 'HIGH') semgrep.highCount++;
          else if (finding.severity === 'MEDIUM') semgrep.mediumCount++;
          else semgrep.lowCount++;
        }
      } catch (error) {
        semgrep.execution = parsingFailure(semgrep.execution, 'Semgrep', error);
      }
    }

    const gitleaks: CodeAnalysisResult['gitleaks'] = {
      tool: 'Gitleaks',
      execution: gitleaksRun.execution,
      secretsFoundCount: 0,
      leaks: []
    };
    if (gitleaks.execution.status === 'SUCCEEDED' && gitleaksRun.stdout.trim()) {
      try {
        const parsed = JSON.parse(gitleaksRun.stdout) as Array<Record<string, unknown>>;
        gitleaks.leaks = parsed.map((leak) => ({
          rule: String(leak.RuleID || leak.Description || 'unknown-secret'),
          file: String(leak.File || ''),
          line: Number(leak.StartLine || 1),
          commit: leak.Commit ? String(leak.Commit) : undefined
        }));
        gitleaks.secretsFoundCount = gitleaks.leaks.length;
      } catch (error) {
        gitleaks.execution = parsingFailure(gitleaks.execution, 'Gitleaks', error);
      }
    }

    const trivy: CodeAnalysisResult['trivy'] = {
      tool: 'Trivy',
      execution: trivyRun.execution,
      vulnerabilityCount: 0,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      cves: []
    };
    if (trivy.execution.status === 'SUCCEEDED') {
      try {
        const parsed = JSON.parse(trivyRun.stdout) as {
          Results?: Array<{ Vulnerabilities?: Array<Record<string, unknown>> }>;
        };
        const vulnerabilities = (parsed.Results || []).flatMap(
          (result) => result.Vulnerabilities || []
        );
        trivy.cves = vulnerabilities.map((item): TrivyVulnerability => ({
          cveId: String(item.VulnerabilityID || 'unknown-vulnerability'),
          package: String(item.PkgName || ''),
          severity: severity(item.Severity),
          fixedIn: item.FixedVersion ? String(item.FixedVersion) : undefined
        }));
        trivy.vulnerabilityCount = trivy.cves.length;
        for (const finding of trivy.cves) {
          if (finding.severity === 'CRITICAL') trivy.critical++;
          else if (finding.severity === 'HIGH') trivy.high++;
          else if (finding.severity === 'MEDIUM') trivy.medium++;
          else trivy.low++;
        }
      } catch (error) {
        trivy.execution = parsingFailure(trivy.execution, 'Trivy', error);
      }
    }

    return { semgrep, gitleaks, trivy };
  }

  private static unavailableAll(reason: string): CodeAnalysisResult {
    return {
      semgrep: {
        tool: 'Semgrep',
        execution: unavailableExecution('Semgrep', reason),
        totalIssues: 0,
        criticalCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
        findings: []
      },
      gitleaks: {
        tool: 'Gitleaks',
        execution: unavailableExecution('Gitleaks', reason),
        secretsFoundCount: 0,
        leaks: []
      },
      trivy: {
        tool: 'Trivy',
        execution: unavailableExecution('Trivy', reason),
        vulnerabilityCount: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        cves: []
      }
    };
  }
}

export default CodeAnalysisRunner;
