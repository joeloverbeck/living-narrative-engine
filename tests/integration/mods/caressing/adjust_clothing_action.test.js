/**
 * @file Integration tests for the caressing:adjust_clothing multi-target action
 * @description Tests the complete flow of the adjust_clothing action with
 * multiple targets (person and garment)
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import adjustClothingRule from '../../../../data/mods/caressing/rules/adjust_clothing.rule.json';
import eventIsActionAdjustClothing from '../../../../data/mods/caressing/conditions/event-is-action-adjust-clothing.condition.json';

describe('caressing:adjust_clothing action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'caressing',
      'caressing:adjust_clothing',
      adjustClothingRule,
      eventIsActionAdjustClothing
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('handles multiple targets correctly', async () => {
    const scenario = testFixture.createMultiActorScenario([
      'Alice',
      'Bob',
      'Charlie',
    ]);

    // Create a garment entity
    const garmentEntity = {
      id: 'garment1',
      components: {
        'core:name': { text: 'shirt' },
        'core:position': { locationId: 'room1' },
      },
    };

    testFixture.reset([...scenario.allEntities, garmentEntity]);

    // Test multi-target action with primaryId and secondaryId
    await testFixture.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: scenario.actor.id,
      actionId: 'caressing:adjust_clothing',
      primaryId: scenario.target.id,
      secondaryId: 'garment1',
      originalInput: 'adjust clothing',
    });

    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toContain('smoothed');
  });

  it('works with different entity names and locations', async () => {
    const scenario = testFixture.createCloseActors(['Sarah', 'James'], {
      location: 'garden',
    });

    const garmentEntity = {
      id: 'garment1',
      components: {
        'core:name': { text: 'jacket' },
        'core:position': { locationId: 'garden' },
      },
    };

    testFixture.reset([scenario.actor, scenario.target, garmentEntity]);

    await testFixture.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: scenario.actor.id,
      actionId: 'caressing:adjust_clothing',
      primaryId: scenario.target.id,
      secondaryId: 'garment1',
      originalInput: 'adjust clothing',
    });

    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toContain('Sarah');
    expect(perceptibleEvent.payload.locationId).toBe('garden');
  });
});
