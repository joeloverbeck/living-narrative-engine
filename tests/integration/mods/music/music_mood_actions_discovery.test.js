/**
 * @file Integration tests for music mood-setting action discovery.
 * @description Tests that all 10 mood-setting actions are properly discovered
 * when an actor with the musician component is near instruments.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';

const MOODS = [
  'cheerful',
  'solemn',
  'mournful',
  'eerie',
  'tense',
  'triumphant',
  'tender',
  'playful',
  'aggressive',
  'meditative',
];

describe('Music Mood Actions - Discovery', () => {
  let fixture;

  afterEach(async () => {
    if (fixture) {
      await fixture.cleanup();
      fixture = null;
    }
  });

  describe('Prerequisites - Actor must be musician', () => {
    for (const mood of MOODS) {
      it(`should NOT discover set_${mood}_mood action when actor lacks musician component`, async () => {
        fixture = await ModTestFixture.forAction(
          'music',
          `music:set_${mood}_mood_on_instrument`
        );

        // Create actor WITHOUT is_musician component
        const actor = await fixture.createEntity({
          name: 'Regular Person',
          components: ['core:actor'],
        });

        // Create instrument
        const instrument = await fixture.createEntity({
          name: 'Lute',
          components: ['items:item', 'music:is_instrument'],
        });

        const actions = await fixture.discoverActionsForActor(actor.id);
        const moodAction = actions.find(
          (a) => a.id === `music:set_${mood}_mood_on_instrument`
        );

        expect(moodAction).toBeUndefined();
      });
    }
  });

  describe('Prerequisites - Target must be instrument', () => {
    for (const mood of MOODS) {
      it(`should NOT discover set_${mood}_mood action when target is not an instrument`, async () => {
        fixture = await ModTestFixture.forAction(
          'music',
          `music:set_${mood}_mood_on_instrument`
        );

        // Create musician actor
        const actor = await fixture.createEntity({
          name: 'Musician',
          components: ['core:actor', 'music:is_musician'],
        });

        // Create regular item (not instrument)
        const item = await fixture.createEntity({
          name: 'Book',
          components: ['items:item'],
        });

        const actions = await fixture.discoverActionsForActor(actor.id);
        const moodAction = actions.find(
          (a) =>
            a.id === `music:set_${mood}_mood_on_instrument` &&
            a.targets?.primary?.entityId === item.id
        );

        expect(moodAction).toBeUndefined();
      });
    }
  });

  describe('Successful Discovery', () => {
    for (const mood of MOODS) {
      it(`should discover set_${mood}_mood action when musician is near instrument`, async () => {
        fixture = await ModTestFixture.forAction(
          'music',
          `music:set_${mood}_mood_on_instrument`
        );

        // Create musician actor
        const actor = await fixture.createEntity({
          name: 'Bard',
          components: ['core:actor', 'music:is_musician'],
        });

        // Create instrument
        const instrument = await fixture.createEntity({
          name: 'Harp',
          components: ['items:item', 'music:is_instrument'],
        });

        const actions = await fixture.discoverActionsForActor(actor.id);
        const moodAction = actions.find(
          (a) =>
            a.id === `music:set_${mood}_mood_on_instrument` &&
            a.targets?.primary?.entityId === instrument.id
        );

        expect(moodAction).toBeDefined();
        expect(moodAction.id).toBe(`music:set_${mood}_mood_on_instrument`);
        expect(moodAction.targets.primary.entityId).toBe(instrument.id);
      });
    }
  });

  describe('Multiple Instruments', () => {
    it('should discover all mood actions for each instrument', async () => {
      fixture = await ModTestFixture.forAction(
        'music',
        'music:set_cheerful_mood_on_instrument'
      );

      // Create musician actor
      const actor = await fixture.createEntity({
        name: 'Performer',
        components: ['core:actor', 'music:is_musician'],
      });

      // Create multiple instruments
      const lute = await fixture.createEntity({
        name: 'Lute',
        components: ['items:item', 'music:is_instrument'],
      });

      const drum = await fixture.createEntity({
        name: 'Drum',
        components: ['items:item', 'music:is_instrument'],
      });

      const actions = await fixture.discoverActionsForActor(actor.id);

      // Should have 10 mood actions per instrument = 20 total
      const moodActions = actions.filter((a) =>
        a.id.startsWith('music:set_') && a.id.includes('_mood_on_instrument')
      );

      expect(moodActions.length).toBeGreaterThanOrEqual(20);

      // Verify each instrument has actions
      const luteActions = moodActions.filter(
        (a) => a.targets?.primary?.entityId === lute.id
      );
      const drumActions = moodActions.filter(
        (a) => a.targets?.primary?.entityId === drum.id
      );

      expect(luteActions.length).toBe(10);
      expect(drumActions.length).toBe(10);
    });
  });
});
