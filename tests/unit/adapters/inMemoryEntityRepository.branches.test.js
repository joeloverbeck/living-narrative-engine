import { describe, it, expect } from '@jest/globals';
import InMemoryEntityRepository from '../../../src/adapters/InMemoryEntityRepository.js';

/**
 * Additional branch coverage for InMemoryEntityRepository.add().
 */
describe('InMemoryEntityRepository additional branches', () => {
  it('ignores non-object values without throwing', () => {
    const repo = new InMemoryEntityRepository();
    repo.add(null);
    repo.add('foo');
    repo.add(123);
    expect(Array.from(repo.entities())).toEqual([]);
  });

  it('ignores objects missing a valid id', () => {
    const repo = new InMemoryEntityRepository();
    repo.add({});
    repo.add({ id: '' });
    expect(Array.from(repo.entities())).toEqual([]);
  });
});
