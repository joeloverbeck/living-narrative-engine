import { describe, it, expect, jest } from '@jest/globals';
import { ActionIndexerAdapter } from '../../../../src/turns/adapters/actionIndexerAdapter.js';

/** @typedef {import('../../../../src/turns/services/actionIndexingService.js').ActionIndexingService} ActionIndexingService */

describe('ActionIndexerAdapter validation', () => {
  it('throws if constructed with an invalid service', () => {
    // no methods provided
    expect(() => new ActionIndexerAdapter({})).toThrow(TypeError);
  });

  it('delegates beginTurn to the service and validates actorId', () => {
    const svc = {
      beginTurn: jest.fn(),
      indexActions: jest.fn(),
      resolve: jest.fn(),
    };
    const adapter = new ActionIndexerAdapter(svc);

    expect(() => adapter.beginTurn('')).toThrow(TypeError);
    expect(() => adapter.beginTurn()).toThrow(TypeError);

    adapter.beginTurn('actor1');
    expect(svc.beginTurn).toHaveBeenCalledWith('actor1');
  });

  it('validates inputs to index()', () => {
    const svc = {
      indexActions: jest.fn().mockReturnValue(['ok']),
      beginTurn: jest.fn(),
      resolve: jest.fn(),
    };
    const adapter = new ActionIndexerAdapter(svc);

    expect(() => adapter.index('notArray', 'a')).toThrow(TypeError);
    expect(() => adapter.index([], '')).toThrow(TypeError);

    const result = adapter.index([], 'actor');
    expect(result).toEqual(['ok']);
    expect(svc.indexActions).toHaveBeenCalledWith('actor', []);
  });

  it('validates inputs to resolve()', () => {
    const svc = {
      resolve: jest.fn().mockReturnValue('resolved'),
      beginTurn: jest.fn(),
      indexActions: jest.fn(),
    };
    const adapter = new ActionIndexerAdapter(svc);

    expect(() => adapter.resolve('', 0)).toThrow(TypeError);
    expect(() => adapter.resolve('actor', 1.5)).toThrow(TypeError);

    const result = adapter.resolve('actor', 1);
    expect(result).toBe('resolved');
    expect(svc.resolve).toHaveBeenCalledWith('actor', 1);
  });
});
