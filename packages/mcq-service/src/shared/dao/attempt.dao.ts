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

  async createNextAttempt(
    data: Omit<Partial<IMCQAttempt>, 'attemptNumber'>,
    maximumAttempts = 3
  ): Promise<IMCQAttempt | null> {
    for (let retry = 0; retry < maximumAttempts + 2; retry++) {
      const latest = await MCQAttempt.findOne({
        questionId: data.questionId,
        userId: data.userId
      }).sort({ attemptNumber: -1 });
      const attemptNumber = (latest?.attemptNumber || 0) + 1;
      if (attemptNumber > maximumAttempts) return null;
      try {
        return await MCQAttempt.create({ ...data, attemptNumber });
      } catch (error: any) {
        if (error?.code === 11000) continue;
        throw error;
      }
    }
    throw new Error('Unable to allocate an MCQ attempt after repeated conflicts.');
  }
}

export default AttemptDao;
