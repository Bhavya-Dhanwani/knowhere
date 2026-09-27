export interface EvaluationWorkflowInput {
  submissionId: string;
  eventId: string;
  repoUrl: string;
  branch?: string;
  liveSiteUrl?: string;
  apiSpecUrl?: string;
  rawReadme?: string;
  formFields?: Array<{ id: string; label: string }>;
  formResponses?: Record<string, string>;
  // organiser's stdin -> expected stdout cases and how to run the program (DSA events)
  ioTests?: Array<{ name?: string; input: string; expected: string }>;
  runCommand?: string;
  // batch runs rank once at the end instead of after every submission
  skipRanking?: boolean;
}

export interface ActivityExecutionSnapshot {
  activityName: string;
  status: 'COMPLETED' | 'FAILED' | 'SKIPPED';
  startedAt: Date;
  completedAt: Date;
  durationMs: number;
  inputSnapshot?: unknown;
  outputSnapshot?: unknown;
  error?: string;
}

export interface EvaluationWorkflowResult {
  workflowId: string;
  submissionId: string;
  eventId: string;
  status: 'SUCCESS' | 'FLAGGED' | 'FAILED';
  overallScore?: number;
  flaggedForHumanReview: boolean;
  activitiesTrace: ActivityExecutionSnapshot[];
  totalDurationMs: number;
}
