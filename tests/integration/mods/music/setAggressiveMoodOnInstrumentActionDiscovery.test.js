/**
 * @file Integration tests for set_aggressive_mood_on_instrument action discovery.
 * @description Tests that the music:set_aggressive_mood_on_instrument action is properly discoverable.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import setAggressiveMoodAction from '../../../../data/mods/music/actions/set_aggressive_mood_on_instrument.action.json' assert { type: 'json' };

describe('music:set_aggressive_mood_on_instrument - Action Discovery', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'music',
      'music:set_aggressive_mood_on_instrument'
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Action structure validation', () => {
    it('should have correct action structure', () => {
      expect(setAggressiveMoodAction).toBeDefined();
      expect(setAggressiveMoodAction.id).toBe(
        'music:set_aggressive_mood_on_instrument'
      );
      expect(setAggressiveMoodAction.name).toBe(
        'Set Aggressive Mood on Instrument'
      );
      expect(setAggressiveMoodAction.description).toContain('aggressive');
      expect(setAggressiveMoodAction.description).toContain('instrument');
      expect(setAggressiveMoodAction.template).toBe(
        'set aggressive mood on {instrument}'
      );
    });

    it('should use items:examinable_items scope for primary targets', () => {
      expect(setAggressiveMoodAction.targets).toBeDefined();
      expect(setAggressiveMoodAction.targets.primary).toBeDefined();
      expect(setAggressiveMoodAction.targets.primary.scope).toBe(
        'items:examinable_items'
      );
      expect(setAggressiveMoodAction.targets.primary.placeholder).toBe(
        'instrument'
      );
      expect(setAggressiveMoodAction.targets.primary.description).toBe(
        'Instrument to play with aggressive mood'
      );
    });

    it('should require music:is_musician component on actor', () => {
      expect(setAggressiveMoodAction.required_components).toBeDefined();
      expect(setAggressiveMoodAction.required_components.actor).toBeDefined();
      expect(setAggressiveMoodAction.required_components.actor).toEqual([
        'music:is_musician',
      ]);
    });

    it('should require items-core:item and music:is_instrument components on primary target', () => {
      expect(setAggressiveMoodAction.required_components.primary).toBeDefined();
      expect(setAggressiveMoodAction.required_components.primary).toEqual([
        'items-core:item',
        'music:is_instrument',
      ]);
    });

    it('should have empty prerequisites array', () => {
      expect(setAggressiveMoodAction.prerequisites).toBeDefined();
      expect(Array.isArray(setAggressiveMoodAction.prerequisites)).toBe(true);
      expect(setAggressiveMoodAction.prerequisites).toEqual([]);
    });

    it('should have correct visual styling matching music theme', () => {
      expect(setAggressiveMoodAction.visual).toBeDefined();
      expect(setAggressiveMoodAction.visual.backgroundColor).toBe('#1a2332');
      expect(setAggressiveMoodAction.visual.textColor).toBe('#d1d5db');
      expect(setAggressiveMoodAction.visual.hoverBackgroundColor).toBe(
        '#2d3748'
      );
      expect(setAggressiveMoodAction.visual.hoverTextColor).toBe('#f3f4f6');
    });
  });

  describe('Discovery scenarios', () => {
    describe('When musician has instrument in inventory', () => {
      it('should discover set_aggressive_mood_on_instrument action', () => {
        const room = ModEntityScenarios.createRoom('room1', 'Music Room');

        const actor = new ModEntityBuilder('actor1')
          .withName('Fierce Bard')
          .atLocation('room1')
          .asActor()
          .withComponent('music:is_musician', {})
          .withComponent('items:inventory', {
            items: ['lute_1'],
            capacity: { maxWeight: 50, maxItems: 10 },
          })
          .build();

        const instrument = new ModEntityBuilder('lute_1')
          .withName('battle lute')
          .withComponent('items-core:item', {})
          .withComponent('items-core:portable', {})
          .withComponent('music:is_instrument', {})
          .build();

        testFixture.reset([room, actor, instrument]);
        testFixture.testEnv.actionIndex.buildIndex([setAggressiveMoodAction]);

        const discoveredActions = testFixture.discoverActions('actor1');
        const aggressiveActions = discoveredActions.filter(
          (action) => action.id === 'music:set_aggressive_mood_on_instrument'
        );

        expect(aggressiveActions.length).toBe(1);
      });

      it('should include instrument in scope resolution', () => {
        const room = ModEntityScenarios.createRoom('room1', 'Music Room');

        const actor = new ModEntityBuilder('actor1')
          .withName('Scope Test Bard')
          .atLocation('room1')
          .asActor()
          .withComponent('music:is_musician', {})
          .withComponent('items:inventory', {
            items: ['guitar_1'],
            capacity: { maxWeight: 50, maxItems: 10 },
          })
          .build();

        const instrument = new ModEntityBuilder('guitar_1')
          .withName('electric guitar')
          .withComponent('items-core:item', {})
          .withComponent('items-core:portable', {})
          .withComponent('music:is_instrument', {})
          .build();

        testFixture.reset([room, actor, instrument]);

        const actorInstance =
          testFixture.entityManager.getEntityInstance('actor1');
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
    });

    describe('When musician is at location with instrument', () => {
      it('should discover set_aggressive_mood_on_instrument action', () => {
        const room = ModEntityScenarios.createRoom('room1', 'Music Hall');

        const actor = new ModEntityBuilder('actor1')
          .withName('Location Test Musician')
          .atLocation('room1')
          .asActor()
          .withComponent('music:is_musician', {})
          .build();

        const instrument = new ModEntityBuilder('drum_1')
          .withName('war drum')
          .atLocation('room1')
          .withComponent('items-core:item', {})
          .withComponent('items-core:portable', {})
          .withComponent('music:is_instrument', {})
          .build();

        testFixture.reset([room, actor, instrument]);
        testFixture.testEnv.actionIndex.buildIndex([setAggressiveMoodAction]);

        const discoveredActions = testFixture.discoverActions('actor1');
        const aggressiveActions = discoveredActions.filter(
          (action) => action.id === 'music:set_aggressive_mood_on_instrument'
        );

        expect(aggressiveActions.length).toBe(1);
      });

      it('should include location instrument in scope resolution', () => {
        const room = ModEntityScenarios.createRoom('room1', 'Music Hall');

        const actor = new ModEntityBuilder('actor1')
          .withName('Location Scope Bard')
          .atLocation('room1')
          .asActor()
          .withComponent('music:is_musician', {})
          .build();

        const instrument = new ModEntityBuilder('violin_1')
          .withName('aggressive violin')
          .atLocation('room1')
          .withComponent('items-core:item', {})
          .withComponent('items-core:portable', {})
          .withComponent('music:is_instrument', {})
          .build();

        testFixture.reset([room, actor, instrument]);

        const actorInstance =
          testFixture.entityManager.getEntityInstance('actor1');
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
        expect(Array.from(scopeResult.value)).toContain('violin_1');
      });
    });

    describe('When actor lacks music:is_musician component', () => {
      it('should NOT discover set_aggressive_mood_on_instrument action', () => {
        const room = ModEntityScenarios.createRoom('room1', 'Music Room');

        const actor = new ModEntityBuilder('actor1')
          .withName('Non-Musician')
          .atLocation('room1')
          .asActor()
          .withComponent('items:inventory', {
            items: ['lute_1'],
            capacity: { maxWeight: 50, maxItems: 10 },
          })
          .build();

        const instrument = new ModEntityBuilder('lute_1')
          .withName('unused lute')
          .withComponent('items-core:item', {})
          .withComponent('items-core:portable', {})
          .withComponent('music:is_instrument', {})
          .build();

        testFixture.reset([room, actor, instrument]);
        testFixture.testEnv.actionIndex.buildIndex([setAggressiveMoodAction]);

        const discoveredActions = testFixture.discoverActions('actor1');
        const aggressiveActions = discoveredActions.filter(
          (action) => action.id === 'music:set_aggressive_mood_on_instrument'
        );

        expect(aggressiveActions.length).toBe(0);
      });
    });

    describe('When no instruments are available', () => {
      it('should NOT discover set_aggressive_mood_on_instrument action', () => {
        const room = ModEntityScenarios.createRoom('room1', 'Empty Room');

        const actor = new ModEntityBuilder('actor1')
          .withName('Instrumentless Musician')
          .atLocation('room1')
          .asActor()
          .withComponent('music:is_musician', {})
          .withComponent('items:inventory', {
            items: [],
            capacity: { maxWeight: 50, maxItems: 10 },
          })
          .build();

        testFixture.reset([room, actor]);
        testFixture.testEnv.actionIndex.buildIndex([setAggressiveMoodAction]);

        const discoveredActions = testFixture.discoverActions('actor1');
        const aggressiveActions = discoveredActions.filter(
          (action) => action.id === 'music:set_aggressive_mood_on_instrument'
        );

        expect(aggressiveActions.length).toBe(0);
      });

      it('should return empty scope resolution', () => {
        const room = ModEntityScenarios.createRoom('room1', 'Empty Room');

        const actor = new ModEntityBuilder('actor1')
          .withName('Empty Scope Musician')
          .atLocation('room1')
          .asActor()
          .withComponent('music:is_musician', {})
          .withComponent('items:inventory', {
            items: [],
            capacity: { maxWeight: 50, maxItems: 10 },
          })
          .build();

        testFixture.reset([room, actor]);

        const actorInstance =
          testFixture.entityManager.getEntityInstance('actor1');
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
    });

    describe('When instrument is at different location', () => {
      it('should NOT discover set_aggressive_mood_on_instrument action', () => {
        const roomA = ModEntityScenarios.createRoom('location_a', 'Room A');
        const roomB = ModEntityScenarios.createRoom('location_b', 'Room B');

        const actor = new ModEntityBuilder('actor1')
          .withName('Distant Musician')
          .atLocation('location_a')
          .asActor()
          .withComponent('music:is_musician', {})
          .build();

        const instrument = new ModEntityBuilder('distant_lute')
          .withName('faraway lute')
          .atLocation('location_b')
          .withComponent('items-core:item', {})
          .withComponent('items-core:portable', {})
          .withComponent('music:is_instrument', {})
          .build();

        testFixture.reset([roomA, roomB, actor, instrument]);
        testFixture.testEnv.actionIndex.buildIndex([setAggressiveMoodAction]);

        const discoveredActions = testFixture.discoverActions('actor1');
        const aggressiveActions = discoveredActions.filter(
          (action) => action.id === 'music:set_aggressive_mood_on_instrument'
        );

        expect(aggressiveActions.length).toBe(0);
      });

      it('should exclude distant instrument from scope resolution', () => {
        const roomA = ModEntityScenarios.createRoom('location_a', 'Room A');
        const roomB = ModEntityScenarios.createRoom('location_b', 'Room B');

        const actor = new ModEntityBuilder('actor1')
          .withName('Scope Distance Test Bard')
          .atLocation('location_a')
          .asActor()
          .withComponent('music:is_musician', {})
          .build();

        const instrument = new ModEntityBuilder('distant_guitar')
          .withName('faraway guitar')
          .atLocation('location_b')
          .withComponent('items-core:item', {})
          .withComponent('items-core:portable', {})
          .withComponent('music:is_instrument', {})
          .build();

        testFixture.reset([roomA, roomB, actor, instrument]);

        const actorInstance =
          testFixture.entityManager.getEntityInstance('actor1');
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
        expect(Array.from(scopeResult.value)).not.toContain('distant_guitar');
      });
    });

    describe('When item lacks music:is_instrument component', () => {
      it('should NOT discover set_aggressive_mood_on_instrument action for non-instruments', () => {
        const room = ModEntityScenarios.createRoom('room1', 'Music Room');

        const actor = new ModEntityBuilder('actor1')
          .withName('Confused Musician')
          .atLocation('room1')
          .asActor()
          .withComponent('music:is_musician', {})
          .withComponent('items:inventory', {
            items: ['book_1'],
            capacity: { maxWeight: 50, maxItems: 10 },
          })
          .build();

        const nonInstrument = new ModEntityBuilder('book_1')
          .withName('book about music')
          .withComponent('items-core:item', {})
          .withComponent('items-core:portable', {})
          .build();

        testFixture.reset([room, actor, nonInstrument]);
        testFixture.testEnv.actionIndex.buildIndex([setAggressiveMoodAction]);

        const discoveredActions = testFixture.discoverActions('actor1');
        const aggressiveActions = discoveredActions.filter(
          (action) => action.id === 'music:set_aggressive_mood_on_instrument'
        );

        expect(aggressiveActions.length).toBe(0);
      });

      it('should include non-instrument in scope but filter via required_components', () => {
        const room = ModEntityScenarios.createRoom('room1', 'Music Room');

        const actor = new ModEntityBuilder('actor1')
          .withName('Filter Test Musician')
          .atLocation('room1')
          .asActor()
          .withComponent('music:is_musician', {})
          .withComponent('items:inventory', {
            items: ['random_item'],
            capacity: { maxWeight: 50, maxItems: 10 },
          })
          .build();

        const nonInstrument = new ModEntityBuilder('random_item')
          .withName('random item')
          .withComponent('items-core:item', {})
          .withComponent('items-core:portable', {})
          .build();

        testFixture.reset([room, actor, nonInstrument]);

        const actorInstance =
          testFixture.entityManager.getEntityInstance('actor1');
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
        expect(Array.from(scopeResult.value)).toContain('random_item');
        // But action discovery should filter it out via required_components
      });
    });

    describe('When multiple instruments are available', () => {
      it('should discover action once (not per instrument)', () => {
        const room = ModEntityScenarios.createRoom('room1', 'Music Shop');

        const actor = new ModEntityBuilder('actor1')
          .withName('Multi-Instrumentalist')
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
          .withComponent('items-core:item', {})
          .withComponent('items-core:portable', {})
          .withComponent('music:is_instrument', {})
          .build();

        const violin = new ModEntityBuilder('violin_1')
          .withName('violin')
          .atLocation('room1')
          .withComponent('items-core:item', {})
          .withComponent('items-core:portable', {})
          .withComponent('music:is_instrument', {})
          .build();

        testFixture.reset([room, actor, flute, violin]);
        testFixture.testEnv.actionIndex.buildIndex([setAggressiveMoodAction]);

        const discoveredActions = testFixture.discoverActions('actor1');
        const aggressiveActions = discoveredActions.filter(
          (action) => action.id === 'music:set_aggressive_mood_on_instrument'
        );

        // Should discover action once, but it can target either instrument
        expect(aggressiveActions.length).toBe(1);
      });

      it('should include all instruments in scope resolution', () => {
        const room = ModEntityScenarios.createRoom('room1', 'Music Shop');

        const actor = new ModEntityBuilder('actor1')
          .withName('Multi-Scope Bard')
          .atLocation('room1')
          .asActor()
          .withComponent('music:is_musician', {})
          .withComponent('items:inventory', {
            items: ['trumpet_1'],
            capacity: { maxWeight: 50, maxItems: 10 },
          })
          .build();

        const trumpet = new ModEntityBuilder('trumpet_1')
          .withName('trumpet')
          .withComponent('items-core:item', {})
          .withComponent('items-core:portable', {})
          .withComponent('music:is_instrument', {})
          .build();

        const drum = new ModEntityBuilder('drum_1')
          .withName('drum')
          .atLocation('room1')
          .withComponent('items-core:item', {})
          .withComponent('items-core:portable', {})
          .withComponent('music:is_instrument', {})
          .build();

        testFixture.reset([room, actor, trumpet, drum]);

        const actorInstance =
          testFixture.entityManager.getEntityInstance('actor1');
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
        expect(scopeItems).toContain('trumpet_1');
        expect(scopeItems).toContain('drum_1');
      });
    });
  });
});
