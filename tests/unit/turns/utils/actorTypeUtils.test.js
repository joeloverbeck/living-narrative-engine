import { describe, it, expect } from '@jest/globals';
import {
  determineActorType,
  determineSpecificPlayerType,
} from '../../../../src/utils/actorTypeUtils.js';

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

  it('uses player_type component when present and returns ai for non-human', () => {
    const actor = {
      components: { 'core:player_type': { type: 'llm' } },
    };
    expect(determineActorType(actor)).toBe('ai');
  });

  it('uses player_type component when human', () => {
    const actor = {
      components: { 'core:player_type': { type: 'human' } },
    };
    expect(determineActorType(actor)).toBe('human');
  });

  it('falls back to core:player component when no player_type', () => {
    const actor = {
      components: { 'core:player': {} },
    };
    expect(determineActorType(actor)).toBe('human');
  });

  it('handles undefined actor gracefully', () => {
    expect(determineActorType(undefined)).toBe('human');
  });
});

describe('determineSpecificPlayerType', () => {
  it('returns value from player_type component', () => {
    const actor = {
      components: { 'core:player_type': { type: 'goap' } },
    };
    expect(determineSpecificPlayerType(actor)).toBe('goap');
  });

  it('returns lowercase AI type from legacy ai component', () => {
    const actor = { components: { ai: { type: 'GOAP' } } };
    expect(determineSpecificPlayerType(actor)).toBe('goap');
  });

  it('returns human for legacy core:player', () => {
    const actor = { components: { 'core:player': {} } };
    expect(determineSpecificPlayerType(actor)).toBe('human');
  });

  it('defaults to llm when isAi true with no other hints', () => {
    const actor = { isAi: true };
    expect(determineSpecificPlayerType(actor)).toBe('llm');
  });

  it('returns human when no hints exist', () => {
    const actor = {};
    expect(determineSpecificPlayerType(actor)).toBe('human');
  });

  it('handles undefined actor gracefully', () => {
    expect(determineSpecificPlayerType(undefined)).toBe('human');
  });
});
