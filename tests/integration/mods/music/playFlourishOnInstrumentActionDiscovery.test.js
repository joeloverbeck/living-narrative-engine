/**
 * @file Integration tests for music:play_flourish_on_instrument action discovery.
 * @description Tests that the action is discoverable only when actor has compatible mood.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import playFlourishAction from '../../../../data/mods/music/actions/play_flourish_on_instrument.action.json' assert { type: 'json' };

describe('music:play_flourish_on_instrument - Action Discovery', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'music',
      'music:play_flourish_on_instrument'
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Action structure validation', () => {
    it('should have correct action structure', () => {
      expect(playFlourishAction).toBeDefined();
      expect(playFlourishAction.id).toBe('music:play_flourish_on_instrument');
      expect(playFlourishAction.name).toBe('Play Flourish on Instrument');
      expect(playFlourishAction.description).toContain('flourish');
      expect(playFlourishAction.description).toContain('ornamental');
      expect(playFlourishAction.template).toBe('play flourish on {instrument}');
    });

    it('should use instrument_actor_is_playing scope for primary target', () => {
      expect(playFlourishAction.targets).toBeDefined();
      expect(playFlourishAction.targets.primary).toBeDefined();
      expect(playFlourishAction.targets.primary.scope).toBe(
        'music:instrument_actor_is_playing'
      );
      expect(playFlourishAction.targets.primary.placeholder).toBe('instrument');
    });

    it('should require is_musician, playing_music, and performance_mood components on actor', () => {
      expect(playFlourishAction.required_components).toBeDefined();
      expect(playFlourishAction.required_components.actor).toBeDefined();
      expect(playFlourishAction.required_components.actor).toEqual([
        'music:is_musician',
        'music:playing_music',
        'music:performance_mood',
      ]);
    });

    it('should require items:item and music:is_instrument components on primary target', () => {
      expect(playFlourishAction.required_components.primary).toBeDefined();
      expect(playFlourishAction.required_components.primary).toEqual([
        'items:item',
        'music:is_instrument',
      ]);
    });

    it('should have prerequisites array with mood validation', () => {
      expect(playFlourishAction.prerequisites).toBeDefined();
      expect(Array.isArray(playFlourishAction.prerequisites)).toBe(true);
      expect(playFlourishAction.prerequisites.length).toBe(1);
      expect(playFlourishAction.prerequisites[0].logic).toBeDefined();
      expect(playFlourishAction.prerequisites[0].failure_message).toBeDefined();
    });

    it('should have correct visual styling matching music theme', () => {
      expect(playFlourishAction.visual).toBeDefined();
      expect(playFlourishAction.visual.backgroundColor).toBe('#1a2332');
      expect(playFlourishAction.visual.textColor).toBe('#d1d5db');
      expect(playFlourishAction.visual.hoverBackgroundColor).toBe('#2d3748');
      expect(playFlourishAction.visual.hoverTextColor).toBe('#f3f4f6');
    });
  });

  describe('Discovery with compatible moods', () => {
    const compatibleMoods = ['playful', 'triumphant', 'cheerful', 'tender'];

    compatibleMoods.forEach((mood) => {
      it(`should discover action when actor has ${mood} mood`, () => {
        const room = ModEntityScenarios.createRoom(
          'concert_hall',
          'Concert Hall'
        );

        const musician = new ModEntityBuilder('musician1')
          .withName('Felix')
          .atLocation('concert_hall')
          .asActor()
          .withComponent('music:is_musician', {})
          .withComponent('music:playing_music', {
            playing_on: 'flute1',
          })
          .withComponent('music:performance_mood', {
            mood: mood,
          })
          .build();

        const instrument = new ModEntityBuilder('flute1')
          .withName('silver flute')
          .withComponent('items:item', {})
          .withComponent('items:portable', {})
          .withComponent('music:is_instrument', {})
          .build();

        testFixture.reset([room, musician, instrument]);
        testFixture.testEnv.actionIndex.buildIndex([playFlourishAction]);

        const discoveredActions = testFixture.discoverActions('musician1');
        const flourishActions = discoveredActions.filter(
          (action) => action.id === 'music:play_flourish_on_instrument'
        );

        expect(flourishActions.length).toBe(1);
      });
    });
  });

  describe('Discovery with incompatible moods', () => {
    const incompatibleMoods = [
      'tense',
      'aggressive',
      'meditative',
      'solemn',
      'mournful',
      'eerie',
    ];

    incompatibleMoods.forEach((mood) => {
      it(`should NOT discover action when actor has ${mood} mood`, () => {
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
            playing_on: 'harp1',
          })
          .withComponent('music:performance_mood', {
            mood: mood,
          })
          .build();

        const instrument = new ModEntityBuilder('harp1')
          .withName('wooden harp')
          .withComponent('items:item', {})
          .withComponent('items:portable', {})
          .withComponent('music:is_instrument', {})
          .build();

        testFixture.reset([room, musician, instrument]);
        testFixture.testEnv.actionIndex.buildIndex([playFlourishAction]);

        const discoveredActions = testFixture.discoverActions('musician1');
        const flourishActions = discoveredActions.filter(
          (action) => action.id === 'music:play_flourish_on_instrument'
        );

        expect(flourishActions.length).toBe(0);
      });
    });
  });

  describe('Discovery when actor lacks required components', () => {
    it('should NOT discover action when actor lacks is_musician component', () => {
      const room = ModEntityScenarios.createRoom(
        'concert_hall',
        'Concert Hall'
      );

      const actor = new ModEntityBuilder('actor1')
        .withName('Novice')
        .atLocation('concert_hall')
        .asActor()
        .withComponent('music:playing_music', {
          playing_on: 'lute1',
        })
        .withComponent('music:performance_mood', {
          mood: 'playful',
        })
        .build();

      const instrument = new ModEntityBuilder('lute1')
        .withName('lute')
        .withComponent('items:item', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, actor, instrument]);
      testFixture.testEnv.actionIndex.buildIndex([playFlourishAction]);

      const discoveredActions = testFixture.discoverActions('actor1');
      const flourishActions = discoveredActions.filter(
        (action) => action.id === 'music:play_flourish_on_instrument'
      );

      expect(flourishActions.length).toBe(0);
    });

    it('should NOT discover action when actor lacks playing_music component', () => {
      const room = ModEntityScenarios.createRoom(
        'concert_hall',
        'Concert Hall'
      );

      const musician = new ModEntityBuilder('musician1')
        .withName('Idle Musician')
        .atLocation('concert_hall')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('music:performance_mood', {
          mood: 'cheerful',
        })
        .build();

      const instrument = new ModEntityBuilder('lute1')
        .withName('lute')
        .withComponent('items:item', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);
      testFixture.testEnv.actionIndex.buildIndex([playFlourishAction]);

      const discoveredActions = testFixture.discoverActions('musician1');
      const flourishActions = discoveredActions.filter(
        (action) => action.id === 'music:play_flourish_on_instrument'
      );

      expect(flourishActions.length).toBe(0);
    });

    it('should NOT discover action when actor lacks performance_mood component', () => {
      const room = ModEntityScenarios.createRoom(
        'concert_hall',
        'Concert Hall'
      );

      const musician = new ModEntityBuilder('musician1')
        .withName('Confused Musician')
        .atLocation('concert_hall')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('music:playing_music', {
          playing_on: 'lute1',
        })
        .build();

      const instrument = new ModEntityBuilder('lute1')
        .withName('lute')
        .withComponent('items:item', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);
      testFixture.testEnv.actionIndex.buildIndex([playFlourishAction]);

      const discoveredActions = testFixture.discoverActions('musician1');
      const flourishActions = discoveredActions.filter(
        (action) => action.id === 'music:play_flourish_on_instrument'
      );

      expect(flourishActions.length).toBe(0);
    });
  });

  describe('Scope resolution edge cases', () => {
    it('should not discover action when playing_music references non-existent instrument', () => {
      const room = ModEntityScenarios.createRoom(
        'concert_hall',
        'Concert Hall'
      );

      const musician = new ModEntityBuilder('musician1')
        .withName('Broken Reference')
        .atLocation('concert_hall')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('music:playing_music', {
          playing_on: 'nonexistent_instrument',
        })
        .withComponent('music:performance_mood', {
          mood: 'playful',
        })
        .build();

      testFixture.reset([room, musician]);
      testFixture.testEnv.actionIndex.buildIndex([playFlourishAction]);

      const discoveredActions = testFixture.discoverActions('musician1');
      const flourishActions = discoveredActions.filter(
        (action) => action.id === 'music:play_flourish_on_instrument'
      );

      expect(flourishActions.length).toBe(0);
    });
  });
});
