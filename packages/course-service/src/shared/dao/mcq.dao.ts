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

  async findMcqsByIds(ids: string[]): Promise<IMcqDocument[]> {
    return await this.mcqModel.find({ _id: { $in: ids } });
  }

  async listMcqs(filter: Record<string, unknown> = {}): Promise<IMcqDocument[]> {
    return await this.mcqModel.find(filter).sort({ createdAt: -1 }).limit(200);
  }

  async updateMcqById(id: string, patch: Record<string, unknown>): Promise<IMcqDocument | null> {
    return await this.mcqModel.findByIdAndUpdate(
      id,
      { $set: patch },
      { new: true, runValidators: true }
    );
  }

  async deleteMcqById(id: string) {
    return await this.mcqModel.findByIdAndDelete(id);
  }

  async findMcqsUsingResource(resourceId: string): Promise<IMcqDocument[]> {
    return await this.mcqModel.find({
      $or: [
        { questionResourceIds: resourceId },
        { explanationResourceIds: resourceId },
        { 'options.resourceIds': resourceId }
      ]
    });
  }
}

export default McqDao;
