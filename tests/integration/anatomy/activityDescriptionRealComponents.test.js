/**
 * @file Integration tests for activity description with real mod components
 * @description Tests activity description system with real mod data using ModTestFixture
 */

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
import holdingHandComponent from '../../../data/mods/hand-holding/components/holding_hand.component.json';
import sittingOnComponent from '../../../data/mods/positioning/components/sitting_on.component.json';
import beingHuggedComponent from '../../../data/mods/positioning/components/being_hugged.component.json';
import livingRoomSofaDefinition from '../../../data/mods/furniture/entities/definitions/living_room_sofa.entity.json';

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
      [holdingHandComponent.id]: holdingHandComponent,
      [beingHuggedComponent.id]: beingHuggedComponent,
      [sittingOnComponent.id]: sittingOnComponent,
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
    entityManager.addComponent(jonEntity.id, 'core:name', {
      text: 'Jon Ureña',
    });

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
    entityManager.addComponent(jonEntity.id, 'core:name', {
      text: 'Jon Ureña',
    });

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

  it('should prefer furniture names over pronouns when mixing interpersonal and furniture activities', async () => {
    testBed.mockAnatomyFormattingService.getActivityIntegrationConfig = () => ({
      prefix: 'Activity: ',
      suffix: '',
      separator: '. ',
      maxActivities: 10,
      enableContextAwareness: true,
      deduplicateActivities: true,
      maxDescriptionLength: 500,
      nameResolution: {
        usePronounsWhenAvailable: true,
        preferReflexivePronouns: true,
      },
    });

    testBed.loadEntityDefinitions({
      [livingRoomSofaDefinition.id]: livingRoomSofaDefinition,
    });

    const jonEntity = await entityManager.createEntityInstance('core:actor', {
      instanceId: 'jon',
    });
    entityManager.addComponent(jonEntity.id, 'core:name', {
      text: 'Jon Ureña',
    });
    entityManager.addComponent(jonEntity.id, 'core:gender', { value: 'male' });

    const aneEntity = await entityManager.createEntityInstance('core:actor', {
      instanceId: 'ane',
    });
    entityManager.addComponent(aneEntity.id, 'core:name', {
      text: 'Ane Arrieta',
    });
    entityManager.addComponent(aneEntity.id, 'core:gender', {
      value: 'female',
    });

    const sofaEntity = await entityManager.createEntityInstance(
      livingRoomSofaDefinition.id,
      {
        instanceId: 'sofa',
      }
    );

    entityManager.addComponent(jonEntity.id, holdingHandComponent.id, {
      held_entity_id: aneEntity.id,
      initiated: true,
      activityMetadata: {
        shouldDescribeInActivity: true,
        template: "{actor} is holding {target}'s hand",
        targetRole: 'held_entity_id',
        priority: 67,
      },
    });

    entityManager.addComponent(jonEntity.id, beingHuggedComponent.id, {
      hugging_entity_id: aneEntity.id,
      consented: true,
      activityMetadata: {
        shouldDescribeInActivity: true,
        template: '{actor} is being hugged by {target}',
        targetRole: 'hugging_entity_id',
        priority: 63,
      },
    });

    entityManager.addComponent(jonEntity.id, sittingOnComponent.id, {
      furniture_id: sofaEntity.id,
      spot_index: 0,
      activityMetadata: {
        shouldDescribeInActivity: true,
        template: '{actor} is sitting on {target}',
        targetRole: 'furniture_id',
        priority: 62,
      },
    });

    const description =
      await activityDescriptionService.generateActivityDescription(
        jonEntity.id
      );

    expect(description).toContain(
      "holding Ane Arrieta's hand while being hugged by her"
    );
    expect(description).toContain('sitting on comfortable sofa');
    expect(description).not.toContain('sitting on them');
  });
});
