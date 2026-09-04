// Importing modules
import mongoose from 'mongoose';

// defining the schema for the Module model
const moduleSchema = new mongoose.Schema(
  {
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'Course ID is required'],
      index: true
    },

    title: {
      type: String,
      required: [true, 'Module title is required'],
      trim: true
    },

    description: {
      type: String,
      default: ''
    },

    order: {
      type: Number,
      required: [true, 'Order is required'],
      default: 1
    }
  },
  {
    timestamps: true
  }
);

const Module = mongoose.model('Module', moduleSchema);

export default Module;
