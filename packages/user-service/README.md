# User Service

Production-ready microservice for user identity, profiles, and multi-tenant Administrative Role-Based Access Control (ARBAC) for LMS courses.

## Architecture

- **Multi-Tenant Scope**: The LMS tenant scope is bounded by `courseId`.
- **Roles**:
  - `admin`: Full administrative control over the course's users and role assignments.
  - `trainer`: Course instructor (can view members and manage teaching).
  - `trainee`: Course learner (can view course and own enrollments).

## ARBAC Governance

- An `admin` of Course A can only assign, update, or revoke roles within Course A.
- ARBAC assignment policy:
  - `admin` can assign: `admin`, `trainer`, `trainee`.
  - `trainer` / `trainee`: cannot assign any roles.
- Protection: The sole remaining admin of a course cannot be removed or demoted.

## Endpoints

- `GET /api/health` - Service health status
- `GET /api/profile/me` - Authenticated user profile and all enrolled courses with roles
- `PUT /api/profile/me` - Update current user profile
- `GET /api/profile/:userId` - Get user profile
- `GET /api/courses/:courseId/my-role` - Get caller's role in course
- `GET /api/courses/:courseId/members` - List course members (`admin`, `trainer`)
- `POST /api/courses/:courseId/members` - Assign user to course (`admin` only)
- `PUT /api/courses/:courseId/members/:userId/role` - Update member's role (`admin` only)
- `DELETE /api/courses/:courseId/members/:userId` - Revoke member from course (`admin` only)
- `POST /api/rbac/verify` - Inter-service role verification endpoint
- `POST /api/rbac/initial-admin` - Register initial course admin upon course creation
