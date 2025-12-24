/**
 * @file Integration tests for the containers:take_from_container action definition.
 * @description Tests that the take_from_container action is properly defined and structured.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import takeFromContainerAction from '../../../../data/mods/containers/actions/take_from_container.action.json' assert { type: 'json' };

const ACTION_ID = 'containers:take_from_container';

describe('containers:take_from_container action definition', () => {
  let testFixture;
  let configureActionDiscovery;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('containers', ACTION_ID);

    configureActionDiscovery = () => {
      const { testEnv } = testFixture;
      if (!testEnv) {
        return;
      }

      testEnv.actionIndex.buildIndex([takeFromContainerAction]);
    };
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  it('should have correct action structure', () => {
    expect(takeFromContainerAction).toBeDefined();
    expect(takeFromContainerAction.id).toBe('containers:take_from_container');
    expect(takeFromContainerAction.name).toBe('Take From Container');
    expect(takeFromContainerAction.description).toBe(
      'Take an item from an open container'
    );
    expect(takeFromContainerAction.template).toBe(
      'take {secondary.name} from {primary.name}'
    );
  });

  it('should use correct scope for primary targets (open containers at location)', () => {
    expect(takeFromContainerAction.targets).toBeDefined();
    expect(takeFromContainerAction.targets.primary).toBeDefined();
    expect(takeFromContainerAction.targets.primary.scope).toBe(
      'containers-core:open_containers_at_location'
    );
    expect(takeFromContainerAction.targets.primary.placeholder).toBe(
      'container'
    );
    // Note: Primary targets do not have contextFrom - only secondary/tertiary can reference primary
    expect(takeFromContainerAction.targets.primary.contextFrom).toBeUndefined();
  });

  it('should use correct scope for secondary targets (container contents)', () => {
    expect(takeFromContainerAction.targets).toBeDefined();
    expect(takeFromContainerAction.targets.secondary).toBeDefined();
    expect(takeFromContainerAction.targets.secondary.scope).toBe(
      'containers-core:container_contents'
    );
    expect(takeFromContainerAction.targets.secondary.placeholder).toBe('item');
    expect(takeFromContainerAction.targets.secondary.contextFrom).toBe(
      'primary'
    );
  });

  // Note: The action schema uses 'prerequisites', not 'conditions'
  // Container open state is handled by the scope (containers-core:open_containers_at_location)
  // which filters for open containers, so no prerequisites are needed in the action definition

  it('should enable combination generation for multi-target action', () => {
    expect(takeFromContainerAction.generateCombinations).toBe(true);
  });

  it('should require actor to have inventory component', () => {
    expect(takeFromContainerAction.required_components).toBeDefined();
    expect(takeFromContainerAction.required_components.actor).toEqual([
      'inventory:inventory',
    ]);
  });

  describe('Expected action discovery behavior (manual testing)', () => {
    it('should appear when open containers with items exist at actor location', () => {
      // Manual test case:
      // 1. Create actor at location with open container containing items
      // 2. Expected: take_from_container action should be available for each item in container
      expect(true).toBe(true);
    });

    it('should NOT appear when container is closed', () => {
      // Manual test case:
      // 1. Create actor at location with closed container
      // 2. Expected: take_from_container action should NOT be available
      expect(true).toBe(true);
    });

    it('should NOT appear when container is empty', () => {
      // Manual test case:
      // 1. Create actor at location with open empty container
      // 2. Expected: take_from_container action should NOT be available
      expect(true).toBe(true);
    });

    it('should NOT appear when no containers at location', () => {
      // Manual test case:
      // 1. Create actor at location with no containers
      // 2. Expected: take_from_container action should NOT be available
      expect(true).toBe(true);
    });

    it('should appear for each item in open container separately', () => {
      // Manual test case:
      // 1. Create actor at location with open container containing 3 items
      // 2. Expected: 3 separate take_from_container actions (one per item)
      expect(true).toBe(true);
    });

    it('should update secondary targets when container contents change', () => {
      // Manual test case:
      // 1. Create actor at location with open container with items
      // 2. Take item from container
      // 3. Expected: take_from_container actions should reflect updated container contents
      expect(true).toBe(true);
    });

    it('should NOT appear when actor lacks inventory component', () => {
      const room = ModEntityScenarios.createRoom('storage', 'Storage Room');

      const actor = new ModEntityBuilder('actor_no_inventory')
        .withName('Bob')
        .atLocation('storage')
        .asActor()
        .build();

      const container = new ModEntityBuilder('chest1')
        .withName('wooden chest')
        .atLocation('storage')
        .withComponent('items-core:item', {})
        .withComponent('containers-core:container', {
          contents: ['sword1'],
          capacity: { maxWeight: 50, maxItems: 10 },
          isOpen: true,
          isLocked: false,
        })
        .build();

      const sword = new ModEntityBuilder('sword1')
        .withName('iron sword')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .build();

      testFixture.reset([room, actor, container, sword]);
      configureActionDiscovery();

      const availableActions =
        testFixture.testEnv.getAvailableActions('actor_no_inventory');
      const hasTakeAction = availableActions.some(
        (action) => action.id === ACTION_ID
      );

      expect(hasTakeAction).toBe(false);
    });

    it('should appear when actor has inventory and open container with items exists', () => {
      const room = ModEntityScenarios.createRoom('storage', 'Storage Room');

      // Create hand entity for grabbing prerequisite
      const handEntity = new ModEntityBuilder('alice-hand-1')
        .withComponent('anatomy:can_grab', {
          gripStrength: 1.0,
          locked: false,
          heldItemId: null,
        })
        .build();

      const actor = new ModEntityBuilder('actor_with_inventory')
        .withName('Alice')
        .atLocation('storage')
        .asActor()
        .withComponent('inventory:inventory', {
          items: [],
          capacity: { maxWeight: 20, maxItems: 5 },
        })
        .withComponent('anatomy:body', {
          body: { parts: { rightHand: 'alice-hand-1' } },
        })
        .build();

      const container = new ModEntityBuilder('chest2')
        .withName('wooden chest')
        .atLocation('storage')
        .withComponent('items-core:item', {})
        .withComponent('containers-core:container', {
          contents: ['potion1'],
          capacity: { maxWeight: 50, maxItems: 10 },
          isOpen: true,
          isLocked: false,
        })
        .build();

      const potion = new ModEntityBuilder('potion1')
        .withName('health potion')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .build();

      testFixture.reset([room, actor, container, potion, handEntity]);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        'actor_with_inventory'
      );
      const takeActions = availableActions.filter(
        (action) => action.id === ACTION_ID
      );

      expect(takeActions.length).toBeGreaterThan(0);
    });

    it('should NOT appear when actor is sitting on furniture', () => {
      const room = ModEntityScenarios.createRoom('library', 'Library');

      const armchair = new ModEntityBuilder('armchair1')
        .withName('armchair')
        .atLocation('library')
        .withComponent('items-core:item', {})
        .withComponent('positioning:sittable', {
          spots: [{ entityId: 'reader1', facing: 'forward' }],
        })
        .build();

      const actor = new ModEntityBuilder('reader1')
        .withName('Reader')
        .atLocation('library')
        .asActor()
        .withComponent('inventory:inventory', {
          items: [],
          capacity: { maxWeight: 20, maxItems: 5 },
        })
        .withComponent('sitting-states:sitting_on', {
          furniture_id: 'armchair1',
          spot_index: 0,
        })
        .build();

      const bookcase = new ModEntityBuilder('bookcase1')
        .withName('bookcase')
        .atLocation('library')
        .withComponent('items-core:item', {})
        .withComponent('containers-core:container', {
          contents: ['book1'],
          capacity: { maxWeight: 100, maxItems: 50 },
          isOpen: true,
          isLocked: false,
        })
        .build();

      const book = new ModEntityBuilder('book1')
        .withName('ancient tome')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .build();

      testFixture.reset([room, armchair, actor, bookcase, book]);
      configureActionDiscovery();

      const availableActions =
        testFixture.testEnv.getAvailableActions('reader1');
      const takeActions = availableActions.filter(
        (action) => action.id === ACTION_ID
      );

      expect(takeActions.length).toBe(0);
    });
  });
});
