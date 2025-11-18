import { BodyGraphService } from '../../../src/anatomy/bodyGraphService.js';
import { SimpleEntityManager } from '../../common/entities/index.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

/**
 *
 */
function createRecordingLogger() {
  const entries = [];
  const record =
    (level) =>
    (message, ...details) => {
      entries.push({ level, message, details });
    };

  return {
    entries,
    debug: record('debug'),
    info: record('info'),
    warn: record('warn'),
    error: record('error'),
  };
}

/**
 *
 */
function createRecordingDispatcher() {
  const events = [];
  return {
    events,
    async dispatch(eventId, payload, options) {
      events.push({ eventId, payload, options });
      return true;
    },
  };
}

describe('BodyGraphService dependency validation edge cases', () => {
  it('enforces required collaborators before wiring caches', () => {
    const logger = createRecordingLogger();
    const dispatcher = createRecordingDispatcher();
    const entityManager = new SimpleEntityManager();

    expect(
      () => new BodyGraphService({ logger, eventDispatcher: dispatcher })
    ).toThrow(new InvalidArgumentError('entityManager is required'));

    expect(
      () =>
        new BodyGraphService({
          entityManager,
          eventDispatcher: dispatcher,
        })
    ).toThrow(new InvalidArgumentError('logger is required'));

    expect(
      () =>
        new BodyGraphService({
          entityManager,
          logger,
        })
    ).toThrow(new InvalidArgumentError('eventDispatcher is required'));
  });

  it('handles missing body components gracefully and still orchestrates cache-backed lookups', async () => {
    const entityManager = new SimpleEntityManager();
    const logger = createRecordingLogger();
    const dispatcher = createRecordingDispatcher();
    const service = new BodyGraphService({
      entityManager,
      logger,
      eventDispatcher: dispatcher,
    });

    const actorId = 'actor-edge';
    const rootId = 'torso-edge';
    const limbId = 'limb-edge';

    await entityManager.addComponent(rootId, 'anatomy:part', {
      partType: 'torso',
    });
    await entityManager.addComponent(limbId, 'anatomy:part', {
      partType: 'limb',
    });
    await entityManager.addComponent(limbId, 'anatomy:joint', {
      parentId: rootId,
      socketId: 'shoulder',
    });
    await entityManager.addComponent(actorId, 'anatomy:body', {
      recipeId: 'integration-edge',
      body: {
        root: rootId,
        parts: {
          torso: rootId,
          limb: limbId,
        },
      },
    });

    const emptyParts = service.getAllParts(null);
    expect(emptyParts).toEqual([]);
    expect(
      logger.entries.some(
        (entry) =>
          entry.level === 'debug' &&
          entry.message ===
            'BodyGraphService.getAllParts: No bodyComponent provided'
      )
    ).toBe(true);

    await service.buildAdjacencyCache(rootId);
    expect(service.hasCache(rootId)).toBe(true);
    expect(service.hasCache(actorId)).toBe(false);

    const actorBody = entityManager.getComponentData(actorId, 'anatomy:body');
    const firstResult = service.getAllParts(actorBody, actorId);
    expect(firstResult).toEqual(expect.arrayContaining([rootId, limbId]));
    expect(firstResult.length).toBe(2);

    expect(
      logger.entries.some(
        (entry) =>
          entry.level === 'debug' &&
          entry.message ===
            "BodyGraphService: Using blueprint root 'torso-edge' as cache root (actor 'actor-edge' not in cache, cache size: 2)"
      )
    ).toBe(true);

    const secondResult = service.getAllParts(actorBody, actorId);
    expect(secondResult).toBe(firstResult);
    expect(
      logger.entries.some(
        (entry) =>
          entry.level === 'debug' &&
          entry.message ===
            "BodyGraphService: Found cached result for root 'torso-edge': 2 parts"
      )
    ).toBe(true);
  });
});
