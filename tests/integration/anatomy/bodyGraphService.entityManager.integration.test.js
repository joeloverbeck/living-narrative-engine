import { describe, it, expect, beforeEach } from '@jest/globals';
import BodyGraphService, {
  LIMB_DETACHED_EVENT_ID,
} from '../../../src/anatomy/bodyGraphService.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import EntityManager from '../../../src/entities/entityManager.js';
import EntityDefinition from '../../../src/entities/entityDefinition.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import {
  createMockLogger,
  createMockSchemaValidator,
  createMockValidatedEventDispatcherForIntegration,
} from '../../common/mockFactories/index.js';

/**
 * @typedef {import('../../../src/interfaces/IEntityManager.js').IEntityManager} IEntityManager
 */

/**
 * Registers a component definition in the provided registry.
 *
 * @param {InMemoryDataRegistry} registry
 * @param {string} id
 * @param {object} dataSchema
 */
const registerComponentDefinition = (registry, id, dataSchema) => {
  registry.store('components', id, { id, dataSchema });
};

/**
 * Registers an entity definition in the registry.
 *
 * @param {InMemoryDataRegistry} registry
 * @param {string} id
 * @param {Record<string, any>} components
 */
const registerEntityDefinition = (registry, id, components) => {
  const definition = new EntityDefinition(id, {
    description: `${id} definition`,
    components,
  });
  registry.store('entityDefinitions', id, definition);
};

describe('BodyGraphService integration with real EntityManager', () => {
  /** @type {ReturnType<typeof createMockLogger>} */
  let logger;
  /** @type {ReturnType<typeof createMockValidatedEventDispatcherForIntegration>} */
  let eventDispatcher;
  /** @type {InMemoryDataRegistry} */
  let registry;
  /** @type {IEntityManager} */
  let entityManager;
  /** @type {BodyGraphService} */
  let service;
  /** @type {string} */
  let actorId;
  /** @type {Record<string, string>} */
  let partIds;
  /** @type {any} */
  let bodyComponent;

  beforeEach(async () => {
    logger = createMockLogger();
    eventDispatcher = createMockValidatedEventDispatcherForIntegration();
    registry = new InMemoryDataRegistry({ logger });

    const validator = createMockSchemaValidator();
    entityManager = new EntityManager({
      registry,
      validator,
      logger,
      dispatcher: eventDispatcher,
    });

    service = new BodyGraphService({
      entityManager,
      logger,
      eventDispatcher,
    });

    registerComponentDefinition(registry, 'core:name', {
      type: 'object',
      properties: { text: { type: 'string' } },
      required: ['text'],
    });

    registerComponentDefinition(registry, 'anatomy:body', {
      type: 'object',
      properties: {
        body: { type: ['object', 'null'] },
        recipeId: { type: ['string', 'null'] },
        structure: { type: ['object', 'null'] },
      },
    });

    registerComponentDefinition(registry, 'anatomy:part', {
      type: 'object',
      properties: { subType: { type: 'string' } },
      required: ['subType'],
    });

    registerComponentDefinition(registry, 'anatomy:joint', {
      type: 'object',
      properties: {
        parentId: { type: ['string', 'null'] },
        socketId: { type: ['string', 'null'] },
      },
    });

    registerComponentDefinition(registry, 'anatomy:sockets', {
      type: 'object',
      properties: {
        sockets: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              allowedTypes: { type: 'array', items: { type: 'string' } },
              max: { type: 'number' },
            },
          },
        },
      },
    });

    registerComponentDefinition(registry, 'anatomy:status', {
      type: 'object',
      properties: {
        posture: {
          type: 'object',
          properties: { state: { type: 'string' } },
        },
      },
    });

    registerComponentDefinition(registry, 'equipment:grip', {
      type: 'object',
      properties: {
        itemId: { type: 'string' },
        quality: { type: 'string' },
      },
    });

    registerComponentDefinition(registry, 'custom:metadata', {
      type: 'object',
      properties: { tag: { type: 'string' } },
    });

    registerEntityDefinition(registry, 'core:actor', {
      'core:name': { text: 'Actor template' },
      'anatomy:body': {
        recipeId: 'test:humanoid',
        body: null,
        structure: null,
      },
    });

    const makePartDefinition = (id, subType, sockets = []) => {
      registerEntityDefinition(registry, id, {
        'core:name': { text: subType },
        'anatomy:part': { subType },
        'anatomy:sockets': { sockets },
      });
    };

    makePartDefinition('test:torso', 'torso', [
      { id: 'left-shoulder', allowedTypes: ['arm'], max: 1 },
      { id: 'right-shoulder', allowedTypes: ['arm'], max: 1 },
      { id: 'neck', allowedTypes: ['head'], max: 1 },
      { id: 'chest', allowedTypes: ['heart'], max: 1 },
    ]);
    makePartDefinition('test:arm', 'arm', [
      { id: 'wrist', allowedTypes: ['hand'], max: 1 },
    ]);
    makePartDefinition('test:hand', 'hand');
    makePartDefinition('test:head', 'head', [
      { id: 'mouth-socket', allowedTypes: ['mouth'], max: 1 },
    ]);
    makePartDefinition('test:heart', 'heart');
    makePartDefinition('test:mouth', 'mouth');

    registerEntityDefinition(registry, 'core:npc', {
      'core:name': { text: 'Villager' },
    });

    actorId = 'actor-integrated-1';
    partIds = {
      torso: 'torso-integrated-1',
      leftArm: 'left-arm-integrated-1',
      leftHand: 'left-hand-integrated-1',
      rightArm: 'right-arm-integrated-1',
      head: 'head-integrated-1',
      mouth: 'mouth-integrated-1',
      heart: 'heart-integrated-1',
    };

    const createPart = async (definitionId, instanceId) =>
      entityManager.createEntityInstance(definitionId, { instanceId });

    await createPart('test:torso', partIds.torso);
    await createPart('test:arm', partIds.leftArm);
    await createPart('test:hand', partIds.leftHand);
    await createPart('test:arm', partIds.rightArm);
    await createPart('test:head', partIds.head);
    await createPart('test:mouth', partIds.mouth);
    await createPart('test:heart', partIds.heart);

    await entityManager.addComponent(partIds.torso, 'anatomy:joint', {
      parentId: actorId,
      socketId: 'core',
    });
    await entityManager.addComponent(partIds.torso, 'custom:metadata', {
      tag: 'core-structure',
    });

    await entityManager.addComponent(partIds.leftArm, 'anatomy:joint', {
      parentId: partIds.torso,
      socketId: 'left-shoulder',
    });
    await entityManager.addComponent(partIds.leftArm, 'anatomy:status', {
      posture: { state: 'raised' },
    });

    await entityManager.addComponent(partIds.leftHand, 'anatomy:joint', {
      parentId: partIds.leftArm,
      socketId: 'wrist',
    });
    await entityManager.addComponent(partIds.leftHand, 'equipment:grip', {
      itemId: 'sword-1',
      quality: 'legendary',
    });

    await entityManager.addComponent(partIds.rightArm, 'anatomy:joint', {
      parentId: partIds.torso,
      socketId: 'right-shoulder',
    });

    await entityManager.addComponent(partIds.head, 'anatomy:joint', {
      parentId: partIds.torso,
      socketId: 'neck',
    });

    await entityManager.addComponent(partIds.mouth, 'anatomy:joint', {
      parentId: partIds.head,
      socketId: 'mouth-socket',
    });

    await entityManager.addComponent(partIds.heart, 'anatomy:joint', {
      parentId: partIds.torso,
      socketId: 'chest',
    });

    await entityManager.createEntityInstance('core:npc', {
      instanceId: 'npc-without-anatomy',
    });

    await entityManager.createEntityInstance('core:actor', {
      instanceId: actorId,
      componentOverrides: {
        'core:name': { text: 'Integrated Actor' },
        'anatomy:body': {
          recipeId: 'test:humanoid',
          body: { root: partIds.torso },
          structure: {
            rootPartId: partIds.torso,
            parts: {
              [partIds.torso]: {
                id: partIds.torso,
                children: [
                  partIds.leftArm,
                  partIds.rightArm,
                  partIds.head,
                  partIds.heart,
                ],
              },
              [partIds.leftArm]: {
                id: partIds.leftArm,
                children: [partIds.leftHand],
              },
              [partIds.rightArm]: { id: partIds.rightArm, children: [] },
              [partIds.leftHand]: { id: partIds.leftHand, children: [] },
              [partIds.head]: { id: partIds.head, children: [partIds.mouth] },
              [partIds.mouth]: { id: partIds.mouth, children: [] },
              [partIds.heart]: { id: partIds.heart, children: [] },
            },
          },
        },
      },
    });

    bodyComponent = entityManager.getComponentData(actorId, 'anatomy:body');
    expect(bodyComponent).toBeTruthy();
  });

  it('navigates a real anatomy graph and caches results', async () => {
    await service.buildAdjacencyCache(actorId);
    await service.buildAdjacencyCache(actorId); // second call ensures cached branch
    await service.buildAdjacencyCache(partIds.torso);

    expect(service.hasCache(actorId)).toBe(true);

    const actorParts = service.getAllParts(bodyComponent, actorId);
    expect(actorParts).toEqual(
      expect.arrayContaining([
        actorId,
        partIds.torso,
        partIds.leftArm,
        partIds.leftHand,
        partIds.rightArm,
        partIds.head,
        partIds.mouth,
        partIds.heart,
      ])
    );

    const fromBlueprint = service.getAllParts(bodyComponent);
    expect(fromBlueprint).not.toContain(actorId);
    expect(fromBlueprint).toEqual(
      expect.arrayContaining([
        partIds.torso,
        partIds.leftArm,
        partIds.leftHand,
        partIds.rightArm,
        partIds.head,
        partIds.mouth,
        partIds.heart,
      ])
    );

    const directRoot = service.getAllParts({ root: partIds.torso });
    expect(directRoot).toEqual(fromBlueprint);

    const cachedAgain = service.getAllParts(bodyComponent, actorId);
    expect(cachedAgain).toBe(actorParts);

    const armsFirst = service.findPartsByType(actorId, 'arm');
    expect(armsFirst).toEqual(
      expect.arrayContaining([partIds.leftArm, partIds.rightArm])
    );
    const armsSecond = service.findPartsByType(actorId, 'arm');
    expect(armsSecond).toBe(armsFirst);

    expect(service.getAnatomyRoot(partIds.leftHand)).toBe(actorId);
    expect(service.getAnatomyRoot(null)).toBeNull();

    const path = service.getPath(partIds.leftHand, partIds.rightArm);
    expect(path).toEqual([
      partIds.leftHand,
      partIds.leftArm,
      partIds.torso,
      partIds.rightArm,
    ]);

    expect(service.getChildren(partIds.torso)).toEqual(
      expect.arrayContaining([
        partIds.leftArm,
        partIds.rightArm,
        partIds.head,
        partIds.heart,
      ])
    );
    expect(service.getChildren('ghost')).toEqual([]);

    expect(service.getParent(partIds.leftHand)).toBe(partIds.leftArm);
    expect(service.getParent('ghost')).toBeNull();

    expect(service.getAncestors(partIds.leftHand)).toEqual([
      partIds.leftArm,
      partIds.torso,
      actorId,
    ]);

    const descendants = service.getAllDescendants(actorId);
    expect(descendants).toEqual(
      expect.arrayContaining([
        partIds.torso,
        partIds.leftArm,
        partIds.leftHand,
        partIds.rightArm,
        partIds.head,
        partIds.mouth,
        partIds.heart,
      ])
    );

    expect(service.hasPartWithComponent(bodyComponent, 'equipment:grip')).toBe(
      true
    );
    expect(
      service.hasPartWithComponent(bodyComponent, 'nonexistent:component')
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

    const bodyGraph = await service.getBodyGraph(actorId);
    expect(bodyGraph.getAllPartIds()).toEqual(actorParts);
    expect(bodyGraph.getConnectedParts(partIds.torso)).toEqual(
      expect.arrayContaining([
        partIds.leftArm,
        partIds.rightArm,
        partIds.head,
        partIds.heart,
      ])
    );

    const validation = service.validateCache();
    expect(validation.valid).toBe(true);
    expect(validation.issues).toEqual([]);

    await expect(service.getBodyGraph(null)).rejects.toThrow(
      InvalidArgumentError
    );
    await expect(service.getBodyGraph('npc-without-anatomy')).rejects.toThrow(
      'has no anatomy:body component'
    );

    await expect(service.getAnatomyData(actorId)).resolves.toEqual({
      recipeId: 'test:humanoid',
      rootEntityId: actorId,
    });
    await expect(
      service.getAnatomyData('npc-without-anatomy')
    ).resolves.toBeNull();
  });

  it('detaches parts and invalidates real caches', async () => {
    await service.buildAdjacencyCache(actorId);

    const cascadeResult = await service.detachPart(partIds.leftArm);
    expect(cascadeResult).toEqual({
      detached: [partIds.leftArm, partIds.leftHand],
      parentId: partIds.torso,
      socketId: 'left-shoulder',
    });

    expect(eventDispatcher.dispatch).toHaveBeenCalledWith(
      LIMB_DETACHED_EVENT_ID,
      expect.objectContaining({
        detachedEntityId: partIds.leftArm,
        parentEntityId: partIds.torso,
        detachedCount: 2,
        reason: 'manual',
      })
    );

    expect(service.hasCache(actorId)).toBe(false);

    await service.buildAdjacencyCache(actorId);
    const partsAfterCascade = service.getAllParts(bodyComponent, actorId);
    expect(partsAfterCascade).not.toContain(partIds.leftArm);
    expect(partsAfterCascade).not.toContain(partIds.leftHand);

    const armsAfterCascade = service.findPartsByType(actorId, 'arm');
    expect(armsAfterCascade).toEqual([partIds.rightArm]);

    await service.buildAdjacencyCache(actorId);
    const headDetach = await service.detachPart(partIds.head, {
      cascade: false,
      reason: 'surgery',
    });
    expect(headDetach).toEqual({
      detached: [partIds.head],
      parentId: partIds.torso,
      socketId: 'neck',
    });

    expect(eventDispatcher.dispatch).toHaveBeenCalledWith(
      LIMB_DETACHED_EVENT_ID,
      expect.objectContaining({
        detachedEntityId: partIds.head,
        detachedCount: 1,
        reason: 'surgery',
      })
    );

    await service.buildAdjacencyCache(actorId);
    const descendantsAfterHead = service.getAllDescendants(actorId);
    expect(descendantsAfterHead).not.toContain(partIds.head);
    expect(descendantsAfterHead).not.toContain(partIds.mouth);

    const floatingArm = await entityManager.createEntityInstance('test:arm', {
      instanceId: 'floating-arm',
    });
    await expect(service.detachPart(floatingArm.id)).rejects.toThrow(
      InvalidArgumentError
    );
  });
});
