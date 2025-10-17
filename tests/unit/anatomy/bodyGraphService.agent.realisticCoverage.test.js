import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { BodyGraphService, LIMB_DETACHED_EVENT_ID } from '../../../src/anatomy/bodyGraphService.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

class TestEntityManager {
  constructor() {
    /** @type {Map<string, Map<string, any>>} */
    this.components = new Map();
  }

  setComponent(entityId, componentId, data) {
    if (!this.components.has(entityId)) {
      this.components.set(entityId, new Map());
    }
    this.components.get(entityId).set(componentId, data);
  }

  getComponentData(entityId, componentId) {
    const entity = this.components.get(entityId);
    if (!entity) return null;
    return entity.has(componentId) ? entity.get(componentId) : null;
  }

  async removeComponent(entityId, componentId) {
    const entity = this.components.get(entityId);
    if (entity) {
      entity.delete(componentId);
    }
  }

  getEntityInstance(entityId) {
    if (!this.components.has(entityId)) {
      throw new Error(`Entity ${entityId} not found`);
    }
    return { id: entityId };
  }

  getEntitiesWithComponent(componentId) {
    const result = [];
    for (const [id, components] of this.components.entries()) {
      if (components.has(componentId)) {
        result.push({ id });
      }
    }
    return result;
  }
}

const buildActorWithSimpleAnatomy = (entityManager) => {
  entityManager.setComponent('actor-1', 'anatomy:body', {
    body: { root: 'torso-1' },
    structure: { rootPartId: 'torso-1' },
    recipeId: 'recipe-123',
  });
  entityManager.setComponent('torso-1', 'anatomy:part', { subType: 'torso' });
  entityManager.setComponent('arm-1', 'anatomy:part', { subType: 'arm' });
  entityManager.setComponent('arm-1', 'anatomy:joint', {
    parentId: 'torso-1',
    socketId: 'shoulder',
  });
  entityManager.setComponent('hand-1', 'anatomy:part', { subType: 'hand' });
  entityManager.setComponent('hand-1', 'anatomy:joint', {
    parentId: 'arm-1',
    socketId: 'wrist',
  });
  entityManager.setComponent('hand-1', 'custom:stats', {
    status: { mobility: 'reduced' },
  });
  entityManager.setComponent('torso-1', 'custom:empty', {});
};

describe('BodyGraphService realistic coverage with live dependencies', () => {
  let entityManager;
  let logger;
  let eventDispatcher;
  let service;
  let bodyComponent;

  beforeEach(async () => {
    entityManager = new TestEntityManager();
    buildActorWithSimpleAnatomy(entityManager);

    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    eventDispatcher = {
      dispatch: jest.fn().mockResolvedValue(undefined),
    };

    service = new BodyGraphService({
      entityManager,
      logger,
      eventDispatcher,
    });

    await service.buildAdjacencyCache('actor-1');
    bodyComponent = entityManager.getComponentData('actor-1', 'anatomy:body');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('navigates and mutates anatomy graphs using the real cache manager', async () => {
    expect(service.hasCache('actor-1')).toBe(true);
    const cacheValidation = service.validateCache();
    expect(cacheValidation.valid).toBe(false);
    expect(cacheValidation.issues).toEqual(
      expect.arrayContaining([
        "Entity 'torso-1' in cache has parent but no joint component",
      ])
    );

    const initialParts = service.getAllParts(bodyComponent, 'actor-1');
    expect(initialParts).toEqual(['actor-1', 'torso-1', 'arm-1', 'hand-1']);

    const cachedParts = service.getAllParts(bodyComponent, 'actor-1');
    expect(cachedParts).toEqual(initialParts);

    const blueprintParts = service.getAllParts({ root: 'torso-1' });
    expect(blueprintParts).toEqual(['torso-1', 'arm-1', 'hand-1']);

    const fallbackParts = service.getAllParts(bodyComponent, 'ghost-actor');
    expect(fallbackParts).toEqual(['torso-1', 'arm-1', 'hand-1']);

    expect(service.getAllParts(null)).toEqual([]);

    expect(service.findPartsByType('actor-1', 'hand')).toEqual(['hand-1']);
    expect(service.findPartsByType('actor-1', 'hand')).toEqual(['hand-1']);
    expect(service.findPartsByType('actor-1', 'tail')).toEqual([]);

    expect(service.getAnatomyRoot('hand-1')).toBe('actor-1');
    expect(service.getAnatomyRoot('unknown-part')).toBe('unknown-part');

    expect(service.getPath('torso-1', 'hand-1')).toEqual([
      'torso-1',
      'arm-1',
      'hand-1',
    ]);
    expect(service.getPath('hand-1', 'hand-1')).toEqual(['hand-1']);

    expect(service.getChildren('torso-1')).toEqual(['arm-1']);
    expect(service.getChildren('missing')).toEqual([]);
    expect(service.getParent('arm-1')).toBe('torso-1');
    expect(service.getParent('actor-1')).toBeNull();
    expect(service.getParent('ghost')).toBeNull();

    expect(service.getAncestors('hand-1')).toEqual(['arm-1', 'torso-1', 'actor-1']);
    expect(service.getAncestors('actor-1')).toEqual([]);

    expect(service.getAllDescendants('torso-1')).toEqual(['arm-1', 'hand-1']);
    expect(service.getAllDescendants('hand-1')).toEqual([]);

    expect(service.hasPartWithComponent(bodyComponent, 'anatomy:joint')).toBe(true);
    expect(service.hasPartWithComponent(bodyComponent, 'custom:empty')).toBe(false);

    expect(
      service.hasPartWithComponentValue(
        bodyComponent,
        'custom:stats',
        'status.mobility',
        'reduced'
      )
    ).toEqual({ found: true, partId: 'hand-1' });
    expect(
      service.hasPartWithComponentValue(
        bodyComponent,
        'custom:stats',
        'status.mobility',
        'full'
      )
    ).toEqual({ found: false });
    expect(
      service.hasPartWithComponentValue(
        bodyComponent,
        'missing:component',
        'anything',
        'value'
      )
    ).toEqual({ found: false });

    const graph = await service.getBodyGraph('actor-1');
    expect(graph.getAllPartIds()).toEqual(initialParts);
    expect(graph.getConnectedParts('arm-1')).toEqual(['hand-1']);
    expect(graph.getConnectedParts('unknown')).toEqual([]);

    await expect(service.getAnatomyData('torso-1')).resolves.toBeNull();
    await expect(service.getAnatomyData('actor-1')).resolves.toEqual({
      recipeId: 'recipe-123',
      rootEntityId: 'actor-1',
    });

    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(98765);
    const detachResult = await service.detachPart('arm-1', {
      cascade: true,
      reason: 'integration-test',
    });
    nowSpy.mockRestore();

    expect(detachResult).toEqual({
      detached: ['arm-1', 'hand-1'],
      parentId: 'torso-1',
      socketId: 'shoulder',
    });
    expect(entityManager.getComponentData('arm-1', 'anatomy:joint')).toBeNull();
    expect(eventDispatcher.dispatch).toHaveBeenCalledWith(
      LIMB_DETACHED_EVENT_ID,
      expect.objectContaining({
        detachedEntityId: 'arm-1',
        parentEntityId: 'torso-1',
        socketId: 'shoulder',
        detachedCount: 2,
        reason: 'integration-test',
        timestamp: 98765,
      })
    );
    expect(service.hasCache('actor-1')).toBe(false);
  });

  it('detaches a single part without cascading', async () => {
    const result = await service.detachPart('hand-1', { cascade: false });

    expect(result).toEqual({
      detached: ['hand-1'],
      parentId: 'arm-1',
      socketId: 'wrist',
    });
    expect(entityManager.getComponentData('hand-1', 'anatomy:joint')).toBeNull();
    expect(eventDispatcher.dispatch).toHaveBeenCalledWith(
      LIMB_DETACHED_EVENT_ID,
      expect.objectContaining({
        detachedEntityId: 'hand-1',
        parentEntityId: 'arm-1',
        socketId: 'wrist',
        detachedCount: 1,
      })
    );
  });

  it('validates inputs for body graph and anatomy data retrieval', async () => {
    await expect(service.detachPart('torso-1')).rejects.toThrow(
      new InvalidArgumentError(
        "Entity 'torso-1' has no joint component - cannot detach"
      )
    );

    await expect(service.getBodyGraph(undefined)).rejects.toThrow(
      new InvalidArgumentError('Entity ID is required and must be a string')
    );
    await expect(service.getBodyGraph('unknown-actor')).rejects.toThrow(
      new Error('Entity unknown-actor has no anatomy:body component')
    );

    await expect(service.getAnatomyData(undefined)).rejects.toThrow(
      new InvalidArgumentError('Entity ID is required and must be a string')
    );
    await expect(service.getAnatomyData('unknown-actor')).resolves.toBeNull();
  });
});
