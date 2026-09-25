import Course, {
  ICourseDocument,
  ICourseModuleEntry,
  ICourseSettings
} from '../models/course.model.js';

class CourseDao {
  CourseModel: typeof Course;

  constructor() {
    this.CourseModel = Course;
  }

  async createCourse(data: {
    title: string;
    description?: string;
    instructorId: string;
    status?: 'draft' | 'published' | 'archived';
    tags?: string[];
    modules?: ICourseModuleEntry[];
    settings?: Partial<ICourseSettings>;
  }): Promise<ICourseDocument> {
    return await this.CourseModel.create(data);
  }

  async findCourseById(id: string): Promise<ICourseDocument | null> {
    return await this.CourseModel.findById(id);
  }

  async updateCourseById(
    id: string,
    updateData: Record<string, unknown>
  ): Promise<ICourseDocument | null> {
    return await this.CourseModel.findByIdAndUpdate(
      id,
      { $set: updateData },
      { returnDocument: 'after', runValidators: true }
    );
  }

  async addModuleToCourse(
    courseId: string,
    entry: ICourseModuleEntry
  ): Promise<ICourseDocument | null> {
    // Check if module already exists in course
    const course = await this.CourseModel.findById(courseId);
    if (!course) return null;

    const existingIndex = course.modules.findIndex(
      (m) => m.moduleId.toString() === entry.moduleId.toString()
    );

    if (existingIndex >= 0) {
      // update existing entry
      course.modules[existingIndex] = entry;
    } else {
      course.modules.push(entry);
    }

    course.modules.sort((a, b) => a.order - b.order);
    return await course.save();
  }

  async listCourses(filter: Record<string, unknown> = {}): Promise<ICourseDocument[]> {
    return await this.CourseModel.find(filter).sort({ createdAt: -1 });
  }
}

export default CourseDao;
