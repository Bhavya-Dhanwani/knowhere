import MCQQuestion, { IMCQQuestion } from '../models/question.model.js';

class QuestionDao {
  async createQuestion(data: Partial<IMCQQuestion>): Promise<IMCQQuestion> {
    return await MCQQuestion.create(data);
  }

  async findQuestionById(id: string): Promise<IMCQQuestion | null> {
    return await MCQQuestion.findById(id);
  }

  // Query projection: .select('-correct_option_id')
  // Strip correct_option_id at the DB query level for display endpoint
  async findQuestionForDisplay(id: string): Promise<any | null> {
    return await MCQQuestion.findById(id).select('-correct_option_id').lean();
  }

  async listQuestionsByCreator(creatorId: string): Promise<IMCQQuestion[]> {
    return await MCQQuestion.find({ creatorId }).sort({ createdAt: -1 });
  }
}

export default QuestionDao;
