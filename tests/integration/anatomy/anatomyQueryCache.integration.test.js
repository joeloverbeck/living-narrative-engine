import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { BodyGraphService } from '../../../src/anatomy/bodyGraphService.js';
import {
  AnatomyQueryCache,
  CacheKeyGenerators,
} from '../../../src/anatomy/cache/AnatomyQueryCache.js';
import SimplifiedAnatomyTestBed from '../../common/anatomy/simplifiedAnatomyTestBed.js';

/**
 * Builds a compact anatomy structure using the real EntityManager so that
 * BodyGraphService and AnatomyQueryCache interact exactly as they do at runtime.
 *
 * @param {SimplifiedAnatomyTestBed} testBed
 * @returns {Promise<{
 *   actorId: string,
 *   bodyComponent: object,
 *   parts: { root: string, arm: string, hand: string }
 * }>}
 */
async function createMinimalAnatomy(testBed) {
  const actor = await testBed.entityManager.createEntityInstance('core:actor');

  const createPart = async (
    definitionId,
    partData,
    jointData = null,
    extras = {}
  ) => {
    const part = await testBed.entityManager.createEntityInstance(definitionId);
    await testBed.entityManager.addComponent(part.id, 'anatomy:part', partData);
    if (jointData) {
      await testBed.entityManager.addComponent(
        part.id,
        'anatomy:joint',
        jointData
      );
    }
    for (const [componentId, data] of Object.entries(extras)) {
      await testBed.entityManager.addComponent(part.id, componentId, data);
    }
    return part;
  };

  const torso = await createPart(
    'anatomy:torso',
    { subType: 'torso' },
    { parentId: actor.id, socketId: 'core' }
  );
  const arm = await createPart(
    'anatomy:arm',
    { subType: 'arm' },
    { parentId: torso.id, socketId: 'shoulder' }
  );
  const hand = await createPart(
    'anatomy:hand',
    { subType: 'hand' },
    { parentId: arm.id, socketId: 'wrist' },
    { 'custom:tag': { label: 'primary' } }
  );

  const bodyComponent = {
    recipeId: 'integration:test',
    body: {
      root: torso.id,
      parts: {
        torso: torso.id,
        arm: arm.id,
        hand: hand.id,
      },
    },
    structure: { rootPartId: torso.id },
  };

  await testBed.entityManager.addComponent(
    actor.id,
    'anatomy:body',
    bodyComponent
  );

  return {
    actorId: actor.id,
    bodyComponent,
    parts: { root: torso.id, arm: arm.id, hand: hand.id },
  };
}

describe('AnatomyQueryCache integration', () => {
  /** @type {SimplifiedAnatomyTestBed} */
  let testBed;
  /** @type {AnatomyQueryCache} */
  let queryCache;
  /** @type {BodyGraphService} */
  let bodyGraphService;
  /** @type {string} */
  let actorId;
  /** @type {object} */
  let bodyComponent;
  /** @type {{ root: string, arm: string, hand: string }} */
  let parts;

  beforeEach(async () => {
    testBed = new SimplifiedAnatomyTestBed();
    await testBed.setup();

    testBed.loadMinimalComponents();
    testBed.loadComponents({
      'anatomy:joint': { id: 'anatomy:joint' },
      'custom:tag': { id: 'custom:tag' },
    });

    testBed.loadMinimalEntityDefinitions();
    testBed.loadEntityDefinitions({
      'anatomy:torso': {
        id: 'anatomy:torso',
        components: { 'anatomy:part': { subType: 'torso' } },
      },
      'anatomy:arm': {
        id: 'anatomy:arm',
        components: { 'anatomy:part': { subType: 'arm' } },
      },
      'anatomy:hand': {
        id: 'anatomy:hand',
        components: { 'anatomy:part': { subType: 'hand' } },
      },
    });

    const anatomy = await createMinimalAnatomy(testBed);
    actorId = anatomy.actorId;
    bodyComponent = anatomy.bodyComponent;
    parts = anatomy.parts;

    queryCache = new AnatomyQueryCache(
      { logger: testBed.logger },
      { maxSize: 32, ttl: 5_000 }
    );

    bodyGraphService = new BodyGraphService({
      entityManager: testBed.entityManager,
      logger: testBed.logger,
      eventDispatcher: testBed.eventDispatcher,
      queryCache,
    });

    await bodyGraphService.buildAdjacencyCache(actorId);
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  it('reuses cached results for repeated BodyGraphService lookups', () => {
    const firstAll = bodyGraphService.getAllParts(bodyComponent, actorId);
    const secondAll = bodyGraphService.getAllParts(bodyComponent, actorId);

    expect(secondAll).toBe(firstAll);
    expect(queryCache.getStats().size).toBeGreaterThanOrEqual(1);

    const firstHands = bodyGraphService.findPartsByType(actorId, 'hand');
    const cachedHands = bodyGraphService.findPartsByType(actorId, 'hand');

    expect(cachedHands).toBe(firstHands);
    const cacheKey = CacheKeyGenerators.findPartsByType(actorId, 'hand');
    expect(queryCache.has(cacheKey)).toBe(true);

    const debugMessages = testBed.logger.debug.mock.calls.map(
      ([message]) => message
    );
    expect(
      debugMessages.some(
        (message) =>
          typeof message === 'string' &&
          message.includes("AnatomyQueryCache: Cache hit for key '")
      )
    ).toBe(true);
  });

  it('invalidates cached anatomy queries when structure changes', async () => {
    bodyGraphService.getAllParts(bodyComponent, actorId);
    bodyGraphService.findPartsByType(actorId, 'hand');

    await bodyGraphService.detachPart(parts.hand, {
      cascade: false,
      reason: 'integration',
    });

    expect(queryCache.getCachedGetAllParts(actorId)).toBeUndefined();
    expect(
      queryCache.getCachedFindPartsByType(actorId, 'hand')
    ).toBeUndefined();

    await bodyGraphService.buildAdjacencyCache(actorId);
    const rebuilt = bodyGraphService.getAllParts(bodyComponent, actorId);
    expect(rebuilt).not.toContain(parts.hand);
  });

  it('offers manual cache control utilities for multiple roots', () => {
    const otherRootKey = CacheKeyGenerators.findPartsByType(
      'other-root',
      'finger'
    );
    queryCache.cacheFindPartsByType(actorId, 'hand', ['hand-1']);
    queryCache.cacheFindPartsByType('other-root', 'finger', ['finger-1']);
    queryCache.cacheGetAllParts(actorId, ['actor', 'torso']);

    const componentKey = CacheKeyGenerators.hasPartWithComponent(
      actorId,
      'custom:tag'
    );
    queryCache.set(componentKey, true, actorId);

    const componentValueKey = CacheKeyGenerators.hasPartWithComponentValue(
      actorId,
      'custom:tag',
      'label',
      'primary'
    );
    queryCache.set(componentValueKey, { found: true }, actorId);

    expect(queryCache.has(otherRootKey)).toBe(true);
    expect(queryCache.getStats().size).toBeGreaterThanOrEqual(3);

    queryCache.invalidateRoot(actorId);

    expect(
      queryCache.getCachedFindPartsByType(actorId, 'hand')
    ).toBeUndefined();
    expect(queryCache.getCachedGetAllParts(actorId)).toBeUndefined();
    expect(queryCache.getCachedFindPartsByType('other-root', 'finger')).toEqual(
      ['finger-1']
    );
    expect(queryCache.get(componentKey)).toBeUndefined();
    expect(queryCache.get(componentValueKey)).toBeUndefined();

    const pathKey = CacheKeyGenerators.getPath('a', 'b');
    queryCache.set(pathKey, ['a', 'b'], 'other-root');
    expect(queryCache.get(pathKey)).toEqual(['a', 'b']);

    queryCache.clear();
    expect(queryCache.getStats().size).toBe(0);
  });
});

describe('AnatomyQueryCache constructor validation', () => {
  it('throws when logger dependency is missing', () => {
    expect(() => new AnatomyQueryCache({})).toThrow('logger is required');
  });

  it('uses default cache sizing when options are not provided', () => {
    const logger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const cache = new AnatomyQueryCache({ logger });

    expect(logger.info).toHaveBeenCalledWith(
      'AnatomyQueryCache: Initialized with maxSize=1000, ttl=300000ms'
    );
    expect(cache.getStats()).toEqual({ size: 0, maxSize: 1000, hitRate: 0 });
  });
});
