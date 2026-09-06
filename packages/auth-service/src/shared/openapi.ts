export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'Knowhere LMS Platform API',
    version: '1.0.0',
    description: `Comprehensive API reference for the Knowhere microservices learning management system platform.
    
### Architecture & Services
- **Auth Service** (\`/api/auth\`): User registration, JWT token lifecycle, session management, OAuth, password reset.
- **User & Membership Service** (\`/api/profile\`, \`/api/courses/:courseId/members\`, \`/api/competencies\`, \`/api/rbac\`): Profiles, course-level ARBAC memberships, skills, and internal role verification.
- **Course Service** (\`/api/courses\`, \`/api/modules\`, \`/api/submodules\`, \`/api/content-items\`): Course taxonomy, nested curriculum structure, and student gradebook/progress.
- **Media Service** (\`/api/resources\`): S3 presigned asset upload URLs, asset metadata, video/audio transcoding status.
- **MCQ Service** (\`/api/questions\`): Multiple choice questions with single/multiple select, randomized options, and strict 3-strike attempts.
- **Coding Service** (\`/api/coding\`): Code execution challenges, language runners, testcase evaluations, and background sandbox judging.`,
    contact: {
      name: 'Knowhere Engineering Team'
    }
  },
  servers: [
    {
      url: '/',
      description: 'Local Kubernetes Ingress (Default Gateway)'
    },
    {
      url: 'http://localhost',
      description: 'Localhost Ingress Gateway (Port 80)'
    }
  ],
  tags: [
    { name: 'Authentication', description: 'User login, registration, tokens, and OAuth' },
    { name: 'User Profiles', description: 'User profile and bio management' },
    {
      name: 'Course Memberships (ARBAC)',
      description: 'Course-level role-based access control and enrollment'
    },
    { name: 'Competencies', description: 'Skill badges and competencies assigned to users' },
    { name: 'Internal RBAC', description: 'Inter-service course permission verification' },
    { name: 'Courses', description: 'Top-level course creation, updates, and catalog' },
    { name: 'Modules', description: 'Modules within a course hierarchy' },
    { name: 'Submodules', description: 'Submodules and content item attachments' },
    { name: 'Content Items', description: 'Content item details (Media, MCQ, Coding integration)' },
    {
      name: 'Student Progress & Grades',
      description: 'Completion tracking, student progress, and gradebook'
    },
    {
      name: 'Media Resources',
      description: 'S3 presigned upload generation and video/audio asset management'
    },
    {
      name: 'MCQ Questions',
      description: 'Multiple-choice question creation, student display, and 3-strike submissions'
    },
    {
      name: 'Coding Challenges',
      description: 'Programming questions, student testcase display, code submission, and judging'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Provide your JWT access token as: `Bearer <token>`'
      }
    },
    schemas: {
      StandardResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Operation completed successfully' },
          data: { type: 'object' }
        }
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'Error description' },
          errors: {
            type: 'array',
            items: { type: 'object' }
          }
        }
      },
      User: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '68b9ff6f2d50630000000001' },
          email: { type: 'string', format: 'email', example: 'student1@knowhere.test' },
          name: { type: 'string', example: 'Alex Student' },
          role: { type: 'string', enum: ['student', 'trainer', 'admin'], example: 'student' },
          isActive: { type: 'boolean', example: true },
          isEmailVerified: { type: 'boolean', example: true }
        }
      },
      Profile: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '68ba00012d50630000000001' },
          userId: { type: 'string', example: '68b9ff6f2d50630000000001' },
          headline: { type: 'string', example: 'Aspiring Full Stack Engineer' },
          bio: { type: 'string', example: 'Passionate learner exploring cloud computing.' },
          avatar: {
            type: 'string',
            example: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde'
          },
          skills: {
            type: 'array',
            items: { type: 'string' },
            example: ['JavaScript', 'Docker', 'React']
          },
          socialLinks: {
            type: 'object',
            properties: {
              github: { type: 'string', example: 'https://github.com/alexstudent' },
              linkedin: { type: 'string', example: 'https://linkedin.com/in/alexstudent' }
            }
          }
        }
      },
      Course: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '68ba00102d50630000000001' },
          title: { type: 'string', example: 'Modern Web Development Bootcamp' },
          description: {
            type: 'string',
            example: 'Comprehensive guide to building scalable web apps.'
          },
          level: {
            type: 'string',
            enum: ['beginner', 'intermediate', 'advanced'],
            example: 'beginner'
          },
          isPublished: { type: 'boolean', example: true },
          creatorId: { type: 'string', example: '68b9ff6f2d50630000000002' },
          modules: { type: 'array', items: { type: 'string' } }
        }
      },
      Module: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '68ba00202d50630000000001' },
          courseId: { type: 'string', example: '68ba00102d50630000000001' },
          title: { type: 'string', example: 'Module 1: Foundations of JavaScript' },
          description: {
            type: 'string',
            example: 'Core concepts including closures, prototypes, and async/await.'
          },
          order: { type: 'integer', example: 1 },
          submodules: { type: 'array', items: { type: 'string' } }
        }
      },
      Submodule: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '68ba00302d50630000000001' },
          moduleId: { type: 'string', example: '68ba00202d50630000000001' },
          title: { type: 'string', example: 'Asynchronous JavaScript Deep Dive' },
          order: { type: 'integer', example: 1 },
          contentItems: { type: 'array', items: { type: 'string' } }
        }
      },
      ContentItem: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '68ba00402d50630000000001' },
          submoduleId: { type: 'string', example: '68ba00302d50630000000001' },
          type: { type: 'string', enum: ['media', 'mcq', 'coding'], example: 'media' },
          resourceRefId: { type: 'string', example: '68ba00502d50630000000001' },
          title: { type: 'string', example: 'Event Loop & Concurrency Video' },
          maxScore: { type: 'number', example: 10 },
          passingScore: { type: 'number', example: 7 },
          order: { type: 'integer', example: 1 }
        }
      }
    }
  },
  paths: {
    // ---------------- AUTHENTICATION ----------------
    '/api/auth/signup': {
      post: {
        tags: ['Authentication'],
        summary: 'Register a new user account',
        description: 'Creates a user in the auth service with email, password, name, and role.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password', 'name'],
                properties: {
                  email: { type: 'string', format: 'email', example: 'newuser@knowhere.test' },
                  password: { type: 'string', minLength: 8, example: 'P@ssword123!' },
                  name: { type: 'string', example: 'New User' },
                  role: {
                    type: 'string',
                    enum: ['student', 'trainer', 'admin'],
                    default: 'student',
                    example: 'student'
                  }
                }
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'User registered successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        user: { $ref: '#/components/schemas/User' },
                        accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1Ni...' }
                      }
                    }
                  }
                }
              }
            }
          },
          '400': { description: 'Validation failed or email already registered' }
        }
      }
    },
    '/api/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'Log in with email & password',
        description:
          'Returns JWT access token in JSON response and sets HTTP-only refresh token cookie.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email', example: 'student1@knowhere.test' },
                  password: { type: 'string', example: 'P@ssword123!' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Login successful',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        user: { $ref: '#/components/schemas/User' },
                        accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1Ni...' }
                      }
                    }
                  }
                }
              }
            }
          },
          '401': { description: 'Invalid credentials' }
        }
      }
    },
    '/api/auth/me': {
      get: {
        tags: ['Authentication'],
        summary: 'Get current authenticated user',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Current user profile from JWT',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        user: { $ref: '#/components/schemas/User' }
                      }
                    }
                  }
                }
              }
            }
          },
          '401': { description: 'Unauthorized or missing token' }
        }
      }
    },
    '/api/auth/refresh': {
      post: {
        tags: ['Authentication'],
        summary: 'Rotate and refresh access token',
        description:
          'Uses HTTP-only cookie or request body `refreshToken` to issue a new access token.',
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  refreshToken: { type: 'string', example: 'eyJhbGciOiJIUzI1Ni...' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Token refreshed successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1Ni...' }
                      }
                    }
                  }
                }
              }
            }
          },
          '401': { description: 'Invalid or expired refresh token' }
        }
      }
    },
    '/api/auth/logout': {
      post: {
        tags: ['Authentication'],
        summary: 'Log out current session',
        description: 'Revokes the active refresh token session.',
        responses: {
          '200': { description: 'Logged out successfully' }
        }
      }
    },
    '/api/auth/logoutall': {
      post: {
        tags: ['Authentication'],
        summary: 'Log out from all active sessions',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'All active sessions invalidated' }
        }
      }
    },
    '/api/auth/google-login': {
      post: {
        tags: ['Authentication'],
        summary: 'Log in with Google ID token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['credential'],
                properties: {
                  credential: { type: 'string', description: 'Google ID token credential' }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Login successful' }
        }
      }
    },
    '/api/auth/forgot-password': {
      post: {
        tags: ['Authentication'],
        summary: 'Request password reset email',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: {
                  email: { type: 'string', format: 'email', example: 'student1@knowhere.test' }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Reset instructions dispatched if email exists' }
        }
      }
    },
    '/api/auth/reset-password': {
      post: {
        tags: ['Authentication'],
        summary: 'Reset password using token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['token', 'password'],
                properties: {
                  token: { type: 'string', example: 'a9c8b7...' },
                  password: { type: 'string', minLength: 8, example: 'NewSecret123!' }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Password reset successfully' }
        }
      }
    },

    // ---------------- USER PROFILES ----------------
    '/api/profile/me': {
      get: {
        tags: ['User Profiles'],
        summary: 'Get current user profile',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Profile and course memberships for current user',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/Profile' }
                  }
                }
              }
            }
          }
        }
      },
      put: {
        tags: ['User Profiles'],
        summary: 'Update current user profile',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  headline: { type: 'string', example: 'Full Stack Engineer' },
                  bio: { type: 'string', example: 'Specializing in TypeScript & Kubernetes.' },
                  avatar: { type: 'string', example: 'https://example.com/avatar.jpg' },
                  skills: {
                    type: 'array',
                    items: { type: 'string' },
                    example: ['Node.js', 'MongoDB', 'Docker']
                  },
                  socialLinks: {
                    type: 'object',
                    properties: {
                      github: { type: 'string' },
                      linkedin: { type: 'string' },
                      twitter: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Profile updated' }
        }
      }
    },
    '/api/profile/{userId}': {
      get: {
        tags: ['User Profiles'],
        summary: 'Get profile by User ID',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'User profile retrieved' },
          '404': { description: 'Profile not found' }
        }
      },
      put: {
        tags: ['User Profiles'],
        summary: 'Update profile by User ID (Admin or Self)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  headline: { type: 'string' },
                  bio: { type: 'string' },
                  avatar: { type: 'string' },
                  skills: { type: 'array', items: { type: 'string' } }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Profile updated successfully' }
        }
      }
    },

    // ---------------- COURSE MEMBERSHIPS (ARBAC) ----------------
    '/api/courses/{courseId}/my-role': {
      get: {
        tags: ['Course Memberships (ARBAC)'],
        summary: 'Get current user role in course',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'courseId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': {
            description: 'Course role retrieved',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        role: { type: 'string', example: 'trainee' },
                        status: { type: 'string', example: 'active' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/courses/{courseId}/members': {
      get: {
        tags: ['Course Memberships (ARBAC)'],
        summary: 'List all enrolled members of a course',
        description: 'Requires Course Admin or Trainer role.',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'courseId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'List of members returned' }
        }
      },
      post: {
        tags: ['Course Memberships (ARBAC)'],
        summary: 'Enroll / assign user to course',
        description: 'Requires Course Admin role.',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'courseId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['userId', 'role'],
                properties: {
                  userId: { type: 'string', example: '68b9ff6f2d50630000000001' },
                  role: {
                    type: 'string',
                    enum: ['admin', 'trainer', 'trainee'],
                    example: 'trainee'
                  }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Member assigned successfully' }
        }
      }
    },
    '/api/courses/{courseId}/members/{userId}/role': {
      put: {
        tags: ['Course Memberships (ARBAC)'],
        summary: 'Update member role in course',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'courseId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'userId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['role'],
                properties: {
                  role: {
                    type: 'string',
                    enum: ['admin', 'trainer', 'trainee'],
                    example: 'trainer'
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Role updated successfully' }
        }
      }
    },
    '/api/courses/{courseId}/members/{userId}': {
      delete: {
        tags: ['Course Memberships (ARBAC)'],
        summary: 'Revoke / remove member from course',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'courseId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'userId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': { description: 'Member removed from course' }
        }
      }
    },

    // ---------------- COMPETENCIES ----------------
    '/api/competencies/{userId}': {
      get: {
        tags: ['Competencies'],
        summary: 'Get competencies for a user',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'List of user competencies and badges' }
        }
      }
    },
    '/api/competencies': {
      post: {
        tags: ['Competencies'],
        summary: 'Assign competency to user',
        description: 'Requires platform admin role.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['userId', 'name', 'level'],
                properties: {
                  userId: { type: 'string', example: '68b9ff6f2d50630000000001' },
                  name: { type: 'string', example: 'Backend Architecture' },
                  level: {
                    type: 'string',
                    enum: ['beginner', 'intermediate', 'expert'],
                    example: 'intermediate'
                  },
                  badgeUrl: { type: 'string', example: 'https://knowhere.test/badges/backend.png' }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Competency assigned' }
        }
      }
    },

    // ---------------- INTERNAL RBAC ----------------
    '/api/rbac/verify': {
      post: {
        tags: ['Internal RBAC'],
        summary: 'Verify course role authorization',
        description:
          'Internal RPC endpoint used across services to check if a user possesses required roles.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['userId', 'courseId', 'requiredRoles'],
                properties: {
                  userId: { type: 'string', example: '68b9ff6f2d50630000000001' },
                  courseId: { type: 'string', example: '68ba00102d50630000000001' },
                  requiredRoles: {
                    type: 'array',
                    items: { type: 'string' },
                    example: ['admin', 'trainer']
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Authorization result',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    authorized: { type: 'boolean', example: true },
                    role: { type: 'string', example: 'admin' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/rbac/initial-admin': {
      post: {
        tags: ['Internal RBAC'],
        summary: 'Register initial course creator as Admin',
        description:
          'Invoked by course-service upon new course creation to initialize ARBAC membership.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['courseId', 'userId'],
                properties: {
                  courseId: { type: 'string', example: '68ba00102d50630000000001' },
                  userId: { type: 'string', example: '68b9ff6f2d50630000000002' }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Initial admin registered' }
        }
      }
    },

    // ---------------- COURSES ----------------
    '/api/courses': {
      get: {
        tags: ['Courses'],
        summary: 'List courses with filters and pagination',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
          { name: 'search', in: 'query', schema: { type: 'string' } }
        ],
        responses: {
          '200': {
            description: 'Paginated courses list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Course' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      post: {
        tags: ['Courses'],
        summary: 'Create a new course',
        description:
          'Requires Trainer or Admin role. Automatically registers creator as Course Admin.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title', 'description'],
                properties: {
                  title: {
                    type: 'string',
                    example: 'Distributed Systems & Cloud Native Architecture'
                  },
                  description: {
                    type: 'string',
                    example: 'Master microservices, Kafka, Redis, and Kubernetes.'
                  },
                  level: {
                    type: 'string',
                    enum: ['beginner', 'intermediate', 'advanced'],
                    default: 'beginner'
                  },
                  tags: {
                    type: 'array',
                    items: { type: 'string' },
                    example: ['cloud', 'kubernetes']
                  }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Course created successfully' }
        }
      }
    },
    '/api/courses/{id}': {
      get: {
        tags: ['Courses'],
        summary: 'Get course hierarchy and details by ID',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Course hierarchy returned with modules and submodules' },
          '404': { description: 'Course not found' }
        }
      },
      put: {
        tags: ['Courses'],
        summary: 'Update course details',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  level: { type: 'string', enum: ['beginner', 'intermediate', 'advanced'] },
                  isPublished: { type: 'boolean' }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Course updated successfully' }
        }
      }
    },

    // ---------------- MODULES ----------------
    '/api/modules': {
      post: {
        tags: ['Modules'],
        summary: 'Create a module in a course',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['courseId', 'title'],
                properties: {
                  courseId: { type: 'string', example: '68ba00102d50630000000001' },
                  title: { type: 'string', example: 'Module 2: Containerization with Docker' },
                  description: {
                    type: 'string',
                    example: 'Building multi-stage images and networking.'
                  },
                  order: { type: 'integer', example: 2 }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Module created successfully' }
        }
      }
    },
    '/api/modules/{id}': {
      put: {
        tags: ['Modules'],
        summary: 'Update module details',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  order: { type: 'integer' }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Module updated successfully' }
        }
      }
    },

    // ---------------- SUBMODULES ----------------
    '/api/submodules': {
      post: {
        tags: ['Submodules'],
        summary: 'Create a submodule in a module',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['moduleId', 'title'],
                properties: {
                  moduleId: { type: 'string', example: '68ba00202d50630000000001' },
                  title: { type: 'string', example: 'Docker Compose and Orchestration Basics' },
                  order: { type: 'integer', example: 1 }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Submodule created successfully' }
        }
      }
    },
    '/api/submodules/{id}': {
      put: {
        tags: ['Submodules'],
        summary: 'Update submodule details',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  order: { type: 'integer' }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Submodule updated successfully' }
        }
      }
    },
    '/api/submodules/{id}/content-items': {
      get: {
        tags: ['Submodules'],
        summary: 'List content items for navigation sidebar',
        description: 'Lightweight call optimized for course tree rendering.',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'List of content items in submodule' }
        }
      },
      post: {
        tags: ['Submodules'],
        summary: 'Attach content item (Media, MCQ, Coding) to submodule',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['type', 'resourceRefId', 'title'],
                properties: {
                  type: { type: 'string', enum: ['media', 'mcq', 'coding'], example: 'coding' },
                  resourceRefId: { type: 'string', example: '68ba00602d50630000000001' },
                  title: { type: 'string', example: 'Hands-on: Write a Binary Search in Go' },
                  maxScore: { type: 'number', example: 100 },
                  passingScore: { type: 'number', example: 70 },
                  order: { type: 'integer', example: 1 }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Content item attached' }
        }
      }
    },

    // ---------------- CONTENT ITEMS ----------------
    '/api/content-items/{id}': {
      get: {
        tags: ['Content Items'],
        summary: 'Get content item detail and cross-service payload',
        description:
          'Triggers cross-service fetch to media-service, mcq-service, or coding-service depending on type.',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Content item detail with resolved resource data' },
          '404': { description: 'Content item not found' }
        }
      },
      put: {
        tags: ['Content Items'],
        summary: 'Update content item metadata and grading parameters',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  maxScore: { type: 'number' },
                  passingScore: { type: 'number' },
                  order: { type: 'integer' }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Content item updated' }
        }
      }
    },

    // ---------------- PROGRESS & GRADES ----------------
    '/api/courses/{courseId}/content-items/{itemId}/complete': {
      post: {
        tags: ['Student Progress & Grades'],
        summary: 'Mark content item as completed and award score',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'courseId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'itemId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  score: { type: 'number', example: 100 }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Progress updated and score recorded' }
        }
      }
    },
    '/api/courses/{courseId}/my-progress': {
      get: {
        tags: ['Student Progress & Grades'],
        summary: 'Get current student progress and aggregate score',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'courseId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': {
            description: 'Student course completion percentage, completed items, and total score',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        courseId: { type: 'string', example: '68ba00102d50630000000001' },
                        completedItemsCount: { type: 'integer', example: 12 },
                        totalItemsCount: { type: 'integer', example: 15 },
                        completionPercentage: { type: 'number', example: 80 },
                        totalScoreEarned: { type: 'number', example: 145 }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/courses/{courseId}/grades': {
      get: {
        tags: ['Student Progress & Grades'],
        summary: 'Get all students grades and progress overview',
        description: 'Requires Trainer or Admin role.',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'courseId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Course gradebook for all trainees' }
        }
      }
    },

    // ---------------- MEDIA RESOURCES ----------------
    '/api/resources/upload-url': {
      post: {
        tags: ['Media Resources'],
        summary: 'Generate presigned S3 upload URL',
        description: 'Allows trainers and admins to upload media files directly to S3.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['fileName', 'fileType', 'mediaType'],
                properties: {
                  fileName: { type: 'string', example: 'docker-tutorial.mp4' },
                  fileType: { type: 'string', example: 'video/mp4' },
                  mediaType: {
                    type: 'string',
                    enum: ['video', 'audio', 'document', 'image'],
                    example: 'video'
                  },
                  fileSizeBytes: { type: 'integer', example: 104857600 }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Presigned upload URL and media resource ID generated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        resourceId: { type: 'string', example: '68ba00502d50630000000001' },
                        uploadUrl: { type: 'string', example: 'https://s3.amazonaws.com/...' },
                        key: { type: 'string', example: 'uploads/videos/68ba0050...' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/resources/{id}': {
      get: {
        tags: ['Media Resources'],
        summary: 'Get resource details and playback/download URL',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Resource details and presigned download URL' },
          '404': { description: 'Resource not found' }
        }
      }
    },
    '/api/resources/{id}/status': {
      put: {
        tags: ['Media Resources'],
        summary: 'Update media processing status',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['status'],
                properties: {
                  status: {
                    type: 'string',
                    enum: ['pending', 'uploaded', 'processing', 'ready', 'failed'],
                    example: 'ready'
                  },
                  durationSeconds: { type: 'number', example: 340 }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Status updated' }
        }
      }
    },

    // ---------------- MCQ QUESTIONS ----------------
    '/api/questions': {
      post: {
        tags: ['MCQ Questions'],
        summary: 'Create a new MCQ question',
        description: 'Requires Trainer or Admin role.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['prompt', 'options', 'correctOptionIndex'],
                properties: {
                  prompt: {
                    type: 'string',
                    example: 'Which protocol is used for stateless communication in REST?'
                  },
                  options: {
                    type: 'array',
                    items: { type: 'string' },
                    example: ['HTTP/HTTPS', 'SSH', 'FTP', 'Telnet']
                  },
                  correctOptionIndex: { type: 'integer', example: 0 },
                  explanation: {
                    type: 'string',
                    example: 'REST APIs communicate over HTTP/HTTPS.'
                  },
                  difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'], default: 'easy' },
                  tags: {
                    type: 'array',
                    items: { type: 'string' },
                    example: ['networking', 'rest']
                  }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'MCQ question created' }
        }
      }
    },
    '/api/questions/{id}/display': {
      get: {
        tags: ['MCQ Questions'],
        summary: 'Get question for trainee display',
        description:
          'Sanitized endpoint that projects out the correct answer so students cannot inspect it.',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Sanitized question object with options list' },
          '404': { description: 'Question not found' }
        }
      }
    },
    '/api/questions/{id}/submit': {
      post: {
        tags: ['MCQ Questions'],
        summary: 'Submit an attempt for an MCQ question',
        description:
          'Enforces strict 3-strike policy: after 3 incorrect attempts, further submissions are locked.',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['selectedOptionIndex'],
                properties: {
                  selectedOptionIndex: { type: 'integer', example: 0 }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Attempt evaluated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    isCorrect: { type: 'boolean', example: true },
                    attemptsRemaining: { type: 'integer', example: 2 },
                    explanation: {
                      type: 'string',
                      example: 'REST APIs communicate over HTTP/HTTPS.'
                    }
                  }
                }
              }
            }
          },
          '403': { description: 'Maximum attempts (3 strikes) reached' }
        }
      }
    },

    // ---------------- CODING CHALLENGES ----------------
    '/api/coding/questions': {
      post: {
        tags: ['Coding Challenges'],
        summary: 'Create a coding challenge problem',
        description: 'Requires Trainer or Admin role.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title', 'description', 'language', 'starterCode', 'testCases'],
                properties: {
                  title: { type: 'string', example: 'Two Sum Problem' },
                  description: {
                    type: 'string',
                    example:
                      'Given an array of integers, return indices of two numbers that add up to target.'
                  },
                  language: { type: 'string', example: 'javascript' },
                  starterCode: {
                    type: 'string',
                    example: 'function twoSum(nums, target) {\n  // your code\n}'
                  },
                  timeLimitMs: { type: 'integer', default: 2000, example: 2000 },
                  memoryLimitMb: { type: 'integer', default: 128, example: 128 },
                  testCases: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        input: { type: 'string', example: '[2,7,11,15], 9' },
                        expectedOutput: { type: 'string', example: '[0,1]' },
                        isHidden: { type: 'boolean', example: false }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Coding challenge created' }
        }
      }
    },
    '/api/coding/questions/{id}/display': {
      get: {
        tags: ['Coding Challenges'],
        summary: 'Get problem display for trainee',
        description: 'Returns description, starter code, and sample (non-hidden) test cases.',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Sanitized problem object with sample testcases' },
          '404': { description: 'Question not found' }
        }
      }
    },
    '/api/coding/questions/{id}/submit': {
      post: {
        tags: ['Coding Challenges'],
        summary: 'Submit code solution for execution',
        description:
          'Submits source code to judge sandbox queue. Returns a submission ID to poll for results.',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['sourceCode', 'language'],
                properties: {
                  sourceCode: {
                    type: 'string',
                    example: 'function twoSum(nums, target) { return [0, 1]; }'
                  },
                  language: { type: 'string', example: 'javascript' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Submission queued',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        submissionId: { type: 'string', example: '68ba00702d50630000000001' },
                        status: { type: 'string', example: 'queued' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/coding/submissions/{id}': {
      get: {
        tags: ['Coding Challenges'],
        summary: 'Poll submission evaluation status',
        description:
          'Returns execution status (queued, running, passed, failed) and test case pass rates.',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': {
            description: 'Submission status and testcase results',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        status: {
                          type: 'string',
                          enum: [
                            'queued',
                            'running',
                            'passed',
                            'failed',
                            'compilation_error',
                            'time_limit_exceeded'
                          ],
                          example: 'passed'
                        },
                        passedCount: { type: 'integer', example: 5 },
                        totalCount: { type: 'integer', example: 5 },
                        runtimeMs: { type: 'integer', example: 42 },
                        memoryMb: { type: 'number', example: 14.5 }
                      }
                    }
                  }
                }
              }
            }
          },
          '404': { description: 'Submission not found' }
        }
      }
    }
  }
};
