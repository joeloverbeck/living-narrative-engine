import { describe, it, expect, beforeEach } from '@jest/globals';
import DamageAccumulator from '../../../../src/anatomy/services/damageAccumulator.js';
import { classifyDamageSeverity } from '../../../../src/anatomy/constants/damageSeverity.js';

describe('DamageAccumulator - negligible severity tagging', () => {
  let accumulator;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    accumulator = new DamageAccumulator({ logger: mockLogger });
  });

  it('records a negligible severity entry when provided', () => {
    const session = accumulator.createSession('entity-1');
    const severity = classifyDamageSeverity(1.9, 100); // threshold = 2

    accumulator.recordDamage(session, {
      entityId: 'entity-1',
      partId: 'part-1',
      partType: 'torso',
      amount: 1.9,
      severity,
    });

    expect(session.entries[0].severity).toBe('negligible');
  });

  it('defaults severity to standard when none is provided', () => {
    const session = accumulator.createSession('entity-1');

    accumulator.recordDamage(session, {
      entityId: 'entity-1',
      partId: 'part-1',
      partType: 'arm',
      amount: 3,
    });

    expect(session.entries[0].severity).toBe('standard');
  });

  it('treats damage at the threshold as non-negligible', () => {
    const session = accumulator.createSession('entity-1');
    const severity = classifyDamageSeverity(2, 100); // equals absolute threshold

    accumulator.recordDamage(session, {
      entityId: 'entity-1',
      partId: 'part-2',
      partType: 'leg',
      amount: 2,
      severity,
    });

    expect(session.entries[0].severity).toBe('standard');
  });
});
