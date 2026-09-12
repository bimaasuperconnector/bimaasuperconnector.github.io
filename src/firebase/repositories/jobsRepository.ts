import {
  type DocumentData,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  collection,
  deleteDoc,
  doc,
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
    status: 'pending',
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

/** Admin moderation queue. */
export async function queryPendingJobs(): Promise<Job[]> {
  const snapshot = await getDocs(
    query(jobsCollection(), where('status', '==', 'pending'), orderBy('createdAt', 'desc')),
  );
  return snapshot.docs.map((d) => fromSnapshot(d.id, d.data()));
}

export async function setJobStatus(jobId: string, status: 'approved' | 'rejected'): Promise<void> {
  await updateDoc(jobDocRef(jobId), { status, updatedAt: serverTimestamp() });
}
