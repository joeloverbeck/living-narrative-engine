import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  recordNumericConstraintFallback,
  getNumericConstraintDiagnostics,
  getAllNumericConstraintDiagnostics,
  clearNumericConstraintDiagnostics,
} from '../../../../src/goap/planner/numericConstraintDiagnostics.js';

describe('numericConstraintDiagnostics', () => {
  beforeEach(() => {
    clearNumericConstraintDiagnostics();
  });

  it('returns null when no actor id is provided', () => {
    expect(getNumericConstraintDiagnostics()).toBeNull();
  });

  it('returns null when actor has no diagnostics and none exist for unknown', () => {
    expect(getNumericConstraintDiagnostics('missing-actor')).toBeNull();
  });

  it('caps recent fallbacks at the maximum and shifts the oldest entry', () => {
    const actorId = 'actor-1';
    const totalEntries = 6; // MAX_RECENT_FALLBACKS is 5

    for (let i = 0; i < totalEntries; i += 1) {
      recordNumericConstraintFallback({ actorId, goalId: `goal-${i}` });
    }

    const diagnostics = getNumericConstraintDiagnostics(actorId);

    expect(diagnostics.totalFallbacks).toBe(totalEntries);
    expect(diagnostics.recent).toHaveLength(5);
    expect(diagnostics.recent[0].goalId).toBe('goal-1'); // goal-0 should have been shifted out
  });

  it('returns cloned diagnostics for all actors', () => {
    recordNumericConstraintFallback({ actorId: 'actor-a', goalId: 'goal-a' });
    recordNumericConstraintFallback({ actorId: 'actor-b', goalId: 'goal-b' });

    const allDiagnostics = getAllNumericConstraintDiagnostics();

    expect(allDiagnostics).toHaveLength(2);

    // Mutate the returned object to ensure the source map is not affected
    allDiagnostics[0].recent[0].goalId = 'mutated-goal';
    const freshDiagnostics = getNumericConstraintDiagnostics(allDiagnostics[0].actorId);

    expect(freshDiagnostics.recent[0].goalId).not.toBe('mutated-goal');
  });
});
