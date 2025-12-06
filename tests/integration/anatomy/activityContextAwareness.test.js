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
import ActivityFilteringSystem from '../../../src/anatomy/services/filtering/activityFilteringSystem.js';
import ActivityConditionValidator from '../../../src/anatomy/services/validation/activityConditionValidator.js';
import {
  registerActivityComponents,
  createActor,
  addInlineActivity,
  configureActivityFormatting,
} from './activityNaturalLanguageTestUtils.js';

describe('Activity Description - Context Edge Cases', () => {
  let testBed;
  let entityManager;
  let service;
  let contextBuildingSystem;
  let jsonLogicEvaluationService;

  beforeEach(() => {
    testBed = new AnatomyIntegrationTestBed();
    testBed.loadCoreTestData();
    registerActivityComponents(testBed);

    entityManager = testBed.entityManager;
    jsonLogicEvaluationService = {
      evaluate: jest.fn().mockReturnValue(true),
    };

    // Create real dependencies for integration testing
    const cacheManager = new ActivityCacheManager({
      logger: testBed.logger,
      eventBus: null,
    });
    const indexManager = new ActivityIndexManager({
      cacheManager,
      logger: testBed.logger,
    });
    const metadataCollectionSystem = new ActivityMetadataCollectionSystem({
      entityManager,
      logger: testBed.logger,
      activityIndex: null,
    });
    const groupingSystem = new ActivityGroupingSystem({
      indexManager,
      logger: testBed.logger,
    });
    const nlgSystem = new ActivityNLGSystem({
      logger: testBed.logger,
      entityManager,
      cacheManager,
    });
    const conditionValidator = new ActivityConditionValidator({
      logger: testBed.logger,
    });
    const filteringSystem = new ActivityFilteringSystem({
      logger: testBed.logger,
      conditionValidator,
      entityManager,
      jsonLogicEvaluationService,
    });
    contextBuildingSystem = new ActivityContextBuildingSystem({
      entityManager,
      logger: testBed.logger,
      nlgSystem,
    });

    service = new ActivityDescriptionService({
      logger: testBed.logger,
      entityManager,
      anatomyFormattingService: testBed.mockAnatomyFormattingService,
      jsonLogicEvaluationService,
      cacheManager,
      indexManager,
      metadataCollectionSystem,
      groupingSystem,
      nlgSystem,
      filteringSystem,
      contextBuildingSystem,
    });

    configureActivityFormatting(testBed.mockAnatomyFormattingService);
  });

  afterEach(() => testBed.cleanup());

  it('should handle missing relationship components', async () => {
    const actor = await createActor(entityManager, {
      id: 'jon',
      name: 'Jon Ureña',
      gender: 'male',
    });
    const stranger = await createActor(entityManager, {
      id: 'stranger',
      name: 'Stranger',
    });

    addInlineActivity(entityManager, actor.id, 'test:activity_generic', {
      targetId: stranger.id,
      targetRole: 'target',
      template: '{actor} is talking to {target}',
      priority: 60,
    });

    const description = await service.generateActivityDescription(actor.id);

    expect(description.toLowerCase()).not.toContain('tenderly');
    expect(description.toLowerCase()).not.toContain('fiercely');
  });

  it('should prioritize closeness partners for intimate tone', async () => {
    const actor = await createActor(entityManager, {
      id: 'jon',
      name: 'Jon Ureña',
      gender: 'male',
    });
    const alicia = await createActor(entityManager, {
      id: 'alicia',
      name: 'Alicia Western',
      gender: 'female',
    });

    await entityManager.addComponent(actor.id, 'positioning:closeness', {
      partners: [alicia.id],
    });

    addInlineActivity(entityManager, actor.id, 'test:activity_generic', {
      targetId: alicia.id,
      targetRole: 'target',
      template: '{actor} is embracing {target}',
      priority: 85,
    });

    const description = await service.generateActivityDescription(actor.id);

    expect(description.toLowerCase()).toContain('embracing');
    expect(description.toLowerCase()).not.toContain('tenderly');
  });

  it('should scale context adjustments with intensity', async () => {
    const actor = await createActor(entityManager, {
      id: 'jon',
      name: 'Jon Ureña',
      gender: 'male',
    });
    const alicia = await createActor(entityManager, {
      id: 'alicia',
      name: 'Alicia Western',
      gender: 'female',
    });

    addInlineActivity(entityManager, actor.id, 'test:activity_generic', {
      targetId: alicia.id,
      targetRole: 'target',
      template: '{actor} is sparring with {target}',
      priority: 95,
    });

    const description = await service.generateActivityDescription(actor.id);

    expect(description.toLowerCase()).toContain('fiercely');
  });

  it('should update relationship tone immediately after closeness cache invalidation', async () => {
    const actor = await createActor(entityManager, {
      id: 'jon',
      name: 'Jon Ureña',
      gender: 'male',
    });
    const alicia = await createActor(entityManager, {
      id: 'alicia',
      name: 'Alicia Western',
      gender: 'female',
    });

    await entityManager.addComponent(actor.id, 'positioning:closeness', {
      partners: [alicia.id],
    });

    addInlineActivity(entityManager, actor.id, 'test:activity_generic', {
      targetId: alicia.id,
      targetRole: 'target',
      template: '{actor} is sparring with {target}',
      priority: 95,
    });

    const baselineContext = contextBuildingSystem.buildActivityContext(
      actor.id,
      {
        targetEntityId: alicia.id,
        priority: 95,
      }
    );
    expect(baselineContext.relationshipTone).toBe('closeness_partner');

    await entityManager.addComponent(actor.id, 'positioning:closeness', {
      partners: [],
    });

    const closenessAfterUpdate = entityManager
      .getEntityInstance(actor.id)
      .getComponentData('positioning:closeness');
    expect(Array.isArray(closenessAfterUpdate?.partners)).toBe(true);
    expect(closenessAfterUpdate.partners).toHaveLength(0);

    const cachedContext = contextBuildingSystem.buildActivityContext(actor.id, {
      targetEntityId: alicia.id,
      priority: 95,
    });
    expect(cachedContext.relationshipTone).toBe('closeness_partner');

    service.invalidateCache(actor.id, 'closeness');

    const refreshedContext = contextBuildingSystem.buildActivityContext(
      actor.id,
      {
        targetEntityId: alicia.id,
        priority: 95,
      }
    );
    expect(refreshedContext.relationshipTone).toBe('neutral');
  });
});
