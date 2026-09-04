// Importing modules
import Module from '../models/module.model.js';

class ModuleDao {
  ModuleModel: typeof Module;

  constructor() {
    this.ModuleModel = Module;
  }

  async createModule(data: {
    courseId: string;
    title: string;
    description?: string;
    order: number;
  }) {
    return await this.ModuleModel.create(data);
  }

  async findModuleById(id: string) {
    return await this.ModuleModel.findById(id);
  }

  async updateModuleById(id: string, updateData: Record<string, unknown>) {
    return await this.ModuleModel.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );
  }

  async findModulesByCourseId(courseId: string) {
    return await this.ModuleModel.find({ courseId }).sort({ order: 1 });
  }
}

export default ModuleDao;
