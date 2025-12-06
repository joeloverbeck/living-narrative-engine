import { describe, it, expect, beforeEach } from '@jest/globals';
import BodyGraphService, {
  LIMB_DETACHED_EVENT_ID,
} from '../../../src/anatomy/bodyGraphService.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { SimpleEntityManager } from '../../common/entities/index.js';

/**
 * @description Minimal logger that captures log messages for assertions.
 */
class RecordingLogger {
  constructor() {
    this.entries = [];
  }

  /**
   * @param {string} level
   * @param {string} message
   * @param {...any} details
   */
  #record(level, message, ...details) {
    this.entries.push({ level, message, details });
  }

  debug(message, ...details) {
    this.#record('debug', message, ...details);
  }

  info(message, ...details) {
    this.#record('info', message, ...details);
  }

  warn(message, ...details) {
    this.#record('warn', message, ...details);
  }

  error(message, ...details) {
    this.#record('error', message, ...details);
  }
}

/**
 * @description Simple dispatcher that records emitted events.
 */
class RecordingDispatcher {
  constructor() {
    this.events = [];
  }

  async dispatch(eventId, payload, options) {
    this.events.push({ eventId, payload, options });
    return true;
  }
}

describe('BodyGraphService integration – dependency validation', () => {
  it('requires entity manager, logger and dispatcher instances', () => {
    const entityManager = new SimpleEntityManager();
    const logger = new RecordingLogger();
    const dispatcher = new RecordingDispatcher();

    expect(
      () => new BodyGraphService({ logger, eventDispatcher: dispatcher })
    ).toThrow(new InvalidArgumentError('entityManager is required'));

    expect(
      () => new BodyGraphService({ entityManager, eventDispatcher: dispatcher })
    ).toThrow(new InvalidArgumentError('logger is required'));

    expect(() => new BodyGraphService({ entityManager, logger })).toThrow(
      new InvalidArgumentError('eventDispatcher is required')
    );
  });
});

describe('BodyGraphService integration – cache fallbacks and guards', () => {
  let entityManager;
  let logger;
  let dispatcher;
  let service;

  const actorId = 'actor-additional';
  const torsoId = 'torso-additional';
  const floatingId = 'floating-part';
  const looseRootId = 'loose-root';

  beforeEach(async () => {
    entityManager = new SimpleEntityManager();
    logger = new RecordingLogger();
    dispatcher = new RecordingDispatcher();
    service = new BodyGraphService({
      entityManager,
      logger,
      eventDispatcher: dispatcher,
    });

    await entityManager.addComponent(actorId, 'anatomy:body', {
      body: { root: torsoId },
    });

    await entityManager.addComponent(torsoId, 'anatomy:part', {
      subType: 'torso',
    });
    await entityManager.addComponent(torsoId, 'anatomy:joint', {
      parentId: actorId,
      socketId: 'core',
    });
    await entityManager.addComponent(torsoId, 'custom:status', { aura: {} });

    await entityManager.addComponent(floatingId, 'anatomy:part', {
      subType: 'floating',
    });
    await entityManager.addComponent(floatingId, 'anatomy:joint', {
      parentId: null,
      socketId: 'loose',
    });
    await entityManager.addComponent(floatingId, 'custom:status', {
      aura: { intensity: 'low' },
    });
  });

  it('returns empty results when body data is missing or lacks a root reference', () => {
    expect(service.getAllParts(null)).toEqual([]);
    expect(service.getAllParts(undefined)).toEqual([]);
    expect(service.getAllParts({})).toEqual([]);
    expect(service.getAllParts({ body: {} })).toEqual([]);
    expect(service.getChildren(null)).toEqual([]);
  });

  it('leaves caches untouched when detaching a part with no discoverable root', async () => {
    await service.buildAdjacencyCache(torsoId);
    expect(service.hasCache(torsoId)).toBe(true);

    const result = await service.detachPart(floatingId, {
      cascade: false,
      reason: 'no-root',
    });

    expect(result.detached).toEqual([floatingId]);
    expect(result.parentId).toBeNull();
    expect(result.socketId).toBe('loose');

    expect(dispatcher.events).toHaveLength(1);
    expect(dispatcher.events[0].eventId).toBe(LIMB_DETACHED_EVENT_ID);
    expect(dispatcher.events[0].payload.detachedCount).toBe(1);

    expect(service.hasCache(torsoId)).toBe(true);
  });

  it('provides safe fallbacks for cache lookups and missing metadata', async () => {
    expect(service.getChildren('unknown-node')).toEqual([]);

    await entityManager.addComponent(looseRootId, 'anatomy:part', {
      subType: 'phantom',
    });
    await entityManager.addComponent('actor-no-recipe', 'anatomy:body', {
      body: { root: looseRootId },
    });

    const anatomyData = await service.getAnatomyData('actor-no-recipe');
    expect(anatomyData).toEqual({
      recipeId: null,
      rootEntityId: 'actor-no-recipe',
    });

    await service.buildAdjacencyCache(torsoId);
    await service.buildAdjacencyCache(actorId);

    expect(service.getChildren('unknown-node')).toEqual([]);
    expect(service.getParent('unknown-node')).toBeNull();
    expect(service.getAncestors('unknown-node')).toEqual([]);

    await service.detachPart(torsoId, {
      cascade: true,
      reason: 'invalidate-cache',
    });
    expect(service.hasCache(actorId)).toBe(false);
    expect(service.getChildren(actorId)).toEqual([]);
  });

  it('handles missing nested component values when traversing anatomy parts', async () => {
    await service.buildAdjacencyCache(torsoId);
    const bodyComponent = await entityManager.getComponentData(
      actorId,
      'anatomy:body'
    );

    const result = service.hasPartWithComponentValue(
      bodyComponent,
      'custom:status',
      'aura.mood',
      'calm'
    );

    expect(result).toEqual({ found: false });
    expect(service.getChildren(floatingId)).toEqual([]);
  });
});
