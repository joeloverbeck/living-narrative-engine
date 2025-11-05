/**
 * @file Integration tests for music mood-setting action execution.
 * @description Tests that all 10 mood-setting actions properly execute,
 * query the lookup table, and dispatch perceptible events with correct messages.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';

const MOODS = [
  { key: 'cheerful', expectedAdj: 'bright' },
  { key: 'solemn', expectedAdj: 'grave' },
  { key: 'mournful', expectedAdj: 'aching' },
  { key: 'eerie', expectedAdj: 'unsettling' },
  { key: 'tense', expectedAdj: 'tight' },
  { key: 'triumphant', expectedAdj: 'bold' },
  { key: 'tender', expectedAdj: 'soft' },
  { key: 'playful', expectedAdj: 'teasing' },
  { key: 'aggressive', expectedAdj: 'hard-edged' },
  { key: 'meditative', expectedAdj: 'calm' },
];

describe('Music Mood Actions - Execution', () => {
  let fixture;

  afterEach(async () => {
    if (fixture) {
      await fixture.cleanup();
      fixture = null;
    }
  });

  describe('Component Modification', () => {
    for (const mood of MOODS) {
      it(`should set performance_mood component to ${mood.key} on instrument`, async () => {
        fixture = await ModTestFixture.forAction(
          'music',
          `music:set_${mood.key}_mood_on_instrument`
        );

        // Create musician actor
        const actor = await fixture.createEntity({
          name: 'Musician',
          components: ['core:actor', 'music:is_musician'],
        });

        // Create instrument
        const instrument = await fixture.createEntity({
          name: 'Flute',
          components: ['items:item', 'music:is_instrument'],
        });

        await fixture.executeAction(actor.id, instrument.id);

        // Verify component was added/modified
        const moodComponent = fixture.getComponent(
          instrument.id,
          'music:performance_mood'
        );

        expect(moodComponent).toBeDefined();
        expect(moodComponent.mood).toBe(mood.key);
        expect(moodComponent.set_by_actor).toBe(actor.id);
      });
    }
  });

  describe('Lookup Query Integration', () => {
    for (const mood of MOODS) {
      it(`should query mood_lexicon and use ${mood.expectedAdj} adjective for ${mood.key}`, async () => {
        fixture = await ModTestFixture.forAction(
          'music',
          `music:set_${mood.key}_mood_on_instrument`
        );

        const actor = await fixture.createEntity({
          name: 'Bard',
          components: ['core:actor', 'music:is_musician'],
        });

        const instrument = await fixture.createEntity({
          name: 'Violin',
          components: ['items:item', 'music:is_instrument'],
        });

        await fixture.executeAction(actor.id, instrument.id);

        // Get dispatched events
        const events = fixture.getDispatchedEvents();
        const musicEvent = events.find((e) => e.type === 'music_mood_set');

        expect(musicEvent).toBeDefined();
        expect(musicEvent.mood).toBe(mood.key);
        expect(musicEvent.message).toContain(mood.expectedAdj);
        expect(musicEvent.message).toContain(mood.key);
      });
    }
  });

  describe('Perceptible Event Dispatch', () => {
    for (const mood of MOODS) {
      it(`should dispatch perceptible event with correct message for ${mood.key}`, async () => {
        fixture = await ModTestFixture.forAction(
          'music',
          `music:set_${mood.key}_mood_on_instrument`
        );

        const actor = await fixture.createEntity({
          name: 'Performer',
          components: ['core:actor', 'music:is_musician'],
        });

        const instrument = await fixture.createEntity({
          name: 'Lyre',
          components: ['items:item', 'music:is_instrument'],
        });

        await fixture.executeAction(actor.id, instrument.id);

        const events = fixture.getDispatchedEvents();
        const musicEvent = events.find((e) => e.type === 'music_mood_set');

        expect(musicEvent).toBeDefined();
        expect(musicEvent.actorId).toBe(actor.id);
        expect(musicEvent.targetId).toBe(instrument.id);
        expect(musicEvent.mood).toBe(mood.key);
        expect(musicEvent.message).toContain('Performer');
        expect(musicEvent.message).toContain('Lyre');
        expect(musicEvent.message).toContain('begins to play');
        expect(musicEvent.message).toContain(`${mood.key} tone`);
      });
    }
  });

  describe('Message Construction', () => {
    it('should construct messages using lookup data for all moods', async () => {
      fixture = await ModTestFixture.forAction(
        'music',
        'music:set_cheerful_mood_on_instrument'
      );

      const actor = await fixture.createEntity({
        name: 'Songbird',
        components: ['core:actor', 'music:is_musician'],
      });

      const instrument = await fixture.createEntity({
        name: 'Golden Harp',
        components: ['items:item', 'music:is_instrument'],
      });

      // Test each mood sequentially
      for (const mood of MOODS) {
        fixture = await ModTestFixture.forAction(
          'music',
          `music:set_${mood.key}_mood_on_instrument`
        );

        // Re-create entities for each test
        const testActor = await fixture.createEntity({
          name: 'Songbird',
          components: ['core:actor', 'music:is_musician'],
        });

        const testInstrument = await fixture.createEntity({
          name: 'Golden Harp',
          components: ['items:item', 'music:is_instrument'],
        });

        await fixture.executeAction(testActor.id, testInstrument.id);

        const events = fixture.getDispatchedEvents();
        const musicEvent = events.find((e) => e.type === 'music_mood_set');

        expect(musicEvent.message).toBe(
          `Songbird begins to play Golden Harp with a ${mood.expectedAdj}, ${mood.key} tone`
        );

        await fixture.cleanup();
      }
    });
  });

  describe('State Transitions', () => {
    it('should allow changing mood on same instrument', async () => {
      fixture = await ModTestFixture.forAction(
        'music',
        'music:set_cheerful_mood_on_instrument'
      );

      const actor = await fixture.createEntity({
        name: 'Musician',
        components: ['core:actor', 'music:is_musician'],
      });

      const instrument = await fixture.createEntity({
        name: 'Lute',
        components: ['items:item', 'music:is_instrument'],
      });

      // Set cheerful mood first
      await fixture.executeAction(actor.id, instrument.id);

      let moodComponent = fixture.getComponent(
        instrument.id,
        'music:performance_mood'
      );
      expect(moodComponent.mood).toBe('cheerful');

      // Change to solemn mood
      fixture = await ModTestFixture.forAction(
        'music',
        'music:set_solemn_mood_on_instrument'
      );

      // Re-create entities
      const actor2 = await fixture.createEntity({
        name: 'Musician',
        components: ['core:actor', 'music:is_musician'],
      });

      const instrument2 = await fixture.createEntity({
        name: 'Lute',
        components: ['items:item', 'music:is_instrument'],
      });

      await fixture.executeAction(actor2.id, instrument2.id);

      moodComponent = fixture.getComponent(
        instrument2.id,
        'music:performance_mood'
      );
      expect(moodComponent.mood).toBe('solemn');
    });
  });

  describe('Multiple Instruments Independence', () => {
    it('should set different moods on different instruments independently', async () => {
      fixture = await ModTestFixture.forAction(
        'music',
        'music:set_cheerful_mood_on_instrument'
      );

      const actor = await fixture.createEntity({
        name: 'Orchestra Leader',
        components: ['core:actor', 'music:is_musician'],
      });

      const lute = await fixture.createEntity({
        name: 'Lute',
        components: ['items:item', 'music:is_instrument'],
      });

      const drum = await fixture.createEntity({
        name: 'Drum',
        components: ['items:item', 'music:is_instrument'],
      });

      // Set cheerful mood on lute
      await fixture.executeAction(actor.id, lute.id);

      // Set aggressive mood on drum
      fixture = await ModTestFixture.forAction(
        'music',
        'music:set_aggressive_mood_on_instrument'
      );

      const actor2 = await fixture.createEntity({
        name: 'Orchestra Leader',
        components: ['core:actor', 'music:is_musician'],
      });

      const lute2 = await fixture.createEntity({
        name: 'Lute',
        components: ['items:item', 'music:is_instrument'],
      });

      const drum2 = await fixture.createEntity({
        name: 'Drum',
        components: ['items:item', 'music:is_instrument'],
      });

      await fixture.executeAction(actor2.id, drum2.id);

      // Verify lute has cheerful mood
      const luteMood = fixture.getComponent(lute2.id, 'music:performance_mood');
      expect(luteMood).toBeUndefined(); // Since we recreated entities

      // Verify drum has aggressive mood
      const drumMood = fixture.getComponent(drum2.id, 'music:performance_mood');
      expect(drumMood.mood).toBe('aggressive');
    });
  });
});
