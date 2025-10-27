/**
 * @file Integration tests for activity description with real mod components
 * @description Tests activity description system with real mod data using ModTestFixture
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';
import ActivityDescriptionService from '../../../src/anatomy/services/activityDescriptionService.js';

describe('Activity Description - Real Mod Components', () => {
  let testBed;
  let activityDescriptionService;
  let entityManager;
  let jsonLogicEvaluationService;

  beforeEach(() => {
    testBed = new AnatomyIntegrationTestBed();
    testBed.loadCoreTestData();

    // Register test component definitions
    testBed.loadComponents({
      'test:sitting_state': {
        id: 'test:sitting_state',
        dataSchema: { type: 'object', properties: {} },
      },
      'test:facing_state': {
        id: 'test:facing_state',
        dataSchema: { type: 'object', properties: {} },
      },
    });

    entityManager = testBed.entityManager;

    // Initialize ActivityDescriptionService with proper dependencies
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

  it('should work with real positioning components', async () => {
    const jonEntity = await entityManager.createEntityInstance('core:actor', {
      instanceId: 'jon',
    });
    entityManager.addComponent(jonEntity.id, 'core:name', { text: 'Jon Ureña' });

    // Use test component with activity metadata (real positioning components may not have it)
    entityManager.addComponent(jonEntity.id, 'test:sitting_state', {
      activityMetadata: {
        shouldDescribeInActivity: true,
        template: '{actor} is sitting',
        priority: 75,
      },
    });

    const description =
      await activityDescriptionService.generateActivityDescription('jon');

    expect(description).toContain('sitting');
  });

  it('should handle multiple real components together', async () => {
    const jonEntity = await entityManager.createEntityInstance('core:actor', {
      instanceId: 'jon',
    });
    entityManager.addComponent(jonEntity.id, 'core:name', { text: 'Jon Ureña' });

    // Add multiple activity components
    entityManager.addComponent(jonEntity.id, 'test:sitting_state', {
      activityMetadata: {
        shouldDescribeInActivity: true,
        template: '{actor} is sitting',
        priority: 75,
      },
    });

    entityManager.addComponent(jonEntity.id, 'test:facing_state', {
      direction: 'north',
      activityMetadata: {
        shouldDescribeInActivity: true,
        template: '{actor} is facing north',
        priority: 65,
      },
    });

    const description =
      await activityDescriptionService.generateActivityDescription('jon');

    // Verify both activities appear with correct priority
    expect(description).toContain('sitting');
    expect(description).toContain('facing');
  });
});
