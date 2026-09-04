// Importing modules
import mongoose from 'mongoose';

// defining the schema for the competency model
const competencySchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: [true, 'User ID is required'],
      index: true,
      trim: true
    },

    skill: {
      type: String,
      required: [true, 'Skill is required'],
      trim: true
    },

    level: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      required: [true, 'Level is required'],
      default: 'beginner'
    },

    score: {
      type: Number,
      default: 0,
      min: [0, 'Score cannot be less than 0'],
      max: [100, 'Score cannot exceed 100']
    },

    verifiedBy: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

// compound index to ensure one record per user per skill
competencySchema.index({ userId: 1, skill: 1 }, { unique: true });

// making the model for the competency schema
const Competency = mongoose.model('Competency', competencySchema);

export default Competency;
