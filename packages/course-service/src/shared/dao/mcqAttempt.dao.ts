import MCQAttempt, { IMcqAttemptDocument } from '../models/mcqAttempt.model.js';

class McqAttemptDao {
  private attemptModel: typeof MCQAttempt;

  constructor() {
    this.attemptModel = MCQAttempt;
  }

  async recordAttempt(
    data: Omit<Partial<IMcqAttemptDocument>, '_id' | 'createdAt' | 'updatedAt'>
  ): Promise<IMcqAttemptDocument> {
    return await this.attemptModel.create(data);
  }

  async getAttemptCount(mcqId: string, userId: string): Promise<number> {
    return await this.attemptModel.countDocuments({ mcqId, userId });
  }

  async listAttemptsByUser(userId: string, courseId?: string): Promise<IMcqAttemptDocument[]> {
    const filter: Record<string, unknown> = { userId };
    if (courseId) filter.courseId = courseId;
    return await this.attemptModel.find(filter).sort({ createdAt: -1 });
  }
}

export default McqAttemptDao;
