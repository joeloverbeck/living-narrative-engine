/**
 * @file Integration tests for activity description system - Complete workflow
 * @description Tests complete activity description generation workflow with inline and dedicated metadata
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';
import ActivityDescriptionService from '../../../src/anatomy/services/activityDescriptionService.js';

describe('Activity Description System - Complete Workflow', () => {
  let testBed;
  let entityManager;
  let activityDescriptionService;
  let jsonLogicEvaluationService;

  beforeEach(() => {
    testBed = new AnatomyIntegrationTestBed();
    testBed.loadCoreTestData();

    // Register test component definitions
    testBed.loadComponents({
      'test:activity_state': {
        id: 'test:activity_state',
        dataSchema: { type: 'object', properties: {} },
      },
      'test:activity_state_1': {
        id: 'test:activity_state_1',
        dataSchema: { type: 'object', properties: {} },
      },
      'test:activity_state_2': {
        id: 'test:activity_state_2',
        dataSchema: { type: 'object', properties: {} },
      },
      'test:kissing': {
        id: 'test:kissing',
        dataSchema: { type: 'object', properties: {} },
      },
    });

    entityManager = testBed.entityManager;

    // Direct service instantiation with proper dependencies
    jsonLogicEvaluationService = {
      evaluate: jest.fn().mockReturnValue(true),
    };
    activityDescriptionService = new ActivityDescriptionService({
      logger: testBed.mocks.logger,
      entityManager: testBed.entityManager,
      anatomyFormattingService: testBed.mockAnatomyFormattingService,
      jsonLogicEvaluationService,
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should generate activity description from inline metadata', async () => {
    // Create entity with inline metadata
    const jonEntity = await entityManager.createEntityInstance('core:actor', {
      instanceId: 'jon',
    });
    entityManager.addComponent(jonEntity.id, 'core:name', { text: 'Jon Ureña' });

    // Add activity component with inline metadata
    entityManager.addComponent(jonEntity.id, 'test:activity_state', {
      entityId: 'alicia',
      activityMetadata: {
        shouldDescribeInActivity: true,
        template: '{actor} is kneeling before {target}',
        targetRole: 'entityId',
        priority: 75,
      },
    });

    const aliciaEntity = await entityManager.createEntityInstance('core:actor', {
      instanceId: 'alicia',
    });
    entityManager.addComponent(aliciaEntity.id, 'core:name', {
      text: 'Alicia Western',
    });

    // Generate description
    const description =
      await activityDescriptionService.generateActivityDescription('jon');

    expect(description).toBe('Activity: Jon Ureña is kneeling before Alicia Western');
  });

  it('should generate activity description from dedicated metadata', async () => {
    const jonEntity = await entityManager.createEntityInstance('core:actor', {
      instanceId: 'jon',
    });
    entityManager.addComponent(jonEntity.id, 'core:name', { text: 'Jon Ureña' });

    // Add source component
    entityManager.addComponent(jonEntity.id, 'test:kissing', {
      partner: 'alicia',
      initiator: true,
    });

    // Add dedicated metadata component
    entityManager.addComponent(jonEntity.id, 'activity:description_metadata', {
      sourceComponent: 'test:kissing',
      descriptionType: 'verb',
      verb: 'kissing',
      adverb: 'passionately',
      targetRole: 'partner',
      priority: 90,
    });

    const aliciaEntity = await entityManager.createEntityInstance('core:actor', {
      instanceId: 'alicia',
    });
    entityManager.addComponent(aliciaEntity.id, 'core:name', {
      text: 'Alicia Western',
    });

    const description =
      await activityDescriptionService.generateActivityDescription('jon');

    expect(description).toContain('kissing');
    expect(description).toContain('Alicia Western');
    expect(description).toContain('passionately');
  });

  it('should combine multiple activities with correct priority', async () => {
    const jonEntity = await entityManager.createEntityInstance('core:actor', {
      instanceId: 'jon',
    });
    entityManager.addComponent(jonEntity.id, 'core:name', { text: 'Jon Ureña' });

    // Lower priority activity
    entityManager.addComponent(jonEntity.id, 'test:activity_state_1', {
      entityId: 'alicia',
      activityMetadata: {
        shouldDescribeInActivity: true,
        template: '{actor} is kneeling before {target}',
        targetRole: 'entityId',
        priority: 75,
      },
    });

    // Higher priority activity
    entityManager.addComponent(jonEntity.id, 'test:activity_state_2', {
      partner: 'alicia',
      activityMetadata: {
        shouldDescribeInActivity: true,
        template: '{actor} is holding hands with {target}',
        targetRole: 'partner',
        priority: 85,
      },
    });

    const aliciaEntity = await entityManager.createEntityInstance('core:actor', {
      instanceId: 'alicia',
    });
    entityManager.addComponent(aliciaEntity.id, 'core:name', {
      text: 'Alicia Western',
    });

    const description =
      await activityDescriptionService.generateActivityDescription('jon');

    // Higher priority should appear first
    const holdingIndex = description.indexOf('holding hands');
    const kneelingIndex = description.indexOf('kneeling');
    expect(holdingIndex).toBeGreaterThan(-1);
    expect(kneelingIndex).toBeGreaterThan(-1);
    expect(holdingIndex).toBeLessThan(kneelingIndex);
  });
});
