import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { performance } from 'node:perf_hooks';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';
import ActivityDescriptionService from '../../../src/anatomy/services/activityDescriptionService.js';
import {
  registerActivityComponents,
  createActor,
  addInlineActivity,
  configureActivityFormatting,
} from '../../integration/anatomy/activityNaturalLanguageTestUtils.js';

describe('Activity Description - Performance', () => {
  let testBed;
  let entityManager;
  let service;
  let jsonLogicEvaluationService;
  let mockCacheManager;
  let mockIndexManager;
  let mockMetadataCollectionSystem;
  let mockGroupingSystem;
  let mockNlgSystem;

  beforeEach(() => {
    testBed = new AnatomyIntegrationTestBed();
    testBed.loadCoreTestData();
    registerActivityComponents(testBed);

    entityManager = testBed.entityManager;
    jsonLogicEvaluationService = {
      evaluate: jest.fn().mockReturnValue(true),
    };

    mockCacheManager = {
      registerCache: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
      invalidate: jest.fn(),
      invalidateAll: jest.fn(),
      clearAll: jest.fn(),
      destroy: jest.fn(),
    };

    mockIndexManager = {
      buildActivityIndex: jest.fn((activities) => ({
        byTarget: new Map(),
        byPriority: [],
        byGroupKey: new Map(),
        all: activities || [],
      })),
      buildActivitySignature: jest.fn(() => ''),
      buildActivityIndexCacheKey: jest.fn(() => ''),
      getActivityIndex: jest.fn((activities) => ({
        byTarget: new Map(),
        byPriority: [],
        byGroupKey: new Map(),
        all: activities || [],
      })),
      buildIndex: jest.fn((activities) => ({
        byTarget: new Map(),
        byPriority: [],
        byGroupKey: new Map(),
        all: activities || [],
      })),
    };

    mockMetadataCollectionSystem = {
      collectActivityMetadata: jest.fn((entityId, entity) => []),
    };

    mockGroupingSystem = {
      groupActivities: jest.fn((index) => ({ groups: [], simultaneousActivities: [] })),
      sortByPriority: jest.fn((activities) => activities),
    };

    mockNlgSystem = {
      generateNaturalLanguage: jest.fn((groups) => []),
      formatActivityDescription: jest.fn((groups) => ''),
      detectEntityGender: jest.fn((entityId) => 'neutral'),
      resolveEntityName: jest.fn((entityId) => entityId),
      getPronounSet: jest.fn((gender) => ({
        subject: 'they',
        object: 'them',
        possessive: 'their',
        possessivePronoun: 'theirs',
      })),
      generateActivityPhrase: jest.fn((actorRef, activity) => `${actorRef} does something`),
      sanitizeVerbPhrase: jest.fn((phrase) => phrase),
      buildRelatedActivityFragment: jest.fn(() => ''),
      mergeAdverb: jest.fn((current, injected) => `${current} ${injected}`.trim()),
      injectSoftener: jest.fn((template, descriptor) => template),
      truncateDescription: jest.fn((desc, maxLen) => desc),
    };

    service = new ActivityDescriptionService({
      logger: testBed.logger,
      entityManager,
      anatomyFormattingService: testBed.mockAnatomyFormattingService,
      jsonLogicEvaluationService,
      cacheManager: mockCacheManager,
      indexManager: mockIndexManager,
      metadataCollectionSystem: mockMetadataCollectionSystem,
      groupingSystem: mockGroupingSystem,
      nlgSystem: mockNlgSystem,
    });

    configureActivityFormatting(testBed.mockAnatomyFormattingService);
  });

  afterEach(() => testBed.cleanup());

  it('should generate simple description under 10ms', async () => {
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

    addInlineActivity(entityManager, jon.id, 'test:activity_kneeling', {
      targetId: alicia.id,
      targetRole: 'entityId',
      template: '{actor} is kneeling',
      priority: 75,
    });

    const start = performance.now();
    await service.generateActivityDescription(jon.id);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(25);
  });

  it('should handle 10 activities under 50ms', async () => {
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

    const componentIds = Array.from({ length: 10 }, (_, index) => `test:activity_generic_${index}`);

    componentIds.forEach((componentId, index) => {
      addInlineActivity(entityManager, jon.id, componentId, {
        targetId: alicia.id,
        targetRole: 'target',
        template: `{actor} action${index} {target}`,
        priority: 90 - index,
      });
    });

    const start = performance.now();
    await service.generateActivityDescription(jon.id);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(50);
  });

  it('should reuse cached name resolutions on subsequent calls', async () => {
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

    const componentIds = Array.from({ length: 5 }, (_, index) => `test:activity_generic_alt${index}`);

    componentIds.forEach((componentId, index) => {
      addInlineActivity(entityManager, jon.id, componentId, {
        targetId: alicia.id,
        targetRole: 'target',
        template: `{actor} action${index} with {target}`,
        priority: 90 - index,
      });
    });

    await service.generateActivityDescription(jon.id);

    const start = performance.now();
    await service.generateActivityDescription(jon.id);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(25);
  });
});
