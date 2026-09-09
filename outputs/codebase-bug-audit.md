# Knowhere — repository-wide bug audit

Date: 9 September 2026  
Branch: `feat/autonomous-project-evaluator`  
Scope: current working tree, including the uncommitted evaluator implementation, not just the base Git commit.

## Outcome

**55 findings resolved in the working tree: 30 P1 (high priority), 25 P2 (medium priority).** Authentication and membership boundaries, grade integrity, durable queues, real code execution, media job dispatch, evaluator evidence/scoring/ranking, frontend API behavior, and deployment wiring were repaired.

This remains a repository-wide review, not a guarantee that no undiscovered defect exists. The descriptions below preserve the original failure mode for audit history; the finding index and resolution summary record the current working-tree state. Existing unrelated changes were preserved.

## Verification and limits

- Reviewed the authentication, user/membership, course/progress, MCQ, coding, media, project-review, frontend, and shared packages, plus Docker/Kubernetes routing and deployment configuration.
- `pnpm -r --no-bail run typecheck`: **passed** for all 11 configured packages.
- `pnpm -r --no-bail run lint`: **passed** for all nine packages with lint scripts.
- `pnpm -r --no-bail run test -- --runInBand`: **passed** after adding compatible runner test entrypoints; 69 Jest tests plus two isolated-runner tests pass.
- `pnpm -r --no-bail run build`: **passed** for every package with a build script, including the production frontend bundle.
- `pnpm audit --prod --json`: **0 reported advisories** across 308 production/optional dependencies. This does not by itself establish application security.
- `docker compose config --quiet`: **passed** with representative required secret/AWS variables, including the Mongo replica set, Redis, code runner, and evaluator runner topology.
- `git diff --check`: **passed**; Git emitted only the repository's Windows LF-to-CRLF notices.
- Live JavaScript judge execution was verified against public and hidden cases. The evaluator runner's authentication and private-target SSRF guard were verified by automated tests.
- Docker image builds could not be executed because the local Docker Desktop Linux daemon was not running. No live AWS MediaConvert job, Kubernetes cluster deployment, Mongo/Redis crash-recovery drill, or browser end-to-end run was performed; those remain release-environment checks, not open code findings.

The earlier bug-reproduction script was removed because it intentionally asserted vulnerable behavior and was no longer a valid health check. Run the maintained regression suites instead:

```powershell
pnpm -r --no-bail run test -- --runInBand
```

## Resolution summary

1. Auth tokens are typed, hashed, expiring, email-bound where required, cryptographically generated, and unverified/default-role users fail closed.
2. Course mutations and progress are membership/ancestry checked; learner-provided assessment scores are rejected; initial and last-admin invariants are enforced.
3. Coding and project evaluation use Redis-backed durable queues and repository-owned, resource-constrained runner services. Unavailable tools remain explicitly unavailable.
4. Evaluations use stable workflow IDs, pinned commits, durable activity traces, guarded state transitions, retries, evidence-aware completeness, and transaction-backed overrides.
5. Rankings filter eligible evaluations, preserve zero weights, avoid dense matrices, remove stale entries, and consume persisted judge overrides.
6. The frontend now consumes real API data, preserves learner input, waits for terminal evaluation status, and exposes complete verification/reset/logout flows.

## Finding index

| ID        | Status   | Priority | Area                   | Finding                                                                                 |
| --------- | -------- | -------- | ---------------------- | --------------------------------------------------------------------------------------- |
| AUTH-01   | **Done** | P1       | Authentication         | Password-reset token accepts MongoDB query operators                                    |
| AUTH-02   | **Done** | P1       | Authentication         | OTP and expired tokens are accepted as password-reset tokens                            |
| AUTH-03   | **Done** | P1       | Authentication         | Signup can claim email verification without proving ownership                           |
| AUTH-04   | **Done** | P1       | Authentication         | Every normal auth-issued token becomes a project judge                                  |
| AUTH-05   | **Done** | P1       | Authentication         | Unauthenticated callers can create or overwrite course-admin memberships                |
| AUTH-06   | **Done** | P1       | Authentication         | Real trainer/admin memberships do not authorize the other services                      |
| AUTH-07   | **Done** | P1       | Authentication         | Known fallback signing secrets are usable outside tests                                 |
| AUTH-08   | **Done** | P1       | Authentication         | UI Sign Out does not terminate the login session                                        |
| AUTH-09   | **Done** | P2       | Authentication         | SMTP failures can become unhandled promise rejections                                   |
| COURSE-01 | **Done** | P1       | Courses and membership | Course access and mutations ignore course-specific authorization                        |
| COURSE-02 | **Done** | P1       | Courses and membership | Students can award their own assessment scores                                          |
| COURSE-03 | **Done** | P1       | Courses and membership | Content from one course can increase another course's grades                            |
| COURSE-04 | **Done** | P2       | Courses and membership | POST membership assignment bypasses the last-admin safeguard                            |
| COURSE-05 | **Done** | P2       | Courses and membership | Creating a course never enrolls its creator as initial admin                            |
| COURSE-06 | **Done** | P2       | Courses and membership | Concurrent completions can corrupt progress totals                                      |
| COURSE-07 | **Done** | P1       | Courses and membership | Cross-service content lookup is still a placeholder                                     |
| COURSE-08 | **Done** | P2       | Courses and membership | Modules and submodules can be created under nonexistent parents                         |
| ASSESS-01 | **Done** | P1       | Coding and MCQ         | The coding judge does not execute code or tests                                         |
| ASSESS-02 | **Done** | P2       | Coding and MCQ         | Coding jobs are lost on process restart                                                 |
| ASSESS-03 | **Done** | P2       | Coding and MCQ         | Any authenticated user can read another student's coding result                         |
| ASSESS-04 | **Done** | P2       | Coding and MCQ         | Concurrent MCQ attempts race on attempt numbering                                       |
| UI-01     | **Done** | P1       | Frontend               | Successful real course responses are replaced with fabricated learning data             |
| UI-02     | **Done** | P1       | Frontend               | The lesson UI discards quiz answers and submitted code                                  |
| UI-03     | **Done** | P2       | Frontend               | Emailed password-reset links have no frontend route                                     |
| UI-04     | **Done** | P2       | Frontend               | Silent refresh/OAuth restores a token but leaves the user profile empty                 |
| UI-05     | **Done** | P2       | Frontend               | The global 401 interceptor mishandles login failure and waiting requests                |
| UI-06     | **Done** | P1       | Frontend               | Evaluation UI still treats enqueue success as completed evaluation                      |
| UI-07     | **Done** | P2       | Frontend               | The public submission link now requires an undisclosed login                            |
| UI-08     | **Done** | P2       | Frontend               | Unavailable security scans are shown as zero findings                                   |
| MEDIA-01  | **Done** | P1       | Media                  | Upload trigger reports transcoding success without creating a job                       |
| MEDIA-02  | **Done** | P1       | Media                  | Standalone completion Lambda never connects to MongoDB                                  |
| MEDIA-03  | **Done** | P2       | Media                  | S3 signing failures return unusable URLs as success                                     |
| DEPLOY-01 | **Done** | P1       | Deployment             | Gateway routes coding requests to a path the coding app does not serve                  |
| DEPLOY-02 | **Done** | P1       | Deployment             | Membership endpoints are routed to the wrong service                                    |
| DEPLOY-03 | **Done** | P1       | Deployment             | Compose asks production-only images to load a removed development logger                |
| DEPLOY-04 | **Done** | P1       | Deployment             | Project-review runtime image lacks the Git executable it calls                          |
| DEPLOY-05 | **Done** | P1       | Deployment             | Docker Compose does not provide the evaluator's required Redis queue                    |
| EVAL-01   | **Done** | P1       | Project evaluator      | Isolated execution/scanning services are client contracts, not runnable implementations |
| EVAL-02   | **Done** | P1       | Project evaluator      | Workflow failures resolve successfully, bypassing configured queue retries              |
| EVAL-03   | **Done** | P1       | Project evaluator      | Evaluation dispatch and status updates are not atomic                                   |
| EVAL-04   | **Done** | P2       | Project evaluator      | Crash recovery loses activity checkpoints and can change the evaluated commit           |
| EVAL-05   | **Done** | P1       | Project evaluator      | Repository discovery can exhaust the API worker's memory                                |
| EVAL-06   | **Done** | P1       | Project evaluator      | A filename or OpenAPI declaration is treated as proof of working functionality          |
| EVAL-07   | **Done** | P1       | Project evaluator      | Incomplete checks and failing builds can still produce COMPLETE and 100/100             |
| EVAL-08   | **Done** | P1       | Project evaluator      | Judge overall-score overrides do not reliably affect ranking                            |
| EVAL-09   | **Done** | P2       | Project evaluator      | Re-evaluation silently clears an applied judge override                                 |
| EVAL-10   | **Done** | P2       | Project evaluator      | Sparse ranking still allocates and iterates a dense quadratic matrix                    |
| EVAL-11   | **Done** | P2       | Project evaluator      | A zero-weight criterion gets weight 0.2 during ranking                                  |
| EVAL-12   | **Done** | P2       | Project evaluator      | Deleted or failed evaluations can leave stale teams/results in the leaderboard          |
| EVAL-13   | **Done** | P2       | Project evaluator      | CSV report fields permit spreadsheet-formula injection                                  |
| EVAL-14   | **Done** | P2       | Project evaluator      | Runner payload validation accepts inconsistent or incomplete metrics                    |
| EVAL-15   | **Done** | P2       | Project evaluator      | Editing an evaluated submission does not invalidate its old report                      |
| EVAL-16   | **Done** | P2       | Project evaluator      | Completed events still accept new submissions                                           |
| EVAL-17   | **Done** | P2       | Project evaluator      | Judge score changes and their audit records can diverge                                 |
| EVAL-18   | **Done** | P2       | Project evaluator      | Configured score ranges and strict-scoring settings are not enforced                    |

## Authentication

### AUTH-01 — [P1] Password-reset token accepts MongoDB query operators

Source: [packages/auth-service/src/modules/public/auth/auth.validator.ts:60](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/auth-service/src/modules/public/auth/auth.validator.ts:60); [packages/auth-service/src/shared/dao/token.dao.ts:19](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/auth-service/src/shared/dao/token.dao.ts:19).

A JSON object is accepted as token because only notEmpty() is checked. Mongoose preserves {$ne: null} in the value query, so a caller need not possess the selected token to reset its account. An existing pending token is sufficient; forgot-password can create one. The isolated probe confirmed both validator acceptance and the cast query; it did not attack a live database.

Fix direction: Require a scalar string and use an exact, hashed reset-token lookup; reject query operators before reaching the DAO.

Evidence: Reproduced.

### AUTH-02 — [P1] OTP and expired tokens are accepted as password-reset tokens

Source: [packages/auth-service/src/modules/public/auth/auth.controller.ts:381](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/auth-service/src/modules/public/auth/auth.controller.ts:381); [packages/auth-service/src/shared/models/token.model.ts:23](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/auth-service/src/shared/models/token.model.ts:23).

resetPassword finds tokens by value only and never checks type or expiresAt. A stored OTP, invitation token, or expired record pending TTL cleanup can change a password. The probe supplied an OTP expired since 1970 and observed HTTP 200 plus a password change.

Fix direction: Atomically consume an unexpired token of type reset; do not rely on asynchronous TTL deletion for authorization.

Evidence: Reproduced.

### AUTH-03 — [P1] Signup can claim email verification without proving ownership

Source: [packages/auth-service/src/modules/public/auth/auth.controller.ts:53](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/auth-service/src/modules/public/auth/auth.controller.ts:53); [packages/auth-service/src/modules/public/auth/auth.router.ts:25](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/auth-service/src/modules/public/auth/auth.router.ts:25).

Any truthy body.token makes isVerified true; the token is never checked against the email. Ordinary signup sends an OTP but the router exposes no OTP verification operation, so the legitimate verification flow is also incomplete.

Fix direction: Verify the actual email-bound token before setting isVerified and expose the intended verification flow.

Evidence: Static.

### AUTH-04 — [P1] Every normal auth-issued token becomes a project judge

Source: [packages/project-review-service/src/shared/middlewares/auth.middleware.ts:40](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/project-review-service/src/shared/middlewares/auth.middleware.ts:40); [packages/auth-service/src/shared/utils/buildTokenPayload.util.ts:8](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/auth-service/src/shared/utils/buildTokenPayload.util.ts:8); [packages/project-review-service/src/modules/review/review.router.ts:192](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/project-review-service/src/modules/review/review.router.ts:192).

Auth payloads contain no role. Review middleware substitutes judge for a missing role, enabling any signed-in user to edit/delete submissions, trigger evaluation, and override grades. The probe used the actual auth payload builder and observed judge authorization.

Fix direction: Default to an unprivileged role and enforce explicit, trusted event-scoped judge membership.

Evidence: Reproduced.

### AUTH-05 — [P1] Unauthenticated callers can create or overwrite course-admin memberships

Source: [packages/user-service/src/modules/rbac/rbac.router.ts:24](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/user-service/src/modules/rbac/rbac.router.ts:24); [packages/user-service/src/modules/rbac/rbac.controller.ts:48](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/user-service/src/modules/rbac/rbac.controller.ts:48); [packages/user-service/src/shared/dao/courseMembership.dao.ts:21](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/user-service/src/shared/dao/courseMembership.dao.ts:21).

POST /api/rbac/initial-admin has no authentication and accepts arbitrary courseId/userId. It upserts an active admin membership even for an already-existing course. A local HTTP probe returned 201 without credentials. The direct user-service port is exposed by Compose; lack of an ingress mapping is not an authorization control.

Fix direction: Protect bootstrap with service authentication and enforce a one-time course-creation contract; never expose an unrestricted role upsert.

Evidence: Reproduced.

### AUTH-06 — [P1] Real trainer/admin memberships do not authorize the other services

Source: [packages/auth-service/src/shared/utils/buildTokenPayload.util.ts:8](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/auth-service/src/shared/utils/buildTokenPayload.util.ts:8); [packages/course-service/src/shared/middlewares/auth.middleware.ts:46](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/course-service/src/shared/middlewares/auth.middleware.ts:46); [packages/user-service/src/modules/competency/competency.controller.ts:43](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/user-service/src/modules/competency/competency.controller.ts:43).

Auth users/payloads have no role, while course, coding, MCQ, media, and competency writes require a role from that token. Course memberships stored in user-service are not consulted. Assigning a real user trainer/admin therefore still leaves content-management endpoints returning 403; tests hide this by signing their own role-bearing tokens.

Fix direction: Connect authorization to the course membership source of truth and define trusted platform-level roles separately.

Evidence: Static.

### AUTH-07 — [P1] Known fallback signing secrets are usable outside tests

Source: [packages/auth-service/src/shared/config/env.config.ts:15](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/auth-service/src/shared/config/env.config.ts:15); [packages/course-service/src/shared/config/env.config.ts:16](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/course-service/src/shared/config/env.config.ts:16); [docker-compose.yml:23](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/docker-compose.yml:23).

Environment validation accepts publicly committed default JWT secrets, including when NODE_ENV is production. Missing deployment secrets can therefore enable forged tokens. Compose explicitly uses a known shared secret. Separately, auth's built-in default differs from the other services' defaults, so starting packages without aligned configuration produces cross-service 401s.

Fix direction: Fail startup on missing/weak production secrets and provide one consistent explicit development configuration; do not expose default-secret deployments.

Evidence: Static; configuration-dependent.

### AUTH-08 — [P1] UI Sign Out does not terminate the login session

Source: [packages/frontend/src/features/dashboard/ui/DashboardPage.tsx:24](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/frontend/src/features/dashboard/ui/DashboardPage.tsx:24); [packages/frontend/src/features/course/ui/CoursePage.tsx:50](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/frontend/src/features/course/ui/CoursePage.tsx:50); [packages/frontend/src/app/router.tsx:23](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/frontend/src/app/router.tsx:23).

Both logout handlers only clear Redux/localStorage and navigate. They never call authApi.logout, so the HTTP-only refresh cookie and database session survive. Returning to /dashboard runs silent refresh and logs the supposedly signed-out user back in, which is particularly unsafe on a shared computer.

Fix direction: Call the server logout endpoint, clear authenticated query caches, then clear local state and navigate.

Evidence: Static.

### AUTH-09 — [P2] SMTP failures can become unhandled promise rejections

Source: [packages/auth-service/src/shared/utils/sendMail.util.ts:7](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/auth-service/src/shared/utils/sendMail.util.ts:7); [packages/auth-service/src/modules/public/auth/auth.controller.ts:365](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/auth-service/src/modules/public/auth/auth.controller.ts:365).

With SEND_MAIL=true, sendMail invokes transporter.sendMail without returning, awaiting, or catching its promise. A connection/authentication failure is unhandled while signup/reset claims success; under the Node runtime's default rejection behavior this can terminate the process.

Fix direction: Return/await mail delivery or dispatch a durable mail job, catch failures, and report delivery/queue failures accurately.

Evidence: Static; SMTP-dependent.

## Courses and membership

### COURSE-01 — [P1] Course access and mutations ignore course-specific authorization

Source: [packages/course-service/src/modules/course/course.router.ts:29](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/course-service/src/modules/course/course.router.ts:29); [packages/course-service/src/modules/course/course.controller.ts:40](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/course-service/src/modules/course/course.controller.ts:40); [packages/course-service/src/modules/progress/progress.router.ts:40](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/course-service/src/modules/progress/progress.router.ts:40).

Update and grades endpoints check only a global token role, then accept any course ID. A trainer token can modify another instructor's course and read its grades. Read/list endpoints also return drafts and unrelated courses without enrollment checks. Module/submodule/content routes follow the same unscoped pattern.

Fix direction: Resolve the owning course for each resource and require the caller's active membership/permissions in that course; filter trainee reads.

Evidence: Static.

### COURSE-02 — [P1] Students can award their own assessment scores

Source: [packages/course-service/src/modules/progress/progress.controller.ts:67](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/course-service/src/modules/progress/progress.controller.ts:67); [packages/course-service/src/modules/progress/progress.router.ts:16](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/course-service/src/modules/progress/progress.router.ts:16).

Any authenticated user can complete a coding/MCQ item without submitting an answer. Omitting scoreEarned awards the full max_score, and supplying it allows the student to choose any score up to that maximum. The isolated controller probe awarded 100 marks for an unjudged coding item.

Fix direction: Accept assessment grades only from authenticated judge/MCQ results; reserve learner completion for appropriate non-assessment content.

Evidence: Reproduced.

### COURSE-03 — [P1] Content from one course can increase another course's grades

Source: [packages/course-service/src/modules/progress/progress.controller.ts:55](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/course-service/src/modules/progress/progress.controller.ts:55); [packages/course-service/src/modules/progress/progress.controller.ts:77](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/course-service/src/modules/progress/progress.controller.ts:77).

completeItem independently checks that the course and content item exist, but never verifies item → submodule → module → course ancestry. Supplying course A and an item from course B credits A; unrelated items can inflate percentages above 100%. The isolated probe supplied an unrelated item's submodule and the award still succeeded.

Fix direction: Validate resource ancestry and membership before recording completion.

Evidence: Reproduced.

### COURSE-04 — [P2] POST membership assignment bypasses the last-admin safeguard

Source: [packages/user-service/src/modules/membership/membership.controller.ts:71](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/user-service/src/modules/membership/membership.controller.ts:71); [packages/user-service/src/shared/dao/courseMembership.dao.ts:21](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/user-service/src/shared/dao/courseMembership.dao.ts:21).

PUT role and DELETE member protect the last admin, but POST /members also upserts existing memberships without that check. The sole admin can POST their own userId with role trainee and leave the course without an admin. The probe confirmed the upsert proceeds.

Fix direction: Use the same atomic last-admin invariant on every write path, including assignment/upsert.

Evidence: Reproduced.

### COURSE-05 — [P2] Creating a course never enrolls its creator as initial admin

Source: [packages/course-service/src/modules/course/course.controller.ts:22](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/course-service/src/modules/course/course.controller.ts:22); [packages/user-service/src/modules/rbac/rbac.controller.ts:48](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/user-service/src/modules/rbac/rbac.controller.ts:48).

Course creation writes only the course document. Nothing calls the initial-admin registration operation or creates a membership. Even with a valid privileged token, the creator is absent from /profile/me courses and cannot administer memberships through the course-scoped routes.

Fix direction: Provision creator membership as part of a reliable course-creation workflow with retry/compensation.

Evidence: Static.

### COURSE-06 — [P2] Concurrent completions can corrupt progress totals

Source: [packages/course-service/src/shared/dao/courseProgress.dao.ts:26](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/course-service/src/shared/dao/courseProgress.dao.ts:26); [packages/course-service/src/shared/dao/courseProgress.dao.ts:64](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/course-service/src/shared/dao/courseProgress.dao.ts:64); [packages/course-service/src/shared/models/courseProgress.model.ts:72](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/course-service/src/shared/models/courseProgress.model.ts:72).

Completion does find → modify arrays/totals → save without atomic deduplication or optimistic concurrency. Two requests reading the same total can append completions but overwrite the total with stale values; simultaneous first completions can also collide on the unique course/user index and return 500.

Fix direction: Use an atomic, idempotent completion update or a transaction that maintains totalScoreEarned and per-item uniqueness together.

Evidence: Static concurrency analysis.

### COURSE-07 — [P1] Cross-service content lookup is still a placeholder

Source: [packages/course-service/src/services/externalContent.service.ts:39](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/course-service/src/services/externalContent.service.ts:39); [packages/course-service/src/services/externalContent.service.ts:66](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/course-service/src/services/externalContent.service.ts:66).

No production code registers the providers. Therefore attaching a reference accepts nonexistent question/media IDs and invents title/max_score, while reading details returns only type/ref_id/status:ready instead of the actual video, question, or code problem.

Fix direction: Implement authenticated provider calls and propagate real not-found/failure responses.

Evidence: Static; missing integration.

### COURSE-08 — [P2] Modules and submodules can be created under nonexistent parents

Source: [packages/course-service/src/modules/module/module.controller.ts:18](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/course-service/src/modules/module/module.controller.ts:18); [packages/course-service/src/modules/submodule/submodule.controller.ts:23](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/course-service/src/modules/submodule/submodule.controller.ts:23).

Creation inserts courseId/moduleId without looking up the parent. A syntactically valid but nonexistent ObjectId creates an orphan that is inaccessible through a real course; update routes can also replace parent references without an existence check.

Fix direction: Validate parent existence and authorization on creation/reparenting, maintaining referential integrity.

Evidence: Static.

## Coding and MCQ

### ASSESS-01 — [P1] The coding judge does not execute code or tests

Source: [packages/coding-service/src/workers/judge.worker.ts:41](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/coding-service/src/workers/judge.worker.ts:41).

The worker awards AC and full marks to every string unless it contains syntax_error or wrong_answer. Language, expected outputs, resource limits, and submitted behavior are ignored; timings/memory are fabricated. The probe submitted non-executable text and received AC/100.

Fix direction: Replace the simulator with a real isolated judge before treating these records as grades; clearly disable/mock it in non-production modes only.

Evidence: Reproduced.

### ASSESS-02 — [P2] Coding jobs are lost on process restart

Source: [packages/coding-service/src/workers/judge.worker.ts:83](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/coding-service/src/workers/judge.worker.ts:83); [packages/coding-service/src/modules/question/question.controller.ts:84](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/coding-service/src/modules/question/question.controller.ts:84).

Submission rows are persisted as queued, but dispatch is only setImmediate in the API process. Restarting after the insert loses the job because there is no durable queue or recovery scan. If the question is missing after dispatch, the worker also returns with status still running.

Fix direction: Use persistent job dispatch, recovery, and terminal states for every failure branch.

Evidence: Static.

### ASSESS-03 — [P2] Any authenticated user can read another student's coding result

Source: [packages/coding-service/src/modules/question/question.controller.ts:107](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/coding-service/src/modules/question/question.controller.ts:107); [packages/coding-service/src/shared/sanitizers/coding.sanitizer.ts:44](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/coding-service/src/shared/sanitizers/coding.sanitizer.ts:44).

The submission GET looks up only the supplied ID and does not verify ownership or instructor permission. The response discloses userId, scores, test results, and timestamps belonging to another learner. The sanitizer does not include source code, so this finding is a result/grade disclosure, not a source-code leak.

Fix direction: Authorize access by submission owner or an explicitly authorized course instructor.

Evidence: Static.

### ASSESS-04 — [P2] Concurrent MCQ attempts race on attempt numbering

Source: [packages/mcq-service/src/modules/question/question.controller.ts:95](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/mcq-service/src/modules/question/question.controller.ts:95); [packages/mcq-service/src/shared/models/attempt.model.ts:50](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/mcq-service/src/shared/models/attempt.model.ts:50).

The controller counts attempts, computes count+1, then inserts. Concurrent submissions can choose the same number; the unique index rejects one as a database error instead of returning a defined attempt outcome. The index prevents the simple greater-than-three bypass, but does not make allocation atomic.

Fix direction: Allocate attempts atomically and translate exhausted/conflicting attempts into a defined application response.

Evidence: Static concurrency analysis.

## Frontend

### UI-01 — [P1] Successful real course responses are replaced with fabricated learning data

Source: [packages/frontend/src/features/course/api/courseApi.ts:242](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/frontend/src/features/course/api/courseApi.ts:242); [packages/frontend/src/features/dashboard/api/dashboardApi.ts:110](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/frontend/src/features/dashboard/api/dashboardApi.ts:110); [packages/course-service/src/modules/contentItem/contentItem.controller.ts:33](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/course-service/src/modules/contentItem/contentItem.controller.ts:33).

getCourseStructure expects modules in a response that only contains course metadata; detail expects title at the root instead of {item,details}; leaderboard expects rankings instead of grades. These normal responses all fall back to hardcoded sample lessons/ranks. Empty lists and errors also become mock courses, random activity, and notifications, disguising outages and displaying incorrect progress.

Fix direction: Align the API contracts, fetch/assemble actual curriculum and progress, and gate demo fixtures behind an explicit demo mode.

Evidence: Static.

### UI-02 — [P1] The lesson UI discards quiz answers and submitted code

Source: [packages/frontend/src/features/course/ui/ContentDetailPane.tsx:19](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/frontend/src/features/course/ui/ContentDetailPane.tsx:19); [packages/frontend/src/features/course/ui/ContentDetailPane.tsx:170](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/frontend/src/features/course/ui/ContentDetailPane.tsx:170); [packages/frontend/src/features/course/ui/CoursePage.tsx:55](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/frontend/src/features/course/ui/CoursePage.tsx:55).

Code and selectedOption stay only in component state. The action passes just item.id to the generic completion endpoint, never to the coding or MCQ submit APIs. Users receive no genuine answer evaluation and their work is not persisted as a submission.

Fix direction: Wire type-specific submit operations with answer/code/language, then display the returned assessment outcome and progress.

Evidence: Static.

### UI-03 — [P2] Emailed password-reset links have no frontend route

Source: [packages/auth-service/src/modules/public/auth/auth.controller.ts:368](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/auth-service/src/modules/public/auth/auth.controller.ts:368); [packages/frontend/src/app/router.tsx:86](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/frontend/src/app/router.tsx:86).

Reset emails link to /reset-password/:token, but the router defines no reset-password page. Its wildcard redirects the user to /dashboard and then possibly login, making the provided reset link unusable.

Fix direction: Add the reset page/route and call the reset endpoint with the URL token.

Evidence: Static.

### UI-04 — [P2] Silent refresh/OAuth restores a token but leaves the user profile empty

Source: [packages/frontend/src/app/router.tsx:24](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/frontend/src/app/router.tsx:24); [packages/frontend/src/features/auth/api/authApi.ts:23](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/frontend/src/features/auth/api/authApi.ts:23); [packages/frontend/src/features/dashboard/ui/DashboardPage.tsx:18](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/frontend/src/features/dashboard/ui/DashboardPage.tsx:18).

The backend refresh response includes user, but the frontend drops it and dispatches only setAccessToken. On OAuth login or a session restored without local user data, state.auth.user stays null and the header—including Sign Out—is absent. The unused current-user helper also unwraps data incorrectly: /auth/me returns data.user.

Fix direction: Hydrate both token and user on refresh; unwrap /auth/me correctly and wire profile loading into the authenticated shell.

Evidence: Static.

### UI-05 — [P2] The global 401 interceptor mishandles login failure and waiting requests

Source: [packages/frontend/src/shared/lib/axiosClient.ts:26](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/frontend/src/shared/lib/axiosClient.ts:26); [packages/frontend/src/shared/lib/axiosClient.ts:49](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/frontend/src/shared/lib/axiosClient.ts:49); [packages/frontend/src/features/auth/api/authApi.ts:5](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/frontend/src/features/auth/api/authApi.ts:5).

A wrong password produces 401, which the interceptor treats as an expired access token: it attempts refresh and redirects to / instead of leaving the login form with its error. Concurrent requests queued while refreshing have only resolve callbacks; a refresh failure neither rejects nor clears them.

Fix direction: Exclude auth login/refresh operations from automatic refresh, and settle every queued request on both success and failure.

Evidence: Static.

### UI-06 — [P1] Evaluation UI still treats enqueue success as completed evaluation

Source: [packages/frontend/src/features/review/ui/ReviewDashboard.tsx:119](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/frontend/src/features/review/ui/ReviewDashboard.tsx:119); [packages/frontend/src/features/review/ui/ReviewDashboard.tsx:163](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/frontend/src/features/review/ui/ReviewDashboard.tsx:163); [packages/frontend/src/features/review/ui/SubmissionDetailModal.tsx:116](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/frontend/src/features/review/ui/SubmissionDetailModal.tsx:116).

The API now returns 202 when a job is queued, but the dashboard immediately computes ranking and stops its running indicator. First runs often fail with no evaluations; reruns show old rankings. The modal fetches once immediately and never polls completion, leaving stale results and re-enabling Run while work is active.

Fix direction: Poll/subscribe to durable job status, keep running state through terminal completion, and refresh reports/rankings afterward.

Evidence: Static.

### UI-07 — [P2] The public submission link now requires an undisclosed login

Source: [packages/frontend/src/app/router.tsx:79](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/frontend/src/app/router.tsx:79); [packages/frontend/src/features/review/ui/PublicSubmissionPage.tsx:1](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/frontend/src/features/review/ui/PublicSubmissionPage.tsx:1); [packages/project-review-service/src/modules/review/review.router.ts:19](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/project-review-service/src/modules/review/review.router.ts:19).

The UI advertises a public submission page, but router-wide authentication now protects its event lookup and submission POST. Anonymous visitors hit 401 and the interceptor sends them to the landing page; there is no public event/invitation flow or return-to-submission login path.

Fix direction: Define the intended public/invitation contract, or require login explicitly and preserve the submission URL through authentication.

Evidence: Static.

### UI-08 — [P2] Unavailable security scans are shown as zero findings

Source: [packages/frontend/src/features/review/ui/SubmissionDetailModal.tsx:1099](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/frontend/src/features/review/ui/SubmissionDetailModal.tsx:1099); [packages/project-review-service/src/modules/runners/code-analysis.runner.ts:194](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/project-review-service/src/modules/runners/code-analysis.runner.ts:194).

The evidence cards display totalIssues || 0, secretsFoundCount || 0, and vulnerabilityCount || 0 without rendering execution status. An unavailable or failed scan therefore appears to have found no issues, obscuring the backend's explicit evidence-gap status.

Fix direction: Show tool status and error first; display clean/zero findings only after a successful scan.

Evidence: Static.

## Media

### MEDIA-01 — [P1] Upload trigger reports transcoding success without creating a job

Source: [packages/media-service/src/lambdas/s3-mediaconvert-trigger.ts:26](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/media-service/src/lambdas/s3-mediaconvert-trigger.ts:26).

The S3 handler creates a timestamp-based mockJobId and logs success. It never calls MediaConvert, associates the object with a resource, or sets processing status. Real uploads remain pending and no real completion event will arrive from this handler.

Fix direction: Submit actual MediaConvert jobs with resource metadata and track processing/failure states idempotently.

Evidence: Static; missing implementation.

### MEDIA-02 — [P1] Standalone completion Lambda never connects to MongoDB

Source: [packages/media-service/src/lambdas/transcode-completion-handler.ts:24](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/media-service/src/lambdas/transcode-completion-handler.ts:24); [packages/media-service/src/lambdas/transcode-completion-handler.ts:43](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/media-service/src/lambdas/transcode-completion-handler.ts:43).

The exported Lambda handler instantiates a Mongoose DAO but neither it nor its imported path initializes a database connection. A cold Lambda invocation buffers the update and times out instead of marking the resource ready/failed; the API server's connection is in another process.

Fix direction: Initialize/cache a MongoDB connection in the Lambda runtime and handle retryable update failures.

Evidence: Static deployment analysis.

### MEDIA-03 — [P2] S3 signing failures return unusable URLs as success

Source: [packages/media-service/src/services/s3.service.ts:27](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/media-service/src/services/s3.service.ts:27); [packages/media-service/src/services/s3.service.ts:40](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/media-service/src/services/s3.service.ts:40).

When signing throws, the service returns a normal S3 URL with ?signed=true. This is not an AWS signature, so private-bucket upload/download requests fail while the API claims to have generated a usable presigned URL.

Fix direction: Propagate a signing/configuration error and do not create a success response with a fabricated URL.

Evidence: Static.

## Deployment

### DEPLOY-01 — [P1] Gateway routes coding requests to a path the coding app does not serve

Source: [k8s/ingress.yml:104](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/k8s/ingress.yml:104); [packages/frontend/nginx.conf:102](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/frontend/nginx.conf:102); [packages/coding-service/src/app.ts:14](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/coding-service/src/app.ts:14).

Ingress/nginx forward /api/coding unchanged, but the app mounts question/submission routes under /api/questions and /api/submissions. The local HTTP probe returned 404 for /api/coding/questions while /api/questions reached authentication (401). The actual /api/questions ingress path belongs to MCQ.

Fix direction: Give coding a consistent /api/coding mount or add an explicit safe gateway rewrite.

Evidence: Reproduced.

### DEPLOY-02 — [P1] Membership endpoints are routed to the wrong service

Source: [packages/user-service/src/shared/routers/index.router.ts:17](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/user-service/src/shared/routers/index.router.ts:17); [k8s/ingress.yml:62](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/k8s/ingress.yml:62); [packages/frontend/nginx.conf:26](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/frontend/nginx.conf:26).

User-service exposes /api/courses/:courseId/members and /my-role, but all /api/courses traffic goes to course-service. No dedicated user-membership prefix or matching gateway routes exist; documented /api/users/courses paths are not mounted either. Membership administration therefore fails through the normal gateway.

Fix direction: Use an unambiguous user-service membership prefix and align service routes, documentation, nginx, and ingress.

Evidence: Static.

### DEPLOY-03 — [P1] Compose asks production-only images to load a removed development logger

Source: [docker-compose.yml:21](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/docker-compose.yml:21); [packages/auth-service/Dockerfile:11](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/auth-service/Dockerfile:11); [packages/auth-service/src/shared/config/logger.config.ts:8](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/auth-service/src/shared/config/logger.config.ts:8).

Backend Dockerfiles deploy production dependencies only, excluding pino-pretty, but Compose sets NODE_ENV=development. Logger initialization then requests the absent pino-pretty transport and fails at startup. The same packaging/environment pattern is repeated across backend services.

Fix direction: Run production images with production logging or include the development transport in explicitly development images.

Evidence: Static deployment analysis.

### DEPLOY-04 — [P1] Project-review runtime image lacks the Git executable it calls

Source: [packages/project-review-service/Dockerfile:14](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/project-review-service/Dockerfile:14); [packages/project-review-service/src/modules/runners/repository.runner.ts:41](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/project-review-service/src/modules/runners/repository.runner.ts:41).

The runtime is plain node:22-alpine with copied application files and no Git installation. Repository acquisition unconditionally spawns git, so evaluations fail at clone in the shipped image even after Redis is configured.

Fix direction: Install the required trusted Git/SSH tooling in the runtime or move acquisition into a properly provisioned isolated worker.

Evidence: Static deployment analysis.

### DEPLOY-05 — [P1] Docker Compose does not provide the evaluator's required Redis queue

Source: [docker-compose.yml:108](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/docker-compose.yml:108); [packages/project-review-service/src/modules/workflows/evaluation.queue.ts:13](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/project-review-service/src/modules/workflows/evaluation.queue.ts:13).

The new queue requires REDIS_URL, but Compose defines neither Redis nor that variable; its obsolete TEMPORAL_ADDRESS has no effect. The worker disables itself and every evaluate request fails when enqueue tries to create a connection.

Fix direction: Add persistent Redis configuration and worker readiness checks, or document and enforce an explicit external Redis prerequisite.

Evidence: Static deployment analysis.

## Project evaluator

### EVAL-01 — [P1] Isolated execution/scanning services are client contracts, not runnable implementations

Source: [packages/project-review-service/src/modules/runners/build-test.runner.ts:51](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/project-review-service/src/modules/runners/build-test.runner.ts:51); [packages/project-review-service/src/modules/runners/sandbox.runner.ts:29](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/project-review-service/src/modules/runners/sandbox.runner.ts:29); [k8s/project-review-deployment.yml:61](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/k8s/project-review-deployment.yml:61).

Build/test, browser, API, and static runners POST to externally configured URLs. No server implementations, runner images, or dispatcher that applies the generated Kubernetes manifests are present. The provided manifests only optionally read endpoint secrets, so a repository-only deployment cannot deliver the promised complete dynamic evaluation.

Fix direction: Implement/deploy the runners and dispatcher or explicitly scope delivery as an API requiring separately supplied services. Do not present the manifest generator as executed isolation.

Evidence: Static; missing integration.

### EVAL-02 — [P1] Workflow failures resolve successfully, bypassing configured queue retries

Source: [packages/project-review-service/src/modules/workflows/workflow.runner.ts:236](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/project-review-service/src/modules/workflows/workflow.runner.ts:236); [packages/project-review-service/src/modules/workflows/evaluation.queue.ts:48](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/project-review-service/src/modules/workflows/evaluation.queue.ts:48).

The workflow catches activity errors, records FAILED, then returns normally. The BullMQ processor returns this resolved result, so attempts:3/backoff are not activated for those failures. The probe injected a clone exception and observed a resolved FAILED result rather than a rejected job.

Fix direction: Persist failure evidence, then throw a typed retryable failure to the queue; handle non-retryable failures explicitly.

Evidence: Reproduced.

### EVAL-03 — [P1] Evaluation dispatch and status updates are not atomic

Source: [packages/project-review-service/src/modules/review/review.controller.ts:329](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/project-review-service/src/modules/review/review.controller.ts:329); [packages/project-review-service/src/modules/review/review.controller.ts:343](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/project-review-service/src/modules/review/review.controller.ts:343); [packages/project-review-service/src/modules/workflows/evaluation.queue.ts:34](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/project-review-service/src/modules/workflows/evaluation.queue.ts:34).

Two callers can both observe an idle submission and enqueue different timestamp-ID jobs. Both workers then overwrite the same evidence/evaluation records. Also, a worker can set CLONING before the controller's later QUEUED update, regressing status and currentWorkflowId.

Fix direction: Atomically claim an evaluation generation, use an idempotent job key, and condition all state updates on the active generation.

Evidence: Static concurrency analysis.

### EVAL-04 — [P2] Crash recovery loses activity checkpoints and can change the evaluated commit

Source: [packages/project-review-service/src/modules/workflows/workflow.runner.ts:55](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/project-review-service/src/modules/workflows/workflow.runner.ts:55); [packages/project-review-service/src/modules/workflows/workflow.runner.ts:253](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/project-review-service/src/modules/workflows/workflow.runner.ts:253); [packages/project-review-service/src/modules/workflows/evaluation.activities.ts:26](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/project-review-service/src/modules/workflows/evaluation.activities.ts:26).

Activity traces exist only in memory until the whole workflow finishes. A crash loses that trace and reruns all activities. The resolved SHA is written to Submission, not to the existing queue job; a stalled job originally submitted without commitHash can reacquire a later branch head on retry. This is job-level retry, not durable per-activity replay of an immutable run.

Fix direction: Persist the resolved commit and step checkpoints against a stable evaluation ID before advancing, and resume from those records.

Evidence: Static crash-recovery analysis.

### EVAL-05 — [P1] Repository discovery can exhaust the API worker's memory

Source: [packages/project-review-service/src/modules/runners/discovery.runner.ts:130](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/project-review-service/src/modules/runners/discovery.runner.ts:130); [packages/project-review-service/src/modules/runners/discovery.runner.ts:198](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/project-review-service/src/modules/runners/discovery.runner.ts:198); [k8s/project-review-deployment.yml:25](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/k8s/project-review-deployment.yml:25).

Discovery stores every eligible file's full text in fileContents. Limits are per file (5 MiB) and count (50,000), with no aggregate byte cap; a repository containing hundreds of moderately sized text files can exceed the 512 MB pod limit. Acquisition also lacks a disk-byte quota before checkout. This untrusted workload runs in the same process as the API worker.

Fix direction: Enforce aggregate checkout/read budgets, stream hashes, retain only selected bounded snippets, and isolate acquisition/discovery resources.

Evidence: Static resource analysis.

### EVAL-06 — [P1] A filename or OpenAPI declaration is treated as proof of working functionality

Source: [packages/project-review-service/src/modules/scoring/scoring.engine.ts:224](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/project-review-service/src/modules/scoring/scoring.engine.ts:224); [packages/project-review-service/src/modules/scoring/scoring.engine.ts:263](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/project-review-service/src/modules/scoring/scoring.engine.ts:263).

Requirement compliance is FULFILLED whenever the target path/endpoint string exists; implementation content, mandatory behavior, and runtime results are ignored. Even an empty src/auth.ts can fulfill Working authentication with confidence 1. The probe confirmed this behavior from a manifest-only target.

Fix direction: Distinguish declared/present from behaviorally verified, and require executable or reviewed evidence for functional compliance.

Evidence: Reproduced.

### EVAL-07 — [P1] Incomplete checks and failing builds can still produce COMPLETE and 100/100

Source: [packages/project-review-service/src/modules/scoring/scoring.engine.ts:67](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/project-review-service/src/modules/scoring/scoring.engine.ts:67); [packages/project-review-service/src/modules/scoring/scoring.engine.ts:296](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/project-review-service/src/modules/scoring/scoring.engine.ts:296).

Any positive criterion confidence counts the criterion's full weight as covered. A security-only event with just one successful clean scanner and two unavailable scanners receives coverage 1, COMPLETE, and 100/100. Build/test failures are not used to gate this status or deduct a score. The probe included a failed build and observed exactly that result.

Fix direction: Define required evidence stages and completeness independently of criterion availability; incorporate relevant build/runtime/security failures into the applicable rubric.

Evidence: Reproduced.

### EVAL-08 — [P1] Judge overall-score overrides do not reliably affect ranking

Source: [packages/project-review-service/src/modules/review/review.controller.ts:577](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/project-review-service/src/modules/review/review.controller.ts:577); [packages/project-review-service/src/modules/ranking/pairwise.engine.ts:26](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/project-review-service/src/modules/ranking/pairwise.engine.ts:26); [packages/project-review-service/src/modules/ranking/pairwise.engine.ts:182](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/project-review-service/src/modules/ranking/pairwise.engine.ts:182).

Override changes overallScore only; pairwise winners still use unchanged criterion scores, and sorting prioritizes pairwise ability over overallScore. In the probe, team A was overridden to 0 but remained rank 1 over team B scoring 50.

Fix direction: Define override semantics in the ranking model and apply the judge's decision consistently to comparisons and ordering.

Evidence: Reproduced.

### EVAL-09 — [P2] Re-evaluation silently clears an applied judge override

Source: [packages/project-review-service/src/modules/scoring/scoring.engine.ts:108](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/project-review-service/src/modules/scoring/scoring.engine.ts:108).

Every scoring upsert overwrites overallScore and sets judgeOverride.overridden=false. Re-running an already adjudicated submission discards its effective manual decision without an explicit revoke operation, though a separate audit row may remain.

Fix direction: Preserve adjudications across runs or require/version an explicit policy for superseding them.

Evidence: Static.

### EVAL-10 — [P2] Sparse ranking still allocates and iterates a dense quadratic matrix

Source: [packages/project-review-service/src/modules/ranking/pairwise.engine.ts:126](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/project-review-service/src/modules/ranking/pairwise.engine.ts:126); [packages/project-review-service/src/modules/ranking/pairwise.engine.ts:153](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/project-review-service/src/modules/ranking/pairwise.engine.ts:153).

The service limits comparisons for cohorts above 100, but Bradley–Terry allocates n×n arrays and visits every j for every i on each iteration. Large cohorts still consume quadratic memory and CPU and block the API event loop; sparse match generation does not remove that bottleneck.

Fix direction: Represent matches as sparse adjacency lists and run expensive ranking outside the request-serving event loop.

Evidence: Static complexity analysis.

### EVAL-11 — [P2] A zero-weight criterion gets weight 0.2 during ranking

Source: [packages/project-review-service/src/modules/ranking/ranking.service.ts:49](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/project-review-service/src/modules/ranking/ranking.service.ts:49).

configCrit?.weight || 0.2 replaces an explicitly configured zero with 0.2. Absolute scoring respects zero, but relative comparisons count the excluded criterion and can reverse the intended winner.

Fix direction: Use nullish fallback for absent weights and preserve explicit zero throughout scoring and comparisons.

Evidence: Static.

### EVAL-12 — [P2] Deleted or failed evaluations can leave stale teams/results in the leaderboard

Source: [packages/project-review-service/src/modules/review/review.controller.ts:238](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/project-review-service/src/modules/review/review.controller.ts:238); [packages/project-review-service/src/modules/ranking/ranking.service.ts:17](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/project-review-service/src/modules/ranking/ranking.service.ts:17); [packages/project-review-service/src/modules/review/review.controller.ts:519](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/project-review-service/src/modules/review/review.controller.ts:519).

Deleting a submission removes its associated evaluation but never updates/deletes the persisted EventRanking. Leaderboard GET serves the stale document. Ranking also includes every stored evaluation without checking current submission state, so an old successful result can remain counted after a failed rerun or while a new run is active.

Fix direction: Invalidate/recompute ranking on relevant mutations and select only eligible, current evaluation generations.

Evidence: Static.

### EVAL-13 — [P2] CSV report fields permit spreadsheet-formula injection

Source: [packages/project-review-service/src/modules/reports/report.service.ts:4](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/project-review-service/src/modules/reports/report.service.ts:4); [packages/project-review-service/src/modules/reports/report.service.ts:30](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/project-review-service/src/modules/reports/report.service.ts:30).

CSV escaping only doubles quotes. User-controlled team names and other text beginning with formula prefixes remain executable spreadsheet cells. The probe exported teamName =1+1 as "=1+1"; quoting does not force a spreadsheet to treat the value as plain text.

Fix direction: Neutralize formula-leading text using a documented spreadsheet-safe export policy, while preserving numeric fields.

Evidence: Reproduced.

### EVAL-14 — [P2] Runner payload validation accepts inconsistent or incomplete metrics

Source: [packages/project-review-service/src/modules/runners/backend.runner.ts:12](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/project-review-service/src/modules/runners/backend.runner.ts:12); [packages/project-review-service/src/modules/runners/code-analysis.runner.ts:44](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/project-review-service/src/modules/runners/code-analysis.runner.ts:44); [packages/project-review-service/src/modules/scoring/scoring.engine.ts:360](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/project-review-service/src/modules/scoring/scoring.engine.ts:360).

API metrics permit passed > totalTests and inconsistent counters; scoring can then exceed 100 and fail its own result validation. Static-analysis responses are accepted merely because three execution objects exist, even if required counts/statuses are malformed, yielding NaN scores or misleading availability.

Fix direction: Validate complete schemas and cross-field invariants at runner boundaries, retaining original failure status and evidence.

Evidence: Static.

### EVAL-15 — [P2] Editing an evaluated submission does not invalidate its old report

Source: [packages/project-review-service/src/modules/review/review.controller.ts:273](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/project-review-service/src/modules/review/review.controller.ts:273); [packages/project-review-service/src/modules/review/review.controller.ts:395](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/project-review-service/src/modules/review/review.controller.ts:395).

Repository URL, commit, branch, and live/API targets can change while status/evidence/evaluation stay unchanged. Reports then combine current submission metadata with old evidence; CSV/Markdown label the result using the new commitHash even though it was not evaluated.

Fix direction: Version immutable evaluation inputs and mark reports stale when evaluation-affecting inputs change; block edits to an active generation.

Evidence: Static.

### EVAL-16 — [P2] Completed events still accept new submissions

Source: [packages/project-review-service/src/models/Event.model.ts:77](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/project-review-service/src/models/Event.model.ts:77); [packages/project-review-service/src/modules/review/review.controller.ts:162](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/project-review-service/src/modules/review/review.controller.ts:162).

submitProject checks existence and required URLs, not event.status. Requests can add submissions to DRAFT, EVALUATION, or COMPLETED events, changing the cohort after judging/closure.

Fix direction: Enforce the permitted event lifecycle for submission, editing, evaluation, and finalization.

Evidence: Static.

### EVAL-17 — [P2] Judge score changes and their audit records can diverge

Source: [packages/project-review-service/src/modules/review/review.controller.ts:578](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/project-review-service/src/modules/review/review.controller.ts:578).

The evaluation is saved before JudgeOverrideAudit.create and ranking. If audit creation fails, the request returns an error even though the score already changed with no audit row. Concurrent overrides can also record stale originalScore values.

Fix direction: Commit the score and audit atomically with concurrency control; treat ranking refresh as separately recoverable work.

Evidence: Static failure/concurrency analysis.

### EVAL-18 — [P2] Configured score ranges and strict-scoring settings are not enforced

Source: [packages/project-review-service/src/models/Event.model.ts:48](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/project-review-service/src/models/Event.model.ts:48); [packages/project-review-service/src/models/Event.model.ts:84](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/project-review-service/src/models/Event.model.ts:84); [packages/project-review-service/src/modules/scoring/scoring.engine.ts:251](C:/Users/victus/Documents/Codex/2026-09-09/git-github-com-bhavya-dhanwani-knowhere/packages/project-review-service/src/modules/scoring/scoring.engine.ts:251).

The model exposes per-criterion minScore/maxScore and strictScoring, but the scorer uses fixed 0–100 category formulas and never enforces those configured ranges or the strict-scoring flag. A criterion capped at 20 can still receive rawScore 100, contradicting the event configuration.

Fix direction: Either implement range normalization/strict semantics consistently or remove unsupported settings from the contract.

Evidence: Static.

## Isolated reproduction results

1. **Reset-token query injection** — `{"validatorAcceptedObject":true,"mongoFilter":{"value":{"$ne":null}}}`

2. **Expired OTP accepted for password reset** — `{"status":200,"passwordWasChanged":true}`

3. **Ordinary auth payload promoted to judge** — `{"issuedRole":null,"acceptedRole":"judge"}`

4. **Non-executable submission awarded full marks** — `{"status":"completed","result":"AC","scoreAwarded":100,"passedTestCases":1,"totalTestCases":1,"details":[{"testCaseIndex":1,"status":"AC","timeMs":45,"memoryMb":12}]}`

5. **Unjudged unrelated coding item awards course marks** — `{"courseId":"507f1f77bcf86cd799439001","userId":"audit-trainee","contentItemId":"507f1f77bcf86cd799439002","type":"coding","scoreEarned":100,"maxScore":100}`

6. **Assignment endpoint bypasses last-admin demotion safeguard** — `{"courseId":"audit-course","userId":"sole-admin","role":"trainee","assignedBy":"sole-admin","status":"active"}`

7. **One scanner + failed build still yields complete 100** — `{"score":100,"status":"COMPLETE","coverage":1,"confidence":0.333}`

8. **File existence alone fulfills behavioral requirement** — `{"requirementId":"auth","title":"Working authentication","status":"FULFILLED","evidenceSummary":"Exact configured target observed: src/auth.ts"}`

9. **Failed workflow resolves instead of rejecting (queue sees success)** — `{"returnedStatus":"FAILED","rejected":false}`

10. **Zero-score override still ranks first over score 50** — `[{"team":"A","score":0,"rank":1},{"team":"B","score":50,"rank":2}]`

11. **CSV exports executable formula cell** — `{"formulaCell":"\"=1+1\""}`

12. **Unauthenticated initial-admin route creates admin membership** — `{"status":201,"role":"admin"}`

13. **Coding gateway prefix does not match app routes** — `{"gatewayPathStatus":404,"actualPathStatus":401}`

## Further validation recommended after fixes

Run real multi-service login/enrollment/content/assessment flows with ordinary auth-issued tokens; race completion/attempt/override requests; restart workers between every activity; evaluate large and adversarial repositories under strict resource quotas; test actual runner outputs and malformed payloads; exercise AWS upload-to-playback; and browser-test anonymous submission, invalid login, logout, OAuth, password reset, and queued evaluation completion.

No guarantee of exhaustiveness is implied. This report deliberately avoids speculative exploit claims, source-code disclosure where only result metadata is returned, and claiming an MCQ attempt-limit bypass that is prevented by its unique index.
