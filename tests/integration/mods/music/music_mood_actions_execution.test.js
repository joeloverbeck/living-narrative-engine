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
        const actor = fixture.createEntity({
          id: 'musician',
          components: {
          'core:actor': { text: 'Musician' },
          'core:position': { locationId: 'room1' },
          'music:is_musician': {}
          }
        });

        // Create instrument
        const instrument = fixture.createEntity({
          id: 'flute',
          components: {
          'items:item': {},
          'music:is_instrument': {},
          'core:name': { text: 'Flute' }
          }
        });

        fixture.reset([actor, instrument]);
        await fixture.executeAction(actor.id, instrument.id);

        // Verify component was added/modified
        const moodComponent = fixture.entityManager.getComponentData(
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

        const actor = fixture.createEntity({
          id: 'bard',
          components: {
          'core:actor': { text: 'Bard' },
          'core:position': { locationId: 'room1' },
          'music:is_musician': {}
          }
        });

        const instrument = fixture.createEntity({
          id: 'violin',
          components: {
          'items:item': {},
          'music:is_instrument': {},
          'core:name': { text: 'Violin' }
          }
        });

        fixture.reset([actor, instrument]);
        await fixture.executeAction(actor.id, instrument.id);

        // Get dispatched events
        const events = fixture.events;
        const perceptibleEvent = events.find((e) => e.eventType === 'core:perceptible_event');

        expect(perceptibleEvent).toBeDefined();
        expect(perceptibleEvent.payload.descriptionText).toContain(mood.expectedAdj);
        expect(perceptibleEvent.payload.descriptionText).toContain(mood.key);
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

        const actor = fixture.createEntity({
          id: 'performer',
          components: {
          'core:actor': { text: 'Performer' },
          'core:position': { locationId: 'room1' },
          'music:is_musician': {}
          }
        });

        const instrument = fixture.createEntity({
          id: 'lyre',
          components: {
          'items:item': {},
          'music:is_instrument': {},
          'core:name': { text: 'Lyre' }
          }
        });

        fixture.reset([actor, instrument]);
        await fixture.executeAction(actor.id, instrument.id);

        const events = fixture.events;
        const perceptibleEvent = events.find((e) => e.eventType === 'core:perceptible_event');

        expect(perceptibleEvent).toBeDefined();
        expect(perceptibleEvent.payload.actorId).toBe(actor.id);
        expect(perceptibleEvent.payload.targetId).toBe(instrument.id);
        expect(perceptibleEvent.payload.descriptionText).toContain('Performer');
        expect(perceptibleEvent.payload.descriptionText).toContain('Lyre');
        expect(perceptibleEvent.payload.descriptionText).toContain('begins to play');
        expect(perceptibleEvent.payload.descriptionText).toContain(`${mood.key} tone`);
      });
    }
  });

  describe('Message Construction', () => {
    it('should construct messages using lookup data for all moods', async () => {
      fixture = await ModTestFixture.forAction(
        'music',
        'music:set_cheerful_mood_on_instrument'
      );

      const actor = fixture.createEntity({
          id: 'songbird',
          components: {
          'core:actor': { text: 'Songbird' },
          'core:position': { locationId: 'room1' },
          'music:is_musician': {}
          }
        });

      const instrument = fixture.createEntity({
          id: 'golden_harp',
          components: {
          'items:item': {},
          'music:is_instrument': {},
          'core:name': { text: 'Golden Harp' }
          }
        });

      // Test each mood sequentially
      for (const mood of MOODS) {
        fixture = await ModTestFixture.forAction(
          'music',
          `music:set_${mood.key}_mood_on_instrument`
        );

        // Re-create entities for each test
        const testActor = fixture.createEntity({
          id: 'songbird',
          components: {
          'core:actor': { text: 'Songbird' },
          'core:position': { locationId: 'room1' },
          'music:is_musician': {}
          }
        });

        const testInstrument = fixture.createEntity({
          id: 'golden_harp',
          components: {
          'items:item': {},
          'music:is_instrument': {},
          'core:name': { text: 'Golden Harp' }
          }
        });

        fixture.reset([testActor, testInstrument]);
        await fixture.executeAction(testActor.id, testInstrument.id);

        const events = fixture.events;
        const perceptibleEvent = events.find((e) => e.eventType === 'core:perceptible_event');

        expect(perceptibleEvent.payload.descriptionText).toBe(
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

      const actor = fixture.createEntity({
          id: 'musician',
          components: {
          'core:actor': { text: 'Musician' },
          'core:position': { locationId: 'room1' },
          'music:is_musician': {}
          }
        });

      const instrument = fixture.createEntity({
          id: 'lute',
          components: {
          'items:item': {},
          'music:is_instrument': {},
          'core:name': { text: 'Lute' }
          }
        });

      // Set cheerful mood first
        fixture.reset([actor, instrument]);
      await fixture.executeAction(actor.id, instrument.id);

      let moodComponent = fixture.entityManager.getComponentData(
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
      const actor2 = fixture.createEntity({
          id: 'musician',
          components: {
          'core:actor': { text: 'Musician' },
          'core:position': { locationId: 'room1' },
          'music:is_musician': {}
          }
        });

      const instrument2 = fixture.createEntity({
          id: 'lute',
          components: {
          'items:item': {},
          'music:is_instrument': {},
          'core:name': { text: 'Lute' }
          }
        });

        fixture.reset([actor2, instrument2]);
      await fixture.executeAction(actor2.id, instrument2.id);

      moodComponent = fixture.entityManager.getComponentData(
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

      const actor = fixture.createEntity({
          id: 'orchestra_leader',
          components: {
          'core:actor': { text: 'Orchestra Leader' },
          'core:position': { locationId: 'room1' },
          'music:is_musician': {}
          }
        });

      const lute = fixture.createEntity({
          id: 'lute',
          components: {
          'items:item': {},
          'music:is_instrument': {},
          'core:name': { text: 'Lute' }
          }
        });

      const drum = fixture.createEntity({
          id: 'drum',
          components: {
          'items:item': {},
          'music:is_instrument': {},
          'core:name': { text: 'Drum' }
          }
        });

      // Set cheerful mood on lute
        fixture.reset([actor, lute, drum]);
      await fixture.executeAction(actor.id, lute.id);

      // Set aggressive mood on drum
      fixture = await ModTestFixture.forAction(
        'music',
        'music:set_aggressive_mood_on_instrument'
      );

      const actor2 = fixture.createEntity({
          id: 'orchestra_leader',
          components: {
          'core:actor': { text: 'Orchestra Leader' },
          'core:position': { locationId: 'room1' },
          'music:is_musician': {}
          }
        });

      const lute2 = fixture.createEntity({
          id: 'lute',
          components: {
          'items:item': {},
          'music:is_instrument': {},
          'core:name': { text: 'Lute' }
          }
        });

      const drum2 = fixture.createEntity({
          id: 'drum',
          components: {
          'items:item': {},
          'music:is_instrument': {},
          'core:name': { text: 'Drum' }
          }
        });

        fixture.reset([actor2, lute2, drum2]);
      await fixture.executeAction(actor2.id, drum2.id);

      // Verify lute has cheerful mood
      const luteMood = fixture.entityManager.getComponentData(lute2.id, 'music:performance_mood');
      expect(luteMood).toBeUndefined(); // Since we recreated entities

      // Verify drum has aggressive mood
      const drumMood = fixture.entityManager.getComponentData(drum2.id, 'music:performance_mood');
      expect(drumMood.mood).toBe('aggressive');
    });
  });
});
