import CodeQuestion, {
  ICodingQuestionDocument,
  TestCaseGenerationStatus
} from '../models/codeQuestion.model.js';

class CodeQuestionDao {
  private questionModel: typeof CodeQuestion;

  constructor() {
    this.questionModel = CodeQuestion;
  }

  async createQuestion(
    data: Omit<Partial<ICodingQuestionDocument>, '_id' | 'createdAt' | 'updatedAt'>
  ): Promise<ICodingQuestionDocument> {
    return await this.questionModel.create(data);
  }

  async findQuestionById(id: string): Promise<ICodingQuestionDocument | null> {
    return await this.questionModel.findById(id);
  }

  async updateGenerationStatus(
    id: string,
    status: TestCaseGenerationStatus,
    testCases?: ICodingQuestionDocument['testCases']
  ): Promise<ICodingQuestionDocument | null> {
    const updateObj: Record<string, unknown> = { testCaseGenerationStatus: status };
    if (testCases) updateObj.testCases = testCases;

    return await this.questionModel.findByIdAndUpdate(
      id,
      { $set: updateObj },
      { returnDocument: 'after' }
    );
  }

  async listQuestionsByCourseId(courseId: string): Promise<ICodingQuestionDocument[]> {
    return await this.questionModel.find({ courseId }).sort({ createdAt: -1 });
  }

  async findQuestionsByIds(ids: string[]): Promise<ICodingQuestionDocument[]> {
    return await this.questionModel.find({ _id: { $in: ids } });
  }

  async listQuestions(filter: Record<string, unknown> = {}): Promise<ICodingQuestionDocument[]> {
    return await this.questionModel
      .find(filter)
      .select('-testCases')
      .sort({ createdAt: -1 })
      .limit(200);
  }

  async updateQuestionById(
    id: string,
    patch: Record<string, unknown>
  ): Promise<ICodingQuestionDocument | null> {
    return await this.questionModel.findByIdAndUpdate(
      id,
      { $set: patch },
      { new: true, runValidators: true }
    );
  }

  async deleteQuestionById(id: string) {
    return await this.questionModel.findByIdAndDelete(id);
  }
}

export default CodeQuestionDao;
