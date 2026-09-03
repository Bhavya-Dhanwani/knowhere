// Importing modules
import mongoose from 'mongoose';

// defining the schema for the user profile model
const userProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: [true, 'User ID is required'],
      unique: true,
      index: true,
      trim: true
    },

    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters long']
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      match: [/\S+@\S+\.\S+/, 'Email is invalid']
    },

    avatar: {
      type: String,
      default: ''
    },

    bio: {
      type: String,
      default: '',
      maxlength: [500, 'Bio cannot exceed 500 characters']
    },

    phone: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

// making the model for the user profile schema
const UserProfile = mongoose.model('UserProfile', userProfileSchema);

export default UserProfile;
