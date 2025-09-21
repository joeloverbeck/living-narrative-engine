import { describe, it, expect, beforeEach } from '@jest/globals';
import InMemoryEntityRepository from '../../../src/adapters/InMemoryEntityRepository.js';

const createEntity = (id, extra = {}) => ({ id, ...extra });

describe('InMemoryEntityRepository integration coverage', () => {
  let repository;

  beforeEach(() => {
    repository = new InMemoryEntityRepository();
  });

  it('adds and retrieves entities by id while exposing iterable values', () => {
    const entity = createEntity('entity-1', { name: 'Alpha' });
    repository.add(entity);

    expect(repository.get('entity-1')).toBe(entity);
    expect(repository.has('entity-1')).toBe(true);
    expect(Array.from(repository.entities())).toEqual([entity]);
  });

  it('removes entities and reports removal state accurately', () => {
    const entity = createEntity('entity-2');
    repository.add(entity);

    expect(repository.remove('entity-2')).toBe(true);
    expect(repository.get('entity-2')).toBeUndefined();
    expect(repository.has('entity-2')).toBe(false);
    expect(repository.remove('entity-2')).toBe(false);
  });

  it('clears stored entities and leaves an empty iterator', () => {
    repository.add(createEntity('entity-a'));
    repository.add(createEntity('entity-b'));

    repository.clear();

    expect(Array.from(repository.entities())).toEqual([]);
  });

  it('ignores entities without a valid id and handles primitives safely', () => {
    repository.add(createEntity('', { name: 'MissingId' }));
    repository.add('not-an-object');

    expect(repository.has('')).toBe(false);
    expect(repository.get('')).toBeUndefined();
    expect(Array.from(repository.entities())).toEqual([]);
  });

  it('delegates invalid lookup identifiers to the underlying map manager', () => {
    expect(repository.get(undefined)).toBeUndefined();
    expect(repository.has(undefined)).toBe(false);
    expect(repository.remove(undefined)).toBe(false);
  });
});
