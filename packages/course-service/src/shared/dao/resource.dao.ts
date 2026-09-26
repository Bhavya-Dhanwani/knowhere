import Resource, {
  IResourceDocument,
  ResourceUploadStatus,
  VideoDrmStatus
} from '../models/resource.model.js';

class ResourceDao {
  private resourceModel: typeof Resource;

  constructor() {
    this.resourceModel = Resource;
  }

  async createResource(
    data: Omit<Partial<IResourceDocument>, '_id' | 'createdAt' | 'updatedAt'>
  ): Promise<IResourceDocument> {
    return await this.resourceModel.create(data);
  }

  async findResourceById(id: string): Promise<IResourceDocument | null> {
    return await this.resourceModel.findById(id);
  }

  // includes the HLS encryption key, which is excluded from every other query
  async findResourceWithKey(id: string): Promise<IResourceDocument | null> {
    return await this.resourceModel.findById(id).select('+hlsKey');
  }

  async findResourceByS3Key(s3Key: string): Promise<IResourceDocument | null> {
    return await this.resourceModel.findOne({ s3Key });
  }

  async updateResourceStatus(
    id: string,
    status: ResourceUploadStatus,
    extra?: Partial<IResourceDocument>
  ): Promise<IResourceDocument | null> {
    return await this.resourceModel.findByIdAndUpdate(
      id,
      { $set: { status, ...extra } },
      { returnDocument: 'after' }
    );
  }

  async updateDrmStatus(
    id: string,
    drmStatus: VideoDrmStatus,
    manifestUrl?: string,
    failureReason?: string
  ): Promise<IResourceDocument | null> {
    const updateObj: Record<string, unknown> = { drmStatus };
    if (manifestUrl) updateObj.drmManifestUrl = manifestUrl;
    if (failureReason) updateObj.failureReason = failureReason;

    return await this.resourceModel.findByIdAndUpdate(
      id,
      { $set: updateObj },
      { returnDocument: 'after' }
    );
  }

  async listResourcesByCourseId(courseId: string): Promise<IResourceDocument[]> {
    return await this.resourceModel.find({ courseId }).sort({ createdAt: -1 });
  }

  async findResourcesByIds(ids: string[]): Promise<IResourceDocument[]> {
    return await this.resourceModel.find({ _id: { $in: ids } });
  }

  async listResources(filter: Record<string, unknown> = {}): Promise<IResourceDocument[]> {
    return await this.resourceModel
      .find({ status: { $ne: 'DELETED' }, ...filter })
      .sort({ createdAt: -1 })
      .limit(200);
  }

  async updateResourceById(
    id: string,
    patch: Record<string, unknown>
  ): Promise<IResourceDocument | null> {
    return await this.resourceModel.findByIdAndUpdate(id, { $set: patch }, { new: true });
  }
}

export default ResourceDao;
