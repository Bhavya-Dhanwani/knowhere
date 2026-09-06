export interface EvaluationWorkflowInput {
  submissionId: string;
  eventId: string;
  repoUrl: string;
  branch?: string;
  liveSiteUrl?: string;
  apiSpecUrl?: string;
  rawReadme?: string;
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
