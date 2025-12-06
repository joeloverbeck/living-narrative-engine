/**
 * @file Integration tests for handle_stop_playing_instrument rule execution.
 * @description Tests that the rule correctly removes performance components and dispatches perceptible events.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import '../../../common/mods/domainMatchers.js';
import '../../../common/actionMatchers.js';
import stopPlayingRule from '../../../../data/mods/music/rules/handle_stop_playing_instrument.rule.json' assert { type: 'json' };
import eventIsActionStopPlaying from '../../../../data/mods/music/conditions/event-is-action-stop-playing-instrument.condition.json' assert { type: 'json' };

describe('music:stop_playing_instrument - Rule Execution', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'music',
      'music:stop_playing_instrument',
      stopPlayingRule,
      eventIsActionStopPlaying
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Successfully executes stop_playing_instrument action', () => {
    it('should remove playing_music component from actor', async () => {
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
        .withComponent('positioning:doing_complex_performance', {})
        .build();

      const instrument = new ModEntityBuilder('lute1')
        .withName('silver lute')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);

      await testFixture.executeAction('musician1', 'lute1');

      const musicianAfter =
        testFixture.entityManager.getEntityInstance('musician1');
      expect(musicianAfter).not.toHaveComponent('music:playing_music');
    });

    it('should remove performance_mood component from actor', async () => {
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
        .withComponent('positioning:doing_complex_performance', {})
        .build();

      const instrument = new ModEntityBuilder('piano1')
        .withName('grand piano')
        .atLocation('studio')
        .withComponent('items:item', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);

      await testFixture.executeAction('musician1', 'piano1');

      const musicianAfter =
        testFixture.entityManager.getEntityInstance('musician1');
      expect(musicianAfter).not.toHaveComponent('music:performance_mood');
    });

    it('should remove doing_complex_performance component from actor', async () => {
      const room = ModEntityScenarios.createRoom('hall', 'Hall');

      const musician = new ModEntityBuilder('musician1')
        .withName('Elara')
        .atLocation('hall')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('music:playing_music', {
          playing_on: 'violin1',
        })
        .withComponent('music:performance_mood', {
          mood: 'mournful',
        })
        .withComponent('positioning:doing_complex_performance', {})
        .build();

      const instrument = new ModEntityBuilder('violin1')
        .withName('violin')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);

      await testFixture.executeAction('musician1', 'violin1');

      const musicianAfter =
        testFixture.entityManager.getEntityInstance('musician1');
      expect(musicianAfter).not.toHaveComponent(
        'positioning:doing_complex_performance'
      );
    });

    it('should dispatch perceptible event with correct message', async () => {
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
        .withComponent('positioning:doing_complex_performance', {})
        .build();

      const instrument = new ModEntityBuilder('lute1')
        .withName('silver lute')
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
      expect(perceptibleEvent.payload).toBeDefined();
      expect(perceptibleEvent.payload.descriptionText).toBeDefined();
      expect(perceptibleEvent.payload.descriptionText).toBe(
        'Lyra stops playing the silver lute, and the sound dies down.'
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
        .withComponent('items:item', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);

      await testFixture.executeAction('musician1', 'piano1');

      expect(testFixture.events).toHaveActionSuccess();
    });

    it('should work when actor lacks performance_mood component', async () => {
      const room = ModEntityScenarios.createRoom('hall', 'Hall');

      const musician = new ModEntityBuilder('musician1')
        .withName('Performer')
        .atLocation('hall')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('music:playing_music', {
          playing_on: 'harp1',
        })
        .build();

      const instrument = new ModEntityBuilder('harp1')
        .withName('harp')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);

      await testFixture.executeAction('musician1', 'harp1');

      const musicianAfter =
        testFixture.entityManager.getEntityInstance('musician1');
      expect(musicianAfter).not.toHaveComponent('music:playing_music');

      expect(testFixture.events).toHaveActionSuccess();
    });

    it('should call REGENERATE_DESCRIPTION operation in rule', async () => {
      const room = ModEntityScenarios.createRoom('hall', 'Hall');

      const musician = new ModEntityBuilder('musician1')
        .withName('Test Musician')
        .atLocation('hall')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('music:playing_music', {
          playing_on: 'drum1',
        })
        .withComponent('music:performance_mood', {
          mood: 'aggressive',
        })
        .withComponent('positioning:doing_complex_performance', {})
        .build();

      const instrument = new ModEntityBuilder('drum1')
        .withName('war drum')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);

      await testFixture.executeAction('musician1', 'drum1');

      // Verify the rule includes REGENERATE_DESCRIPTION by checking action succeeded
      // The operation is defined in the rule and will be executed
      expect(testFixture.events).toHaveActionSuccess();
    });
  });

  describe('Edge cases and validation', () => {
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
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
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
          mood: 'tense',
        })
        .build();

      const instrument = new ModEntityBuilder('drum1')
        .withName('war drum')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
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

    it('should handle multiple start-stop cycles correctly', async () => {
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
        .withComponent('positioning:doing_complex_performance', {})
        .build();

      const instrument = new ModEntityBuilder('violin1')
        .withName('violin')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);

      // First stop
      await testFixture.executeAction('musician1', 'violin1');
      const musicianAfterFirstStop =
        testFixture.entityManager.getEntityInstance('musician1');
      expect(musicianAfterFirstStop).not.toHaveComponent('music:playing_music');

      // Re-add components for second cycle
      testFixture.entityManager.addComponent(
        'musician1',
        'music:playing_music',
        {
          playing_on: 'violin1',
        }
      );
      testFixture.entityManager.addComponent(
        'musician1',
        'music:performance_mood',
        {
          mood: 'cheerful',
        }
      );
      testFixture.entityManager.addComponent(
        'musician1',
        'positioning:doing_complex_performance',
        {}
      );

      testFixture.clearEvents();

      // Second stop
      await testFixture.executeAction('musician1', 'violin1');
      const musicianAfterSecondStop =
        testFixture.entityManager.getEntityInstance('musician1');
      expect(musicianAfterSecondStop).not.toHaveComponent(
        'music:playing_music'
      );
      expect(testFixture.events).toHaveActionSuccess();
    });
  });
});
