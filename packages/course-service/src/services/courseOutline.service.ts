// Resolves a course into its full outline: course.modules (ordered, with release dates)
// -> module.submoduleIds -> submodule.content -> the referenced resource / MCQ / coding question.
import { ICourseDocument } from '../shared/models/course.model.js';
import { SubmoduleContentType } from '../shared/models/submodule.model.js';
import ModuleDao from '../shared/dao/module.dao.js';
import SubmoduleDao from '../shared/dao/submodule.dao.js';
import ResourceDao from '../shared/dao/resource.dao.js';
import McqDao from '../shared/dao/mcq.dao.js';
import CodeQuestionDao from '../shared/dao/codeQuestion.dao.js';

// default marks when a question has no points of its own (videos and files are unscored)
export const ITEM_MAX_SCORE: Record<SubmoduleContentType, number> = {
  mcq: 10,
  'code-question': 10,
  video: 0,
  resource: 0
};

export interface OutlineItem {
  _id: string;
  type: SubmoduleContentType;
  refId: string;
  title: string;
  maxScore: number;
  meta: Record<string, unknown>;
  attachmentIds: string[];
}

export interface OutlineModule {
  _id: string;
  title: string;
  description: string;
  durationDays: number;
  progressRequirement: number;
  order: number;
  releaseAt: Date;
  submodules: { _id: string; title: string; description: string; items: OutlineItem[] }[];
}

const moduleDao = new ModuleDao();
const submoduleDao = new SubmoduleDao();
const resourceDao = new ResourceDao();
const mcqDao = new McqDao();
const codeDao = new CodeQuestionDao();

export async function loadCourseOutline(course: ICourseDocument): Promise<OutlineModule[]> {
  const entries = [...(course.modules || [])].sort((a, b) => a.order - b.order);
  const modules = await moduleDao.findModulesByIds(entries.map((e) => e.moduleId.toString()));
  const moduleById = new Map(modules.map((m) => [m._id.toString(), m]));

  const submoduleIds = modules.flatMap((m) => m.submoduleIds.map(String));
  const submodules = await submoduleDao.findSubmodulesByIds(submoduleIds);
  const subById = new Map(submodules.map((s) => [s._id.toString(), s]));

  const refs = (types: SubmoduleContentType[]) =>
    submodules.flatMap((s) =>
      s.content
        .filter((c) => types.includes(c.type))
        .map((c) => String(c.resourceId || c.contentId))
    );
  const [resources, mcqs, codes] = await Promise.all([
    resourceDao.findResourcesByIds(refs(['video', 'resource'])),
    mcqDao.findMcqsByIds(refs(['mcq'])),
    codeDao.findQuestionsByIds(refs(['code-question']))
  ]);
  const resById = new Map(resources.map((r) => [r._id.toString(), r]));
  const mcqById = new Map(mcqs.map((q) => [q._id.toString(), q]));
  const codeById = new Map(codes.map((q) => [q._id.toString(), q]));

  return entries.flatMap((entry) => {
    const m = moduleById.get(entry.moduleId.toString());
    if (!m) return [];
    return [
      {
        _id: m._id.toString(),
        title: m.title,
        description: m.description,
        durationDays: m.durationDays,
        progressRequirement: m.progressRequirement ?? 70,
        order: entry.order,
        releaseAt: new Date(
          entry.releasePolicy?.releaseAt || entry.releasePolicy?.unlockAt || course.createdAt
        ),
        submodules: m.submoduleIds.flatMap((sid) => {
          const s = subById.get(String(sid));
          if (!s) return [];
          const items = [...s.content]
            .sort((a, b) => a.order - b.order)
            .map((c): OutlineItem => {
              const refId = String(c.resourceId || c.contentId);
              const res = resById.get(refId);
              const mcq = mcqById.get(refId);
              const code = codeById.get(refId);
              return {
                _id: String(c._id),
                type: c.type,
                refId,
                title:
                  res?.fileName || mcq?.question.slice(0, 140) || code?.title || 'Missing item',
                maxScore: mcq?.points ?? code?.points ?? ITEM_MAX_SCORE[c.type],
                meta: res
                  ? {
                      resourceType: res.resourceType,
                      mimeType: res.mimeType,
                      status: res.status,
                      drmStatus: res.drmStatus
                    }
                  : code
                    ? { difficulty: code.difficulty }
                    : {},
                // files attached to an MCQ are readable by anyone who can open the MCQ
                attachmentIds: mcq
                  ? [
                      ...(mcq.questionResourceIds || []),
                      ...(mcq.explanationResourceIds || []),
                      ...mcq.options.flatMap((o) => o.resourceIds || [])
                    ].map(String)
                  : []
              };
            });
          return [{ _id: s._id.toString(), title: s.title, description: s.description, items }];
        })
      }
    ];
  });
}

export const outlineItems = (outline: OutlineModule[]) =>
  outline.flatMap((m) => m.submodules.flatMap((s) => s.items));

export const outlineMaxScore = (outline: OutlineModule[]) =>
  outlineItems(outline).reduce((sum, i) => sum + i.maxScore, 0);
