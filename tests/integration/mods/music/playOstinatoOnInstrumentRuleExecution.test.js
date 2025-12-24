/**
 * @file Integration tests for handle_play_ostinato_on_instrument rule execution.
 * @description Tests that the rule correctly retrieves mood noun and dispatches perceptible events.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import '../../../common/mods/domainMatchers.js';
import '../../../common/actionMatchers.js';
import playOstinatoRule from '../../../../data/mods/music/rules/handle_play_ostinato_on_instrument.rule.json' assert { type: 'json' };
import eventIsActionPlayOstinato from '../../../../data/mods/music/conditions/event-is-action-play-ostinato-on-instrument.condition.json' assert { type: 'json' };

describe('music:play_ostinato_on_instrument - Rule Execution', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'music',
      'music:play_ostinato_on_instrument',
      playOstinatoRule,
      eventIsActionPlayOstinato
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Successfully executes play_ostinato_on_instrument action', () => {
    it('should dispatch perceptible event with mood-noun-flavored message', async () => {
      const room = ModEntityScenarios.createRoom(
        'concert_hall',
        'Concert Hall'
      );

      const musician = new ModEntityBuilder('musician1')
        .withName('Kael')
        .atLocation('concert_hall')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('music:playing_music', {
          playing_on: 'drums1',
        })
        .withComponent('music:performance_mood', {
          mood: 'tense',
        })
        .build();

      const instrument = new ModEntityBuilder('drums1')
        .withName('war drums')
        .withComponent('items-core:item', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);

      await testFixture.executeAction('musician1', 'drums1');

      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvents.length).toBeGreaterThan(0);

      const perceptibleEvent = perceptibleEvents[0];
      expect(perceptibleEvent.payload).toBeDefined();
      expect(perceptibleEvent.payload.descriptionText).toBeDefined();

      // The message should contain the mood noun from the lookup
      // For 'tense', the noun is 'tight'
      expect(perceptibleEvent.payload.descriptionText).toContain('Kael');
      expect(perceptibleEvent.payload.descriptionText).toContain('tight');
      expect(perceptibleEvent.payload.descriptionText).toContain('ostinato');
      expect(perceptibleEvent.payload.descriptionText).toContain('war drums');
      expect(perceptibleEvent.payload.descriptionText).toMatch(
        /locks into a.*ostinato on/
      );
    });

    it('should dispatch action success event', async () => {
      const room = ModEntityScenarios.createRoom('studio', 'Music Studio');

      const musician = new ModEntityBuilder('musician1')
        .withName('Lyra')
        .atLocation('studio')
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
        .atLocation('studio')
        .withComponent('items-core:item', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);

      await testFixture.executeAction('musician1', 'lute1');

      expect(testFixture.events).toHaveActionSuccess();
    });

    it('should work with all 6 compatible moods from mood_lexicon', async () => {
      const moods = [
        { mood: 'tense', expectedNoun: 'tight' },
        { mood: 'cheerful', expectedNoun: 'bouncy' },
        { mood: 'aggressive', expectedNoun: 'hard-driving' },
        { mood: 'playful', expectedNoun: 'skipping' },
        { mood: 'meditative', expectedNoun: 'steady' },
        { mood: 'solemn', expectedNoun: 'grave' },
      ];

      for (const { mood, expectedNoun } of moods) {
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
          expectedNoun
        );
        expect(perceptibleEvent.payload.descriptionText).toContain('ostinato');

        // Clear events for next iteration
        testFixture.clearEvents();
      }
    });

    it('should use fallback noun when mood not found in lexicon', async () => {
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
      expect(perceptibleEvent.payload.descriptionText).toContain('rhythmic');
    });
  });

  describe('Edge cases and validation', () => {
    it('should handle multiple sequential ostinato performances correctly', async () => {
      const room = ModEntityScenarios.createRoom('hall', 'Hall');

      const musician = new ModEntityBuilder('musician1')
        .withName('Virtuoso')
        .atLocation('hall')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('music:playing_music', {
          playing_on: 'piano1',
        })
        .withComponent('music:performance_mood', {
          mood: 'meditative',
        })
        .build();

      const instrument = new ModEntityBuilder('piano1')
        .withName('piano')
        .withComponent('items-core:item', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);

      // First ostinato
      await testFixture.executeAction('musician1', 'piano1');
      expect(testFixture.events).toHaveActionSuccess();

      // Clear events
      testFixture.clearEvents();

      // Second ostinato
      await testFixture.executeAction('musician1', 'piano1');
      expect(testFixture.events).toHaveActionSuccess();

      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvents.length).toBeGreaterThan(0);
      expect(perceptibleEvents[0].payload.descriptionText).toContain('steady');
    });

    it('should include locationId in perceptible event', async () => {
      const room = ModEntityScenarios.createRoom('grand_hall', 'Grand Hall');

      const musician = new ModEntityBuilder('musician1')
        .withName('Location Test Musician')
        .atLocation('grand_hall')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('music:playing_music', {
          playing_on: 'guitar1',
        })
        .withComponent('music:performance_mood', {
          mood: 'aggressive',
        })
        .build();

      const instrument = new ModEntityBuilder('guitar1')
        .withName('electric guitar')
        .withComponent('items-core:item', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);

      await testFixture.executeAction('musician1', 'guitar1');

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
          playing_on: 'flute1',
        })
        .withComponent('music:performance_mood', {
          mood: 'playful',
        })
        .build();

      const instrument = new ModEntityBuilder('flute1')
        .withName('wooden flute')
        .withComponent('items-core:item', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);

      await testFixture.executeAction('musician1', 'flute1');

      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvents.length).toBeGreaterThan(0);

      const perceptibleEvent = perceptibleEvents[0];
      expect(perceptibleEvent.payload.targetId).toBe('flute1');
    });
  });
});
