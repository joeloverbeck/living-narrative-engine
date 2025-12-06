import { describe, it, expect, jest } from '@jest/globals';
import ActivityDescriptionFacade from '../../../src/anatomy/services/activityDescriptionFacade.js';
import ActivityCacheManager from '../../../src/anatomy/cache/activityCacheManager.js';
import ActivityIndexManager from '../../../src/anatomy/services/activityIndexManager.js';
import ActivityMetadataCollectionSystem from '../../../src/anatomy/services/activityMetadataCollectionSystem.js';
import ActivityGroupingSystem from '../../../src/anatomy/services/grouping/activityGroupingSystem.js';
import ActivityNLGSystem from '../../../src/anatomy/services/activityNLGSystem.js';
import ActivityContextBuildingSystem from '../../../src/anatomy/services/context/activityContextBuildingSystem.js';
import ActivityFilteringSystem from '../../../src/anatomy/services/filtering/activityFilteringSystem.js';
import ActivityConditionValidator from '../../../src/anatomy/services/validation/activityConditionValidator.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import { AnatomyFormattingService } from '../../../src/services/anatomyFormattingService.js';
import EventBus from '../../../src/events/eventBus.js';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';
import handHoldingComponent from '../../../data/mods/hand-holding/components/holding_hand.component.json';
import closenessComponent from '../../../data/mods/positioning/components/closeness.component.json';

const FINAL_MOD_ORDER_KEY = 'final_mod_order';
const TEST_MOD_ID = 'integration_mod';

class ContextualGroupingAdapter {
  constructor({ contextSystem, nlgSystem, logger }) {
    this.contextSystem = contextSystem;
    this.nlgSystem = nlgSystem;
    this.logger = logger;
  }

  buildActivityContext(groups, entity) {
    if (!Array.isArray(groups) || groups.length === 0) {
      return [];
    }

    const actorId = entity?.id ?? null;
    const actorName = this.nlgSystem.resolveEntityName(actorId);
    const actorGender = this.nlgSystem.detectEntityGender(actorId);
    const actorPronouns = this.nlgSystem.getPronounSet(actorGender) ?? {
      subject: actorName,
      object: actorName,
      reflexive: actorName,
    };

    return groups
      .map((group, index) => {
        if (!group?.primaryActivity) {
          return null;
        }

        try {
          const primaryContext = this.contextSystem.buildActivityContext(
            actorId,
            group.primaryActivity
          );
          const contextualPrimary = this.contextSystem.applyContextualTone(
            group.primaryActivity,
            primaryContext
          );

          const usePronounForActor = index > 0;
          const actorReference = usePronounForActor
            ? actorPronouns.subject
            : actorName;

          const primaryPhraseResult = this.nlgSystem.generateActivityPhrase(
            actorReference,
            contextualPrimary,
            false,
            {
              actorId,
              actorName,
              actorPronouns,
              preferReflexivePronouns: true,
            }
          );

          const primaryPhrase =
            typeof primaryPhraseResult === 'string'
              ? primaryPhraseResult
              : (primaryPhraseResult?.fullPhrase ?? '');

          const relatedFragments = (group.relatedActivities ?? []).map(
            ({ activity, conjunction }) => {
              const relatedContext = this.contextSystem.buildActivityContext(
                actorId,
                activity
              );
              const contextualRelated = this.contextSystem.applyContextualTone(
                activity,
                relatedContext
              );

              const phraseComponents = this.nlgSystem.generateActivityPhrase(
                actorName,
                contextualRelated,
                true,
                {
                  actorId,
                  actorName,
                  actorPronouns,
                  omitActor: true,
                }
              );

              return this.nlgSystem.buildRelatedActivityFragment(
                conjunction,
                phraseComponents,
                {
                  actorName,
                  actorReference,
                  actorPronouns,
                  pronounsEnabled: true,
                }
              );
            }
          );

          const description = [primaryPhrase, ...relatedFragments]
            .filter(Boolean)
            .join(' ')
            .trim();

          if (!description) {
            return null;
          }

          return { description };
        } catch (error) {
          this.logger.warn('Context adapter failed to format group', error);
          return null;
        }
      })
      .filter(Boolean);
  }

  getTestHooks() {
    return {
      ...(this.contextSystem.getTestHooks?.() ?? {}),
      buildRawContext: (actorId, activity) =>
        this.contextSystem.buildActivityContext(actorId, activity),
    };
  }
}

class FacadeNLGAdapter {
  constructor(nlgSystem) {
    this.nlgSystem = nlgSystem;
  }

  formatActivityDescription(groups, _entity, config) {
    return this.nlgSystem.formatActivityDescription(groups, config ?? {});
  }

  getTestHooks() {
    return this.nlgSystem.getTestHooks?.() ?? {};
  }
}

/**
 *
 * @param id
 * @param properties
 */
function createComponentDefinition(id, properties = {}) {
  return {
    id,
    dataSchema: {
      type: 'object',
      additionalProperties: false,
      properties,
    },
  };
}

/**
 *
 * @param root0
 * @param root0.includeEventBus
 */
async function buildFacadeEnvironment({ includeEventBus = true } = {}) {
  const testBed = new AnatomyIntegrationTestBed();
  testBed.loadCoreTestData();

  testBed.loadComponents({
    'core:name': createComponentDefinition('core:name', {
      text: { type: 'string' },
    }),
    'core:gender': createComponentDefinition('core:gender', {
      value: { type: 'string' },
    }),
    [closenessComponent.id]: closenessComponent,
    [handHoldingComponent.id]: handHoldingComponent,
    'test:conditional_activity': {
      id: 'test:conditional_activity',
      dataSchema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          activityMetadata: { type: 'object' },
        },
      },
    },
    'test:simple_activity': {
      id: 'test:simple_activity',
      dataSchema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          activityMetadata: { type: 'object' },
        },
      },
    },
    'test:quiet_presence': {
      id: 'test:quiet_presence',
      dataSchema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          activityMetadata: { type: 'object' },
        },
      },
    },
  });

  testBed.registry.store('meta', FINAL_MOD_ORDER_KEY, [TEST_MOD_ID]);
  testBed.registry.store('anatomyFormatting', 'activity_integration', {
    id: 'activity_integration',
    _modId: TEST_MOD_ID,
    activityIntegration: {
      prefix: 'Activities: ',
      suffix: '!',
      separator: ' | ',
      maxActivities: 5,
      enableContextAwareness: true,
      nameResolution: {
        usePronounsWhenAvailable: true,
        fallbackToNames: true,
        respectGenderComponents: true,
      },
    },
  });

  const logger = testBed.mocks.logger;
  const eventBus = includeEventBus ? new EventBus({ logger }) : null;

  const anatomyFormattingService = new AnatomyFormattingService({
    dataRegistry: testBed.registry,
    logger,
    safeEventDispatcher: testBed.mocks.eventDispatcher,
  });
  anatomyFormattingService.initialize();

  const cacheManager = new ActivityCacheManager({
    logger,
    eventBus: eventBus ?? undefined,
  });
  const indexManager = new ActivityIndexManager({ cacheManager, logger });
  const metadataCollectionSystem = new ActivityMetadataCollectionSystem({
    entityManager: testBed.entityManager,
    logger,
  });
  const groupingSystem = new ActivityGroupingSystem({ indexManager, logger });
  const rawNlgSystem = new ActivityNLGSystem({
    logger,
    entityManager: testBed.entityManager,
    cacheManager,
  });
  const nlgSystem = new FacadeNLGAdapter(rawNlgSystem);
  const rawContextBuildingSystem = new ActivityContextBuildingSystem({
    entityManager: testBed.entityManager,
    logger,
    nlgSystem: rawNlgSystem,
  });
  const contextBuildingSystem = new ContextualGroupingAdapter({
    contextSystem: rawContextBuildingSystem,
    nlgSystem: rawNlgSystem,
    logger,
  });
  const conditionValidator = new ActivityConditionValidator({ logger });
  const jsonLogicEvaluationService = new JsonLogicEvaluationService({ logger });
  const filteringSystem = new ActivityFilteringSystem({
    logger,
    conditionValidator,
    jsonLogicEvaluationService,
    entityManager: testBed.entityManager,
  });

  const facade = new ActivityDescriptionFacade({
    logger,
    entityManager: testBed.entityManager,
    anatomyFormattingService,
    cacheManager,
    indexManager,
    metadataCollectionSystem,
    nlgSystem,
    groupingSystem,
    contextBuildingSystem,
    filteringSystem,
    eventBus,
  });

  const originalCollect = metadataCollectionSystem.collectActivityMetadata.bind(
    metadataCollectionSystem
  );
  metadataCollectionSystem.collectActivityMetadata = (
    entityArg,
    maybeEntity
  ) => {
    const entityInstance =
      maybeEntity || (typeof entityArg === 'object' ? entityArg : undefined);
    const entityId =
      typeof entityArg === 'string'
        ? entityArg
        : (entityInstance?.id ?? undefined);

    return originalCollect(entityId, entityInstance);
  };

  return {
    testBed,
    facade,
    logger,
    cacheManager,
    eventBus,
    metadataCollectionSystem,
    anatomyFormattingService,
    rawContextBuildingSystem,
    rawNlgSystem,
    groupingSystem,
    filteringSystem,
  };
}

describe('ActivityDescriptionFacade integration with real modules', () => {
  it('orchestrates production collaborators to generate contextual descriptions', async () => {
    const env = await buildFacadeEnvironment();
    try {
      const { testBed, facade, cacheManager } = env;
      const { entityManager } = testBed;

      const actor = await entityManager.createEntityInstance('core:actor', {
        instanceId: 'actor_alpha',
      });
      const partner = await entityManager.createEntityInstance('core:actor', {
        instanceId: 'partner_beta',
      });

      await entityManager.addComponent(actor.id, 'core:name', {
        text: 'Heroic Wanderer',
      });
      await entityManager.addComponent(actor.id, 'core:gender', {
        value: 'nonbinary',
      });
      await entityManager.addComponent(actor.id, 'positioning:closeness', {
        partners: [partner.id],
      });
      await entityManager.addComponent(actor.id, handHoldingComponent.id, {
        held_entity_id: partner.id,
        initiated: true,
        activityMetadata: {
          template: "{actor} warmly clasps {target}'s hand",
          shouldDescribeInActivity: true,
          priority: 92,
          targetRole: 'held_entity_id',
        },
      });

      await entityManager.addComponent(partner.id, 'core:name', {
        text: 'Companion Mira',
      });
      await entityManager.addComponent(partner.id, 'core:gender', {
        value: 'female',
      });

      expect(
        env.anatomyFormattingService.getActivityIntegrationConfig().prefix
      ).toBe('Activity: ');
      expect(actor.componentTypeIds).toContain(handHoldingComponent.id);
      const collectedMetadata =
        env.metadataCollectionSystem.collectActivityMetadata(actor.id, actor);
      expect(collectedMetadata).not.toHaveLength(0);
      expect(collectedMetadata[0].targetEntityId).toBe(partner.id);

      const description = await facade.generateActivityDescription(actor);

      expect(description).toContain('Activity:');
      expect(description).toContain('warmly clasps');
      expect(description).toMatch(/Companion Mira|her hand/);

      expect(cacheManager.get('entityName', actor.id)).toBe('Heroic Wanderer');
      expect(cacheManager.get('entityName', partner.id)).toBe('Companion Mira');
    } finally {
      await env.facade.destroy();
      jest.restoreAllMocks();
      await env.testBed.cleanup();
    }
  });

  it('returns an empty string when filtering removes all collected metadata', async () => {
    const env = await buildFacadeEnvironment();
    try {
      const { testBed, facade } = env;
      const { entityManager } = testBed;

      const actor = await entityManager.createEntityInstance('core:actor', {
        instanceId: 'actor_silent',
      });

      await entityManager.addComponent(actor.id, 'core:name', {
        text: 'Silent One',
      });
      await entityManager.addComponent(actor.id, 'test:quiet_presence', {
        activityMetadata: {
          template: '{actor} observes quietly',
          shouldDescribeInActivity: false,
        },
      });

      const description = await facade.generateActivityDescription(actor);
      expect(description).toBe('');
    } finally {
      await env.facade.destroy();
      jest.restoreAllMocks();
      await env.testBed.cleanup();
    }
  });

  it('dispatches a system error when collaborators throw during generation', async () => {
    const env = await buildFacadeEnvironment();
    try {
      const { testBed, facade, metadataCollectionSystem, eventBus } = env;
      const { entityManager } = testBed;
      const actor = await entityManager.createEntityInstance('core:actor', {
        instanceId: 'actor_error',
      });

      await entityManager.addComponent(actor.id, 'core:name', {
        text: 'Error Prone',
      });

      jest
        .spyOn(metadataCollectionSystem, 'collectActivityMetadata')
        .mockImplementation(() => {
          throw new Error('metadata failure');
        });
      const dispatchSpy = jest.spyOn(eventBus, 'dispatch');

      const description = await facade.generateActivityDescription(actor);

      expect(description).toBe('');
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'SYSTEM_ERROR_OCCURRED',
          payload: expect.objectContaining({
            errorType: 'ACTIVITY_DESCRIPTION_GENERATION_FAILED',
          }),
        })
      );
    } finally {
      await env.facade.destroy();
      jest.restoreAllMocks();
      await env.testBed.cleanup();
    }
  });

  it('exposes cache and lifecycle hooks backed by real cache manager', async () => {
    const env = await buildFacadeEnvironment();
    try {
      const { facade, cacheManager, anatomyFormattingService } = env;

      cacheManager.set('entityName', 'alpha', 'Alpha');
      cacheManager.set('gender', 'alpha', 'female');
      cacheManager.set('activityIndex', 'alpha', {
        index: { all: [] },
        signature: 'sig',
      });
      cacheManager.set('closeness', 'alpha', ['partner']);

      facade.invalidateCache('alpha');
      expect(cacheManager.get('entityName', 'alpha')).toBeUndefined();
      expect(cacheManager.get('gender', 'alpha')).toBeUndefined();
      expect(cacheManager.get('activityIndex', 'alpha')).toBeUndefined();
      expect(cacheManager.get('closeness', 'alpha')).toBeUndefined();

      cacheManager.set('entityName', 'beta', 'Beta');
      cacheManager.set('gender', 'beta', 'male');
      facade.invalidateEntities(['beta']);
      expect(cacheManager.get('entityName', 'beta')).toBeUndefined();

      cacheManager.set('entityName', 'gamma', 'Gamma');
      facade.clearAllCaches();
      expect(cacheManager.get('entityName', 'gamma')).toBeUndefined();

      cacheManager.set('entityName', 'hooked', 'Hooked');
      const hooks = facade.getTestHooks();
      hooks.clearAllCaches();
      expect(cacheManager.get('entityName', 'hooked')).toBeUndefined();

      cacheManager.set('entityName', 'hook-single', 'Hook Single');
      hooks.invalidateCache('hook-single');
      expect(cacheManager.get('entityName', 'hook-single')).toBeUndefined();

      cacheManager.set('entityName', 'hook-multi', 'Hook Multi');
      hooks.invalidateEntities(['hook-multi']);
      expect(cacheManager.get('entityName', 'hook-multi')).toBeUndefined();

      hooks.registerEventUnsubscriber(() => {});
      hooks.registerEventUnsubscriber(() => {
        throw new Error('unsubscribe failure');
      });

      jest
        .spyOn(anatomyFormattingService, 'getActivityIntegrationConfig')
        .mockImplementation(() => {
          throw new Error('formatting failure');
        });
      expect(hooks.getActivityIntegrationConfig()).toEqual({
        enabled: true,
        maxActivities: 5,
        includeRelatedActivities: true,
      });

      const destroySpy = jest.spyOn(cacheManager, 'destroy');
      facade.destroy();
      expect(destroySpy).toHaveBeenCalled();
    } finally {
      jest.restoreAllMocks();
      await env.testBed.cleanup();
    }
  });

  it('returns empty string when metadata conditions filter everything out', async () => {
    const env = await buildFacadeEnvironment();
    try {
      const { testBed, facade } = env;
      const actor = await testBed.entityManager.createEntityInstance(
        'core:actor',
        {
          instanceId: 'actor_conditions_filtered',
        }
      );

      await testBed.entityManager.addComponent(actor.id, 'core:name', {
        text: 'Conditionally Silent',
      });
      await testBed.entityManager.addComponent(
        actor.id,
        'test:conditional_activity',
        {
          activityMetadata: {
            template: '{actor} attempts to invoke a hidden rune',
            shouldDescribeInActivity: true,
            conditions: {
              requiredComponents: ['test:nonexistent_component'],
            },
          },
        }
      );

      const description = await facade.generateActivityDescription(actor);
      expect(description).toBe('');
    } finally {
      await env.facade.destroy();
      jest.restoreAllMocks();
      await env.testBed.cleanup();
    }
  });

  it('returns empty string when grouping system yields no activity groups', async () => {
    const env = await buildFacadeEnvironment();
    try {
      const { testBed, facade, groupingSystem } = env;
      const actor = await testBed.entityManager.createEntityInstance(
        'core:actor',
        {
          instanceId: 'actor_no_groups',
        }
      );

      await testBed.entityManager.addComponent(actor.id, 'core:name', {
        text: 'Ungrouped Performer',
      });
      await testBed.entityManager.addComponent(
        actor.id,
        'test:simple_activity',
        {
          activityMetadata: {
            template: '{actor} hums a solitary tune',
            shouldDescribeInActivity: true,
          },
        }
      );

      const groupingSpy = jest
        .spyOn(groupingSystem, 'groupActivities')
        .mockReturnValue([]);

      const description = await facade.generateActivityDescription(actor);

      expect(groupingSpy).toHaveBeenCalled();
      expect(description).toBe('');
    } finally {
      await env.facade.destroy();
      jest.restoreAllMocks();
      await env.testBed.cleanup();
    }
  });

  it('does not dispatch errors when event bus is unavailable', async () => {
    const env = await buildFacadeEnvironment({ includeEventBus: false });
    try {
      const { testBed, facade, metadataCollectionSystem } = env;
      const actor = await testBed.entityManager.createEntityInstance(
        'core:actor',
        {
          instanceId: 'actor_no_event_bus',
        }
      );

      await testBed.entityManager.addComponent(actor.id, 'core:name', {
        text: 'Disconnected Actor',
      });

      jest
        .spyOn(metadataCollectionSystem, 'collectActivityMetadata')
        .mockImplementation(() => {
          throw new Error('metadata failure without bus');
        });

      const description = await facade.generateActivityDescription(actor);
      expect(description).toBe('');
    } finally {
      await env.facade.destroy();
      jest.restoreAllMocks();
      await env.testBed.cleanup();
    }
  });

  it('warns when event bus dispatch throws during error handling', async () => {
    const env = await buildFacadeEnvironment();
    try {
      const { testBed, facade, metadataCollectionSystem, eventBus } = env;
      const actor = await testBed.entityManager.createEntityInstance(
        'core:actor',
        {
          instanceId: 'actor_dispatch_failure',
        }
      );

      await testBed.entityManager.addComponent(actor.id, 'core:name', {
        text: 'Dispatcher',
      });

      jest
        .spyOn(metadataCollectionSystem, 'collectActivityMetadata')
        .mockImplementation(() => {
          throw new Error('metadata failure with bus');
        });

      const dispatchSpy = jest
        .spyOn(eventBus, 'dispatch')
        .mockImplementation(() => {
          throw new Error('dispatch boom');
        });

      const description = await facade.generateActivityDescription(actor);
      expect(description).toBe('');
      expect(dispatchSpy).toHaveBeenCalled();
    } finally {
      await env.facade.destroy();
      jest.restoreAllMocks();
      await env.testBed.cleanup();
    }
  });

  it('handles cache lifecycle errors gracefully', async () => {
    const env = await buildFacadeEnvironment();
    try {
      const { facade, cacheManager } = env;

      const clearAllSpy = jest
        .spyOn(cacheManager, 'clearAll')
        .mockImplementation(() => {
          throw new Error('clear failure');
        });
      expect(() => facade.clearAllCaches()).not.toThrow();
      expect(clearAllSpy).toHaveBeenCalled();

      jest.spyOn(cacheManager, 'invalidate').mockImplementation(() => {
        throw new Error('invalidate failure');
      });

      facade.invalidateCache();
      facade.invalidateCache('entity_error');
      facade.invalidateEntities([]);
    } finally {
      await env.facade.destroy();
      jest.restoreAllMocks();
      await env.testBed.cleanup();
    }
  });

  it('logs errors when cache manager destroy fails', async () => {
    const env = await buildFacadeEnvironment();
    let destroyed = false;
    try {
      const { facade, cacheManager } = env;
      const originalDestroy = cacheManager.destroy.bind(cacheManager);
      const destroySpy = jest
        .spyOn(cacheManager, 'destroy')
        .mockImplementation(() => {
          throw new Error('destroy failure');
        });

      expect(() => facade.destroy()).not.toThrow();
      destroyed = true;
      destroySpy.mockRestore();
      await originalDestroy();
    } finally {
      jest.restoreAllMocks();
      if (!destroyed) {
        await env.facade.destroy();
      }
      await env.testBed.cleanup();
    }
  });
});
