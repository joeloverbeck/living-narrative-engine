/**
 * @file Integration tests for music:swell_music_on_instrument action discovery.
 * @description Tests that the action is discoverable only when actor has compatible mood.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import swellMusicAction from '../../../../data/mods/music/actions/swell_music_on_instrument.action.json' assert { type: 'json' };

describe('music:swell_music_on_instrument - Action Discovery', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'music',
      'music:swell_music_on_instrument'
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Action structure validation', () => {
    it('should have correct action structure', () => {
      expect(swellMusicAction).toBeDefined();
      expect(swellMusicAction.id).toBe('music:swell_music_on_instrument');
      expect(swellMusicAction.name).toBe('Swell Music on Instrument');
      expect(swellMusicAction.description).toContain('dramatic');
      expect(swellMusicAction.template).toBe('drive an accent on {instrument}');
    });

    it('should use instrument_actor_is_playing scope for primary target', () => {
      expect(swellMusicAction.targets).toBeDefined();
      expect(swellMusicAction.targets.primary).toBeDefined();
      expect(swellMusicAction.targets.primary.scope).toBe(
        'music:instrument_actor_is_playing'
      );
      expect(swellMusicAction.targets.primary.placeholder).toBe('instrument');
    });

    it('should require is_musician, playing_music, and performance_mood components on actor', () => {
      expect(swellMusicAction.required_components).toBeDefined();
      expect(swellMusicAction.required_components.actor).toBeDefined();
      expect(swellMusicAction.required_components.actor).toEqual([
        'music:is_musician',
        'music:playing_music',
        'music:performance_mood',
      ]);
    });

    it('should require items:item and music:is_instrument components on primary target', () => {
      expect(swellMusicAction.required_components.primary).toBeDefined();
      expect(swellMusicAction.required_components.primary).toEqual([
        'items:item',
        'music:is_instrument',
      ]);
    });

    it('should have prerequisites array with mood validation', () => {
      expect(swellMusicAction.prerequisites).toBeDefined();
      expect(Array.isArray(swellMusicAction.prerequisites)).toBe(true);
      expect(swellMusicAction.prerequisites.length).toBe(1);
      expect(swellMusicAction.prerequisites[0].logic).toBeDefined();
      expect(swellMusicAction.prerequisites[0].failure_message).toBeDefined();
    });

    it('should have correct visual styling matching music theme', () => {
      expect(swellMusicAction.visual).toBeDefined();
      expect(swellMusicAction.visual.backgroundColor).toBe('#1a2332');
      expect(swellMusicAction.visual.textColor).toBe('#d1d5db');
      expect(swellMusicAction.visual.hoverBackgroundColor).toBe('#2d3748');
      expect(swellMusicAction.visual.hoverTextColor).toBe('#f3f4f6');
    });
  });

  describe('Discovery with compatible moods', () => {
    const compatibleMoods = [
      'triumphant',
      'tense',
      'mournful',
      'tender',
      'meditative',
    ];

    compatibleMoods.forEach((mood) => {
      it(`should discover action when actor has ${mood} mood`, () => {
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
            mood: mood,
          })
          .build();

        const instrument = new ModEntityBuilder('lute1')
          .withName('silver lute')
          .withComponent('items:item', {})
          .withComponent('items:portable', {})
          .withComponent('music:is_instrument', {})
          .build();

        testFixture.reset([room, musician, instrument]);
        testFixture.testEnv.actionIndex.buildIndex([swellMusicAction]);

        const discoveredActions = testFixture.discoverActions('musician1');
        const swellActions = discoveredActions.filter(
          (action) => action.id === 'music:swell_music_on_instrument'
        );

        expect(swellActions.length).toBe(1);
      });
    });
  });

  describe('Discovery with incompatible moods', () => {
    const incompatibleMoods = [
      'cheerful',
      'aggressive',
      'playful',
      'solemn',
      'eerie',
    ];

    incompatibleMoods.forEach((mood) => {
      it(`should NOT discover action when actor has ${mood} mood`, () => {
        const room = ModEntityScenarios.createRoom(
          'concert_hall',
          'Concert Hall'
        );

        const musician = new ModEntityBuilder('musician1')
          .withName('Elara')
          .atLocation('concert_hall')
          .asActor()
          .withComponent('music:is_musician', {})
          .withComponent('music:playing_music', {
            playing_on: 'violin1',
          })
          .withComponent('music:performance_mood', {
            mood: mood,
          })
          .build();

        const instrument = new ModEntityBuilder('violin1')
          .withName('violin')
          .withComponent('items:item', {})
          .withComponent('items:portable', {})
          .withComponent('music:is_instrument', {})
          .build();

        testFixture.reset([room, musician, instrument]);
        testFixture.testEnv.actionIndex.buildIndex([swellMusicAction]);

        const discoveredActions = testFixture.discoverActions('musician1');
        const swellActions = discoveredActions.filter(
          (action) => action.id === 'music:swell_music_on_instrument'
        );

        expect(swellActions.length).toBe(0);
      });
    });
  });

  describe('Discovery when actor lacks required components', () => {
    it('should NOT discover action when actor lacks is_musician component', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Room');

      const nonMusician = new ModEntityBuilder('actor1')
        .withName('Non-Musician')
        .atLocation('room1')
        .asActor()
        .withComponent('music:playing_music', {
          playing_on: 'lute1',
        })
        .withComponent('music:performance_mood', {
          mood: 'triumphant',
        })
        .build();

      const instrument = new ModEntityBuilder('lute1')
        .withName('lute')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, nonMusician, instrument]);
      testFixture.testEnv.actionIndex.buildIndex([swellMusicAction]);

      const discoveredActions = testFixture.discoverActions('actor1');
      const swellActions = discoveredActions.filter(
        (action) => action.id === 'music:swell_music_on_instrument'
      );

      expect(swellActions.length).toBe(0);
    });

    it('should NOT discover action when actor lacks playing_music component', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Room');

      const musician = new ModEntityBuilder('musician1')
        .withName('Not Playing Musician')
        .atLocation('room1')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('music:performance_mood', {
          mood: 'triumphant',
        })
        .build();

      const instrument = new ModEntityBuilder('lute1')
        .withName('lute')
        .atLocation('room1')
        .withComponent('items:item', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);
      testFixture.testEnv.actionIndex.buildIndex([swellMusicAction]);

      const discoveredActions = testFixture.discoverActions('musician1');
      const swellActions = discoveredActions.filter(
        (action) => action.id === 'music:swell_music_on_instrument'
      );

      expect(swellActions.length).toBe(0);
    });

    it('should NOT discover action when actor lacks performance_mood component', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Room');

      const musician = new ModEntityBuilder('musician1')
        .withName('Moodless Musician')
        .atLocation('room1')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('music:playing_music', {
          playing_on: 'lute1',
        })
        .build();

      const instrument = new ModEntityBuilder('lute1')
        .withName('lute')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);
      testFixture.testEnv.actionIndex.buildIndex([swellMusicAction]);

      const discoveredActions = testFixture.discoverActions('musician1');
      const swellActions = discoveredActions.filter(
        (action) => action.id === 'music:swell_music_on_instrument'
      );

      expect(swellActions.length).toBe(0);
    });
  });

  describe('Scope resolution edge cases', () => {
    it('should return empty scope when playing_music references non-existent instrument', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Room');

      const musician = new ModEntityBuilder('musician1')
        .withName('Broken Reference Musician')
        .atLocation('room1')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('music:playing_music', {
          playing_on: 'nonexistent_instrument',
        })
        .withComponent('music:performance_mood', {
          mood: 'triumphant',
        })
        .build();

      testFixture.reset([room, musician]);

      const musicianInstance =
        testFixture.entityManager.getEntityInstance('musician1');
      const scopeContext = {
        actor: {
          id: 'musician1',
          components: musicianInstance.components,
        },
      };

      const scopeResult = testFixture.testEnv.unifiedScopeResolver.resolveSync(
        'music:instrument_actor_is_playing',
        scopeContext
      );

      expect(scopeResult.success).toBe(true);
      expect(Array.from(scopeResult.value)).toHaveLength(0);
    });
  });
});
