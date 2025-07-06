import { describe, it, expect } from '@jest/globals';
import AnatomyGraphContext from '../../../src/anatomy/anatomyGraphContext.js';

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

  it('produces deterministic random numbers when seeded', () => {
    const ctx1 = createContext(42);
    const ctx2 = createContext(42);
    const rand1 = ctx1.getRNG()();
    const rand2 = ctx2.getRNG()();
    expect(rand1).toBeCloseTo(rand2);
  });
});
