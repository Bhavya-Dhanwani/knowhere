// Importing modules
import Submodule from '../models/submodule.model.js';

class SubmoduleDao {
  SubmoduleModel: typeof Submodule;

  constructor() {
    this.SubmoduleModel = Submodule;
  }

  async createSubmodule(data: { moduleId: string; title: string; order: number }) {
    return await this.SubmoduleModel.create(data);
  }

  async findSubmoduleById(id: string) {
    return await this.SubmoduleModel.findById(id);
  }

  async updateSubmoduleById(id: string, updateData: Record<string, unknown>) {
    return await this.SubmoduleModel.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );
  }

  async findSubmodulesByModuleId(moduleId: string) {
    return await this.SubmoduleModel.find({ moduleId }).sort({ order: 1 });
  }
}

export default SubmoduleDao;
