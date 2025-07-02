import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import EntityRepositoryAdapter from '../../../../src/entities/services/entityRepositoryAdapter.js';
import { DuplicateEntityError } from '../../../../src/errors/duplicateEntityError.js';
import { EntityNotFoundError } from '../../../../src/errors/entityNotFoundError.js';

const createLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

describe('EntityRepositoryAdapter', () => {
  let repo;
  let logger;
  let entity;

  beforeEach(() => {
    logger = createLogger();
    repo = new EntityRepositoryAdapter({ logger });
    entity = { id: 'e1' };
  });

  it('adds and retrieves entities', () => {
    repo.add(entity);
    expect(repo.get('e1')).toBe(entity);
  });

  it('throws on duplicate add', () => {
    repo.add(entity);
    expect(() => repo.add(entity)).toThrow(DuplicateEntityError);
    expect(logger.error).toHaveBeenCalled();
  });

  it('removes existing entity', () => {
    repo.add(entity);
    expect(repo.remove('e1')).toBe(true);
  });

  it('throws when removing missing entity', () => {
    expect(() => repo.remove('missing')).toThrow(EntityNotFoundError);
    expect(logger.error).toHaveBeenCalled();
  });

  it('clears all entities', () => {
    repo.add(entity);
    repo.add({ id: 'e2' });
    repo.clear();
    expect(logger.info).toHaveBeenCalled();
  });
});
