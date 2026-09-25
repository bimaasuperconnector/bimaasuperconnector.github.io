import {
  type DocumentData,
  type QueryDocumentSnapshot,
  addDoc,
  collection,
  doc,
  getDocs,
  limit as fsLimit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../init';

export const REPORT_REASONS = ['spam', 'inappropriate', 'scam', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export type ReportTargetType = 'job';
export type ReportStatus = 'open' | 'resolved' | 'dismissed';

export interface Report {
  id: string;
  reporterUid: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  note: string;
  status: ReportStatus;
  createdAt: Date;
}

function reportsCollection() {
  if (!db) throw new Error('Firestore is not configured.');
  return collection(db, 'reports');
}

function fromSnapshot(snap: QueryDocumentSnapshot<DocumentData>): Report {
  const data = snap.data();
  return {
    id: snap.id,
    reporterUid: data.reporterUid,
    targetType: data.targetType,
    targetId: data.targetId,
    reason: data.reason,
    note: data.note ?? '',
    status: data.status,
    createdAt: data.createdAt?.toDate() ?? new Date(),
  };
}

/** Any approved member reporting a job posting. One document per report — no dedupe, an admin sees repeats as signal. */
export async function reportJob(
  reporterUid: string,
  jobId: string,
  reason: ReportReason,
  note: string,
): Promise<void> {
  await addDoc(reportsCollection(), {
    reporterUid,
    targetType: 'job',
    targetId: jobId,
    reason,
    note: note.slice(0, 500),
    status: 'open',
    createdAt: serverTimestamp(),
  });
}

/** Admin-only moderation queue. Bounded to the most recent 50 open reports — a dashboard list, not a full export. */
export async function queryOpenReports(): Promise<Report[]> {
  const snap = await getDocs(
    query(reportsCollection(), where('status', '==', 'open'), orderBy('createdAt', 'desc'), fsLimit(50)),
  );
  return snap.docs.map(fromSnapshot);
}

export async function setReportStatus(reportId: string, status: ReportStatus): Promise<void> {
  await updateDoc(doc(reportsCollection(), reportId), { status, updatedAt: serverTimestamp() });
}
