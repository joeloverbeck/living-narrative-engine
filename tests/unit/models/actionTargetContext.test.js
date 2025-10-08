import { describe, expect, it } from '@jest/globals';
import { ActionTargetContext } from '../../../src/models/actionTargetContext.js';

describe('ActionTargetContext', () => {
  it('creates an entity context with the provided identifier', () => {
    const context = new ActionTargetContext('entity', { entityId: 'npc-42' });

    expect(context).toBeInstanceOf(ActionTargetContext);
    expect(context.type).toBe('entity');
    expect(context.entityId).toBe('npc-42');
  });

  it('throws when constructed with an unknown type', () => {
    expect(() => new ActionTargetContext('invalid')).toThrow(
      "ActionTargetContext: Invalid type specified: invalid",
    );
  });

  it('enforces that entity targets provide a non-empty string identifier', () => {
    expect(() => new ActionTargetContext('entity')).toThrow(
      "ActionTargetContext: entityId (non-empty string) is required for type 'entity'.",
    );

    expect(
      () => new ActionTargetContext('entity', { entityId: '   ' }),
    ).toThrow(
      "ActionTargetContext: entityId (non-empty string) is required for type 'entity'.",
    );
  });

  it('ignores provided entity identifiers for non-entity targets', () => {
    const context = new ActionTargetContext('none', { entityId: 'ignored' });

    expect(context.type).toBe('none');
    expect(context.entityId).toBeNull();
  });

  it('provides a static factory for entity targets that delegates to the constructor', () => {
    const context = ActionTargetContext.forEntity('hero-7');

    expect(context).toBeInstanceOf(ActionTargetContext);
    expect(context.type).toBe('entity');
    expect(context.entityId).toBe('hero-7');
  });

  it('validates identifiers supplied to the entity factory', () => {
    expect(() => ActionTargetContext.forEntity('')).toThrow(
      "ActionTargetContext: entityId (non-empty string) is required for type 'entity'.",
    );
  });

  it('creates a reusable singleton-like context for actions without targets', () => {
    const first = ActionTargetContext.noTarget();
    const second = ActionTargetContext.noTarget();

    expect(first).toBeInstanceOf(ActionTargetContext);
    expect(second).toBeInstanceOf(ActionTargetContext);
    expect(first.type).toBe('none');
    expect(first.entityId).toBeNull();
    expect(second.type).toBe('none');
    expect(second.entityId).toBeNull();
    expect(first).not.toBe(second);
  });
});
