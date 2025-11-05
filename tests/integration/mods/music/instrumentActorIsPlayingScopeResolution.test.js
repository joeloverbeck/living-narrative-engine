/**
 * @file Integration tests for music:instrument_actor_is_playing scope resolution.
 * @description Tests the scope that resolves to the instrument referenced in actor's playing_music component.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';

describe('music:instrument_actor_is_playing - Scope Resolution', () => {
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

  describe('Successful resolution', () => {
    it('should resolve to the instrument being played by actor', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Room');

      const musician = new ModEntityBuilder('musician1')
        .withName('Musician')
        .atLocation('room1')
        .asActor()
        .withComponent('music:playing_music', {
          playing_on: 'target_lute',
        })
        .build();

      const targetInstrument = new ModEntityBuilder('target_lute')
        .withName('target lute')
        .withComponent('items:item', {})
        .withComponent('music:is_instrument', {})
        .build();

      const otherInstrument = new ModEntityBuilder('other_lute')
        .withName('other lute')
        .atLocation('room1')
        .withComponent('items:item', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, targetInstrument, otherInstrument]);

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
      const resolvedIds = Array.from(scopeResult.value);
      expect(resolvedIds).toHaveLength(1);
      expect(resolvedIds).toContain('target_lute');
      expect(resolvedIds).not.toContain('other_lute');
    });

    it('should resolve correctly when instrument is at different location', () => {
      const roomA = ModEntityScenarios.createRoom('room_a', 'Room A');
      const roomB = ModEntityScenarios.createRoom('room_b', 'Room B');

      const musician = new ModEntityBuilder('musician1')
        .withName('Musician')
        .atLocation('room_a')
        .asActor()
        .withComponent('music:playing_music', {
          playing_on: 'distant_lute',
        })
        .build();

      const instrument = new ModEntityBuilder('distant_lute')
        .withName('distant lute')
        .atLocation('room_b')
        .withComponent('items:item', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([roomA, roomB, musician, instrument]);

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
      const resolvedIds = Array.from(scopeResult.value);
      expect(resolvedIds).toContain('distant_lute');
    });
  });

  describe('Failed resolution', () => {
    it('should return empty set when actor lacks playing_music component', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Room');

      const musician = new ModEntityBuilder('musician1')
        .withName('Not Playing')
        .atLocation('room1')
        .asActor()
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

    it('should return empty set when playing_on references non-existent entity', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Room');

      const musician = new ModEntityBuilder('musician1')
        .withName('Musician')
        .atLocation('room1')
        .asActor()
        .withComponent('music:playing_music', {
          playing_on: 'nonexistent_instrument_id',
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

    it('should return empty set when playing_on field is missing', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Room');

      const musician = new ModEntityBuilder('musician1')
        .withName('Musician')
        .atLocation('room1')
        .asActor()
        .withComponent('music:playing_music', {
          // Missing playing_on field
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
  });

  describe('Component data integrity', () => {
    it('should follow the exact ID stored in playing_on field', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Room');

      const musician = new ModEntityBuilder('musician1')
        .withName('Precise Musician')
        .atLocation('room1')
        .asActor()
        .withComponent('music:playing_music', {
          playing_on: 'specific_id_12345',
        })
        .build();

      const instrument = new ModEntityBuilder('specific_id_12345')
        .withName('specifically identified instrument')
        .withComponent('items:item', {})
        .withComponent('music:is_instrument', {})
        .build();

      testFixture.reset([room, musician, instrument]);

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
      expect(Array.from(scopeResult.value)).toEqual(['specific_id_12345']);
    });
  });
});
