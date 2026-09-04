import CodingSubmission, {
  ICodingSubmission,
  SubmissionStatus,
  EvaluationResult
} from '../models/submission.model.js';

class CodingSubmissionDao {
  async createSubmission(data: Partial<ICodingSubmission>): Promise<ICodingSubmission> {
    return await CodingSubmission.create(data);
  }

  async findSubmissionById(id: string): Promise<ICodingSubmission | null> {
    return await CodingSubmission.findById(id);
  }

  async updateSubmissionResult(
    id: string,
    update: {
      status: SubmissionStatus;
      result?: EvaluationResult;
      scoreAwarded: number;
      passedTestCases: number;
      totalTestCases: number;
      details?: any[];
    }
  ): Promise<ICodingSubmission | null> {
    return await CodingSubmission.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true, runValidators: true }
    );
  }

  async listSubmissionsByUserAndQuestion(
    userId: string,
    questionId: string
  ): Promise<ICodingSubmission[]> {
    return await CodingSubmission.find({ userId, questionId }).sort({ createdAt: -1 });
  }
}

export default CodingSubmissionDao;
