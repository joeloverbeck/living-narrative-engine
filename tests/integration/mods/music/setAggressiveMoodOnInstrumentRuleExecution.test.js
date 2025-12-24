/**
 * @file Integration tests for the handle_set_aggressive_mood_on_instrument rule execution.
 * @description Tests that the rule correctly sets performance mood, adds playing_music and doing_complex_performance components,
 * and dispatches appropriate events.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import '../../../common/mods/domainMatchers.js';
import '../../../common/actionMatchers.js';
import setAggressiveMoodRule from '../../../../data/mods/music/rules/handle_set_aggressive_mood_on_instrument.rule.json' assert { type: 'json' };
import eventIsActionSetAggressiveMood from '../../../../data/mods/music/conditions/event-is-action-set-aggressive-mood-on-instrument.condition.json' assert { type: 'json' };

describe('music:set_aggressive_mood_on_instrument - Rule Execution', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'music',
      'music:set_aggressive_mood_on_instrument',
      setAggressiveMoodRule,
      eventIsActionSetAggressiveMood
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Successfully executes set_aggressive_mood_on_instrument action', () => {
    it('should add performance_mood component with aggressive mood', async () => {
      const room = ModEntityScenarios.createRoom('room1', 'Music Hall');

      const actor = new ModEntityBuilder('actor1')
        .withName('Angry Bard')
        .atLocation('room1')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('inventory:inventory', {
          items: ['lute_1'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const instrument = new ModEntityBuilder('lute_1')
        .withName('battle lute')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, actor, instrument]);

      await testFixture.executeAction('actor1', 'lute_1');

      const actorInstance =
        testFixture.entityManager.getEntityInstance('actor1');
      expect(actorInstance).toHaveComponent('music:performance_mood');

      const moodComponent = actorInstance.components['music:performance_mood'];
      expect(moodComponent).toBeDefined();
      expect(moodComponent.mood).toBe('aggressive');
    });

    it('should add playing_music component with instrument reference', async () => {
      const room = ModEntityScenarios.createRoom('room1', 'Music Hall');

      const actor = new ModEntityBuilder('actor1')
        .withName('Fierce Performer')
        .atLocation('room1')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('inventory:inventory', {
          items: ['guitar_1'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const instrument = new ModEntityBuilder('guitar_1')
        .withName('electric guitar')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, actor, instrument]);

      await testFixture.executeAction('actor1', 'guitar_1');

      const actorInstance =
        testFixture.entityManager.getEntityInstance('actor1');
      expect(actorInstance).toHaveComponent('music:playing_music');

      const playingComponent = actorInstance.components['music:playing_music'];
      expect(playingComponent).toBeDefined();
      expect(playingComponent.playing_on).toBe('guitar_1');
    });

    it('should add doing_complex_performance component', async () => {
      const room = ModEntityScenarios.createRoom('room1', 'Music Hall');

      const actor = new ModEntityBuilder('actor1')
        .withName('Intense Musician')
        .atLocation('room1')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('inventory:inventory', {
          items: ['drum_1'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const instrument = new ModEntityBuilder('drum_1')
        .withName('war drum')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, actor, instrument]);

      await testFixture.executeAction('actor1', 'drum_1');

      const actorInstance =
        testFixture.entityManager.getEntityInstance('actor1');
      expect(actorInstance).toHaveComponent(
        'performances-states:doing_complex_performance'
      );
    });

    it('should add all three components in a single action execution', async () => {
      const room = ModEntityScenarios.createRoom('room1', 'Music Hall');

      const actor = new ModEntityBuilder('actor1')
        .withName('Comprehensive Test Bard')
        .atLocation('room1')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('inventory:inventory', {
          items: ['flute_1'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const instrument = new ModEntityBuilder('flute_1')
        .withName('aggressive flute')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, actor, instrument]);

      await testFixture.executeAction('actor1', 'flute_1');

      const actorInstance =
        testFixture.entityManager.getEntityInstance('actor1');

      // Verify all three components are present
      expect(actorInstance).toHaveComponent('music:performance_mood');
      expect(actorInstance).toHaveComponent('music:playing_music');
      expect(actorInstance).toHaveComponent(
        'performances-states:doing_complex_performance'
      );

      // Verify component data
      const moodComponent = actorInstance.components['music:performance_mood'];
      expect(moodComponent.mood).toBe('aggressive');

      const playingComponent = actorInstance.components['music:playing_music'];
      expect(playingComponent.playing_on).toBe('flute_1');
    });

    it('should dispatch action success event', async () => {
      const room = ModEntityScenarios.createRoom('room1', 'Music Hall');

      const actor = new ModEntityBuilder('actor1')
        .withName('Event Test Musician')
        .atLocation('room1')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('inventory:inventory', {
          items: ['lute_1'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const instrument = new ModEntityBuilder('lute_1')
        .withName('lute')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, actor, instrument]);

      await testFixture.executeAction('actor1', 'lute_1');

      expect(testFixture.events).toHaveActionSuccess();
    });

    it('should dispatch perceptible event with correct message using mood adjective', async () => {
      const room = ModEntityScenarios.createRoom('room1', 'Music Hall');

      const actor = new ModEntityBuilder('actor1')
        .withName('Message Test Bard')
        .atLocation('room1')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('inventory:inventory', {
          items: ['guitar_1'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const instrument = new ModEntityBuilder('guitar_1')
        .withName('shredding guitar')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, actor, instrument]);

      await testFixture.executeAction('actor1', 'guitar_1');

      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvents.length).toBeGreaterThan(0);

      const perceptibleEvent = perceptibleEvents[0];
      expect(perceptibleEvent.payload).toBeDefined();
      expect(perceptibleEvent.payload.descriptionText).toBeDefined();

      // The message should contain the mood adjective from the lookup
      // For 'aggressive', the adjective is 'hard-edged'
      expect(perceptibleEvent.payload.descriptionText).toContain(
        'Message Test Bard'
      );
      expect(perceptibleEvent.payload.descriptionText).toContain('hard-edged');
      expect(perceptibleEvent.payload.descriptionText).toContain(
        'shredding guitar'
      );
      expect(perceptibleEvent.payload.descriptionText).toMatch(
        /sets a.*tone on/
      );
    });

    it('should work with instrument at actor location (not in inventory)', async () => {
      const room = ModEntityScenarios.createRoom('room1', 'Music Hall');

      const actor = new ModEntityBuilder('actor1')
        .withName('Location Test Bard')
        .atLocation('room1')
        .asActor()
        .withComponent('music:is_musician', {})
        .build();

      const instrument = new ModEntityBuilder('lute_1')
        .withName('nearby lute')
        .atLocation('room1')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, actor, instrument]);

      await testFixture.executeAction('actor1', 'lute_1');

      const actorInstance =
        testFixture.entityManager.getEntityInstance('actor1');
      expect(actorInstance).toHaveComponent('music:performance_mood');
      expect(actorInstance).toHaveComponent('music:playing_music');
      expect(actorInstance).toHaveComponent(
        'performances-states:doing_complex_performance'
      );
      expect(testFixture.events).toHaveActionSuccess();
    });
  });

  describe('Component update behavior', () => {
    it('should update performance_mood if actor already has a different mood', async () => {
      const room = ModEntityScenarios.createRoom('room1', 'Music Hall');

      const actor = new ModEntityBuilder('actor1')
        .withName('Mood Changing Bard')
        .atLocation('room1')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('music:performance_mood', { mood: 'cheerful' })
        .withComponent('inventory:inventory', {
          items: ['lute_1'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const instrument = new ModEntityBuilder('lute_1')
        .withName('versatile lute')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, actor, instrument]);

      // Verify initial mood
      let actorInstance = testFixture.entityManager.getEntityInstance('actor1');
      let moodComponent = actorInstance.components['music:performance_mood'];
      expect(moodComponent.mood).toBe('cheerful');

      // Execute action
      await testFixture.executeAction('actor1', 'lute_1');

      // Verify mood changed to aggressive
      actorInstance = testFixture.entityManager.getEntityInstance('actor1');
      moodComponent = actorInstance.components['music:performance_mood'];
      expect(moodComponent.mood).toBe('aggressive');
      expect(testFixture.events).toHaveActionSuccess();
    });

    it('should update playing_music if actor is already playing a different instrument', async () => {
      const room = ModEntityScenarios.createRoom('room1', 'Music Hall');

      const actor = new ModEntityBuilder('actor1')
        .withName('Instrument Switcher')
        .atLocation('room1')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('music:playing_music', { playing_on: 'old_instrument' })
        .withComponent('inventory:inventory', {
          items: ['guitar_1'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const instrument = new ModEntityBuilder('guitar_1')
        .withName('new guitar')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, actor, instrument]);

      // Verify initial instrument
      let actorInstance = testFixture.entityManager.getEntityInstance('actor1');
      let playingComponent = actorInstance.components['music:playing_music'];
      expect(playingComponent.playing_on).toBe('old_instrument');

      // Execute action
      await testFixture.executeAction('actor1', 'guitar_1');

      // Verify instrument changed
      actorInstance = testFixture.entityManager.getEntityInstance('actor1');
      playingComponent = actorInstance.components['music:playing_music'];
      expect(playingComponent.playing_on).toBe('guitar_1');
      expect(testFixture.events).toHaveActionSuccess();
    });
  });

  describe('Edge cases and validation', () => {
    it('should handle multiple sequential mood changes correctly', async () => {
      const room = ModEntityScenarios.createRoom('room1', 'Music Hall');

      const actor = new ModEntityBuilder('actor1')
        .withName('Volatile Bard')
        .atLocation('room1')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('inventory:inventory', {
          items: ['lute_1'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const instrument = new ModEntityBuilder('lute_1')
        .withName('mood lute')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, actor, instrument]);

      // First execution
      await testFixture.executeAction('actor1', 'lute_1');

      let actorInstance = testFixture.entityManager.getEntityInstance('actor1');
      let moodComponent = actorInstance.components['music:performance_mood'];
      expect(moodComponent.mood).toBe('aggressive');

      // Clear events for next execution
      testFixture.clearEvents();

      // Second execution - should still work
      await testFixture.executeAction('actor1', 'lute_1');

      actorInstance = testFixture.entityManager.getEntityInstance('actor1');
      moodComponent = actorInstance.components['music:performance_mood'];
      expect(moodComponent.mood).toBe('aggressive');
      expect(testFixture.events).toHaveActionSuccess();
    });

    it('should include locationId in perceptible event', async () => {
      const room = ModEntityScenarios.createRoom(
        'concert_hall',
        'Grand Concert Hall'
      );

      const actor = new ModEntityBuilder('actor1')
        .withName('Location Event Bard')
        .atLocation('concert_hall')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('inventory:inventory', {
          items: ['violin_1'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const instrument = new ModEntityBuilder('violin_1')
        .withName('aggressive violin')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, actor, instrument]);

      await testFixture.executeAction('actor1', 'violin_1');

      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvents.length).toBeGreaterThan(0);

      const perceptibleEvent = perceptibleEvents[0];
      expect(perceptibleEvent.payload.locationId).toBe('concert_hall');
    });

    it('should include targetId in perceptible event', async () => {
      const room = ModEntityScenarios.createRoom('room1', 'Music Hall');

      const actor = new ModEntityBuilder('actor1')
        .withName('Target Event Bard')
        .atLocation('room1')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('inventory:inventory', {
          items: ['trumpet_1'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const instrument = new ModEntityBuilder('trumpet_1')
        .withName('war trumpet')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, actor, instrument]);

      await testFixture.executeAction('actor1', 'trumpet_1');

      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvents.length).toBeGreaterThan(0);

      const perceptibleEvent = perceptibleEvents[0];
      expect(perceptibleEvent.payload.targetId).toBe('trumpet_1');
    });
  });
});
