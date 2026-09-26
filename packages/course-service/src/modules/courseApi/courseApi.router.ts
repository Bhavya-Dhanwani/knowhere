import express from 'express';
import CourseApiController from './courseApi.controller.js';
import LibraryController from './library.controller.js';
import {
  uploadResourceValidators,
  createMcqValidators,
  createCodeQuestionValidators,
  createSubmoduleValidators,
  createModuleValidators,
  createCourseValidators,
  addModuleValidators,
  checkMcqValidators,
  idParamValidators,
  runCodeValidators,
  courseModuleValidators,
  reorderModulesValidators
} from './courseApi.validator.js';
import authMiddleware from '../../shared/middlewares/auth.middleware.js';
import requireRole from '../../shared/middlewares/role.middleware.js';

const router = express.Router();
const courseApiController = new CourseApiController();
const libraryController = new LibraryController();

// authoring is staff-only; consuming content is open to every signed-in role
const staff = [authMiddleware, requireRole('admin', 'trainer')];
const anyRole = [authMiddleware, requireRole('admin', 'trainer', 'trainee')];

/*
    ======================== AUTHORING (Trainer, Admin) ========================
    Build bottom-up: resources & questions -> submodule -> module -> course.
*/

// @route POST /api/course/upload-resource — presigned S3 upload, saved as PENDING_UPLOAD
router.post(
  '/upload-resource',
  staff,
  uploadResourceValidators,
  courseApiController.uploadResource
);

// @route POST /api/course/mcq — 4 options, correct answer, explanation, optional attachments
router.post('/mcq', staff, createMcqValidators, courseApiController.createMcq);

// @route POST /api/course/code-question — up to 5 examples, up to 100 test cases (AI-assisted)
router.post(
  '/code-question',
  staff,
  createCodeQuestionValidators,
  courseApiController.createCodeQuestion
);

// @route POST /api/course/submodule — ordered list of resources, videos, MCQs, coding questions
router.post('/submodule', staff, createSubmoduleValidators, courseApiController.createSubmodule);

// @route POST /api/course/module — submodules + relative deadline (durationDays)
router.post('/module', staff, createModuleValidators, courseApiController.createModule);

// @route POST /api/course — course with zero or more modules
router.post('/', staff, createCourseValidators, courseApiController.createCourse);

// @route POST /api/course/add-module — attach a module, optionally scheduling its release
router.post('/add-module', staff, addModuleValidators, courseApiController.addModule);

// @route GET /api/course/library — everything available to pick when assembling (UI helper)
router.get('/library', staff, courseApiController.getLibrary);

/*
    ================= EDIT / DELETE (Trainer: own content, Admin: all) =================
    Deleting anything still referenced (e.g. an MCQ inside a submodule) returns 409.
*/
const editRoutes: [
  string,
  keyof LibraryController,
  keyof LibraryController,
  (keyof LibraryController)?
][] = [
  ['resource', 'updateResource', 'deleteResource'],
  ['mcq', 'updateMcq', 'deleteMcq', 'getMcqForEdit'],
  ['code-question', 'updateCodeQuestion', 'deleteCodeQuestion', 'getCodeQuestionForEdit'],
  ['submodule', 'updateSubmodule', 'deleteSubmodule', 'getSubmodule'],
  ['module', 'updateModule', 'deleteModule', 'getModule']
];
for (const [path, update, remove, read] of editRoutes) {
  if (read) router.get(`/${path}/:id/edit`, staff, idParamValidators, libraryController[read]);
  router.put(`/${path}/:id`, staff, idParamValidators, libraryController[update]);
  router.delete(`/${path}/:id`, staff, idParamValidators, libraryController[remove]);
}

// @route POST /api/course/remove-module — detach a module from a course
router.post('/remove-module', staff, courseModuleValidators, libraryController.removeModule);

// @route PUT /api/course/reorder-modules — set a course's module order
router.put('/reorder-modules', staff, reorderModulesValidators, libraryController.reorderModules);

/*
    ======================== LEARNING (any signed-in role) ========================
*/

// @route GET /api/course/mcq/:id — question + options only
router.get('/mcq/:id', anyRole, idParamValidators, courseApiController.getMcq);

// @route GET /api/course/code-question/:id — problem statement without hidden tests (UI helper)
router.get('/code-question/:id', anyRole, idParamValidators, courseApiController.getCodeQuestion);

// @route POST /api/course/code-question/:id/run — run code against the public examples
router.post(
  '/code-question/:id/run',
  anyRole,
  runCodeValidators,
  courseApiController.runCodeQuestion
);

// @route GET /api/course/video/:id — byte-range video chunks tied to the viewer's email
router.get('/video/:id', anyRole, idParamValidators, courseApiController.streamVideo);

// @route GET /api/course/video/:id/hls.m3u8 — AES-128 encrypted HLS playlist (signed segment URLs)
router.get('/video/:id/hls.m3u8', anyRole, idParamValidators, courseApiController.hlsPlaylist);

// @route GET /api/course/video/:id/seg/:file — HLS segment; the signed ?t= token is the credential
router.get('/video/:id/seg/:file', idParamValidators, courseApiController.hlsSegment);

// @route GET /api/course/video/:id/source — signed URL to the original upload (native range streaming)
router.get('/video/:id/source', anyRole, idParamValidators, courseApiController.videoSource);

// @route GET /api/course/video/:id/key — decryption key, released only to viewers with access
router.get('/video/:id/key', anyRole, idParamValidators, courseApiController.hlsKey);

// @route GET /api/course/resource/:id — non-video file via short-lived download URL
router.get('/resource/:id', anyRole, idParamValidators, courseApiController.getResource);

// @route POST /api/course/chk-mcq — check an answer and record the attempt
router.post('/chk-mcq', anyRole, checkMcqValidators, courseApiController.checkMcq);

export default router;
