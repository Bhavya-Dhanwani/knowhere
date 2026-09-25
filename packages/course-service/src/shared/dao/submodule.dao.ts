import Submodule, { ISubmoduleContentItem, ISubmoduleDocument } from '../models/submodule.model.js';

class SubmoduleDao {
  SubmoduleModel: typeof Submodule;

  constructor() {
    this.SubmoduleModel = Submodule;
  }

  async createSubmodule(data: {
    title: string;
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
}

export default SubmoduleDao;
