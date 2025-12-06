/**
 * @file Integration tests verifying that music actions are correctly forbidden when actor is in closeness.
 * @description Ensures that music actions are not available when the acting actor has the positioning:closeness component.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';

// Import action definitions
import playPhraseAction from '../../../../data/mods/music/actions/play_phrase_on_instrument.action.json';
import setMeditativeMoodAction from '../../../../data/mods/music/actions/set_meditative_mood_on_instrument.action.json';
import playOstinatoAction from '../../../../data/mods/music/actions/play_ostinato_on_instrument.action.json';
import stopPlayingAction from '../../../../data/mods/music/actions/stop_playing_instrument.action.json';
import driveAccentAction from '../../../../data/mods/music/actions/drive_accent_on_instrument.action.json';

/**
 * Test suite for verifying forbidden component behavior for music actions
 * when actor is in closeness.
 */
describe('music actions forbidden when actor is in closeness', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'music',
      'music:play_phrase_on_instrument'
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Action structure validation', () => {
    it('play_phrase_on_instrument should have positioning:closeness as forbidden component', () => {
      expect(playPhraseAction.forbidden_components).toBeDefined();
      expect(playPhraseAction.forbidden_components.actor).toContain(
        'positioning:closeness'
      );
    });

    it('set_meditative_mood_on_instrument should have positioning:closeness as forbidden component', () => {
      expect(setMeditativeMoodAction.forbidden_components).toBeDefined();
      expect(setMeditativeMoodAction.forbidden_components.actor).toContain(
        'positioning:closeness'
      );
    });

    it('play_ostinato_on_instrument should have positioning:closeness as forbidden component', () => {
      expect(playOstinatoAction.forbidden_components).toBeDefined();
      expect(playOstinatoAction.forbidden_components.actor).toContain(
        'positioning:closeness'
      );
    });

    it('stop_playing_instrument should have positioning:closeness as forbidden component', () => {
      expect(stopPlayingAction.forbidden_components).toBeDefined();
      expect(stopPlayingAction.forbidden_components.actor).toContain(
        'positioning:closeness'
      );
    });

    it('drive_accent_on_instrument should have positioning:closeness as forbidden component', () => {
      expect(driveAccentAction.forbidden_components).toBeDefined();
      expect(driveAccentAction.forbidden_components.actor).toContain(
        'positioning:closeness'
      );
    });
  });

  describe('Action discovery when NOT in closeness', () => {
    it('music actions should be available when actor is not in closeness', () => {
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
        .atLocation('concert_hall')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);
      testFixture.testEnv.actionIndex.buildIndex([playPhraseAction]);

      const discoveredActions = testFixture.discoverActions('musician1');
      const phraseActions = discoveredActions.filter(
        (action) => action.id === 'music:play_phrase_on_instrument'
      );

      expect(phraseActions.length).toBe(1);
    });
  });

  describe('Action discovery when in closeness', () => {
    it('play_phrase_on_instrument is NOT available when actor is in closeness', () => {
      const room = ModEntityScenarios.createRoom(
        'concert_hall',
        'Concert Hall'
      );

      const partner = new ModEntityBuilder('partner1')
        .withName('Emma')
        .atLocation('concert_hall')
        .asActor()
        .withComponent('positioning:closeness', {
          partners: ['musician1'],
        })
        .build();

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
        .withComponent('positioning:closeness', {
          partners: ['partner1'],
        })
        .build();

      const instrument = new ModEntityBuilder('lute1')
        .withName('silver lute')
        .atLocation('concert_hall')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, partner, instrument]);
      testFixture.testEnv.actionIndex.buildIndex([playPhraseAction]);

      const discoveredActions = testFixture.discoverActions('musician1');
      const phraseActions = discoveredActions.filter(
        (action) => action.id === 'music:play_phrase_on_instrument'
      );

      expect(phraseActions.length).toBe(0);
    });

    it('set_meditative_mood_on_instrument is NOT available when actor is in closeness', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Music Room');

      const partner = new ModEntityBuilder('partner1')
        .withName('James')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:closeness', {
          partners: ['musician1'],
        })
        .build();

      const musician = new ModEntityBuilder('musician1')
        .withName('Sara')
        .atLocation('room1')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('positioning:closeness', {
          partners: ['partner1'],
        })
        .build();

      const instrument = new ModEntityBuilder('flute1')
        .withName('wooden flute')
        .atLocation('room1')
        .withComponent('items:item', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, partner, instrument]);
      testFixture.testEnv.actionIndex.buildIndex([setMeditativeMoodAction]);

      const discoveredActions = testFixture.discoverActions('musician1');
      const moodActions = discoveredActions.filter(
        (action) => action.id === 'music:set_meditative_mood_on_instrument'
      );

      expect(moodActions.length).toBe(0);
    });

    it('play_ostinato_on_instrument is NOT available when actor is in closeness', () => {
      const room = ModEntityScenarios.createRoom('hall', 'Grand Hall');

      const partner = new ModEntityBuilder('partner1')
        .withName('Alex')
        .atLocation('hall')
        .asActor()
        .withComponent('positioning:closeness', {
          partners: ['musician1'],
        })
        .build();

      const musician = new ModEntityBuilder('musician1')
        .withName('Marcus')
        .atLocation('hall')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('music:playing_music', {
          playing_on: 'drum1',
        })
        .withComponent('music:performance_mood', {
          mood: 'tense',
        })
        .withComponent('positioning:closeness', {
          partners: ['partner1'],
        })
        .build();

      const instrument = new ModEntityBuilder('drum1')
        .withName('hand drum')
        .atLocation('hall')
        .withComponent('items:item', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, partner, instrument]);
      testFixture.testEnv.actionIndex.buildIndex([playOstinatoAction]);

      const discoveredActions = testFixture.discoverActions('musician1');
      const ostinatoActions = discoveredActions.filter(
        (action) => action.id === 'music:play_ostinato_on_instrument'
      );

      expect(ostinatoActions.length).toBe(0);
    });

    it('stop_playing_instrument is NOT available when actor is in closeness', () => {
      const room = ModEntityScenarios.createRoom('studio', 'Studio');

      const partner = new ModEntityBuilder('partner1')
        .withName('Taylor')
        .atLocation('studio')
        .asActor()
        .withComponent('positioning:closeness', {
          partners: ['musician1'],
        })
        .build();

      const musician = new ModEntityBuilder('musician1')
        .withName('Jordan')
        .atLocation('studio')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('music:playing_music', {
          playing_on: 'guitar1',
        })
        .withComponent('positioning:closeness', {
          partners: ['partner1'],
        })
        .build();

      const instrument = new ModEntityBuilder('guitar1')
        .withName('acoustic guitar')
        .atLocation('studio')
        .withComponent('items:item', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, partner, instrument]);
      testFixture.testEnv.actionIndex.buildIndex([stopPlayingAction]);

      const discoveredActions = testFixture.discoverActions('musician1');
      const stopActions = discoveredActions.filter(
        (action) => action.id === 'music:stop_playing_instrument'
      );

      expect(stopActions.length).toBe(0);
    });

    it('drive_accent_on_instrument is NOT available when actor is in closeness', () => {
      const room = ModEntityScenarios.createRoom('arena', 'Arena');

      const partner = new ModEntityBuilder('partner1')
        .withName('Casey')
        .atLocation('arena')
        .asActor()
        .withComponent('positioning:closeness', {
          partners: ['musician1'],
        })
        .build();

      const musician = new ModEntityBuilder('musician1')
        .withName('Riley')
        .atLocation('arena')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('music:playing_music', {
          playing_on: 'trumpet1',
        })
        .withComponent('music:performance_mood', {
          mood: 'aggressive',
        })
        .withComponent('positioning:closeness', {
          partners: ['partner1'],
        })
        .build();

      const instrument = new ModEntityBuilder('trumpet1')
        .withName('brass trumpet')
        .atLocation('arena')
        .withComponent('items:item', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, partner, instrument]);
      testFixture.testEnv.actionIndex.buildIndex([driveAccentAction]);

      const discoveredActions = testFixture.discoverActions('musician1');
      const accentActions = discoveredActions.filter(
        (action) => action.id === 'music:drive_accent_on_instrument'
      );

      expect(accentActions.length).toBe(0);
    });
  });
});
