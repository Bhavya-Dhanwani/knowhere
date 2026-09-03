// Importing modules
import express from 'express';
import RbacController from './rbac.controller.js';
import { verifyRbacValidators, initialAdminValidators } from './rbac.validator.js';

// making the router
const router = express.Router();

// creating an rbac controller instance
const rbacController = new RbacController();

/*
    @route POST /api/users/rbac/verify
    @desc Verify if a user is authorized with specific roles in a course
    @access Service / Internal / Protected
*/
router.post('/verify', verifyRbacValidators, rbacController.verify);

/*
    @route POST /api/users/rbac/initial-admin
    @desc Register initial admin for a newly created course
    @access Service / Internal / Protected
*/
router.post('/initial-admin', initialAdminValidators, rbacController.registerInitialAdmin);

export default router;
