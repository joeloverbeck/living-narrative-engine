/**
 * @file Integration tests for EntityQueryManager.findEntities leveraging real entity data
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import EntityDefinition from '../../../src/entities/entityDefinition.js';
import EntityInstanceData from '../../../src/entities/entityInstanceData.js';
import Entity from '../../../src/entities/entity.js';
import EntityRepositoryAdapter from '../../../src/entities/services/entityRepositoryAdapter.js';
import EntityQueryManager from '../../../src/entities/managers/EntityQueryManager.js';
import { createTestBed } from '../../common/testBed.js';

/**
 * Helper to build an entity with definition + optional overrides and register it in the repository.
 * Uses real modules end-to-end so we cover EntityQuery integration instead of isolated unit behavior.
 *
 * @param {object} options - configuration for entity creation
 * @param {string} options.id - instance id for the entity
 * @param {Record<string, object>} options.components - definition component map
 * @param {Record<string, object>} [options.overrides] - optional overrides for the instance
 * @param {EntityRepositoryAdapter} options.repository - entity repository to register with
 * @param {object} options.logger - logger shared between repository and instance data
 * @returns {Entity}
 */
function createEntity({ id, components, overrides = {}, repository, logger }) {
  const definition = new EntityDefinition(`integration:${id}`, {
    description: `Integration entity ${id}`,
    components,
  });

  const instanceData = new EntityInstanceData(
    id,
    definition,
    overrides,
    logger
  );
  const entity = new Entity(instanceData);
  repository.add(entity);
  return entity;
}

describe('EntityQueryManager.findEntities integration', () => {
  let testBed;
  let logger;
  let repository;
  let queryManager;

  beforeEach(() => {
    testBed = createTestBed();
    logger = testBed.createMockLogger();
    repository = new EntityRepositoryAdapter({ logger });
    queryManager = new EntityQueryManager({
      entityRepository: repository,
      logger,
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('applies withAll and withAny filtering across the live entity repository', () => {
    const visibleSitter = createEntity({
      id: 'visible_sitter',
      components: {
        'core:visible': { value: true },
        'sitting:allows_sitting': { spots: [null] },
      },
      repository,
      logger,
    });

    const visibleInventory = createEntity({
      id: 'visible_inventory',
      components: {
        'core:visible': { value: true },
        'core:inventory': { slots: [] },
      },
      repository,
      logger,
    });

    createEntity({
      id: 'hidden_inventory',
      components: {
        'core:hidden': { value: true },
        'core:inventory': { slots: [] },
      },
      repository,
      logger,
    });

    createEntity({
      id: 'visible_plain',
      components: {
        'core:visible': { value: true },
      },
      repository,
      logger,
    });

    const results = queryManager.findEntities({
      withAll: ['core:visible'],
      withAny: ['sitting:allows_sitting', 'core:inventory'],
    });

    expect(results.map((entity) => entity.id).sort()).toEqual(
      [visibleSitter.id, visibleInventory.id].sort()
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('excludes entities containing forbidden components even when they match positive criteria', () => {
    const allowed = createEntity({
      id: 'allowed_sitter',
      components: {
        'core:visible': { value: true },
        'sitting:allows_sitting': { spots: [null, null] },
      },
      repository,
      logger,
    });

    createEntity({
      id: 'hidden_sitter',
      components: {
        'core:visible': { value: true },
        'sitting:allows_sitting': { spots: [null, null, null] },
        'core:hidden': { value: true },
      },
      repository,
      logger,
    });

    const results = queryManager.findEntities({
      withAll: ['core:visible'],
      withAny: ['sitting:allows_sitting'],
      without: ['core:hidden'],
    });

    expect(results.map((entity) => entity.id)).toEqual([allowed.id]);
  });

  it('warns and returns an empty result when no positive conditions are provided', () => {
    createEntity({
      id: 'baseline_entity',
      components: {
        'core:visible': { value: true },
      },
      repository,
      logger,
    });

    const results = queryManager.findEntities({ without: ['core:hidden'] });

    expect(results).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('no "withAll" or "withAny"')
    );
  });
});
