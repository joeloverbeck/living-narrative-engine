import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import BodyGraphService from '../../../src/anatomy/bodyGraphService.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

/**
 * @description Creates a logger stub compatible with the engine logging interface.
 * @returns {{debug: jest.Mock, info: jest.Mock, warn: jest.Mock, error: jest.Mock}}
 */
function createLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

/**
 * @description Creates a minimal event dispatcher stub.
 * @returns {{dispatch: jest.Mock}}
 */
function createEventDispatcher() {
  return {
    dispatch: jest.fn().mockResolvedValue(undefined),
  };
}

/**
 * @description Lightweight entity manager implementation used to exercise BodyGraphService end-to-end.
 */
class InMemoryEntityManager {
  /**
   * @description Initializes the manager with optional preloaded entities.
   * @param {Record<string, Record<string, any>>} [initialEntities] Entities to seed the manager with.
   */
  constructor(initialEntities = {}) {
    /** @type {Map<string, Record<string, any>>} */
    this.entities = new Map();
    Object.entries(initialEntities).forEach(([entityId, components]) => {
      this.entities.set(entityId, { ...components });
    });
  }

  /**
   * @description Adds or replaces an entity definition.
   * @param {string} entityId Identifier of the entity to store.
   * @param {Record<string, any>} components Component map for the entity.
   * @returns {void}
   */
  addEntity(entityId, components) {
    this.entities.set(entityId, { ...components });
  }

  /**
   * @description Retrieves component data for a given entity.
   * @param {string} entityId Identifier of the entity to query.
   * @param {string} componentId Component identifier to fetch.
   * @returns {any} Component data or null when absent.
   */
  getComponentData(entityId, componentId) {
    const entity = this.entities.get(entityId);
    if (!entity) {
      return null;
    }
    return Object.prototype.hasOwnProperty.call(entity, componentId)
      ? entity[componentId]
      : null;
  }

  /**
   * @description Removes a component from an entity when present.
   * @param {string} entityId Identifier of the entity to mutate.
   * @param {string} componentId Component identifier to remove.
   * @returns {Promise<void>} Resolves once the mutation completes.
   */
  async removeComponent(entityId, componentId) {
    const entity = this.entities.get(entityId);
    if (entity && Object.prototype.hasOwnProperty.call(entity, componentId)) {
      delete entity[componentId];
    }
  }

  /**
   * @description Produces a lightweight entity instance for tests that need it.
   * @param {string} entityId Identifier of the entity to retrieve.
   * @returns {{id: string, getComponentData: (componentId: string) => any, hasComponent: (componentId: string) => boolean}}
   */
  getEntityInstance(entityId) {
    if (!this.entities.has(entityId)) {
      throw new Error(`Entity ${entityId} not found`);
    }
    return {
      id: entityId,
      getComponentData: (componentId) =>
        this.getComponentData(entityId, componentId),
      hasComponent: (componentId) =>
        this.getComponentData(entityId, componentId) !== null,
    };
  }

  /**
   * @description Lists entities that currently expose the requested component.
   * @param {string} componentId Component identifier to search for.
   * @returns {{id: string, getComponentData: (componentId: string) => any}[]} Matching entity instances.
   */
  getEntitiesWithComponent(componentId) {
    const matches = [];
    for (const [id, components] of this.entities.entries()) {
      if (Object.prototype.hasOwnProperty.call(components, componentId)) {
        matches.push({
          id,
          getComponentData: (requestedId) =>
            this.getComponentData(id, requestedId),
        });
      }
    }
    return matches;
  }
}

/**
 * @description Seeds a compact anatomy graph used to exercise additional BodyGraphService branches.
 * @param {InMemoryEntityManager} entityManager Manager that will host the anatomy entities.
 * @returns {{actorId: string, bodyComponent: any, partIds: Record<string, string>}} Actor identifier, body component and part map.
 */
function seedMinimalAnatomy(entityManager) {
  const actorId = 'branch-coverage-actor';
  const partIds = {
    torso: 'branch-torso',
    head: 'branch-head',
  };

  const bodyComponent = {
    body: {
      root: partIds.torso,
      parts: {
        torso: partIds.torso,
        head: partIds.head,
      },
    },
    structure: { rootPartId: partIds.torso },
  };

  entityManager.addEntity(actorId, {
    'anatomy:body': bodyComponent,
  });

  entityManager.addEntity(partIds.torso, {
    'anatomy:part': { subType: 'torso' },
    'anatomy:joint': { parentId: actorId, socketId: 'core' },
  });

  entityManager.addEntity(partIds.head, {
    'anatomy:part': { subType: 'head' },
    'anatomy:joint': { parentId: partIds.torso, socketId: 'neck' },
    'custom:status': { metadata: {} },
  });

  return { actorId, bodyComponent, partIds };
}

describe('BodyGraphService integration error handling', () => {
  let entityManager;
  let logger;
  let eventDispatcher;
  let service;

  beforeEach(() => {
    entityManager = new InMemoryEntityManager();
    logger = createLogger();
    eventDispatcher = createEventDispatcher();
    service = new BodyGraphService({ entityManager, logger, eventDispatcher });
  });

  it('validates constructor dependencies with real collaborators', () => {
    expect(() => new BodyGraphService({ logger, eventDispatcher })).toThrow(
      InvalidArgumentError
    );
    expect(
      () => new BodyGraphService({ entityManager, eventDispatcher })
    ).toThrow(InvalidArgumentError);
    expect(() => new BodyGraphService({ entityManager, logger })).toThrow(
      InvalidArgumentError
    );
  });

  it('throws informative errors when requesting body graphs with invalid input', async () => {
    await expect(service.getBodyGraph(undefined)).rejects.toThrow(
      InvalidArgumentError
    );

    const actorWithoutBody = 'actor-without-body';
    entityManager.addEntity(actorWithoutBody, {
      'core:name': { text: 'Nameless Husk' },
    });

    await expect(service.getBodyGraph(actorWithoutBody)).rejects.toThrow(
      `Entity ${actorWithoutBody} has no anatomy:body component`
    );
  });

  it('rejects anatomy data requests that omit a valid entity identifier', async () => {
    await expect(service.getAnatomyData('unknown-entity')).resolves.toBeNull();
    await expect(service.getAnatomyData(undefined)).rejects.toThrow(
      InvalidArgumentError
    );
  });

  it('covers branch scenarios for cached traversals and orphan detachments', async () => {
    const { actorId, bodyComponent, partIds } =
      seedMinimalAnatomy(entityManager);

    await service.buildAdjacencyCache(actorId);

    const partsWithActor = service.getAllParts(bodyComponent, actorId);
    expect(partsWithActor.length).toBeLessThanOrEqual(3);

    const cachedParts = service.getAllParts(bodyComponent, actorId);
    expect(cachedParts).toBe(partsWithActor);

    const blueprintParts = service.getAllParts(bodyComponent);
    expect(blueprintParts).toEqual(
      expect.arrayContaining(Object.values(partIds))
    );

    const missingNested = service.hasPartWithComponentValue(
      bodyComponent,
      'custom:status',
      'metadata.undefinedValue',
      'anything'
    );
    expect(missingNested).toEqual({ found: false });

    const graph = await service.getBodyGraph(actorId);
    expect(graph.getConnectedParts(partIds.torso)).toEqual([partIds.head]);
    expect(graph.getConnectedParts('non-existent')).toEqual([]);

    entityManager.addEntity('missing-parent', {
      'anatomy:joint': { parentId: null, socketId: 'rootless' },
    });

    entityManager.addEntity('orphan-limb', {
      'anatomy:part': { subType: 'tentacle' },
      'anatomy:joint': { parentId: 'missing-parent', socketId: 'mystery' },
    });

    const orphanResult = await service.detachPart('orphan-limb', {
      cascade: false,
      reason: 'audit',
    });

    expect(orphanResult).toEqual({
      detached: ['orphan-limb'],
      parentId: 'missing-parent',
      socketId: 'mystery',
    });

    expect(
      entityManager.getComponentData('orphan-limb', 'anatomy:joint')
    ).toBeNull();
    expect(service.hasCache(actorId)).toBe(true);

    await expect(service.getAnatomyData(actorId)).resolves.toEqual({
      recipeId: null,
      rootEntityId: actorId,
    });
  });
});
