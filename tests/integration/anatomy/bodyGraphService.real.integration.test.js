import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import BodyGraphService, {
  LIMB_DETACHED_EVENT_ID,
} from '../../../src/anatomy/bodyGraphService.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

/**
 * @description Creates a logger mock that mirrors the engine logger interface.
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
 * @description Minimal in-memory entity manager tailored for BodyGraphService integration tests.
 */
class InMemoryEntityManager {
  /**
   * @description Constructs a new manager with optional preloaded entities.
   * @param {Record<string, Record<string, any>>} [initialEntities] Entity component map keyed by entity id.
   */
  constructor(initialEntities = {}) {
    /** @type {Map<string, Record<string, any>>} */
    this.entities = new Map();
    Object.entries(initialEntities).forEach(([id, components]) => {
      this.entities.set(id, { ...components });
    });
  }

  /**
   * @description Adds or replaces an entity definition.
   * @param {string} entityId Identifier of the entity.
   * @param {Record<string, any>} components Component map for the entity.
   * @returns {void}
   */
  addEntity(entityId, components) {
    this.entities.set(entityId, { ...components });
  }

  /**
   * @description Retrieves component data for a given entity.
   * @param {string} entityId Target entity identifier.
   * @param {string} componentId Component identifier to fetch.
   * @returns {any} Stored component data or null when absent.
   */
  getComponentData(entityId, componentId) {
    const entity = this.entities.get(entityId);
    if (!entity) return null;
    return Object.prototype.hasOwnProperty.call(entity, componentId)
      ? entity[componentId]
      : null;
  }

  /**
   * @description Removes a component from an entity.
   * @param {string} entityId Target entity identifier.
   * @param {string} componentId Component identifier to remove.
   * @returns {Promise<void>} Resolves after mutation completes.
   */
  async removeComponent(entityId, componentId) {
    const entity = this.entities.get(entityId);
    if (entity && Object.prototype.hasOwnProperty.call(entity, componentId)) {
      delete entity[componentId];
    }
  }

  /**
   * @description Retrieves a lightweight entity instance.
   * @param {string} entityId Target entity identifier.
   * @returns {{id: string, getComponentData: (componentId: string) => any, hasComponent: (componentId: string) => boolean}}
   */
  getEntityInstance(entityId) {
    if (!this.entities.has(entityId)) {
      throw new Error(`Entity ${entityId} not found`);
    }
    return {
      id: entityId,
      getComponentData: (componentId) => this.getComponentData(entityId, componentId),
      hasComponent: (componentId) =>
        this.getComponentData(entityId, componentId) !== null,
    };
  }

  /**
   * @description Retrieves all entities that currently contain a component.
   * @param {string} componentId Component identifier to search for.
   * @returns {{id: string, getComponentData: (componentId: string) => any}[]} Matching entities.
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
 * @description Builds a complete anatomy graph fixture used across the integration suite.
 * @returns {{entityManager: InMemoryEntityManager, service: BodyGraphService, bodyComponent: any, actorId: string, partIds: Record<string, string>, logger: ReturnType<typeof createLogger>, eventDispatcher: {dispatch: jest.Mock}}}
 */
function createAnatomyFixture() {
  const logger = createLogger();
  const eventDispatcher = { dispatch: jest.fn().mockResolvedValue(undefined) };

  const actorId = 'actor-1';
  const partIds = {
    torso: 'torso-1',
    head: 'head-1',
    leftArm: 'left-arm-1',
    rightArm: 'right-arm-1',
    leftHand: 'left-hand-1',
    rightHand: 'right-hand-1',
    heart: 'heart-1',
  };

  const bodyComponent = {
    recipeId: 'test:humanoid',
    body: {
      root: partIds.torso,
      parts: {
        torso: partIds.torso,
        head: partIds.head,
        left_arm: partIds.leftArm,
        right_arm: partIds.rightArm,
        left_hand: partIds.leftHand,
        right_hand: partIds.rightHand,
        heart: partIds.heart,
      },
    },
    structure: { rootPartId: partIds.torso },
  };

  const entityManager = new InMemoryEntityManager();
  entityManager.addEntity(actorId, {
    'anatomy:body': bodyComponent,
    'core:name': { text: 'Test Actor' },
  });
  entityManager.addEntity(partIds.torso, {
    'anatomy:part': { subType: 'torso' },
    'anatomy:joint': { parentId: actorId, socketId: 'torso_socket' },
    'custom:flag': { isImportant: true },
  });
  entityManager.addEntity(partIds.head, {
    'anatomy:part': { subType: 'head' },
    'anatomy:joint': { parentId: partIds.torso, socketId: 'neck_socket' },
  });
  entityManager.addEntity(partIds.leftArm, {
    'anatomy:part': { subType: 'arm', orientation: 'left' },
    'anatomy:joint': { parentId: partIds.torso, socketId: 'left_shoulder' },
    'custom:status': { metadata: { functional: 'primary' } },
  });
  entityManager.addEntity(partIds.rightArm, {
    'anatomy:part': { subType: 'arm', orientation: 'right' },
    'anatomy:joint': { parentId: partIds.torso, socketId: 'right_shoulder' },
    'custom:status': { metadata: { functional: 'secondary' } },
  });
  entityManager.addEntity(partIds.leftHand, {
    'anatomy:part': { subType: 'hand', orientation: 'left' },
    'anatomy:joint': { parentId: partIds.leftArm, socketId: 'left_wrist' },
  });
  entityManager.addEntity(partIds.rightHand, {
    'anatomy:part': { subType: 'hand', orientation: 'right' },
    'anatomy:joint': { parentId: partIds.rightArm, socketId: 'right_wrist' },
  });
  entityManager.addEntity(partIds.heart, {
    'anatomy:part': { subType: 'heart' },
    'anatomy:joint': { parentId: partIds.torso, socketId: 'inner_torso' },
    'vital:stats': { status: { beating: true } },
  });

  const service = new BodyGraphService({
    entityManager,
    logger,
    eventDispatcher,
  });

  return {
    entityManager,
    service,
    bodyComponent,
    actorId,
    partIds,
    logger,
    eventDispatcher,
  };
}

describe('BodyGraphService real integration coverage', () => {
  let entityManager;
  let service;
  let bodyComponent;
  let actorId;
  let partIds;
  let logger;
  let eventDispatcher;

  beforeEach(() => {
    ({
      entityManager,
      service,
      bodyComponent,
      actorId,
      partIds,
      logger,
      eventDispatcher,
    } = createAnatomyFixture());
  });

  it('traverses anatomy graphs and caches query results end-to-end', async () => {
    await service.buildAdjacencyCache(actorId);
    await service.buildAdjacencyCache(actorId);
    expect(service.hasCache(actorId)).toBe(true);

    expect(service.getAllParts(null)).toEqual([]);
    expect(service.getAllParts({})).toEqual([]);

    const blueprintParts = service.getAllParts(bodyComponent);
    const expectedPartIds = Object.values(partIds);
    expect([...blueprintParts].sort()).toEqual([...expectedPartIds].sort());

    const actorParts = service.getAllParts(bodyComponent, actorId);
    const expectedAllIds = [actorId, ...expectedPartIds];
    expect([...actorParts].sort()).toEqual([...expectedAllIds].sort());

    const cachedActorParts = service.getAllParts(bodyComponent, actorId);
    expect(cachedActorParts).toBe(actorParts);

    const directStructureParts = service.getAllParts({ root: partIds.torso });
    expect([...directStructureParts].sort()).toEqual([...blueprintParts].sort());

    const fallbackParts = service.getAllParts(bodyComponent, 'unseen-actor');
    expect([...fallbackParts].sort()).toEqual([...blueprintParts].sort());

    expect(
      service.hasPartWithComponent(bodyComponent, 'custom:flag')
    ).toBe(true);
    expect(
      service.hasPartWithComponent(bodyComponent, 'missing:component')
    ).toBe(false);

    const valueSearch = service.hasPartWithComponentValue(
      bodyComponent,
      'custom:status',
      'metadata.functional',
      'primary'
    );
    expect(valueSearch).toEqual({ found: true, partId: partIds.leftArm });
    expect(
      service.hasPartWithComponentValue(
        bodyComponent,
        'custom:status',
        'metadata.functional',
        'unknown'
      )
    ).toEqual({ found: false });

    const handIds = service.findPartsByType(actorId, 'hand');
    expect([...handIds].sort()).toEqual(
      [partIds.leftHand, partIds.rightHand].sort()
    );
    const cachedHands = service.findPartsByType(actorId, 'hand');
    expect(cachedHands).toBe(handIds);

    expect(service.getAnatomyRoot(partIds.leftHand)).toBe(actorId);
    expect(service.getPath(partIds.leftHand, partIds.head)).toEqual([
      partIds.leftHand,
      partIds.leftArm,
      partIds.torso,
      partIds.head,
    ]);

    const graph = await service.getBodyGraph(actorId);
    expect(graph.getAllPartIds()).toEqual(actorParts);
    expect([...graph.getConnectedParts(partIds.torso)].sort()).toEqual(
      [
        partIds.head,
        partIds.leftArm,
        partIds.rightArm,
        partIds.heart,
      ].sort()
    );

    await expect(service.getAnatomyData(actorId)).resolves.toEqual({
      recipeId: bodyComponent.recipeId,
      rootEntityId: actorId,
    });
    await expect(service.getAnatomyData(partIds.torso)).resolves.toBeNull();

    const validation = service.validateCache();
    expect(validation.valid).toBe(true);
    expect(validation.issues).toHaveLength(0);

    expect([...service.getChildren(actorId)]).toEqual([partIds.torso]);
    expect([...service.getChildren(partIds.torso)].sort()).toEqual(
      [
        partIds.head,
        partIds.leftArm,
        partIds.rightArm,
        partIds.heart,
      ].sort()
    );
    expect(service.getChildren('unknown')).toEqual([]);

    expect(service.getParent(actorId)).toBeNull();
    expect(service.getParent(partIds.head)).toBe(partIds.torso);

    expect(service.getAncestors(partIds.leftHand)).toEqual([
      partIds.leftArm,
      partIds.torso,
      actorId,
    ]);

    expect(service.getAllDescendants(partIds.leftArm)).toEqual([
      partIds.leftHand,
    ]);
    const actorDescendants = service.getAllDescendants(actorId);
    expect(actorDescendants).toEqual(expect.arrayContaining(expectedPartIds));
    expect(actorDescendants).not.toContain(actorId);
  });

  it('detaches limbs and invalidates caches using the real cache manager', async () => {
    await service.buildAdjacencyCache(actorId);
    const initialHands = service.findPartsByType(actorId, 'hand');
    expect(initialHands).toHaveLength(2);

    const result = await service.detachPart(partIds.leftArm, {
      cascade: true,
      reason: 'injury',
    });

    expect(result.detached).toEqual([partIds.leftArm, partIds.leftHand]);
    expect(result.parentId).toBe(partIds.torso);
    expect(result.socketId).toBe('left_shoulder');
    expect(service.hasCache(actorId)).toBe(false);
    expect(entityManager.getComponentData(partIds.leftArm, 'anatomy:joint')).toBeNull();

    expect(eventDispatcher.dispatch).toHaveBeenCalledWith(
      LIMB_DETACHED_EVENT_ID,
      expect.objectContaining({
        detachedEntityId: partIds.leftArm,
        parentEntityId: partIds.torso,
        socketId: 'left_shoulder',
        detachedCount: 2,
        reason: 'injury',
      })
    );
    expect(logger.info).toHaveBeenCalledWith(
      `BodyGraphService: Detached 2 entities from parent '${partIds.torso}'`
    );

    await service.buildAdjacencyCache(actorId);
    const rebuiltHands = service.findPartsByType(actorId, 'hand');
    expect(rebuiltHands).toContain(partIds.rightHand);
    expect(rebuiltHands).not.toContain(partIds.leftHand);
    expect(rebuiltHands).toHaveLength(1);
  });

  it('supports non-cascading detachments and surfaces joint validation errors', async () => {
    await service.buildAdjacencyCache(actorId);
    const nonCascade = await service.detachPart(partIds.rightHand, {
      cascade: false,
      reason: 'maintenance',
    });

    expect(nonCascade.detached).toEqual([partIds.rightHand]);
    expect(nonCascade.parentId).toBe(partIds.rightArm);
    expect(nonCascade.socketId).toBe('right_wrist');
    expect(service.hasCache(actorId)).toBe(false);

    const {
      service: secondService,
      partIds: secondIds,
      entityManager: secondEntityManager,
    } = createAnatomyFixture();
    await secondEntityManager.removeComponent(
      secondIds.head,
      'anatomy:joint'
    );
    await expect(secondService.detachPart(secondIds.head)).rejects.toThrow(
      InvalidArgumentError
    );
  });
});
