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
    },

    // shareable profile at domain.com/<username>
    username: { type: String, trim: true, lowercase: true, unique: true, sparse: true },
    // platform role, kept in sync from the access token (shown on the public profile)
    role: { type: String, enum: ['trainee', 'trainer', 'admin'], default: 'trainee' },
    // public: anyone with the link; members: signed-in users; private: only the owner
    visibility: { type: String, enum: ['public', 'members', 'private'], default: 'public' },
    headline: { type: String, default: '', maxlength: 120 },
    location: { type: String, default: '', maxlength: 80 },
    links: [{ _id: false, label: String, url: String }],
    skills: [String],
    interests: [String],
    qualifications: [
      {
        _id: false,
        degree: String,
        field: String,
        institution: String,
        startYear: Number,
        endYear: Number,
        grade: String
      }
    ],
    experience: [
      {
        _id: false,
        title: String,
        organization: String,
        location: String,
        // YYYY-MM; an empty endDate means "present"
        startDate: String,
        endDate: String,
        description: String
      }
    ],
    certificates: [
      {
        _id: false,
        name: String,
        issuer: String,
        issuedOn: String,
        credentialId: String,
        url: String
      }
    ]
  },
  {
    timestamps: true
  }
);

// making the model for the user profile schema
const UserProfile = mongoose.model('UserProfile', userProfileSchema);

export default UserProfile;
