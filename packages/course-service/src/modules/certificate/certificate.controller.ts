import { randomBytes } from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../shared/middlewares/auth.middleware.js';
import Certificate, { ICertificate } from '../../shared/models/certificate.model.js';
import { ICourseDocument } from '../../shared/models/course.model.js';
import { ICourseProgress } from '../../shared/models/courseProgress.model.js';
import CourseProgressDao from '../../shared/dao/courseProgress.dao.js';
import {
  assertCanManageCourse,
  memberships,
  openCourse,
  requireCourse
} from '../../services/access.service.js';
import {
  loadCourseOutline,
  OutlineModule,
  outlineItems,
  outlineMaxScore
} from '../../services/courseOutline.service.js';
import Ok from '../../shared/responses/Ok.response.js';
import Created from '../../shared/responses/Created.response.js';
import NotFound from '../../shared/errors/NotFound.error.js';
import Forbidden from '../../shared/errors/Forbidden.error.js';
import BadRequest from '../../shared/errors/BadRequest.error.js';

const param = (v: string | string[]) => (Array.isArray(v) ? v[0] : v);

// 64 random bits, e.g. 9F2C-41AB-07DE-66B3: unguessable, and short enough to type in
export const newCode = () => randomBytes(8).toString('hex').toUpperCase().match(/.{4}/g)!.join('-');
export const CODE_RE = /^[0-9A-F]{4}(-[0-9A-F]{4}){3}$/;

// what a verifier (anyone holding the code) may see: no user id, no email
export const publicCertificate = (c: ICertificate) => ({
  code: c.code,
  learnerName: c.learnerName,
  courseTitle: c.courseTitle,
  signerName: c.signerName,
  signature: c.signature,
  percentage: c.percentage,
  completedAt: c.completedAt,
  issuedAt: c.createdAt
});

const isDuplicate = (err: unknown) => (err as { code?: number })?.code === 11000;

// how far one learner got: every item of the course must be completed
export function completion(outline: OutlineModule[], progress: ICourseProgress | null) {
  const done = new Set((progress?.completedItems || []).map((c) => c.contentItemId.toString()));
  const items = outlineItems(outline);
  const completed = items.filter((i) => done.has(i._id)).length;
  const maxScore = outlineMaxScore(outline);
  const last = (progress?.completedItems || []).reduce(
    (t, c) => Math.max(t, new Date(c.completedAt).getTime()),
    0
  );
  return {
    totalItems: items.length,
    completedItems: completed,
    complete: items.length > 0 && completed === items.length,
    percentage: maxScore ? Math.round(((progress?.totalScoreEarned || 0) / maxScore) * 100) : 100,
    completedAt: last ? new Date(last) : new Date()
  };
}

// the one place certificates are created; a second issue for the same learner returns the first
async function issue(
  course: ICourseDocument,
  userId: string,
  learnerName: string,
  c: { percentage: number; completedAt: Date }
): Promise<{ cert: ICertificate; created: boolean }> {
  const signer = course.certificate;
  if (!signer?.signature) {
    throw new BadRequest(
      'This course has no certificate signature yet. Add one in the course editor.'
    );
  }
  try {
    const cert = await Certificate.create({
      code: newCode(),
      courseId: course._id,
      userId,
      learnerName,
      courseTitle: course.title,
      signerName: signer.signerName,
      signature: signer.signature,
      percentage: c.percentage,
      completedAt: c.completedAt
    });
    return { cert, created: true };
  } catch (err) {
    if (!isDuplicate(err)) throw err;
    return { cert: (await Certificate.findOne({ courseId: course._id, userId }))!, created: false };
  }
}

class CertificateController {
  progressDao = new CourseProgressDao();

  private async myStatus(req: AuthenticatedRequest) {
    const courseId = param(req.params.courseId);
    const { course, outline, manager } = await openCourse(req.user!, courseId);
    const progress = await this.progressDao.findProgress(courseId, req.user!.userId);
    return { course, manager, ...completion(outline, progress) };
  }

  // every learner of a course with their completion and certificate (staff view)
  private async roster(course: ICourseDocument) {
    const courseId = course._id.toString();
    const [outline, members, progress, certs] = await Promise.all([
      loadCourseOutline(course),
      memberships.members(courseId),
      this.progressDao.listGradesByCourse(courseId),
      Certificate.find({ courseId: course._id })
    ]);
    const learners = members.filter((m) => m.role === 'trainee');
    const names = new Map(
      (await memberships.profiles(learners.map((m) => m.userId))).map((p) => [p.userId, p.name])
    );
    const byUser = new Map(progress.map((p) => [p.userId, p]));
    const certByUser = new Map(certs.map((c) => [c.userId, c]));
    return learners.map((m) => ({
      userId: m.userId,
      name: names.get(m.userId)?.trim() || '',
      ...completion(outline, byUser.get(m.userId) || null),
      certificate: certByUser.has(m.userId) ? publicCertificate(certByUser.get(m.userId)!) : null
    }));
  }

  // GET /api/courses/:courseId/certificate
  getMine = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const s = await this.myStatus(req);
      const cert = await Certificate.findOne({ courseId: s.course._id, userId: req.user!.userId });
      return Ok(res, 'Certificate status', {
        eligible: s.complete && !s.manager,
        hasSigner: !!s.course.certificate?.signature,
        totalItems: s.totalItems,
        completedItems: s.completedItems,
        certificate: cert ? publicCertificate(cert) : null
      });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/courses/:courseId/certificate — the learner claims it once the course is completed
  claim = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const s = await this.myStatus(req);
      const userId = req.user!.userId;
      const existing = await Certificate.findOne({ courseId: s.course._id, userId });
      if (existing) return Ok(res, 'Certificate already issued', publicCertificate(existing));

      if (s.manager) throw new Forbidden('Certificates are issued to learners of the course.');
      if (!s.complete) {
        throw new BadRequest(
          `Complete every item first (${s.completedItems}/${s.totalItems} done).`
        );
      }
      const learnerName = (req.user!.name || req.user!.email?.split('@')[0] || '').trim();
      if (!learnerName) throw new BadRequest('Add your name to your account first.');

      const { cert, created } = await issue(s.course, userId, learnerName, s);
      return created
        ? Created(res, 'Certificate issued', publicCertificate(cert))
        : Ok(res, 'Certificate already issued', publicCertificate(cert));
    } catch (error) {
      next(error);
    }
  };

  // GET /api/courses/:courseId/certificates — staff: learners, completion, who has one
  listForCourse = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const course = await requireCourse(param(req.params.courseId));
      await assertCanManageCourse(req.user!, course);
      return Ok(res, 'Course certificates', {
        hasSigner: !!course.certificate?.signature,
        signerName: course.certificate?.signerName || null,
        learners: await this.roster(course)
      });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/courses/:courseId/certificates/issue { userIds } — staff issue in bulk. Staff decide:
  // a learner who has not finished every item can still be awarded one (e.g. offline sessions).
  issueBulk = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const course = await requireCourse(param(req.params.courseId));
      await assertCanManageCourse(req.user!, course);
      if (!course.certificate?.signature) {
        throw new BadRequest('Add the certificate signature in the course editor first.');
      }
      const wanted = new Set<string>(req.body.userIds);
      const roster = (await this.roster(course)).filter((l) => wanted.has(l.userId));

      const issued: string[] = [];
      const skipped: { userId: string; reason: string }[] = [];
      for (const id of wanted) {
        if (!roster.some((l) => l.userId === id))
          skipped.push({ userId: id, reason: 'not a learner of this course' });
      }
      // ponytail: sequential inserts, fine for a batch of a few hundred; parallelise if batches grow
      for (const l of roster) {
        if (l.certificate) {
          skipped.push({ userId: l.userId, reason: 'already has a certificate' });
        } else if (!l.name) {
          skipped.push({ userId: l.userId, reason: 'has no name on their profile' });
        } else {
          const { created } = await issue(course, l.userId, l.name, l);
          if (created) issued.push(l.userId);
          else skipped.push({ userId: l.userId, reason: 'already has a certificate' });
        }
      }
      return Ok(res, `Issued ${issued.length} certificate(s)`, { issued, skipped });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/courses/certificates/mine
  listMine = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const certs = await Certificate.find({ userId: req.user!.userId }).sort({ createdAt: -1 });
      return Ok(res, 'Certificates fetched', certs.map(publicCertificate));
    } catch (error) {
      next(error);
    }
  };

  // GET /api/courses/certificates/verify/:code — public: the QR code on a certificate lands here
  verify = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const code = param(req.params.code).toUpperCase();
      const cert = CODE_RE.test(code) ? await Certificate.findOne({ code }) : null;
      if (!cert) throw new NotFound('No certificate with this ID was issued by Knowhere.');
      return Ok(res, 'Certificate is valid', publicCertificate(cert));
    } catch (error) {
      next(error);
    }
  };
}

export default CertificateController;
