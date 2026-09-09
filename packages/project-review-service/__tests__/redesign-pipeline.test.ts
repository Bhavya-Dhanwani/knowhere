import { Types } from 'mongoose';
import { CodeAnalysisRunner } from '../src/modules/runners/code-analysis.runner.js';
import { QualitativeAnalysisAgent } from '../src/modules/ai/qualitative-analysis.agent.js';
import { ScoringEngine } from '../src/modules/scoring/scoring.engine.js';
import { RankingBoundaryDetector } from '../src/modules/ranking/boundary-detector.js';
import { PairwiseEngine } from '../src/modules/ranking/pairwise.engine.js';
import { MistralKeyPoolManager } from '../src/modules/ai/key-pool.manager.js';
import {
  ENGINEERING_DIMENSIONS,
  DEFAULT_DIMENSION_WEIGHTS,
  DIMENSION_DISPLAY_NAMES
} from '../src/modules/scoring/types.js';
import { SubmissionEvaluationPairInput } from '../src/modules/ranking/types.js';

describe('RE:DESIGN Evaluation and Relative Ranking Engine', () => {
  describe('Score-weight contract', () => {
    it('uses the canonical camelCase dimension weights for the displayed composite', () => {
      expect(
        Object.values(DEFAULT_DIMENSION_WEIGHTS).reduce((sum, weight) => sum + weight, 0)
      ).toBeCloseTo(1, 10);

      const scores: Record<string, number> = {
        architecture: 74,
        codeQuality: 76,
        maintainability: 65,
        testing: 20,
        reliability: 70,
        complexity: 66,
        engineeringPractices: 66,
        securityPractices: 82,
        technicalDebt: 71
      };
      const composite = ENGINEERING_DIMENSIONS.reduce(
        (sum, dimension) => sum + scores[dimension] * DEFAULT_DIMENSION_WEIGHTS[dimension],
        0
      );

      expect(Number(composite.toFixed(1))).toBe(66.2);
    });
  });
  describe('1. Deterministic Static Analysis (§6, §8, §9)', () => {
    it('should extract measurable signals: LOC, cyclomatic complexity, code duplication, and technical debt', () => {
      const fileSnippets = {
        'src/controllers/UserController.ts': `
import { UserService } from '../services/UserService';

export class UserController {
  private service = new UserService();

  public async getUser(req: any, res: any) {
    // TODO: add input validation for user id
    const id = req.params.id;
    if (!id) {
      return res.status(400).json({ error: 'Missing id' });
    }
    const user = await this.service.findUser(id);
    return res.json(user);
  }

  public async duplicateValidationBlock(data: any) {
    if (data && data.name && data.email && data.role === 'admin') {
      console.log('Validating admin permissions');
      return true;
    }
    return false;
  }
}
`,
        'src/services/UserService.ts': `
export class UserService {
  public async findUser(id: string) {
    // FIXME: optimize database query caching
    if (id === '1') {
      return { id: '1', name: 'Alice' };
    } else if (id === '2') {
      return { id: '2', name: 'Bob' };
    } else {
      return null;
    }
  }

  public async duplicateValidationBlock(data: any) {
    if (data && data.name && data.email && data.role === 'admin') {
      console.log('Validating admin permissions');
      return true;
    }
    return false;
  }
}
`,
        'tests/user.test.ts': `
import { describe, it, expect } from '@jest/globals';

describe('UserService', () => {
  it('should find user by id', async () => {
    expect(1).toBe(1);
  });
});
`
      };

      const fileList = Object.keys(fileSnippets);
      const staticMetrics = CodeAnalysisRunner.computeDeterministicMetrics(
        fileSnippets,
        fileList,
        [],
        [],
        []
      );

      // LOC check
      expect(staticMetrics.linesOfCode.totalLines).toBeGreaterThan(30);
      expect(staticMetrics.linesOfCode.codeLines).toBeGreaterThan(20);

      // Debt markers check
      expect(staticMetrics.codeSmellsAndTechDebt.todoCount).toBe(1);
      expect(staticMetrics.codeSmellsAndTechDebt.fixmeCount).toBe(1);

      // Duplication check
      expect(staticMetrics.codeDuplication.duplicatedBlockCount).toBeGreaterThan(0);

      // Test metrics check
      expect(staticMetrics.testMetrics.hasTests).toBe(true);
      expect(staticMetrics.testMetrics.testFileCount).toBe(1);
      expect(staticMetrics.testMetrics.testCaseCount).toBe(1);

      // Type safety check (TypeScript files detected)
      expect(staticMetrics.typeSafety.usesTypeScript).toBe(true);

      // Observed Facts check: must follow Fact -> Interpretation -> Judgment
      expect(staticMetrics.observedFacts.length).toBeGreaterThan(0);
      const todoFact = staticMetrics.observedFacts.find((f) => f.dimension === 'technicalDebt');
      expect(todoFact).toBeDefined();
      expect(todoFact?.fact).toContain('TODO');
      expect(todoFact?.interpretation).toBeDefined();
    });
  });

  describe('2. LangChain Model Calling with Round-Robin Rotation (§7, user request)', () => {
    it('should rotate keys in round-robin order when dispatching AI agent calls', () => {
      const testKeys = ['mistral-key-alpha', 'mistral-key-beta', 'mistral-key-gamma'];
      const pool = new MistralKeyPoolManager(testKeys);

      expect(pool.getNextKey()).toBe('mistral-key-alpha');
      expect(pool.getNextKey()).toBe('mistral-key-beta');
      expect(pool.getNextKey()).toBe('mistral-key-gamma');
      expect(pool.getNextKey()).toBe('mistral-key-alpha'); // circular wrap
    });

    it('should produce structured qualitative evaluation across all 9 engineering dimensions', () => {
      const qualitativeOutput = QualitativeAnalysisAgent.computeDeterministicQualitativeFallback({
        repoUrl: 'https://github.com/example/sample-project',
        primaryLanguage: 'TypeScript',
        detectedFrameworks: ['Node.js', 'Express'],
        fileList: ['src/app.ts', 'src/controllers/UserController.ts', 'tests/user.test.ts'],
        keySnippets: {
          'src/app.ts': 'import express from "express"; const app = express();'
        },
        deterministicMetrics: {
          linesOfCode: { totalLines: 200, codeLines: 160, commentLines: 20, blankLines: 20 },
          fileCount: 3,
          moduleCount: 2,
          cyclomaticComplexity: {
            averagePerFunction: 2.1,
            maxComplexity: 5,
            complexFunctionsCount: 0,
            highComplexityFunctions: []
          },
          codeDuplication: {
            duplicatedBlockCount: 0,
            estimatedDuplicationPercentage: 0,
            duplicateInstances: []
          },
          testMetrics: {
            hasTests: true,
            testFileCount: 1,
            testCaseCount: 3,
            testFrameworks: ['Jest'],
            assertionCount: 5,
            testTypes: ['unit']
          },
          typeSafety: {
            usesTypeScript: true,
            typeCoveragePercent: 90,
            anyTypeCount: 1,
            strictModeEnabled: true
          },
          codeSmellsAndTechDebt: {
            todoCount: 1,
            fixmeCount: 0,
            hackCount: 0,
            workaroundCount: 0,
            largeFilesCount: 0,
            largeFunctionsCount: 0,
            deepNestingCount: 0,
            markers: [],
            largeEntities: []
          },
          securityAndLint: {
            secretLeaksCount: 0,
            criticalVulnsCount: 0,
            highVulnsCount: 0,
            mediumVulnsCount: 0,
            syntaxIssuesCount: 0,
            dangerousSinksCount: 0
          },
          observedFacts: []
        }
      });

      // All 9 dimensions must be present and scored 0-100
      for (const dim of ENGINEERING_DIMENSIONS) {
        expect(qualitativeOutput[dim]).toBeDefined();
        expect(qualitativeOutput[dim].score).toBeGreaterThanOrEqual(0);
        expect(qualitativeOutput[dim].score).toBeLessThanOrEqual(100);
        expect(qualitativeOutput[dim].reasoning.length).toBeGreaterThanOrEqual(10);
      }

      expect(qualitativeOutput.qualitativeScore).toBeGreaterThan(0);
      expect(qualitativeOutput.highestImpactImprovements.length).toBeGreaterThan(0);
    });
  });

  describe('3. Objective + Qualitative Scoring & Confidence (§10, §11, §12)', () => {
    it('should independently compute objective scores and calibrate confidence score', () => {
      const mockEvidence: any = {
        discovery: {
          primaryLanguage: 'TypeScript',
          fileList: [
            'src/index.ts',
            'src/service.ts',
            'src/model.ts',
            'tests/service.test.ts',
            'package.json'
          ],
          detectedFrameworks: ['Express', 'TypeScript']
        },
        codeAnalysis: {
          semgrep: {
            totalIssues: 0,
            criticalCount: 0,
            highCount: 0,
            mediumCount: 0,
            lowCount: 0,
            findings: []
          },
          gitleaks: { secretsFoundCount: 0, leaks: [] },
          trivy: { vulnerabilityCount: 0, critical: 0, high: 0, medium: 0, low: 0, cves: [] },
          deterministicMetrics: {
            linesOfCode: { totalLines: 500, codeLines: 400, commentLines: 50, blankLines: 50 },
            cyclomaticComplexity: {
              averagePerFunction: 2.0,
              maxComplexity: 4,
              complexFunctionsCount: 0,
              highComplexityFunctions: []
            },
            codeDuplication: {
              duplicatedBlockCount: 0,
              estimatedDuplicationPercentage: 0,
              duplicateInstances: []
            },
            testMetrics: {
              hasTests: true,
              testFileCount: 1,
              testCaseCount: 5,
              testFrameworks: ['Jest'],
              assertionCount: 10,
              testTypes: ['unit']
            },
            typeSafety: {
              usesTypeScript: true,
              typeCoveragePercent: 95,
              anyTypeCount: 0,
              strictModeEnabled: true
            },
            codeSmellsAndTechDebt: {
              todoCount: 0,
              fixmeCount: 0,
              hackCount: 0,
              workaroundCount: 0,
              largeFilesCount: 0,
              largeFunctionsCount: 0,
              deepNestingCount: 0,
              markers: [],
              largeEntities: []
            },
            securityAndLint: {
              secretLeaksCount: 0,
              criticalVulnsCount: 0,
              highVulnsCount: 0,
              mediumVulnsCount: 0,
              syntaxIssuesCount: 0,
              dangerousSinksCount: 0
            },
            observedFacts: []
          }
        }
      };

      const objectiveResult = ScoringEngine.computeObjectiveScores(mockEvidence);
      expect(objectiveResult.overallObjectiveScore).toBeGreaterThan(80);

      // Verify each of the 9 dimensions has an objective score
      for (const d of ENGINEERING_DIMENSIONS) {
        expect(objectiveResult.dimensionScores[d]).toBeGreaterThanOrEqual(0);
        expect(objectiveResult.dimensionScores[d]).toBeLessThanOrEqual(100);
      }

      const confidence = ScoringEngine.computeConfidenceScore(mockEvidence);
      expect(confidence).toBeGreaterThanOrEqual(80);
      expect(confidence).toBeLessThanOrEqual(98);
    });

    it('should award 0 score and 100% confidence for empty or uncloneable repositories', () => {
      const emptyEvidence: any = {
        discovery: { fileList: [] },
        codeAnalysis: { semgrep: { findings: [] }, gitleaks: { leaks: [] }, trivy: { cves: [] } }
      };

      const objective = ScoringEngine.computeObjectiveScores(emptyEvidence);
      expect(objective.overallObjectiveScore).toBe(0);

      const confidence = ScoringEngine.computeConfidenceScore(emptyEvidence);
      expect(confidence).toBe(100); // 100% confident that 0 files deserve 0 score
    });
  });

  describe('4. Ranking Boundary Detection (§15)', () => {
    it('should detect close score boundaries to prioritize targeted pairwise comparisons', () => {
      const subA: SubmissionEvaluationPairInput = {
        submissionId: new Types.ObjectId(),
        teamName: 'Project A',
        overallScore: 91.2,
        criterionScores: {}
      };
      const subB: SubmissionEvaluationPairInput = {
        submissionId: new Types.ObjectId(),
        teamName: 'Project B',
        overallScore: 90.8, // Delta 0.4 (close boundary!)
        criterionScores: {}
      };
      const subC: SubmissionEvaluationPairInput = {
        submissionId: new Types.ObjectId(),
        teamName: 'Project C',
        overallScore: 82.0, // Gap 8.8 from B
        criterionScores: {}
      };
      const subD: SubmissionEvaluationPairInput = {
        submissionId: new Types.ObjectId(),
        teamName: 'Project D',
        overallScore: 81.7, // Delta 0.3 (close boundary!)
        criterionScores: {}
      };

      const sortedSubmissions = [subA, subB, subC, subD];
      const boundaries = RankingBoundaryDetector.detectCloseBoundaries(sortedSubmissions, 2.0);

      // Must identify adjacent boundaries
      expect(boundaries.length).toBeGreaterThanOrEqual(3);

      // Verify A vs B is recognized as a close boundary
      const aVsB = boundaries.find(
        (b) => b.subA.teamName === 'Project A' && b.subB.teamName === 'Project B'
      );
      expect(aVsB).toBeDefined();
      expect(aVsB?.scoreDelta).toBeCloseTo(0.4, 1);

      // Verify C vs D is recognized as a close boundary
      const cVsD = boundaries.find(
        (b) => b.subA.teamName === 'Project C' && b.subB.teamName === 'Project D'
      );
      expect(cVsD).toBeDefined();
      expect(cVsD?.scoreDelta).toBeCloseTo(0.3, 1);
    });
  });

  describe('5. Pairwise Comparison Engine across 9 Dimensions (§16, §17)', () => {
    it('should compare two projects across all 9 dimensions with concrete winners and reasons', () => {
      const subA: SubmissionEvaluationPairInput = {
        submissionId: new Types.ObjectId(),
        teamName: 'Alpha Architecture',
        overallScore: 88.5,
        criterionScores: { general: 88 },
        dimensionScores: {
          architecture: {
            objectiveScore: 92,
            qualitativeScore: 90,
            finalScore: 91,
            strengths: ['Clean repository and service layer separation']
          },
          codeQuality: {
            objectiveScore: 88,
            qualitativeScore: 86,
            finalScore: 87,
            strengths: ['Consistent naming']
          },
          maintainability: {
            objectiveScore: 90,
            qualitativeScore: 88,
            finalScore: 89,
            strengths: ['Zero code duplication']
          },
          testing: { objectiveScore: 60, qualitativeScore: 65, finalScore: 63, strengths: [] },
          reliability: {
            objectiveScore: 85,
            qualitativeScore: 84,
            finalScore: 84.5,
            strengths: []
          },
          complexity: { objectiveScore: 80, qualitativeScore: 82, finalScore: 81, strengths: [] },
          engineeringPractices: {
            objectiveScore: 90,
            qualitativeScore: 90,
            finalScore: 90,
            strengths: []
          },
          securityPractices: {
            objectiveScore: 95,
            qualitativeScore: 92,
            finalScore: 93,
            strengths: []
          },
          technicalDebt: { objectiveScore: 85, qualitativeScore: 85, finalScore: 85, strengths: [] }
        }
      };

      const subB: SubmissionEvaluationPairInput = {
        submissionId: new Types.ObjectId(),
        teamName: 'Beta Testing',
        overallScore: 85.0,
        criterionScores: { general: 85 },
        dimensionScores: {
          architecture: { objectiveScore: 80, qualitativeScore: 78, finalScore: 79, strengths: [] },
          codeQuality: { objectiveScore: 82, qualitativeScore: 80, finalScore: 81, strengths: [] },
          maintainability: {
            objectiveScore: 80,
            qualitativeScore: 78,
            finalScore: 79,
            strengths: []
          },
          testing: {
            objectiveScore: 95,
            qualitativeScore: 92,
            finalScore: 93,
            strengths: ['Comprehensive unit and e2e test suite']
          },
          reliability: { objectiveScore: 80, qualitativeScore: 80, finalScore: 80, strengths: [] },
          complexity: { objectiveScore: 85, qualitativeScore: 85, finalScore: 85, strengths: [] },
          engineeringPractices: {
            objectiveScore: 80,
            qualitativeScore: 80,
            finalScore: 80,
            strengths: []
          },
          securityPractices: {
            objectiveScore: 85,
            qualitativeScore: 85,
            finalScore: 85,
            strengths: []
          },
          technicalDebt: { objectiveScore: 80, qualitativeScore: 80, finalScore: 80, strengths: [] }
        }
      };

      const result = PairwiseEngine.compare(subA, subB);

      expect(result.winner).toEqual(subA.submissionId);
      expect(result.dimensionComparisons).toBeDefined();

      // Dimension level assertions:
      // Architecture winner must be A
      const archComp = result.dimensionComparisons?.['architecture'];
      expect(archComp).toBeDefined();
      expect(archComp?.winner).toBe('A');
      expect(archComp?.winnerTeamName).toBe('Alpha Architecture');
      expect(archComp?.reason).toContain('Alpha Architecture wins on Architecture');

      // Testing winner must be B
      const testComp = result.dimensionComparisons?.['testing'];
      expect(testComp).toBeDefined();
      expect(testComp?.winner).toBe('B');
      expect(testComp?.winnerTeamName).toBe('Beta Testing');
      expect(testComp?.reason).toContain('Beta Testing wins on Testing');
    });
  });

  describe('6. "Why Am I #2?" Explanation & Improvements (§18, §19)', () => {
    it('should generate transparent "Why This Rank?" explanations for each position', () => {
      const id1 = new Types.ObjectId();
      const id2 = new Types.ObjectId();
      const id3 = new Types.ObjectId();

      const sub1: SubmissionEvaluationPairInput = {
        submissionId: id1,
        teamName: 'Champion Project (#1)',
        overallScore: 92.5,
        criterionScores: { general: 93 },
        dimensionScores: {
          architecture: { objectiveScore: 95, qualitativeScore: 95, finalScore: 95 },
          codeQuality: { objectiveScore: 90, qualitativeScore: 90, finalScore: 90 },
          maintainability: { objectiveScore: 92, qualitativeScore: 92, finalScore: 92 },
          testing: { objectiveScore: 80, qualitativeScore: 80, finalScore: 80 },
          reliability: { objectiveScore: 90, qualitativeScore: 90, finalScore: 90 },
          complexity: { objectiveScore: 88, qualitativeScore: 88, finalScore: 88 },
          engineeringPractices: { objectiveScore: 92, qualitativeScore: 92, finalScore: 92 },
          securityPractices: { objectiveScore: 95, qualitativeScore: 95, finalScore: 95 },
          technicalDebt: { objectiveScore: 90, qualitativeScore: 90, finalScore: 90 }
        }
      };

      const sub2: SubmissionEvaluationPairInput = {
        submissionId: id2,
        teamName: 'Runner Up (#2)',
        overallScore: 88.0,
        criterionScores: { general: 88 },
        dimensionScores: {
          architecture: { objectiveScore: 82, qualitativeScore: 82, finalScore: 82 },
          codeQuality: { objectiveScore: 85, qualitativeScore: 85, finalScore: 85 },
          maintainability: { objectiveScore: 84, qualitativeScore: 84, finalScore: 84 },
          testing: { objectiveScore: 95, qualitativeScore: 95, finalScore: 95 }, // Better testing than #1!
          reliability: { objectiveScore: 85, qualitativeScore: 85, finalScore: 85 },
          complexity: { objectiveScore: 85, qualitativeScore: 85, finalScore: 85 },
          engineeringPractices: { objectiveScore: 88, qualitativeScore: 88, finalScore: 88 },
          securityPractices: { objectiveScore: 88, qualitativeScore: 88, finalScore: 88 },
          technicalDebt: { objectiveScore: 85, qualitativeScore: 85, finalScore: 85 }
        },
        highestImpactImprovements: [
          'Decouple business logic from database models.',
          'Extract duplicated auth middleware.'
        ]
      };

      const sub3: SubmissionEvaluationPairInput = {
        submissionId: id3,
        teamName: 'Third Place (#3)',
        overallScore: 78.0,
        criterionScores: { general: 78 },
        dimensionScores: {
          architecture: { objectiveScore: 75, qualitativeScore: 75, finalScore: 75 },
          codeQuality: { objectiveScore: 76, qualitativeScore: 76, finalScore: 76 },
          maintainability: { objectiveScore: 74, qualitativeScore: 74, finalScore: 74 },
          testing: { objectiveScore: 70, qualitativeScore: 70, finalScore: 70 },
          reliability: { objectiveScore: 75, qualitativeScore: 75, finalScore: 75 },
          complexity: { objectiveScore: 78, qualitativeScore: 78, finalScore: 78 },
          engineeringPractices: { objectiveScore: 76, qualitativeScore: 76, finalScore: 76 },
          securityPractices: { objectiveScore: 80, qualitativeScore: 80, finalScore: 80 },
          technicalDebt: { objectiveScore: 75, qualitativeScore: 75, finalScore: 75 }
        }
      };

      const submissions = [sub1, sub2, sub3];
      const matches = [
        PairwiseEngine.compare(sub1, sub2),
        PairwiseEngine.compare(sub1, sub3),
        PairwiseEngine.compare(sub2, sub3)
      ];

      const ratings = PairwiseEngine.computeBradleyTerryRatings(submissions, matches);
      expect(ratings.length).toBe(3);

      const runnerUp = ratings.find((r) => r.submissionId.toString() === id2.toString());
      expect(runnerUp).toBeDefined();
      expect(runnerUp?.rank).toBe(2);

      const whyAmI = runnerUp?.whyAmIExplanation;
      expect(whyAmI).toBeDefined();

      // Why ranked above #3:
      expect(whyAmI?.whyRankedAboveBelow.rankedAboveNext).toBeDefined();
      expect(whyAmI?.whyRankedAboveBelow.rankedAboveNext?.targetTeamName).toBe('Third Place (#3)');
      expect(whyAmI?.whyRankedAboveBelow.rankedAboveNext?.keyAdvantages.length).toBeGreaterThan(0);

      // Why ranked below #1:
      expect(whyAmI?.whyRankedAboveBelow.rankedBelowPrevious).toBeDefined();
      expect(whyAmI?.whyRankedAboveBelow.rankedBelowPrevious?.targetTeamName).toBe(
        'Champion Project (#1)'
      );
      expect(whyAmI?.whyRankedAboveBelow.rankedBelowPrevious?.higherRankedAdvantages).toContain(
        'Architecture'
      );

      // Your advantages over #1:
      expect(whyAmI?.comparisonWithChampion?.yourAdvantagesOverChampion).toContain('Testing');

      // Actionable improvements:
      expect(whyAmI?.highestImpactImprovements.length).toBeGreaterThan(0);
      expect(whyAmI?.highestImpactImprovements[0]).toContain('Decouple business logic');
    });
  });
});
