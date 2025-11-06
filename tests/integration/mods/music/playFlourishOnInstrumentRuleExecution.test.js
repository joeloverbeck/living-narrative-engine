/**
 * @file Integration tests for handle_play_flourish_on_instrument rule execution.
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
import playFlourishRule from '../../../../data/mods/music/rules/handle_play_flourish_on_instrument.rule.json' assert { type: 'json' };
import eventIsActionPlayFlourish from '../../../../data/mods/music/conditions/event-is-action-play-flourish-on-instrument.condition.json' assert { type: 'json' };

describe('music:play_flourish_on_instrument - Rule Execution', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'music',
      'music:play_flourish_on_instrument',
      playFlourishRule,
      eventIsActionPlayFlourish
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Successfully executes play_flourish_on_instrument action', () => {
    it('should dispatch perceptible event with mood-adjective-flavored message', async () => {
      const room = ModEntityScenarios.createRoom('concert_hall', 'Concert Hall');

      const musician = new ModEntityBuilder('musician1')
        .withName('Felix')
        .atLocation('concert_hall')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('music:playing_music', {
          playing_on: 'flute1',
        })
        .withComponent('music:performance_mood', {
          mood: 'playful',
        })
        .build();

      const instrument = new ModEntityBuilder('flute1')
        .withName('silver flute')
        .withComponent('items:item', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);

      await testFixture.executeAction('musician1', 'flute1');

      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvents.length).toBeGreaterThan(0);

      const perceptibleEvent = perceptibleEvents[0];
      expect(perceptibleEvent.payload).toBeDefined();
      expect(perceptibleEvent.payload.descriptionText).toBeDefined();

      // The message should contain the mood adjective from the lookup
      // For 'playful', the adjective is 'teasing'
      expect(perceptibleEvent.payload.descriptionText).toContain('Felix');
      expect(perceptibleEvent.payload.descriptionText).toContain('teasing');
      expect(perceptibleEvent.payload.descriptionText).toContain('flourish');
      expect(perceptibleEvent.payload.descriptionText).toContain('silver flute');
      expect(perceptibleEvent.payload.descriptionText).toMatch(/flashes a.*flourish on/);
    });

    it('should dispatch action success event', async () => {
      const room = ModEntityScenarios.createRoom('studio', 'Music Studio');

      const musician = new ModEntityBuilder('musician1')
        .withName('Marcus')
        .atLocation('studio')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('music:playing_music', {
          playing_on: 'trumpet1',
        })
        .withComponent('music:performance_mood', {
          mood: 'triumphant',
        })
        .build();

      const instrument = new ModEntityBuilder('trumpet1')
        .withName('brass trumpet')
        .atLocation('studio')
        .withComponent('items:item', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);

      await testFixture.executeAction('musician1', 'trumpet1');

      expect(testFixture.events).toHaveActionSuccess();
    });

    it('should work with all 4 compatible moods from mood_lexicon', async () => {
      const moods = [
        { mood: 'playful', expectedAdj: 'teasing' },
        { mood: 'triumphant', expectedAdj: 'bold' },
        { mood: 'cheerful', expectedAdj: 'bright' },
        { mood: 'tender', expectedAdj: 'soft' },
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
        expect(perceptibleEvent.payload.descriptionText).toContain('flourish');

        // Clear events for next iteration
        testFixture.clearEvents();
      }
    });

    it('should use fallback adjective when mood not found in lexicon', async () => {
      const room = ModEntityScenarios.createRoom('test_room', 'Test Room');

      const musician = new ModEntityBuilder('musician1')
        .withName('Tester')
        .atLocation('test_room')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('music:playing_music', {
          playing_on: 'instrument1',
        })
        .withComponent('music:performance_mood', {
          mood: 'nonexistent_mood',
        })
        .build();

      const instrument = new ModEntityBuilder('instrument1')
        .withName('test instrument')
        .withComponent('items:item', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);

      await testFixture.executeAction('musician1', 'instrument1');

      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvents.length).toBeGreaterThan(0);
      const perceptibleEvent = perceptibleEvents[0];
      expect(perceptibleEvent.payload.descriptionText).toContain('flashy');
    });
  });

  describe('Edge cases and validation', () => {
    it('should handle multiple sequential flourish performances correctly', async () => {
      const room = ModEntityScenarios.createRoom('concert_hall', 'Concert Hall');

      const musician = new ModEntityBuilder('musician1')
        .withName('Lyra')
        .atLocation('concert_hall')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('music:playing_music', {
          playing_on: 'lute1',
        })
        .withComponent('music:performance_mood', {
          mood: 'cheerful',
        })
        .build();

      const instrument = new ModEntityBuilder('lute1')
        .withName('silver lute')
        .withComponent('items:item', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);

      // Execute flourish twice
      await testFixture.executeAction('musician1', 'lute1');
      const firstEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );
      expect(firstEvents.length).toBeGreaterThan(0);

      testFixture.clearEvents();

      await testFixture.executeAction('musician1', 'lute1');
      const secondEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );
      expect(secondEvents.length).toBeGreaterThan(0);
    });

    it('should include locationId in perceptible event', async () => {
      const room = ModEntityScenarios.createRoom('grand_hall', 'Grand Hall');

      const musician = new ModEntityBuilder('musician1')
        .withName('Zara')
        .atLocation('grand_hall')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('music:playing_music', {
          playing_on: 'harp1',
        })
        .withComponent('music:performance_mood', {
          mood: 'tender',
        })
        .build();

      const instrument = new ModEntityBuilder('harp1')
        .withName('wooden harp')
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
      expect(perceptibleEvent.payload.locationId).toBe('grand_hall');
    });

    it('should include targetId in perceptible event', async () => {
      const room = ModEntityScenarios.createRoom('studio', 'Studio');

      const musician = new ModEntityBuilder('musician1')
        .withName('Kael')
        .atLocation('studio')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('music:playing_music', {
          playing_on: 'drums1',
        })
        .withComponent('music:performance_mood', {
          mood: 'triumphant',
        })
        .build();

      const instrument = new ModEntityBuilder('drums1')
        .withName('war drums')
        .withComponent('items:item', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);

      await testFixture.executeAction('musician1', 'drums1');

      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvents.length).toBeGreaterThan(0);
      const perceptibleEvent = perceptibleEvents[0];
      expect(perceptibleEvent.payload.targetId).toBe('drums1');
    });
  });
});
