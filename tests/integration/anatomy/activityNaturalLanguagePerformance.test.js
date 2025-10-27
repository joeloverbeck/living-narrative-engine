import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { performance } from 'node:perf_hooks';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';
import ActivityDescriptionService from '../../../src/anatomy/services/activityDescriptionService.js';
import {
  registerActivityComponents,
  createActor,
  addInlineActivity,
  configureActivityFormatting,
} from './activityNaturalLanguageTestUtils.js';

describe('Activity Description - Performance', () => {
  let testBed;
  let entityManager;
  let service;

  beforeEach(() => {
    testBed = new AnatomyIntegrationTestBed();
    testBed.loadCoreTestData();
    registerActivityComponents(testBed);

    entityManager = testBed.entityManager;
    service = new ActivityDescriptionService({
      logger: testBed.logger,
      entityManager,
      anatomyFormattingService: testBed.mockAnatomyFormattingService,
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

    expect(duration).toBeLessThan(20);
  });
});
