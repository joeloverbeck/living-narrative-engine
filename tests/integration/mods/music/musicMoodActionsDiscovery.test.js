/**
 * @file Integration tests for all music mood-setting action discovery.
 * @description Tests that all music:set_*_mood_on_instrument actions are properly discoverable.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';

// Import all music mood actions
import setAggressiveMoodAction from '../../../../data/mods/music/actions/set_aggressive_mood_on_instrument.action.json' assert { type: 'json' };
import setCheerfulMoodAction from '../../../../data/mods/music/actions/set_cheerful_mood_on_instrument.action.json' assert { type: 'json' };
import setEerieMoodAction from '../../../../data/mods/music/actions/set_eerie_mood_on_instrument.action.json' assert { type: 'json' };
import setMeditativeMoodAction from '../../../../data/mods/music/actions/set_meditative_mood_on_instrument.action.json' assert { type: 'json' };
import setMournfulMoodAction from '../../../../data/mods/music/actions/set_mournful_mood_on_instrument.action.json' assert { type: 'json' };
import setPlayfulMoodAction from '../../../../data/mods/music/actions/set_playful_mood_on_instrument.action.json' assert { type: 'json' };
import setSolemnMoodAction from '../../../../data/mods/music/actions/set_solemn_mood_on_instrument.action.json' assert { type: 'json' };
import setTenderMoodAction from '../../../../data/mods/music/actions/set_tender_mood_on_instrument.action.json' assert { type: 'json' };
import setTenseMoodAction from '../../../../data/mods/music/actions/set_tense_mood_on_instrument.action.json' assert { type: 'json' };
import setTriumphantMoodAction from '../../../../data/mods/music/actions/set_triumphant_mood_on_instrument.action.json' assert { type: 'json' };

const MOOD_ACTIONS = [
  { name: 'aggressive', action: setAggressiveMoodAction, id: 'music:set_aggressive_mood_on_instrument' },
  { name: 'cheerful', action: setCheerfulMoodAction, id: 'music:set_cheerful_mood_on_instrument' },
  { name: 'eerie', action: setEerieMoodAction, id: 'music:set_eerie_mood_on_instrument' },
  { name: 'meditative', action: setMeditativeMoodAction, id: 'music:set_meditative_mood_on_instrument' },
  { name: 'mournful', action: setMournfulMoodAction, id: 'music:set_mournful_mood_on_instrument' },
  { name: 'playful', action: setPlayfulMoodAction, id: 'music:set_playful_mood_on_instrument' },
  { name: 'solemn', action: setSolemnMoodAction, id: 'music:set_solemn_mood_on_instrument' },
  { name: 'tender', action: setTenderMoodAction, id: 'music:set_tender_mood_on_instrument' },
  { name: 'tense', action: setTenseMoodAction, id: 'music:set_tense_mood_on_instrument' },
  { name: 'triumphant', action: setTriumphantMoodAction, id: 'music:set_triumphant_mood_on_instrument' },
];

describe('Music mood actions discovery', () => {
  let testFixture;
  let configureActionDiscovery;

  beforeEach(async () => {
    // Use any music action for fixture setup - they all have same structure
    testFixture = await ModTestFixture.forAction(
      'music',
      'music:set_cheerful_mood_on_instrument'
    );

    configureActionDiscovery = () => {
      const { testEnv } = testFixture;
      if (!testEnv) {
        return;
      }

      // Build action index with all music mood actions
      testEnv.actionIndex.buildIndex(MOOD_ACTIONS.map(m => m.action));
    };
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Action structure validation', () => {
    MOOD_ACTIONS.forEach(({ name, action, id }) => {
      describe(`${name} mood action`, () => {
        it('should have correct action structure', () => {
          expect(action).toBeDefined();
          expect(action.id).toBe(id);
          expect(action.name).toBe(`Set ${name.charAt(0).toUpperCase() + name.slice(1)} Mood on Instrument`);
          expect(action.description).toContain(name);
          expect(action.description).toContain('instrument');
          expect(action.template).toBe(`set ${name} mood on {instrument}`);
        });

        it('should use items:examinable_items scope for primary targets', () => {
          expect(action.targets).toBeDefined();
          expect(action.targets.primary).toBeDefined();
          expect(action.targets.primary.scope).toBe('items:examinable_items');
          expect(action.targets.primary.placeholder).toBe('instrument');
          expect(action.targets.primary.description).toBe(`Instrument to play with ${name} mood`);
        });

        it('should require music:is_musician component on actor', () => {
          expect(action.required_components).toBeDefined();
          expect(action.required_components.actor).toBeDefined();
          expect(action.required_components.actor).toEqual(['music:is_musician']);
        });

        it('should require items:item and music:is_instrument components on primary target', () => {
          expect(action.required_components.primary).toBeDefined();
          expect(action.required_components.primary).toEqual([
            'items:item',
            'music:is_instrument',
          ]);
        });

        it('should have empty prerequisites array', () => {
          expect(action.prerequisites).toBeDefined();
          expect(Array.isArray(action.prerequisites)).toBe(true);
          expect(action.prerequisites).toEqual([]);
        });

        it('should have correct visual styling matching music theme', () => {
          expect(action.visual).toBeDefined();
          expect(action.visual.backgroundColor).toBe('#1a2332');
          expect(action.visual.textColor).toBe('#d1d5db');
          expect(action.visual.hoverBackgroundColor).toBe('#2d3748');
          expect(action.visual.hoverTextColor).toBe('#f3f4f6');
        });
      });
    });
  });

  describe('Action discovery scenarios', () => {
    describe('Instrument in actor inventory', () => {
      it('should discover all mood actions when musician has instrument in inventory', () => {
        const room = ModEntityScenarios.createRoom('room1', 'Music Room');

        const actor = new ModEntityBuilder('actor1')
          .withName('Bardic Alice')
          .atLocation('room1')
          .asActor()
          .withComponent('music:is_musician', {})
          .withComponent('items:inventory', {
            items: ['lute_1'],
            capacity: { maxWeight: 50, maxItems: 10 },
          })
          .build();

        const instrument = new ModEntityBuilder('lute_1')
          .withName('wooden lute')
          .withComponent('items:item', {})
          .withComponent('items:portable', {})
          .withComponent('music:is_instrument', {})
          .build();

        testFixture.reset([room, actor, instrument]);
        configureActionDiscovery();

        const discoveredActions = testFixture.discoverActions('actor1');
        const moodActions = discoveredActions.filter((action) =>
          action.id.startsWith('music:set_') && action.id.endsWith('_mood_on_instrument')
        );

        // Should discover all 10 mood actions
        expect(moodActions.length).toBe(10);

        // Verify each mood action is present
        MOOD_ACTIONS.forEach(({ id }) => {
          expect(moodActions.some(a => a.id === id)).toBe(true);
        });

        // Verify scope resolution includes the instrument
        const actorInstance = testFixture.entityManager.getEntityInstance('actor1');
        const scopeContext = {
          actor: {
            id: 'actor1',
            components: actorInstance.components,
          },
        };

        const scopeResult =
          testFixture.testEnv.unifiedScopeResolver.resolveSync(
            'items:examinable_items',
            scopeContext
          );

        expect(scopeResult.success).toBe(true);
        expect(Array.from(scopeResult.value)).toContain('lute_1');
      });
    });

    describe('Instrument at actor location', () => {
      it('should discover all mood actions when musician is at location with instrument', () => {
        const room = ModEntityScenarios.createRoom('room1', 'Music Room');

        const actor = new ModEntityBuilder('actor1')
          .withName('Minstrel Bob')
          .atLocation('room1')
          .asActor()
          .withComponent('music:is_musician', {})
          .build();

        const instrument = new ModEntityBuilder('guitar_1')
          .withName('acoustic guitar')
          .atLocation('room1')
          .withComponent('items:item', {})
          .withComponent('items:portable', {})
          .withComponent('music:is_instrument', {})
          .build();

        testFixture.reset([room, actor, instrument]);
        configureActionDiscovery();

        const discoveredActions = testFixture.discoverActions('actor1');
        const moodActions = discoveredActions.filter((action) =>
          action.id.startsWith('music:set_') && action.id.endsWith('_mood_on_instrument')
        );

        // Should discover all 10 mood actions
        expect(moodActions.length).toBe(10);

        // Verify scope resolution includes the instrument
        const actorInstance = testFixture.entityManager.getEntityInstance('actor1');
        const scopeContext = {
          actor: {
            id: 'actor1',
            components: actorInstance.components,
          },
        };

        const scopeResult =
          testFixture.testEnv.unifiedScopeResolver.resolveSync(
            'items:examinable_items',
            scopeContext
          );

        expect(scopeResult.success).toBe(true);
        expect(Array.from(scopeResult.value)).toContain('guitar_1');
      });

      it('should NOT discover actions for non-portable instruments at location', () => {
        const room = ModEntityScenarios.createRoom('room1', 'Concert Hall');

        const actor = new ModEntityBuilder('actor1')
          .withName('Pianist Charlie')
          .atLocation('room1')
          .asActor()
          .withComponent('music:is_musician', {})
          .build();

        // Grand piano - non-portable and not in scope for music actions
        // Note: items:examinable_items scope excludes non-portable items in test environment
        const instrument = new ModEntityBuilder('grand_piano')
          .withName('grand piano')
          .atLocation('room1')
          .withComponent('items:item', {})
          .withComponent('music:is_instrument', {})
          .build();

        testFixture.reset([room, actor, instrument]);
        configureActionDiscovery();

        const discoveredActions = testFixture.discoverActions('actor1');
        const moodActions = discoveredActions.filter((action) =>
          action.id.startsWith('music:set_') && action.id.endsWith('_mood_on_instrument')
        );

        // Should NOT discover mood actions for non-portable instrument
        // Consistent with items:examinable_items scope behavior
        expect(moodActions.length).toBe(0);

        // Verify scope resolution excludes non-portable instrument
        const actorInstance = testFixture.entityManager.getEntityInstance('actor1');
        const scopeContext = {
          actor: {
            id: 'actor1',
            components: actorInstance.components,
          },
        };

        const scopeResult =
          testFixture.testEnv.unifiedScopeResolver.resolveSync(
            'items:examinable_items',
            scopeContext
          );

        expect(scopeResult.success).toBe(true);
        expect(Array.from(scopeResult.value)).not.toContain('grand_piano');
      });
    });

    describe('Missing musician component', () => {
      it('should NOT discover any mood actions when actor lacks music:is_musician component', () => {
        const room = ModEntityScenarios.createRoom('room1', 'Music Room');

        const actor = new ModEntityBuilder('actor1')
          .withName('Non-Musician Diana')
          .atLocation('room1')
          .asActor()
          .withComponent('items:inventory', {
            items: ['lute_1'],
            capacity: { maxWeight: 50, maxItems: 10 },
          })
          .build();

        const instrument = new ModEntityBuilder('lute_1')
          .withName('wooden lute')
          .withComponent('items:item', {})
          .withComponent('items:portable', {})
          .withComponent('music:is_instrument', {})
          .build();

        testFixture.reset([room, actor, instrument]);
        configureActionDiscovery();

        const discoveredActions = testFixture.discoverActions('actor1');
        const moodActions = discoveredActions.filter((action) =>
          action.id.startsWith('music:set_') && action.id.endsWith('_mood_on_instrument')
        );

        // Should NOT discover any mood actions
        expect(moodActions.length).toBe(0);
      });
    });

    describe('No instruments available', () => {
      it('should NOT discover any mood actions when no instruments exist', () => {
        const room = ModEntityScenarios.createRoom('room1', 'Empty Room');

        const actor = new ModEntityBuilder('actor1')
          .withName('Musician Eve')
          .atLocation('room1')
          .asActor()
          .withComponent('music:is_musician', {})
          .withComponent('items:inventory', {
            items: [],
            capacity: { maxWeight: 50, maxItems: 10 },
          })
          .build();

        testFixture.reset([room, actor]);
        configureActionDiscovery();

        const discoveredActions = testFixture.discoverActions('actor1');
        const moodActions = discoveredActions.filter((action) =>
          action.id.startsWith('music:set_') && action.id.endsWith('_mood_on_instrument')
        );

        // Should NOT discover any mood actions
        expect(moodActions.length).toBe(0);

        // Verify scope resolution returns empty
        const actorInstance = testFixture.entityManager.getEntityInstance('actor1');
        const scopeContext = {
          actor: {
            id: 'actor1',
            components: actorInstance.components,
          },
        };

        const scopeResult =
          testFixture.testEnv.unifiedScopeResolver.resolveSync(
            'items:examinable_items',
            scopeContext
          );

        expect(scopeResult.success).toBe(true);
        expect(Array.from(scopeResult.value)).toHaveLength(0);
      });

      it('should NOT discover mood actions when instruments are at different location', () => {
        const roomA = ModEntityScenarios.createRoom('location_a', 'Room A');
        const roomB = ModEntityScenarios.createRoom('location_b', 'Room B');

        const actor = new ModEntityBuilder('actor1')
          .withName('Musician Frank')
          .atLocation('location_a')
          .asActor()
          .withComponent('music:is_musician', {})
          .build();

        const instrument = new ModEntityBuilder('distant_lute')
          .withName('distant lute')
          .atLocation('location_b')
          .withComponent('items:item', {})
          .withComponent('items:portable', {})
          .withComponent('music:is_instrument', {})
          .build();

        testFixture.reset([roomA, roomB, actor, instrument]);
        configureActionDiscovery();

        const discoveredActions = testFixture.discoverActions('actor1');
        const moodActions = discoveredActions.filter((action) =>
          action.id.startsWith('music:set_') && action.id.endsWith('_mood_on_instrument')
        );

        // Should NOT discover any mood actions
        expect(moodActions.length).toBe(0);

        // Verify scope resolution doesn't include distant instrument
        const actorInstance = testFixture.entityManager.getEntityInstance('actor1');
        const scopeContext = {
          actor: {
            id: 'actor1',
            components: actorInstance.components,
          },
        };

        const scopeResult =
          testFixture.testEnv.unifiedScopeResolver.resolveSync(
            'items:examinable_items',
            scopeContext
          );

        expect(scopeResult.success).toBe(true);
        expect(Array.from(scopeResult.value)).not.toContain('distant_lute');
      });
    });

    describe('Item missing instrument component', () => {
      it('should NOT discover mood actions for items lacking music:is_instrument component', () => {
        const room = ModEntityScenarios.createRoom('room1', 'Music Room');

        const actor = new ModEntityBuilder('actor1')
          .withName('Musician Grace')
          .atLocation('room1')
          .asActor()
          .withComponent('music:is_musician', {})
          .withComponent('items:inventory', {
            items: ['ordinary_book'],
            capacity: { maxWeight: 50, maxItems: 10 },
          })
          .build();

        // Regular item without is_instrument component
        const item = new ModEntityBuilder('ordinary_book')
          .withName('ordinary book')
          .withComponent('items:item', {})
          .withComponent('items:portable', {})
          .build();

        testFixture.reset([room, actor, item]);
        configureActionDiscovery();

        const discoveredActions = testFixture.discoverActions('actor1');
        const moodActions = discoveredActions.filter((action) =>
          action.id.startsWith('music:set_') && action.id.endsWith('_mood_on_instrument')
        );

        // Should NOT discover any mood actions
        expect(moodActions.length).toBe(0);

        // Scope resolves the item but required_components filter excludes it
        const actorInstance = testFixture.entityManager.getEntityInstance('actor1');
        const scopeContext = {
          actor: {
            id: 'actor1',
            components: actorInstance.components,
          },
        };

        const scopeResult =
          testFixture.testEnv.unifiedScopeResolver.resolveSync(
            'items:examinable_items',
            scopeContext
          );

        expect(scopeResult.success).toBe(true);
        expect(Array.from(scopeResult.value)).toContain('ordinary_book');
        // But action discovery should filter it out via required_components
      });
    });

    describe('Multiple instruments scenario', () => {
      it('should discover mood actions for each instrument separately', () => {
        const room = ModEntityScenarios.createRoom('room1', 'Music Shop');

        const actor = new ModEntityBuilder('actor1')
          .withName('Multi-Instrumentalist Henry')
          .atLocation('room1')
          .asActor()
          .withComponent('music:is_musician', {})
          .withComponent('items:inventory', {
            items: ['flute_1'],
            capacity: { maxWeight: 50, maxItems: 10 },
          })
          .build();

        const flute = new ModEntityBuilder('flute_1')
          .withName('silver flute')
          .withComponent('items:item', {})
          .withComponent('items:portable', {})
          .withComponent('music:is_instrument', {})
          .build();

        const violin = new ModEntityBuilder('violin_1')
          .withName('violin')
          .atLocation('room1')
          .withComponent('items:item', {})
          .withComponent('items:portable', {})
          .withComponent('music:is_instrument', {})
          .build();

        testFixture.reset([room, actor, flute, violin]);
        configureActionDiscovery();

        const discoveredActions = testFixture.discoverActions('actor1');
        const moodActions = discoveredActions.filter((action) =>
          action.id.startsWith('music:set_') && action.id.endsWith('_mood_on_instrument')
        );

        // Should discover all 10 mood actions
        expect(moodActions.length).toBe(10);

        // Verify scope includes both instruments
        const actorInstance = testFixture.entityManager.getEntityInstance('actor1');
        const scopeContext = {
          actor: {
            id: 'actor1',
            components: actorInstance.components,
          },
        };

        const scopeResult =
          testFixture.testEnv.unifiedScopeResolver.resolveSync(
            'items:examinable_items',
            scopeContext
          );

        expect(scopeResult.success).toBe(true);
        const scopeItems = Array.from(scopeResult.value);
        expect(scopeItems).toContain('flute_1');
        expect(scopeItems).toContain('violin_1');
      });
    });
  });
});
