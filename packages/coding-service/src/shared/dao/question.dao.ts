import CodingQuestion, { ICodingQuestion } from '../models/question.model.js';

class CodingQuestionDao {
  async createQuestion(data: Partial<ICodingQuestion>): Promise<ICodingQuestion> {
    return await CodingQuestion.create(data);
  }

  async findQuestionById(id: string): Promise<ICodingQuestion | null> {
    return await CodingQuestion.findById(id);
  }

  // Display projection: strip hidden test cases
  // Public test cases are kept so trainee can see sample inputs/outputs
  async findQuestionForDisplay(id: string): Promise<any | null> {
    const question = await CodingQuestion.findById(id).lean();
    if (!question) return null;

    return {
      ...question,
      testCases: (question.testCases || [])
        .filter((tc: any) => !tc.isHidden)
        .map((tc: any) => ({
          input: tc.input,
          expectedOutput: tc.expectedOutput
        }))
    };
  }

  async listQuestionsByCreator(creatorId: string): Promise<ICodingQuestion[]> {
    return await CodingQuestion.find({ creatorId }).sort({ createdAt: -1 });
  }
}

export default CodingQuestionDao;
