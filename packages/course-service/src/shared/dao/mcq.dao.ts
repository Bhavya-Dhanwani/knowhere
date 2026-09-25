import MCQ, { IMcqDocument } from '../models/mcq.model.js';

class McqDao {
  private mcqModel: typeof MCQ;

  constructor() {
    this.mcqModel = MCQ;
  }

  async createMcq(
    data: Omit<Partial<IMcqDocument>, '_id' | 'createdAt' | 'updatedAt'>
  ): Promise<IMcqDocument> {
    return await this.mcqModel.create(data);
  }

  async findMcqById(id: string): Promise<IMcqDocument | null> {
    return await this.mcqModel.findById(id);
  }

  async listMcqsByCourseId(courseId: string): Promise<IMcqDocument[]> {
    return await this.mcqModel.find({ courseId }).sort({ createdAt: -1 });
  }
}

export default McqDao;
