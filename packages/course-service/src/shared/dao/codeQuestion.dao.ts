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
}

export default CodeQuestionDao;
