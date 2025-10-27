import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';
import ActivityDescriptionService from '../../../src/anatomy/services/activityDescriptionService.js';
import {
  registerActivityComponents,
  createActor,
  addInlineActivity,
  configureActivityFormatting,
} from './activityNaturalLanguageTestUtils.js';

describe('Activity Description - Grouping Edge Cases', () => {
  let testBed;
  let entityManager;
  let service;
  let jsonLogicEvaluationService;

  beforeEach(() => {
    testBed = new AnatomyIntegrationTestBed();
    testBed.loadCoreTestData();
    registerActivityComponents(testBed);

    entityManager = testBed.entityManager;
    jsonLogicEvaluationService = {
      evaluate: jest.fn().mockReturnValue(true),
    };
    service = new ActivityDescriptionService({
      logger: testBed.logger,
      entityManager,
      anatomyFormattingService: testBed.mockAnatomyFormattingService,
      jsonLogicEvaluationService,
    });

    configureActivityFormatting(testBed.mockAnatomyFormattingService);
  });

  afterEach(() => testBed.cleanup());

  it('should not over-group unrelated activities', async () => {
    const actor = await createActor(entityManager, {
      id: 'jon',
      name: 'Jon Ureña',
      gender: 'male',
    });

    addInlineActivity(entityManager, actor.id, 'test:activity_generic', {
      template: '{actor} is meditating',
      priority: 90,
    });

    addInlineActivity(entityManager, actor.id, 'test:activity_generic_alt1', {
      template: '{actor} is walking away',
      priority: 60,
    });

    const description = await service.generateActivityDescription(actor.id);
    const segments = description.replace(/^Activity: /, '').split('. ');

    expect(segments.length).toBeGreaterThan(1);
  });

  it('should group activities that share a target with staggered priorities', async () => {
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

    addInlineActivity(entityManager, actor.id, 'test:activity_generic_alt2', {
      targetId: alicia.id,
      targetRole: 'target',
      template: '{actor} is breathing steadily with {target}',
      priority: 88,
    });

    addInlineActivity(entityManager, actor.id, 'test:activity_generic_alt3', {
      targetId: alicia.id,
      targetRole: 'target',
      template: '{actor} is centering focus on {target}',
      priority: 72,
    });

    const description = await service.generateActivityDescription(actor.id);
    const segments = description.replace(/^Activity: /, '').split('. ');

    expect(segments.length).toBe(1);
    expect(description.toLowerCase()).toMatch(/\band\b/);
  });

  it('should group activities that share a target and similar priority', async () => {
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

    addInlineActivity(entityManager, actor.id, 'test:activity_generic_alt4', {
      targetId: alicia.id,
      targetRole: 'target',
      template: '{actor} is gazing at {target}',
      priority: 90,
    });

    addInlineActivity(entityManager, actor.id, 'test:activity_generic_alt5', {
      targetId: alicia.id,
      targetRole: 'target',
      template: "{actor} is holding {target}'s hand",
      priority: 82,
    });

    const description = await service.generateActivityDescription(actor.id);

    expect(description).toMatch(/while/i);
  });
});
