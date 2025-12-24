/**
 * @file Integration tests for handle_play_phrase_on_instrument rule execution.
 * @description Tests that the rule correctly retrieves mood descriptors and dispatches perceptible events.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import '../../../common/mods/domainMatchers.js';
import '../../../common/actionMatchers.js';
import playPhraseRule from '../../../../data/mods/music/rules/handle_play_phrase_on_instrument.rule.json' assert { type: 'json' };
import eventIsActionPlayPhrase from '../../../../data/mods/music/conditions/event-is-action-play-phrase-on-instrument.condition.json' assert { type: 'json' };

describe('music:play_phrase_on_instrument - Rule Execution', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'music',
      'music:play_phrase_on_instrument',
      playPhraseRule,
      eventIsActionPlayPhrase
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Successfully executes play_phrase_on_instrument action', () => {
    it('should dispatch perceptible event with mood-flavored message', async () => {
      const room = ModEntityScenarios.createRoom(
        'concert_hall',
        'Concert Hall'
      );

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
        .withComponent('performances-states:doing_complex_performance', {})
        .build();

      const instrument = new ModEntityBuilder('lute1')
        .withName('silver lute')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);

      await testFixture.executeAction('musician1', 'lute1');

      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvents.length).toBeGreaterThan(0);

      const perceptibleEvent = perceptibleEvents[0];
      expect(perceptibleEvent.payload).toBeDefined();
      expect(perceptibleEvent.payload.descriptionText).toBeDefined();

      // The message should contain the mood adjectives from the lookup
      // For 'cheerful', the adjectives are 'bright, skipping'
      expect(perceptibleEvent.payload.descriptionText).toContain('Lyra');
      expect(perceptibleEvent.payload.descriptionText).toContain(
        'bright, skipping'
      );
      expect(perceptibleEvent.payload.descriptionText).toContain('silver lute');
      expect(perceptibleEvent.payload.descriptionText).toMatch(
        /shapes a.*phrase on/
      );
    });

    it('should dispatch action success event', async () => {
      const room = ModEntityScenarios.createRoom('studio', 'Music Studio');

      const musician = new ModEntityBuilder('musician1')
        .withName('Marcus')
        .atLocation('studio')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('music:playing_music', {
          playing_on: 'piano1',
        })
        .withComponent('music:performance_mood', {
          mood: 'solemn',
        })
        .build();

      const instrument = new ModEntityBuilder('piano1')
        .withName('grand piano')
        .atLocation('studio')
        .withComponent('items-core:item', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);

      await testFixture.executeAction('musician1', 'piano1');

      expect(testFixture.events).toHaveActionSuccess();
    });

    it('should work with all 10 moods from mood_lexicon', async () => {
      const moods = [
        { mood: 'cheerful', expectedAdjectives: 'bright, skipping' },
        { mood: 'solemn', expectedAdjectives: 'measured, weighty' },
        { mood: 'mournful', expectedAdjectives: 'low, aching' },
        { mood: 'eerie', expectedAdjectives: 'thin, uneasy' },
        { mood: 'tense', expectedAdjectives: 'insistent, tight' },
        { mood: 'triumphant', expectedAdjectives: 'ringing, bold' },
        { mood: 'tender', expectedAdjectives: 'soft, warm' },
        { mood: 'playful', expectedAdjectives: 'quick, teasing' },
        { mood: 'aggressive', expectedAdjectives: 'driving, sharp' },
        { mood: 'meditative', expectedAdjectives: 'slow, even' },
      ];

      for (const { mood, expectedAdjectives } of moods) {
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
          .withComponent('items-core:item', {})
          .withComponent('items-core:portable', {})
          .withComponent('music:is_instrument', {})
          .build();

        testFixture.reset([room, musician, instrument]);

        await testFixture.executeAction('musician1', 'instrument1');

        const perceptibleEvents = testFixture.events.filter(
          (e) => e.eventType === 'core:perceptible_event'
        );

        expect(perceptibleEvents.length).toBeGreaterThan(0);

        const perceptibleEvent = perceptibleEvents[0];
        expect(perceptibleEvent.payload.descriptionText).toContain(
          expectedAdjectives
        );

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
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
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
      expect(perceptibleEvent.payload.descriptionText).toContain('expressive');
    });
  });

  describe('Edge cases and validation', () => {
    it('should handle multiple sequential phrase performances correctly', async () => {
      const room = ModEntityScenarios.createRoom('hall', 'Hall');

      const musician = new ModEntityBuilder('musician1')
        .withName('Virtuoso')
        .atLocation('hall')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('music:playing_music', {
          playing_on: 'violin1',
        })
        .withComponent('music:performance_mood', {
          mood: 'tender',
        })
        .build();

      const instrument = new ModEntityBuilder('violin1')
        .withName('violin')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);

      // First phrase
      await testFixture.executeAction('musician1', 'violin1');
      expect(testFixture.events).toHaveActionSuccess();

      // Clear events
      testFixture.clearEvents();

      // Second phrase
      await testFixture.executeAction('musician1', 'violin1');
      expect(testFixture.events).toHaveActionSuccess();

      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvents.length).toBeGreaterThan(0);
      expect(perceptibleEvents[0].payload.descriptionText).toContain(
        'soft, warm'
      );
    });

    it('should include locationId in perceptible event', async () => {
      const room = ModEntityScenarios.createRoom('grand_hall', 'Grand Hall');

      const musician = new ModEntityBuilder('musician1')
        .withName('Location Test Musician')
        .atLocation('grand_hall')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('music:playing_music', {
          playing_on: 'harp1',
        })
        .withComponent('music:performance_mood', {
          mood: 'playful',
        })
        .build();

      const instrument = new ModEntityBuilder('harp1')
        .withName('golden harp')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
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
      const room = ModEntityScenarios.createRoom('room1', 'Room');

      const musician = new ModEntityBuilder('musician1')
        .withName('Target Test Musician')
        .atLocation('room1')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('music:playing_music', {
          playing_on: 'drum1',
        })
        .withComponent('music:performance_mood', {
          mood: 'aggressive',
        })
        .build();

      const instrument = new ModEntityBuilder('drum1')
        .withName('war drum')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);

      await testFixture.executeAction('musician1', 'drum1');

      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvents.length).toBeGreaterThan(0);

      const perceptibleEvent = perceptibleEvents[0];
      expect(perceptibleEvent.payload.targetId).toBe('drum1');
    });
  });
});
