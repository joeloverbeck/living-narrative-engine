import { describe, it, expect } from '@jest/globals';
import InMemoryEntityRepository from '../../../src/adapters/InMemoryEntityRepository.js';

/**
 * Additional branch coverage for InMemoryEntityRepository focusing on
 * edge cases not covered elsewhere.
 */
describe('InMemoryEntityRepository uncovered branches', () => {
  it('ignores entity objects with non-string id', () => {
    const repo = new InMemoryEntityRepository();
    repo.add({ id: 123, foo: 'bar' });
    repo.add({ id: null });
    expect(Array.from(repo.entities())).toEqual([]);
  });

  it('iterates over multiple valid entities in insertion order', () => {
    const repo = new InMemoryEntityRepository();
    repo.add({ id: 'a', val: 1 });
    repo.add({ id: 'b', val: 2 });
    expect([...repo.entities()].map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('ignores non-object values passed to add()', () => {
    const repo = new InMemoryEntityRepository();
    repo.add('foo');
    repo.add(42);
    expect(Array.from(repo.entities())).toEqual([]);
  });

  it('ignores objects missing an id when adding', () => {
    const repo = new InMemoryEntityRepository();
    repo.add({ name: 'no id' });
    repo.add({});
    expect(Array.from(repo.entities())).toEqual([]);
  });
});
