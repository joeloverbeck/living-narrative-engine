import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import BodyGraphService, {
  LIMB_DETACHED_EVENT_ID,
} from '../../../src/anatomy/bodyGraphService.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { AnatomyGraphAlgorithms } from '../../../src/anatomy/anatomyGraphAlgorithms.js';
import { AnatomyCacheManager } from '../../../src/anatomy/anatomyCacheManager.js';

/**
 * Lightweight in-memory entity manager that mimics the portions of the real
 * implementation exercised by BodyGraphService.
 */
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

  getComponentData(entityId, componentId) {
    const entity = this.entities.get(entityId);
    if (!entity) {
      return null;
    }
    const component = entity.get(componentId);
    return component !== undefined ? this.#clone(component) : null;
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
      getComponentData: (componentId) => this.getComponentData(entityId, componentId),
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
async function createServiceFixture() {
  const entityManager = new InMemoryEntityManager();
  const logger = createLogger();
  const eventDispatcher = createEventDispatcher();

  const service = new BodyGraphService({
    entityManager,
    logger,
    eventDispatcher,
  });

  const actorId = 'actor-1';
  const partIds = {
    torso: 'torso-1',
    head: 'head-1',
    leftArm: 'left-arm-1',
    leftHand: 'left-hand-1',
    rightArm: 'right-arm-1',
    heart: 'heart-1',
  };

  entityManager.addComponent(actorId, 'anatomy:body', {
    recipeId: 'test:humanoid',
    body: { root: partIds.torso },
    structure: { rootPartId: partIds.torso },
  });

  entityManager.addComponent(partIds.torso, 'anatomy:part', { subType: 'torso' });
  entityManager.addComponent(partIds.torso, 'anatomy:joint', {
    parentId: actorId,
    socketId: 'core',
  });
  entityManager.addComponent(partIds.torso, 'custom:metadata', {});

  entityManager.addComponent(partIds.head, 'anatomy:part', { subType: 'head' });
  entityManager.addComponent(partIds.head, 'anatomy:joint', {
    parentId: partIds.torso,
    socketId: 'neck',
  });

  entityManager.addComponent(partIds.leftArm, 'anatomy:part', { subType: 'arm' });
  entityManager.addComponent(partIds.leftArm, 'anatomy:joint', {
    parentId: partIds.torso,
    socketId: 'left-shoulder',
  });
  entityManager.addComponent(partIds.leftArm, 'anatomy:status', {
    posture: { state: 'raised' },
  });
  entityManager.addComponent(partIds.leftArm, 'core:description', {
    text: 'left arm',
  });

  entityManager.addComponent(partIds.leftHand, 'anatomy:part', { subType: 'hand' });
  entityManager.addComponent(partIds.leftHand, 'anatomy:joint', {
    parentId: partIds.leftArm,
    socketId: 'left-wrist',
  });
  entityManager.addComponent(partIds.leftHand, 'equipment:grip', {
    itemId: 'sword-1',
    quality: 'legendary',
  });

  entityManager.addComponent(partIds.rightArm, 'anatomy:part', { subType: 'arm' });
  entityManager.addComponent(partIds.rightArm, 'anatomy:joint', {
    parentId: partIds.torso,
    socketId: 'right-shoulder',
  });
  entityManager.addComponent(partIds.rightArm, 'core:description', {});

  entityManager.addComponent(partIds.heart, 'anatomy:part', { subType: 'heart' });
  entityManager.addComponent(partIds.heart, 'anatomy:joint', {
    parentId: partIds.torso,
    socketId: 'chest',
  });

  return {
    service,
    entityManager,
    logger,
    eventDispatcher,
    actorId,
    partIds,
    bodyComponent: entityManager.getComponentData(actorId, 'anatomy:body'),
  };
}

const collectIds = (values) => values.sort();

describe('BodyGraphService integration - real module coverage', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('enforces required constructor dependencies', () => {
    const entityManager = new InMemoryEntityManager();
    const logger = createLogger();
    const eventDispatcher = createEventDispatcher();

    expect(
      () =>
        new BodyGraphService({
          logger,
          eventDispatcher,
        })
    ).toThrow(InvalidArgumentError);

    expect(
      () =>
        new BodyGraphService({
          entityManager,
          eventDispatcher,
        })
    ).toThrow(InvalidArgumentError);

    expect(
      () =>
        new BodyGraphService({
          entityManager,
          logger,
        })
    ).toThrow(InvalidArgumentError);
  });

  describe('with a fully populated anatomy graph', () => {
    /** @type {ReturnType<typeof createServiceFixture>} */
    let fixturePromise;

    beforeEach(() => {
      fixturePromise = createServiceFixture();
    });

    it('builds caches, reuses query results, and resolves traversal helpers', async () => {
      const { service, actorId, partIds, bodyComponent } =
        await fixturePromise;

      const buildCacheSpy = jest.spyOn(
        AnatomyCacheManager.prototype,
        'buildCache'
      );

      await service.buildAdjacencyCache(partIds.torso);
      expect(buildCacheSpy).toHaveBeenCalledTimes(1);

      const allPartsSpy = jest.spyOn(
        AnatomyGraphAlgorithms,
        'getAllParts'
      );
      const blueprintPartsFirst = service.getAllParts(bodyComponent, actorId);
      expect(allPartsSpy).toHaveBeenCalledTimes(1);
      expect(collectIds(blueprintPartsFirst)).toEqual(
        collectIds([
          partIds.torso,
          partIds.head,
          partIds.leftArm,
          partIds.leftHand,
          partIds.rightArm,
          partIds.heart,
        ])
      );

      const blueprintPartsSecond = service.getAllParts(bodyComponent, actorId);
      expect(allPartsSpy).toHaveBeenCalledTimes(1);
      expect(collectIds(blueprintPartsSecond)).toEqual(
        collectIds(blueprintPartsFirst)
      );

      await service.buildAdjacencyCache(actorId);
      expect(buildCacheSpy).toHaveBeenCalledTimes(2);

      const actorParts = service.getAllParts(bodyComponent, actorId);
      expect(allPartsSpy).toHaveBeenCalledTimes(2);
      expect(actorParts).toEqual(
        expect.arrayContaining([partIds.torso, partIds.leftArm])
      );

      const path = service.getPath(partIds.leftHand, partIds.rightArm);
      expect(path).toEqual([
        partIds.leftHand,
        partIds.leftArm,
        partIds.torso,
        partIds.rightArm,
      ]);

      const findPartsSpy = jest.spyOn(
        AnatomyGraphAlgorithms,
        'findPartsByType'
      );
      const firstArms = service.findPartsByType(actorId, 'arm');
      expect(findPartsSpy).toHaveBeenCalledTimes(1);
      expect(collectIds(firstArms)).toEqual(
        collectIds([partIds.leftArm, partIds.rightArm])
      );

      const secondArms = service.findPartsByType(actorId, 'arm');
      expect(findPartsSpy).toHaveBeenCalledTimes(1);
      expect(collectIds(secondArms)).toEqual(collectIds(firstArms));

      expect(service.getAnatomyRoot(partIds.leftHand)).toBe(actorId);
      expect(service.getAnatomyRoot(null)).toBeNull();

      expect(service.getAllDescendants(partIds.torso)).toEqual(
        expect.arrayContaining([
          partIds.head,
          partIds.leftArm,
          partIds.leftHand,
          partIds.rightArm,
          partIds.heart,
        ])
      );

      await service.buildAdjacencyCache(actorId);
      expect(buildCacheSpy).toHaveBeenCalledTimes(2);

      expect(service.hasCache(actorId)).toBe(true);
      expect(service.getChildren(actorId)).toEqual([partIds.torso]);
      expect(collectIds(service.getChildren(partIds.torso))).toEqual(
        collectIds([
          partIds.head,
          partIds.leftArm,
          partIds.rightArm,
          partIds.heart,
        ])
      );
      expect(service.getParent(partIds.leftArm)).toBe(partIds.torso);
      expect(service.getParent('unknown')).toBeNull();
      expect(service.getAncestors(partIds.leftHand)).toEqual([
        partIds.leftArm,
        partIds.torso,
        actorId,
      ]);
    });

    it('inspects anatomy components and nested values', async () => {
      const { service, actorId, partIds, bodyComponent } = await fixturePromise;
      await service.buildAdjacencyCache(actorId);

      expect(service.getAllParts({})).toEqual([]);

      expect(
        service.hasPartWithComponent(bodyComponent, 'core:description')
      ).toBe(true);
      expect(
        service.hasPartWithComponent(bodyComponent, 'equipment:grip')
      ).toBe(true);
      expect(
        service.hasPartWithComponent(bodyComponent, 'custom:metadata')
      ).toBe(false);

      expect(
        service.hasPartWithComponentValue(
          bodyComponent,
          'anatomy:status',
          'posture.state',
          'raised'
        )
      ).toEqual({ found: true, partId: partIds.leftArm });

      expect(
        service.hasPartWithComponentValue(
          bodyComponent,
          'anatomy:status',
          'posture.state',
          'lowered'
        )
      ).toEqual({ found: false });
    });

    it('provides anatomy data and graph wrappers', async () => {
      const { service, actorId, partIds } = await fixturePromise;
      await service.buildAdjacencyCache(actorId);

      await expect(service.getBodyGraph(42)).rejects.toThrow(
        InvalidArgumentError
      );
      await expect(service.getBodyGraph('missing-entity')).rejects.toThrow(
        /has no anatomy:body/
      );

      const graph = await service.getBodyGraph(actorId);
      expect(collectIds(graph.getAllPartIds())).toEqual(
        collectIds([
          actorId,
          partIds.torso,
          partIds.head,
          partIds.leftArm,
          partIds.leftHand,
          partIds.rightArm,
          partIds.heart,
        ])
      );
      expect(graph.getConnectedParts(partIds.torso)).toEqual(
        expect.arrayContaining([
          partIds.head,
          partIds.leftArm,
          partIds.rightArm,
          partIds.heart,
        ])
      );

      await expect(service.getAnatomyData(42)).rejects.toThrow(
        InvalidArgumentError
      );
      await expect(service.getAnatomyData(partIds.leftArm)).resolves.toBeNull();
      await expect(service.getAnatomyData(actorId)).resolves.toEqual({
        recipeId: 'test:humanoid',
        rootEntityId: actorId,
      });

      const validation = service.validateCache();
      expect(validation).toEqual({ valid: true, issues: [] });
    });

    it('detaches parts, invalidates caches, and surfaces errors', async () => {
      const { service, entityManager, actorId, partIds, bodyComponent, eventDispatcher } =
        await fixturePromise;
      await service.buildAdjacencyCache(actorId);

      // Warm caches so that detachPart invalidates query results.
      service.findPartsByType(actorId, 'arm');

      const detachResult = await service.detachPart(partIds.leftArm, {
        cascade: true,
        reason: 'integration-test',
      });
      expect(detachResult.detached).toEqual(
        expect.arrayContaining([partIds.leftArm, partIds.leftHand])
      );
      expect(eventDispatcher.dispatch).toHaveBeenCalledWith(
        LIMB_DETACHED_EVENT_ID,
        expect.objectContaining({
          detachedEntityId: partIds.leftArm,
          parentEntityId: partIds.torso,
          socketId: 'left-shoulder',
          detachedCount: expect.any(Number),
          reason: 'integration-test',
        })
      );
      expect(
        entityManager.getComponentData(partIds.leftArm, 'anatomy:joint')
      ).toBeNull();
      expect(service.hasCache(actorId)).toBe(false);

      await service.buildAdjacencyCache(actorId);
      const armsAfterDetach = service.findPartsByType(actorId, 'arm');
      expect(armsAfterDetach).toEqual([partIds.rightArm]);

      const heartResult = await service.detachPart(partIds.heart, {
        cascade: false,
        reason: 'manual',
      });
      expect(heartResult).toEqual({
        detached: [partIds.heart],
        parentId: partIds.torso,
        socketId: 'chest',
      });

      entityManager.addComponent('floating-part', 'anatomy:part', {
        subType: 'floating',
      });
      await expect(service.detachPart('floating-part')).rejects.toThrow(
        InvalidArgumentError
      );

      await expect(service.getAnatomyData(actorId)).resolves.toEqual({
        recipeId: 'test:humanoid',
        rootEntityId: actorId,
      });

      expect(service.getAllParts(bodyComponent, actorId)).toEqual(
        expect.arrayContaining([partIds.torso])
      );
    });
  });
});
