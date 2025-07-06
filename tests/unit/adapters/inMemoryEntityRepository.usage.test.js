import { describe, it, expect } from '@jest/globals';
import InMemoryEntityRepository from '../../../src/adapters/InMemoryEntityRepository.js';

/**
 * Comprehensive tests for InMemoryEntityRepository basic usage and edge cases.
 */

describe('InMemoryEntityRepository basic operations', () => {
  it('stores and retrieves entities by id', () => {
    const repo = new InMemoryEntityRepository();
    const entity = { id: 'e1', name: 'test' };

    repo.add(entity);
    expect(repo.has('e1')).toBe(true);
    expect(repo.get('e1')).toBe(entity);

    const removed = repo.remove('e1');
    expect(removed).toBe(true);
    expect(repo.has('e1')).toBe(false);
  });

  it('handles invalid ids gracefully', () => {
    const repo = new InMemoryEntityRepository();
    const entity = { id: 'valid' };
    repo.add(entity);

    expect(repo.get(undefined)).toBeUndefined();
    expect(repo.get('')).toBeUndefined();
    expect(repo.has(undefined)).toBe(false);
    expect(repo.remove(undefined)).toBe(false);
  });

  it('clear removes all entities', () => {
    const repo = new InMemoryEntityRepository();
    repo.add({ id: 'a' });
    repo.add({ id: 'b' });

    repo.clear();
    expect(Array.from(repo.entities())).toEqual([]);
  });
});
