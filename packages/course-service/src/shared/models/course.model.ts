// Importing modules
import mongoose from 'mongoose';

// defining the schema for the Course model
const courseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Course title is required'],
      trim: true,
      minlength: [3, 'Course title must be at least 3 characters long']
    },

    description: {
      type: String,
      default: '',
      trim: true
    },

    instructorId: {
      type: String,
      required: [true, 'Instructor ID is required'],
      index: true
    },

    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft'
    },

    tags: {
      type: [String],
      default: []
    }
  },
  {
    timestamps: true
  }
);

const Course = mongoose.model('Course', courseSchema);

export default Course;
