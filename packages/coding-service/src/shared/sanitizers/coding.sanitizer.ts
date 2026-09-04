import { ICodingQuestion } from '../models/question.model.js';
import { ICodingSubmission } from '../models/submission.model.js';

export function sanitizeCodingQuestionForDisplay(question: any): any {
  return {
    id: question._id ? question._id.toString() : question.id,
    title: question.title,
    description: question.description,
    starterCode: question.starterCode,
    sampleTestCases: (question.testCases || []).map((tc: any) => ({
      input: tc.input,
      expectedOutput: tc.expectedOutput
    })),
    timeLimitMs: question.timeLimitMs,
    memoryLimitMb: question.memoryLimitMb,
    max_score: question.max_score,
    creatorId: question.creatorId,
    createdAt: question.createdAt
      ? new Date(question.createdAt).toISOString()
      : new Date().toISOString()
  };
}

export function sanitizeCodingQuestionFull(question: ICodingQuestion | any): any {
  return {
    id: question._id ? question._id.toString() : question.id,
    title: question.title,
    description: question.description,
    starterCode: question.starterCode,
    testCases: question.testCases,
    timeLimitMs: question.timeLimitMs,
    memoryLimitMb: question.memoryLimitMb,
    max_score: question.max_score,
    creatorId: question.creatorId,
    createdAt: question.createdAt
      ? new Date(question.createdAt).toISOString()
      : new Date().toISOString(),
    updatedAt: question.updatedAt
      ? new Date(question.updatedAt).toISOString()
      : new Date().toISOString()
  };
}

export function sanitizeSubmission(submission: ICodingSubmission | any): any {
  return {
    id: submission._id ? submission._id.toString() : submission.id,
    questionId: submission.questionId,
    userId: submission.userId,
    language: submission.language,
    status: submission.status,
    result: submission.result,
    scoreAwarded: submission.scoreAwarded,
    passedTestCases: submission.passedTestCases,
    totalTestCases: submission.totalTestCases,
    details: submission.details,
    createdAt: submission.createdAt
      ? new Date(submission.createdAt).toISOString()
      : new Date().toISOString()
  };
}
