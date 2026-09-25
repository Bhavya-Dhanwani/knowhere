import UserActivity, {
  IUserActivityDocument,
  UserActivityEventType
} from '../models/userActivity.model.js';

class UserActivityDao {
  private activityModel: typeof UserActivity;

  constructor() {
    this.activityModel = UserActivity;
  }

  async logActivity(
    data: Omit<Partial<IUserActivityDocument>, '_id' | 'createdAt' | 'updatedAt'>
  ): Promise<IUserActivityDocument> {
    return await this.activityModel.create(data);
  }

  async getActivitiesForUserAndCourse(
    userId: string,
    courseId: string,
    from?: Date,
    to?: Date
  ): Promise<IUserActivityDocument[]> {
    const filter: Record<string, unknown> = { userId, courseId };
    if (from || to) {
      const tsFilter: Record<string, unknown> = {};
      if (from) tsFilter.$gte = from;
      if (to) tsFilter.$lte = to;
      filter.timestamp = tsFilter;
    }

    return await this.activityModel.find(filter).sort({ timestamp: 1 });
  }

  async getActivitiesByType(
    userId: string,
    courseId: string,
    eventType: UserActivityEventType
  ): Promise<IUserActivityDocument[]> {
    return await this.activityModel.find({ userId, courseId, eventType }).sort({ timestamp: 1 });
  }
}

export default UserActivityDao;
