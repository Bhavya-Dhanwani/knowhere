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

  async upsertProfile(
    userId: string,
    updateData: {
      name?: string;
      email?: string;
      avatar?: string;
      bio?: string;
      phone?: string;
    }
  ) {
    return await this.UserProfileModel.findOneAndUpdate(
      { userId },
      { $set: updateData },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  }
}

export default UserProfileDao;
