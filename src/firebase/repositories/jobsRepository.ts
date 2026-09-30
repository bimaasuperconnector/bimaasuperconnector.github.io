import {
  type DocumentData,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit as fsLimit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { db } from '../init';

export const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'contract', 'internship', 'freelance'] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
  internship: 'Internship',
  freelance: 'Freelance',
};

export const JOB_URGENCY_LEVELS = ['urgent', 'standard'] as const;
export type JobUrgency = (typeof JOB_URGENCY_LEVELS)[number];

export type JobStatus = 'pending' | 'approved' | 'rejected' | 'archived';

export interface JobFormFields {
  company: string;
  title: string;
  location: string;
  employmentType: EmploymentType;
  urgency: JobUrgency;
  description: string;
  skills: string[];
  experienceLevel: string;
  contactPerson: string;
  contactDetails: string;
  applicationMethod: string;
  expirationDate: Date;
}

export interface Job extends JobFormFields {
  id: string;
  postedByUid: string;
  postedByDisplayName: string;
  status: JobStatus;
  createdAt: Date | null;
}

const ALLOWED_FIELDS = [
  'postedByUid',
  'postedByDisplayName',
  'company',
  'title',
  'location',
  'employmentType',
  'urgency',
  'description',
  'skills',
  'experienceLevel',
  'contactPerson',
  'contactDetails',
  'applicationMethod',
  'expirationDate',
  'status',
  'createdAt',
  'updatedAt',
] as const;

function jobsCollection() {
  if (!db) throw new Error('Firestore is not configured.');
  return collection(db, 'jobs');
}

function jobDocRef(id: string) {
  if (!db) throw new Error('Firestore is not configured.');
  return doc(db, 'jobs', id);
}

function fromSnapshot(id: string, data: DocumentData): Job {
  return {
    id,
    postedByUid: data.postedByUid,
    postedByDisplayName: data.postedByDisplayName ?? '',
    company: data.company ?? '',
    title: data.title ?? '',
    location: data.location ?? '',
    employmentType: data.employmentType,
    urgency: data.urgency,
    description: data.description ?? '',
    skills: Array.isArray(data.skills) ? data.skills : [],
    experienceLevel: data.experienceLevel ?? '',
    contactPerson: data.contactPerson ?? '',
    contactDetails: data.contactDetails ?? '',
    applicationMethod: data.applicationMethod ?? '',
    expirationDate: data.expirationDate?.toDate?.() ?? new Date(),
    status: data.status ?? 'pending',
    createdAt: data.createdAt?.toDate?.() ?? null,
  };
}

export async function createJob(user: FirebaseUser, fields: JobFormFields): Promise<void> {
  const payload: Record<string, unknown> = {
    postedByUid: user.uid,
    postedByDisplayName: user.displayName ?? '',
    ...fields,
    expirationDate: Timestamp.fromDate(fields.expirationDate),
    // Publish-first: goes live immediately. Admins only review a posting
    // if a member reports it (see reportsRepository / firestore.rules).
    status: 'approved',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const unexpected = Object.keys(payload).filter((k) => !ALLOWED_FIELDS.includes(k as never));
  if (unexpected.length > 0) {
    throw new Error(`Unexpected job fields: ${unexpected.join(', ')}`);
  }

  const ref = doc(jobsCollection());
  await setDoc(ref, payload);
}

export async function updateJob(jobId: string, fields: JobFormFields): Promise<void> {
  await updateDoc(jobDocRef(jobId), {
    ...fields,
    expirationDate: Timestamp.fromDate(fields.expirationDate),
    updatedAt: serverTimestamp(),
  });
}

export async function withdrawJob(jobId: string): Promise<void> {
  await deleteDoc(jobDocRef(jobId));
}

export interface JobsPageResult {
  jobs: Job[];
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}

const DEFAULT_PAGE_SIZE = 20;

/** Active jobs board — only 'approved' postings, newest first. Expired postings are moved to 'archived' by automation (see automation/src/jobsCleanupJob.ts), so this never needs a client-side expiration filter. */
export async function queryActiveJobs(
  cursor?: QueryDocumentSnapshot<DocumentData> | null,
): Promise<JobsPageResult> {
  const constraints: QueryConstraint[] = [where('status', '==', 'approved'), orderBy('createdAt', 'desc')];
  if (cursor) constraints.push(startAfter(cursor));
  constraints.push(fsLimit(DEFAULT_PAGE_SIZE + 1));

  const snapshot = await getDocs(query(jobsCollection(), ...constraints));
  const docs = snapshot.docs.slice(0, DEFAULT_PAGE_SIZE);
  return {
    jobs: docs.map((d) => fromSnapshot(d.id, d.data())),
    lastDoc: docs.length > 0 ? docs[docs.length - 1] : null,
    hasMore: snapshot.docs.length > DEFAULT_PAGE_SIZE,
  };
}

/** Every posting by one member, regardless of status — so they can track their own pending/rejected/archived jobs. */
export async function queryMyJobs(uid: string): Promise<Job[]> {
  const snapshot = await getDocs(
    query(jobsCollection(), where('postedByUid', '==', uid), orderBy('createdAt', 'desc')),
  );
  return snapshot.docs.map((d) => fromSnapshot(d.id, d.data()));
}

export async function getJob(jobId: string): Promise<Job | null> {
  const snapshot = await getDoc(jobDocRef(jobId));
  return snapshot.exists() ? fromSnapshot(jobId, snapshot.data()) : null;
}

/** Max description length. Mirrored in firestore.rules' isValidJobShape(). */
export const JOB_DESCRIPTION_MAX = 10000;

/** Admin action on a REPORTED posting: 'rejected' takes it off the board (the poster still sees it in "Your postings"). */
export async function setJobStatus(jobId: string, status: 'approved' | 'rejected'): Promise<void> {
  await updateDoc(jobDocRef(jobId), { status, updatedAt: serverTimestamp() });
}

/** How far back the bell considers a job "new" for members who have never opened it before. */
export const JOB_FEED_WINDOW_DAYS = 14;

/**
 * Bell badge: how many jobs OTHER members posted since `since`.
 *
 * Two count() aggregations = about 2 billed reads per check, however many
 * jobs exist. No fan-out: a posting is ONE document write, not a write per
 * member (10,000 per-member notification documents for every posting would
 * burn the free write quota within a couple of jobs). Both counts use
 * composite indexes that already exist: (status, createdAt) and
 * (postedByUid, createdAt).
 */
export async function countNewJobsFromOthers(uid: string, since: Date): Promise<number> {
  const ts = Timestamp.fromDate(since);
  const [all, mine] = await Promise.all([
    getCountFromServer(query(jobsCollection(), where('status', '==', 'approved'), where('createdAt', '>', ts))),
    getCountFromServer(query(jobsCollection(), where('postedByUid', '==', uid), where('createdAt', '>', ts))),
  ]);
  return Math.max(0, all.data().count - mine.data().count);
}

/** Newest few approved postings for the bell feed (bounded; only fetched when the bell is opened). */
export async function listRecentJobsForFeed(max = 5): Promise<Job[]> {
  const since = Timestamp.fromDate(new Date(Date.now() - JOB_FEED_WINDOW_DAYS * 24 * 60 * 60 * 1000));
  const snapshot = await getDocs(
    query(
      jobsCollection(),
      where('status', '==', 'approved'),
      where('createdAt', '>', since),
      orderBy('createdAt', 'desc'),
      fsLimit(max),
    ),
  );
  return snapshot.docs.map((d) => fromSnapshot(d.id, d.data()));
}
