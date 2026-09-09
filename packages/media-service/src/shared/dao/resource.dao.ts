import Resource, { IResource, ResourceStatus } from '../models/resource.model.js';

class ResourceDao {
  async createResource(data: Partial<IResource>): Promise<IResource> {
    return await Resource.create(data);
  }

  async findResourceById(id: string): Promise<IResource | null> {
    return await Resource.findById(id);
  }

  async findResourceByS3Key(s3Key: string): Promise<IResource | null> {
    return await Resource.findOne({ s3Key });
  }

  async updateResourceStatus(
    id: string,
    status: ResourceStatus,
    extra?: Partial<IResource>
  ): Promise<IResource | null> {
    return await Resource.findByIdAndUpdate(
      id,
      { $set: { status, ...extra } },
      { new: true, runValidators: true }
    );
  }

  async listResourcesByOwner(ownerId: string): Promise<IResource[]> {
    return await Resource.find({ ownerId }).sort({ createdAt: -1 });
  }
}

export default ResourceDao;
