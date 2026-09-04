import CodingQuestionDao from '../shared/dao/question.dao.js';
import { sanitizeCodingQuestionForDisplay } from '../shared/sanitizers/coding.sanitizer.js';

const questionDao = new CodingQuestionDao();

export async function getQuestionById(id: string): Promise<any | null> {
  const question = await questionDao.findQuestionForDisplay(id);
  if (!question) return null;
  return sanitizeCodingQuestionForDisplay(question);
}

export default {
  getQuestionById
};
