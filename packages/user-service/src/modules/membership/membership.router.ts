// Importing modules
import express from 'express';
import MembershipController from './membership.controller.js';
import { assignMemberValidators, updateRoleValidators } from './membership.validator.js';
import authMiddleware from '../../shared/middlewares/auth.middleware.js';
import requireCourseRole from '../../shared/middlewares/arbac.middleware.js';
import { COURSE_ROLES } from '../../shared/constants/roles.constants.js';
import { serviceOrUserAuth } from '@lms/shared';

// making the router (mergeParams enabled for :courseId from parent mount)
const router = express.Router({ mergeParams: true });

// creating a membership controller instance
const membershipController = new MembershipController();

/*
    @route GET /api/memberships/courses/:courseId/my-role
    @desc Get current user's role in the course
    @access Private (Member)
*/
router.get('/my-role', authMiddleware, membershipController.getMyCourseRole);

/*
    @route GET /api/memberships/courses/:courseId/members
    @desc List all members of a course
    @access Private (Course Admin & Trainer)
*/
router.get(
  '/members',
  serviceOrUserAuth('memberships:read'),
  requireCourseRole([COURSE_ROLES.ADMIN, COURSE_ROLES.TRAINER]),
  membershipController.listMembers
);

/*
    @route POST /api/memberships/courses/:courseId/members
    @desc Assign / enroll a user to a course with role (ARBAC)
    @access Private (Course Admin)
*/
router.post(
  '/members',
  serviceOrUserAuth('memberships:write'),
  requireCourseRole([COURSE_ROLES.ADMIN]),
  assignMemberValidators,
  membershipController.assignMember
);

/*
    @route PUT /api/memberships/courses/:courseId/members/:userId/role
    @desc Update a member's role in the course (ARBAC)
    @access Private (Course Admin)
*/
router.put(
  '/members/:userId/role',
  authMiddleware,
  requireCourseRole([COURSE_ROLES.ADMIN]),
  updateRoleValidators,
  membershipController.updateMemberRole
);

/*
    @route DELETE /api/memberships/courses/:courseId/members/:userId
    @desc Revoke / remove a member from the course (ARBAC)
    @access Private (Course Admin)
*/
router.delete(
  '/members/:userId',
  authMiddleware,
  requireCourseRole([COURSE_ROLES.ADMIN]),
  membershipController.revokeMember
);

export default router;
