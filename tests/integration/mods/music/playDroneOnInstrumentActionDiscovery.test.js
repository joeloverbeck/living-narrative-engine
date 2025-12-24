/**
 * @file Integration tests for music:play_drone_on_instrument action discovery.
 * @description Tests that the action is discoverable only when actor has compatible mood.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import playDroneAction from '../../../../data/mods/music/actions/play_drone_on_instrument.action.json' assert { type: 'json' };

describe('music:play_drone_on_instrument - Action Discovery', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'music',
      'music:play_drone_on_instrument'
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Action structure validation', () => {
    it('should have correct action structure', () => {
      expect(playDroneAction).toBeDefined();
      expect(playDroneAction.id).toBe('music:play_drone_on_instrument');
      expect(playDroneAction.name).toBe('Play Drone on Instrument');
      expect(playDroneAction.description).toContain(
        'sustained, continuous tone'
      );
      expect(playDroneAction.template).toBe('play drone on {instrument}');
    });

    it('should use instrument_actor_is_playing scope for primary target', () => {
      expect(playDroneAction.targets).toBeDefined();
      expect(playDroneAction.targets.primary).toBeDefined();
      expect(playDroneAction.targets.primary.scope).toBe(
        'music:instrument_actor_is_playing'
      );
      expect(playDroneAction.targets.primary.placeholder).toBe('instrument');
    });

    it('should require is_musician, playing_music, and performance_mood components on actor', () => {
      expect(playDroneAction.required_components).toBeDefined();
      expect(playDroneAction.required_components.actor).toBeDefined();
      expect(playDroneAction.required_components.actor).toEqual([
        'music:is_musician',
        'music:playing_music',
        'music:performance_mood',
      ]);
    });

    it('should require items-core:item and music:is_instrument components on primary target', () => {
      expect(playDroneAction.required_components.primary).toBeDefined();
      expect(playDroneAction.required_components.primary).toEqual([
        'items-core:item',
        'music:is_instrument',
      ]);
    });

    it('should have prerequisites array with mood validation', () => {
      expect(playDroneAction.prerequisites).toBeDefined();
      expect(Array.isArray(playDroneAction.prerequisites)).toBe(true);
      expect(playDroneAction.prerequisites.length).toBe(1);
      expect(playDroneAction.prerequisites[0].logic).toBeDefined();
      expect(playDroneAction.prerequisites[0].failure_message).toBeDefined();
    });

    it('should have correct visual styling matching music theme', () => {
      expect(playDroneAction.visual).toBeDefined();
      expect(playDroneAction.visual.backgroundColor).toBe('#1a2332');
      expect(playDroneAction.visual.textColor).toBe('#d1d5db');
      expect(playDroneAction.visual.hoverBackgroundColor).toBe('#2d3748');
      expect(playDroneAction.visual.hoverTextColor).toBe('#f3f4f6');
    });
  });

  describe('Discovery with compatible moods', () => {
    const compatibleMoods = ['eerie', 'solemn', 'meditative', 'mournful'];

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
          .withComponent('items-core:item', {})
          .withComponent('items-core:portable', {})
          .withComponent('music:is_instrument', {})
          .build();

        testFixture.reset([room, musician, instrument]);
        testFixture.testEnv.actionIndex.buildIndex([playDroneAction]);

        const discoveredActions = testFixture.discoverActions('musician1');
        const droneActions = discoveredActions.filter(
          (action) => action.id === 'music:play_drone_on_instrument'
        );

        expect(droneActions.length).toBe(1);
      });
    });
  });

  describe('Discovery with incompatible moods', () => {
    const incompatibleMoods = [
      'cheerful',
      'aggressive',
      'playful',
      'tense',
      'triumphant',
      'tender',
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
          .withComponent('items-core:item', {})
          .withComponent('items-core:portable', {})
          .withComponent('music:is_instrument', {})
          .build();

        testFixture.reset([room, musician, instrument]);
        testFixture.testEnv.actionIndex.buildIndex([playDroneAction]);

        const discoveredActions = testFixture.discoverActions('musician1');
        const droneActions = discoveredActions.filter(
          (action) => action.id === 'music:play_drone_on_instrument'
        );

        expect(droneActions.length).toBe(0);
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
          mood: 'eerie',
        })
        .build();

      const instrument = new ModEntityBuilder('lute1')
        .withName('lute')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, nonMusician, instrument]);
      testFixture.testEnv.actionIndex.buildIndex([playDroneAction]);

      const discoveredActions = testFixture.discoverActions('actor1');
      const droneActions = discoveredActions.filter(
        (action) => action.id === 'music:play_drone_on_instrument'
      );

      expect(droneActions.length).toBe(0);
    });

    it('should NOT discover action when actor lacks playing_music component', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Room');

      const musician = new ModEntityBuilder('musician1')
        .withName('Not Playing Musician')
        .atLocation('room1')
        .asActor()
        .withComponent('music:is_musician', {})
        .withComponent('music:performance_mood', {
          mood: 'eerie',
        })
        .build();

      const instrument = new ModEntityBuilder('lute1')
        .withName('lute')
        .atLocation('room1')
        .withComponent('items-core:item', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);
      testFixture.testEnv.actionIndex.buildIndex([playDroneAction]);

      const discoveredActions = testFixture.discoverActions('musician1');
      const droneActions = discoveredActions.filter(
        (action) => action.id === 'music:play_drone_on_instrument'
      );

      expect(droneActions.length).toBe(0);
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
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);
      testFixture.testEnv.actionIndex.buildIndex([playDroneAction]);

      const discoveredActions = testFixture.discoverActions('musician1');
      const droneActions = discoveredActions.filter(
        (action) => action.id === 'music:play_drone_on_instrument'
      );

      expect(droneActions.length).toBe(0);
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
          mood: 'eerie',
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
