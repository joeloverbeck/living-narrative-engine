/**
 * @file Integration tests for the metabolism:drink_beverage action and handle_drink_beverage rule.
 * @description Tests the rule execution after the drink action is performed.
 * Verifies CONSUME_ITEM operation, perception logging, and turn ending.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import '../../../common/mods/domainMatchers.js';
import handleDrinkBeverageRule from '../../../../data/mods/metabolism/rules/handle_drink_beverage.rule.json' assert { type: 'json' };
import eventIsActionDrinkBeverage from '../../../../data/mods/metabolism/conditions/event-is-action-drink-beverage.condition.json' assert { type: 'json' };

describe('metabolism:drink_beverage action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'metabolism',
      'metabolism:drink',
      handleDrinkBeverageRule,
      eventIsActionDrinkBeverage
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('successful drink operations', () => {
    it('successfully consumes beverage and logs perception', async () => {
      const room = new ModEntityBuilder('test:room1').asRoom('Kitchen').build();

      const actor = new ModEntityBuilder('test:actor1')
        .withName('Alice')
        .atLocation('test:room1')
        .asActor()
        .withComponent('metabolism:metabolic_store', {
          current_energy: 50,
          max_energy: 100,
          base_burn_rate: 1.0,
          buffer_storage: [],
          buffer_capacity: 10,
        })
        .withComponent('metabolism:fuel_converter', {
          capacity: 10,
          conversion_rate: 1.0,
          efficiency: 1.0,
          accepted_fuel_tags: ['food', 'drink'],
          conversion_rate: 1.0,
          metabolic_efficiency_multiplier: 1.0,
        })
        .build();

      const beverage = new ModEntityBuilder('test:beverage1')
        .withName('water')
        .withComponent('metabolism:fuel_source', {
          fuel_type: 'drink',
          bulk: 1,
          energy_content: 10,
        })
        .build();

      testFixture.reset([room, actor, beverage]);

      await testFixture.executeAction('test:actor1', 'test:beverage1');

      expect(testFixture.events).toDispatchEvent('core:perceptible_event');
      const perceptibleEvent = testFixture.events.find(
        (event) => event.eventType === 'core:perceptible_event'
      );
      expect(perceptibleEvent?.payload.descriptionText).toBe(
        'Alice drinks water.'
      );
      expect(perceptibleEvent?.payload.perceptionType).toBe('drink_consumed');

      expect(testFixture.events).toDispatchEvent(
        'core:display_successful_action_result'
      );
      expect(testFixture.events).toHaveActionSuccess('Alice drinks water.');
      expect(testFixture.events).toDispatchEvent('core:turn_ended');

      const turnEndedEvent = testFixture.events.find(
        (event) => event.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent?.payload.success).toBe(true);
    });

    it('transfers beverage nutrients to metabolic buffer', async () => {
      const room = new ModEntityBuilder('test:room1')
        .asRoom('Dining Room')
        .build();

      const actor = new ModEntityBuilder('test:actor1')
        .withName('Bob')
        .atLocation('test:room1')
        .asActor()
        .withComponent('metabolism:metabolic_store', {
          current_energy: 30,
          max_energy: 100,
          base_burn_rate: 1.0,
          buffer_storage: [],
          buffer_capacity: 10,
        })
        .withComponent('metabolism:fuel_converter', {
          capacity: 10,
          conversion_rate: 1.0,
          efficiency: 1.0,
          accepted_fuel_tags: ['drink'],
          conversion_rate: 1.0,
          metabolic_efficiency_multiplier: 1.0,
        })
        .build();

      const beverage = new ModEntityBuilder('test:beverage1')
        .withName('juice')
        .withComponent('metabolism:fuel_source', {
          fuel_type: 'drink',
          bulk: 2,
          energy_content: 20,
        })
        .build();

      testFixture.reset([room, actor, beverage]);

      await testFixture.executeAction('test:actor1', 'test:beverage1');

      const actorEntity =
        testFixture.entityManager.getEntityInstance('test:actor1');
      const metabolicStore =
        actorEntity.components['metabolism:metabolic_store'];

      expect(metabolicStore.buffer_storage).toHaveLength(1);
      expect(metabolicStore.buffer_storage[0]).toMatchObject({
        bulk: 2,
        energy_content: 20,
      });

      expect(testFixture.events).toHaveActionSuccess('Bob drinks juice.');
    });

    it('dispatches events in correct order', async () => {
      const room = new ModEntityBuilder('test:room1')
        .asRoom('Restaurant')
        .build();

      const actor = new ModEntityBuilder('test:actor1')
        .withName('Carol')
        .atLocation('test:room1')
        .asActor()
        .withComponent('metabolism:metabolic_store', {
          current_energy: 60,
          max_energy: 100,
          base_burn_rate: 1.0,
          buffer_storage: [],
          buffer_capacity: 10,
        })
        .withComponent('metabolism:fuel_converter', {
          capacity: 10,
          conversion_rate: 1.0,
          efficiency: 1.0,
          accepted_fuel_tags: ['drink'],
          conversion_rate: 1.0,
          metabolic_efficiency_multiplier: 1.0,
        })
        .build();

      const beverage = new ModEntityBuilder('test:beverage1')
        .withName('tea')
        .withComponent('metabolism:fuel_source', {
          fuel_type: 'drink',
          bulk: 1,
          energy_content: 8,
        })
        .build();

      testFixture.reset([room, actor, beverage]);

      await testFixture.executeAction('test:actor1', 'test:beverage1');

      const perceptibleIdx = testFixture.events.findIndex(
        (e) => e.eventType === 'core:perceptible_event'
      );
      const displayIdx = testFixture.events.findIndex(
        (e) => e.eventType === 'core:display_successful_action_result'
      );
      const successIdx = testFixture.events.findIndex(
        (e) => e.eventType === 'core:action_success'
      );
      const turnEndedIdx = testFixture.events.findIndex(
        (e) => e.eventType === 'core:turn_ended'
      );

      expect(perceptibleIdx).toBeLessThan(displayIdx);
      expect(displayIdx).toBeLessThan(successIdx);
      expect(successIdx).toBeLessThan(turnEndedIdx);
    });
  });

  describe('edge cases', () => {
    it('handles drinking with empty buffer', async () => {
      const room = new ModEntityBuilder('test:room1').asRoom('Tavern').build();

      const actor = new ModEntityBuilder('test:actor1')
        .withName('Dave')
        .atLocation('test:room1')
        .asActor()
        .withComponent('metabolism:metabolic_store', {
          current_energy: 10,
          max_energy: 100,
          base_burn_rate: 1.0,
          buffer_storage: [],
          buffer_capacity: 10,
        })
        .withComponent('metabolism:fuel_converter', {
          capacity: 10,
          conversion_rate: 1.0,
          efficiency: 1.0,
          accepted_fuel_tags: ['drink'],
          conversion_rate: 1.0,
          metabolic_efficiency_multiplier: 1.0,
        })
        .build();

      const beverage = new ModEntityBuilder('test:beverage1')
        .withName('coffee')
        .withComponent('metabolism:fuel_source', {
          fuel_type: 'drink',
          bulk: 2,
          energy_content: 15,
        })
        .build();

      testFixture.reset([room, actor, beverage]);

      await testFixture.executeAction('test:actor1', 'test:beverage1');

      expect(testFixture.events).toHaveActionSuccess('Dave drinks coffee.');
      expect(testFixture.events).toDispatchEvent('core:turn_ended');
    });

    it('handles drinking with partially full buffer', async () => {
      const room = new ModEntityBuilder('test:room1')
        .asRoom('Cafeteria')
        .build();

      const actor = new ModEntityBuilder('test:actor1')
        .withName('Eve')
        .atLocation('test:room1')
        .asActor()
        .withComponent('metabolism:metabolic_store', {
          current_energy: 70,
          max_energy: 100,
          buffer_storage: [{ bulk: 2, energy_content: 25 }],
          buffer_capacity: 10,
        })
        .withComponent('metabolism:fuel_converter', {
          capacity: 10,
          conversion_rate: 1.0,
          efficiency: 1.0,
          accepted_fuel_tags: ['drink'],
          conversion_rate: 1.0,
          metabolic_efficiency_multiplier: 1.0,
        })
        .build();

      const beverage = new ModEntityBuilder('test:beverage1')
        .withName('milk')
        .withComponent('metabolism:fuel_source', {
          fuel_type: 'drink',
          bulk: 1,
          energy_content: 12,
        })
        .build();

      testFixture.reset([room, actor, beverage]);

      await testFixture.executeAction('test:actor1', 'test:beverage1');

      const actorEntity =
        testFixture.entityManager.getEntityInstance('test:actor1');
      const metabolicStore =
        actorEntity.components['metabolism:metabolic_store'];

      expect(metabolicStore.buffer_storage).toHaveLength(2);
      expect(testFixture.events).toHaveActionSuccess('Eve drinks milk.');
    });
  });
});
