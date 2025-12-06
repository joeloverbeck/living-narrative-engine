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
import {
  registerActivityComponents,
  createActor,
  addInlineActivity,
  configureActivityFormatting,
} from './activityNaturalLanguageTestUtils.js';

describe('Activity Description - Natural Language Integration', () => {
  let testBed;
  let entityManager;
  let formattingService;
  let service;
  let jsonLogicEvaluationService;

  beforeEach(() => {
    testBed = new AnatomyIntegrationTestBed();
    testBed.loadCoreTestData();
    registerActivityComponents(testBed);

    entityManager = testBed.entityManager;
    formattingService = testBed.mockAnatomyFormattingService;
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

    service = new ActivityDescriptionService({
      logger: testBed.logger,
      entityManager,
      anatomyFormattingService: formattingService,
      jsonLogicEvaluationService,
      cacheManager,
      indexManager,
      metadataCollectionSystem,
      groupingSystem,
      nlgSystem,
    });

    configureActivityFormatting(formattingService);
  });

  afterEach(() => testBed.cleanup());

  it('should produce natural description with pronouns, grouping, and context', async () => {
    const jon = await createActor(entityManager, {
      id: 'jon',
      name: 'Jon Ureña',
      gender: 'male',
    });
    const alicia = await createActor(entityManager, {
      id: 'alicia',
      name: 'Alicia Western',
      gender: 'female',
    });

    entityManager.addComponent(jon.id, 'positioning:closeness', {
      partners: [alicia.id],
    });

    addInlineActivity(entityManager, jon.id, 'test:activity_gazing', {
      targetId: alicia.id,
      targetRole: 'target',
      template: '{actor} is gazing at {target}',
      priority: 95,
    });

    addInlineActivity(entityManager, jon.id, 'test:activity_holding_hands', {
      targetId: alicia.id,
      targetRole: 'partner',
      template: '{actor} is holding hands with {target}',
      priority: 85,
    });

    addInlineActivity(entityManager, jon.id, 'test:activity_kneeling', {
      targetId: alicia.id,
      targetRole: 'entityId',
      template: '{actor} is kneeling before {target}',
      priority: 75,
    });

    const description = await service.generateActivityDescription(jon.id);
    const words = description.toLowerCase().split(/\W+/);

    expect(description).toContain('Activity:');
    expect(description).toContain('Jon');
    expect(words).toContain('her');
    expect(description).toMatch(/\b(and|while)\b/i);
    expect(description.toLowerCase()).not.toContain('tenderly');
    expect(description.split('.').length).toBeGreaterThanOrEqual(1);
  });

  it('should handle multiple targets with pronouns', async () => {
    const jon = await createActor(entityManager, {
      id: 'jon',
      name: 'Jon Ureña',
      gender: 'male',
    });
    const alicia = await createActor(entityManager, {
      id: 'alicia',
      name: 'Alicia Western',
      gender: 'female',
    });
    const bobby = await createActor(entityManager, {
      id: 'bobby',
      name: 'Bobby Draper',
      gender: 'male',
    });

    addInlineActivity(entityManager, jon.id, 'test:activity_holding_hands', {
      targetId: alicia.id,
      targetRole: 'partner',
      template: '{actor} is embracing {target}',
      priority: 90,
    });

    addInlineActivity(entityManager, jon.id, 'test:activity_gazing', {
      targetId: bobby.id,
      targetRole: 'target',
      template: '{actor} is waving at {target}',
      priority: 70,
    });

    const description = await service.generateActivityDescription(jon.id);
    const words = description.toLowerCase().split(/\W+/);

    expect(description).toContain('Jon');
    expect(words).toContain('he');
    expect(description).toMatch(/Alicia|her/i);
    expect(description.toLowerCase()).toMatch(/\b(her|alicia)\b/);
    expect(description).toMatch(/Bobby|him/i);
    expect(description.toLowerCase()).toMatch(/\bhim\b|\bbobby\b/);
    expect(description.split('.').length).toBeGreaterThan(1);
  });

  it('should respect configuration toggles for pronouns and context', async () => {
    configureActivityFormatting(formattingService, {
      enableContextAwareness: false,
      nameResolution: {
        usePronounsWhenAvailable: false,
        fallbackToNames: true,
      },
    });

    const jon = await createActor(entityManager, {
      id: 'jon',
      name: 'Jon Ureña',
      gender: 'male',
    });
    const alicia = await createActor(entityManager, {
      id: 'alicia',
      name: 'Alicia Western',
      gender: 'female',
    });

    addInlineActivity(entityManager, jon.id, 'test:activity_holding_hands', {
      targetId: alicia.id,
      targetRole: 'partner',
      template: '{actor} is holding hands with {target}',
      priority: 85,
    });

    const description = await service.generateActivityDescription(jon.id);
    const words = description.toLowerCase().split(/\W+/);

    expect(description).toContain('Jon');
    expect(description).toContain('Alicia');
    expect(words).not.toContain('he');
    expect(words).not.toContain('her');
  });
});
