import BodyGraphService, {
  LIMB_DETACHED_EVENT_ID,
} from '../../../src/anatomy/bodyGraphService.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { SimpleEntityManager } from '../../common/entities/index.js';

class RecordingEventDispatcher {
  constructor() {
    this.events = [];
  }

  async dispatch(eventId, payload) {
    this.events.push({ eventId, payload });
    return true;
  }
}

const createLogger = () => {
  const entries = [];
  const record = (level) => (message, ...details) => {
    entries.push({ level, message, details });
  };

  return {
    entries,
    debug: record('debug'),
    info: record('info'),
    warn: record('warn'),
    error: record('error'),
  };
};

const createAnatomyFixture = () => {
  const ids = {
    actor: 'actor-integration',
    torso: 'torso-root',
    head: 'head-node',
    leftArm: 'arm-left',
    leftHand: 'hand-left',
    rightArm: 'arm-right',
    heart: 'heart-core',
  };

  const entityManager = new SimpleEntityManager([
    {
      id: ids.actor,
      components: {
        'anatomy:body': {
          recipeId: 'recipe:humanoid',
          body: { root: ids.torso },
          structure: { rootPartId: ids.torso },
        },
        'core:name': { text: 'Integration Actor' },
      },
    },
    {
      id: ids.torso,
      components: {
        'anatomy:part': { subType: 'torso' },
        'anatomy:joint': { parentId: ids.actor, socketId: 'core-socket' },
        'equipment:armor': { material: 'leather' },
      },
    },
    {
      id: ids.head,
      components: {
        'anatomy:part': { subType: 'head' },
        'anatomy:joint': { parentId: ids.torso, socketId: 'neck' },
        'appearance:face': { expression: 'focused' },
      },
    },
    {
      id: ids.leftArm,
      components: {
        'anatomy:part': { subType: 'arm' },
        'anatomy:joint': { parentId: ids.torso, socketId: 'left-shoulder' },
        'equipment:grip': { itemId: 'shield', stance: 'defensive' },
      },
    },
    {
      id: ids.leftHand,
      components: {
        'anatomy:part': { subType: 'hand' },
        'anatomy:joint': { parentId: ids.leftArm, socketId: 'left-wrist' },
        'sensation:touch': { sensitivity: { level: 8 } },
      },
    },
    {
      id: ids.rightArm,
      components: {
        'anatomy:part': { subType: 'arm' },
        'anatomy:joint': { parentId: ids.torso, socketId: 'right-shoulder' },
        'equipment:grip': {},
      },
    },
    {
      id: ids.heart,
      components: {
        'anatomy:part': { subType: 'heart' },
        'anatomy:joint': { parentId: ids.torso, socketId: 'chest-cavity' },
      },
    },
  ]);

  const logger = createLogger();
  const eventDispatcher = new RecordingEventDispatcher();

  const service = new BodyGraphService({
    entityManager,
    logger,
    eventDispatcher,
  });

  return { service, entityManager, logger, eventDispatcher, ids };
};

describe('BodyGraphService integration coverage', () => {
  it('traverses anatomy structures and caches results across blueprints and actors', async () => {
    const { service, entityManager, logger, eventDispatcher, ids } =
      createAnatomyFixture();

    expect(service.getAllParts(null)).toEqual([]);

    const bodyComponent = entityManager.getComponentData(
      ids.actor,
      'anatomy:body'
    );

    const preCacheParts = service.getAllParts(bodyComponent, ids.actor);
    expect(new Set(preCacheParts)).toEqual(
      new Set([ids.torso, ids.head, ids.leftArm, ids.leftHand, ids.rightArm, ids.heart])
    );

    await service.buildAdjacencyCache(ids.actor);
    await service.buildAdjacencyCache(ids.actor);

    expect(service.hasCache(ids.actor)).toBe(true);

    const allParts = service.getAllParts(bodyComponent, ids.actor);
    expect(allParts).toEqual(
      expect.arrayContaining([
        ids.torso,
        ids.head,
        ids.leftArm,
        ids.leftHand,
        ids.rightArm,
        ids.heart,
      ])
    );

    const structureOnlyParts = service.getAllParts({ root: ids.torso });
    const actorAwareSet = new Set(allParts);
    actorAwareSet.delete(ids.actor);
    expect(new Set(structureOnlyParts)).toEqual(actorAwareSet);

    const cachedParts = service.getAllParts(bodyComponent, ids.actor);
    expect(new Set(cachedParts)).toEqual(new Set(allParts));
    expect(
      logger.entries.some((entry) =>
        entry.message.includes('Found cached result for root')
      )
    ).toBe(true);

    const arms = service.findPartsByType(ids.actor, 'arm').sort();
    expect(arms).toEqual([ids.leftArm, ids.rightArm].sort());
    const cachedArms = service.findPartsByType(ids.actor, 'arm');
    expect(new Set(cachedArms)).toEqual(new Set(arms));

    const anatomyRoot = service.getAnatomyRoot(ids.leftHand);
    expect(anatomyRoot).toBe(ids.actor);

    const path = service.getPath(ids.leftHand, ids.head);
    expect(path).toEqual([ids.leftHand, ids.leftArm, ids.torso, ids.head]);

    expect(service.getParent(ids.torso)).toBe(ids.actor);
    expect(service.getParent(ids.actor)).toBeNull();

    const torsoChildren = service.getChildren(ids.torso).sort();
    const expectedTorsoChildren = [
      ids.head,
      ids.heart,
      ids.leftArm,
      ids.rightArm,
    ].sort();
    expect(torsoChildren).toEqual(expectedTorsoChildren);

    expect(service.getAncestors(ids.leftHand)).toEqual([
      ids.leftArm,
      ids.torso,
      ids.actor,
    ]);
    expect(service.getAncestors(ids.actor)).toEqual([]);

    const descendants = service.getAllDescendants(ids.torso).sort();
    const expectedDescendants = [
      ids.head,
      ids.heart,
      ids.leftArm,
      ids.leftHand,
      ids.rightArm,
    ].sort();
    expect(descendants).toEqual(expectedDescendants);
    expect(service.getAllDescendants(ids.head)).toEqual([]);

    expect(service.hasPartWithComponent(bodyComponent, 'equipment:grip')).toBe(
      true
    );
    expect(
      service.hasPartWithComponent(bodyComponent, 'nonexistent:component')
    ).toBe(false);

    expect(
      service.hasPartWithComponentValue(
        bodyComponent,
        'sensation:touch',
        'sensitivity.level',
        8
      )
    ).toEqual({ found: true, partId: ids.leftHand });
    expect(
      service.hasPartWithComponentValue(
        bodyComponent,
        'sensation:touch',
        'sensitivity.level',
        99
      )
    ).toEqual({ found: false });

    const { valid, issues } = service.validateCache();
    expect(valid).toBe(true);
    expect(issues).toHaveLength(0);

    const anatomyData = await service.getAnatomyData(ids.actor);
    expect(anatomyData).toEqual({
      recipeId: 'recipe:humanoid',
      rootEntityId: ids.actor,
    });

    await expect(service.getAnatomyData(null)).rejects.toThrow(
      InvalidArgumentError
    );
    await expect(service.getAnatomyData('missing-actor')).resolves.toBeNull();

    const graph = await service.getBodyGraph(ids.actor);
    expect(new Set(graph.getAllPartIds())).toEqual(new Set(allParts));
    expect(graph.getConnectedParts(ids.leftArm)).toEqual([ids.leftHand]);
    expect(graph.getConnectedParts(ids.head)).toEqual([]);

    await expect(service.getBodyGraph(null)).rejects.toThrow(
      InvalidArgumentError
    );
    await expect(service.getBodyGraph('missing-actor')).rejects.toThrow(
      /has no anatomy:body/
    );

    expect(eventDispatcher.events).toHaveLength(0);
  });

  it('detaches parts, invalidates caches, and surfaces errors for missing joints', async () => {
    const { service, entityManager, eventDispatcher, ids } =
      createAnatomyFixture();

    await service.buildAdjacencyCache(ids.actor);
    const bodyComponent = entityManager.getComponentData(
      ids.actor,
      'anatomy:body'
    );

    const detachResult = await service.detachPart(ids.leftArm, {
      cascade: true,
      reason: 'integration-test',
    });

    expect(detachResult.detached).toEqual(
      expect.arrayContaining([ids.leftArm, ids.leftHand])
    );
    expect(detachResult.parentId).toBe(ids.torso);
    expect(detachResult.socketId).toBe('left-shoulder');

    expect(service.hasCache(ids.actor)).toBe(false);
    expect(eventDispatcher.events).toHaveLength(1);
    expect(eventDispatcher.events[0]).toMatchObject({
      eventId: LIMB_DETACHED_EVENT_ID,
      payload: {
        detachedEntityId: ids.leftArm,
        parentEntityId: ids.torso,
        socketId: 'left-shoulder',
        detachedCount: 2,
        reason: 'integration-test',
      },
    });

    expect(entityManager.getComponentData(ids.leftArm, 'anatomy:joint')).toBeNull();

    await entityManager.addComponent(ids.leftArm, 'anatomy:joint', {
      parentId: ids.torso,
      socketId: 'left-shoulder',
    });
    await service.buildAdjacencyCache(ids.actor);

    const refreshedParts = service.getAllParts(bodyComponent, ids.actor);
    expect(new Set(refreshedParts).has(ids.leftArm)).toBe(true);

    entityManager.removeComponent(ids.heart, 'anatomy:joint');
    await expect(service.detachPart(ids.heart)).rejects.toThrow(
      /has no joint component/
    );
  });
});
