export interface EvaluationWorkflowInput {
  workflowId: string;
  submissionId: string;
  eventId: string;
  repoUrl: string;
  branch?: string;
  commitHash?: string;
  liveSiteUrl?: string;
  apiSpecUrl?: string;
  rawReadme?: string;
}

export interface ActivityExecutionSnapshot {
  activityId: string;
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
  status: 'SUCCESS' | 'PARTIAL' | 'FLAGGED' | 'FAILED';
  overallScore?: number;
  flaggedForHumanReview: boolean;
  activitiesTrace: ActivityExecutionSnapshot[];
  totalDurationMs: number;
}
