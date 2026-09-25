import { collection, getCountFromServer, query, where } from 'firebase/firestore';
import { db } from '../init';

export interface AdminMetrics {
  pendingApprovals: number;
  approvedMembers: number;
  pendingJobs: number;
  approvedJobs: number;
  openToWorkCount: number;
  founderCount: number;
  openReports: number;
}

/**
 * Every number here comes from a Firestore count() aggregation, NOT
 * from fetching and counting documents client-side. A count() query is
 * billed as roughly one read per 1,000 index entries it scans
 * (regardless of how many match), so this whole dashboard costs a
 * small, near-constant number of reads even once the alumni base is in
 * the thousands — nothing here re-downloads the member/job list to
 * compute a number the UI only needs as an integer.
 */
export async function loadAdminMetrics(): Promise<AdminMetrics> {
  if (!db) throw new Error('Firestore is not configured.');

  const [
    pendingApprovals,
    approvedMembers,
    pendingJobs,
    approvedJobs,
    openToWorkCount,
    founderCount,
    openReports,
  ] = await Promise.all([
    getCountFromServer(query(collection(db, 'users'), where('status', '==', 'pending'))),
    getCountFromServer(query(collection(db, 'users'), where('status', '==', 'approved'))),
    getCountFromServer(query(collection(db, 'jobs'), where('status', '==', 'pending'))),
    getCountFromServer(query(collection(db, 'jobs'), where('status', '==', 'approved'))),
    getCountFromServer(query(collection(db, 'profiles'), where('openToWork', '==', true))),
    getCountFromServer(query(collection(db, 'profiles'), where('hasFounderOrg', '==', true))),
    getCountFromServer(query(collection(db, 'reports'), where('status', '==', 'open'))),
  ]);

  return {
    pendingApprovals: pendingApprovals.data().count,
    approvedMembers: approvedMembers.data().count,
    pendingJobs: pendingJobs.data().count,
    approvedJobs: approvedJobs.data().count,
    openToWorkCount: openToWorkCount.data().count,
    founderCount: founderCount.data().count,
    openReports: openReports.data().count,
  };
}
