// Importing modules
import ContentItem, { ContentItemType } from '../models/contentItem.model.js';

class ContentItemDao {
  ContentItemModel: typeof ContentItem;

  constructor() {
    this.ContentItemModel = ContentItem;
  }

  // attach content item
  async createContentItem(data: {
    submoduleId: string;
    type: ContentItemType;
    ref_id: string;
    title: string;
    order: number;
    max_score?: number;
  }) {
    return await this.ContentItemModel.create(data);
  }

  // find single content item by ID
  async findContentItemById(id: string) {
    return await this.ContentItemModel.findById(id);
  }

  // cheap list call: single collection query by submoduleId, sorted by order
  async listContentItemsBySubmoduleId(submoduleId: string) {
    return await this.ContentItemModel.find({ submoduleId }).sort({ order: 1 });
  }

  // update content item
  async updateContentItemById(id: string, updateData: Record<string, unknown>) {
    return await this.ContentItemModel.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );
  }

  // delete content item
  async deleteContentItemById(id: string) {
    return await this.ContentItemModel.findByIdAndDelete(id);
  }
}

export default ContentItemDao;
