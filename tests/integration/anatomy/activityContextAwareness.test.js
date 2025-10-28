import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';
import ActivityDescriptionService from '../../../src/anatomy/services/activityDescriptionService.js';
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

    entityManager.addComponent(actor.id, 'positioning:closeness', {
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
});
