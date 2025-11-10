/**
 * @file Integration tests for the items:jot_down_notes action definition.
 * @description Tests that the jot_down_notes action is properly defined and discoverable.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import jotDownNotesAction from '../../../../data/mods/items/actions/jot_down_notes.action.json' assert { type: 'json' };

describe('items:jot_down_notes action definition', () => {
  let testFixture;
  let configureActionDiscovery;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('items', 'items:jot_down_notes');

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
    expect(jotDownNotesAction.id).toBe('items:jot_down_notes');
    expect(jotDownNotesAction.name).toBe('Jot Down Notes');
    expect(jotDownNotesAction.description).toBe('Make notes in a notebook.');
    expect(jotDownNotesAction.template).toBe('jot down notes on {notebook}');
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

  it('should require item and readable components on primary target', () => {
    expect(jotDownNotesAction.required_components).toBeDefined();
    expect(jotDownNotesAction.required_components.primary).toBeDefined();
    expect(jotDownNotesAction.required_components.primary).toEqual([
      'items:item',
      'items:readable',
    ]);
  });

  it('should forbid action during complex performances', () => {
    expect(jotDownNotesAction.forbidden_components).toBeDefined();
    expect(jotDownNotesAction.forbidden_components.actor).toBeDefined();
    expect(jotDownNotesAction.forbidden_components.actor).toEqual([
      'positioning:doing_complex_performance',
    ]);
  });

  it('should have empty prerequisites array', () => {
    expect(jotDownNotesAction.prerequisites).toBeDefined();
    expect(Array.isArray(jotDownNotesAction.prerequisites)).toBe(true);
    expect(jotDownNotesAction.prerequisites).toEqual([]);
  });

  it('should have correct visual styling', () => {
    expect(jotDownNotesAction.visual).toBeDefined();
    expect(jotDownNotesAction.visual.backgroundColor).toBe('#2d3436');
    expect(jotDownNotesAction.visual.textColor).toBe('#dfe6e9');
    expect(jotDownNotesAction.visual.hoverBackgroundColor).toBe('#636e72');
    expect(jotDownNotesAction.visual.hoverTextColor).toBe('#ffffff');
  });

  describe('Action discovery behavior', () => {
    it('should appear when readable notebook exists in actor inventory', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Office');

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .withComponent('items:inventory', {
          items: ['notebook_1'],
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

      testFixture.reset([room, actor, notebook]);
      configureActionDiscovery();

      const discoveredActions = testFixture.discoverActions('actor1');
      const jotNotesActions = discoveredActions.filter(
        (action) => action.id === 'items:jot_down_notes'
      );

      expect(jotNotesActions.length).toBeGreaterThan(0);

      const actorInstance = testFixture.entityManager.getEntityInstance('actor1');
      const scopeContext = {
        actor: {
          id: 'actor1',
          components: actorInstance.components,
        },
      };

      const scopeResult =
        testFixture.testEnv.unifiedScopeResolver.resolveSync(
          'items:actor_inventory_items',
          scopeContext
        );

      expect(scopeResult.success).toBe(true);
      expect(Array.from(scopeResult.value)).toEqual(['notebook_1']);
    });

    it('should appear for any readable item in inventory', () => {
      const room = ModEntityScenarios.createRoom('room2', 'Library');

      const actor = new ModEntityBuilder('actor2')
        .withName('Bob')
        .atLocation('room2')
        .asActor()
        .withComponent('items:inventory', {
          items: ['book_1'],
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

      testFixture.reset([room, actor, book]);
      configureActionDiscovery();

      const discoveredActions = testFixture.discoverActions('actor2');
      const jotNotesActions = discoveredActions.filter(
        (action) => action.id === 'items:jot_down_notes'
      );

      expect(jotNotesActions.length).toBeGreaterThan(0);
    });

    it('should NOT appear when item is at location (not in inventory)', () => {
      const room = ModEntityScenarios.createRoom('room3', 'Station');

      const actor = new ModEntityBuilder('actor3')
        .withName('Charlie')
        .atLocation('room3')
        .asActor()
        .withComponent('items:inventory', {
          items: [],
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

      testFixture.reset([room, actor, notebook]);
      configureActionDiscovery();

      const discoveredActions = testFixture.discoverActions('actor3');
      const jotNotesActions = discoveredActions.filter(
        (action) => action.id === 'items:jot_down_notes'
      );

      // Action should not be available (notebook must be in inventory)
      expect(jotNotesActions.length).toBe(0);
    });

    it('should NOT appear when actor is performing complex action', () => {
      const room = ModEntityScenarios.createRoom('room4', 'Stage');

      const actor = new ModEntityBuilder('actor4')
        .withName('Diana')
        .atLocation('room4')
        .asActor()
        .withComponent('items:inventory', {
          items: ['notebook_3'],
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

      testFixture.reset([room, actor, notebook]);
      configureActionDiscovery();

      const discoveredActions = testFixture.discoverActions('actor4');
      const jotNotesActions = discoveredActions.filter(
        (action) => action.id === 'items:jot_down_notes'
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
          items: ['sword_1'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const sword = new ModEntityBuilder('sword_1')
        .withName('Steel Sword')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .build();

      testFixture.reset([room, actor, sword]);
      configureActionDiscovery();

      const discoveredActions = testFixture.discoverActions('actor5');
      const jotNotesActions = discoveredActions.filter(
        (action) => action.id === 'items:jot_down_notes'
      );

      // Action should not be available (sword is not readable)
      expect(jotNotesActions.length).toBe(0);
    });

    it('should appear when actor has multiple readable items', () => {
      const room = ModEntityScenarios.createRoom('room6', 'Study');

      const actor = new ModEntityBuilder('actor6')
        .withName('Frank')
        .atLocation('room6')
        .asActor()
        .withComponent('items:inventory', {
          items: ['notebook_4', 'journal_1', 'diary_1'],
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

      testFixture.reset([room, actor, notebook, journal, diary]);
      configureActionDiscovery();

      const discoveredActions = testFixture.discoverActions('actor6');
      const jotNotesActions = discoveredActions.filter(
        (action) => action.id === 'items:jot_down_notes'
      );

      // Action should be available with multiple target options
      expect(jotNotesActions.length).toBeGreaterThan(0);

      const actorInstance = testFixture.entityManager.getEntityInstance('actor6');
      const scopeContext = {
        actor: {
          id: 'actor6',
          components: actorInstance.components,
        },
      };

      const scopeResult =
        testFixture.testEnv.unifiedScopeResolver.resolveSync(
          'items:actor_inventory_items',
          scopeContext
        );

      expect(scopeResult.success).toBe(true);
      const resolvedItems = Array.from(scopeResult.value);
      expect(resolvedItems).toContain('notebook_4');
      expect(resolvedItems).toContain('journal_1');
      expect(resolvedItems).toContain('diary_1');
      expect(resolvedItems).toHaveLength(3);
    });
  });
});
