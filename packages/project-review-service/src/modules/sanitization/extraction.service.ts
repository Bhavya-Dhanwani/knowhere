import { ExtractedNeutralClaims } from './types.js';
import logger from '../../shared/config/logger.config.js';

export class ExtractionService {
  private static readonly DISALLOWED_WORDS_IN_CLAIMS = [
    'ignore',
    'disregard',
    'forget',
    'you are now',
    'system:',
    'assistant:',
    '100 points',
    'perfect score',
    'override'
  ];

  /**
   * Transforms untrusted raw submission text into a structured, neutral representation.
   * Extracts claimed features, endpoints, tech stack, and an objective summary.
   * Strips out imperatival sentences and command structures.
   */
  public static extractNeutralClaims(rawText: string): ExtractedNeutralClaims {
    if (!rawText || !rawText.trim()) {
      return {
        claimedFeatures: [],
        claimedEndpoints: [],
        techStackClaims: [],
        summary: 'No textual submission documentation provided.',
        secondarySafetyPassed: true
      };
    }

    const lines = rawText.split('\n');
    const claimedFeatures: string[] = [];
    const claimedEndpoints: string[] = [];
    const techStackClaims: string[] = [];

    // Common technology patterns
    const techKeywords = [
      'react',
      'next.js',
      'vue',
      'angular',
      'svelte',
      'node',
      'express',
      'nest',
      'fastify',
      'django',
      'fastapi',
      'flask',
      'spring',
      'go',
      'golang',
      'rust',
      'typescript',
      'javascript',
      'python',
      'mongodb',
      'postgresql',
      'postgres',
      'mysql',
      'redis',
      'sqlite',
      'docker',
      'kubernetes',
      'tailwind',
      'graphql',
      'rest api',
      'jwt'
    ];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Extract claimed endpoints (e.g., GET /api/v1/users, /api/auth)
      const endpointMatch = trimmed.match(
        /(?:GET|POST|PUT|DELETE|PATCH)?\s*(\/(?:api|v1|v2|auth|users|items|health)[\w\-/]*)/i
      );
      if (endpointMatch && endpointMatch[1]) {
        const ep = endpointMatch[1].toLowerCase();
        if (!claimedEndpoints.includes(ep) && claimedEndpoints.length < 30) {
          claimedEndpoints.push(ep);
        }
      }

      // Check tech stack mentions
      const lower = trimmed.toLowerCase();
      for (const tech of techKeywords) {
        if (
          lower.includes(tech) &&
          !techStackClaims.includes(tech) &&
          techStackClaims.length < 25
        ) {
          techStackClaims.push(tech);
        }
      }

      // Extract bullet points as claimed features
      if (/^[-*+]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
        const featureText = trimmed
          .replace(/^[-*+\d.]+\s+/, '')
          .replace(/[*_`]/g, '')
          .trim();

        // Ensure the bullet isn't an injection payload
        if (featureText.length > 5 && featureText.length < 150) {
          const isDirective = /^(please|you must|ignore|disregard|give|always)\b/i.test(
            featureText
          );
          if (!isDirective && claimedFeatures.length < 25) {
            claimedFeatures.push(featureText);
          }
        }
      }
    }

    // Generate neutral, passive summary
    const techSummary =
      techStackClaims.length > 0 ? `Technologies referenced: ${techStackClaims.join(', ')}.` : '';
    const endpointSummary =
      claimedEndpoints.length > 0 ? `Referenced endpoints: ${claimedEndpoints.join(', ')}.` : '';
    const featureCount = claimedFeatures.length;
    const summary =
      `Submission documents ${featureCount} claimed feature items. ${techSummary} ${endpointSummary}`.trim();

    // Secondary safety pass: Inspect extracted data for instruction leaks
    let secondarySafetyPassed = true;
    const combinedOutput =
      `${summary} ${claimedFeatures.join(' ')} ${claimedEndpoints.join(' ')}`.toLowerCase();

    for (const badWord of this.DISALLOWED_WORDS_IN_CLAIMS) {
      if (combinedOutput.includes(badWord)) {
        logger.warn(
          { badWord },
          'Secondary safety check caught suspicious phrase in extracted claims'
        );
        secondarySafetyPassed = false;
        break;
      }
    }

    return {
      claimedFeatures,
      claimedEndpoints,
      techStackClaims,
      summary,
      secondarySafetyPassed
    };
  }
}

export default ExtractionService;
