import Submodule, { ISubmoduleContentItem, ISubmoduleDocument } from '../models/submodule.model.js';

class SubmoduleDao {
  SubmoduleModel: typeof Submodule;

  constructor() {
    this.SubmoduleModel = Submodule;
  }

  async createSubmodule(data: {
    title: string;
    creatorId?: string;
    courseId?: string;
    moduleId?: string | null;
    description?: string;
    order?: number;
    content?: ISubmoduleContentItem[];
  }): Promise<ISubmoduleDocument> {
    return await this.SubmoduleModel.create(data);
  }

  async findSubmoduleById(id: string): Promise<ISubmoduleDocument | null> {
    return await this.SubmoduleModel.findById(id);
  }

  async updateSubmoduleById(
    id: string,
    updateData: Record<string, unknown>
  ): Promise<ISubmoduleDocument | null> {
    return await this.SubmoduleModel.findByIdAndUpdate(
      id,
      { $set: updateData },
      { returnDocument: 'after', runValidators: true }
    );
  }

  async findSubmodulesByModuleId(moduleId: string): Promise<ISubmoduleDocument[]> {
    return await this.SubmoduleModel.find({ moduleId }).sort({ order: 1 });
  }

  async findSubmodulesByCourseId(courseId: string): Promise<ISubmoduleDocument[]> {
    return await this.SubmoduleModel.find({ courseId }).sort({ order: 1 });
  }

  async findSubmodulesByIds(ids: string[]): Promise<ISubmoduleDocument[]> {
    return await this.SubmoduleModel.find({ _id: { $in: ids } });
  }

  async countByModuleId(moduleId: string): Promise<number> {
    return await this.SubmoduleModel.countDocuments({ moduleId });
  }

  async deleteSubmoduleById(id: string) {
    return await this.SubmoduleModel.findByIdAndDelete(id);
  }

  async deleteByModuleId(moduleId: string) {
    return await this.SubmoduleModel.deleteMany({ moduleId });
  }

  async listSubmodules(filter: Record<string, unknown> = {}): Promise<ISubmoduleDocument[]> {
    return await this.SubmoduleModel.find(filter).sort({ createdAt: -1 }).limit(200);
  }

  // submodules whose content points at this resource / question
  async findSubmodulesUsingRef(refId: string): Promise<ISubmoduleDocument[]> {
    return await this.SubmoduleModel.find({
      $or: [{ 'content.resourceId': refId }, { 'content.contentId': refId }]
    });
  }
}

export default SubmoduleDao;
