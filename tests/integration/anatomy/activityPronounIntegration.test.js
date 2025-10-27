import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';
import ActivityDescriptionService from '../../../src/anatomy/services/activityDescriptionService.js';
import {
  registerActivityComponents,
  createActor,
  addInlineActivity,
  configureActivityFormatting,
} from './activityNaturalLanguageTestUtils.js';

describe('Activity Description - Pronoun Edge Cases', () => {
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

  it('should use neutral pronouns for unknown gender', async () => {
    const actor = await createActor(entityManager, {
      id: 'entity',
      name: 'Mystery Figure',
    });

    addInlineActivity(entityManager, actor.id, 'test:activity_generic', {
      template: '{actor} is meditating',
      priority: 50,
    });

    addInlineActivity(entityManager, actor.id, 'test:activity_generic_alt1', {
      template: '{actor} is standing quietly',
      priority: 60,
    });

    const description = await service.generateActivityDescription(actor.id);

    expect(description.toLowerCase()).toContain('they');
  });

  it('should handle missing gender gracefully', async () => {
    const actor = await createActor(entityManager, {
      id: 'entity',
      name: 'Mystery Figure',
    });

    addInlineActivity(entityManager, actor.id, 'test:activity_generic', {
      template: '{actor} is waving',
      priority: 50,
    });

    const description = await service.generateActivityDescription(actor.id);

    expect(description).toBeTruthy();
  });

  it('should avoid repeated target lookups when pronouns enabled', async () => {
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

    const getEntityInstanceSpy = jest.spyOn(entityManager, 'getEntityInstance');

    addInlineActivity(entityManager, jon.id, 'test:activity_generic', {
      targetId: alicia.id,
      targetRole: 'target',
      template: '{actor} is gazing at {target}',
      priority: 80,
    });

    addInlineActivity(entityManager, jon.id, 'test:activity_generic_alt1', {
      targetId: alicia.id,
      targetRole: 'target',
      template: '{actor} is whispering to {target}',
      priority: 70,
    });

    await service.generateActivityDescription(jon.id);

    const firstCallCount = getEntityInstanceSpy.mock.calls.filter(
      ([id]) => id === alicia.id
    ).length;

    getEntityInstanceSpy.mockClear();

    await service.generateActivityDescription(jon.id);

    const secondCallCount = getEntityInstanceSpy.mock.calls.filter(
      ([id]) => id === alicia.id
    ).length;
    expect(secondCallCount).toBeLessThanOrEqual(firstCallCount);
  });
});
