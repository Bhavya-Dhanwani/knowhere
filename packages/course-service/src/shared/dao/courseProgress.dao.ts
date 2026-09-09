// Importing modules
import CourseProgress, { ICourseProgress } from '../models/courseProgress.model.js';

class CourseProgressDao {
  CourseProgressModel: typeof CourseProgress;

  constructor() {
    this.CourseProgressModel = CourseProgress;
  }

  async findProgress(courseId: string, userId: string): Promise<ICourseProgress | null> {
    return await this.CourseProgressModel.findOne({ courseId, userId });
  }

  async recordCompletion(data: {
    courseId: string;
    userId: string;
    contentItemId: string;
    type: 'video' | 'notes' | 'mcq' | 'coding';
    scoreEarned: number;
    maxScore: number;
  }): Promise<ICourseProgress> {
    const { courseId, userId, contentItemId, type, scoreEarned, maxScore } = data;
    for (let retry = 0; retry < 5; retry++) {
      const progress = await this.CourseProgressModel.findOne({ courseId, userId });
      if (!progress) {
        try {
          return await this.CourseProgressModel.create({
            courseId,
            userId,
            totalScoreEarned: scoreEarned,
            completedItems: [
              { contentItemId, type, scoreEarned, maxScore, completedAt: new Date() }
            ]
          });
        } catch (error: any) {
          if (error?.code === 11000) continue;
          throw error;
        }
      }

      const existingIndex = progress.completedItems.findIndex(
        (item) => item.contentItemId.toString() === contentItemId
      );
      const previousScore =
        existingIndex >= 0 ? progress.completedItems[existingIndex].scoreEarned : 0;
      if (existingIndex >= 0 && scoreEarned <= previousScore) return progress;

      const update =
        existingIndex >= 0
          ? {
              $inc: { totalScoreEarned: scoreEarned - previousScore, __v: 1 },
              $set: {
                [`completedItems.${existingIndex}.scoreEarned`]: scoreEarned,
                [`completedItems.${existingIndex}.maxScore`]: maxScore,
                [`completedItems.${existingIndex}.completedAt`]: new Date()
              }
            }
          : {
              $inc: { totalScoreEarned: scoreEarned, __v: 1 },
              $push: {
                completedItems: {
                  contentItemId,
                  type,
                  scoreEarned,
                  maxScore,
                  completedAt: new Date()
                }
              }
            };
      const updated = await this.CourseProgressModel.findOneAndUpdate(
        { _id: progress._id, __v: progress.__v },
        update,
        { new: true, runValidators: true }
      );
      if (updated) return updated;
    }
    throw new Error('Progress update conflicted repeatedly; retry the request.');
  }

  async listGradesByCourse(courseId: string): Promise<ICourseProgress[]> {
    return await this.CourseProgressModel.find({ courseId }).sort({ totalScoreEarned: -1 });
  }
}

export default CourseProgressDao;
