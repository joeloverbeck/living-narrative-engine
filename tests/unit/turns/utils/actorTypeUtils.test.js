import { describe, it, expect } from '@jest/globals';
import { determineActorType } from '../../../../src/utils/actorTypeUtils.js';

describe('determineActorType', () => {
  it('returns "ai" when actor.isAi is true', () => {
    const actor = { isAi: true };
    expect(determineActorType(actor)).toBe('ai');
  });

  it('returns "human" when actor.isAi is false', () => {
    const actor = { isAi: false };
    expect(determineActorType(actor)).toBe('human');
  });

  it('defaults to "human" when actor.isAi is undefined', () => {
    const actor = {};
    expect(determineActorType(actor)).toBe('human');
  });
});
