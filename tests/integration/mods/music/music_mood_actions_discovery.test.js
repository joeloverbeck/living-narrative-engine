/**
 * @file Integration tests for music mood-setting action discovery.
 * @description Tests that all 10 mood-setting actions are properly discovered
 * when an actor with the musician component is near instruments.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';

// Import all mood action definitions
import cheerfulAction from '../../../../data/mods/music/actions/set_cheerful_mood_on_instrument.action.json';
import solemnAction from '../../../../data/mods/music/actions/set_solemn_mood_on_instrument.action.json';
import mournfulAction from '../../../../data/mods/music/actions/set_mournful_mood_on_instrument.action.json';
import eerieAction from '../../../../data/mods/music/actions/set_eerie_mood_on_instrument.action.json';
import tenseAction from '../../../../data/mods/music/actions/set_tense_mood_on_instrument.action.json';
import triumphantAction from '../../../../data/mods/music/actions/set_triumphant_mood_on_instrument.action.json';
import tenderAction from '../../../../data/mods/music/actions/set_tender_mood_on_instrument.action.json';
import playfulAction from '../../../../data/mods/music/actions/set_playful_mood_on_instrument.action.json';
import aggressiveAction from '../../../../data/mods/music/actions/set_aggressive_mood_on_instrument.action.json';
import meditativeAction from '../../../../data/mods/music/actions/set_meditative_mood_on_instrument.action.json';

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

const MOOD_ACTIONS = {
  cheerful: cheerfulAction,
  solemn: solemnAction,
  mournful: mournfulAction,
  eerie: eerieAction,
  tense: tenseAction,
  triumphant: triumphantAction,
  tender: tenderAction,
  playful: playfulAction,
  aggressive: aggressiveAction,
  meditative: meditativeAction,
};

/**
 * Registers all mood actions for discovery
 * @param {ModTestFixture} fixture - Active test fixture instance
 */
function configureActionDiscovery(fixture) {
  const allActions = Object.values(MOOD_ACTIONS);
  fixture.testEnv.actionIndex.buildIndex(allActions);
}

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
        const actor = fixture.createEntity({
          id: 'regular_person',
          components: {
          'core:actor': { text: 'Regular Person' },
          'core:position': { locationId: 'room1' }
          }
        });

        // Create instrument
        const instrument = fixture.createEntity({
          id: 'lute',
          components: {
          'items:item': {},
          'music:is_instrument': {},
          'core:name': { text: 'Lute' }
          }
        });

        fixture.reset([actor, instrument]);
        configureActionDiscovery(fixture);

        const actions = await fixture.discoverActions(actor.id);
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
        const actor = fixture.createEntity({
          id: 'musician',
          components: {
          'core:actor': { text: 'Musician' },
          'core:position': { locationId: 'room1' },
          'music:is_musician': {}
          }
        });

        // Create regular item (not instrument)
        const item = fixture.createEntity({
          id: 'book',
          components: {
          'items:item': {},
          'core:name': { text: 'Book' }
          }
        });

        fixture.reset([actor, item]);
        configureActionDiscovery(fixture);

        const actions = await fixture.discoverActions(actor.id);
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
        const actor = fixture.createEntity({
          id: 'bard',
          components: {
          'core:actor': { text: 'Bard' },
          'core:position': { locationId: 'room1' },
          'music:is_musician': {}
          }
        });

        // Create instrument
        const instrument = fixture.createEntity({
          id: 'harp',
          components: {
          'items:item': {},
          'music:is_instrument': {},
          'core:name': { text: 'Harp' }
          }
        });

        fixture.reset([actor, instrument]);
        configureActionDiscovery(fixture);

        const actions = await fixture.discoverActions(actor.id);
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
      const actor = fixture.createEntity({
          id: 'performer',
          components: {
          'core:actor': { text: 'Performer' },
          'core:position': { locationId: 'room1' },
          'music:is_musician': {}
          }
        });

      // Create multiple instruments
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

      fixture.reset([actor, lute, drum]);
      configureActionDiscovery(fixture);

      const actions = await fixture.discoverActions(actor.id);

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
