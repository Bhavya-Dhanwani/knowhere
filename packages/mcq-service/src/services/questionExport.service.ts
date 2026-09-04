import QuestionDao from '../shared/dao/question.dao.js';
import {
  sanitizeQuestionForDisplay,
  SanitizedMCQQuestion
} from '../shared/sanitizers/question.sanitizer.js';

const questionDao = new QuestionDao();

export async function getQuestionById(id: string): Promise<SanitizedMCQQuestion | null> {
  const question = await questionDao.findQuestionForDisplay(id);
  if (!question) return null;
  return sanitizeQuestionForDisplay(question);
}

export default {
  getQuestionById
};
