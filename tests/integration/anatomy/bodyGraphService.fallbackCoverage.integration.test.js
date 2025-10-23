import { beforeEach, describe, expect, it } from '@jest/globals';

import BodyGraphService from '../../../src/anatomy/bodyGraphService.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

class RecordingDispatcher {
  constructor() {
    this.events = [];
  }

  async dispatch(eventId, payload) {
    this.events.push({ eventId, payload });
    return true;
  }
}

class InMemoryEntityInstance {
  constructor(manager, entityId) {
    this.#manager = manager;
    this.#entityId = entityId;
  }

  #manager;
  #entityId;

  getComponentData(componentId) {
    return this.#manager.getComponentData(this.#entityId, componentId);
  }
}

class InMemoryEntityManager {
  constructor(initialEntities = {}) {
    this.entities = new Map();
    Object.entries(initialEntities).forEach(([entityId, components]) => {
      const componentMap = new Map();
      Object.entries(components).forEach(([componentId, value]) => {
        componentMap.set(componentId, value);
      });
      this.entities.set(entityId, componentMap);
    });
  }

  entities;

  setComponent(entityId, componentId, value) {
    if (!this.entities.has(entityId)) {
      this.entities.set(entityId, new Map());
    }
    this.entities.get(entityId).set(componentId, value);
  }

  getComponentData(entityId, componentId) {
    if (!this.entities.has(entityId)) {
      return null;
    }
    const value = this.entities.get(entityId).get(componentId);
    return value === undefined ? null : value;
  }

  async removeComponent(entityId, componentId) {
    if (this.entities.has(entityId)) {
      this.entities.get(entityId).delete(componentId);
    }
  }

  getEntitiesWithComponent(componentId) {
    const results = [];
    for (const [entityId, components] of this.entities.entries()) {
      if (components.has(componentId)) {
        results.push({ id: entityId });
      }
    }
    return results;
  }

  getEntityInstance(entityId) {
    if (!this.entities.has(entityId)) {
      throw new Error(`Entity '${entityId}' not found`);
    }
    return new InMemoryEntityInstance(this, entityId);
  }
}

const createLogger = () => {
  const messages = {
    debug: [],
    info: [],
    warn: [],
    error: [],
  };
  const capture = (level) => (...args) => {
    const rendered = args
      .map((value) => (typeof value === 'string' ? value : JSON.stringify(value)))
      .join(' ');
    messages[level].push(rendered);
  };
  return {
    messages,
    debug: capture('debug'),
    info: capture('info'),
    warn: capture('warn'),
    error: capture('error'),
  };
};

describe('BodyGraphService fallback coverage integration', () => {
  let entityManager;
  let logger;
  let dispatcher;
  let service;
  let bodyComponent;

  beforeEach(async () => {
    logger = createLogger();
    dispatcher = new RecordingDispatcher();

    bodyComponent = {
      recipeId: 'humanoid.coverage',
      body: { root: 'torso' },
      structure: {
        rootPartId: 'torso',
        parts: {
          torso: { children: ['leftArm', 'head'], partType: 'torso' },
          leftArm: { children: [], partType: 'arm' },
          head: { children: [], partType: 'head' },
        },
      },
    };

    const noRecipeBody = {
      body: { root: 'noRecipeTorso' },
      structure: {
        rootPartId: 'noRecipeTorso',
        parts: {
          noRecipeTorso: { children: [], partType: 'torso' },
        },
      },
    };

    entityManager = new InMemoryEntityManager({
      actor: {
        'anatomy:body': bodyComponent,
      },
      torso: {
        'anatomy:part': { subType: 'torso' },
        'anatomy:joint': { parentId: 'actor', socketId: 'torso-root' },
      },
      leftArm: {
        'anatomy:part': { subType: 'arm' },
        'anatomy:joint': { parentId: 'torso', socketId: 'shoulder-left' },
        'custom:decor': { details: { marking: 'tattoo' } },
      },
      head: {
        'anatomy:part': { subType: 'head' },
        'anatomy:joint': { parentId: 'torso', socketId: 'neck' },
      },
      floatingPart: {
        'anatomy:part': { subType: 'drone' },
        'anatomy:joint': { parentId: null, socketId: 'floating' },
      },
      noRecipeActor: {
        'anatomy:body': noRecipeBody,
      },
      noRecipeTorso: {
        'anatomy:part': { subType: 'torso' },
        'anatomy:joint': { parentId: 'noRecipeActor', socketId: 'core' },
      },
    });

    service = new BodyGraphService({
      entityManager,
      logger,
      eventDispatcher: dispatcher,
    });

    await service.buildAdjacencyCache('actor');
  });

  it('covers fallback branches and cache validation behaviours', async () => {
    const detachResult = await service.detachPart('floatingPart', {
      cascade: false,
      reason: 'calibration',
    });

    expect(detachResult).toEqual({
      detached: ['floatingPart'],
      parentId: null,
      socketId: 'floating',
    });
    expect(service.hasCache('actor')).toBe(true);
    expect(dispatcher.events.at(-1)).toEqual(
      expect.objectContaining({
        payload: expect.objectContaining({
          detachedEntityId: 'floatingPart',
          reason: 'calibration',
          detachedCount: 1,
        }),
      })
    );

    const graph = await service.getBodyGraph('actor');
    expect(graph.getConnectedParts('missing-node')).toEqual([]);

    expect(service.getChildren('missing-node')).toEqual([]);
    expect(service.getParent('missing-node')).toBeNull();

    expect(
      service.hasPartWithComponentValue(
        bodyComponent,
        'custom:decor',
        'details.pattern',
        'striped'
      )
    ).toEqual({ found: false });

    expect(service.getAllParts({ body: { root: 'unknown-root' } })).toEqual([]);

    await service.buildAdjacencyCache('noRecipeActor');
    const anatomyData = await service.getAnatomyData('noRecipeActor');
    expect(anatomyData).toEqual({ recipeId: null, rootEntityId: 'noRecipeActor' });

    const validation = service.validateCache();
    expect(validation.valid).toBe(true);
    expect(Array.isArray(validation.issues)).toBe(true);
  });

  it('enforces constructor dependency guards', () => {
    expect(
      () => new BodyGraphService({ logger, eventDispatcher: dispatcher })
    ).toThrow(InvalidArgumentError);

    expect(
      () => new BodyGraphService({ entityManager, eventDispatcher: dispatcher })
    ).toThrow('logger is required');

    expect(() => new BodyGraphService({ entityManager, logger })).toThrow(
      'eventDispatcher is required'
    );
  });
});
