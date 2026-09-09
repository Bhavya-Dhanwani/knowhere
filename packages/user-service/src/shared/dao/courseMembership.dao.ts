// Importing modules
import CourseMembership from '../models/courseMembership.model.js';
import { CourseRole, MembershipStatus } from '../constants/roles.constants.js';

// class to handle course membership data access operations
class CourseMembershipDao {
  CourseMembershipModel: typeof CourseMembership;

  constructor() {
    this.CourseMembershipModel = CourseMembership;
  }

  // function to create or assign a role to a user in a course
  async assignMembership(data: {
    courseId: string;
    userId: string;
    role: CourseRole;
    assignedBy: string;
    status?: MembershipStatus;
  }) {
    return await this.CourseMembershipModel.findOneAndUpdate(
      { courseId: data.courseId, userId: data.userId },
      {
        role: data.role,
        assignedBy: data.assignedBy,
        assignedAt: new Date(),
        ...(data.status && { status: data.status })
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  // function to find a specific membership by courseId and userId
  async findMembership(courseId: string, userId: string) {
    return await this.CourseMembershipModel.findOne({ courseId, userId });
  }

  // function to list all members of a course
  async findMembersByCourse(courseId: string, role?: string) {
    const query: Record<string, unknown> = { courseId };
    if (role) {
      query.role = role;
    }
    return await this.CourseMembershipModel.find(query).sort({ createdAt: -1 });
  }

  // function to list all courses for a user
  async findCoursesByUser(userId: string, status?: string) {
    const query: Record<string, unknown> = { userId };
    if (status) {
      query.status = status;
    }
    return await this.CourseMembershipModel.find(query).sort({ createdAt: -1 });
  }

  // function to count admins in a course (for safe revocation)
  async countAdminsInCourse(courseId: string) {
    return await this.CourseMembershipModel.countDocuments({
      courseId,
      role: 'admin',
      status: 'active'
    });
  }

  async countMembershipsInCourse(courseId: string) {
    return await this.CourseMembershipModel.countDocuments({ courseId });
  }

  async findAnyActiveMembership(userId: string, roles: string[]) {
    return await this.CourseMembershipModel.findOne({
      userId,
      status: 'active',
      role: { $in: roles }
    });
  }

  // function to update a member's role or status
  async updateMembership(
    courseId: string,
    userId: string,
    updateData: Partial<{ role: CourseRole; status: MembershipStatus }>
  ) {
    return await this.CourseMembershipModel.findOneAndUpdate({ courseId, userId }, updateData, {
      new: true
    });
  }

  // function to revoke/delete membership from a course
  async removeMembership(courseId: string, userId: string) {
    return await this.CourseMembershipModel.findOneAndDelete({ courseId, userId });
  }
}

export default CourseMembershipDao;
