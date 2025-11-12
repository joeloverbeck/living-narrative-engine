import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';
import ActivityDescriptionService from '../../../src/anatomy/services/activityDescriptionService.js';
import ActivityCacheManager from '../../../src/anatomy/cache/activityCacheManager.js';
import ActivityIndexManager from '../../../src/anatomy/services/activityIndexManager.js';
import ActivityMetadataCollectionSystem from '../../../src/anatomy/services/activityMetadataCollectionSystem.js';
import ActivityGroupingSystem from '../../../src/anatomy/services/grouping/activityGroupingSystem.js';
import ActivityNLGSystem from '../../../src/anatomy/services/activityNLGSystem.js';
import ActivityContextBuildingSystem from '../../../src/anatomy/services/context/activityContextBuildingSystem.js';

class ThrowingContextBuildingSystem extends ActivityContextBuildingSystem {
  buildActivityContext(actorId, activity) {
    if (activity?.template?.includes('context failure')) {
      throw new Error('context building explosion');
    }
    return super.buildActivityContext(actorId, activity);
  }
}

class PrimaryFailureNLGSystem extends ActivityNLGSystem {
  generateActivityPhrase(actorReference, activity, usePronoun, options = {}) {
    if (activity?.sourceComponent === 'test:primary_failure') {
      throw new Error('primary phrase failure');
    }
    return super.generateActivityPhrase(actorReference, activity, usePronoun, options);
  }
}

describe('ActivityDescriptionService uncovered branch integration', () => {
  let testBed;

  beforeEach(() => {
    testBed = new AnatomyIntegrationTestBed();
    testBed.loadCoreTestData();
    testBed.loadComponents({
      'test:activity_simple': {
        id: 'test:activity_simple',
        dataSchema: { type: 'object', properties: {} },
      },
      'test:activity_duplicate_one': {
        id: 'test:activity_duplicate_one',
        dataSchema: { type: 'object', properties: {} },
      },
      'test:activity_duplicate_two': {
        id: 'test:activity_duplicate_two',
        dataSchema: { type: 'object', properties: {} },
      },
      'test:activity_conditions': {
        id: 'test:activity_conditions',
        dataSchema: { type: 'object', properties: {} },
      },
      'test:activity_context': {
        id: 'test:activity_context',
        dataSchema: { type: 'object', properties: {} },
      },
      'test:primary_failure': {
        id: 'test:primary_failure',
        dataSchema: { type: 'object', properties: {} },
      },
    });
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  const createService = ({
    groupingFactory,
    contextFactory,
    nlgFactory,
    formattingOverride,
    eventBus,
    filteringSystem,
  } = {}) => {
    const jsonLogicEvaluationService = {
      evaluate: jest.fn().mockReturnValue(true),
    };

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

    const baseGroupingSystem = new ActivityGroupingSystem({
      indexManager,
      logger: testBed.mocks.logger,
    });
    const groupingSystem = groupingFactory
      ? groupingFactory({ baseGroupingSystem })
      : baseGroupingSystem;

    const baseNlgSystem = new ActivityNLGSystem({
      logger: testBed.mocks.logger,
      entityManager: testBed.entityManager,
      cacheManager,
    });
    const nlgSystem = nlgFactory
      ? nlgFactory({ baseNlgSystem, cacheManager })
      : baseNlgSystem;

    const formattingService = formattingOverride
      ? {
          ...testBed.mockAnatomyFormattingService,
          getActivityIntegrationConfig: () => ({
            ...testBed.mockAnatomyFormattingService.getActivityIntegrationConfig(),
            ...formattingOverride,
          }),
        }
      : testBed.mockAnatomyFormattingService;

    const contextBuildingSystem = contextFactory
      ? contextFactory({
          entityManager: testBed.entityManager,
          logger: testBed.mocks.logger,
          nlgSystem,
        })
      : undefined;

    const service = new ActivityDescriptionService({
      logger: testBed.mocks.logger,
      entityManager: testBed.entityManager,
      anatomyFormattingService: formattingService,
      jsonLogicEvaluationService,
      cacheManager,
      indexManager,
      metadataCollectionSystem,
      groupingSystem,
      nlgSystem,
      ...(contextBuildingSystem ? { contextBuildingSystem } : {}),
      ...(filteringSystem ? { filteringSystem } : {}),
      ...(eventBus ? { eventBus } : {}),
    });

    return {
      service,
      cacheManager,
      groupingSystem,
      nlgSystem,
      metadataCollectionSystem,
    };
  };

  const createActor = async (id = 'jon') => {
    const actor = await testBed.entityManager.createEntityInstance('core:actor', {
      instanceId: id,
    });
    testBed.entityManager.addComponent(actor.id, 'core:name', {
      text: 'Jon Ureña',
    });
    testBed.entityManager.addComponent(actor.id, 'core:gender', {
      value: 'male',
    });
    return actor;
  };

  const addInlineActivity = (entityId, componentId, metadata, extra = {}) => {
    testBed.entityManager.addComponent(entityId, componentId, {
      ...extra,
      activityMetadata: {
        shouldDescribeInActivity: true,
        template: metadata.template,
        priority: metadata.priority ?? 50,
        ...(metadata.conditions ? { conditions: metadata.conditions } : {}),
      },
    });
  };

  it('returns empty description when component inspection fails and no activities are collected', async () => {
    const { service } = createService();
    const actor = await createActor('inspection');

    Object.defineProperty(actor, 'componentTypeIds', {
      configurable: true,
      get() {
        throw new Error('componentTypeIds unavailable');
      },
    });

    testBed.mocks.logger.warn.mockClear();
    testBed.mocks.logger.debug.mockClear();

    const description = await service.generateActivityDescription(actor.id);

    expect(description).toBe('');
    expect(testBed.mocks.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Failed to inspect componentTypeIds'),
      expect.any(Error)
    );
    expect(testBed.mocks.logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('No activities found for entity: inspection')
    );
  });

  it('filters out activities when required component conditions fail', async () => {
    const { service } = createService();
    const actor = await createActor('conditions');

    addInlineActivity(actor.id, 'test:activity_conditions', {
      template: '{actor} attempts a restricted action',
      conditions: {
        requiredComponents: ['test:missing_requirement'],
      },
    });

    testBed.mocks.logger.debug.mockClear();

    const description = await service.generateActivityDescription(actor.id);

    expect(description).toBe('');
    expect(testBed.mocks.logger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        'No visible activities available after filtering for entity: conditions'
      )
    );
  });

  it('deduplicates matching activities and logs the deduplication summary', async () => {
    const { service } = createService();
    const actor = await createActor('dedupe');

    addInlineActivity(actor.id, 'test:activity_duplicate_one', {
      template: '{actor} is resting',
      priority: 90,
    });
    addInlineActivity(actor.id, 'test:activity_duplicate_two', {
      template: '{actor} is resting',
      priority: 40,
    });

    testBed.mocks.logger.debug.mockClear();

    const description = await service.generateActivityDescription(actor.id);

    expect(description).toContain('Activity:');
    expect(testBed.mocks.logger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        'Deduplicated 1 duplicate activities for entity: dedupe'
      )
    );
  });

  it('falls back to original activity when contextual tone application fails', async () => {
    const { service } = createService({
      contextFactory: (deps) => new ThrowingContextBuildingSystem(deps),
    });
    const actor = await createActor('context');
    const target = await testBed.entityManager.createEntityInstance('core:actor', {
      instanceId: 'ane',
    });
    testBed.entityManager.addComponent(target.id, 'core:name', { text: 'Ane Arrieta' });
    testBed.entityManager.addComponent(target.id, 'core:gender', { value: 'female' });

    addInlineActivity(
      actor.id,
      'test:activity_context',
      { template: '{actor} experiences a context failure' },
      { entityId: target.id }
    );

    testBed.mocks.logger.warn.mockClear();

    const description = await service.generateActivityDescription(actor.id);

    expect(description).toContain('context failure');
    expect(testBed.mocks.logger.warn).toHaveBeenCalledWith(
      'Failed to apply contextual tone to activity',
      expect.any(Error)
    );
  });

  it('accepts iterable grouping results produced by real grouping system wrappers', async () => {
    const { service, groupingSystem } = createService({
      groupingFactory: ({ baseGroupingSystem }) => {
        const original = baseGroupingSystem.groupActivities.bind(baseGroupingSystem);
        baseGroupingSystem.groupActivities = (activities, cacheKey) => {
          const groups = original(activities, cacheKey);
          return new Set(groups);
        };
        return baseGroupingSystem;
      },
    });

    const actor = await createActor('iterable-group');
    addInlineActivity(actor.id, 'test:activity_simple', {
      template: '{actor} tries iterable grouping',
      priority: 55,
    });

    const description = await service.generateActivityDescription(actor.id);

    expect(description).toContain('iterable grouping');
    expect(typeof groupingSystem.groupActivities).toBe('function');
  });

  it('warns when grouping system returns unexpected structures', async () => {
    const { service } = createService({
      groupingFactory: ({ baseGroupingSystem }) => {
        baseGroupingSystem.groupActivities = () => ({ invalid: true });
        return baseGroupingSystem;
      },
    });

    const actor = await createActor('unexpected-group');
    addInlineActivity(actor.id, 'test:activity_simple', {
      template: '{actor} sees unexpected grouping',
      priority: 60,
    });

    testBed.mocks.logger.warn.mockClear();

    const description = await service.generateActivityDescription(actor.id);

    expect(description).toBe('');
    expect(testBed.mocks.logger.warn).toHaveBeenCalledWith(
      'Grouping activities returned unexpected data; ignoring result'
    );
  });

  it('dispatches grouping errors and logs failures when grouping throws', async () => {
    const failingEventBus = {
      dispatch: () => {
        throw new Error('event bus down');
      },
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };

    const { service } = createService({
      groupingFactory: ({ baseGroupingSystem }) => {
        baseGroupingSystem.groupActivities = () => {
          throw new Error('group failure');
        };
        return baseGroupingSystem;
      },
      eventBus: failingEventBus,
    });

    const actor = await createActor('group-error');
    addInlineActivity(actor.id, 'test:activity_simple', {
      template: '{actor} triggers grouping failure',
      priority: 70,
    });

    testBed.mocks.logger.error.mockClear();

    const description = await service.generateActivityDescription(actor.id);

    expect(description).toBe('');
    expect(testBed.mocks.logger.error).toHaveBeenCalledWith(
      'Failed to group activities for formatting',
      expect.any(Error)
    );
    expect(testBed.mocks.logger.error).toHaveBeenCalledWith(
      'Failed to dispatch activity description error event',
      expect.any(Error)
    );
  });

  it('returns empty description when prioritized activities collapse to an empty array', async () => {
    const { service } = createService({
      groupingFactory: ({ baseGroupingSystem }) => {
        baseGroupingSystem.sortByPriority = () => [];
        return baseGroupingSystem;
      },
    });

    const actor = await createActor('empty-sort');
    addInlineActivity(actor.id, 'test:activity_simple', {
      template: '{actor} will be dropped by sorting',
      priority: 80,
    });

    const description = await service.generateActivityDescription(actor.id);

    expect(description).toBe('');
    expect(testBed.mocks.logger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        'No formatted activity description produced for entity: empty-sort'
      )
    );
  });

  it('handles primary phrase generation failures gracefully', async () => {
    const { service } = createService({
      nlgFactory: ({ cacheManager }) =>
        new PrimaryFailureNLGSystem({
          logger: testBed.mocks.logger,
          entityManager: testBed.entityManager,
          cacheManager,
        }),
    });

    const actor = await createActor('primary-failure');
    addInlineActivity(actor.id, 'test:primary_failure', {
      template: '{actor} triggers primary failure',
      priority: 95,
    });

    testBed.mocks.logger.error.mockClear();

    const description = await service.generateActivityDescription(actor.id);

    expect(description).toBe('');
    expect(testBed.mocks.logger.error).toHaveBeenCalledWith(
      'Failed to generate primary activity phrase',
      expect.any(Error)
    );
  });

  it('skips cache writes after destruction through test hooks', async () => {
    const { service } = createService();
    const hooks = service.getTestHooks();

    hooks.setEntityNameCacheEntry('jon', 'Jon Ureña');
    let snapshot = hooks.getCacheSnapshot();
    expect(snapshot.entityName.get('jon').value).toBe('Jon Ureña');

    service.destroy();

    hooks.setEntityNameCacheEntry('ane', 'Ane Arrieta');
    snapshot = hooks.getCacheSnapshot();
    expect(snapshot.entityName.has('ane')).toBe(false);
  });
});
