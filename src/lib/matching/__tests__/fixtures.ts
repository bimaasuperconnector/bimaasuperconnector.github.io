import type { MatchCandidate } from '../types';
import type { RegistrationMode, RegistrationSlot } from '../../cycles';

export function makeCandidate(overrides: Partial<MatchCandidate> & { uid: string }): MatchCandidate {
  return {
    batchNumber: 10,
    interests: [],
    skills: [],
    networkingPurpose: [],
    organizations: [],
    connectionMeter: 1000,
    slot: 'both' as RegistrationSlot,
    mode: 'one_to_one' as RegistrationMode,
    ...overrides,
  };
}
