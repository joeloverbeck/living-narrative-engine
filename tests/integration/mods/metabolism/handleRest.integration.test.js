/**
 * @file Integration tests for the metabolism:rest action and handle_rest rule.
 * @description Tests the rule execution after the rest action is performed.
 * Verifies energy reset, multiplier reset, perception logging, and turn ending.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import '../../../common/mods/domainMatchers.js';
import handleRestRule from '../../../../data/mods/metabolism/rules/handle_rest.rule.json' assert { type: 'json' };
import eventIsActionRest from '../../../../data/mods/metabolism/conditions/event-is-action-rest.condition.json' assert { type: 'json' };

describe('metabolism:rest action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'metabolism',
      'metabolism:rest',
      handleRestRule,
      eventIsActionRest
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('successful rest operations', () => {
    it('successfully resets energy and logs perception', async () => {
      const room = new ModEntityBuilder('test:room1').asRoom('Bedroom').build();

      const actor = new ModEntityBuilder('test:actor1')
        .withName('Alice')
        .atLocation('test:room1')
        .asActor()
        .withComponent('metabolism:metabolic_store', {
          current_energy: 30,
          max_energy: 100,
          base_burn_rate: 1.0,
          buffer_storage: [],
          buffer_capacity: 10
        })
        .withComponent('metabolism:fuel_converter', {
          capacity: 10,
          conversion_rate: 1.0,
          efficiency: 1.0,
          accepted_fuel_tags: ['food', 'drink'],
          metabolic_efficiency_multiplier: 0.8
        })
        .build();

      testFixture.reset([room, actor]);

      await testFixture.executeAction('test:actor1', null);

      const actorEntity = testFixture.entityManager.getEntityInstance('test:actor1');
      const metabolicStore = actorEntity.components['metabolism:metabolic_store'];
      expect(metabolicStore.current_energy).toBe(100);

      const fuelConverter = actorEntity.components['metabolism:fuel_converter'];
      expect(fuelConverter.metabolic_efficiency_multiplier).toBe(1.0);

      expect(testFixture.events).toDispatchEvent('core:perceptible_event');
      const perceptibleEvent = testFixture.events.find(
        (event) => event.eventType === 'core:perceptible_event'
      );
      expect(perceptibleEvent?.payload.descriptionText).toBe('Alice rests and recovers energy.');
      expect(perceptibleEvent?.payload.perceptionType).toBe('rest_action');

      expect(testFixture.events).toDispatchEvent('core:display_successful_action_result');
      expect(testFixture.events).toHaveActionSuccess('Alice rests and recovers energy.');
      expect(testFixture.events).toDispatchEvent('core:turn_ended');

      const turnEndedEvent = testFixture.events.find(
        (event) => event.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent?.payload.success).toBe(true);
    });

    it('resets energy from very low levels', async () => {
      const room = new ModEntityBuilder('test:room1').asRoom('Inn').build();

      const actor = new ModEntityBuilder('test:actor1')
        .withName('Bob')
        .atLocation('test:room1')
        .asActor()
        .withComponent('metabolism:metabolic_store', {
          current_energy: 5,
          max_energy: 120,
          base_burn_rate: 1.0,
          buffer_storage: [],
          buffer_capacity: 10
        })
        .withComponent('metabolism:fuel_converter', {
          capacity: 10,
          conversion_rate: 1.0,
          efficiency: 1.0,
          accepted_fuel_tags: ['food', 'drink'],
          metabolic_efficiency_multiplier: 1.5
        })
        .build();

      testFixture.reset([room, actor]);

      await testFixture.executeAction('test:actor1', null);

      const actorEntity = testFixture.entityManager.getEntityInstance('test:actor1');
      const metabolicStore = actorEntity.components['metabolism:metabolic_store'];

      expect(metabolicStore.current_energy).toBe(120);

      const fuelConverter = actorEntity.components['metabolism:fuel_converter'];
      expect(fuelConverter.metabolic_efficiency_multiplier).toBe(1.0);

      expect(testFixture.events).toHaveActionSuccess('Bob rests and recovers energy.');
    });

    it('dispatches events in correct order', async () => {
      const room = new ModEntityBuilder('test:room1').asRoom('Camp').build();

      const actor = new ModEntityBuilder('test:actor1')
        .withName('Carol')
        .atLocation('test:room1')
        .asActor()
        .withComponent('metabolism:metabolic_store', {
          current_energy: 50,
          max_energy: 100,
          base_burn_rate: 1.0,
          buffer_storage: [],
          buffer_capacity: 10
        })
        .withComponent('metabolism:fuel_converter', {
          capacity: 10,
          conversion_rate: 1.0,
          efficiency: 1.0,
          accepted_fuel_tags: ['food', 'drink'],
          metabolic_efficiency_multiplier: 0.9
        })
        .build();

      testFixture.reset([room, actor]);

      await testFixture.executeAction('test:actor1', null);

      const perceptibleIdx = testFixture.events.findIndex(
        e => e.eventType === 'core:perceptible_event'
      );
      const displayIdx = testFixture.events.findIndex(
        e => e.eventType === 'core:display_successful_action_result'
      );
      const successIdx = testFixture.events.findIndex(
        e => e.eventType === 'core:action_success'
      );
      const turnEndedIdx = testFixture.events.findIndex(
        e => e.eventType === 'core:turn_ended'
      );

      expect(perceptibleIdx).toBeLessThan(displayIdx);
      expect(displayIdx).toBeLessThan(successIdx);
      expect(successIdx).toBeLessThan(turnEndedIdx);
    });
  });

  describe('edge cases', () => {
    it('handles rest when energy is already at maximum', async () => {
      const room = new ModEntityBuilder('test:room1').asRoom('Lodge').build();

      const actor = new ModEntityBuilder('test:actor1')
        .withName('Dave')
        .atLocation('test:room1')
        .asActor()
        .withComponent('metabolism:metabolic_store', {
          current_energy: 100,
          max_energy: 100,
          base_burn_rate: 1.0,
          buffer_storage: [],
          buffer_capacity: 10
        })
        .withComponent('metabolism:fuel_converter', {
          capacity: 10,
          conversion_rate: 1.0,
          efficiency: 1.0,
          accepted_fuel_tags: ['food', 'drink'],
          metabolic_efficiency_multiplier: 1.0
        })
        .build();

      testFixture.reset([room, actor]);

      await testFixture.executeAction('test:actor1', null);

      const actorEntity = testFixture.entityManager.getEntityInstance('test:actor1');
      const metabolicStore = actorEntity.components['metabolism:metabolic_store'];

      expect(metabolicStore.current_energy).toBe(100);

      const fuelConverter = actorEntity.components['metabolism:fuel_converter'];
      expect(fuelConverter.metabolic_efficiency_multiplier).toBe(1.0);

      expect(testFixture.events).toHaveActionSuccess('Dave rests and recovers energy.');
      expect(testFixture.events).toDispatchEvent('core:turn_ended');
    });

    it('handles rest with non-empty buffer', async () => {
      const room = new ModEntityBuilder('test:room1').asRoom('Shelter').build();

      const actor = new ModEntityBuilder('test:actor1')
        .withName('Eve')
        .atLocation('test:room1')
        .asActor()
        .withComponent('metabolism:metabolic_store', {
          current_energy: 40,
          max_energy: 100,
          buffer_storage: [
            { bulk: 2, energy_content: 30 },
            { bulk: 1, energy_content: 15 }
          ],
          buffer_capacity: 10
        })
        .withComponent('metabolism:fuel_converter', {
          capacity: 10,
          conversion_rate: 1.0,
          efficiency: 1.0,
          accepted_fuel_tags: ['food', 'drink'],
          metabolic_efficiency_multiplier: 0.7
        })
        .build();

      testFixture.reset([room, actor]);

      await testFixture.executeAction('test:actor1', null);

      const actorEntity = testFixture.entityManager.getEntityInstance('test:actor1');
      const metabolicStore = actorEntity.components['metabolism:metabolic_store'];

      expect(metabolicStore.current_energy).toBe(100);
      expect(metabolicStore.buffer_storage).toHaveLength(2);

      const fuelConverter = actorEntity.components['metabolism:fuel_converter'];
      expect(fuelConverter.metabolic_efficiency_multiplier).toBe(1.0);

      expect(testFixture.events).toHaveActionSuccess('Eve rests and recovers energy.');
    });

    it('handles rest with different max_energy values', async () => {
      const room = new ModEntityBuilder('test:room1').asRoom('Fortress').build();

      const actor = new ModEntityBuilder('test:actor1')
        .withName('Frank')
        .atLocation('test:room1')
        .asActor()
        .withComponent('metabolism:metabolic_store', {
          current_energy: 20,
          max_energy: 150,
          base_burn_rate: 1.0,
          buffer_storage: [],
          buffer_capacity: 10
        })
        .withComponent('metabolism:fuel_converter', {
          capacity: 10,
          conversion_rate: 1.0,
          efficiency: 1.0,
          accepted_fuel_tags: ['food', 'drink'],
          metabolic_efficiency_multiplier: 1.2
        })
        .build();

      testFixture.reset([room, actor]);

      await testFixture.executeAction('test:actor1', null);

      const actorEntity = testFixture.entityManager.getEntityInstance('test:actor1');
      const metabolicStore = actorEntity.components['metabolism:metabolic_store'];

      expect(metabolicStore.current_energy).toBe(150);

      expect(testFixture.events).toHaveActionSuccess('Frank rests and recovers energy.');
    });
  });
});
