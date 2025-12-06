import { describe, it, expect, beforeEach } from '@jest/globals';

import BodyGraphService, {
  LIMB_DETACHED_EVENT_ID,
} from '../../../src/anatomy/bodyGraphService.js';
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

const createLogger = () => {
  const messages = {
    debug: [],
    info: [],
    warn: [],
    error: [],
  };

  const capture =
    (level) =>
    (...args) => {
      const rendered = args
        .map((value) =>
          typeof value === 'string' ? value : JSON.stringify(value)
        )
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
      return null;
    }
    return new InMemoryEntityInstance(this, entityId);
  }
}

const createBodyComponent = () => ({
  recipeId: 'humanoid.basic',
  body: {
    root: 'actor',
  },
  structure: {
    rootPartId: 'torso',
    parts: {
      torso: {
        children: ['leftArm', 'head'],
        partType: 'torso',
      },
      leftArm: {
        children: ['leftHand'],
        partType: 'arm',
      },
      leftHand: {
        children: [],
        partType: 'hand',
      },
      head: {
        children: [],
        partType: 'head',
      },
    },
  },
});

const createServiceFixture = () => {
  const logger = createLogger();
  const dispatcher = new RecordingDispatcher();
  const bodyComponent = createBodyComponent();

  const entityManager = new InMemoryEntityManager({
    actor: {
      'anatomy:body': bodyComponent,
    },
    torso: {
      'anatomy:part': { subType: 'torso' },
      'anatomy:joint': { parentId: 'actor', socketId: 'spine' },
    },
    leftArm: {
      'anatomy:part': { subType: 'arm' },
      'anatomy:joint': { parentId: 'torso', socketId: 'shoulder-left' },
    },
    leftHand: {
      'anatomy:part': { subType: 'hand' },
      'anatomy:joint': { parentId: 'leftArm', socketId: 'wrist-left' },
      'sensors:touch': {
        level: 'sensitive',
        metadata: { intensity: 'high' },
      },
    },
    head: {
      'anatomy:part': { subType: 'head' },
      'anatomy:joint': { parentId: 'torso', socketId: 'neck' },
    },
  });

  const service = new BodyGraphService({
    entityManager,
    logger,
    eventDispatcher: dispatcher,
  });

  return { service, entityManager, logger, dispatcher, bodyComponent };
};

describe('BodyGraphService dependency validation and cache integrity', () => {
  let logger;
  let dispatcher;

  beforeEach(() => {
    logger = createLogger();
    dispatcher = new RecordingDispatcher();
  });

  it('throws informative errors when required dependencies are missing', () => {
    expect(
      () =>
        new BodyGraphService({
          logger,
          eventDispatcher: dispatcher,
        })
    ).toThrow(new InvalidArgumentError('entityManager is required'));

    const entityManagerOnly = new InMemoryEntityManager();

    expect(
      () =>
        new BodyGraphService({
          entityManager: entityManagerOnly,
          logger,
        })
    ).toThrow(new InvalidArgumentError('eventDispatcher is required'));

    const dispatcherOnly = new RecordingDispatcher();

    expect(
      () =>
        new BodyGraphService({
          entityManager: entityManagerOnly,
          eventDispatcher: dispatcherOnly,
        })
    ).toThrow(new InvalidArgumentError('logger is required'));
  });

  it('validates cached anatomy state against the live entity manager', async () => {
    const { service, entityManager } = createServiceFixture();

    await service.buildAdjacencyCache('actor');

    const healthy = service.validateCache();
    expect(healthy).toEqual({ valid: true, issues: [] });

    await entityManager.removeComponent('leftHand', 'anatomy:joint');

    const drift = service.validateCache();
    expect(drift.valid).toBe(false);
    expect(drift.issues).toEqual(
      expect.arrayContaining([
        "Entity 'leftHand' in cache has parent but no joint component",
      ])
    );
  });

  it('keeps cache, queries, and anatomy helpers in sync during detach operations', async () => {
    const {
      service,
      entityManager,
      bodyComponent,
      dispatcher: recordingDispatcher,
    } = createServiceFixture();

    await service.buildAdjacencyCache('actor');
    expect(service.hasCache('actor')).toBe(true);

    const bodyGraph = await service.getBodyGraph('actor');
    expect(bodyGraph.getConnectedParts('torso')).toEqual(['leftArm', 'head']);
    expect(bodyGraph.getConnectedParts('leftHand')).toEqual([]);
    expect(bodyGraph.getConnectedParts('missing')).toEqual([]);

    const touchLookup = service.hasPartWithComponentValue(
      bodyComponent,
      'sensors:touch',
      'metadata.intensity',
      'high'
    );
    expect(touchLookup).toEqual({ found: true, partId: 'leftHand' });

    const missingValueLookup = service.hasPartWithComponentValue(
      bodyComponent,
      'sensors:touch',
      'metadata.missing',
      'none'
    );
    expect(missingValueLookup).toEqual({ found: false });

    await expect(service.getAnatomyData('torso')).resolves.toBeNull();

    const detachResult = await service.detachPart('leftHand');
    expect(detachResult).toMatchObject({
      detached: ['leftHand'],
      parentId: 'leftArm',
      socketId: 'wrist-left',
    });

    expect(recordingDispatcher.events[0]).toMatchObject({
      eventId: LIMB_DETACHED_EVENT_ID,
      payload: expect.objectContaining({ detachedEntityId: 'leftHand' }),
    });

    expect(service.hasCache('actor')).toBe(false);

    const postDetachValidation = service.validateCache();
    expect(postDetachValidation).toEqual({ valid: true, issues: [] });

    entityManager.setComponent('actor', 'anatomy:body', {
      body: { root: 'actor' },
    });
    await expect(service.getAnatomyData('actor')).resolves.toEqual({
      recipeId: null,
      rootEntityId: 'actor',
    });
  });
});
