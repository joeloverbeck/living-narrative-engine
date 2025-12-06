import { describe, it, expect, beforeEach } from '@jest/globals';
import BodyGraphService, {
  LIMB_DETACHED_EVENT_ID,
} from '../../../src/anatomy/bodyGraphService.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

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

class IntegrationEntityManager {
  constructor() {
    this.entities = new Map();
  }

  createEntity(entityId, components = {}) {
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
    this.entities.get(entityId)[componentId] = value;
  }

  getComponentData(entityId, componentId) {
    const entity = this.entities.get(entityId);
    if (!entity) return null;
    return Object.prototype.hasOwnProperty.call(entity, componentId)
      ? entity[componentId]
      : null;
  }

  async removeComponent(entityId, componentId) {
    const entity = this.entities.get(entityId);
    if (entity && Object.prototype.hasOwnProperty.call(entity, componentId)) {
      delete entity[componentId];
    }
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
}

const populateAnatomy = (entityManager) => {
  entityManager.createEntity('actor-1', {
    'core:name': { text: 'Integrated Protagonist' },
    'anatomy:body': {
      recipeId: 'humanoid_main',
      body: { root: 'blueprint-torso' },
      structure: { rootPartId: 'torso-1' },
    },
  });

  entityManager.createEntity('torso-1', {
    'anatomy:part': { subType: 'torso' },
    'anatomy:joint': { parentId: 'actor-1', socketId: 'core-socket' },
  });

  entityManager.createEntity('arm-left', {
    'anatomy:part': { subType: 'arm' },
    'anatomy:joint': { parentId: 'torso-1', socketId: 'shoulder-left' },
    'anatomy:tag': { strength: 8 },
  });

  entityManager.createEntity('hand-left', {
    'anatomy:part': { subType: 'hand' },
    'anatomy:joint': { parentId: 'arm-left', socketId: 'wrist-left' },
  });

  entityManager.createEntity('arm-right', {
    'anatomy:part': { subType: 'arm' },
    'anatomy:joint': { parentId: 'torso-1', socketId: 'shoulder-right' },
  });

  entityManager.createEntity('hand-right', {
    'anatomy:part': { subType: 'hand' },
    'anatomy:joint': { parentId: 'arm-right', socketId: 'wrist-right' },
  });

  entityManager.createEntity('leg-left', {
    'anatomy:part': { subType: 'leg' },
    'anatomy:joint': { parentId: 'torso-1', socketId: 'hip-left' },
    'anatomy:sensors': { status: { active: true } },
  });

  entityManager.createEntity('foot-left', {
    'anatomy:part': { subType: 'foot' },
    'anatomy:joint': { parentId: 'leg-left', socketId: 'ankle-left' },
  });

  entityManager.createEntity('head-1', {
    'anatomy:part': { subType: 'head' },
    'anatomy:joint': { parentId: 'torso-1', socketId: 'neck-socket' },
  });

  entityManager.createEntity('floating', {
    'anatomy:part': { subType: 'mystery' },
  });

  entityManager.createEntity('blueprint-actor', {
    'anatomy:body': {
      recipeId: 'humanoid_blueprint',
      body: { root: 'blueprint-torso' },
      structure: { rootPartId: 'blueprint-torso' },
    },
  });

  entityManager.createEntity('blueprint-torso', {
    'anatomy:part': { subType: 'torso' },
    'anatomy:joint': { parentId: 'blueprint-actor', socketId: 'template-root' },
  });

  entityManager.createEntity('blueprint-arm', {
    'anatomy:part': { subType: 'arm' },
    'anatomy:joint': {
      parentId: 'blueprint-torso',
      socketId: 'template-shoulder',
    },
  });

  entityManager.createEntity('blueprint-hand', {
    'anatomy:part': { subType: 'hand' },
    'anatomy:joint': { parentId: 'blueprint-arm', socketId: 'template-wrist' },
  });
};

const expectArrayToContainAll = (actual, expectedValues) => {
  for (const value of expectedValues) {
    expect(actual).toEqual(expect.arrayContaining([value]));
  }
};

describe('BodyGraphService integration – full graph coverage', () => {
  let entityManager;
  let logger;
  let dispatcher;
  let service;
  let actorBodyComponent;
  let blueprintBodyComponent;

  beforeEach(() => {
    entityManager = new IntegrationEntityManager();
    populateAnatomy(entityManager);
    logger = new RecordingLogger();
    dispatcher = new RecordingEventDispatcher();
    service = new BodyGraphService({
      entityManager,
      logger,
      eventDispatcher: dispatcher,
    });
    actorBodyComponent = entityManager.getComponentData(
      'actor-1',
      'anatomy:body'
    );
    blueprintBodyComponent = entityManager.getComponentData(
      'blueprint-actor',
      'anatomy:body'
    );
  });

  it('manages caches, traversal, query caching, and detachment workflows', async () => {
    await service.buildAdjacencyCache('actor-1');
    await service.buildAdjacencyCache('actor-1');

    expect(service.hasCache('actor-1')).toBe(true);
    expect(service.getChildren('actor-1')).toEqual(['torso-1']);
    expect(service.getChildren('unknown-root')).toEqual([]);
    expect(service.getParent('actor-1')).toBeNull();
    expect(service.getParent('torso-1')).toBe('actor-1');

    expect(service.getAncestors('foot-left')).toEqual([
      'leg-left',
      'torso-1',
      'actor-1',
    ]);
    expectArrayToContainAll(service.getAllDescendants('torso-1'), [
      'arm-left',
      'hand-left',
      'arm-right',
      'hand-right',
      'leg-left',
      'foot-left',
      'head-1',
    ]);

    expect(service.getPath('hand-left', 'foot-left')).toEqual([
      'hand-left',
      'arm-left',
      'torso-1',
      'leg-left',
      'foot-left',
    ]);
    expect(service.getPath('hand-left', 'floating')).toBeNull();

    expect(service.getAllParts(null)).toEqual([]);
    expect(service.getAllParts({ body: {} })).toEqual([]);
    expectArrayToContainAll(service.getAllParts({ root: 'torso-1' }), [
      'torso-1',
      'arm-left',
      'arm-right',
      'hand-left',
      'hand-right',
      'leg-left',
      'foot-left',
      'head-1',
    ]);

    const actorAllParts = service.getAllParts(actorBodyComponent, 'actor-1');
    expectArrayToContainAll(actorAllParts, [
      'actor-1',
      'torso-1',
      'arm-left',
      'arm-right',
      'hand-left',
      'hand-right',
      'leg-left',
      'foot-left',
      'head-1',
    ]);

    await service.buildAdjacencyCache('blueprint-actor');
    const blueprintParts = service.getAllParts(
      blueprintBodyComponent,
      'no-cache-root'
    );
    expectArrayToContainAll(blueprintParts, [
      'blueprint-torso',
      'blueprint-arm',
      'blueprint-hand',
    ]);
    entityManager.setComponent('blueprint-hand', 'anatomy:joint', {
      parentId: 'blueprint-arm',
      socketId: 'updated-template-wrist',
    });
    const cachedBlueprint = service.getAllParts(
      blueprintBodyComponent,
      'no-cache-root'
    );
    expect(cachedBlueprint).toEqual(blueprintParts);

    const actorRootDescriptor = { root: 'torso-1' };
    expect(
      service.hasPartWithComponent(actorRootDescriptor, 'anatomy:tag')
    ).toBe(true);
    entityManager.setComponent('arm-left', 'anatomy:tag', {});
    expect(
      service.hasPartWithComponent(actorRootDescriptor, 'anatomy:tag')
    ).toBe(false);

    expect(
      service.hasPartWithComponentValue(
        actorRootDescriptor,
        'anatomy:sensors',
        'status.active',
        true
      )
    ).toEqual({ found: true, partId: 'leg-left' });
    expect(
      service.hasPartWithComponentValue(
        actorRootDescriptor,
        'anatomy:sensors',
        'status.disabled',
        true
      )
    ).toEqual({ found: false });

    const armParts = service.findPartsByType('actor-1', 'arm');
    expect(armParts.sort()).toEqual(['arm-left', 'arm-right']);
    entityManager.setComponent('arm-right', 'anatomy:part', {
      subType: 'wing',
    });
    const cachedArmParts = service.findPartsByType('actor-1', 'arm');
    expect(cachedArmParts).toEqual(armParts);

    const detachmentResult = await service.detachPart('arm-left', {
      reason: 'injury',
    });
    expect(detachmentResult).toEqual({
      detached: ['arm-left', 'hand-left'],
      parentId: 'torso-1',
      socketId: 'shoulder-left',
    });
    expect(service.hasCache('actor-1')).toBe(false);
    expect(
      entityManager.getComponentData('arm-left', 'anatomy:joint')
    ).toBeNull();
    expect(dispatcher.events).toHaveLength(1);
    expect(dispatcher.events[0].eventId).toBe(LIMB_DETACHED_EVENT_ID);
    expect(dispatcher.events[0].payload.detachedCount).toBe(2);
    expect(dispatcher.events[0].payload.reason).toBe('injury');
    expect(
      logger.infoEntries.some(
        ([message]) =>
          typeof message === 'string' && message.includes('Detached 2 entities')
      )
    ).toBe(true);

    entityManager.setComponent('arm-right', 'anatomy:part', { subType: 'arm' });
    await service.buildAdjacencyCache('actor-1');
    expect(service.findPartsByType('actor-1', 'arm')).toEqual(['arm-right']);
    expect(service.getAllParts(actorBodyComponent, 'actor-1')).not.toContain(
      'arm-left'
    );
    expect(service.getChildren('actor-1')).toEqual(['torso-1']);
    expect(service.validateCache()).toEqual({ valid: true, issues: [] });
  });

  it('supports fallback lookups, body graph retrieval, and error handling', async () => {
    const fallbackService = new BodyGraphService({
      entityManager,
      logger: new RecordingLogger(),
      eventDispatcher: new RecordingEventDispatcher(),
    });
    expect(fallbackService.getAnatomyRoot('hand-left')).toBe('actor-1');

    await expect(service.getBodyGraph('')).rejects.toThrow(
      InvalidArgumentError
    );

    await service.buildAdjacencyCache('actor-1');
    await expect(service.getBodyGraph('floating')).rejects.toThrow(
      'Entity floating has no anatomy:body component'
    );

    const bodyGraph = await service.getBodyGraph('actor-1');
    expectArrayToContainAll(bodyGraph.getAllPartIds(), [
      'actor-1',
      'torso-1',
      'arm-left',
      'arm-right',
      'hand-left',
      'hand-right',
      'leg-left',
      'foot-left',
      'head-1',
    ]);
    expectArrayToContainAll(bodyGraph.getConnectedParts('torso-1'), [
      'arm-left',
      'arm-right',
      'leg-left',
      'head-1',
    ]);

    await expect(service.getAnatomyData('')).rejects.toThrow(
      InvalidArgumentError
    );
    const missingData = await service.getAnatomyData('floating');
    expect(missingData).toBeNull();
    expect(
      logger.debugEntries.some(
        ([message]) =>
          typeof message === 'string' &&
          message.includes('has no anatomy:body component')
      )
    ).toBe(true);
    await service.buildAdjacencyCache('blueprint-actor');
    const anatomyData = await service.getAnatomyData('actor-1');
    expect(anatomyData).toEqual({
      recipeId: 'humanoid_main',
      rootEntityId: 'actor-1',
    });

    await expect(service.detachPart('floating')).rejects.toThrow(
      "Entity 'floating' has no joint component"
    );

    expect(service.getAllParts({ root: 'blueprint-torso' })).toEqual(
      expect.arrayContaining([
        'blueprint-torso',
        'blueprint-arm',
        'blueprint-hand',
      ])
    );
    expect(service.getAllParts({ root: 'torso-1' })).toEqual(
      expect.arrayContaining([
        'torso-1',
        'arm-left',
        'arm-right',
        'hand-left',
        'hand-right',
        'leg-left',
        'foot-left',
        'head-1',
      ])
    );

    const nonCascadeDetachment = await service.detachPart('arm-right', {
      cascade: false,
      reason: 'manual',
    });
    expect(nonCascadeDetachment).toEqual({
      detached: ['arm-right'],
      parentId: 'torso-1',
      socketId: 'shoulder-right',
    });
    expect(
      entityManager.getComponentData('hand-right', 'anatomy:joint')
    ).not.toBeNull();
    expect(
      dispatcher.events[dispatcher.events.length - 1].payload.detachedCount
    ).toBe(1);
  });
});
