/**
 * @file Integration tests for the intimacy:adjust_clothing multi-target action
 * @description Tests the complete flow of the adjust_clothing action from
 * discovery through rule execution, verifying enhanced event payload with
 * resolved target IDs
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import adjustClothingRule from '../../../../data/mods/intimacy/rules/adjust_clothing.rule.json';
import eventIsActionAdjustClothing from '../../../../data/mods/intimacy/conditions/event-is-action-adjust-clothing.condition.json';

describe('intimacy:adjust_clothing action integration', () => {
  let testFixture;

  beforeEach(async () => {
    // Note: adjust_clothing is a complex multi-target action that uses primaryId/secondaryId
    // The rule itself handles garment entities differently from standard actions
    testFixture = await ModTestFixture.forAction(
      'intimacy',
      'intimacy:adjust_clothing',
      adjustClothingRule,
      eventIsActionAdjustClothing
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('handles multiple targets correctly', async () => {
    const scenario = testFixture.createMultiActorScenario(['Alice', 'Bob', 'Charlie']);
    
    // Create a garment entity
    const garmentEntity = {
      id: 'garment1',
      components: {
        'core:name': { text: 'shirt' },
        'core:position': { locationId: 'room1' }
      }
    };
    
    testFixture.reset([...scenario.allEntities, garmentEntity]);
    
    // Test multi-target action with primaryId and secondaryId
    await testFixture.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: scenario.actor.id,
      actionId: 'intimacy:adjust_clothing',
      primaryId: scenario.target.id,
      secondaryId: 'garment1',
      originalInput: 'adjust clothing'
    });

    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toContain('smoothed');
  });

  it('works with different entity names and locations', async () => {
    const scenario = testFixture.createCloseActors(['Sarah', 'James'], {
      location: 'garden'
    });
    
    const garmentEntity = {
      id: 'garment1',
      components: {
        'core:name': { text: 'jacket' },
        'core:position': { locationId: 'garden' }
      }
    };
    
    testFixture.reset([scenario.actor, scenario.target, garmentEntity]);
    
    await testFixture.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: scenario.actor.id,
      actionId: 'intimacy:adjust_clothing',
      primaryId: scenario.target.id,
      secondaryId: 'garment1',
      originalInput: 'adjust clothing'
    });

    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toContain("Sarah");
    expect(perceptibleEvent.payload.locationId).toBe('garden');
  });

  it('action only fires for correct action ID', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

    // Try with a different action
    await testFixture.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: scenario.actor.id,
      actionId: 'intimacy:kiss_cheek',
      targetId: scenario.target.id,
      originalInput: 'kiss_cheek Bob',
    });

    // Should not have any perceptible events from our rule
    testFixture.assertOnlyExpectedEvents(['core:attempt_action']);
  });

  it('handles self-targeting with location verification', async () => {
    const scenario = testFixture.createCloseActors(['Emily', 'Michael'], {
      location: 'park'
    });
    
    const garmentEntity = {
      id: 'garment1',
      components: {
        'core:name': { text: 'dress' },
        'core:position': { locationId: 'park' }
      }
    };
    
    testFixture.reset([scenario.actor, scenario.target, garmentEntity]);
    
    await testFixture.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: scenario.actor.id,
      actionId: 'intimacy:adjust_clothing',
      primaryId: scenario.actor.id,
      secondaryId: 'garment1',
      originalInput: 'adjust clothing self'
    });

    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toContain('Emily');
    expect(perceptibleEvent.payload.locationId).toBe('park');
  });
});