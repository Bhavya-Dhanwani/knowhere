import axios from 'axios';
import { axiosClient } from '../../../shared/lib/axiosClient';
import { apiErrorMessage } from '../../../shared/lib/roles';
import { Course } from '../../../shared/api/lms';

// course-service content API. Authoring is bottom-up:
// resources & questions -> submodule -> module -> course (/api/course/*).

export type ItemType = 'video' | 'resource' | 'mcq' | 'code-question';
export type ResourceType = 'video' | 'pdf' | 'docx' | 'xlsx' | 'image' | 'resource';

export interface OutlineItem {
  id: string;
  type: ItemType;
  refId: string;
  title: string;
  maxScore: number;
  meta: {
    resourceType?: ResourceType;
    mimeType?: string;
    status?: string;
    drmStatus?: string;
    difficulty?: string;
  };
  completed: boolean;
  scoreEarned: number;
}

export interface OutlineLesson {
  id: string;
  title: string;
  description: string;
  items: OutlineItem[];
}

export interface OutlineModule {
  id: string;
  title: string;
  description: string;
  durationDays: number;
  progressRequirement: number;
  releaseAt: string;
  schedule: {
    startsAt: string;
    deadline: string;
    released: boolean;
    locked: boolean;
    completedPercent: number;
  };
  lessons: OutlineLesson[];
}

export interface CourseStructure {
  course: Course;
  canManage: boolean;
  // false = syllabus preview of a published course the user isn't enrolled in
  enrolled: boolean;
  joinedAt: string | null;
  modules: OutlineModule[];
  stats: {
    moduleCount: number;
    lessonCount: number;
    itemCount: number;
    completedCount: number;
    totalScoreEarned: number;
    maxScore: number;
  };
}

export type LibraryType = 'resource' | 'mcq' | 'code-question' | 'submodule' | 'module';

export interface McqView {
  question: string;
  questionResourceIds: string[];
  options: { id: string; text: string; resourceIds: string[] }[];
}

export interface CodeQuestionView {
  questionId: string;
  title: string;
  description: string;
  constraints: string[];
  inputFormat: string;
  outputFormat: string;
  examples: { input: string; output: string; explanation?: string }[];
  difficulty: 'easy' | 'medium' | 'hard';
  supportedLanguages: string[];
  hiddenTestCaseCount: number;
}

export interface CompleteResult {
  scoreAwarded: number;
  itemMaxScore: number;
  judge?: { passed: number; total: number; error?: string };
}

export interface ResourceView {
  resourceId: string;
  fileName: string;
  mimeType: string;
  resourceType: ResourceType;
  downloadUrl: string;
}

export interface Library {
  resources: {
    _id: string;
    fileName: string;
    resourceType: ResourceType;
    mimeType: string;
    status: string;
    drmStatus?: string;
    createdAt: string;
  }[];
  mcqs: { _id: string; question: string; difficulty: string }[];
  codeQuestions: {
    _id: string;
    title: string;
    difficulty: string;
    testCaseGenerationStatus: string;
  }[];
  submodules: { _id: string; title: string; description: string; itemCount: number }[];
  modules: {
    _id: string;
    title: string;
    description: string;
    durationDays: number;
    progressRequirement: number;
    submoduleCount: number;
  }[];
}

type Raw = Record<string, unknown>;
const data = <T>(res: { data?: { data?: T } }): T => res.data?.data as T;

async function call<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    throw new Error(apiErrorMessage(err));
  }
}

const toStructure = (d: Raw): CourseStructure => {
  const c = d.course as Raw;
  return {
    canManage: Boolean(d.canManage),
    enrolled: d.enrolled !== false,
    joinedAt: (d.joinedAt as string) || null,
    course: {
      id: String(c._id),
      title: String(c.title || ''),
      description: String(c.description || ''),
      instructorId: String(c.instructorId || ''),
      status: (c.status as Course['status']) || 'draft',
      tags: (c.tags as string[]) || [],
      moduleCount: Number(c.moduleCount || 0),
      createdAt: String(c.createdAt || '')
    },
    modules: ((d.modules as Raw[]) || []).map((m) => ({
      id: String(m._id),
      title: String(m.title),
      description: String(m.description || ''),
      durationDays: Number(m.durationDays || 7),
      progressRequirement: Number(m.progressRequirement ?? 70),
      releaseAt: String(m.releaseAt),
      schedule: m.schedule as OutlineModule['schedule'],
      lessons: ((m.submodules as Raw[]) || []).map((s) => ({
        id: String(s._id),
        title: String(s.title),
        description: String(s.description || ''),
        items: ((s.items as Raw[]) || []).map((i) => ({
          id: String(i._id),
          type: i.type as ItemType,
          refId: String(i.refId),
          title: String(i.title || 'Untitled'),
          maxScore: Number(i.maxScore || 0),
          meta: (i.meta as OutlineItem['meta']) || {},
          completed: Boolean(i.completed),
          scoreEarned: Number(i.scoreEarned || 0)
        }))
      }))
    })),
    stats: d.stats as CourseStructure['stats']
  };
};

export const contentApi = {
  // ---------------------------------------------------------------- learner
  structure: (courseId: string) =>
    call(async () =>
      toStructure(data<Raw>(await axiosClient.get(`/courses/${courseId}/structure`)))
    ),

  // GET /course/mcq/:id replies with the bare object (question + options only)
  // content reads carry the courseId so the backend can check enrollment + module release
  mcq: (mcqId: string, courseId: string) =>
    call(
      async () =>
        (await axiosClient.get(`/course/mcq/${mcqId}`, { params: { courseId } })).data as McqView
    ),

  codeQuestion: (id: string, courseId: string) =>
    call(async () =>
      data<CodeQuestionView>(
        await axiosClient.get(`/course/code-question/${id}`, { params: { courseId } })
      )
    ),

  resource: (id: string, courseId: string) =>
    call(async () =>
      data<ResourceView>(await axiosClient.get(`/course/resource/${id}`, { params: { courseId } }))
    ),

  // short-lived signed URL to a not-yet-packaged upload; <video> streams it with range requests
  videoSource: (resourceId: string, courseId: string) =>
    call(
      async () =>
        data<{ url: string; mimeType: string }>(
          await axiosClient.get(`/course/video/${resourceId}/source`, { params: { courseId } })
        ).url
    ),

  checkMcq: (mcqId: string, selectedOptionId: string, courseId: string) =>
    call(async () =>
      data<{ isCorrect: boolean; attemptNumber: number; explanation?: string }>(
        await axiosClient.post('/course/chk-mcq', { mcqId, selectedOptionId, courseId })
      )
    ),

  // coding items send the solution; the server judges it against the hidden tests
  // runs code against the public examples on the server (Python / C++ / Java)
  runCode: (questionId: string, courseId: string, language: string, code: string) =>
    call(async () =>
      data<{
        passed: number;
        total: number;
        error?: string;
        cases: {
          input: string;
          expected: string;
          output: string;
          passed: boolean;
          error?: string;
        }[];
      }>(
        await axiosClient.post(`/course/code-question/${questionId}/run`, {
          courseId,
          language,
          code
        })
      )
    ),

  complete: (courseId: string, itemId: string, code?: string, language?: string) =>
    call(async () =>
      data<CompleteResult>(
        await axiosClient.post(
          `/courses/${courseId}/content-items/${itemId}/complete`,
          code !== undefined ? { code, language } : {}
        )
      )
    ),

  // ----------------------------------------------------------------- author
  library: () => call(async () => data<Library>(await axiosClient.get('/course/library'))),

  // presigned upload: register the file, PUT it straight to S3, return the resource id
  uploadResource: (file: File, resourceType: ResourceType, onProgress?: (pct: number) => void) =>
    call(async () => {
      const d = data<{ resourceId: string; uploadUrl: string }>(
        await axiosClient.post('/course/upload-resource', {
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          fileSize: file.size,
          resourceType
        })
      );
      await axios.put(d.uploadUrl, file, {
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        onUploadProgress: (e) => e.total && onProgress?.(Math.round((e.loaded / e.total) * 100))
      });
      return d.resourceId;
    }),

  createMcq: (input: {
    question: string;
    options: { text: string; resourceIds?: string[] }[];
    correctOptionIndex: number;
    explanation: string;
    difficulty: 'easy' | 'medium' | 'hard';
    points: number;
    questionResourceIds?: string[];
    explanationResourceIds?: string[];
  }) =>
    call(async () => data<{ mcqId: string }>(await axiosClient.post('/course/mcq', input)).mcqId),

  createCodeQuestion: (input: {
    title: string;
    description: string;
    constraints: string[];
    inputFormat: string;
    outputFormat: string;
    examples: { input: string; output: string; explanation?: string }[];
    testCases: { input: string; expectedOutput: string }[];
    difficulty: 'easy' | 'medium' | 'hard';
    supportedLanguages: string[];
    points: number;
    referenceSolution: { language: string; code: string } | null;
    generateTests: boolean;
  }) =>
    call(async () => {
      const { generateTests, ...rest } = input;
      return data<{
        questionId: string;
        testCaseGenerationStatus: string;
        generationError?: string;
        hiddenTestCaseCount: number;
      }>(
        await axiosClient.post('/course/code-question', {
          ...rest,
          testCaseGeneration: { enabled: generateTests }
        })
      );
    }),

  createSubmodule: (input: {
    title: string;
    description?: string;
    content: { type: ItemType; resourceId?: string; contentId?: string }[];
  }) =>
    call(
      async () =>
        data<{ submoduleId: string }>(await axiosClient.post('/course/submodule', input))
          .submoduleId
    ),

  createModule: (input: {
    title: string;
    description?: string;
    submoduleIds: string[];
    durationDays: number;
    progressRequirement: number;
  }) =>
    call(
      async () =>
        data<{ moduleId: string }>(await axiosClient.post('/course/module', input)).moduleId
    ),

  // edit / delete anything in the library (owner or admin; in-use items answer 409)
  getForEdit: <T>(type: LibraryType, id: string) =>
    call(async () => data<T>(await axiosClient.get(`/course/${type}/${id}/edit`))),

  update: (type: LibraryType, id: string, body: Record<string, unknown>) =>
    call(async () => {
      await axiosClient.put(`/course/${type}/${id}`, body);
    }),

  remove: (type: LibraryType, id: string) =>
    call(async () => {
      await axiosClient.delete(`/course/${type}/${id}`);
    }),

  removeModule: (courseId: string, moduleId: string) =>
    call(async () => {
      await axiosClient.post('/course/remove-module', { courseId, moduleId });
    }),

  reorderModules: (courseId: string, moduleIds: string[]) =>
    call(async () => {
      await axiosClient.put('/course/reorder-modules', { courseId, moduleIds });
    }),

  deleteCourse: (courseId: string) =>
    call(async () => {
      await axiosClient.delete(`/courses/${courseId}`);
    }),

  addModule: (courseId: string, moduleId: string, releaseAt?: string, order?: number) =>
    call(async () => {
      await axiosClient.post('/course/add-module', {
        courseId,
        moduleId,
        ...(order ? { order } : {}),
        ...(releaseAt ? { releasePolicy: { releaseAt } } : {})
      });
    })
};

// flat, ordered list of every item — drives prev/next navigation and "continue"
export function flattenItems(structure?: CourseStructure) {
  return (structure?.modules || []).flatMap((m) =>
    m.lessons.flatMap((l) => l.items.map((item) => ({ item, lesson: l, module: m })))
  );
}
