/**
 * @file Integration tests for music:play_phrase_on_instrument action discovery.
 * @description Tests that the action is discoverable only when actor is actively playing an instrument with a mood.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import playPhraseAction from '../../../../data/mods/music/actions/play_phrase_on_instrument.action.json' assert { type: 'json' };

describe('music:play_phrase_on_instrument - Action Discovery', () => {
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
    it('should have correct action structure', () => {
      expect(playPhraseAction).toBeDefined();
      expect(playPhraseAction.id).toBe('music:play_phrase_on_instrument');
      expect(playPhraseAction.name).toBe('Play Phrase on Instrument');
      expect(playPhraseAction.description).toContain(
        'expressive musical phrase'
      );
      expect(playPhraseAction.template).toBe('play phrase on {instrument}');
    });

    it('should use instrument_actor_is_playing scope for primary target', () => {
      expect(playPhraseAction.targets).toBeDefined();
      expect(playPhraseAction.targets.primary).toBeDefined();
      expect(playPhraseAction.targets.primary.scope).toBe(
        'music:instrument_actor_is_playing'
      );
      expect(playPhraseAction.targets.primary.placeholder).toBe('instrument');
    });

    it('should require is_musician, playing_music, and performance_mood components on actor', () => {
      expect(playPhraseAction.required_components).toBeDefined();
      expect(playPhraseAction.required_components.actor).toBeDefined();
      expect(playPhraseAction.required_components.actor).toEqual([
        'music:is_musician',
        'music:playing_music',
        'music:performance_mood',
      ]);
    });

    it('should require items:item and music:is_instrument components on primary target', () => {
      expect(playPhraseAction.required_components.primary).toBeDefined();
      expect(playPhraseAction.required_components.primary).toEqual([
        'items:item',
        'music:is_instrument',
      ]);
    });

    it('should have empty prerequisites array', () => {
      expect(playPhraseAction.prerequisites).toBeDefined();
      expect(Array.isArray(playPhraseAction.prerequisites)).toBe(true);
      expect(playPhraseAction.prerequisites).toEqual([]);
    });

    it('should have correct visual styling matching music theme', () => {
      expect(playPhraseAction.visual).toBeDefined();
      expect(playPhraseAction.visual.backgroundColor).toBe('#1a2332');
      expect(playPhraseAction.visual.textColor).toBe('#d1d5db');
      expect(playPhraseAction.visual.hoverBackgroundColor).toBe('#2d3748');
      expect(playPhraseAction.visual.hoverTextColor).toBe('#f3f4f6');
    });
  });

  describe('Discovery scenarios', () => {
    describe('When musician is actively playing with a mood', () => {
      it('should discover play_phrase_on_instrument action', () => {
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

      it('should resolve scope to the instrument being played', () => {
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

        const piano = new ModEntityBuilder('piano1')
          .withName('grand piano')
          .atLocation('studio')
          .withComponent('items:item', {})
          .withComponent('music:is_instrument', {})
          .build();

        const otherInstrument = new ModEntityBuilder('violin1')
          .withName('violin')
          .atLocation('studio')
          .withComponent('items:item', {})
          .withComponent('music:is_instrument', {})
          .build();

        testFixture.reset([room, musician, piano, otherInstrument]);

        const musicianInstance =
          testFixture.entityManager.getEntityInstance('musician1');
        const scopeContext = {
          actor: {
            id: 'musician1',
            components: musicianInstance.components,
          },
        };

        const scopeResult =
          testFixture.testEnv.unifiedScopeResolver.resolveSync(
            'music:instrument_actor_is_playing',
            scopeContext
          );

        expect(scopeResult.success).toBe(true);
        expect(Array.from(scopeResult.value)).toEqual(['piano1']);
        // Should NOT include violin1
        expect(Array.from(scopeResult.value)).not.toContain('violin1');
      });
    });

    describe('When actor lacks required components', () => {
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
            mood: 'cheerful',
          })
          .build();

        const instrument = new ModEntityBuilder('lute1')
          .withName('lute')
          .withComponent('items:item', {})
          .withComponent('items:portable', {})
          .withComponent('music:is_instrument', {})
          .build();

        testFixture.reset([room, nonMusician, instrument]);
        testFixture.testEnv.actionIndex.buildIndex([playPhraseAction]);

        const discoveredActions = testFixture.discoverActions('actor1');
        const phraseActions = discoveredActions.filter(
          (action) => action.id === 'music:play_phrase_on_instrument'
        );

        expect(phraseActions.length).toBe(0);
      });

      it('should NOT discover action when actor lacks playing_music component', () => {
        const room = ModEntityScenarios.createRoom('room1', 'Room');

        const musician = new ModEntityBuilder('musician1')
          .withName('Not Playing Musician')
          .atLocation('room1')
          .asActor()
          .withComponent('music:is_musician', {})
          .withComponent('music:performance_mood', {
            mood: 'cheerful',
          })
          .build();

        const instrument = new ModEntityBuilder('lute1')
          .withName('lute')
          .atLocation('room1')
          .withComponent('items:item', {})
          .withComponent('music:is_instrument', {})
          .build();

        testFixture.reset([room, musician, instrument]);
        testFixture.testEnv.actionIndex.buildIndex([playPhraseAction]);

        const discoveredActions = testFixture.discoverActions('musician1');
        const phraseActions = discoveredActions.filter(
          (action) => action.id === 'music:play_phrase_on_instrument'
        );

        expect(phraseActions.length).toBe(0);
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
        testFixture.testEnv.actionIndex.buildIndex([playPhraseAction]);

        const discoveredActions = testFixture.discoverActions('musician1');
        const phraseActions = discoveredActions.filter(
          (action) => action.id === 'music:play_phrase_on_instrument'
        );

        expect(phraseActions.length).toBe(0);
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
            mood: 'cheerful',
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

        const scopeResult =
          testFixture.testEnv.unifiedScopeResolver.resolveSync(
            'music:instrument_actor_is_playing',
            scopeContext
          );

        expect(scopeResult.success).toBe(true);
        expect(Array.from(scopeResult.value)).toHaveLength(0);
      });

      it('should return empty scope when actor has no playing_music component', () => {
        const room = ModEntityScenarios.createRoom('room1', 'Room');

        const musician = new ModEntityBuilder('musician1')
          .withName('Not Playing')
          .atLocation('room1')
          .asActor()
          .withComponent('music:is_musician', {})
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

        const scopeResult =
          testFixture.testEnv.unifiedScopeResolver.resolveSync(
            'music:instrument_actor_is_playing',
            scopeContext
          );

        expect(scopeResult.success).toBe(true);
        expect(Array.from(scopeResult.value)).toHaveLength(0);
      });
    });
  });
});
