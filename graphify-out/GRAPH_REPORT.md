# Graph Report - knowhere  (2026-09-26)

## Corpus Check
- Large corpus: 598 files · ~178,862 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 3368 nodes · 7234 edges · 172 communities (142 shown, 30 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 54 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Root Config
- Frontend Lms
- Mcq Question
- Design System Primitives
- Shared App Error
- Chat Frontend
- Content Library
- Project Review UI
- Shared Judge
- Package Dependencies
- Course Course Api
- Project-Review Evaluation
- Frontend Dependencies
- Auth Dependencies
- Course Dependencies
- Course S3
- Course Library
- Course Submodule
- Project-Review Discovery
- Media Dependencies
- Project-Review Dependencies
- Course Course Api (2)
- Coding Dependencies
- Mcq Dependencies
- User Dependencies
- Chat Dependencies
- Course Course
- Chat Redis
- Chat Community
- Course Access
- Media Auth
- K8s Service Topology
- Frontend Dependencies (2)
- Media Resource
- Project-Review Review
- Shared Dependencies
- Root Config (2)
- Auth App
- Course Course Api (3)
- Auth UI & Session
- Project-Review Types
- Course Viewer
- User Roles
- Auth Conflict
- Course Seed
- Project-Review Types (2)
- Media S3
- Project-Review Types (3)
- Project-Review Evaluation (2)
- Project-Review Delimiter
- Auth Dependencies (2)
- User Conflict
- Course Activity Analysis
- Auth Dependencies (3)
- Auth Auth
- User Profile
- Course Dependencies (2)
- Course Code Question
- Course Resource
- Mcq Env
- Auth Auth (2)
- Root Config (3)
- Chat Dependencies (2)
- Coding Dependencies (2)
- Coding Env
- Coding Auth
- Course Dependencies (3)
- Project-Review Sandbox
- Frontend TS Config
- Mcq Dependencies (2)
- Media Dependencies (2)
- Project-Review Dependencies (2)
- User Dependencies (2)
- Auth Auth (3)
- Course Mcq
- Course Module
- Media Dependencies (3)
- Media Resource (2)
- Project-Review Dependencies (3)
- Project-Review Index
- Chat Dependencies (3)
- Coding Question
- Coding Submission
- Project-Review Sanitization Audit
- Coding Dependencies (3)
- Coding Question (2)
- Mcq Dependencies (3)
- Project-Review Key Pool
- User Dependencies (3)
- User Competency
- Project-Review TS Config
- Auth TS Config
- Chat TS Config
- Coding Question (3)
- Coding Status Codes
- Coding TS Config
- Course TS Config
- Mcq TS Config
- Media TS Config
- User Competency (2)
- User TS Config
- Auth Tokens
- Auth Google Auth
- Course Mcq Attempt
- Auth Session
- Chat Community (2)
- Chat Room
- Course Learner Module Progress
- Project-Review Server
- Tsconfig.Base TS Config
- Project-Review Review (2)
- User Profile (2)
- Auth User
- Auth Token
- Frontend Course
- Auth Hashing
- Frontend TS Config (2)
- Judge-Runner Dependencies
- User Membership
- User Course Membership
- User Bad Request
- Chat Message
- Coding Roles
- Course Roles
- Frontend Activity Heatmap
- Mcq Roles
- Media Roles
- Project-Review Export
- Shared TS Config
- Auth Dependencies (4)
- Chat Dependencies (4)
- Coding Dependencies (4)
- Course Dependencies (4)
- Mcq Dependencies (4)
- Media Dependencies (4)
- Project-Review Dependencies (4)
- User Dependencies (4)
- Judge-Runner Check
- Project-Review Review (3)
- Auth Dependencies (5)
- Coding Dependencies (5)
- Course Dependencies (5)
- Course Mistral Generator
- Frontend Dashboard
- Mcq Dependencies (5)
- Media Dependencies (5)
- Shared Logger
- User Dependencies (5)
- Frontend Tailwind
- Project-Review Discovery (2)
- .Husky Pre Commit
- Frontend Cloudfront S3 Template
- Frontend Deploy S3

## God Nodes (most connected - your core abstractions)
1. `cn()` - 109 edges
2. `react` - 78 edges
3. `lucide-react` - 51 edges
4. `NotFound` - 40 edges
5. `Ok()` - 38 edges
6. `react-router` - 32 edges
7. `ReviewController` - 30 edges
8. `NotFound` - 28 edges
9. `getId()` - 26 edges
10. `@tanstack/react-query` - 25 edges

## Surprising Connections (you probably didn't know these)
- `k8s auth-service` --enforces--> `Platform role in JWT (trainee/trainer/admin)`  [INFERRED]
  k8s/auth-service.yml → packages/auth-service/src/shared/utils/buildTokenPayload.util.ts
- `k8s course-service` --enforces--> `Platform role in JWT (trainee/trainer/admin)`  [INFERRED]
  k8s/course-service.yml → packages/auth-service/src/shared/utils/buildTokenPayload.util.ts
- `k8s user-service` --enforces--> `Platform role in JWT (trainee/trainer/admin)`  [INFERRED]
  k8s/user-service.yml → packages/auth-service/src/shared/utils/buildTokenPayload.util.ts
- `createApp()` --indirect_call--> `notFoundHandler()`  [INFERRED]
  packages/auth-service/src/app.ts → packages/auth-service/src/shared/middlewares/NotFound.middleware.ts
- `createApp()` --indirect_call--> `notFoundHandler()`  [INFERRED]
  packages/coding-service/src/app.ts → packages/coding-service/src/shared/middlewares/NotFound.middleware.ts

## Import Cycles
- None detected.

## Communities (172 total, 30 thin omitted)

### Community 0 - "Root Config"
Cohesion: 0.05
Nodes (69): ensureSession(), requireAuth(), requireGuest(), requireRole(), toLogin(), store, call(), Payload (+61 more)

### Community 1 - "Frontend Lms"
Cohesion: 0.06
Nodes (55): AppDispatch, RootState, AdminDashboardPage(), Overview(), roleMeta, Section, sectionFromPath(), statusVariant (+47 more)

### Community 2 - "Mcq Question"
Cohesion: 0.05
Nodes (40): QuestionController, questionController, router, createQuestionValidators, getQuestionDisplayValidators, submitAttemptValidators, getQuestionById(), questionDao (+32 more)

### Community 3 - "Design System Primitives"
Cohesion: 0.06
Nodes (50): router, InlineEdit(), AuthLayoutProps, highlights, MembersPanel(), ProfileCard(), bars, heat (+42 more)

### Community 4 - "Shared App Error"
Cohesion: 0.06
Nodes (40): AppError, BadRequestError, ConflictError, ForbiddenError, NotFoundError, UnauthorizedError, ValidationError, authMiddleware() (+32 more)

### Community 5 - "Chat Frontend"
Cohesion: 0.08
Nodes (46): Access, AppNotification, Attachment, Channel, ChannelKind, communityApi, Member, Message (+38 more)

### Community 6 - "Content Library"
Cohesion: 0.06
Nodes (47): CoursesSection(), API_TYPE, ContentLibraryPage(), statusVariant(), Tab, TABS, ALL_LANGUAGES, CODE_LANGUAGES (+39 more)

### Community 7 - "Project Review UI"
Cohesion: 0.09
Nodes (43): CreateEventPayload, CreateSubmissionPayload, reviewApi, CRITERIA_PRESETS, Criterion, CriterionScoreResult, DEFAULT_DIMENSION_WEIGHTS, DeterministicMetrics (+35 more)

### Community 8 - "Shared Judge"
Cohesion: 0.05
Nodes (47): head(), judge(), LANGS, PORT, sandbox(), server, tail(), WORKERS (+39 more)

### Community 9 - "Package Dependencies"
Cohesion: 0.04
Nodes (39): devDependencies, eslint, husky, lint-staged, prettier, secretlint, @secretlint/secretlint-rule-preset-recommend, typescript (+31 more)

### Community 10 - "Course Course Api"
Cohesion: 0.07
Nodes (36): anyRole, courseController, router, staff, courseIdValidators, createCourseValidators, updateCourseValidators, anyRole (+28 more)

### Community 11 - "Project-Review Evaluation"
Cohesion: 0.10
Nodes (35): RFC-4180, CriterionScoreResultSchema, ICriterionScoreResult, IJudgeOverride, IRequirementComplianceResult, IReviewEvaluation, JudgeOverrideSchema, RequirementComplianceResultSchema (+27 more)

### Community 12 - "Frontend Dependencies"
Cohesion: 0.06
Nodes (35): socket.io-client, typescript, name, private, type, version, App(), queryClient (+27 more)

### Community 13 - "Auth Dependencies"
Cohesion: 0.05
Nodes (42): description, compression, cookie-parser, cors, dotenv, eslint, express, express-validator (+34 more)

### Community 14 - "Course Dependencies"
Cohesion: 0.05
Nodes (42): description, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, compression, cookie-parser, cors, dotenv, eslint (+34 more)

### Community 15 - "Course S3"
Cohesion: 0.08
Nodes (20): startServer(), createApp(), GenerateTestCasesInput, GenerationResult, S3ObjectMeta, s3Service, StreamOptions, videoStreamService (+12 more)

### Community 16 - "Course Library"
Cohesion: 0.15
Nodes (12): CourseApiController, param(), assertOwner(), assertScoring(), assertUnused(), LibraryController, pick(), assertContentAccess() (+4 more)

### Community 17 - "Course Submodule"
Cohesion: 0.08
Nodes (20): codeDao, ITEM_MAX_SCORE, mcqDao, moduleDao, OutlineItem, resourceDao, submoduleDao, CourseProgressDao (+12 more)

### Community 18 - "Project-Review Discovery"
Cohesion: 0.08
Nodes (29): MediaAssetItemSchema, PageCatalogItemSchema, ProjectDeepDiscoverySchema, RawProjectInput, ExtractedClaimsZodSchema, defaultKeyPool, KeyStatus, DimensionEvaluationSchema (+21 more)

### Community 19 - "Media Dependencies"
Cohesion: 0.05
Nodes (40): description, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, compression, cookie-parser, cors, dotenv, eslint (+32 more)

### Community 20 - "Project-Review Dependencies"
Cohesion: 0.05
Nodes (40): description, compression, cookie-parser, cors, dotenv, eslint, express, express-validator (+32 more)

### Community 21 - "Course Course Api (2)"
Cohesion: 0.09
Nodes (33): AddModuleBody, AddModuleRequest, CheckMcqBody, CheckMcqRequest, CreateCodeQuestionBody, CreateCodeQuestionRequest, CreateCourseBody, CreateCourseRequest (+25 more)

### Community 22 - "Coding Dependencies"
Cohesion: 0.05
Nodes (38): description, compression, cookie-parser, cors, dotenv, eslint, express, express-validator (+30 more)

### Community 23 - "Mcq Dependencies"
Cohesion: 0.05
Nodes (38): description, compression, cookie-parser, cors, dotenv, eslint, express, express-validator (+30 more)

### Community 24 - "User Dependencies"
Cohesion: 0.05
Nodes (38): description, compression, cookie-parser, cors, dotenv, eslint, express, express-validator (+30 more)

### Community 25 - "Chat Dependencies"
Cohesion: 0.05
Nodes (36): description, compression, cookie-parser, cors, dotenv, eslint, express, helmet (+28 more)

### Community 26 - "Course Course"
Cohesion: 0.11
Nodes (19): hiddenError(), param(), percent(), ProgressController, loadCourseOutline(), outlineItems(), outlineMaxScore(), CourseDao (+11 more)

### Community 27 - "Chat Redis"
Cohesion: 0.14
Nodes (23): startServer(), createApp(), connectDB(), envSchema, parsedEnv, logger, envConstants, addOnlineUser() (+15 more)

### Community 28 - "Chat Community"
Cohesion: 0.10
Nodes (29): Actor, archiveChannel(), canSeeChannel(), channelAccess(), communityAccess, createChannel(), DEFAULT_CHANNELS, deleteMessage() (+21 more)

### Community 29 - "Course Access"
Cohesion: 0.12
Nodes (19): CourseController, param(), assertCanManageCourse(), canManageCourse(), courseDao, courseRoleOf(), LearnerView, memberships (+11 more)

### Community 30 - "Media Auth"
Cohesion: 0.14
Nodes (14): StatusCodes, Conflict, Forbidden, NotFound, Unauthorized, AuthenticatedRequest, authMiddleware(), AuthUser (+6 more)

### Community 31 - "K8s Service Topology"
Cohesion: 0.11
Nodes (32): Platform role in JWT (trainee/trainer/admin), knowhere-ingress (nginx), Kustomization, MongoDB, Redis, Skaffold dev pipeline, k8s auth-service, k8s chat-service (+24 more)

### Community 32 - "Frontend Dependencies (2)"
Cohesion: 0.06
Nodes (32): dependencies, axios, clsx, hls.js, livekit-client, lucide-react, motion, react (+24 more)

### Community 33 - "Media Resource"
Cohesion: 0.11
Nodes (18): handler(), S3Event, S3EventRecord, EventBridgeEvent, EventBridgeMediaConvertDetail, handler(), ResourceController, getResourceById() (+10 more)

### Community 34 - "Project-Review Review"
Cohesion: 0.15
Nodes (3): getId(), ReviewController, NotFound

### Community 35 - "Shared Dependencies"
Cohesion: 0.06
Nodes (30): dependencies, express, jsonwebtoken, pino, pino-http, zod, devDependencies, @types/express (+22 more)

### Community 36 - "Root Config (2)"
Cohesion: 0.16
Nodes (17): packages_shared_dist_index, packages_shared_dist_index_accesspublickey, packages_shared_dist_index_servicetoken, packages_shared_dist_index_servicetokensecret, packages_shared_dist_index_signaccesstoken, startServer(), createApp(), connectDB() (+9 more)

### Community 37 - "Auth App"
Cohesion: 0.13
Nodes (17): startServer(), createApp(), frontendIndex, publicDirectory, serverDirectory, connectDB(), envSchema, parsedEnv (+9 more)

### Community 38 - "Course Course Api (3)"
Cohesion: 0.15
Nodes (9): assertAllFound(), StatusCodes, BadRequest, validate(), Created(), NoContent(), ApiError, ApiResponse() (+1 more)

### Community 39 - "Auth UI & Session"
Cohesion: 0.17
Nodes (19): authApi, FormError(), GoogleButton(), OrDivider(), PasswordInput, DEMO_ACCOUNTS, passwordScore(), ROLES (+11 more)

### Community 40 - "Project-Review Types"
Cohesion: 0.15
Nodes (17): ICriterion, IRequirement, IEvidence, QualitativeAnalysisAgent, ExtractedNeutralClaims, ScoringEngine, CriterionScore, CriterionScoreSchema (+9 more)

### Community 41 - "Course Viewer"
Cohesion: 0.12
Nodes (19): AddModuleDialog(), CourseEditorPage(), fmt(), contentApi, flattenItems(), OutlineItem, structureKey(), useCompleteItem() (+11 more)

### Community 42 - "User Roles"
Cohesion: 0.16
Nodes (18): membershipController, assignMemberValidators, updateRoleValidators, ARBAC_CAN_ASSIGN, ARBAC_CAN_REVOKE, COURSE_ROLES, CourseRole, MEMBERSHIP_STATUS (+10 more)

### Community 43 - "Auth Conflict"
Cohesion: 0.16
Nodes (10): HTTP_STATUS, Conflict, Forbidden, NotFound, adminMiddleware(), notFoundHandler(), Created(), NoContent() (+2 more)

### Community 44 - "Course Seed"
Cohesion: 0.11
Nodes (21): INotification, Notification, NotificationSchema, NotificationType, IReadState, ReadState, ReadStateSchema, ago() (+13 more)

### Community 45 - "Project-Review Types (2)"
Cohesion: 0.19
Nodes (16): IRelativeComparison, IRelativeGrading, ISelfImprovement, ISelfStrengths, RankingBoundaryDetector, RankingBoundaryPair, PairwiseEngine, BradleyTerryRating (+8 more)

### Community 46 - "Media S3"
Cohesion: 0.15
Nodes (12): startServer(), createApp(), S3Service, connectDB(), envSchema, parsedEnv, logger, envConstants (+4 more)

### Community 47 - "Project-Review Types (3)"
Cohesion: 0.18
Nodes (12): ProjectDeepDiscovery, BackendEvalRunner, CodeAnalysisRunner, ProjectDiscoveryRunner, FrontendEvalRunner, BackendEvalResult, CodeAnalysisResult, DiscoveryResult (+4 more)

### Community 48 - "Project-Review Evaluation (2)"
Cohesion: 0.16
Nodes (6): EvaluationLogger, EvaluationActivities, ActivityExecutionSnapshot, EvaluationWorkflowInput, EvaluationWorkflowResult, WorkflowRunner

### Community 49 - "Project-Review Delimiter"
Cohesion: 0.21
Nodes (10): MistralExtractionAgent, DelimiterService, ExtractionService, InjectionDetectorService, InjectionPattern, SanitizationFacade, InjectionDetectionResult, SanitizationResult (+2 more)

### Community 50 - "Auth Dependencies (2)"
Cohesion: 0.09
Nodes (22): devDependencies, eslint, jest, pino-pretty, prettier, supertest, ts-jest, tsx (+14 more)

### Community 51 - "User Conflict"
Cohesion: 0.20
Nodes (8): StatusCodes, Conflict, NotFound, notFoundHandler(), Created(), NoContent(), ApiError, ApiResponse()

### Community 52 - "Course Activity Analysis"
Cohesion: 0.19
Nodes (9): ActivityAnalysisResult, activityAnalysisService, ActivityAnalysisSummary, AnalysisInsight, UserActivityDao, IUserActivityDocument, UserActivity, UserActivityEventType (+1 more)

### Community 53 - "Auth Dependencies (3)"
Cohesion: 0.10
Nodes (21): dependencies, bcryptjs, compression, cookie-parser, cors, dotenv, express, express-validator (+13 more)

### Community 54 - "Auth Auth"
Cohesion: 0.17
Nodes (13): authController, router, forgotPasswordValidators, googleLoginValidators, loginValidators, resetPasswordValidators, signupValidators, updateUserRoleValidators (+5 more)

### Community 55 - "User Profile"
Cohesion: 0.17
Nodes (6): ProfileController, UserProfileDao, UserProfile, userProfileSchema, Ok(), sanitizeUserProfile()

### Community 56 - "Course Dependencies (2)"
Cohesion: 0.10
Nodes (20): dependencies, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, compression, cookie-parser, cors, dotenv, express (+12 more)

### Community 57 - "Course Code Question"
Cohesion: 0.16
Nodes (9): CodeQuestionDao, CodeQuestion, CodingDifficulty, codingQuestionSchema, exampleCaseSchema, ICodingQuestionDocument, IExampleCase, TestCaseGenerationStatus (+1 more)

### Community 58 - "Course Resource"
Cohesion: 0.19
Nodes (7): ResourceDao, EducationalResourceType, IResourceDocument, Resource, resourceSchema, ResourceUploadStatus, VideoDrmStatus

### Community 59 - "Mcq Env"
Cohesion: 0.19
Nodes (11): startServer(), createApp(), connectDB(), envSchema, parsedEnv, logger, envConstants, errorHandler() (+3 more)

### Community 60 - "Auth Auth (2)"
Cohesion: 0.19
Nodes (6): AuthController, Ok(), createSession(), sendMail(), generateOTPToken(), generateResetPasswordToken()

### Community 61 - "Root Config (3)"
Cohesion: 0.35
Nodes (10): router, router, packages_shared_dist_index_errorhandler, ref_compression, ref_cookie_parser, ref_cors, ref_express, ref_helmet (+2 more)

### Community 62 - "Chat Dependencies (2)"
Cohesion: 0.11
Nodes (19): devDependencies, eslint, jest, pino-pretty, prettier, socket.io-client, supertest, ts-jest (+11 more)

### Community 63 - "Coding Dependencies (2)"
Cohesion: 0.11
Nodes (19): devDependencies, eslint, jest, pino-pretty, prettier, supertest, ts-jest, tsx (+11 more)

### Community 64 - "Coding Env"
Cohesion: 0.21
Nodes (10): startServer(), createApp(), connectDB(), envSchema, parsedEnv, logger, envConstants, errorHandler() (+2 more)

### Community 65 - "Coding Auth"
Cohesion: 0.19
Nodes (9): Conflict, Forbidden, Unauthorized, AuthenticatedRequest, authMiddleware(), AuthUser, requireRole(), ApiError (+1 more)

### Community 66 - "Course Dependencies (3)"
Cohesion: 0.11
Nodes (19): devDependencies, eslint, jest, pino-pretty, prettier, supertest, ts-jest, tsx (+11 more)

### Community 67 - "Project-Review Sandbox"
Cohesion: 0.12
Nodes (10): defaultSandboxRunner, execPromise, ISandboxRunner, SandboxExecutionOptions, SandboxExecutionOutput, Tier1SandboxRunner, Tier2K8sManifestGenerator, ref_child_process (+2 more)

### Community 68 - "Frontend TS Config"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+10 more)

### Community 69 - "Mcq Dependencies (2)"
Cohesion: 0.11
Nodes (19): devDependencies, eslint, jest, pino-pretty, prettier, supertest, ts-jest, tsx (+11 more)

### Community 70 - "Media Dependencies (2)"
Cohesion: 0.11
Nodes (19): devDependencies, eslint, jest, pino-pretty, prettier, supertest, ts-jest, tsx (+11 more)

### Community 71 - "Project-Review Dependencies (2)"
Cohesion: 0.11
Nodes (19): devDependencies, eslint, jest, pino-pretty, prettier, supertest, ts-jest, tsx (+11 more)

### Community 72 - "User Dependencies (2)"
Cohesion: 0.11
Nodes (19): devDependencies, eslint, jest, pino-pretty, prettier, supertest, ts-jest, tsx (+11 more)

### Community 73 - "Auth Auth (3)"
Cohesion: 0.16
Nodes (15): AuthenticatedRequest, ForgotPasswordRequest, ForgotPasswordRequestBody, GoogleLoginRequest, GoogleLoginRequestBody, ISessionPayload, IUserPayload, LoginRequest (+7 more)

### Community 74 - "Course Mcq"
Cohesion: 0.18
Nodes (7): McqDao, IMcqDocument, IMcqOption, MCQ, McqDifficulty, mcqOptionSchema, mcqSchema

### Community 75 - "Course Module"
Cohesion: 0.19
Nodes (6): ModuleDao, IModuleDocument, IModuleReleasePolicy, Module, moduleReleasePolicySchema, moduleSchema

### Community 76 - "Media Dependencies (3)"
Cohesion: 0.11
Nodes (18): dependencies, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, compression, cookie-parser, cors, dotenv, express (+10 more)

### Community 77 - "Media Resource (2)"
Cohesion: 0.18
Nodes (10): resourceController, router, getResourceByIdValidators, getUploadUrlValidators, updateResourceStatusValidators, BadRequest, validate(), router (+2 more)

### Community 78 - "Project-Review Dependencies (3)"
Cohesion: 0.11
Nodes (18): dependencies, compression, cookie-parser, cors, dotenv, express, express-validator, helmet (+10 more)

### Community 79 - "Project-Review Index"
Cohesion: 0.20
Nodes (9): HTTP_STATUS, Conflict, Forbidden, Unauthorized, AuthenticatedRequest, authMiddleware(), AuthUser, requireRole() (+1 more)

### Community 80 - "Chat Dependencies (3)"
Cohesion: 0.12
Nodes (17): dependencies, compression, cookie-parser, cors, dotenv, express, helmet, ioredis (+9 more)

### Community 81 - "Coding Question"
Cohesion: 0.23
Nodes (7): CodingController, NotFound, notFoundHandler(), Created(), sanitizeCodingQuestionForDisplay(), sanitizeCodingQuestionFull(), sanitizeSubmission()

### Community 82 - "Coding Submission"
Cohesion: 0.21
Nodes (8): CodingSubmissionDao, CodingSubmission, CodingSubmissionSchema, EvaluationResult, ICodingSubmission, ITestResult, SubmissionStatus, JudgeWorker

### Community 83 - "Project-Review Sanitization Audit"
Cohesion: 0.17
Nodes (14): ExtractedClaimsSchema, IExtractedClaims, IInjectionMarker, InjectionMarkerSchema, ISanitizationAudit, SanitizationAudit, SanitizationAuditSchema, evaluationTools (+6 more)

### Community 84 - "Coding Dependencies (3)"
Cohesion: 0.12
Nodes (16): dependencies, compression, cookie-parser, cors, dotenv, express, express-validator, helmet (+8 more)

### Community 85 - "Coding Question (2)"
Cohesion: 0.21
Nodes (8): getQuestionById(), questionDao, CodingQuestionDao, CodingQuestion, CodingQuestionSchema, ICodingQuestion, ITestCase, TestCaseSchema

### Community 86 - "Mcq Dependencies (3)"
Cohesion: 0.12
Nodes (16): dependencies, compression, cookie-parser, cors, dotenv, express, express-validator, helmet (+8 more)

### Community 88 - "User Dependencies (3)"
Cohesion: 0.12
Nodes (16): dependencies, compression, cookie-parser, cors, dotenv, express, express-validator, helmet (+8 more)

### Community 89 - "User Competency"
Cohesion: 0.19
Nodes (5): CompetencyController, CompetencyDao, Competency, competencySchema, sanitizeCompetency()

### Community 90 - "Project-Review TS Config"
Cohesion: 0.13
Nodes (14): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, module, moduleResolution, outDir, resolveJsonModule (+6 more)

### Community 91 - "Auth TS Config"
Cohesion: 0.14
Nodes (13): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, resolveJsonModule, rootDir (+5 more)

### Community 92 - "Chat TS Config"
Cohesion: 0.14
Nodes (13): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, resolveJsonModule, rootDir (+5 more)

### Community 93 - "Coding Question (3)"
Cohesion: 0.24
Nodes (8): codingController, createQuestionValidators, getQuestionDisplayValidators, getSubmissionValidators, submitCodeValidators, BadRequest, validate(), validateErrors()

### Community 94 - "Coding Status Codes"
Cohesion: 0.27
Nodes (7): router, StatusCodes, NoContent(), Ok(), router, router, ApiResponse()

### Community 95 - "Coding TS Config"
Cohesion: 0.14
Nodes (13): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, resolveJsonModule, rootDir (+5 more)

### Community 96 - "Course TS Config"
Cohesion: 0.14
Nodes (13): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, resolveJsonModule, rootDir (+5 more)

### Community 97 - "Mcq TS Config"
Cohesion: 0.14
Nodes (13): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, resolveJsonModule, rootDir (+5 more)

### Community 98 - "Media TS Config"
Cohesion: 0.14
Nodes (13): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, resolveJsonModule, rootDir (+5 more)

### Community 99 - "User Competency (2)"
Cohesion: 0.24
Nodes (8): competencyController, createCompetencyValidators, getCompetenciesValidators, Forbidden, Unauthorized, authMiddleware(), AuthUser, requireRole()

### Community 100 - "User TS Config"
Cohesion: 0.14
Nodes (13): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, resolveJsonModule, rootDir (+5 more)

### Community 101 - "Auth Tokens"
Cohesion: 0.24
Nodes (9): COOKIE_EXPIRY_TIME, EXPIRY, OTP_EXPIRY_TIME, REFRESH_TOKEN_COOKIE_OPTIONS, RESET_PASSWORD_TOKEN_EXPIRY_TIME, SINGLE_TOKEN_COOKIE_OPTIONS, buildTokenPayload(), generateAccessToken() (+1 more)

### Community 102 - "Auth Google Auth"
Cohesion: 0.28
Nodes (8): BadRequest, validate(), createGoogleOAuthClient(), getGoogleAuthorizationUrl(), getGoogleUserFromCode(), verifyGoogleToken(), validateErrors(), googleapis

### Community 103 - "Course Mcq Attempt"
Cohesion: 0.26
Nodes (4): McqAttemptDao, IMcqAttemptDocument, MCQAttempt, mcqAttemptSchema

### Community 104 - "Auth Session"
Cohesion: 0.20
Nodes (3): SessionDao, Session, sessionSchema

### Community 105 - "Chat Community (2)"
Cohesion: 0.17
Nodes (8): Handler, emitToChannel(), emitToCourse(), emitToUsers(), packages_shared_dist_index_authenticatedrequest, packages_shared_dist_index_authmiddleware, packages_shared_dist_index_badrequesterror, packages_shared_dist_index_sendsuccess

### Community 106 - "Chat Room"
Cohesion: 0.20
Nodes (7): ChannelKind, ChatRoom, ChatRoomSchema, IChatRoom, IRoomMember, RoomMemberSchema, RoomType

### Community 107 - "Course Learner Module Progress"
Cohesion: 0.30
Nodes (5): LearnerModuleProgressDao, ILearnerModuleProgressDocument, LearnerModuleProgress, learnerModuleProgressSchema, LearnerModuleStatus

### Community 108 - "Project-Review Server"
Cohesion: 0.29
Nodes (8): startServer(), createApp(), router, connectDB(), errorHandler(), applyMiddlewares(), notFoundHandler(), router

### Community 109 - "Tsconfig.Base TS Config"
Cohesion: 0.17
Nodes (11): compilerOptions, declaration, declarationMap, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, skipLibCheck (+3 more)

### Community 110 - "Project-Review Review (2)"
Cohesion: 0.31
Nodes (9): controller, staff, createEventValidators, createSubmissionValidators, eventIdValidators, judgeOverrideValidators, submissionIdValidators, updateEventValidators (+1 more)

### Community 111 - "User Profile (2)"
Cohesion: 0.22
Nodes (8): packages_shared_dist_index_serviceoruserauth, router, router, profileController, router, updateProfileValidators, router, router

### Community 113 - "Auth Token"
Cohesion: 0.24
Nodes (3): TokenDAO, Token, tokenSchema

### Community 114 - "Frontend Course"
Cohesion: 0.22
Nodes (9): CompletionStatus, ContentItemDetail, ContentItemSummary, ContentItemType, CourseStructure, LeaderboardData, LeaderboardStudent, Module (+1 more)

### Community 115 - "Auth Hashing"
Cohesion: 0.31
Nodes (6): User, userSchema, comparePassword(), hashPassword(), SALT_ROUNDS, bcryptjs

### Community 116 - "Frontend TS Config (2)"
Cohesion: 0.22
Nodes (8): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, skipLibCheck, strict, include

### Community 117 - "Judge-Runner Dependencies"
Cohesion: 0.22
Nodes (8): description, name, private, scripts, check, start, type, version

### Community 118 - "User Membership"
Cohesion: 0.44
Nodes (4): getParam(), MembershipController, checkArbacCanAssign(), sanitizeMembership()

### Community 120 - "User Bad Request"
Cohesion: 0.39
Nodes (4): BadRequest, validate(), validateErrors(), ref_express_validator

### Community 121 - "Chat Message"
Cohesion: 0.25
Nodes (7): AttachmentSchema, ChatMessage, ChatMessageSchema, IAttachment, IChatMessage, IReaction, ReactionSchema

### Community 122 - "Coding Roles"
Cohesion: 0.25
Nodes (7): ARBAC_CAN_ASSIGN, ARBAC_CAN_REVOKE, COURSE_ROLES, CourseRole, MEMBERSHIP_STATUS, MembershipStatus, VALID_COURSE_ROLES

### Community 123 - "Course Roles"
Cohesion: 0.25
Nodes (7): ARBAC_CAN_ASSIGN, ARBAC_CAN_REVOKE, COURSE_ROLES, CourseRole, MEMBERSHIP_STATUS, MembershipStatus, VALID_COURSE_ROLES

### Community 124 - "Frontend Activity Heatmap"
Cohesion: 0.39
Nodes (6): ActivityHeatmap(), level(), levels, activityGrid(), dayKey(), rtf

### Community 125 - "Mcq Roles"
Cohesion: 0.25
Nodes (7): ARBAC_CAN_ASSIGN, ARBAC_CAN_REVOKE, COURSE_ROLES, CourseRole, MEMBERSHIP_STATUS, MembershipStatus, VALID_COURSE_ROLES

### Community 126 - "Media Roles"
Cohesion: 0.25
Nodes (7): ARBAC_CAN_ASSIGN, ARBAC_CAN_REVOKE, COURSE_ROLES, CourseRole, MEMBERSHIP_STATUS, MembershipStatus, VALID_COURSE_ROLES

### Community 128 - "Shared TS Config"
Cohesion: 0.25
Nodes (7): compilerOptions, outDir, rootDir, exclude, extends, include, ../../tsconfig.base.json

### Community 129 - "Auth Dependencies (4)"
Cohesion: 0.29
Nodes (7): scripts, build, dev, lint, start, test, typecheck

### Community 130 - "Chat Dependencies (4)"
Cohesion: 0.29
Nodes (7): scripts, build, dev, lint, start, test, typecheck

### Community 131 - "Coding Dependencies (4)"
Cohesion: 0.29
Nodes (7): scripts, build, dev, lint, start, test, typecheck

### Community 132 - "Course Dependencies (4)"
Cohesion: 0.29
Nodes (7): scripts, build, dev, lint, start, test, typecheck

### Community 133 - "Mcq Dependencies (4)"
Cohesion: 0.29
Nodes (7): scripts, build, dev, lint, start, test, typecheck

### Community 134 - "Media Dependencies (4)"
Cohesion: 0.29
Nodes (7): scripts, build, dev, lint, start, test, typecheck

### Community 135 - "Project-Review Dependencies (4)"
Cohesion: 0.29
Nodes (7): scripts, build, dev, lint, start, test, typecheck

### Community 136 - "User Dependencies (4)"
Cohesion: 0.29
Nodes (7): scripts, build, dev, lint, start, test, typecheck

### Community 137 - "Judge-Runner Check"
Cohesion: 0.40
Nodes (5): first(), inputs, run(), sums, ref_node_assert

### Community 139 - "Auth Dependencies (5)"
Cohesion: 0.40
Nodes (5): overrides, brace-expansion, glob, node-domexception, test-exclude

### Community 140 - "Coding Dependencies (5)"
Cohesion: 0.40
Nodes (5): overrides, brace-expansion, glob, node-domexception, test-exclude

### Community 141 - "Course Dependencies (5)"
Cohesion: 0.40
Nodes (5): overrides, brace-expansion, glob, node-domexception, test-exclude

### Community 143 - "Frontend Dashboard"
Cohesion: 0.40
Nodes (4): EnrolledCourse, HeatmapData, HeatmapDay, NotificationItem

### Community 144 - "Mcq Dependencies (5)"
Cohesion: 0.40
Nodes (5): overrides, brace-expansion, glob, node-domexception, test-exclude

### Community 145 - "Media Dependencies (5)"
Cohesion: 0.40
Nodes (5): overrides, brace-expansion, glob, node-domexception, test-exclude

### Community 146 - "Shared Logger"
Cohesion: 0.40
Nodes (4): logger, requestLogger, ref_pino, ref_pino_http

### Community 147 - "User Dependencies (5)"
Cohesion: 0.40
Nodes (5): overrides, brace-expansion, glob, node-domexception, test-exclude

## Knowledge Gaps
- **1332 isolated node(s):** `name`, `private`, `packageManager`, `dev`, `dev:backend` (+1327 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1588 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **30 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `socket.io` connect `Chat Redis` to `Chat Dependencies`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **Why does `@scalar/express-api-reference` connect `Auth App` to `Auth Dependencies`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `Chat Dependencies (2)` to `Chat Dependencies`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **What connects `name`, `private`, `packageManager` to the rest of the system?**
  _1332 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Root Config` be split into smaller, more focused modules?**
  _Cohesion score 0.047752808988764044 - nodes in this community are weakly interconnected._
- **Should `Frontend Lms` be split into smaller, more focused modules?**
  _Cohesion score 0.05822267620020429 - nodes in this community are weakly interconnected._
- **Should `Mcq Question` be split into smaller, more focused modules?**
  _Cohesion score 0.053776079929473995 - nodes in this community are weakly interconnected._