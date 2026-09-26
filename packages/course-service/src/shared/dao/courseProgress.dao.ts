import { SubmoduleContentType } from '../models/submodule.model.js';
// Importing modules
import { Types } from 'mongoose';
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
    type: SubmoduleContentType;
    scoreEarned: number;
    maxScore: number;
  }): Promise<ICourseProgress> {
    const { courseId, userId, contentItemId, type, scoreEarned, maxScore } = data;

    // Find existing or create
    let progress = await this.CourseProgressModel.findOne({ courseId, userId });

    if (!progress) {
      progress = new this.CourseProgressModel({
        courseId,
        userId,
        totalScoreEarned: scoreEarned,
        completedItems: [
          {
            contentItemId,
            type,
            scoreEarned,
            maxScore,
            completedAt: new Date()
          }
        ]
      });
      return await progress.save();
    }

    // Check if item was already completed
    const existingIndex = progress.completedItems.findIndex(
      (item) => item.contentItemId.toString() === contentItemId
    );

    if (existingIndex >= 0) {
      // If student scored higher (e.g. on coding retries or quiz retries), award difference
      const previousScore = progress.completedItems[existingIndex].scoreEarned;
      if (scoreEarned > previousScore) {
        const scoreDiff = scoreEarned - previousScore;
        progress.totalScoreEarned += scoreDiff;
        progress.completedItems[existingIndex].scoreEarned = scoreEarned;
        progress.completedItems[existingIndex].completedAt = new Date();
        await progress.save();
      }
      return progress;
    }

    // Add new completion item and increment totalScoreEarned
    progress.completedItems.push({
      contentItemId: new Types.ObjectId(contentItemId),
      type,
      scoreEarned,
      maxScore,
      completedAt: new Date()
    });
    progress.totalScoreEarned += scoreEarned;

    return await progress.save();
  }

  async listGradesByCourse(courseId: string): Promise<ICourseProgress[]> {
    return await this.CourseProgressModel.find({ courseId }).sort({ totalScoreEarned: -1 });
  }

  // first course visit creates the record; its createdAt is used as the learner's join date
  async ensureProgress(courseId: string, userId: string): Promise<ICourseProgress> {
    return (await this.CourseProgressModel.findOneAndUpdate(
      { courseId, userId },
      { $setOnInsert: { totalScoreEarned: 0, completedItems: [] } },
      { upsert: true, new: true }
    )) as ICourseProgress;
  }

  async deleteByCourse(courseId: string) {
    return await this.CourseProgressModel.deleteMany({ courseId });
  }
}

export default CourseProgressDao;
