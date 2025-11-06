/**
 * @file Integration tests for handle_play_drone_on_instrument rule execution.
 * @description Tests that the rule correctly retrieves mood adjective and dispatches perceptible events.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import '../../../common/mods/domainMatchers.js';
import '../../../common/actionMatchers.js';
import playDroneRule from '../../../../data/mods/music/rules/handle_play_drone_on_instrument.rule.json' assert { type: 'json' };
import eventIsActionPlayDrone from '../../../../data/mods/music/conditions/event-is-action-play-drone-on-instrument.condition.json' assert { type: 'json' };

describe('music:play_drone_on_instrument - Rule Execution', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'music',
      'music:play_drone_on_instrument',
      playDroneRule,
      eventIsActionPlayDrone
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Successfully executes play_drone_on_instrument action', () => {
    it('should dispatch perceptible event with mood-adjective-flavored message', async () => {
      const room = ModEntityScenarios.createRoom('cathedral', 'Cathedral');

      const musician = new ModEntityBuilder('musician1')
        .withName('Kael')
        .atLocation('cathedral')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('music:playing_music', {
          playing_on: 'organ1',
        })
        .withComponent('music:performance_mood', {
          mood: 'solemn',
        })
        .build();

      const instrument = new ModEntityBuilder('organ1')
        .withName('pipe organ')
        .withComponent('items:item', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);

      await testFixture.executeAction('musician1', 'organ1');

      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvents.length).toBeGreaterThan(0);

      const perceptibleEvent = perceptibleEvents[0];
      expect(perceptibleEvent.payload).toBeDefined();
      expect(perceptibleEvent.payload.descriptionText).toBeDefined();

      // The message should contain the mood adjective from the lookup
      // For 'solemn', the adjective is 'grave'
      expect(perceptibleEvent.payload.descriptionText).toContain('Kael');
      expect(perceptibleEvent.payload.descriptionText).toContain('grave');
      expect(perceptibleEvent.payload.descriptionText).toContain('drone');
      expect(perceptibleEvent.payload.descriptionText).toContain('pipe organ');
      expect(perceptibleEvent.payload.descriptionText).toMatch(/holds a.*drone on/);
    });

    it('should dispatch action success event', async () => {
      const room = ModEntityScenarios.createRoom('temple', 'Temple');

      const musician = new ModEntityBuilder('musician1')
        .withName('Lyra')
        .atLocation('temple')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('music:playing_music', {
          playing_on: 'bowl1',
        })
        .withComponent('music:performance_mood', {
          mood: 'meditative',
        })
        .build();

      const instrument = new ModEntityBuilder('bowl1')
        .withName('singing bowl')
        .atLocation('temple')
        .withComponent('items:item', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);

      await testFixture.executeAction('musician1', 'bowl1');

      expect(testFixture.events).toHaveActionSuccess();
    });

    it('should work with all 4 compatible moods from mood_lexicon', async () => {
      const moods = [
        { mood: 'eerie', expectedAdj: 'unsettling' },
        { mood: 'solemn', expectedAdj: 'grave' },
        { mood: 'meditative', expectedAdj: 'calm' },
        { mood: 'mournful', expectedAdj: 'aching' },
      ];

      for (const { mood, expectedAdj } of moods) {
        const room = ModEntityScenarios.createRoom('hall', 'Hall');

        const musician = new ModEntityBuilder('musician1')
          .withName('Performer')
          .atLocation('hall')
          .asActor()
          .withComponent('music:is_musician', {})
          .withComponent('music:playing_music', {
            playing_on: 'instrument1',
          })
          .withComponent('music:performance_mood', {
            mood: mood,
          })
          .build();

        const instrument = new ModEntityBuilder('instrument1')
          .withName('test instrument')
          .withComponent('items:item', {})
          .withComponent('items:portable', {})
          .withComponent('music:is_instrument', {})
          .build();

        testFixture.reset([room, musician, instrument]);

        await testFixture.executeAction('musician1', 'instrument1');

        const perceptibleEvents = testFixture.events.filter(
          (e) => e.eventType === 'core:perceptible_event'
        );

        expect(perceptibleEvents.length).toBeGreaterThan(0);

        const perceptibleEvent = perceptibleEvents[0];
        expect(perceptibleEvent.payload.descriptionText).toContain(expectedAdj);
        expect(perceptibleEvent.payload.descriptionText).toContain('drone');

        // Clear events for next iteration
        testFixture.clearEvents();
      }
    });

    it('should use fallback adjective when mood not found in lexicon', async () => {
      const room = ModEntityScenarios.createRoom('hall', 'Hall');

      const musician = new ModEntityBuilder('musician1')
        .withName('Test Bard')
        .atLocation('hall')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('music:playing_music', {
          playing_on: 'lute1',
        })
        .withComponent('music:performance_mood', {
          mood: 'nonexistent_mood',
        })
        .build();

      const instrument = new ModEntityBuilder('lute1')
        .withName('lute')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);

      await testFixture.executeAction('musician1', 'lute1');

      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvents.length).toBeGreaterThan(0);

      const perceptibleEvent = perceptibleEvents[0];
      // Should use the fallback value from missing_value parameter
      expect(perceptibleEvent.payload.descriptionText).toContain('resonant');
    });
  });

  describe('Edge cases and validation', () => {
    it('should handle multiple sequential drone performances correctly', async () => {
      const room = ModEntityScenarios.createRoom('hall', 'Hall');

      const musician = new ModEntityBuilder('musician1')
        .withName('Virtuoso')
        .atLocation('hall')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('music:playing_music', {
          playing_on: 'cello1',
        })
        .withComponent('music:performance_mood', {
          mood: 'mournful',
        })
        .build();

      const instrument = new ModEntityBuilder('cello1')
        .withName('cello')
        .withComponent('items:item', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);

      // First drone
      await testFixture.executeAction('musician1', 'cello1');
      expect(testFixture.events).toHaveActionSuccess();

      // Clear events
      testFixture.clearEvents();

      // Second drone
      await testFixture.executeAction('musician1', 'cello1');
      expect(testFixture.events).toHaveActionSuccess();

      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvents.length).toBeGreaterThan(0);
      expect(perceptibleEvents[0].payload.descriptionText).toContain('aching');
    });

    it('should include locationId in perceptible event', async () => {
      const room = ModEntityScenarios.createRoom('monastery', 'Monastery');

      const musician = new ModEntityBuilder('musician1')
        .withName('Location Test Musician')
        .atLocation('monastery')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('music:playing_music', {
          playing_on: 'theremin1',
        })
        .withComponent('music:performance_mood', {
          mood: 'eerie',
        })
        .build();

      const instrument = new ModEntityBuilder('theremin1')
        .withName('theremin')
        .withComponent('items:item', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);

      await testFixture.executeAction('musician1', 'theremin1');

      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvents.length).toBeGreaterThan(0);

      const perceptibleEvent = perceptibleEvents[0];
      expect(perceptibleEvent.payload.locationId).toBe('monastery');
    });

    it('should include targetId in perceptible event', async () => {
      const room = ModEntityScenarios.createRoom('room1', 'Room');

      const musician = new ModEntityBuilder('musician1')
        .withName('Target Test Musician')
        .atLocation('room1')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('music:playing_music', {
          playing_on: 'harp1',
        })
        .withComponent('music:performance_mood', {
          mood: 'meditative',
        })
        .build();

      const instrument = new ModEntityBuilder('harp1')
        .withName('celtic harp')
        .withComponent('items:item', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);

      await testFixture.executeAction('musician1', 'harp1');

      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvents.length).toBeGreaterThan(0);

      const perceptibleEvent = perceptibleEvents[0];
      expect(perceptibleEvent.payload.targetId).toBe('harp1');
    });
  });
});
