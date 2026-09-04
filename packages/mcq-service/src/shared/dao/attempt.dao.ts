import MCQAttempt, { IMCQAttempt } from '../models/attempt.model.js';

class AttemptDao {
  async getAttemptCount(questionId: string, userId: string): Promise<number> {
    return await MCQAttempt.countDocuments({ questionId, userId });
  }

  async findAttempts(questionId: string, userId: string): Promise<IMCQAttempt[]> {
    return await MCQAttempt.find({ questionId, userId }).sort({ attemptNumber: 1 });
  }

  async createAttempt(data: Partial<IMCQAttempt>): Promise<IMCQAttempt> {
    return await MCQAttempt.create(data);
  }
}

export default AttemptDao;
