/**
 * @file Integration tests for ActivityDescriptionService error handling and configuration fallbacks
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';
import ActivityDescriptionService from '../../../src/anatomy/services/activityDescriptionService.js';
import ActivityCacheManager from '../../../src/anatomy/cache/activityCacheManager.js';
import ActivityIndexManager from '../../../src/anatomy/services/activityIndexManager.js';
import ActivityMetadataCollectionSystem from '../../../src/anatomy/services/activityMetadataCollectionSystem.js';
import ActivityGroupingSystem from '../../../src/anatomy/services/grouping/activityGroupingSystem.js';
import ActivityNLGSystem from '../../../src/anatomy/services/activityNLGSystem.js';
import ActivityContextBuildingSystem from '../../../src/anatomy/services/context/activityContextBuildingSystem.js';

class FaultyActivityNLGSystem extends ActivityNLGSystem {
  generateActivityPhrase(actorRef, activity, usePronounsForTarget = false, options = {}) {
    const shouldThrow = activity?.activityMetadata?.triggerPhraseError;
    if (shouldThrow) {
      throw new Error('Simulated phrase failure');
    }

    return super.generateActivityPhrase(actorRef, activity, usePronounsForTarget, options);
  }

  buildRelatedActivityFragment(conjunction, phraseComponents, context) {
    if (phraseComponents?.fullPhrase?.includes('fragment-fail')) {
      throw new Error('Simulated fragment failure');
    }

    return super.buildRelatedActivityFragment(conjunction, phraseComponents, context);
  }
}

class AugmentedActivityGroupingSystem extends ActivityGroupingSystem {
  groupActivities(activities, cacheKey = null) {
    const groups = super.groupActivities(activities, cacheKey);

    if (groups.length > 0) {
      const [firstGroup, ...rest] = groups;
      const augmentedRelated = [null, ...firstGroup.relatedActivities];
      firstGroup.relatedActivities = augmentedRelated;
      return [firstGroup, ...rest];
    }

    return groups;
  }
}

describe('ActivityDescriptionService error handling integration', () => {
  let testBed;
  let entityManager;

  const registerTestComponents = () => {
    testBed.loadComponents({
      'test:blank_activity': {
        id: 'test:blank_activity',
        dataSchema: { type: 'object', properties: {} },
      },
      'test:primary': {
        id: 'test:primary',
        dataSchema: { type: 'object', properties: {} },
      },
      'test:related_throw': {
        id: 'test:related_throw',
        dataSchema: { type: 'object', properties: {} },
      },
      'test:related_fragment': {
        id: 'test:related_fragment',
        dataSchema: { type: 'object', properties: {} },
      },
      'test:activity_state_generic': {
        id: 'test:activity_state_generic',
        dataSchema: { type: 'object', properties: {} },
      },
    });
  };

  const createService = ({
    anatomyFormattingService = testBed.mockAnatomyFormattingService,
    nlgSystemClass = ActivityNLGSystem,
    groupingSystemClass = ActivityGroupingSystem,
    eventBus = null,
  } = {}) => {
    const cacheManager = new ActivityCacheManager({
      logger: testBed.mocks.logger,
      eventBus: null,
    });

    const indexManager = new ActivityIndexManager({
      cacheManager,
      logger: testBed.mocks.logger,
    });

    const metadataCollectionSystem = new ActivityMetadataCollectionSystem({
      entityManager: testBed.entityManager,
      logger: testBed.mocks.logger,
      activityIndex: null,
    });

    const groupingSystem = new groupingSystemClass({
      indexManager,
      logger: testBed.mocks.logger,
    });

    const nlgSystem = new nlgSystemClass({
      logger: testBed.mocks.logger,
      entityManager: testBed.entityManager,
      cacheManager,
    });

    const contextBuildingSystem = new ActivityContextBuildingSystem({
      entityManager: testBed.entityManager,
      logger: testBed.mocks.logger,
      nlgSystem,
    });

    return new ActivityDescriptionService({
      logger: testBed.mocks.logger,
      entityManager: testBed.entityManager,
      anatomyFormattingService,
      jsonLogicEvaluationService: { evaluate: jest.fn().mockReturnValue(true) },
      cacheManager,
      indexManager,
      metadataCollectionSystem,
      groupingSystem,
      nlgSystem,
      contextBuildingSystem,
      eventBus,
    });
  };

  beforeEach(() => {
    testBed = new AnatomyIntegrationTestBed();
    testBed.loadCoreTestData();
    registerTestComponents();
    entityManager = testBed.entityManager;
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('returns empty string when primary phrase resolves to blank output', async () => {
    const service = createService();

    const actor = await entityManager.createEntityInstance('core:actor', {
      instanceId: 'blank-actor',
    });
    entityManager.addComponent(actor.id, 'core:name', { text: 'Blank Actor' });

    const target = await entityManager.createEntityInstance('core:actor', {
      instanceId: 'target-actor',
    });
    entityManager.addComponent(target.id, 'core:name', { text: 'Target Actor' });

    entityManager.addComponent(actor.id, 'test:blank_activity', {
      entityId: 'target-actor',
      activityMetadata: {
        shouldDescribeInActivity: true,
        template: '   ',
        targetRole: 'entityId',
        priority: 60,
      },
    });

    const description = await service.generateActivityDescription(actor.id);

    expect(description).toBe('');

    service.destroy();
  });

  it('handles related activity failures and dispatches error events', async () => {
    const eventBus = {
      dispatch: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };

    const service = createService({
      nlgSystemClass: FaultyActivityNLGSystem,
      groupingSystemClass: AugmentedActivityGroupingSystem,
      eventBus,
    });

    const actor = await entityManager.createEntityInstance('core:actor', {
      instanceId: 'combatant',
    });
    entityManager.addComponent(actor.id, 'core:name', { text: 'Combatant' });

    const partner = await entityManager.createEntityInstance('core:actor', {
      instanceId: 'sparring-partner',
    });
    entityManager.addComponent(partner.id, 'core:name', { text: 'Partner' });

    entityManager.addComponent(actor.id, 'test:primary', {
      partner: 'sparring-partner',
      activityMetadata: {
        shouldDescribeInActivity: true,
        template: '{actor} is training with {target}',
        targetRole: 'partner',
        priority: 90,
        grouping: { groupKey: 'session' },
      },
    });

    entityManager.addComponent(actor.id, 'test:related_throw', {
      partner: 'sparring-partner',
      activityMetadata: {
        shouldDescribeInActivity: true,
        template: '{actor} is sparring with {target}',
        targetRole: 'partner',
        priority: 85,
        grouping: { groupKey: 'session' },
        triggerPhraseError: true,
      },
    });

    entityManager.addComponent(actor.id, 'test:related_fragment', {
      partner: 'sparring-partner',
      activityMetadata: {
        shouldDescribeInActivity: true,
        template: '{actor} experiences fragment-fail focus with {target}',
        targetRole: 'partner',
        priority: 80,
        grouping: { groupKey: 'session' },
      },
    });

    const description = await service.generateActivityDescription(actor.id);

    expect(description.startsWith('Activity:')).toBe(true);
    expect(description).toContain(
      'Combatant is training with fiercely Partner'
    );

    expect(eventBus.dispatch).toHaveBeenCalledWith({
      type: 'ACTIVITY_DESCRIPTION_ERROR',
      payload: expect.objectContaining({
        errorType: 'RELATED_ACTIVITY_FORMATTING_FAILED',
        entityId: 'combatant',
      }),
    });

    expect(eventBus.dispatch).toHaveBeenCalledWith({
      type: 'ACTIVITY_DESCRIPTION_ERROR',
      payload: expect.objectContaining({
        errorType: 'RELATED_ACTIVITY_FRAGMENT_FAILED',
        entityId: 'combatant',
      }),
    });

    service.destroy();
  });

  it('falls back to default formatting config when integration hook is missing', async () => {
    const formattingService = {};
    const service = createService({ anatomyFormattingService: formattingService });

    const actor = await entityManager.createEntityInstance('core:actor', {
      instanceId: 'configless-actor',
    });
    entityManager.addComponent(actor.id, 'core:name', { text: 'Configless Actor' });

    entityManager.addComponent(actor.id, 'test:activity_state_generic', {
      entityId: 'configless-actor',
      activityMetadata: {
        shouldDescribeInActivity: true,
        template: '{actor} contemplates quietly',
        targetRole: 'entityId',
        priority: 50,
      },
    });

    const description = await service.generateActivityDescription(actor.id);

    expect(description).toContain('Configless Actor contemplates quietly');

    service.destroy();
  });

  it('handles invalid configs, exposes cache hooks, and cleans up during destroy', async () => {
    const formattingService = {
      getActivityIntegrationConfig: jest
        .fn()
        .mockImplementationOnce(() => 'invalid')
        .mockImplementationOnce(() => {
          throw new Error('integration failure');
        })
        .mockImplementation(() => ({
          enabled: true,
          prefix: 'Activity: ',
        })),
    };

    const service = createService({ anatomyFormattingService: formattingService });

    const actor = await entityManager.createEntityInstance('core:actor', {
      instanceId: 'cache-actor',
    });
    entityManager.addComponent(actor.id, 'core:name', { text: 'Cache Actor' });

    entityManager.addComponent(actor.id, 'test:activity_state_generic', {
      entityId: 'cache-actor',
      activityMetadata: {
        shouldDescribeInActivity: true,
        template: '{actor} reflects on strategy',
        targetRole: 'entityId',
        priority: 60,
      },
    });

    const firstDescription = await service.generateActivityDescription(actor.id);
    expect(firstDescription).toBe(
      'Activity: Cache Actor reflects on strategy.'
    );

    const secondDescription = await service.generateActivityDescription(actor.id);
    expect(secondDescription).toBe(
      'Activity: Cache Actor reflects on strategy.'
    );

    const hooks = service.getTestHooks();

    hooks.setEntityNameCacheEntry('entityName:cache-actor', 'Cache Actor');
    hooks.setGenderCacheEntry('gender:cache-actor', 'nonbinary');
    hooks.setActivityIndexCacheEntry('activityIndex:cache-actor', {
      signature: 'test',
      index: { byPriority: [] },
    });
    hooks.setClosenessCacheEntry('closeness:cache-actor', ['partner']);
    hooks.setEntityNameCacheRawEntry('entityName:legacy', { value: 'Legacy' });

    const cacheSnapshot = hooks.getCacheSnapshot();
    expect(cacheSnapshot.entityName instanceof Map).toBe(true);
    expect(cacheSnapshot.entityName.size).toBeGreaterThan(0);

    service.invalidateCache(actor.id, 'unknown');

    hooks.addEventUnsubscriber(() => {
      throw new Error('unsubscribe failure');
    });

    service.clearAllCaches();
    service.destroy();

    expect(() => {
      hooks.setEntityNameCacheRawEntry('entityName:after-destroy', {
        value: 'after',
      });
    }).not.toThrow();

    const postDestroySnapshot = hooks.getCacheSnapshot();
    expect(postDestroySnapshot.entityName).toBeInstanceOf(Map);
    expect(postDestroySnapshot.entityName.size).toBe(0);

    service.invalidateCache(actor.id, 'name');
  });
});
