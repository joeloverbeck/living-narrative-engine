import { describe, it, expect } from '@jest/globals';
import AnatomyGraphContext from '../../../src/anatomy/anatomyGraphContext.js';
import { ValidationError } from '../../../src/errors/validationError.js';

// Helper to create a context with deterministic RNG
const createContext = (seed) => new AnatomyGraphContext(seed);

describe('AnatomyGraphContext', () => {
  it('tracks root id and created entities', () => {
    const ctx = createContext(123);
    ctx.setRootId('root1');
    ctx.addCreatedEntity('child1');
    expect(ctx.getRootId()).toBe('root1');
    expect(ctx.getCreatedEntities()).toEqual(['root1', 'child1']);
    expect(ctx.getEntityForSlot(null)).toBe('root1');
  });

  it('increments part counts and exposes them', () => {
    const ctx = createContext();
    ctx.incrementPartCount('arm');
    ctx.incrementPartCount('arm');
    expect(ctx.getPartCount('arm')).toBe(2);
    const counts = ctx.getPartCounts();
    expect(counts.get('arm')).toBe(2);
    expect(counts).not.toBe(ctx.getPartCounts());
  });

  it('tracks socket occupancy', () => {
    const ctx = createContext();
    ctx.occupySocket('body', 'left');
    expect(ctx.isSocketOccupied('body', 'left')).toBe(true);
    expect(ctx.getSocketOccupancy()).toEqual(new Set(['body:left']));
  });

  it('maps slots to entity ids', () => {
    const ctx = createContext();
    ctx.mapSlotToEntity('s1', 'e1');
    expect(ctx.getEntityForSlot('s1')).toBe('e1');
    expect(ctx.getEntityForSlot('unknown')).toBeUndefined();
  });

  it('throws ValidationError when mapping duplicate slot key', () => {
    const ctx = createContext();
    ctx.mapSlotToEntity('left_arm', 'entity-123');

    expect(() => {
      ctx.mapSlotToEntity('left_arm', 'entity-456');
    }).toThrow(ValidationError);

    expect(() => {
      ctx.mapSlotToEntity('left_arm', 'entity-456');
    }).toThrow(/already mapped to entity 'entity-123'/);
  });

  it('allows mapping different slot keys to different entities', () => {
    const ctx = createContext();
    ctx.mapSlotToEntity('left_arm', 'entity-123');
    ctx.mapSlotToEntity('right_arm', 'entity-456');

    expect(ctx.getEntityForSlot('left_arm')).toBe('entity-123');
    expect(ctx.getEntityForSlot('right_arm')).toBe('entity-456');
  });

  it('includes both entity IDs and slot key in error message for duplicate slot', () => {
    const ctx = createContext();
    ctx.mapSlotToEntity('torso', 'entity-original');

    let caughtError;
    expect(() => {
      ctx.mapSlotToEntity('torso', 'entity-duplicate');
    }).toThrow(ValidationError);

    try {
      ctx.mapSlotToEntity('torso', 'entity-duplicate');
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(ValidationError);
    expect(caughtError.message).toContain('entity-original');
    expect(caughtError.message).toContain('entity-duplicate');
    expect(caughtError.message).toContain('torso');
  });

  it('produces deterministic random numbers when seeded', () => {
    const ctx1 = createContext(42);
    const ctx2 = createContext(42);
    const rand1 = ctx1.getRNG()();
    const rand2 = ctx2.getRNG()();
    expect(rand1).toBeCloseTo(rand2);
  });
});
