import { beforeEach, describe, expect, it } from '@jest/globals';
import BodyGraphService from '../../../src/anatomy/bodyGraphService.js';

class RecordingLogger {
  constructor() {
    this.debugEntries = [];
    this.infoEntries = [];
    this.warnEntries = [];
    this.errorEntries = [];
  }

  debug(...args) {
    this.debugEntries.push(args);
  }

  info(...args) {
    this.infoEntries.push(args);
  }

  warn(...args) {
    this.warnEntries.push(args);
  }

  error(...args) {
    this.errorEntries.push(args);
  }
}

class RecordingEventDispatcher {
  constructor() {
    this.events = [];
  }

  async dispatch(eventId, payload, options) {
    this.events.push({ eventId, payload, options });
    return true;
  }
}

class TestEntityManager {
  constructor() {
    this.entities = new Map();
  }

  addEntity(entityId, components = {}) {
    const snapshot =
      typeof structuredClone === 'function'
        ? structuredClone(components)
        : JSON.parse(JSON.stringify(components));
    this.entities.set(entityId, snapshot);
  }

  setComponent(entityId, componentId, value) {
    if (!this.entities.has(entityId)) {
      this.entities.set(entityId, {});
    }
    this.entities.get(entityId)[componentId] =
      typeof structuredClone === 'function'
        ? structuredClone(value)
        : JSON.parse(JSON.stringify(value));
  }

  getComponentData(entityId, componentId) {
    const entity = this.entities.get(entityId);
    if (!entity) return null;
    return Object.prototype.hasOwnProperty.call(entity, componentId)
      ? entity[componentId]
      : null;
  }

  getEntitiesWithComponent(componentId) {
    const results = [];
    for (const [entityId, components] of this.entities.entries()) {
      if (Object.prototype.hasOwnProperty.call(components, componentId)) {
        results.push({ id: entityId });
      }
    }
    return results;
  }

  getEntityInstance(entityId) {
    const components = this.entities.get(entityId);
    if (!components) {
      throw new Error(`Entity ${entityId} not found`);
    }
    return {
      id: entityId,
      getComponentData: (componentId) =>
        this.getComponentData(entityId, componentId),
    };
  }

  async removeComponent(entityId, componentId) {
    const components = this.entities.get(entityId);
    if (
      components &&
      Object.prototype.hasOwnProperty.call(components, componentId)
    ) {
      delete components[componentId];
    }
  }
}

const addPart = (entityManager, entityId, { subType, parentId, socketId }) => {
  entityManager.addEntity(entityId, {
    'anatomy:part': { subType },
    'anatomy:joint': { parentId, socketId },
  });
};

describe('AnatomyCacheManager integration fallback coverage', () => {
  let entityManager;
  let logger;
  let eventDispatcher;
  let service;
  let actorBodyComponent;

  beforeEach(() => {
    entityManager = new TestEntityManager();
    logger = new RecordingLogger();
    eventDispatcher = new RecordingEventDispatcher();

    entityManager.addEntity('actor-1', {
      'core:name': { text: 'Disconnected Actor' },
      'anatomy:body': {
        recipeId: 'humanoid_disconnected',
        body: { root: 'torso-root' },
        // intentionally omit structure.rootPartId to force fallback logic
      },
    });

    // Root part with no parent so the cache manager must discover it.
    addPart(entityManager, 'torso-root', {
      subType: 'torso',
      parentId: undefined,
      socketId: 'root-socket',
    });
    addPart(entityManager, 'arm-left', {
      subType: 'arm',
      parentId: 'torso-root',
      socketId: 'left-shoulder',
    });
    addPart(entityManager, 'hand-left', {
      subType: 'hand',
      parentId: 'arm-left',
      socketId: 'left-wrist',
    });
    addPart(entityManager, 'arm-right', {
      subType: 'arm',
      parentId: 'torso-root',
      socketId: 'right-shoulder',
    });
    addPart(entityManager, 'hand-right', {
      subType: 'hand',
      parentId: 'arm-right',
      socketId: 'right-wrist',
    });

    service = new BodyGraphService({
      entityManager,
      logger,
      eventDispatcher,
    });

    actorBodyComponent = entityManager.getComponentData(
      'actor-1',
      'anatomy:body'
    );
  });

  it('links disconnected actor anatomies and rebuilds caches when structure data is missing', async () => {
    expect(service.getChildren('actor-1')).toEqual([]);

    await service.buildAdjacencyCache('actor-1');

    expect(service.getChildren('actor-1')).toEqual(['torso-root']);
    expect(service.getChildren('torso-root')).toEqual(
      expect.arrayContaining(['arm-left', 'arm-right'])
    );
    expect(service.getChildren('arm-left')).toEqual(['hand-left']);
    expect(service.getChildren('arm-right')).toEqual(['hand-right']);

    expect(service.getAncestors('hand-left')).toEqual([
      'arm-left',
      'torso-root',
      'actor-1',
    ]);

    const firstTraversal = service.getAllParts(actorBodyComponent, 'actor-1');
    expect(firstTraversal).toEqual(
      expect.arrayContaining([
        'actor-1',
        'torso-root',
        'arm-left',
        'hand-left',
        'arm-right',
        'hand-right',
      ])
    );

    // Cached results should be reused until the cache is rebuilt.
    expect(service.getAllParts(actorBodyComponent, 'actor-1')).toBe(
      firstTraversal
    );
    expect(service.hasCache('actor-1')).toBe(true);

    // Ensure the fallback logging occurred for the disconnected actor scenario.
    expect(
      logger.debugEntries.some(
        ([message]) =>
          typeof message === 'string' &&
          message.includes(
            "Actor entity 'actor-1' has anatomy:body but no joint children"
          )
      )
    ).toBe(true);
    expect(
      logger.infoEntries.some(
        ([message]) =>
          typeof message === 'string' &&
          message.includes(
            "Successfully connected actor 'actor-1' to its own anatomy root 'torso-root'"
          )
      )
    ).toBe(true);

    // Add a new limb and rebuild to cover cache invalidation and rebuilding.
    addPart(entityManager, 'arm-center', {
      subType: 'arm',
      parentId: 'torso-root',
      socketId: 'center-shoulder',
    });

    await service.buildAdjacencyCache('actor-1');

    const cacheValidation = service.validateCache();
    expect(cacheValidation.valid).toBe(false);
    expect(cacheValidation.issues).toEqual(
      expect.arrayContaining([
        "Parent mismatch for 'torso-root': cache says 'actor-1', joint says 'undefined'",
      ])
    );

    // Instantiate a fresh service to validate rebuilt adjacency and traversal results.
    const verificationLogger = new RecordingLogger();
    const verificationDispatcher = new RecordingEventDispatcher();
    const verificationService = new BodyGraphService({
      entityManager,
      logger: verificationLogger,
      eventDispatcher: verificationDispatcher,
    });

    await verificationService.buildAdjacencyCache('actor-1');

    expect(verificationService.getChildren('torso-root')).toEqual(
      expect.arrayContaining(['arm-left', 'arm-right', 'arm-center'])
    );

    const rebuiltTraversal = verificationService.getAllParts(
      entityManager.getComponentData('actor-1', 'anatomy:body'),
      'actor-1'
    );
    expect(rebuiltTraversal).toEqual(
      expect.arrayContaining([
        'actor-1',
        'torso-root',
        'arm-left',
        'hand-left',
        'arm-right',
        'hand-right',
        'arm-center',
      ])
    );
  });
});
