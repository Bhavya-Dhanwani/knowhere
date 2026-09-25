import { AuthenticatedRequest } from '../../shared/middlewares/auth.middleware.js';

export interface UploadResourceBody {
  fileName: string;
  mimeType: string;
  fileSize: number;
  resourceType: 'video' | 'pdf' | 'docx' | 'xlsx' | 'image' | 'resource';
  courseId: string;
  submoduleId?: string | null;
}

export interface UploadResourceRequest extends AuthenticatedRequest {
  body: UploadResourceBody;
}

export interface McqOptionInput {
  text: string;
  resourceIds?: string[];
}

export interface CreateMcqBody {
  question: string;
  options: McqOptionInput[];
  correctOptionIndex: number;
  explanation: string;
  questionResourceIds?: string[];
  explanationResourceIds?: string[];
  tags?: string[];
  difficulty?: 'easy' | 'medium' | 'hard';
  courseId?: string;
}

export interface CreateMcqRequest extends AuthenticatedRequest {
  body: CreateMcqBody;
}

export interface CreateCodeQuestionBody {
  title: string;
  description: string;
  constraints: string[];
  inputFormat: string;
  outputFormat: string;
  examples: {
    input: string;
    output: string;
    explanation?: string;
  }[];
  difficulty: 'easy' | 'medium' | 'hard';
  supportedLanguages: string[];
  courseId?: string;
  testCaseGeneration?: {
    enabled: boolean;
    requestedCount?: number;
  };
}

export interface CreateCodeQuestionRequest extends AuthenticatedRequest {
  body: CreateCodeQuestionBody;
}

export interface SubmoduleContentItemInput {
  type: 'video' | 'resource' | 'mcq' | 'code-question';
  resourceId?: string;
  contentId?: string;
  order: number;
}

export interface CreateSubmoduleBody {
  title: string;
  description?: string;
  courseId: string;
  moduleId?: string | null;
  content?: SubmoduleContentItemInput[];
}

export interface CreateSubmoduleRequest extends AuthenticatedRequest {
  body: CreateSubmoduleBody;
}

export interface CreateModuleBody {
  title: string;
  description?: string;
  courseId?: string;
  submoduleIds?: string[];
  durationDays: number;
  releasePolicy?: {
    type: 'immediate' | 'scheduled' | 'fixed_schedule' | 'progression_based';
    unlockAt?: string;
    releaseAt?: string;
    allowLateJoinerCatchUp?: boolean;
  };
  progressRequirement?: number;
}

export interface CreateModuleRequest extends AuthenticatedRequest {
  body: CreateModuleBody;
}

export interface CreateCourseBody {
  title: string;
  description?: string;
  modules?: string[];
  status?: 'draft' | 'published' | 'archived';
  settings?: {
    allowLateEnrollment?: boolean;
    defaultModuleDurationDays?: number;
    progressionThreshold?: number;
  };
}

export interface CreateCourseRequest extends AuthenticatedRequest {
  body: CreateCourseBody;
}

export interface AddModuleBody {
  courseId: string;
  moduleId: string;
  order: number;
  releasePolicy?: {
    type: 'immediate' | 'scheduled' | 'fixed_schedule' | 'progression_based';
    releaseAt?: string;
    unlockAt?: string;
    allowLateJoinerCatchUp?: boolean;
  };
}

export interface AddModuleRequest extends AuthenticatedRequest {
  body: AddModuleBody;
}

export interface CheckMcqBody {
  mcqId: string;
  selectedOptionId: string;
}

export interface CheckMcqRequest extends AuthenticatedRequest {
  body: CheckMcqBody;
}
