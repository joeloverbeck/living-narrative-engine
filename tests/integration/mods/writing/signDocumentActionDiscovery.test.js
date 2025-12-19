/**
 * @file Integration tests for the writing:sign_document action definition.
 * @description Tests that the sign_document action is properly defined and discoverable.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import signDocumentAction from '../../../../data/mods/writing/actions/sign_document.action.json' assert { type: 'json' };

describe('writing:sign_document action definition', () => {
  let testFixture;
  let configureActionDiscovery;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'writing',
      'writing:sign_document'
    );

    configureActionDiscovery = () => {
      const { testEnv } = testFixture;
      if (!testEnv) {
        return;
      }

      testEnv.actionIndex.buildIndex([signDocumentAction]);
    };
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  it('should have correct action structure', () => {
    expect(signDocumentAction).toBeDefined();
    expect(signDocumentAction.id).toBe('writing:sign_document');
    expect(signDocumentAction.name).toBe('Sign Document');
    expect(signDocumentAction.description).toBe(
      'Sign a document using a writing utensil.'
    );
    expect(signDocumentAction.template).toBe(
      'sign {document} using {utensil}'
    );
  });

  it('should use correct scope for primary targets (actor inventory)', () => {
    expect(signDocumentAction.targets).toBeDefined();
    expect(signDocumentAction.targets.primary).toBeDefined();
    expect(signDocumentAction.targets.primary.scope).toBe(
      'items:actor_inventory_items'
    );
    expect(signDocumentAction.targets.primary.placeholder).toBe('document');
    expect(signDocumentAction.targets.primary.description).toBe(
      'Document to sign'
    );
  });

  it('should use correct scope for secondary targets (writing utensil)', () => {
    expect(signDocumentAction.targets.secondary).toBeDefined();
    expect(signDocumentAction.targets.secondary.scope).toBe(
      'items:actor_inventory_items'
    );
    expect(signDocumentAction.targets.secondary.placeholder).toBe('utensil');
    expect(signDocumentAction.targets.secondary.description).toBe(
      'Writing utensil to use'
    );
  });

  it('should require item and signable components on primary target', () => {
    expect(signDocumentAction.required_components).toBeDefined();
    expect(signDocumentAction.required_components.primary).toBeDefined();
    expect(signDocumentAction.required_components.primary).toEqual([
      'items:item',
      'writing:signable',
    ]);
  });

  it('should require item and allows_writing components on secondary target', () => {
    expect(signDocumentAction.required_components.secondary).toBeDefined();
    expect(signDocumentAction.required_components.secondary).toEqual([
      'items:item',
      'writing:allows_writing',
    ]);
  });

  it('should forbid action during complex performances', () => {
    expect(signDocumentAction.forbidden_components).toBeDefined();
    expect(signDocumentAction.forbidden_components.actor).toBeDefined();
    expect(signDocumentAction.forbidden_components.actor).toEqual([
      'positioning:doing_complex_performance',
      'physical-control-states:restraining',
    ]);
  });

  it('should have empty prerequisites array', () => {
    expect(signDocumentAction.prerequisites).toBeDefined();
    expect(Array.isArray(signDocumentAction.prerequisites)).toBe(true);
    expect(signDocumentAction.prerequisites).toEqual([]);
  });

  it("should have correct visual styling (Scribe's Ink scheme)", () => {
    expect(signDocumentAction.visual).toBeDefined();
    expect(signDocumentAction.visual.backgroundColor).toBe('#1c2833');
    expect(signDocumentAction.visual.textColor).toBe('#f5ecd7');
    expect(signDocumentAction.visual.hoverBackgroundColor).toBe('#273746');
    expect(signDocumentAction.visual.hoverTextColor).toBe('#faf6eb');
  });

  describe('Action discovery behavior', () => {
    it('should appear when signable document and writing utensil exist in actor inventory', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Office');

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .withComponent('items:inventory', {
          items: ['contract_1', 'pencil_1'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const contract = new ModEntityBuilder('contract_1')
        .withName('Employment Contract')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('writing:signable', {})
        .build();

      const pencil = new ModEntityBuilder('pencil_1')
        .withName('pencil')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('writing:allows_writing', {})
        .build();

      testFixture.reset([room, actor, contract, pencil]);
      configureActionDiscovery();

      const discoveredActions = testFixture.discoverActions('actor1');
      const signDocumentActions = discoveredActions.filter(
        (action) => action.id === 'writing:sign_document'
      );

      expect(signDocumentActions.length).toBeGreaterThan(0);

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
      expect(Array.from(scopeResult.value)).toContain('contract_1');
      expect(Array.from(scopeResult.value)).toContain('pencil_1');
    });

    it('should appear for any signable item with a writing utensil in inventory', () => {
      const room = ModEntityScenarios.createRoom('room2', 'Library');

      const actor = new ModEntityBuilder('actor2')
        .withName('Bob')
        .atLocation('room2')
        .asActor()
        .withComponent('items:inventory', {
          items: ['letter_1', 'quill_1'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const letter = new ModEntityBuilder('letter_1')
        .withName('Official Letter')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('writing:signable', {})
        .build();

      const quill = new ModEntityBuilder('quill_1')
        .withName('quill')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('writing:allows_writing', {})
        .build();

      testFixture.reset([room, actor, letter, quill]);
      configureActionDiscovery();

      const discoveredActions = testFixture.discoverActions('actor2');
      const signDocumentActions = discoveredActions.filter(
        (action) => action.id === 'writing:sign_document'
      );

      expect(signDocumentActions.length).toBeGreaterThan(0);
    });

    it('should NOT appear when document is at location (not in inventory)', () => {
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

      const contract = new ModEntityBuilder('contract_2')
        .withName('Employment Contract')
        .atLocation('room3')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('writing:signable', {})
        .build();

      const pencil = new ModEntityBuilder('pencil_2')
        .withName('pencil')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('writing:allows_writing', {})
        .build();

      testFixture.reset([room, actor, contract, pencil]);
      configureActionDiscovery();

      const discoveredActions = testFixture.discoverActions('actor3');
      const signDocumentActions = discoveredActions.filter(
        (action) => action.id === 'writing:sign_document'
      );

      // Action should not be available (document must be in inventory)
      expect(signDocumentActions.length).toBe(0);
    });

    it('should NOT appear when no writing utensil is available', () => {
      const room = ModEntityScenarios.createRoom('room7', 'Cabin');

      const actor = new ModEntityBuilder('actor7')
        .withName('Grace')
        .atLocation('room7')
        .asActor()
        .withComponent('items:inventory', {
          items: ['contract_5'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const contract = new ModEntityBuilder('contract_5')
        .withName('Employment Contract')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('writing:signable', {})
        .build();

      testFixture.reset([room, actor, contract]);
      configureActionDiscovery();

      const discoveredActions = testFixture.discoverActions('actor7');
      const signDocumentActions = discoveredActions.filter(
        (action) => action.id === 'writing:sign_document'
      );

      // Action should not be available (no writing utensil)
      expect(signDocumentActions.length).toBe(0);
    });

    it('should NOT appear when actor is performing complex action', () => {
      const room = ModEntityScenarios.createRoom('room4', 'Stage');

      const actor = new ModEntityBuilder('actor4')
        .withName('Diana')
        .atLocation('room4')
        .asActor()
        .withComponent('items:inventory', {
          items: ['contract_3', 'pencil_3'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .withComponent('positioning:doing_complex_performance', {})
        .build();

      const contract = new ModEntityBuilder('contract_3')
        .withName('Script Contract')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('writing:signable', {})
        .build();

      const pencil = new ModEntityBuilder('pencil_3')
        .withName('pencil')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('writing:allows_writing', {})
        .build();

      testFixture.reset([room, actor, contract, pencil]);
      configureActionDiscovery();

      const discoveredActions = testFixture.discoverActions('actor4');
      const signDocumentActions = discoveredActions.filter(
        (action) => action.id === 'writing:sign_document'
      );

      // Action should not be available (actor is performing complex action)
      expect(signDocumentActions.length).toBe(0);
    });

    it('should NOT appear when item lacks signable component', () => {
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
      const signDocumentActions = discoveredActions.filter(
        (action) => action.id === 'writing:sign_document'
      );

      // Action should not be available (sword is not signable)
      expect(signDocumentActions.length).toBe(0);
    });

    it('should appear when actor has multiple signable documents and writing utensils', () => {
      const room = ModEntityScenarios.createRoom('room6', 'Study');

      const actor = new ModEntityBuilder('actor6')
        .withName('Frank')
        .atLocation('room6')
        .asActor()
        .withComponent('items:inventory', {
          items: [
            'contract_4',
            'letter_2',
            'deed_1',
            'pencil_5',
            'quill_2',
          ],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const contract = new ModEntityBuilder('contract_4')
        .withName('Contract')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('writing:signable', {})
        .build();

      const letter = new ModEntityBuilder('letter_2')
        .withName('Letter')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('writing:signable', {})
        .build();

      const deed = new ModEntityBuilder('deed_1')
        .withName('Deed')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('writing:signable', {})
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

      testFixture.reset([room, actor, contract, letter, deed, pencil, quill]);
      configureActionDiscovery();

      const discoveredActions = testFixture.discoverActions('actor6');
      const signDocumentActions = discoveredActions.filter(
        (action) => action.id === 'writing:sign_document'
      );

      // Action should be available with multiple target options
      expect(signDocumentActions.length).toBeGreaterThan(0);

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
      expect(resolvedItems).toContain('contract_4');
      expect(resolvedItems).toContain('letter_2');
      expect(resolvedItems).toContain('deed_1');
      expect(resolvedItems).toContain('pencil_5');
      expect(resolvedItems).toContain('quill_2');
      expect(resolvedItems).toHaveLength(5);
    });
  });
});
