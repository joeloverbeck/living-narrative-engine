import { describe, expect, it, jest } from '@jest/globals';
import BodyGraphService from '../../../src/anatomy/bodyGraphService.js';

class InMemoryEntityManager {
  constructor() {
    /** @type {Map<string, Map<string, any>>} */
    this.entities = new Map();
    /** @type {Map<string, Map<string, { id: string }>>} */
    this.componentIndex = new Map();
  }

  #ensureEntity(entityId) {
    if (!this.entities.has(entityId)) {
      this.entities.set(entityId, new Map());
    }
  }

  #clone(value) {
    if (value === null || value === undefined) {
      return value;
    }
    if (typeof structuredClone === 'function') {
      return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
  }

  addComponent(entityId, componentId, data) {
    this.#ensureEntity(entityId);
    this.entities.get(entityId).set(componentId, this.#clone(data));
    if (!this.componentIndex.has(componentId)) {
      this.componentIndex.set(componentId, new Map());
    }
    this.componentIndex.get(componentId).set(entityId, { id: entityId });
  }

  updateComponent(entityId, componentId, data) {
    this.addComponent(entityId, componentId, data);
  }

  async removeComponent(entityId, componentId) {
    const entity = this.entities.get(entityId);
    if (entity) {
      entity.delete(componentId);
    }
    const index = this.componentIndex.get(componentId);
    if (index) {
      index.delete(entityId);
      if (index.size === 0) {
        this.componentIndex.delete(componentId);
      }
    }
  }

  getComponentData(entityId, componentId) {
    const entity = this.entities.get(entityId);
    if (!entity) {
      return null;
    }
    const component = entity.get(componentId);
    return component !== undefined ? this.#clone(component) : null;
  }

  getEntitiesWithComponent(componentId) {
    const index = this.componentIndex.get(componentId);
    if (!index) {
      return [];
    }
    return Array.from(index.values()).map((entry) => ({ ...entry }));
  }

  getEntityInstance(entityId) {
    if (!this.entities.has(entityId)) {
      throw new Error(`Entity ${entityId} not found`);
    }
    return {
      id: entityId,
      getComponentData: (componentId) =>
        this.getComponentData(entityId, componentId),
    };
  }
}

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createEventDispatcher = () => ({
  dispatch: jest.fn().mockResolvedValue(undefined),
});

/**
 *
 */
async function createFixture() {
  const entityManager = new InMemoryEntityManager();
  const logger = createLogger();
  const eventDispatcher = createEventDispatcher();

  const service = new BodyGraphService({
    entityManager,
    logger,
    eventDispatcher,
  });

  const blueprintIds = {
    root: 'blueprint-actor',
    torso: 'blueprint-torso',
    leg: 'blueprint-leg',
  };

  const actorIds = {
    actor: 'actor-instance',
    torso: 'actor-torso',
    leg: 'actor-leg',
  };

  entityManager.addComponent(blueprintIds.root, 'anatomy:body', {
    recipeId: 'blueprint:android',
    structure: { rootPartId: blueprintIds.torso },
  });
  entityManager.addComponent(blueprintIds.torso, 'anatomy:part', {
    subType: 'torso',
  });
  entityManager.addComponent(blueprintIds.torso, 'anatomy:joint', {
    parentId: blueprintIds.root,
    socketId: 'core',
  });
  entityManager.addComponent(blueprintIds.leg, 'anatomy:part', {
    subType: 'leg',
  });
  entityManager.addComponent(blueprintIds.leg, 'anatomy:joint', {
    parentId: blueprintIds.torso,
    socketId: 'left-hip',
  });

  entityManager.addComponent(actorIds.actor, 'anatomy:body', {
    recipeId: 'actor:android',
    body: { root: actorIds.torso },
    structure: { rootPartId: actorIds.torso },
  });
  entityManager.addComponent(actorIds.torso, 'anatomy:part', {
    subType: 'torso',
  });
  entityManager.addComponent(actorIds.torso, 'anatomy:joint', {
    parentId: actorIds.actor,
    socketId: 'core',
  });
  entityManager.addComponent(actorIds.leg, 'anatomy:part', { subType: 'leg' });
  entityManager.addComponent(actorIds.leg, 'anatomy:joint', {
    parentId: actorIds.torso,
    socketId: 'left-hip',
  });

  await service.buildAdjacencyCache(blueprintIds.root);
  await service.buildAdjacencyCache(actorIds.actor);

  return {
    service,
    logger,
    actorId: actorIds.actor,
    blueprintStructure: { root: blueprintIds.root },
    actorPartIds: [actorIds.actor, actorIds.torso, actorIds.leg],
    blueprintPartIds: [blueprintIds.root, blueprintIds.torso, blueprintIds.leg],
  };
}

describe('BodyGraphService integration – bodyComponent.root branch coverage', () => {
  it('covers missing body components and direct root structures', async () => {
    const {
      service,
      logger,
      actorId,
      blueprintStructure,
      actorPartIds,
      blueprintPartIds,
    } = await createFixture();

    logger.debug.mockClear();
    expect(service.getAllParts(null)).toEqual([]);
    expect(logger.debug).toHaveBeenCalledWith(
      'BodyGraphService.getAllParts: No bodyComponent provided'
    );

    logger.debug.mockClear();
    const blueprintParts = service.getAllParts(blueprintStructure);
    expect(new Set(blueprintParts)).toEqual(new Set(blueprintPartIds));
    expect(logger.debug).toHaveBeenCalledWith(
      `BodyGraphService.getAllParts: Found root ID in bodyComponent.root: ${blueprintStructure.root}`
    );

    logger.debug.mockClear();
    const actorParts = service.getAllParts(blueprintStructure, actorId);
    expect(new Set(actorParts)).toEqual(new Set(actorPartIds));
    expect(
      logger.debug.mock.calls.some(([message]) =>
        message.startsWith(
          `BodyGraphService.getAllParts: Actor '${actorId}' -> Using actor as cache root (blueprint root was '${blueprintStructure.root}'`
        )
      )
    ).toBe(true);
  });
});
