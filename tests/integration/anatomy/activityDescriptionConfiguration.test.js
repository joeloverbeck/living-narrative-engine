/**
 * @file Integration tests for activity description configuration effects
 * @description Tests configuration integration with custom prefixes, separators, and limits
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { jest } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';
import ActivityDescriptionService from '../../../src/anatomy/services/activityDescriptionService.js';

describe('Activity Description - Configuration Integration', () => {
  let testBed;
  let entityManager;

  beforeEach(() => {
    testBed = new AnatomyIntegrationTestBed();
    testBed.loadCoreTestData();

    // Register test component definitions
    testBed.loadComponents({
      'test:activity_state': {
        id: 'test:activity_state',
        dataSchema: { type: 'object', properties: {} },
      },
      'test:activity_1': {
        id: 'test:activity_1',
        dataSchema: { type: 'object', properties: {} },
      },
      'test:activity_2': {
        id: 'test:activity_2',
        dataSchema: { type: 'object', properties: {} },
      },
      'test:activity_0': {
        id: 'test:activity_0',
        dataSchema: { type: 'object', properties: {} },
      },
      'test:activity_3': {
        id: 'test:activity_3',
        dataSchema: { type: 'object', properties: {} },
      },
      'test:activity_4': {
        id: 'test:activity_4',
        dataSchema: { type: 'object', properties: {} },
      },
    });

    entityManager = testBed.entityManager;
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should respect custom prefix configuration', async () => {
    // Create mock service with custom config
    const mockAnatomyFormattingService = {
      getActivityIntegrationConfig: jest.fn().mockReturnValue({
        prefix: '>>> ',
        suffix: '',
        separator: '. ',
        maxActivities: 10,
      }),
    };

    const jsonLogicEvaluationService = {
      evaluate: jest.fn().mockReturnValue(true),
    };

    const customService = new ActivityDescriptionService({
      logger: testBed.mocks.logger,
      entityManager,
      anatomyFormattingService: mockAnatomyFormattingService,
      jsonLogicEvaluationService,
    });

    const jonEntity = await entityManager.createEntityInstance('core:actor', {
      instanceId: 'jon',
    });
    entityManager.addComponent(jonEntity.id, 'core:name', { text: 'Jon Ureña' });
    entityManager.addComponent(jonEntity.id, 'test:activity_state', {
      activityMetadata: {
        shouldDescribeInActivity: true,
        template: '{actor} is kneeling',
        priority: 75,
      },
    });

    const description = await customService.generateActivityDescription('jon');

    expect(description).toMatch(/^>>> /);
  });

  it('should respect custom separator configuration', async () => {
    // Create mock service with custom config
    const mockAnatomyFormattingService = {
      getActivityIntegrationConfig: jest.fn().mockReturnValue({
        prefix: '',
        suffix: '',
        separator: ' | ',
        maxActivities: 10,
      }),
    };

    const jsonLogicEvaluationService = {
      evaluate: jest.fn().mockReturnValue(true),
    };

    const customService = new ActivityDescriptionService({
      logger: testBed.mocks.logger,
      entityManager,
      anatomyFormattingService: mockAnatomyFormattingService,
      jsonLogicEvaluationService,
    });

    const jonEntity = await entityManager.createEntityInstance('core:actor', {
      instanceId: 'jon',
    });
    entityManager.addComponent(jonEntity.id, 'core:name', { text: 'Jon' });

    entityManager.addComponent(jonEntity.id, 'test:activity_1', {
      activityMetadata: {
        shouldDescribeInActivity: true,
        template: 'kneeling',
        priority: 1,
      },
    });

    entityManager.addComponent(jonEntity.id, 'test:activity_2', {
      activityMetadata: {
        shouldDescribeInActivity: true,
        template: 'holding hands',
        priority: 2,
      },
    });

    const description = await customService.generateActivityDescription('jon');

    expect(description).toContain(' | ');
  });

  it('should respect maxActivities limit', async () => {
    // Create mock service with limited maxActivities
    const mockAnatomyFormattingService = {
      getActivityIntegrationConfig: jest.fn().mockReturnValue({
        prefix: 'Activity: ',
        suffix: '',
        separator: '. ',
        maxActivities: 2,
      }),
    };

    const jsonLogicEvaluationService = {
      evaluate: jest.fn().mockReturnValue(true),
    };

    const customService = new ActivityDescriptionService({
      logger: testBed.mocks.logger,
      entityManager,
      anatomyFormattingService: mockAnatomyFormattingService,
      jsonLogicEvaluationService,
    });

    const jonEntity = await entityManager.createEntityInstance('core:actor', {
      instanceId: 'jon',
    });
    entityManager.addComponent(jonEntity.id, 'core:name', { text: 'Jon' });

    // Add 5 activities
    for (let i = 0; i < 5; i++) {
      entityManager.addComponent(jonEntity.id, `test:activity_${i}`, {
        activityMetadata: {
          shouldDescribeInActivity: true,
          template: `activity ${i}`,
          priority: i,
        },
      });
    }

    const description = await customService.generateActivityDescription('jon');

    // Count activities (split by separator and filter non-empty)
    const activities = description.split('.').filter((s) => s.trim());
    expect(activities.length).toBeLessThanOrEqual(3); // Prefix + 2 activities
  });
});
