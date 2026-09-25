import LearnerModuleProgress, {
  ILearnerModuleProgressDocument,
  LearnerModuleStatus
} from '../models/learnerModuleProgress.model.js';

class LearnerModuleProgressDao {
  private progressModel: typeof LearnerModuleProgress;

  constructor() {
    this.progressModel = LearnerModuleProgress;
  }

  async findOrCreateProgress(
    courseId: string,
    moduleId: string,
    userId: string,
    unlockedAt: Date,
    deadline: Date
  ): Promise<ILearnerModuleProgressDocument> {
    const existing = await this.progressModel.findOne({ courseId, moduleId, userId });
    if (existing) {
      return existing;
    }

    return await this.progressModel.create({
      courseId,
      moduleId,
      userId,
      unlockedAt,
      deadline,
      status: 'unlocked',
      progressPercentage: 0,
      completedItems: []
    });
  }

  async findProgress(
    courseId: string,
    moduleId: string,
    userId: string
  ): Promise<ILearnerModuleProgressDocument | null> {
    return await this.progressModel.findOne({ courseId, moduleId, userId });
  }

  async listModuleProgressesByUser(
    courseId: string,
    userId: string
  ): Promise<ILearnerModuleProgressDocument[]> {
    return await this.progressModel.find({ courseId, userId });
  }

  async updateProgress(
    courseId: string,
    moduleId: string,
    userId: string,
    update: {
      progressPercentage?: number;
      status?: LearnerModuleStatus;
      completedItems?: string[];
      completedAt?: Date | null;
    }
  ): Promise<ILearnerModuleProgressDocument | null> {
    const updateObj: Record<string, unknown> = {};
    if (update.progressPercentage !== undefined) {
      updateObj.progressPercentage = update.progressPercentage;
    }
    if (update.status) {
      updateObj.status = update.status;
    }
    if (update.completedItems) {
      updateObj.completedItems = update.completedItems;
    }
    if (update.completedAt !== undefined) {
      updateObj.completedAt = update.completedAt;
    }

    return await this.progressModel.findOneAndUpdate(
      { courseId, moduleId, userId },
      { $set: updateObj },
      { returnDocument: 'after' }
    );
  }
}

export default LearnerModuleProgressDao;
