// Importing modules
import express, { Request, Response } from 'express';
import Ok from '../responses/Ok.response.js';

// Making the express router
const router = express.Router();

/*
    @route GET /api/health
    @desc checks server health
    @access Public
*/
router.get('/', (req: Request, res: Response) => {
  return Ok(res, 'Course service is healthy', {
    status: 'UP',
    service: 'courseService',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

export default router;
