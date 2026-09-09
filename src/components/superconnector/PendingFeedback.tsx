import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import {
  FEEDBACK_SENTIMENTS,
  FEEDBACK_SENTIMENT_LABELS,
  type FeedbackSentiment,
} from '../../lib/connectionMeter';
import {
  listOwnMatchParticipants,
  submitFeedback,
} from '../../firebase/repositories/feedbackRepository';
import { getProfile } from '../../firebase/repositories/profilesRepository';
import { db } from '../../firebase/init';

interface PendingItem {
  matchId: string;
  cycleId: string;
  aboutUid: string;
  aboutDisplayName: string;
}

async function feedbackExists(matchId: string, fromUid: string, aboutUid: string): Promise<boolean> {
  if (!db) return false;
  const snapshot = await getDoc(doc(db, 'feedback', `${matchId}_${fromUid}_${aboutUid}`));
  return snapshot.exists();
}

export function PendingFeedback() {
  const { user } = useAuth();
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingKey, setSubmittingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function load() {
      try {
        const matchRecords = await listOwnMatchParticipants(user!.uid);
        const items: PendingItem[] = [];

        for (const record of matchRecords) {
          for (const aboutUid of record.otherParticipantUids) {
            const alreadyGiven = await feedbackExists(record.matchId, user!.uid, aboutUid);
            if (alreadyGiven) continue;
            const aboutProfile = await getProfile(aboutUid);
            items.push({
              matchId: record.matchId,
              cycleId: record.cycleId,
              aboutUid,
              aboutDisplayName: aboutProfile?.displayName || 'this alum',
            });
          }
        }

        if (!cancelled) setPending(items);
      } catch {
        if (!cancelled) setError("Couldn't load your pending feedback.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function handleSubmit(item: PendingItem, sentiment: FeedbackSentiment) {
    if (!user) return;
    const key = `${item.matchId}_${item.aboutUid}`;
    setSubmittingKey(key);
    setError(null);
    try {
      await submitFeedback(item.matchId, user.uid, item.aboutUid, item.cycleId, sentiment);
      setPending((prev) => prev.filter((p) => !(p.matchId === item.matchId && p.aboutUid === item.aboutUid)));
    } catch {
      setError("Couldn't submit that feedback. Please try again.");
    } finally {
      setSubmittingKey(null);
    }
  }

  if (loading) {
    return <p className="text-body-md text-muted">Checking for pending feedback…</p>;
  }

  if (pending.length === 0) {
    return (
      <p className="text-body-md text-muted">
        Nothing to give feedback on right now — this fills in after a monthly
        connection happens.
      </p>
    );
  }

  return (
    <div className="space-y-md">
      {error && <p className="text-body-md text-signature-coral">{error}</p>}
      {pending.map((item) => {
        const key = `${item.matchId}_${item.aboutUid}`;
        return (
          <div key={key} className="rounded-sm border border-hairline p-md">
            <p className="text-label-md text-ink">
              How was your connection with {item.aboutDisplayName}?
            </p>
            <div className="mt-sm flex flex-wrap gap-sm">
              {FEEDBACK_SENTIMENTS.map((sentiment) => (
                <Button
                  key={sentiment}
                  variant="secondary"
                  className="px-md py-xs"
                  disabled={submittingKey === key}
                  onClick={() => void handleSubmit(item, sentiment)}
                >
                  {FEEDBACK_SENTIMENT_LABELS[sentiment]}
                </Button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
