// Importing modules
import UserProfile from '../models/userProfile.model.js';

// class to handle user profile data access operations
class UserProfileDao {
  UserProfileModel: typeof UserProfile;

  constructor() {
    this.UserProfileModel = UserProfile;
  }

  // function to create a new profile
  async createProfile(data: {
    userId: string;
    name: string;
    email: string;
    avatar?: string;
    bio?: string;
    phone?: string;
  }) {
    return await this.UserProfileModel.create(data);
  }

  // function to find a profile by userId
  async findProfileByUserId(userId: string) {
    return await this.UserProfileModel.findOne({ userId });
  }

  // function to update or create profile by userId
  async findProfilesByUserIds(userIds: string[]) {
    return await this.UserProfileModel.find({ userId: { $in: userIds } });
  }

  async findProfileByUsername(username: string) {
    return await this.UserProfileModel.findOne({ username: username.toLowerCase() });
  }

  async usernameTaken(username: string, exceptUserId?: string) {
    const hit = await this.UserProfileModel.exists({
      username: username.toLowerCase(),
      ...(exceptUserId ? { userId: { $ne: exceptUserId } } : {})
    });
    return Boolean(hit);
  }

  async upsertProfile(userId: string, updateData: Record<string, unknown>) {
    return await this.UserProfileModel.findOneAndUpdate(
      { userId },
      { $set: updateData },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  }
}

export default UserProfileDao;
