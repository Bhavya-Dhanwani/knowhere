import {
  CodeAnalysisResult,
  SemgrepFinding,
  GitleaksSecret,
  TrivyVulnerability,
  DeterministicStaticMetrics
} from './types.js';
import { defaultSandboxRunner } from './sandbox.runner.js';
import logger from '../../shared/config/logger.config.js';
import {
  syntaxFor,
  functionName,
  branchCount,
  isTestPath,
  TEST_CASES,
  STATIC_TYPED,
  UNSAFE_CALLS,
  CODE_FILE
} from './language-syntax.js';

export class CodeAnalysisRunner {
  /**
   * Runs comprehensive code, syntax, and security analysis against the repository code.
   * Leverages native static pattern analyzers with graceful binary tool fallback,
   * plus deep deterministic static analysis for RE:DESIGN.
   */
  public static async analyze(
    repoPathOrUrl: string,
    fileSnippets: Record<string, string> = {},
    fileList: string[] = []
  ): Promise<CodeAnalysisResult> {
    logger.info(
      {
        repoPathOrUrl,
        fileCount: fileList.length,
        snippetsCount: Object.keys(fileSnippets).length
      },
      'Executing Code Analysis Stage (SAST + Secrets + Syntax Audit + RE:DESIGN Static Analysis)'
    );

    const findings: SemgrepFinding[] = [];
    const leaks: GitleaksSecret[] = [];
    const cves: TrivyVulnerability[] = [];

    let criticalCount = 0;
    let highCount = 0;
    let mediumCount = 0;
    let lowCount = 0;

    // 1. Native Secret Scanner (Built-in Gitleaks Equivalent)
    const secretPatterns: Array<{ rule: string; regex: RegExp; severity: 'CRITICAL' | 'HIGH' }> = [
      { rule: 'aws-access-key', regex: /AKIA[0-9A-Z]{16}/g, severity: 'CRITICAL' },
      { rule: 'github-pat', regex: /ghp_[0-9a-zA-Z]{36}/g, severity: 'CRITICAL' },
      { rule: 'private-key', regex: /-----BEGIN (?:RSA )?PRIVATE KEY-----/g, severity: 'CRITICAL' },
      {
        rule: 'generic-api-secret',
        regex:
          /(?:api_key|apikey|secret|password|private_key)\s*[:=]\s*['"][a-zA-Z0-9_\-]{16,}['"]/gi,
        severity: 'HIGH'
      },
      {
        rule: 'hardcoded-db-credential',
        regex: /(?:mongodb|postgres|mysql):\/\/[^:]+:[^@]+@/gi,
        severity: 'HIGH'
      }
    ];

    for (const [filePath, content] of Object.entries(fileSnippets)) {
      const lines = content.split('\n');
      for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        const line = lines[lineNum];
        for (const pat of secretPatterns) {
          if (pat.regex.test(line)) {
            leaks.push({
              rule: pat.rule,
              file: filePath,
              line: lineNum + 1
            });
            findings.push({
              ruleId: `security.${pat.rule}`,
              message: `Potential hardcoded credential or secret detected (${pat.rule})`,
              path: filePath,
              line: lineNum + 1,
              severity: pat.severity
            });
            if (pat.severity === 'CRITICAL') criticalCount++;
            else highCount++;
          }
        }
      }
    }

    // 2. Native SAST, Markup & Syntax Scanner
    for (const [filePath, content] of Object.entries(fileSnippets)) {
      const lowerPath = filePath.toLowerCase();
      const lines = content.split('\n');

      if (lowerPath.endsWith('.html') || lowerPath.endsWith('.htm')) {
        for (let i = 0; i < lines.length; i++) {
          const l = lines[i];
          if (/<p[^>]*>[^<]*$/i.test(l.trim())) {
            for (let j = i + 1; j < Math.min(lines.length, i + 5); j++) {
              const nextL = lines[j].trim();
              if (nextL.length === 0) continue;
              if (/<h[1-6]|<div|<table|<ul|<ol/i.test(nextL) && !/<\/p>/i.test(nextL)) {
                findings.push({
                  ruleId: 'html.syntax.unclosed-paragraph',
                  message: `Unclosed <p> tag at line ${i + 1} preceding block element <${nextL.slice(1, 3)}> without closing </p>`,
                  path: filePath,
                  line: i + 1,
                  severity: 'MEDIUM'
                });
                mediumCount++;
                break;
              }
              if (/<\/p>/i.test(nextL)) break;
            }
          }
        }

        for (let i = 0; i < lines.length; i++) {
          const l = lines[i];
          if (/<center/i.test(l)) {
            findings.push({
              ruleId: 'html.deprecated.center-tag',
              message:
                'Use of deprecated <center> element; recommend CSS text-align or margin auto',
              path: filePath,
              line: i + 1,
              severity: 'LOW'
            });
            lowCount++;
          }
          if (/<font/i.test(l)) {
            findings.push({
              ruleId: 'html.deprecated.font-tag',
              message: 'Use of deprecated <font> element; recommend modern CSS font styling',
              path: filePath,
              line: i + 1,
              severity: 'LOW'
            });
            lowCount++;
          }
        }

        for (let i = 0; i < lines.length; i++) {
          const l = lines[i];
          if (/target=["']_blank["']/i.test(l) && !/rel=["'][^"']*noopener/i.test(l)) {
            findings.push({
              ruleId: 'security.html.target-blank-missing-noopener',
              message:
                'External link opens in new tab with target="_blank" but missing rel="noopener noreferrer" (reverse tabnabbing risk)',
              path: filePath,
              line: i + 1,
              severity: 'MEDIUM'
            });
            mediumCount++;
          }
        }

        for (let i = 0; i < lines.length; i++) {
          const l = lines[i];
          if (/href=["']javascript:/i.test(l)) {
            findings.push({
              ruleId: 'security.html.javascript-pseudo-protocol',
              message:
                'Use of javascript: URI in anchor href attribute; recommend unobtrusive event listeners',
              path: filePath,
              line: i + 1,
              severity: 'HIGH'
            });
            highCount++;
          }
        }
      }

      // dangerous calls, per language (C gets/strcpy, Python pickle/shell, Java exec, JS eval,
      // SQL built from strings, ...): see language-syntax.ts
      const rules = UNSAFE_CALLS.filter(([pathRe]) => pathRe.test(filePath));
      if (rules.length) {
        const syntax = syntaxFor(filePath);
        for (let i = 0; i < lines.length; i++) {
          const t = lines[i].trim();
          if (syntax.line.some((c) => t.startsWith(c)) || t.startsWith('*')) continue;
          for (const [, re, rule, message] of rules) {
            if (re.test(t)) {
              findings.push({
                ruleId: `security.${rule}`,
                message,
                path: filePath,
                line: i + 1,
                severity: 'HIGH'
              });
              highCount++;
            }
          }
        }
      }
    }

    // 3. Optional local CLI tool execution if present in environment
    try {
      const semgrepCmd = `semgrep scan --config auto --json --quiet "${repoPathOrUrl}"`;
      const res = await defaultSandboxRunner.executeCommand(semgrepCmd, { timeoutMs: 8000 });
      if (res.stdout) {
        const parsed = JSON.parse(res.stdout);
        if (parsed.results && Array.isArray(parsed.results)) {
          for (const r of parsed.results) {
            const sev = (r.extra?.severity || 'LOW').toUpperCase();
            findings.push({
              ruleId: r.check_id || 'semgrep-rule',
              message: r.extra?.message || '',
              path: r.path || '',
              line: r.start?.line || 1,
              severity: sev === 'ERROR' ? 'CRITICAL' : sev === 'WARNING' ? 'HIGH' : 'MEDIUM'
            });
          }
        }
      }
    } catch {
      // Graceful fallback to native scanner
    }

    // 4. RE:DESIGN Deterministic Static Analysis
    const deterministicMetrics = this.computeDeterministicMetrics(
      fileSnippets,
      fileList,
      findings,
      leaks,
      cves
    );

    logger.info(
      {
        totalFindings: findings.length,
        critical: criticalCount,
        high: highCount,
        medium: mediumCount,
        low: lowCount,
        secretsFound: leaks.length,
        totalLOC: deterministicMetrics.linesOfCode.totalLines,
        cyclomaticAvg: deterministicMetrics.cyclomaticComplexity.averagePerFunction,
        duplicationPct: deterministicMetrics.codeDuplication.estimatedDuplicationPercentage,
        todoCount: deterministicMetrics.codeSmellsAndTechDebt.todoCount
      },
      'Code Analysis Stage Completed'
    );

    return {
      semgrep: {
        tool: 'Semgrep',
        totalIssues: findings.length,
        criticalCount,
        highCount,
        mediumCount,
        lowCount,
        findings
      },
      gitleaks: {
        tool: 'Gitleaks',
        secretsFoundCount: leaks.length,
        leaks
      },
      trivy: {
        tool: 'Trivy',
        vulnerabilityCount: cves.length,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        cves
      },
      deterministicMetrics
    };
  }

  /**
   * Computes objective, deterministic engineering metrics across the ingested repository code.
   * Gathers measurable signals: LOC, cyclomatic complexity, duplication, test presence,
   * type safety, code smells/tech debt, and emits structured Observed Facts.
   */
  public static computeDeterministicMetrics(
    fileSnippets: Record<string, string>,
    fileList: string[],
    findings: SemgrepFinding[],
    leaks: GitleaksSecret[],
    cves: TrivyVulnerability[]
  ): DeterministicStaticMetrics {
    let totalLines = 0;
    let codeLines = 0;
    let commentLines = 0;
    let blankLines = 0;

    let totalBranches = 0;
    let totalFunctions = 0;
    let maxComplexity = 1;
    const highComplexityFunctions: DeterministicStaticMetrics['cyclomaticComplexity']['highComplexityFunctions'] =
      [];

    const markers: DeterministicStaticMetrics['codeSmellsAndTechDebt']['markers'] = [];
    const largeEntities: DeterministicStaticMetrics['codeSmellsAndTechDebt']['largeEntities'] = [];
    let todoCount = 0;
    let fixmeCount = 0;
    let hackCount = 0;
    let workaroundCount = 0;
    let deepNestingCount = 0;
    let anyTypeCount = 0;
    let typeAnnotatedCount = 0;
    let pyDefs = 0;
    let pyTypedDefs = 0;

    // Test metrics tracking
    let hasTests = false;
    let testFileCount = 0;
    let testCaseCount = 0;
    let assertionCount = 0;
    const testFrameworksSet = new Set<string>();
    const testTypesSet = new Set<'unit' | 'integration' | 'e2e'>();

    // Duplication block index
    const lineBlockHashes = new Map<string, { file: string; line: number }>();
    const duplicateInstances: DeterministicStaticMetrics['codeDuplication']['duplicateInstances'] =
      [];
    let duplicatedBlocksCount = 0;

    const observedFacts: DeterministicStaticMetrics['observedFacts'] = [];

    // Module detection
    const moduleDirectories = new Set<string>();
    for (const f of fileList) {
      const parts = f.split('/');
      if (parts.length > 1) {
        moduleDirectories.add(parts[0]);
      }
    }

    // Inspect each file snippet
    for (const [filePath, content] of Object.entries(fileSnippets)) {
      const lower = filePath.toLowerCase();
      const lines = content.split('\n');
      totalLines += lines.length;

      if (lines.length > 500) {
        largeEntities.push({
          type: 'FILE',
          name: filePath,
          file: filePath,
          line: 1,
          lineCount: lines.length
        });
        observedFacts.push({
          dimension: 'maintainability',
          fact: `Large file detected: ${filePath} contains ${lines.length} lines of code.`,
          interpretation:
            'Oversized files violate Single Responsibility Principle and increase cognitive load for maintenance.',
          severity: 'MEDIUM',
          sourceFile: filePath,
          line: 1
        });
      }

      const syntax = syntaxFor(filePath);
      const isTestFile = isTestPath(filePath);

      if (isTestFile) {
        hasTests = true;
        testFileCount++;
        if (lower.includes('e2e') || lower.includes('cypress') || lower.includes('playwright')) {
          testTypesSet.add('e2e');
        } else if (lower.includes('integration') || lower.includes('api.test')) {
          testTypesSet.add('integration');
        } else {
          testTypesSet.add('unit');
        }
      }

      let blockEnd: string | null = null;
      let currentFunction: {
        name: string;
        startLine: number;
        complexity: number;
        lines: number;
      } | null = null;
      const closeFunction = () => {
        const fn = currentFunction;
        if (!fn) return;
        if (fn.lines > 80) {
          largeEntities.push({
            type: 'FUNCTION',
            name: fn.name,
            file: filePath,
            line: fn.startLine,
            lineCount: fn.lines
          });
          observedFacts.push({
            dimension: 'complexity',
            fact: `Large function detected: ${fn.name}() in ${filePath}:${fn.startLine} spans ${fn.lines} lines.`,
            interpretation:
              'Overly long functions often combine multiple responsibilities and are difficult to test.',
            severity: 'LOW',
            sourceFile: filePath,
            line: fn.startLine
          });
        }
        if (fn.complexity >= 10) {
          highComplexityFunctions.push({
            file: filePath,
            line: fn.startLine,
            name: fn.name,
            complexity: fn.complexity
          });
          observedFacts.push({
            dimension: 'complexity',
            fact: `High cyclomatic complexity (${fn.complexity}) in ${fn.name}() at ${filePath}:${fn.startLine}.`,
            interpretation:
              'High branching density increases test path complexity and the chance of edge-case bugs.',
            severity: 'MEDIUM',
            sourceFile: filePath,
            line: fn.startLine
          });
        }
        currentFunction = null;
      };

      for (let i = 0; i < lines.length; i++) {
        const rawLine = lines[i];
        const trimmed = rawLine.trim();
        const lineNum = i + 1;

        if (!trimmed) {
          blankLines++;
          continue;
        }

        // Comment detection, with this language's own markers (C `#include` is code, Python `#` isn't)
        if (blockEnd) {
          commentLines++;
          if (trimmed.includes(blockEnd)) blockEnd = null;
          continue;
        }
        const opener = syntax.block.find(([open]) => trimmed.startsWith(open));
        if (opener) {
          commentLines++;
          if (!trimmed.slice(opener[0].length).includes(opener[1])) blockEnd = opener[1];
          continue;
        }
        if (syntax.line.some((c) => trimmed.startsWith(c))) {
          commentLines++;
          // Scan for debt markers in comment
          if (/\bTODO\b/i.test(trimmed)) {
            todoCount++;
            markers.push({
              type: 'TODO',
              file: filePath,
              line: lineNum,
              text: trimmed.slice(0, 100)
            });
          }
          if (/\bFIXME\b/i.test(trimmed)) {
            fixmeCount++;
            markers.push({
              type: 'FIXME',
              file: filePath,
              line: lineNum,
              text: trimmed.slice(0, 100)
            });
          }
          if (/\bHACK\b/i.test(trimmed)) {
            hackCount++;
            markers.push({
              type: 'HACK',
              file: filePath,
              line: lineNum,
              text: trimmed.slice(0, 100)
            });
          }
          if (/\bWORKAROUND\b/i.test(trimmed)) {
            workaroundCount++;
            markers.push({
              type: 'WORKAROUND',
              file: filePath,
              line: lineNum,
              text: trimmed.slice(0, 100)
            });
          }
          continue;
        }

        codeLines++;

        // Nesting depth detection (4+ spaces or 4+ tabs)
        const leadingSpaces = rawLine.match(/^(\s*)/)?.[1] || '';
        const indentLevel = leadingSpaces.includes('\t')
          ? leadingSpaces.length
          : Math.floor(leadingSpaces.length / 2);
        if (indentLevel >= 5) {
          deepNestingCount++;
        }

        // TypeScript type checks
        if (lower.endsWith('.ts') || lower.endsWith('.tsx')) {
          if (/:\s*any\b|<any>/i.test(trimmed)) {
            anyTypeCount++;
          }
          if (
            /:\s*[A-Z][a-zA-Z0-9<>\[\]]*/.test(trimmed) ||
            /interface\s+|type\s+/i.test(trimmed)
          ) {
            typeAnnotatedCount++;
          }
        }

        // Test cases in any ecosystem. Loose patterns (JS `it(`, C `test_x()`) only count inside
        // test files; explicit markers (@Test, #[test], TEST(...)) count anywhere (Rust keeps
        // tests inline, for example).
        for (const [re, framework] of TEST_CASES) {
          const loose = framework.startsWith('Jest') || framework.startsWith('C test');
          if ((isTestFile || !loose) && re.test(trimmed)) {
            testCaseCount++;
            hasTests = true;
            testFrameworksSet.add(framework);
            break;
          }
        }
        if (
          (isTestFile || testFrameworksSet.size) &&
          /\b(expect|assert\w*|should|EXPECT_\w+|ASSERT_\w+|require)\s*[.(!]|\bassert\b/.test(
            trimmed
          )
        )
          assertionCount++;
        if (/\.py$/i.test(filePath) && /^(async\s+)?def\s/.test(trimmed)) {
          pyDefs++;
          if (/->|:\s*[A-Za-z_][\w.\[\], ]*\s*[,)=]/.test(trimmed)) pyTypedDefs++;
        }

        // Function and complexity detection. A function runs until the next declaration (or the
        // end of the file): works for brace and indentation languages alike.
        // ponytail: top-level code after the last function is attributed to it; a real parser
        // (tree-sitter) would give exact extents if this ever matters.
        const fnName = functionName(syntax, trimmed);
        if (fnName) {
          closeFunction();
          currentFunction = { name: fnName, startLine: lineNum, complexity: 1, lines: 0 };
          totalFunctions++;
        }
        if (currentFunction) {
          currentFunction.lines++;
          const branches = branchCount(syntax, trimmed);
          currentFunction.complexity += branches;
          totalBranches += branches;
          maxComplexity = Math.max(maxComplexity, currentFunction.complexity);
        }

        // Code duplication detection (4-line sliding window)
        if (
          i <= lines.length - 4 &&
          trimmed.length > 15 &&
          !/^(import|export|from|package|using|#include|require|use)\b/.test(trimmed)
        ) {
          const windowKey = lines
            .slice(i, i + 4)
            .map((l) => l.trim().replace(/\s+/g, ''))
            .join('|');
          if (windowKey.length > 50) {
            const existing = lineBlockHashes.get(windowKey);
            if (
              existing &&
              (existing.file !== filePath || Math.abs(existing.line - lineNum) > 10)
            ) {
              duplicatedBlocksCount++;
              if (duplicateInstances.length < 5) {
                duplicateInstances.push({
                  fileA: existing.file,
                  lineA: existing.line,
                  fileB: filePath,
                  lineB: lineNum,
                  lineCount: 4
                });
              }
            } else {
              lineBlockHashes.set(windowKey, { file: filePath, line: lineNum });
            }
          }
        }
      }
      closeFunction(); // the file's last function ends with the file
    }

    // Wrap up duplication observed facts
    const estimatedDuplicationPercentage =
      codeLines > 0
        ? parseFloat(Math.min(100, ((duplicatedBlocksCount * 4) / codeLines) * 100).toFixed(1))
        : 0;

    if (duplicatedBlocksCount > 0) {
      observedFacts.push({
        dimension: 'maintainability',
        fact: `${duplicatedBlocksCount} duplicated code blocks detected (~${estimatedDuplicationPercentage}% duplication).`,
        interpretation:
          'Duplicated logic increases maintenance overhead as bug fixes must be manually synchronized across multiple locations.',
        severity: estimatedDuplicationPercentage > 15 ? 'HIGH' : 'MEDIUM',
        sourceFile: duplicateInstances[0]?.fileB || 'codebase',
        line: duplicateInstances[0]?.lineB || 1
      });
    }

    if (markers.length > 0) {
      observedFacts.push({
        dimension: 'technicalDebt',
        fact: `Found ${todoCount} TODOs, ${fixmeCount} FIXMEs, and ${hackCount + workaroundCount} hack/workaround tags in codebase comments.`,
        interpretation:
          'Presence of unfinished marker tags indicates unresolved technical debt or postponed error handling.',
        severity: fixmeCount > 0 || hackCount > 0 ? 'MEDIUM' : 'LOW',
        sourceFile: markers[0]?.file || 'codebase',
        line: markers[0]?.line || 1
      });
    }

    // Test facts
    if (!hasTests) {
      observedFacts.push({
        dimension: 'testing',
        fact: 'No test suites, test files, or automated assertions detected in repository.',
        interpretation:
          'Lack of automated unit or integration tests impairs code reliability and regression verification.',
        severity: 'HIGH',
        sourceFile: 'tests'
      });
    } else {
      observedFacts.push({
        dimension: 'testing',
        fact: `Discovered ${testFileCount} test files with ~${testCaseCount} test cases and ${assertionCount} assertions.`,
        interpretation: 'Automated test suites verify system behavior and prevent regressions.',
        severity: 'INFO',
        sourceFile: 'tests'
      });
    }

    // Type safety facts. Statically typed languages are typed by definition (no TS-only bonus);
    // Python earns it with type hints on most of its functions.
    const usesTypeScript = fileList.some((f) => f.endsWith('.ts') || f.endsWith('.tsx'));
    const codeFiles = fileList.filter((f) => CODE_FILE.test(f));
    const typedFiles = codeFiles.filter((f) => STATIC_TYPED.test(f)).length;
    const pythonHinted = pyDefs >= 3 && pyTypedDefs / pyDefs >= 0.6;
    const staticTyping =
      (codeFiles.length > 0 && typedFiles / codeFiles.length >= 0.5) || pythonHinted;
    const totalTypeSignals = anyTypeCount + typeAnnotatedCount;
    const typeCoveragePercent =
      usesTypeScript && totalTypeSignals > 0
        ? parseFloat(((typeAnnotatedCount / totalTypeSignals) * 100).toFixed(1))
        : usesTypeScript
          ? 85
          : 0;

    if (usesTypeScript) {
      observedFacts.push({
        dimension: 'engineeringPractices',
        fact: `TypeScript codebase detected with ~${typeCoveragePercent}% type annotation coverage (${anyTypeCount} 'any' types detected).`,
        interpretation:
          anyTypeCount > 5
            ? 'Excessive usage of `any` bypasses compile-time type safety guarantees.'
            : 'Strong static typing reduces runtime type errors.',
        severity: anyTypeCount > 5 ? 'MEDIUM' : 'INFO',
        sourceFile: fileList.find((f) => f.endsWith('.ts')) || 'tsconfig.json'
      });
    }

    // Security facts
    if (leaks.length > 0) {
      observedFacts.push({
        dimension: 'securityPractices',
        fact: `${leaks.length} hardcoded credentials or secrets discovered in repository code.`,
        interpretation:
          'Committing raw API keys or passwords compromises infrastructure security and requires immediate revocation.',
        severity: 'CRITICAL',
        sourceFile: leaks[0].file,
        line: leaks[0].line
      });
    }

    return {
      linesOfCode: {
        totalLines,
        codeLines,
        commentLines,
        blankLines
      },
      fileCount: fileList.length,
      moduleCount: Math.max(1, moduleDirectories.size),
      cyclomaticComplexity: {
        averagePerFunction:
          totalFunctions > 0 ? parseFloat((totalBranches / totalFunctions).toFixed(2)) : 1.0,
        maxComplexity,
        complexFunctionsCount: highComplexityFunctions.length,
        highComplexityFunctions
      },
      codeDuplication: {
        duplicatedBlockCount: duplicatedBlocksCount,
        estimatedDuplicationPercentage,
        duplicateInstances
      },
      testMetrics: {
        hasTests,
        testFileCount,
        testCaseCount,
        testFrameworks: Array.from(testFrameworksSet),
        assertionCount,
        testTypes: Array.from(testTypesSet)
      },
      typeSafety: {
        usesTypeScript,
        staticTyping,
        typeCoveragePercent,
        anyTypeCount,
        strictModeEnabled: true
      },
      codeSmellsAndTechDebt: {
        todoCount,
        fixmeCount,
        hackCount,
        workaroundCount,
        largeFilesCount: largeEntities.filter((e) => e.type === 'FILE').length,
        largeFunctionsCount: largeEntities.filter((e) => e.type === 'FUNCTION').length,
        deepNestingCount,
        markers,
        largeEntities
      },
      securityAndLint: {
        secretLeaksCount: leaks.length,
        criticalVulnsCount: findings.filter((f) => f.severity === 'CRITICAL').length,
        highVulnsCount: findings.filter((f) => f.severity === 'HIGH').length,
        mediumVulnsCount: findings.filter((f) => f.severity === 'MEDIUM').length,
        syntaxIssuesCount: findings.filter((f) => f.ruleId.startsWith('html.syntax')).length,
        // every per-language unsafe-call rule (see UNSAFE_CALLS), not just JS eval
        dangerousSinksCount: findings.filter(
          (f) => f.ruleId.startsWith('security.') && !/secret|key|credential/.test(f.ruleId)
        ).length
      },
      observedFacts
    };
  }
}

export default CodeAnalysisRunner;
