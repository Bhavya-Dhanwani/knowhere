import { jest } from '@jest/globals';
import { Types } from 'mongoose';
import { ExportService } from '../src/modules/export/export.service.js';
import { ReviewEvent } from '../src/models/Event.model.js';
import { ReviewSubmission } from '../src/models/Submission.model.js';
import { ReviewEvaluation } from '../src/models/Evaluation.model.js';
import { Evidence } from '../src/models/Evidence.model.js';
import { EventRanking } from '../src/models/Ranking.model.js';

describe('Comprehensive CSV & Notion Final Export Service', () => {
  const service = new ExportService();
  const eventId = new Types.ObjectId();
  const sub1Id = new Types.ObjectId();
  const sub2Id = new Types.ObjectId();

  const mockEvent = {
    _id: eventId,
    name: 'Hackathon Grand Final 2026',
    projectType: 'FULLSTACK'
  };

  const mockSubmissions = [
    {
      _id: sub1Id,
      eventId,
      teamName: 'CyberKnights',
      repositoryUrl: 'https://github.com/cyber/knights',
      status: 'EVALUATED'
    },
    {
      _id: sub2Id,
      eventId,
      teamName: 'CodeCraft',
      repositoryUrl: 'https://github.com/code/craft',
      status: 'EVALUATED'
    }
  ];

  const mockEvaluations = [
    {
      submissionId: sub1Id,
      eventId,
      overallScore: 89.5,
      objectiveScore: 88.0,
      qualitativeScore: 90.5,
      confidenceScore: 94,
      synthesisSummary:
        'A polished, responsive portfolio with clear structure and maintainable implementation.',
      dimensionScores: {
        architecture: { finalScore: 92, weight: 0.15, strengths: ['Clean hexagonal architecture'] },
        codeQuality: {
          score: 88,
          weight: 0.15,
          weaknesses: ['Minor magic strings in auth module']
        },
        maintainability: { score: 90, weight: 0.1 },
        testing: { score: 85, weight: 0.1 },
        reliability: { score: 91, weight: 0.1 },
        complexity: { score: 87, weight: 0.1 },
        engineeringPractices: { score: 89, weight: 0.1 },
        securityPractices: { score: 94, weight: 0.1 },
        technicalDebt: { score: 88, weight: 0.1 }
      },
      engineeringEvidence: [
        {
          dimension: 'Architecture',
          observedFact: 'Decoupled domain handlers',
          interpretation: 'High modularity',
          aiJudgment: 'Strong',
          scoreImpact: 4.5,
          sourceFiles: ['src/domain/handler.ts']
        },
        {
          dimension: 'Code Quality',
          observedFact: 'Duplicate validation logic',
          interpretation: 'Wasted maintenance effort',
          aiJudgment: 'Needs refactoring',
          scoreImpact: -2.0,
          sourceFiles: ['src/utils/validate.ts']
        }
      ],
      highestImpactImprovements: [
        'Consolidate validation logic in src/utils/validate.ts to gain +2.0 pts'
      ]
    },
    {
      submissionId: sub2Id,
      eventId,
      overallScore: 83.2,
      objectiveScore: 81.0,
      qualitativeScore: 84.6,
      confidenceScore: 91,
      dimensionScores: {
        architecture: { score: 82, weight: 0.15 },
        codeQuality: { score: 84, weight: 0.15 },
        maintainability: { score: 81, weight: 0.1 },
        testing: { score: 75, weight: 0.1 },
        reliability: { score: 85, weight: 0.1 },
        complexity: { score: 80, weight: 0.1 },
        engineeringPractices: { score: 83, weight: 0.1 },
        securityPractices: { score: 88, weight: 0.1 },
        technicalDebt: { score: 80, weight: 0.1 }
      }
    }
  ];

  const mockEvidence = [
    {
      submissionId: sub1Id,
      eventId,
      codeAnalysis: {
        semgrep: {
          findings: [
            {
              ruleId: 'ts.security.eval',
              message: 'Avoid dynamic code execution',
              path: 'src/eval.ts',
              line: 42,
              severity: 'WARNING'
            }
          ]
        },
        gitleaks: { leaks: [] },
        deterministicMetrics: {
          loc: { totalCodeLines: 3450, commentRatio: 0.18 },
          cyclomaticComplexity: { maxBranchingDensity: 8, highComplexityFunctions: [] },
          duplication: { duplicationPercent: 3.2 },
          tests: { testSuiteCount: 14, frameworksDetected: ['Jest'] },
          typeSafety: { typeCoveragePercent: 92, anyCount: 3 },
          techDebt: { totalCount: 2 }
        }
      }
    }
  ];

  const mockRanking = {
    eventId,
    totalSubmissionsRanked: 2,
    leaderboard: [
      {
        rank: 1,
        submissionId: sub1Id,
        teamName: 'CyberKnights',
        absoluteScore: 89.5,
        latentSkillScore: 4.85,
        winRate: 0.85,
        confidenceInterval: [4.2, 5.5],
        rankReason: 'Superior architectural modularity and strong test suite',
        whyAmIExplanation: {
          headline: 'Top rank achieved through robust hexagonal separation',
          whatRankAboveDidBetter: [],
          whatYouDidBetterThanRankBelow: [
            'Higher modularity with separated domain services (+10 pts)',
            'Comprehensive automated test suite covering edge cases'
          ],
          comparisonWithChampion: {
            isChampion: true,
            championStrengths: ['Leading architecture', 'High test coverage'],
            yourAdvantagesOverChampion: []
          },
          highestImpactImprovements: [
            {
              dimension: 'Testing',
              impact: 'HIGH',
              problem: 'Integration tests missing for payment gateway',
              remediation: 'Add mocked webhook integration tests',
              estimatedScoreGain: 3.5
            }
          ]
        }
      },
      {
        rank: 2,
        submissionId: sub2Id,
        teamName: 'CodeCraft',
        absoluteScore: 83.2,
        latentSkillScore: 2.15,
        winRate: 0.35,
        confidenceInterval: [1.8, 2.5],
        rankReason: 'Solid implementation, but lower test coverage and higher coupling',
        whyAmIExplanation: {
          headline: 'Rank #2 due to lower testing score and coupling in controllers',
          whatRankAboveDidBetter: [
            'Team CyberKnights (#1) had higher domain modularity and 14 test suites'
          ],
          whatYouDidBetterThanRankBelow: ['Better error recovery'],
          comparisonWithChampion: {
            isChampion: false,
            championStrengths: ['Better modularity', 'Lower cyclomatic branching'],
            yourAdvantagesOverChampion: ['Faster API response structure']
          },
          highestImpactImprovements: [
            {
              dimension: 'Testing',
              impact: 'HIGH',
              problem: 'Test suite count below cohort median',
              remediation: 'Add unit tests for calculation modules',
              estimatedScoreGain: 5.0
            }
          ]
        }
      }
    ],
    closeRankingBoundaries: [
      {
        subAId: sub1Id.toString(),
        subBId: sub2Id.toString(),
        subAName: 'CyberKnights',
        subBName: 'CodeCraft',
        scoreDelta: 6.3,
        boundaryReason: 'Separated by test coverage and coupling'
      }
    ]
  };

  beforeEach(() => {
    jest.spyOn(ReviewEvent, 'findById').mockResolvedValue(mockEvent as any);
    jest.spyOn(ReviewSubmission, 'find').mockResolvedValue(mockSubmissions as any);
    jest.spyOn(ReviewSubmission, 'findById').mockImplementation(async (id: any) => {
      return mockSubmissions.find((s) => s._id.toString() === id.toString()) as any;
    });
    jest.spyOn(ReviewEvaluation, 'find').mockResolvedValue(mockEvaluations as any);
    jest.spyOn(ReviewEvaluation, 'findOne').mockImplementation(async (query: any) => {
      return mockEvaluations.find(
        (e) => e.submissionId.toString() === query.submissionId.toString()
      ) as any;
    });
    jest.spyOn(Evidence, 'find').mockResolvedValue(mockEvidence as any);
    jest.spyOn(Evidence, 'findOne').mockImplementation(async (query: any) => {
      return mockEvidence.find(
        (ev) => ev.submissionId.toString() === query.submissionId.toString()
      ) as any;
    });
    jest.spyOn(EventRanking, 'findOne').mockResolvedValue(mockRanking as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('1. should generate a comprehensive Event-Level Leaderboard CSV with all requested fields', async () => {
    const csv = await service.generateEventCsv(eventId.toString());

    expect(typeof csv).toBe('string');
    // Verify header metadata
    expect(csv).toContain('RE:DESIGN COMPREHENSIVE CODE REVIEW & RELATIVE RANKING REPORT');
    expect(csv).toContain('Hackathon Grand Final 2026');

    // Verify critical columns
    expect(csv).toContain('"Rank"');
    expect(csv).toContain('"Team Name"');
    expect(csv).toContain('"Team ID"');
    expect(csv).toContain('"N/A"');
    expect(csv).toContain('"Final Score (0-100)"');
    expect(csv).toContain('"Final Score (0-10)"');
    expect(csv).toContain('"Latent Skill (λ)"');
    expect(csv).toContain('"Win Rate %"');
    expect(csv).toContain('"Positive Points (+ Points & Strengths)"');
    expect(csv).toContain('"Issues, Vulnerabilities & Code Smells"');
    expect(csv).toContain('"Prioritized Improvements (ROI)"');
    expect(csv).toContain('"Transparent Rank Explanation"');
    expect(csv).toContain('"Architecture (Score/100)"');
    expect(csv).toContain('"Testing (Score/100)"');

    // Verify row data for CyberKnights (Rank 1)
    expect(csv).toContain('"CyberKnights"');
    expect(csv).toContain('"89.50"');
    expect(csv).toContain('"8.95"');
    expect(csv).toContain('"4.85"');
    expect(csv).toContain('"85.0%"');
    // Verify positive points are present in CSV
    expect(csv).toContain('Higher modularity with separated domain services');
    // Verify issues are captured
    expect(csv).toContain('Avoid dynamic code execution');
    // Verify improvements are captured
    expect(csv).toContain('Integration tests missing for payment gateway');
    expect(csv).toContain('"Review Summary"');
    expect(csv).toContain(
      'A polished, responsive portfolio with clear structure and maintainable implementation.'
    );
    expect(csv).toContain('"Review Summary"');

    // Current evaluations store the dimension result as `finalScore`, not legacy `score`.
    expect(csv).toContain('"92.0"');
  });

  it('uses the persisted comparison matrix when legacy evaluations lack dimension scores', async () => {
    const originalDimensions = mockEvaluations[1].dimensionScores;
    const originalMatrix = (mockRanking as any).comparisonMatrix;
    mockEvaluations[1].dimensionScores = {};
    (mockRanking as any).comparisonMatrix = [
      {
        dimension: 'architecture',
        dimensionName: 'Architecture',
        scores: { [sub2Id.toString()]: 79.3 }
      }
    ];

    try {
      const csv = await service.generateEventCsv(eventId.toString());
      expect(csv).toContain('"79.3"');
    } finally {
      mockEvaluations[1].dimensionScores = originalDimensions;
      (mockRanking as any).comparisonMatrix = originalMatrix;
    }
  });
  it('2. should generate a multi-section Single Submission Deep Dive CSV', async () => {
    const csv = await service.generateSubmissionCsv(sub1Id.toString());

    expect(typeof csv).toBe('string');
    expect(csv).toContain('RE:DESIGN PROJECT DEEP-DIVE EVALUATION REPORT');
    expect(csv).toContain('"CyberKnights"');
    expect(csv).toContain('"#1 of 2"');
    expect(csv).toContain('--- SECTION 1: 9 CORE ENGINEERING DIMENSIONS ---');
    expect(csv).toContain('Architecture & Modularity');
    expect(csv).toContain('Clean hexagonal architecture');
    expect(csv).toContain('--- SECTION 2: POSITIVE POINTS & COMPETITIVE ADVANTAGES ---');
    expect(csv).toContain('Advantage over Lower Rank');
    expect(csv).toContain('--- SECTION 3: ISSUES, CODE SMELLS & VULNERABILITIES ---');
    expect(csv).toContain('Avoid dynamic code execution');
    expect(csv).toContain('--- SECTION 4: PRIORITIZED HIGH-IMPACT IMPROVEMENT ROADMAP ---');
    expect(csv).toContain('Integration tests missing for payment gateway');

    // Current evaluations store the dimension result as `finalScore`, not legacy `score`.
    expect(csv).toContain('"Architecture & Modularity","92"');
    expect(csv).toContain('--- SECTION 5: MEASURABLE DETERMINISTIC METRICS ---');
    expect(csv).toContain('Total Lines of Code');
  });

  it('3. should generate Notion-formatted Event Markdown with podium, callouts, and checklists', async () => {
    const { title, markdown } = await service.generateEventNotionMarkdown(eventId.toString());

    expect(title).toContain('RE:DESIGN Final Evaluation Report - Hackathon Grand Final 2026');
    // Check Notion specific elements
    expect(markdown).toContain('# 🏆 RE:DESIGN Final Evaluation Report');
    expect(markdown).toContain('## 🥇 Final Podium');
    expect(markdown).toContain('🥇 **1st Place** | **CyberKnights**');
    expect(markdown).toContain('🥈 **2nd Place** | **CodeCraft**');
    expect(markdown).toContain('## 📊 Master Calibrated Leaderboard');
    // Notion callouts
    expect(markdown).toContain('> 💡 **RE:DESIGN Evidence-First Evaluation Engine**');
    expect(markdown).toContain('> 🟢 **Key Positive Points (+ Points & Competitive Advantages)**');
    expect(markdown).toContain('> 🔴 **Issues, Code Smells & Vulnerabilities**');
    // Notion checklists
    expect(markdown).toContain('#### 🚀 Prioritized High-Impact Improvement Roadmap');
    expect(markdown).toContain('- [ ]');
    expect(markdown).toContain('`+3.5 pts`');
  });

  it('4. should handle Notion API validation errors gracefully when credentials missing', async () => {
    const resNoKey = await service.pushToNotion({
      apiKey: '',
      parentPageId: 'page123',
      title: 'Test',
      markdownContent: '# Hello'
    });
    expect(resNoKey.success).toBe(false);
    expect(resNoKey.error).toContain('Notion API key missing');

    const resNoPage = await service.pushToNotion({
      apiKey: 'secret_123',
      parentPageId: '',
      title: 'Test',
      markdownContent: '# Hello'
    });
    expect(resNoPage.success).toBe(false);
    expect(resNoPage.error).toContain('Parent Page ID missing');
  });
});
