/**
 * @file Integration tests for the writing:jot_down_notes action definition.
 * @description Tests that the jot_down_notes action is properly defined and discoverable.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import jotDownNotesAction from '../../../../data/mods/writing/actions/jot_down_notes.action.json' assert { type: 'json' };

describe('writing:jot_down_notes action definition', () => {
  let testFixture;
  let configureActionDiscovery;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'writing',
      'writing:jot_down_notes'
    );

    configureActionDiscovery = () => {
      const { testEnv } = testFixture;
      if (!testEnv) {
        return;
      }

      testEnv.actionIndex.buildIndex([jotDownNotesAction]);
    };
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  it('should have correct action structure', () => {
    expect(jotDownNotesAction).toBeDefined();
    expect(jotDownNotesAction.id).toBe('writing:jot_down_notes');
    expect(jotDownNotesAction.name).toBe('Jot Down Notes');
    expect(jotDownNotesAction.description).toBe(
      'Make notes in a notebook using a writing utensil.'
    );
    expect(jotDownNotesAction.template).toBe(
      'jot down notes on {notebook} using {utensil}'
    );
  });

  it('should use correct scope for primary targets (actor inventory)', () => {
    expect(jotDownNotesAction.targets).toBeDefined();
    expect(jotDownNotesAction.targets.primary).toBeDefined();
    expect(jotDownNotesAction.targets.primary.scope).toBe(
      'items:actor_inventory_items'
    );
    expect(jotDownNotesAction.targets.primary.placeholder).toBe('notebook');
    expect(jotDownNotesAction.targets.primary.description).toBe(
      'Notebook to write in'
    );
  });

  it('should use correct scope for secondary targets (writing utensil)', () => {
    expect(jotDownNotesAction.targets.secondary).toBeDefined();
    expect(jotDownNotesAction.targets.secondary.scope).toBe(
      'items:actor_inventory_items'
    );
    expect(jotDownNotesAction.targets.secondary.placeholder).toBe('utensil');
    expect(jotDownNotesAction.targets.secondary.description).toBe(
      'Writing utensil to use'
    );
  });

  it('should require item and readable components on primary target', () => {
    expect(jotDownNotesAction.required_components).toBeDefined();
    expect(jotDownNotesAction.required_components.primary).toBeDefined();
    expect(jotDownNotesAction.required_components.primary).toEqual([
      'items:item',
      'items:readable',
    ]);
  });

  it('should require item and allows_writing components on secondary target', () => {
    expect(jotDownNotesAction.required_components.secondary).toBeDefined();
    expect(jotDownNotesAction.required_components.secondary).toEqual([
      'items:item',
      'writing:allows_writing',
    ]);
  });

  it('should forbid action during complex performances', () => {
    expect(jotDownNotesAction.forbidden_components).toBeDefined();
    expect(jotDownNotesAction.forbidden_components.actor).toBeDefined();
    expect(jotDownNotesAction.forbidden_components.actor).toEqual([
      'positioning:doing_complex_performance',
      'physical-control-states:restraining',
    ]);
  });

  it('should have lighting prerequisites', () => {
    expect(jotDownNotesAction.prerequisites).toBeDefined();
    expect(Array.isArray(jotDownNotesAction.prerequisites)).toBe(true);
    expect(jotDownNotesAction.prerequisites).toHaveLength(1);
    expect(jotDownNotesAction.prerequisites[0].logic).toEqual({
      isActorLocationLit: ['actor'],
    });
    expect(jotDownNotesAction.prerequisites[0].failure_message).toBe(
      'It is too dark to write.'
    );
  });

  it('should have correct visual styling (Scribe\'s Ink scheme)', () => {
    expect(jotDownNotesAction.visual).toBeDefined();
    expect(jotDownNotesAction.visual.backgroundColor).toBe('#1c2833');
    expect(jotDownNotesAction.visual.textColor).toBe('#f5ecd7');
    expect(jotDownNotesAction.visual.hoverBackgroundColor).toBe('#273746');
    expect(jotDownNotesAction.visual.hoverTextColor).toBe('#faf6eb');
  });

  describe('Action discovery behavior', () => {
    it('should appear when readable notebook and writing utensil exist in actor inventory', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Office');

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .withComponent('items:inventory', {
          items: ['notebook_1', 'pencil_1'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const notebook = new ModEntityBuilder('notebook_1')
        .withName('Field Notebook')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('items:readable', {
          text: 'Patrol observation notes.',
        })
        .build();

      const pencil = new ModEntityBuilder('pencil_1')
        .withName('pencil')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('writing:allows_writing', {})
        .build();

      testFixture.reset([room, actor, notebook, pencil]);
      configureActionDiscovery();

      const discoveredActions = testFixture.discoverActions('actor1');
      const jotNotesActions = discoveredActions.filter(
        (action) => action.id === 'writing:jot_down_notes'
      );

      expect(jotNotesActions.length).toBeGreaterThan(0);

      const actorInstance =
        testFixture.entityManager.getEntityInstance('actor1');
      const scopeContext = {
        actor: {
          id: 'actor1',
          components: actorInstance.components,
        },
      };

      const scopeResult = testFixture.testEnv.unifiedScopeResolver.resolveSync(
        'items:actor_inventory_items',
        scopeContext
      );

      expect(scopeResult.success).toBe(true);
      expect(Array.from(scopeResult.value)).toContain('notebook_1');
      expect(Array.from(scopeResult.value)).toContain('pencil_1');
    });

    it('should appear for any readable item with a writing utensil in inventory', () => {
      const room = ModEntityScenarios.createRoom('room2', 'Library');

      const actor = new ModEntityBuilder('actor2')
        .withName('Bob')
        .atLocation('room2')
        .asActor()
        .withComponent('items:inventory', {
          items: ['book_1', 'quill_1'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const book = new ModEntityBuilder('book_1')
        .withName('Old Journal')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('items:readable', {
          text: 'Journal entries.',
        })
        .build();

      const quill = new ModEntityBuilder('quill_1')
        .withName('quill')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('writing:allows_writing', {})
        .build();

      testFixture.reset([room, actor, book, quill]);
      configureActionDiscovery();

      const discoveredActions = testFixture.discoverActions('actor2');
      const jotNotesActions = discoveredActions.filter(
        (action) => action.id === 'writing:jot_down_notes'
      );

      expect(jotNotesActions.length).toBeGreaterThan(0);
    });

    it('should NOT appear when readable item is at location (not in inventory)', () => {
      const room = ModEntityScenarios.createRoom('room3', 'Station');

      const actor = new ModEntityBuilder('actor3')
        .withName('Charlie')
        .atLocation('room3')
        .asActor()
        .withComponent('items:inventory', {
          items: ['pencil_2'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const notebook = new ModEntityBuilder('notebook_2')
        .withName('Field Notebook')
        .atLocation('room3')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('items:readable', {
          text: 'Notes on the table.',
        })
        .build();

      const pencil = new ModEntityBuilder('pencil_2')
        .withName('pencil')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('writing:allows_writing', {})
        .build();

      testFixture.reset([room, actor, notebook, pencil]);
      configureActionDiscovery();

      const discoveredActions = testFixture.discoverActions('actor3');
      const jotNotesActions = discoveredActions.filter(
        (action) => action.id === 'writing:jot_down_notes'
      );

      // Action should not be available (notebook must be in inventory)
      expect(jotNotesActions.length).toBe(0);
    });

    it('should NOT appear when no writing utensil is available', () => {
      const room = ModEntityScenarios.createRoom('room7', 'Cabin');

      const actor = new ModEntityBuilder('actor7')
        .withName('Grace')
        .atLocation('room7')
        .asActor()
        .withComponent('items:inventory', {
          items: ['notebook_5'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const notebook = new ModEntityBuilder('notebook_5')
        .withName('Field Notebook')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('items:readable', {
          text: 'Some notes.',
        })
        .build();

      testFixture.reset([room, actor, notebook]);
      configureActionDiscovery();

      const discoveredActions = testFixture.discoverActions('actor7');
      const jotNotesActions = discoveredActions.filter(
        (action) => action.id === 'writing:jot_down_notes'
      );

      // Action should not be available (no writing utensil)
      expect(jotNotesActions.length).toBe(0);
    });

    it('should NOT appear when actor is performing complex action', () => {
      const room = ModEntityScenarios.createRoom('room4', 'Stage');

      const actor = new ModEntityBuilder('actor4')
        .withName('Diana')
        .atLocation('room4')
        .asActor()
        .withComponent('items:inventory', {
          items: ['notebook_3', 'pencil_3'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .withComponent('positioning:doing_complex_performance', {})
        .build();

      const notebook = new ModEntityBuilder('notebook_3')
        .withName('Script Notes')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('items:readable', {
          text: 'Performance script.',
        })
        .build();

      const pencil = new ModEntityBuilder('pencil_3')
        .withName('pencil')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('writing:allows_writing', {})
        .build();

      testFixture.reset([room, actor, notebook, pencil]);
      configureActionDiscovery();

      const discoveredActions = testFixture.discoverActions('actor4');
      const jotNotesActions = discoveredActions.filter(
        (action) => action.id === 'writing:jot_down_notes'
      );

      // Action should not be available (actor is performing complex action)
      expect(jotNotesActions.length).toBe(0);
    });

    it('should NOT appear when item lacks readable component', () => {
      const room = ModEntityScenarios.createRoom('room5', 'Armory');

      const actor = new ModEntityBuilder('actor5')
        .withName('Eve')
        .atLocation('room5')
        .asActor()
        .withComponent('items:inventory', {
          items: ['sword_1', 'pencil_4'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const sword = new ModEntityBuilder('sword_1')
        .withName('Steel Sword')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .build();

      const pencil = new ModEntityBuilder('pencil_4')
        .withName('pencil')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('writing:allows_writing', {})
        .build();

      testFixture.reset([room, actor, sword, pencil]);
      configureActionDiscovery();

      const discoveredActions = testFixture.discoverActions('actor5');
      const jotNotesActions = discoveredActions.filter(
        (action) => action.id === 'writing:jot_down_notes'
      );

      // Action should not be available (sword is not readable)
      expect(jotNotesActions.length).toBe(0);
    });

    it('should appear when actor has multiple readable items and writing utensils', () => {
      const room = ModEntityScenarios.createRoom('room6', 'Study');

      const actor = new ModEntityBuilder('actor6')
        .withName('Frank')
        .atLocation('room6')
        .asActor()
        .withComponent('items:inventory', {
          items: ['notebook_4', 'journal_1', 'diary_1', 'pencil_5', 'quill_2'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const notebook = new ModEntityBuilder('notebook_4')
        .withName('Notebook')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('items:readable', { text: 'Notes.' })
        .build();

      const journal = new ModEntityBuilder('journal_1')
        .withName('Journal')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('items:readable', { text: 'Journal entries.' })
        .build();

      const diary = new ModEntityBuilder('diary_1')
        .withName('Diary')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('items:readable', { text: 'Personal diary.' })
        .build();

      const pencil = new ModEntityBuilder('pencil_5')
        .withName('pencil')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('writing:allows_writing', {})
        .build();

      const quill = new ModEntityBuilder('quill_2')
        .withName('quill')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('writing:allows_writing', {})
        .build();

      testFixture.reset([room, actor, notebook, journal, diary, pencil, quill]);
      configureActionDiscovery();

      const discoveredActions = testFixture.discoverActions('actor6');
      const jotNotesActions = discoveredActions.filter(
        (action) => action.id === 'writing:jot_down_notes'
      );

      // Action should be available with multiple target options
      expect(jotNotesActions.length).toBeGreaterThan(0);

      const actorInstance =
        testFixture.entityManager.getEntityInstance('actor6');
      const scopeContext = {
        actor: {
          id: 'actor6',
          components: actorInstance.components,
        },
      };

      const scopeResult = testFixture.testEnv.unifiedScopeResolver.resolveSync(
        'items:actor_inventory_items',
        scopeContext
      );

      expect(scopeResult.success).toBe(true);
      const resolvedItems = Array.from(scopeResult.value);
      expect(resolvedItems).toContain('notebook_4');
      expect(resolvedItems).toContain('journal_1');
      expect(resolvedItems).toContain('diary_1');
      expect(resolvedItems).toContain('pencil_5');
      expect(resolvedItems).toContain('quill_2');
      expect(resolvedItems).toHaveLength(5);
    });
  });
});
