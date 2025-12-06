import { describe, it, expect, beforeEach, jest } from '@jest/globals';

jest.mock('../../../src/entities/entityAccessService.js', () => ({
  resolveEntity: jest.fn(),
}));

import {
  fetchEntity,
  withEntity,
} from '../../../src/utils/entityFetchHelpers.js';
import { resolveEntity } from '../../../src/entities/entityAccessService.js';
import { InvalidEntityIdError } from '../../../src/errors/invalidEntityIdError.js';

describe('entityFetchHelpers', () => {
  let entityManager;
  let logger;
  let callback;

  beforeEach(() => {
    entityManager = { getEntityInstance: jest.fn() };
    logger = {
      debug: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
    };
    callback = jest.fn();
    resolveEntity.mockReset();
  });

  describe('fetchEntity', () => {
    it('throws InvalidEntityIdError when entityId is falsy', () => {
      expect(() => fetchEntity(entityManager, '')).toThrow(
        InvalidEntityIdError
      );
      expect(resolveEntity).not.toHaveBeenCalled();
    });

    it('delegates to resolveEntity for valid identifiers', () => {
      const entity = { id: 'npc:1' };
      resolveEntity.mockReturnValue(entity);

      const result = fetchEntity(entityManager, 'npc:1');

      expect(resolveEntity).toHaveBeenCalledWith('npc:1', entityManager);
      expect(result).toBe(entity);
    });
  });

  describe('withEntity', () => {
    it('returns fallback and logs a warning when the identifier is invalid', () => {
      const fallback = Symbol('fallback');

      const result = withEntity(
        entityManager,
        null,
        fallback,
        callback,
        logger,
        '[Test]'
      );

      expect(result).toBe(fallback);
      expect(logger.warn).toHaveBeenCalledWith(
        '[Test] fetchEntity called with null or empty entityId.'
      );
      expect(callback).not.toHaveBeenCalled();
      expect(resolveEntity).not.toHaveBeenCalled();
    });

    it('returns fallback and logs debug details when the entity cannot be found', () => {
      resolveEntity.mockReturnValue(null);
      const fallback = { id: 'fallback' };

      const result = withEntity(
        entityManager,
        'missing-entity',
        fallback,
        callback,
        logger,
        '[Test]',
        'No entity resolved.'
      );

      expect(resolveEntity).toHaveBeenCalledWith(
        'missing-entity',
        entityManager
      );
      expect(logger.debug).toHaveBeenCalledWith('[Test] No entity resolved.');
      expect(result).toBe(fallback);
      expect(callback).not.toHaveBeenCalled();
    });

    it('returns fallback without emitting debug logs when no notFound message is provided', () => {
      resolveEntity.mockReturnValue(null);
      const fallback = 'default-value';

      const result = withEntity(
        entityManager,
        'missing-entity',
        fallback,
        callback,
        logger,
        '[Test]'
      );

      expect(resolveEntity).toHaveBeenCalledWith(
        'missing-entity',
        entityManager
      );
      expect(logger.debug).not.toHaveBeenCalled();
      expect(result).toBe(fallback);
      expect(callback).not.toHaveBeenCalled();
    });

    it('invokes the callback with the resolved entity and returns its value', () => {
      const entity = { id: 'npc:2' };
      resolveEntity.mockReturnValue(entity);
      callback.mockImplementation((resolved) => `entity:${resolved.id}`);

      const result = withEntity(
        entityManager,
        'npc:2',
        'fallback',
        callback,
        logger,
        '[Test]'
      );

      expect(callback).toHaveBeenCalledWith(entity);
      expect(result).toBe('entity:npc:2');
      expect(logger.warn).not.toHaveBeenCalled();
      expect(logger.debug).not.toHaveBeenCalled();
    });

    it('rethrows unexpected errors from resolveEntity', () => {
      const unexpected = new Error('lookup failed');
      resolveEntity.mockImplementation(() => {
        throw unexpected;
      });

      expect(() =>
        withEntity(
          entityManager,
          'npc:broken',
          'fallback',
          callback,
          logger,
          '[Test]'
        )
      ).toThrow(unexpected);
    });
  });
});
