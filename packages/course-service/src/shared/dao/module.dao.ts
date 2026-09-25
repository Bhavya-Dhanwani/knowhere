import Module, { IModuleDocument, IModuleReleasePolicy } from '../models/module.model.js';

class ModuleDao {
  ModuleModel: typeof Module;

  constructor() {
    this.ModuleModel = Module;
  }

  async createModule(data: {
    courseId?: string | null;
    title: string;
    description?: string;
    order?: number;
    submoduleIds?: string[];
    durationDays?: number;
    releasePolicy?: IModuleReleasePolicy;
    progressRequirement?: number;
  }): Promise<IModuleDocument> {
    return await this.ModuleModel.create(data);
  }

  async findModuleById(id: string): Promise<IModuleDocument | null> {
    return await this.ModuleModel.findById(id);
  }

  async updateModuleById(
    id: string,
    updateData: Record<string, unknown>
  ): Promise<IModuleDocument | null> {
    return await this.ModuleModel.findByIdAndUpdate(
      id,
      { $set: updateData },
      { returnDocument: 'after', runValidators: true }
    );
  }

  async findModulesByCourseId(courseId: string): Promise<IModuleDocument[]> {
    return await this.ModuleModel.find({ courseId }).sort({ order: 1 });
  }

  async findModulesByIds(ids: string[]): Promise<IModuleDocument[]> {
    return await this.ModuleModel.find({ _id: { $in: ids } });
  }
}

export default ModuleDao;
