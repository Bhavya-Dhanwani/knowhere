import axios from 'axios';
import {
  ReviewEvent,
  ReviewSubmission,
  ReviewEvaluation,
  SanitizationAudit,
  EvidenceBundle,
  ReplayTrace,
  EventRanking
} from '../types';

const reviewClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  withCredentials: true
});

export interface CreateEventPayload {
  name: string;
  description: string;
  problemStatement: string;
  projectType: string;
  requiresLiveUrl?: boolean;
  requiresApiSpec?: boolean;
  criteria: Array<{
    id: string;
    name: string;
    category: string;
    weight: number;
    description: string;
  }>;
  requirements?: Array<{
    id: string;
    title: string;
    description: string;
    mandatory: boolean;
    targetEndpointOrFile?: string;
  }>;
}

export interface CreateSubmissionPayload {
  teamName: string;
  teamId: string;
  repositoryUrl: string;
  branch?: string;
  liveSiteUrl?: string;
  apiSpecUrl?: string;
  rawReadmeText?: string;
}

export const reviewApi = {
  // Events
  async listEvents(): Promise<ReviewEvent[]> {
    const { data } = await reviewClient.get('/review/events');
    return data.data || [];
  },

  async getEvent(id: string): Promise<ReviewEvent> {
    const { data } = await reviewClient.get(`/review/events/${id}`);
    return data.data;
  },

  async createEvent(payload: CreateEventPayload): Promise<ReviewEvent> {
    const { data } = await reviewClient.post('/review/events', payload);
    return data.data;
  },

  async updateEvent(id: string, payload: Partial<CreateEventPayload>): Promise<ReviewEvent> {
    const { data } = await reviewClient.put(`/review/events/${id}`, payload);
    return data.data;
  },

  // Submissions
  async listSubmissionsForEvent(eventId: string): Promise<ReviewSubmission[]> {
    const { data } = await reviewClient.get(`/review/events/${eventId}/submissions`);
    return data.data || [];
  },

  async getSubmission(id: string): Promise<ReviewSubmission> {
    const { data } = await reviewClient.get(`/review/submissions/${id}`);
    return data.data;
  },

  async submitProject(
    eventId: string,
    payload: CreateSubmissionPayload
  ): Promise<ReviewSubmission> {
    const { data } = await reviewClient.post(`/review/events/${eventId}/submissions`, payload);
    return data.data;
  },

  async updateSubmission(
    id: string,
    payload: Partial<CreateSubmissionPayload>
  ): Promise<ReviewSubmission> {
    const { data } = await reviewClient.put(`/review/submissions/${id}`, payload);
    return data.data;
  },

  async deleteSubmission(id: string): Promise<{ success: boolean; message: string }> {
    const { data } = await reviewClient.delete(`/review/submissions/${id}`);
    return data;
  },

  // Workflow / Evaluation
  async evaluateSubmission(submissionId: string): Promise<unknown> {
    const { data } = await reviewClient.post(`/review/submissions/${submissionId}/evaluate`);
    return data.data;
  },

  async getEvaluationStatus(submissionId: string): Promise<{
    status: string;
    flaggedForHumanReview: boolean;
    flagReason?: string;
  }> {
    const { data } = await reviewClient.get(`/review/submissions/${submissionId}/status`);
    return data.data;
  },

  // Reports & Audits
  async getEvaluationReport(submissionId: string): Promise<{
    submission: ReviewSubmission;
    evaluation?: ReviewEvaluation;
    evidence?: EvidenceBundle;
    sanitizationAudit?: SanitizationAudit;
    ranking?: {
      rank: number;
      totalSubmissionsRanked: number;
      latentSkillScore: number;
      winRate: number;
      confidenceInterval: [number, number];
      rankReason?: string;
      relativeGrading?: import('../types').RelativeGrading;
      relativeAnalysis?: {
        comparedToAbove?: import('../types').RelativeComparison | null;
        comparedToBelow?: import('../types').RelativeComparison | null;
        selfImprovement?: import('../types').SelfImprovement | null;
        selfStrengths?: import('../types').SelfStrengths | null;
      };
    } | null;
  }> {
    const { data } = await reviewClient.get(`/review/submissions/${submissionId}/report`);
    return data.data;
  },

  async getSanitizationAudit(submissionId: string): Promise<SanitizationAudit> {
    const { data } = await reviewClient.get(`/review/submissions/${submissionId}/audit`);
    return data.data;
  },

  async getReplayTrace(submissionId: string): Promise<ReplayTrace> {
    const { data } = await reviewClient.get(`/review/submissions/${submissionId}/replay`);
    return data.data;
  },

  // Relative Ranking & Leaderboard
  async computeRanking(eventId: string): Promise<EventRanking> {
    const { data } = await reviewClient.post(`/review/events/${eventId}/rank`);
    return data.data;
  },

  async getLeaderboard(eventId: string): Promise<EventRanking> {
    const { data } = await reviewClient.get(`/review/events/${eventId}/leaderboard`);
    return data.data;
  },

  async getPairwiseMatrix(eventId: string): Promise<unknown> {
    const { data } = await reviewClient.get(`/review/events/${eventId}/pairwise`);
    return data.data;
  },

  // Judge Override
  async overrideScore(
    submissionId: string,
    newScore: number,
    reason: string
  ): Promise<ReviewEvaluation> {
    const { data } = await reviewClient.post(`/review/submissions/${submissionId}/override`, {
      newScore,
      reason
    });
    return data.data;
  }
};
