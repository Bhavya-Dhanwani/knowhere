// Importing modules
import mongoose from 'mongoose';

export type ContentItemType = 'video' | 'notes' | 'mcq' | 'coding';

// defining the schema for the ContentItem model
const contentItemSchema = new mongoose.Schema(
  {
    submoduleId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'Submodule ID is required'],
      index: true
    },

    type: {
      type: String,
      enum: ['video', 'notes', 'mcq', 'coding'],
      required: [true, 'ContentItem type is required']
    },

    // plain ObjectId without mongoose ref to enable polymorphic cross-service referencing
    ref_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'Reference ID is required'],
      index: true
    },

    // denormalized fields copied from target service at attach time
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true
    },

    order: {
      type: Number,
      required: [true, 'Order is required'],
      default: 1
    },

    max_score: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

contentItemSchema.index({ submoduleId: 1, order: 1 });

const ContentItem = mongoose.model('ContentItem', contentItemSchema);

export default ContentItem;
