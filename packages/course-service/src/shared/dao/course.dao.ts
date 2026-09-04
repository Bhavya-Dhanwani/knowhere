// Importing modules
import Course from '../models/course.model.js';

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
  }) {
    return await this.CourseModel.create(data);
  }

  async findCourseById(id: string) {
    return await this.CourseModel.findById(id);
  }

  async updateCourseById(id: string, updateData: Record<string, unknown>) {
    return await this.CourseModel.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );
  }

  async listCourses(filter: Record<string, unknown> = {}) {
    return await this.CourseModel.find(filter).sort({ createdAt: -1 });
  }
}

export default CourseDao;
