// Importing modules
import express from 'express';
import ProfileController from './profile.controller.js';
import { updateProfileValidators } from './profile.validator.js';
import authMiddleware from '../../shared/middlewares/auth.middleware.js';

// making the router
const router = express.Router();

// creating a profile controller instance
const profileController = new ProfileController();

/*
    @route GET /api/users/profile/me
    @desc Get current user profile and memberships
    @access Private
*/
router.get('/me', authMiddleware, profileController.me);

/*
    @route PUT /api/users/profile/me
    @desc Update current user profile
    @access Private
*/
router.put('/me', authMiddleware, updateProfileValidators, profileController.updateMe);

/*
    @route GET /api/users/profile/:userId
    @desc Get user profile by userId
    @access Private
*/
router.get('/:userId', authMiddleware, profileController.getProfileById);

/*
    @route PUT /api/users/profile/:userId
    @desc Update user profile by userId (self or admin)
    @access Private
*/
router.put(
  '/:userId',
  authMiddleware,
  updateProfileValidators,
  profileController.updateProfileById
);

export default router;
