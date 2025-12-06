/**
 * @file Integration tests for entityFetchHelpers validating interactions with
 * real entity access services and error types.
 */

import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import {
  fetchEntity,
  withEntity,
} from '../../../../src/utils/entityFetchHelpers.js';
import { InvalidEntityIdError } from '../../../../src/errors/invalidEntityIdError.js';

class TestEntity {
  constructor(id, components = {}) {
    this.id = id;
    this._components = components;
  }

  getComponentData(componentId) {
    return this._components[componentId];
  }
}

class TestEntityManager {
  constructor() {
    this._entities = new Map();
  }

  addEntity(entity) {
    this._entities.set(entity.id, entity);
  }

  getEntityInstance(id) {
    if (id === 'boom') {
      throw new Error('intentional failure');
    }
    return this._entities.get(id) ?? null;
  }

  getComponentData(id, componentId) {
    const entity = this._entities.get(id);
    return entity ? entity.getComponentData(componentId) : undefined;
  }
}

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('entityFetchHelpers integration', () => {
  let entityManager;
  let logger;

  beforeEach(() => {
    entityManager = new TestEntityManager();
    logger = createLogger();
  });

  it('resolves entities by id using the shared entityAccessService', () => {
    const hero = new TestEntity('hero-1', {
      'core:name': { displayName: 'Hero' },
    });
    entityManager.addEntity(hero);

    const resolved = fetchEntity(entityManager, 'hero-1');

    expect(resolved).toBe(hero);
    expect(resolved.getComponentData('core:name')).toEqual({
      displayName: 'Hero',
    });
  });

  it('resolves direct entity references without consulting the entity manager', () => {
    const npc = new TestEntity('npc-2', {
      'core:name': { displayName: 'Guide' },
    });

    const resolved = fetchEntity(entityManager, npc);

    expect(resolved).toBe(npc);
  });

  it('throws InvalidEntityIdError when fetchEntity receives an empty identifier', () => {
    expect(() => fetchEntity(entityManager, '')).toThrow(InvalidEntityIdError);

    try {
      fetchEntity(entityManager, null);
      throw new Error('Expected fetchEntity to throw for null entityId');
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidEntityIdError);
      expect(error).toMatchObject({ entityId: null });
      expect(error.getSeverity()).toBe('warning');
    }
  });

  it('returns fallback and logs a warning when withEntity receives a null id', () => {
    const fallbackValue = Symbol('no entity');
    const callback = jest.fn();

    const result = withEntity(
      entityManager,
      null,
      fallbackValue,
      callback,
      logger,
      '[Test]'
    );

    expect(result).toBe(fallbackValue);
    expect(callback).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      '[Test] fetchEntity called with null or empty entityId.'
    );
  });

  it('returns fallback and logs the provided notFound message when the entity is missing', () => {
    const result = withEntity(
      entityManager,
      'missing-entity',
      'fallback',
      () => 'unreachable',
      logger,
      '[Missing]',
      'Entity missing during lookup.'
    );

    expect(result).toBe('fallback');
    expect(logger.debug).toHaveBeenCalledWith(
      '[Missing] Entity missing during lookup.'
    );
  });

  it('executes the callback when the entity exists and returns its result', () => {
    const entity = new TestEntity('npc-4', {
      'core:name': { displayName: 'Archivist' },
    });
    entityManager.addEntity(entity);

    const outcome = withEntity(
      entityManager,
      'npc-4',
      null,
      (resolved) => resolved.getComponentData('core:name').displayName,
      logger,
      '[Callback]'
    );

    expect(outcome).toBe('Archivist');
  });

  it('rethrows unexpected errors from fetchEntity to surface real failures', () => {
    expect(() =>
      withEntity(
        entityManager,
        'boom',
        null,
        () => 'should not run',
        logger,
        '[Crash]'
      )
    ).toThrow('intentional failure');
  });
});
