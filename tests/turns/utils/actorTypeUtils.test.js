import { describe, it, expect } from '@jest/globals';
import { getActorType } from '../../../src/turns/utils/actorTypeUtils.js';

describe('getActorType', () => {
  it('returns "ai" when actor.isAi is true', () => {
    const actor = { isAi: true };
    expect(getActorType(actor)).toBe('ai');
  });

  it('returns "human" when actor.isAi is false', () => {
    const actor = { isAi: false };
    expect(getActorType(actor)).toBe('human');
  });

  it('defaults to "human" when actor.isAi is undefined', () => {
    const actor = {};
    expect(getActorType(actor)).toBe('human');
  });
});
