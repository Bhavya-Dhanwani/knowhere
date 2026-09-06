import { UntrustedInputSource, InjectionDetectionResult } from './types.js';

interface InjectionPattern {
  name: string;
  regex: RegExp;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export class InjectionDetectorService {
  private static readonly PATTERNS: InjectionPattern[] = [
    // CRITICAL: Explicit instruction disregard & role hijacking
    {
      name: 'IGNORE_INSTRUCTIONS',
      regex:
        /(ignore|disregard|forget|override)\s+(all\s+)?(previous|prior|above|former|system)\s+(instructions|directives|prompts|rules)/i,
      severity: 'CRITICAL'
    },
    {
      name: 'ROLE_HIJACKING',
      regex:
        /(you\s+are\s+now|act\s+as|pretend\s+to\s+be)\s+(a\s+)?(helpful\s+judge|generous\s+evaluator|system\s+administrator|DAN|unrestricted\s+AI)/i,
      severity: 'CRITICAL'
    },
    {
      name: 'SYSTEM_PROMPT_PREFIX',
      regex:
        /(system:\s*|assistant:\s*|human:\s*|<\|im_start\|>|<\|im_end\|>|\[SYSTEM\]|\[INST\])/i,
      severity: 'CRITICAL'
    },
    // HIGH: Score manipulation & grading injection
    {
      name: 'SCORE_OVERRIDE_CLAIM',
      regex:
        /(give\s+(this\s+project\s+)?(100|full\s+marks|perfect\s+score|grade\s*:\s*100|points\s*:\s*100|score\s*:\s*100))/i,
      severity: 'HIGH'
    },
    {
      name: 'MANDATORY_PERFECT_RATING',
      regex:
        /(must\s+receive\s+(maximum|100|top)\s+score|always\s+evaluate\s+as\s+(perfect|exceptional))/i,
      severity: 'HIGH'
    },
    // MEDIUM: Boundary escaping
    {
      name: 'BOUNDARY_ESCAPE_TAGS',
      regex:
        /(<\/untrusted_submission_data>|<untrusted_submission_data>|<!--\s*end\s+of\s+prompt\s*-->)/i,
      severity: 'MEDIUM'
    },
    {
      name: 'PROMPT_LEAK_INSPECTION',
      regex:
        /(repeat\s+the\s+prompt|show\s+me\s+your\s+instructions|print\s+system\s+prompt|what\s+is\s+your\s+original\s+prompt)/i,
      severity: 'MEDIUM'
    },
    // LOW: Suspicious instruction directives
    {
      name: 'SUSPICIOUS_DIRECTIVE',
      regex: /(important:\s*(do\s+not\s+penalize|skip\s+rubric|ignore\s+tests))/i,
      severity: 'LOW'
    }
  ];

  /**
   * Scans untrusted inputs for injection patterns and returns structured detection results.
   */
  public static scan(inputs: UntrustedInputSource[]): InjectionDetectionResult {
    const markers: InjectionDetectionResult['markers'] = [];
    let highestSeverity: InjectionDetectionResult['severity'] = 'NONE';

    const severityRanks: Record<InjectionDetectionResult['severity'], number> = {
      NONE: 0,
      LOW: 1,
      MEDIUM: 2,
      HIGH: 3,
      CRITICAL: 4
    };

    for (const item of inputs) {
      if (!item.content) continue;

      for (const pattern of this.PATTERNS) {
        const match = pattern.regex.exec(item.content);
        if (match) {
          const matchIndex = match.index;
          const snippetStart = Math.max(0, matchIndex - 30);
          const snippetEnd = Math.min(item.content.length, matchIndex + match[0].length + 30);
          const snippet = item.content.slice(snippetStart, snippetEnd).trim();

          markers.push({
            pattern: pattern.name,
            snippet,
            severity: pattern.severity,
            source: item.source
          });

          if (severityRanks[pattern.severity] > severityRanks[highestSeverity]) {
            highestSeverity = pattern.severity;
          }
        }
      }
    }

    const hasInjectionMarker = markers.length > 0;
    // Anomaly rule: Any CRITICAL or HIGH pattern triggers mandatory human review
    const flaggedForHumanReview =
      highestSeverity === 'CRITICAL' || highestSeverity === 'HIGH' || markers.length >= 3;

    let reason: string | undefined;
    if (flaggedForHumanReview) {
      reason = `Prompt injection indicators found: ${markers.map((m) => `${m.pattern} (${m.severity})`).join(', ')}`;
    }

    return {
      hasInjectionMarker,
      severity: highestSeverity,
      markers,
      flaggedForHumanReview,
      reason
    };
  }
}

export default InjectionDetectorService;
