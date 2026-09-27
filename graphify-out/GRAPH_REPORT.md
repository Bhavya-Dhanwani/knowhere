# Graph Report - knowhere  (2026-09-26)

## Corpus Check
- Large corpus: 624 files · ~195,095 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 3518 nodes · 7464 edges · 197 communities (168 shown, 29 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 60 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Root Config
- Project-Review Review
- Root Config (2)
- Frontend Admin Dashboard Page
- Project Review UI
- Chat Frontend
- Project-Review Evaluation
- Course Course Api
- Package Dependencies
- Course Viewer
- Design System Primitives
- Frontend Dependencies
- Design System Primitives (2)
- Auth Dependencies
- Chat Community
- Course Dependencies
- Course S3
- Media Dependencies
- Project-Review Dependencies
- Course Course Api (2)
- Course Library
- Coding Dependencies
- Mcq Dependencies
- Project-Review Types
- User Dependencies
- Content Library
- Chat Dependencies
- Project-Review Evaluation Logger
- User Auth
- K8s Service Topology
- Frontend Lms
- Course Access
- Shared Dependencies
- User Course Membership
- Project-Review Discovery
- Root Config (3)
- Frontend Dependencies (2)
- Mcq Env
- Project-Review Ranking
- Course Seed
- Course Course Outline
- Project-Review Types (2)
- Design System Primitives (3)
- Project-Review Types (3)
- Shared App Error
- Auth Dependencies (2)
- Coding Bad Request
- Course Resource
- Mcq Auth
- Media Conflict
- User Profile
- User Bad Request
- Course Activity Analysis
- Auth Dependencies (3)
- Auth App
- Auth Conflict
- Course Conflict
- Course Course
- Course Dependencies (2)
- Course Code Question
- Course Submodule
- Media Resource
- Chat Dependencies (2)
- Coding Dependencies (2)
- Course Dependencies (3)
- Project-Review Sandbox
- Frontend TS Config
- Mcq Dependencies (2)
- Mcq Question
- Media Dependencies (2)
- Project-Review Dependencies (2)
- User Dependencies (2)
- Coding Question
- Course Mcq
- Course Module
- Media Dependencies (3)
- Project-Review Dependencies (3)
- Project-Review Tools
- User Membership
- Auth Auth
- Auth Auth (2)
- Auth Tokens
- Auth Auth (3)
- Chat Dependencies (3)
- Mcq Question (2)
- Project-Review Key Pool
- User Competency
- Coding Dependencies (3)
- Coding Question (2)
- Coding Question (3)
- Mcq Dependencies (3)
- Media Auth
- Shared Course Membership
- Shared Index
- User Dependencies (3)
- Auth Env
- Coding Not Found
- Course Course Progress
- Project-Review TS Config
- Shared Judge
- Auth Google Auth
- Auth TS Config
- Chat TS Config
- Coding Env
- Coding TS Config
- Course TS Config
- Design System Primitives (4)
- Mcq TS Config
- Media Server
- Media TS Config
- Shared Key Pool
- User TS Config
- Coding Submission
- Media Resource (2)
- Media S3
- Auth Session
- Chat Room
- Course Course Api (3)
- Course Learner Module Progress
- Judge-Runner Server
- Mcq Attempt
- Shared Keys
- Scripts Routes Of
- Scripts Gen Openapi
- Tsconfig.Base TS Config
- Course Mcq Attempt
- Mcq Question (3)
- Media Resource (3)
- Auth User
- Auth Token
- Frontend Course
- Design System Primitives (5)
- Scripts Use Atlas Dev
- Auth Hashing
- Design System Primitives (6)
- Frontend TS Config (2)
- Judge-Runner Dependencies
- Coding Roles
- Course Roles
- Design System Primitives (7)
- Mcq Roles
- Media Roles
- Shared TS Config
- Auth Dependencies (4)
- Chat Dependencies (4)
- Coding Dependencies (4)
- Course Dependencies (4)
- Mcq Dependencies (4)
- Media Dependencies (4)
- Project-Review Dependencies (4)
- User Dependencies (4)
- Course Mistral Generator
- Frontend Dependencies (3)
- Design System Primitives (8)
- Design System Primitives (9)
- Judge-Runner Check
- Auth Dependencies (5)
- Coding Dependencies (5)
- Course Dependencies (5)
- Frontend Dashboard
- Design System Primitives (10)
- Design System Primitives (11)
- Design System Primitives (12)
- Design System Primitives (13)
- Design System Primitives (14)
- Mcq Dependencies (5)
- Media Dependencies (5)
- User Dependencies (5)
- Course Key Pool
- Design System Primitives (15)
- Design System Primitives (16)
- Design System Primitives (17)
- Design System Primitives (18)
- Design System Primitives (19)
- Frontend Tailwind
- .Husky Pre Commit
- Frontend Cloudfront S3 Template
- Frontend Deploy S3

## God Nodes (most connected - your core abstractions)
1. `cn()` - 106 edges
2. `react` - 102 edges
3. `lucide-react` - 49 edges
4. `NotFound` - 40 edges
5. `Ok()` - 39 edges
6. `motion` - 33 edges
7. `react-router` - 32 edges
8. `ReviewController` - 30 edges
9. `NotFound` - 28 edges
10. `getId()` - 26 edges

## Surprising Connections (you probably didn't know these)
- `k8s auth-service` --enforces--> `Platform role in JWT (trainee/trainer/admin)`  [INFERRED]
  k8s/auth-service.yml → packages/auth-service/src/shared/utils/buildTokenPayload.util.ts
- `k8s course-service` --enforces--> `Platform role in JWT (trainee/trainer/admin)`  [INFERRED]
  k8s/course-service.yml → packages/auth-service/src/shared/utils/buildTokenPayload.util.ts
- `k8s user-service` --enforces--> `Platform role in JWT (trainee/trainer/admin)`  [INFERRED]
  k8s/user-service.yml → packages/auth-service/src/shared/utils/buildTokenPayload.util.ts
- `OutlineItem` --references--> `SubmoduleContentType`  [EXTRACTED]
  packages/course-service/src/services/courseOutline.service.ts → packages/course-service/src/shared/models/submodule.model.ts
- `DifficultyPicker()` --calls--> `cn()`  [EXTRACTED]
  packages/frontend/src/features/admin/ui/library/LibraryDialogs.tsx → packages/frontend/src/shared/lib/cn.ts

## Import Cycles
- None detected.

## Communities (197 total, 29 thin omitted)

### Community 0 - "Root Config"
Cohesion: 0.05
Nodes (74): ensureSession(), requireAuth(), requireGuest(), requireRole(), router, toLogin(), store, authApi (+66 more)

### Community 1 - "Project-Review Review"
Cohesion: 0.06
Nodes (29): createApp(), getId(), ReviewController, controller, router, staff, createEventValidators, createSubmissionValidators (+21 more)

### Community 2 - "Root Config (2)"
Cohesion: 0.07
Nodes (40): startServer(), createApp(), Handler, router, router, connectDB(), envSchema, parsedEnv (+32 more)

### Community 3 - "Frontend Admin Dashboard Page"
Cohesion: 0.08
Nodes (40): AppDispatch, RootState, AdminDashboardPage(), AdminOverview(), CoursesSection(), roleName(), Section, sectionFromPath() (+32 more)

### Community 4 - "Project Review UI"
Cohesion: 0.09
Nodes (44): CreateEventPayload, CreateSubmissionPayload, reviewApi, CRITERIA_PRESETS, Criterion, CriterionScoreResult, DEFAULT_DIMENSION_WEIGHTS, DeterministicMetrics (+36 more)

### Community 5 - "Chat Frontend"
Cohesion: 0.10
Nodes (40): Access, AppNotification, Attachment, Channel, ChannelKind, communityApi, Member, Message (+32 more)

### Community 6 - "Project-Review Evaluation"
Cohesion: 0.09
Nodes (34): RFC-4180, CriterionScoreResultSchema, ICriterionScoreResult, IJudgeOverride, IRequirementComplianceResult, IReviewEvaluation, JudgeOverrideSchema, RequirementComplianceResultSchema (+26 more)

### Community 7 - "Course Course Api"
Cohesion: 0.07
Nodes (37): anyRole, courseController, router, staff, courseIdValidators, createCourseValidators, updateCourseValidators, anyRole (+29 more)

### Community 8 - "Package Dependencies"
Cohesion: 0.04
Nodes (39): devDependencies, eslint, husky, lint-staged, prettier, secretlint, @secretlint/secretlint-rule-preset-recommend, typescript (+31 more)

### Community 9 - "Course Viewer"
Cohesion: 0.09
Nodes (31): CourseMembersModal(), AddModuleDialog(), CourseEditorPage(), fmt(), CompleteResult, contentApi, flattenItems(), ItemType (+23 more)

### Community 10 - "Design System Primitives"
Cohesion: 0.11
Nodes (32): roleOptions, FormError(), GoogleButton(), OrDivider(), PasswordInput, DEMO_ACCOUNTS, passwordScore(), ROLES (+24 more)

### Community 11 - "Frontend Dependencies"
Cohesion: 0.06
Nodes (35): socket.io-client, typescript, name, private, type, version, App(), queryClient (+27 more)

### Community 12 - "Design System Primitives (2)"
Cohesion: 0.08
Nodes (33): InlineEdit(), ChannelDialog(), MembersPanel(), ProfileCard(), PageHeaderProps, StatCard(), StatCardProps, cn() (+25 more)

### Community 13 - "Auth Dependencies"
Cohesion: 0.05
Nodes (42): description, compression, cookie-parser, cors, dotenv, eslint, express, express-validator (+34 more)

### Community 14 - "Chat Community"
Cohesion: 0.07
Nodes (38): Actor, archiveChannel(), canSeeChannel(), channelAccess(), communityAccess, createChannel(), DEFAULT_CHANNELS, deleteMessage() (+30 more)

### Community 15 - "Course Dependencies"
Cohesion: 0.05
Nodes (42): description, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, compression, cookie-parser, cors, dotenv, eslint (+34 more)

### Community 16 - "Course S3"
Cohesion: 0.08
Nodes (20): startServer(), createApp(), GenerateTestCasesInput, GenerationResult, S3ObjectMeta, s3Service, StreamOptions, videoStreamService (+12 more)

### Community 17 - "Media Dependencies"
Cohesion: 0.05
Nodes (40): description, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, compression, cookie-parser, cors, dotenv, eslint (+32 more)

### Community 18 - "Project-Review Dependencies"
Cohesion: 0.05
Nodes (40): description, compression, cookie-parser, cors, dotenv, eslint, express, express-validator (+32 more)

### Community 19 - "Course Course Api (2)"
Cohesion: 0.09
Nodes (33): AddModuleBody, AddModuleRequest, CheckMcqBody, CheckMcqRequest, CreateCodeQuestionBody, CreateCodeQuestionRequest, CreateCourseBody, CreateCourseRequest (+25 more)

### Community 20 - "Course Library"
Cohesion: 0.16
Nodes (11): CourseApiController, param(), assertOwner(), assertScoring(), assertUnused(), LibraryController, pick(), assertContentAccess() (+3 more)

### Community 21 - "Coding Dependencies"
Cohesion: 0.05
Nodes (38): description, compression, cookie-parser, cors, dotenv, eslint, express, express-validator (+30 more)

### Community 22 - "Mcq Dependencies"
Cohesion: 0.05
Nodes (38): description, compression, cookie-parser, cors, dotenv, eslint, express, express-validator (+30 more)

### Community 23 - "Project-Review Types"
Cohesion: 0.11
Nodes (25): ICriterion, IRequirement, IEvidence, DimensionEvaluationSchema, QualitativeAnalysisAgent, QualitativeContextInput, RedesignQualitativeOutput, RedesignQualitativeOutputSchema (+17 more)

### Community 24 - "User Dependencies"
Cohesion: 0.05
Nodes (38): description, compression, cookie-parser, cors, dotenv, eslint, express, express-validator (+30 more)

### Community 25 - "Content Library"
Cohesion: 0.09
Nodes (31): API_TYPE, ContentLibraryPage(), statusVariant(), Tab, TABS, ALL_LANGUAGES, CODE_LANGUAGES, CodeDoc (+23 more)

### Community 26 - "Chat Dependencies"
Cohesion: 0.05
Nodes (36): description, compression, cookie-parser, cors, dotenv, eslint, express, helmet (+28 more)

### Community 27 - "Project-Review Evaluation Logger"
Cohesion: 0.11
Nodes (13): ActivityTraceSchema, IActivityTrace, IReplayTrace, ReplayTrace, ReplayTraceSchema, EvaluationLogger, StepLogEntry, EvaluationActivities (+5 more)

### Community 28 - "User Auth"
Cohesion: 0.12
Nodes (21): packages_shared_dist_index_serviceoruserauth, competencyController, router, createCompetencyValidators, getCompetenciesValidators, membershipController, router, assignMemberValidators (+13 more)

### Community 29 - "K8s Service Topology"
Cohesion: 0.11
Nodes (32): Platform role in JWT (trainee/trainer/admin), knowhere-ingress (nginx), Kustomization, MongoDB, Redis, Skaffold dev pipeline, k8s auth-service, k8s chat-service (+24 more)

### Community 30 - "Frontend Lms"
Cohesion: 0.08
Nodes (22): call(), call(), call(), CourseStructure, LearnerCourse, LearnerCourseCard(), BackendRole, call() (+14 more)

### Community 31 - "Course Access"
Cohesion: 0.14
Nodes (17): CourseController, param(), assertCanManageCourse(), canManageCourse(), courseDao, courseRoleOf(), LearnerView, memberships (+9 more)

### Community 32 - "Shared Dependencies"
Cohesion: 0.06
Nodes (30): dependencies, express, jsonwebtoken, pino, pino-http, zod, devDependencies, @types/express (+22 more)

### Community 33 - "User Course Membership"
Cohesion: 0.11
Nodes (15): ARBAC_CAN_ASSIGN, ARBAC_CAN_REVOKE, COURSE_ROLES, CourseRole, MEMBERSHIP_STATUS, MembershipStatus, VALID_COURSE_ROLES, CourseMembershipDao (+7 more)

### Community 34 - "Project-Review Discovery"
Cohesion: 0.12
Nodes (18): startServer(), MediaAssetItemSchema, MistralDiscoveryAgent, PageCatalogItemSchema, ProjectDeepDiscoverySchema, RawProjectInput, defaultKeyPool, KeyStatus (+10 more)

### Community 35 - "Root Config (3)"
Cohesion: 0.16
Nodes (16): packages_shared_dist_index_accesspublickey, packages_shared_dist_index_servicetoken, packages_shared_dist_index_servicetokensecret, packages_shared_dist_index_signaccesstoken, startServer(), createApp(), connectDB(), envSchema (+8 more)

### Community 36 - "Frontend Dependencies (2)"
Cohesion: 0.07
Nodes (29): dependencies, axios, clsx, gsap, @gsap/react, hls.js, livekit-client, lucide-react (+21 more)

### Community 37 - "Mcq Env"
Cohesion: 0.13
Nodes (15): startServer(), createApp(), connectDB(), envSchema, parsedEnv, logger, envConstants, NotFound (+7 more)

### Community 38 - "Project-Review Ranking"
Cohesion: 0.17
Nodes (16): EventRankingSchema, ILeaderboardEntry, IPairwiseMatch, IRelativeComparison, IRelativeGrading, ISelfImprovement, ISelfStrengths, LeaderboardEntrySchema (+8 more)

### Community 39 - "Course Seed"
Cohesion: 0.11
Nodes (21): INotification, Notification, NotificationSchema, NotificationType, IReadState, ReadState, ReadStateSchema, ago() (+13 more)

### Community 40 - "Course Course Outline"
Cohesion: 0.15
Nodes (18): hiddenError(), param(), percent(), ProgressController, codeDao, ITEM_MAX_SCORE, loadCourseOutline(), mcqDao (+10 more)

### Community 41 - "Project-Review Types (2)"
Cohesion: 0.21
Nodes (11): ExtractedClaimsZodSchema, MistralExtractionAgent, DelimiterService, ExtractionService, InjectionDetectorService, InjectionPattern, SanitizationFacade, ExtractedNeutralClaims (+3 more)

### Community 42 - "Design System Primitives (3)"
Cohesion: 0.11
Nodes (18): FACTS, FEATURES, LandingPage(), Nav(), STACK, STEPS, useSignedInHome(), ClickSpark() (+10 more)

### Community 43 - "Project-Review Types (3)"
Cohesion: 0.16
Nodes (13): ProjectDeepDiscovery, BackendEvalRunner, CodeAnalysisRunner, ProjectDiscoveryRunner, FrontendEvalRunner, BackendEvalResult, CodeAnalysisResult, DeterministicStaticMetrics (+5 more)

### Community 44 - "Shared App Error"
Cohesion: 0.14
Nodes (10): AppError, BadRequestError, ConflictError, ForbiddenError, NotFoundError, UnauthorizedError, ValidationError, requireRole() (+2 more)

### Community 45 - "Auth Dependencies (2)"
Cohesion: 0.09
Nodes (22): devDependencies, eslint, jest, pino-pretty, prettier, supertest, ts-jest, tsx (+14 more)

### Community 46 - "Coding Bad Request"
Cohesion: 0.19
Nodes (8): StatusCodes, BadRequest, Conflict, validate(), NoContent(), ApiError, ApiResponse(), validateErrors()

### Community 47 - "Course Resource"
Cohesion: 0.18
Nodes (7): ResourceDao, EducationalResourceType, IResourceDocument, Resource, resourceSchema, ResourceUploadStatus, VideoDrmStatus

### Community 48 - "Mcq Auth"
Cohesion: 0.20
Nodes (9): StatusCodes, Conflict, Forbidden, Unauthorized, AuthenticatedRequest, authMiddleware(), AuthUser, requireRole() (+1 more)

### Community 49 - "Media Conflict"
Cohesion: 0.21
Nodes (9): StatusCodes, Conflict, Forbidden, Created(), NoContent(), Ok(), ApiError, ApiResponse() (+1 more)

### Community 50 - "User Profile"
Cohesion: 0.16
Nodes (6): ProfileController, UserProfileDao, UserProfile, userProfileSchema, Ok(), sanitizeUserProfile()

### Community 51 - "User Bad Request"
Cohesion: 0.21
Nodes (7): StatusCodes, BadRequest, Conflict, validate(), NoContent(), ApiError, ApiResponse()

### Community 52 - "Course Activity Analysis"
Cohesion: 0.19
Nodes (9): ActivityAnalysisResult, activityAnalysisService, ActivityAnalysisSummary, AnalysisInsight, UserActivityDao, IUserActivityDocument, UserActivity, UserActivityEventType (+1 more)

### Community 53 - "Auth Dependencies (3)"
Cohesion: 0.10
Nodes (21): dependencies, bcryptjs, compression, cookie-parser, cors, dotenv, express, express-validator (+13 more)

### Community 54 - "Auth App"
Cohesion: 0.15
Nodes (13): createApp(), frontendIndex, publicDirectory, serverDirectory, router, errorHandler(), applyMiddlewares(), notFoundHandler() (+5 more)

### Community 55 - "Auth Conflict"
Cohesion: 0.20
Nodes (8): HTTP_STATUS, Conflict, Forbidden, adminMiddleware(), Created(), NoContent(), ApiError, ApiResponse()

### Community 56 - "Course Conflict"
Cohesion: 0.25
Nodes (6): StatusCodes, Conflict, NoContent(), ApiError, ApiResponse(), ref_express

### Community 57 - "Course Course"
Cohesion: 0.16
Nodes (9): CourseDao, Course, courseModuleEntrySchema, courseSchema, courseSettingsSchema, CourseStatus, ICourseDocument, ICourseModuleEntry (+1 more)

### Community 58 - "Course Dependencies (2)"
Cohesion: 0.10
Nodes (20): dependencies, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, compression, cookie-parser, cors, dotenv, express (+12 more)

### Community 59 - "Course Code Question"
Cohesion: 0.16
Nodes (9): CodeQuestionDao, CodeQuestion, CodingDifficulty, codingQuestionSchema, exampleCaseSchema, ICodingQuestionDocument, IExampleCase, TestCaseGenerationStatus (+1 more)

### Community 60 - "Course Submodule"
Cohesion: 0.17
Nodes (6): SubmoduleDao, ISubmoduleContentItem, ISubmoduleDocument, Submodule, submoduleContentItemSchema, submoduleSchema

### Community 61 - "Media Resource"
Cohesion: 0.16
Nodes (12): handler(), S3Event, S3EventRecord, EventBridgeEvent, EventBridgeMediaConvertDetail, handler(), ResourceDao, IResource (+4 more)

### Community 62 - "Chat Dependencies (2)"
Cohesion: 0.11
Nodes (19): devDependencies, eslint, jest, pino-pretty, prettier, socket.io-client, supertest, ts-jest (+11 more)

### Community 63 - "Coding Dependencies (2)"
Cohesion: 0.11
Nodes (19): devDependencies, eslint, jest, pino-pretty, prettier, supertest, ts-jest, tsx (+11 more)

### Community 64 - "Course Dependencies (3)"
Cohesion: 0.11
Nodes (19): devDependencies, eslint, jest, pino-pretty, prettier, supertest, ts-jest, tsx (+11 more)

### Community 65 - "Project-Review Sandbox"
Cohesion: 0.12
Nodes (10): defaultSandboxRunner, execPromise, ISandboxRunner, SandboxExecutionOptions, SandboxExecutionOutput, Tier1SandboxRunner, Tier2K8sManifestGenerator, ref_child_process (+2 more)

### Community 66 - "Frontend TS Config"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+10 more)

### Community 67 - "Mcq Dependencies (2)"
Cohesion: 0.11
Nodes (19): devDependencies, eslint, jest, pino-pretty, prettier, supertest, ts-jest, tsx (+11 more)

### Community 68 - "Mcq Question"
Cohesion: 0.19
Nodes (10): getQuestionById(), questionDao, QuestionDao, IMCQOption, IMCQQuestion, MCQOptionSchema, MCQQuestion, MCQQuestionSchema (+2 more)

### Community 69 - "Media Dependencies (2)"
Cohesion: 0.11
Nodes (19): devDependencies, eslint, jest, pino-pretty, prettier, supertest, ts-jest, tsx (+11 more)

### Community 70 - "Project-Review Dependencies (2)"
Cohesion: 0.11
Nodes (19): devDependencies, eslint, jest, pino-pretty, prettier, supertest, ts-jest, tsx (+11 more)

### Community 71 - "User Dependencies (2)"
Cohesion: 0.11
Nodes (19): devDependencies, eslint, jest, pino-pretty, prettier, supertest, ts-jest, tsx (+11 more)

### Community 72 - "Coding Question"
Cohesion: 0.20
Nodes (11): codingController, createQuestionValidators, getQuestionDisplayValidators, getSubmissionValidators, submitCodeValidators, Forbidden, Unauthorized, AuthenticatedRequest (+3 more)

### Community 73 - "Course Mcq"
Cohesion: 0.18
Nodes (7): McqDao, IMcqDocument, IMcqOption, MCQ, McqDifficulty, mcqOptionSchema, mcqSchema

### Community 74 - "Course Module"
Cohesion: 0.19
Nodes (6): ModuleDao, IModuleDocument, IModuleReleasePolicy, Module, moduleReleasePolicySchema, moduleSchema

### Community 75 - "Media Dependencies (3)"
Cohesion: 0.11
Nodes (18): dependencies, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, compression, cookie-parser, cors, dotenv, express (+10 more)

### Community 76 - "Project-Review Dependencies (3)"
Cohesion: 0.11
Nodes (18): dependencies, compression, cookie-parser, cors, dotenv, express, express-validator, helmet (+10 more)

### Community 77 - "Project-Review Tools"
Cohesion: 0.15
Nodes (14): evaluationTools, FetchCriteriaSchema, fetchCriteriaTool, flagInjectionAnomalyTool, FlagInjectionSchema, RetrieveEvidenceSchema, retrieveEvidenceTool, competencyParamsSchema (+6 more)

### Community 78 - "User Membership"
Cohesion: 0.25
Nodes (7): getParam(), MembershipController, Forbidden, NotFound, checkArbacCanAssign(), notFoundHandler(), sanitizeMembership()

### Community 79 - "Auth Auth"
Cohesion: 0.17
Nodes (14): AuthenticatedRequest, ForgotPasswordRequest, ForgotPasswordRequestBody, GoogleLoginRequest, GoogleLoginRequestBody, ISessionPayload, IUserPayload, LoginRequest (+6 more)

### Community 80 - "Auth Auth (2)"
Cohesion: 0.21
Nodes (5): AuthController, NotFound, Ok(), sanitizeUser(), generateResetPasswordToken()

### Community 81 - "Auth Tokens"
Cohesion: 0.20
Nodes (12): COOKIE_EXPIRY_TIME, EXPIRY, OTP_EXPIRY_TIME, REFRESH_TOKEN_COOKIE_OPTIONS, RESET_PASSWORD_TOKEN_EXPIRY_TIME, SINGLE_TOKEN_COOKIE_OPTIONS, buildTokenPayload(), createSession() (+4 more)

### Community 82 - "Auth Auth (3)"
Cohesion: 0.21
Nodes (11): authController, forgotPasswordValidators, googleLoginValidators, loginValidators, resetPasswordValidators, signupValidators, updateUserRoleValidators, Unauthorized (+3 more)

### Community 83 - "Chat Dependencies (3)"
Cohesion: 0.12
Nodes (17): dependencies, compression, cookie-parser, cors, dotenv, express, helmet, ioredis (+9 more)

### Community 84 - "Mcq Question (2)"
Cohesion: 0.21
Nodes (8): BadRequest, validate(), Created(), NoContent(), Ok(), sanitizeQuestionFull(), ApiResponse(), validateErrors()

### Community 86 - "User Competency"
Cohesion: 0.18
Nodes (6): CompetencyController, CompetencyDao, Competency, competencySchema, Created(), sanitizeCompetency()

### Community 87 - "Coding Dependencies (3)"
Cohesion: 0.12
Nodes (16): dependencies, compression, cookie-parser, cors, dotenv, express, express-validator, helmet (+8 more)

### Community 88 - "Coding Question (2)"
Cohesion: 0.23
Nodes (8): CodingController, getQuestionById(), questionDao, Created(), Ok(), sanitizeCodingQuestionForDisplay(), sanitizeCodingQuestionFull(), sanitizeSubmission()

### Community 89 - "Coding Question (3)"
Cohesion: 0.18
Nodes (7): CodingQuestionDao, CodingQuestion, CodingQuestionSchema, ICodingQuestion, ITestCase, TestCaseSchema, JudgeWorker

### Community 90 - "Mcq Dependencies (3)"
Cohesion: 0.12
Nodes (16): dependencies, compression, cookie-parser, cors, dotenv, express, express-validator, helmet (+8 more)

### Community 91 - "Media Auth"
Cohesion: 0.22
Nodes (9): resourceController, router, Unauthorized, AuthenticatedRequest, authMiddleware(), AuthUser, requireRole(), router (+1 more)

### Community 92 - "Shared Course Membership"
Cohesion: 0.19
Nodes (13): authMiddleware(), bearer(), serviceOrUserAuth(), CourseMember, CourseRole, createMembershipClient(), MembershipClient, MembershipClientOptions (+5 more)

### Community 93 - "Shared Index"
Cohesion: 0.17
Nodes (9): errorHandler(), ApiErrorEnvelope, ApiResponseEnvelope, AuthenticatedRequest, AuthUser, PaginatedResult, PaginationQuery, UserRole (+1 more)

### Community 94 - "User Dependencies (3)"
Cohesion: 0.12
Nodes (16): dependencies, compression, cookie-parser, cors, dotenv, express, express-validator, helmet (+8 more)

### Community 95 - "Auth Env"
Cohesion: 0.25
Nodes (8): startServer(), connectDB(), envSchema, parsedEnv, logger, transporter, envConstants, nodemailer

### Community 96 - "Coding Not Found"
Cohesion: 0.22
Nodes (8): createApp(), router, NotFound, errorHandler(), applyMiddlewares(), notFoundHandler(), router, router

### Community 97 - "Course Course Progress"
Cohesion: 0.23
Nodes (7): CourseProgressDao, completedItemSchema, CourseProgress, courseProgressSchema, ICompletedItem, ICourseProgress, SubmoduleContentType

### Community 98 - "Project-Review TS Config"
Cohesion: 0.13
Nodes (14): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, module, moduleResolution, outDir, resolveJsonModule (+6 more)

### Community 99 - "Shared Judge"
Cohesion: 0.20
Nodes (14): CaseResult, JUDGE_LANGUAGES, judgeCode(), judgeJavaScript(), JudgeLanguage, JudgeResult, normalise(), RawResult (+6 more)

### Community 100 - "Auth Google Auth"
Cohesion: 0.25
Nodes (8): BadRequest, validate(), createGoogleOAuthClient(), getGoogleAuthorizationUrl(), getGoogleUserFromCode(), verifyGoogleToken(), validateErrors(), googleapis

### Community 101 - "Auth TS Config"
Cohesion: 0.14
Nodes (13): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, resolveJsonModule, rootDir (+5 more)

### Community 102 - "Chat TS Config"
Cohesion: 0.14
Nodes (13): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, resolveJsonModule, rootDir (+5 more)

### Community 103 - "Coding Env"
Cohesion: 0.26
Nodes (7): startServer(), connectDB(), envSchema, parsedEnv, logger, envConstants, ref_dotenv

### Community 104 - "Coding TS Config"
Cohesion: 0.14
Nodes (13): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, resolveJsonModule, rootDir (+5 more)

### Community 105 - "Course TS Config"
Cohesion: 0.14
Nodes (13): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, resolveJsonModule, rootDir (+5 more)

### Community 106 - "Design System Primitives (4)"
Cohesion: 0.14
Nodes (9): AnimatedContent(), AnimatedContentProps, ScrambledTextProps, ScrollFloat(), ScrollFloatProps, SplitText(), SplitTextProps, gsap (+1 more)

### Community 107 - "Mcq TS Config"
Cohesion: 0.14
Nodes (13): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, resolveJsonModule, rootDir (+5 more)

### Community 108 - "Media Server"
Cohesion: 0.31
Nodes (7): startServer(), createApp(), connectDB(), logger, errorHandler(), applyMiddlewares(), notFoundHandler()

### Community 109 - "Media TS Config"
Cohesion: 0.14
Nodes (13): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, resolveJsonModule, rootDir (+5 more)

### Community 110 - "Shared Key Pool"
Cohesion: 0.19
Nodes (4): classifyKeyError(), KeyFailure, KeyPool, Slot

### Community 111 - "User TS Config"
Cohesion: 0.14
Nodes (13): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, resolveJsonModule, rootDir (+5 more)

### Community 112 - "Coding Submission"
Cohesion: 0.28
Nodes (7): CodingSubmissionDao, CodingSubmission, CodingSubmissionSchema, EvaluationResult, ICodingSubmission, ITestResult, SubmissionStatus

### Community 113 - "Media Resource (2)"
Cohesion: 0.23
Nodes (6): ResourceController, getResourceById(), resourceDao, NotFound, SanitizedResource, sanitizeResource()

### Community 114 - "Media S3"
Cohesion: 0.17
Nodes (7): S3Service, envSchema, parsedEnv, envConstants, packages_shared_dist_index_assertkeysconfigured, ref_aws_sdk_client_s3, ref_aws_sdk_s3_request_presigner

### Community 115 - "Auth Session"
Cohesion: 0.20
Nodes (3): SessionDao, Session, sessionSchema

### Community 116 - "Chat Room"
Cohesion: 0.20
Nodes (7): ChannelKind, ChatRoom, ChatRoomSchema, IChatRoom, IRoomMember, RoomMemberSchema, RoomType

### Community 117 - "Course Course Api (3)"
Cohesion: 0.29
Nodes (4): assertAllFound(), BadRequest, validate(), Created()

### Community 118 - "Course Learner Module Progress"
Cohesion: 0.30
Nodes (5): LearnerModuleProgressDao, ILearnerModuleProgressDocument, LearnerModuleProgress, learnerModuleProgressSchema, LearnerModuleStatus

### Community 119 - "Judge-Runner Server"
Cohesion: 0.23
Nodes (11): head(), judge(), LANGS, PORT, sandbox(), server, tail(), WORKERS (+3 more)

### Community 120 - "Mcq Attempt"
Cohesion: 0.24
Nodes (5): QuestionController, AttemptDao, IMCQAttempt, MCQAttempt, MCQAttemptSchema

### Community 121 - "Shared Keys"
Cohesion: 0.33
Nodes (11): accessPrivateKey(), accessPublicKey(), assertKeysConfigured(), DevKeys, devKeysFile(), fromEnv(), loadDevKeys(), mediaSigningSecret() (+3 more)

### Community 122 - "Scripts Routes Of"
Cohesion: 0.20
Nodes (11): ref_node_module, ref_node_url, app, dir, express, isAuth(), join(), Layer (+3 more)

### Community 123 - "Scripts Gen Openapi"
Cohesion: 0.18
Nodes (10): doc, Op, OUT, paths, previous, root, Route, routeComments() (+2 more)

### Community 124 - "Tsconfig.Base TS Config"
Cohesion: 0.17
Nodes (11): compilerOptions, declaration, declarationMap, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, skipLibCheck (+3 more)

### Community 125 - "Course Mcq Attempt"
Cohesion: 0.27
Nodes (4): McqAttemptDao, IMcqAttemptDocument, MCQAttempt, mcqAttemptSchema

### Community 126 - "Mcq Question (3)"
Cohesion: 0.27
Nodes (7): questionController, router, createQuestionValidators, getQuestionDisplayValidators, submitAttemptValidators, router, router

### Community 127 - "Media Resource (3)"
Cohesion: 0.27
Nodes (6): getResourceByIdValidators, getUploadUrlValidators, updateResourceStatusValidators, BadRequest, validate(), validateErrors()

### Community 129 - "Auth Token"
Cohesion: 0.24
Nodes (3): TokenDAO, Token, tokenSchema

### Community 130 - "Frontend Course"
Cohesion: 0.22
Nodes (9): CompletionStatus, ContentItemDetail, ContentItemSummary, ContentItemType, CourseStructure, LeaderboardData, LeaderboardStudent, Module (+1 more)

### Community 131 - "Design System Primitives (5)"
Cohesion: 0.31
Nodes (9): ANIMATION_CONFIG, cx(), LogoItem, LogoLoop, LogoLoopProps, toCssLength(), useAnimationLoop(), useImageLoader() (+1 more)

### Community 132 - "Scripts Use Atlas Dev"
Cohesion: 0.20
Nodes (7): ref_node_dns, ref_node_fs, base, DBS, doc, secrets, u

### Community 133 - "Auth Hashing"
Cohesion: 0.31
Nodes (6): User, userSchema, comparePassword(), hashPassword(), SALT_ROUNDS, bcryptjs

### Community 134 - "Design System Primitives (6)"
Cohesion: 0.25
Nodes (6): ScrollVelocity(), VelocityText(), ScrollVelocityProps, useElementWidth(), VelocityMapping, VelocityTextProps

### Community 135 - "Frontend TS Config (2)"
Cohesion: 0.22
Nodes (8): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, skipLibCheck, strict, include

### Community 136 - "Judge-Runner Dependencies"
Cohesion: 0.22
Nodes (8): description, name, private, scripts, check, start, type, version

### Community 137 - "Coding Roles"
Cohesion: 0.25
Nodes (7): ARBAC_CAN_ASSIGN, ARBAC_CAN_REVOKE, COURSE_ROLES, CourseRole, MEMBERSHIP_STATUS, MembershipStatus, VALID_COURSE_ROLES

### Community 138 - "Course Roles"
Cohesion: 0.25
Nodes (7): ARBAC_CAN_ASSIGN, ARBAC_CAN_REVOKE, COURSE_ROLES, CourseRole, MEMBERSHIP_STATUS, MembershipStatus, VALID_COURSE_ROLES

### Community 139 - "Design System Primitives (7)"
Cohesion: 0.25
Nodes (3): Threads(), ThreadsProps, ogl

### Community 140 - "Mcq Roles"
Cohesion: 0.25
Nodes (7): ARBAC_CAN_ASSIGN, ARBAC_CAN_REVOKE, COURSE_ROLES, CourseRole, MEMBERSHIP_STATUS, MembershipStatus, VALID_COURSE_ROLES

### Community 141 - "Media Roles"
Cohesion: 0.25
Nodes (7): ARBAC_CAN_ASSIGN, ARBAC_CAN_REVOKE, COURSE_ROLES, CourseRole, MEMBERSHIP_STATUS, MembershipStatus, VALID_COURSE_ROLES

### Community 142 - "Shared TS Config"
Cohesion: 0.25
Nodes (7): compilerOptions, outDir, rootDir, exclude, extends, include, ../../tsconfig.base.json

### Community 143 - "Auth Dependencies (4)"
Cohesion: 0.29
Nodes (7): scripts, build, dev, lint, start, test, typecheck

### Community 144 - "Chat Dependencies (4)"
Cohesion: 0.29
Nodes (7): scripts, build, dev, lint, start, test, typecheck

### Community 145 - "Coding Dependencies (4)"
Cohesion: 0.29
Nodes (7): scripts, build, dev, lint, start, test, typecheck

### Community 146 - "Course Dependencies (4)"
Cohesion: 0.29
Nodes (7): scripts, build, dev, lint, start, test, typecheck

### Community 147 - "Mcq Dependencies (4)"
Cohesion: 0.29
Nodes (7): scripts, build, dev, lint, start, test, typecheck

### Community 148 - "Media Dependencies (4)"
Cohesion: 0.29
Nodes (7): scripts, build, dev, lint, start, test, typecheck

### Community 149 - "Project-Review Dependencies (4)"
Cohesion: 0.29
Nodes (7): scripts, build, dev, lint, start, test, typecheck

### Community 150 - "User Dependencies (4)"
Cohesion: 0.29
Nodes (7): scripts, build, dev, lint, start, test, typecheck

### Community 152 - "Frontend Dependencies (3)"
Cohesion: 0.33
Nodes (6): scripts, build, deploy:s3, dev, preview, typecheck

### Community 153 - "Design System Primitives (8)"
Cohesion: 0.47
Nodes (5): Dot, DotGrid(), DotGridProps, hexToRgb(), throttle()

### Community 154 - "Design System Primitives (9)"
Cohesion: 0.53
Nodes (5): debounce(), dist(), getAttr(), TextPressure(), TextPressureProps

### Community 155 - "Judge-Runner Check"
Cohesion: 0.40
Nodes (5): first(), inputs, run(), sums, ref_node_assert

### Community 156 - "Auth Dependencies (5)"
Cohesion: 0.40
Nodes (5): overrides, brace-expansion, glob, node-domexception, test-exclude

### Community 157 - "Coding Dependencies (5)"
Cohesion: 0.40
Nodes (5): overrides, brace-expansion, glob, node-domexception, test-exclude

### Community 158 - "Course Dependencies (5)"
Cohesion: 0.40
Nodes (5): overrides, brace-expansion, glob, node-domexception, test-exclude

### Community 159 - "Frontend Dashboard"
Cohesion: 0.40
Nodes (4): EnrolledCourse, HeatmapData, HeatmapDay, NotificationItem

### Community 161 - "Design System Primitives (11)"
Cohesion: 0.60
Nodes (4): CircularText(), CircularTextProps, getRotationTransition(), getTransition()

### Community 162 - "Design System Primitives (12)"
Cohesion: 0.40
Nodes (4): DecryptedText(), DecryptedTextProps, Direction, styles

### Community 163 - "Design System Primitives (13)"
Cohesion: 0.50
Nodes (4): cn(), RotatingText, RotatingTextProps, RotatingTextRef

### Community 164 - "Design System Primitives (14)"
Cohesion: 0.60
Nodes (4): useAnimationFrame(), useMousePositionRef(), VariableProximity, VariableProximityProps

### Community 165 - "Mcq Dependencies (5)"
Cohesion: 0.40
Nodes (5): overrides, brace-expansion, glob, node-domexception, test-exclude

### Community 166 - "Media Dependencies (5)"
Cohesion: 0.40
Nodes (5): overrides, brace-expansion, glob, node-domexception, test-exclude

### Community 167 - "User Dependencies (5)"
Cohesion: 0.40
Nodes (5): overrides, brace-expansion, glob, node-domexception, test-exclude

### Community 168 - "Course Key Pool"
Cohesion: 0.50
Nodes (3): err(), packages_shared_dist_index_classifykeyerror, packages_shared_dist_index_keypool

### Community 169 - "Design System Primitives (15)"
Cohesion: 0.67
Nodes (3): BlurText(), BlurTextProps, buildKeyframes()

### Community 170 - "Design System Primitives (16)"
Cohesion: 0.50
Nodes (3): Position, SpotlightCard(), SpotlightCardProps

### Community 171 - "Design System Primitives (17)"
Cohesion: 0.50
Nodes (3): FocusRect, TrueFocus(), TrueFocusProps

## Knowledge Gaps
- **1375 isolated node(s):** `name`, `private`, `packageManager`, `dev`, `dev:backend` (+1370 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1648 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **29 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `socket.io` connect `Root Config (2)` to `Chat Dependencies`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **Why does `@scalar/express-api-reference` connect `Auth App` to `Auth Dependencies`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `Chat Dependencies (2)` to `Chat Dependencies`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **What connects `name`, `private`, `packageManager` to the rest of the system?**
  _1375 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Root Config` be split into smaller, more focused modules?**
  _Cohesion score 0.04514851485148515 - nodes in this community are weakly interconnected._
- **Should `Project-Review Review` be split into smaller, more focused modules?**
  _Cohesion score 0.05765765765765766 - nodes in this community are weakly interconnected._
- **Should `Root Config (2)` be split into smaller, more focused modules?**
  _Cohesion score 0.07475678443420379 - nodes in this community are weakly interconnected._