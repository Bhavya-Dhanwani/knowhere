import { IMCQQuestion } from '../models/question.model.js';

export interface SanitizedMCQQuestion {
  id: string;
  title: string;
  stem: string;
  options: Array<{ id: string; text: string }>;
  max_score: number;
  explanation?: string;
  creatorId: string;
  createdAt: string;
}

export function sanitizeQuestionForDisplay(question: any): SanitizedMCQQuestion {
  return {
    id: question._id ? question._id.toString() : question.id,
    title: question.title,
    stem: question.stem,
    options: (question.options || []).map((o: any) => ({
      id: o.id,
      text: o.text
    })),
    max_score: question.max_score || 1,
    creatorId: question.creatorId,
    createdAt: question.createdAt
      ? new Date(question.createdAt).toISOString()
      : new Date().toISOString()
  };
}

export function sanitizeQuestionFull(question: IMCQQuestion | any): any {
  return {
    id: question._id ? question._id.toString() : question.id,
    title: question.title,
    stem: question.stem,
    options: question.options,
    correct_option_id: question.correct_option_id,
    max_score: question.max_score,
    explanation: question.explanation,
    creatorId: question.creatorId,
    createdAt: question.createdAt
      ? new Date(question.createdAt).toISOString()
      : new Date().toISOString(),
    updatedAt: question.updatedAt
      ? new Date(question.updatedAt).toISOString()
      : new Date().toISOString()
  };
}
