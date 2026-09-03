// Importing modules
import mongoose from 'mongoose';
import {
  VALID_COURSE_ROLES,
  COURSE_ROLES,
  MEMBERSHIP_STATUS
} from '../constants/roles.constants.js';

// defining the schema for course membership (multi-tenant ARBAC)
const courseMembershipSchema = new mongoose.Schema(
  {
    courseId: {
      type: String,
      required: [true, 'Course ID is required'],
      index: true,
      trim: true
    },

    userId: {
      type: String,
      required: [true, 'User ID is required'],
      index: true,
      trim: true
    },

    role: {
      type: String,
      enum: {
        values: VALID_COURSE_ROLES,
        message: '{VALUE} is not a valid course role'
      },
      required: [true, 'Course role is required'],
      default: COURSE_ROLES.TRAINEE
    },

    status: {
      type: String,
      enum: [MEMBERSHIP_STATUS.ACTIVE, MEMBERSHIP_STATUS.SUSPENDED],
      default: MEMBERSHIP_STATUS.ACTIVE
    },

    assignedBy: {
      type: String,
      required: [true, 'AssignedBy user ID is required'],
      trim: true
    },

    assignedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Compound unique index ensuring one role per user per course tenant
courseMembershipSchema.index({ courseId: 1, userId: 1 }, { unique: true });

// making the model for the course membership schema
const CourseMembership = mongoose.model('CourseMembership', courseMembershipSchema);

export default CourseMembership;
