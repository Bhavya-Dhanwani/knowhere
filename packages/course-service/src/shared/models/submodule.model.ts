// Importing modules
import mongoose from 'mongoose';

// defining the schema for the Submodule model
const submoduleSchema = new mongoose.Schema(
  {
    moduleId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'Module ID is required'],
      index: true
    },

    title: {
      type: String,
      required: [true, 'Submodule title is required'],
      trim: true
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

const Submodule = mongoose.model('Submodule', submoduleSchema);

export default Submodule;
