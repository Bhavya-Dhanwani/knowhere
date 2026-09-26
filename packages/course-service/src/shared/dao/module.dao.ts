import Module, { IModuleDocument, IModuleReleasePolicy } from '../models/module.model.js';

class ModuleDao {
  ModuleModel: typeof Module;

  constructor() {
    this.ModuleModel = Module;
  }

  async createModule(data: {
    courseId?: string | null;
    creatorId?: string;
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

  async countByCourseId(courseId: string): Promise<number> {
    return await this.ModuleModel.countDocuments({ courseId });
  }

  async deleteModuleById(id: string) {
    return await this.ModuleModel.findByIdAndDelete(id);
  }

  async listModules(filter: Record<string, unknown> = {}): Promise<IModuleDocument[]> {
    return await this.ModuleModel.find(filter).sort({ createdAt: -1 }).limit(200);
  }

  async findModulesUsingSubmodule(submoduleId: string): Promise<IModuleDocument[]> {
    return await this.ModuleModel.find({ submoduleIds: submoduleId });
  }
}

export default ModuleDao;
