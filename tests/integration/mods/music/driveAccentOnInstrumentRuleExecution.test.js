/**
 * @file Integration tests for handle_drive_accent_on_instrument rule execution.
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
import driveAccentRule from '../../../../data/mods/music/rules/handle_drive_accent_on_instrument.rule.json' assert { type: 'json' };
import eventIsActionDriveAccent from '../../../../data/mods/music/conditions/event-is-action-drive-accent-on-instrument.condition.json' assert { type: 'json' };

describe('music:drive_accent_on_instrument - Rule Execution', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'music',
      'music:drive_accent_on_instrument',
      driveAccentRule,
      eventIsActionDriveAccent
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Successfully executes drive_accent_on_instrument action', () => {
    it('should dispatch perceptible event with mood-adjective-flavored message', async () => {
      const room = ModEntityScenarios.createRoom(
        'concert_hall',
        'Concert Hall'
      );

      const musician = new ModEntityBuilder('musician1')
        .withName('Draven')
        .atLocation('concert_hall')
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
      expect(perceptibleEvent.payload).toBeDefined();
      expect(perceptibleEvent.payload.descriptionText).toBeDefined();

      // The message should contain the mood adjective from the lookup
      // For 'aggressive', the adj is 'hard-edged'
      expect(perceptibleEvent.payload.descriptionText).toContain('Draven');
      expect(perceptibleEvent.payload.descriptionText).toContain('hard-edged');
      expect(perceptibleEvent.payload.descriptionText).toContain('accent');
      expect(perceptibleEvent.payload.descriptionText).toContain(
        'electric guitar'
      );
      expect(perceptibleEvent.payload.descriptionText).toMatch(
        /drives a.*accent on/
      );
    });

    it('should dispatch action success event', async () => {
      const room = ModEntityScenarios.createRoom('hall', 'Hall');

      const musician = new ModEntityBuilder('musician1')
        .withName('Marcus')
        .atLocation('hall')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('music:playing_music', {
          playing_on: 'organ1',
        })
        .withComponent('music:performance_mood', {
          mood: 'triumphant',
        })
        .build();

      const instrument = new ModEntityBuilder('organ1')
        .withName('grand organ')
        .atLocation('hall')
        .withComponent('items-core:item', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);

      await testFixture.executeAction('musician1', 'organ1');

      expect(testFixture.events).toHaveActionSuccess();
    });

    it('should work with all 4 compatible moods from mood_lexicon', async () => {
      const moods = [
        { mood: 'aggressive', expectedAdj: 'hard-edged' },
        { mood: 'triumphant', expectedAdj: 'bold' },
        { mood: 'tense', expectedAdj: 'tight' },
        { mood: 'solemn', expectedAdj: 'grave' },
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
        expect(perceptibleEvent.payload.descriptionText).toContain(expectedAdj);
        expect(perceptibleEvent.payload.descriptionText).toContain('accent');

        // Clear events for next iteration
        testFixture.clearEvents();
      }
    });

    it('should use fallback adjective when mood not found in lexicon', async () => {
      const room = ModEntityScenarios.createRoom('hall', 'Hall');

      const musician = new ModEntityBuilder('musician1')
        .withName('Test Musician')
        .atLocation('hall')
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
        .withName('instrument')
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
      // Should use the fallback value from missing_value parameter
      expect(perceptibleEvent.payload.descriptionText).toContain('sharp');
    });
  });

  describe('Edge cases and validation', () => {
    it('should handle multiple sequential accent performances correctly', async () => {
      const room = ModEntityScenarios.createRoom('hall', 'Hall');

      const musician = new ModEntityBuilder('musician1')
        .withName('Virtuoso')
        .atLocation('hall')
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
        .withName('drums')
        .withComponent('items-core:item', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);

      // First accent
      await testFixture.executeAction('musician1', 'drums1');
      expect(testFixture.events).toHaveActionSuccess();

      // Clear events
      testFixture.clearEvents();

      // Second accent
      await testFixture.executeAction('musician1', 'drums1');
      expect(testFixture.events).toHaveActionSuccess();

      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvents.length).toBeGreaterThan(0);
      expect(perceptibleEvents[0].payload.descriptionText).toContain('tight');
    });

    it('should include locationId in perceptible event', async () => {
      const room = ModEntityScenarios.createRoom('grand_hall', 'Grand Hall');

      const musician = new ModEntityBuilder('musician1')
        .withName('Location Test Musician')
        .atLocation('grand_hall')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('music:playing_music', {
          playing_on: 'cello1',
        })
        .withComponent('music:performance_mood', {
          mood: 'solemn',
        })
        .build();

      const instrument = new ModEntityBuilder('cello1')
        .withName('cello')
        .withComponent('items-core:item', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);

      await testFixture.executeAction('musician1', 'cello1');

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
          playing_on: 'trumpet1',
        })
        .withComponent('music:performance_mood', {
          mood: 'triumphant',
        })
        .build();

      const instrument = new ModEntityBuilder('trumpet1')
        .withName('trumpet')
        .withComponent('items-core:item', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);

      await testFixture.executeAction('musician1', 'trumpet1');

      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvents.length).toBeGreaterThan(0);

      const perceptibleEvent = perceptibleEvents[0];
      expect(perceptibleEvent.payload.targetId).toBe('trumpet1');
    });
  });
});
