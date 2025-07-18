/**
 * @file Test data factory for action system tests
 * @description Provides centralized test data creation for action tests
 */

/**
 * Factory for creating test data used in action system tests
 *
 * Provides methods to create:
 * - Action definitions for various test scenarios
 * - Condition definitions for prerequisite testing
 * - Scope definitions with pre-parsed ASTs
 * - World configurations and actor setups
 * - Edge case and error scenario data
 */
export class TestDataFactory {
  /**
   * Creates basic action definitions for common test scenarios
   *
   * @returns {Array} Array of basic action definitions
   */
  static createBasicActions() {
    return [
      {
        id: 'core:wait',
        name: 'Wait',
        description: 'Wait for a moment, doing nothing.',
        scope: 'none',
        template: 'wait',
        prerequisites: [],
        required_components: {
          actor: [],
        },
      },
      {
        id: 'core:go',
        name: 'Go',
        description: 'Move to a different location.',
        scope: 'core:clear_directions',
        template: 'go to {target}',
        prerequisites: ['core:actor-can-move'],
        required_components: {
          actor: ['core:position'],
        },
      },
      {
        id: 'core:follow',
        name: 'Follow',
        description: 'Follow another actor.',
        scope: 'core:other_actors',
        template: 'follow {target}',
        prerequisites: ['core:actor-can-move'],
        required_components: {
          actor: ['core:following', 'core:position'],
        },
      },
      {
        id: 'core:attack',
        name: 'Attack',
        description: 'Attack a target.',
        scope: 'core:nearby_actors',
        template: 'attack {target}',
        prerequisites: ['core:actor-can-move', 'core:has-health'],
        required_components: {
          actor: ['core:position', 'core:health'],
        },
      },
    ];
  }

  /**
   * Creates comprehensive action definitions including complex scenarios
   *
   * @returns {Array} Array of comprehensive action definitions
   */
  static createComprehensiveActions() {
    return [
      ...TestDataFactory.createBasicActions(),
      {
        id: 'core:examine',
        name: 'Examine',
        description: 'Examine an object or location.',
        scope: 'core:examinable_objects',
        template: 'examine {target}',
        prerequisites: [],
        required_components: {
          actor: [],
        },
      },
      {
        id: 'core:take',
        name: 'Take',
        description: 'Take an item from the environment.',
        scope: 'core:takeable_items',
        template: 'take {target}',
        prerequisites: ['core:actor-can-move'],
        required_components: {
          actor: ['core:inventory', 'core:position'],
        },
      },
      {
        id: 'core:use',
        name: 'Use',
        description: 'Use an item from inventory.',
        scope: 'core:inventory_items',
        template: 'use {target}',
        prerequisites: [],
        required_components: {
          actor: ['core:inventory'],
        },
      },
    ];
  }

  /**
   * Creates test conditions for prerequisite evaluation
   *
   * @returns {Array} Array of condition definitions
   */
  static createTestConditions() {
    return [
      {
        id: 'core:actor-can-move',
        description:
          'Checks if the actor has functioning legs capable of movement',
        logic: {
          '==': [{ var: 'actor.core:movement.locked' }, false],
        },
      },
      {
        id: 'core:exit-is-unblocked',
        description: 'Checks if an exit is unblocked',
        logic: {
          '==': [{ var: 'blocked' }, false],
        },
      },
      {
        id: 'core:has-health',
        description: 'Checks if the actor has health component',
        logic: {
          has: [{ var: 'actor' }, 'core:health'],
        },
      },
      {
        id: 'core:has-inventory',
        description: 'Checks if the actor has inventory component',
        logic: {
          has: [{ var: 'actor' }, 'core:inventory'],
        },
      },
      {
        id: 'core:location-has-exits',
        description: 'Checks if the location has any exits',
        logic: {
          '!=': [{ var: 'location.core:exits' }, null],
        },
      },
    ];
  }

  /**
   * Creates scope definitions with expressions and fallback ASTs
   *
   * @returns {Array} Array of scope definition objects
   */
  static createScopeDefinitions() {
    return [
      {
        id: 'core:clear_directions',
        expr: 'location.core:exits[{"condition_ref": "core:exit-is-unblocked"}].target',
        description:
          'Available exits from current location that are not blocked',
        fallbackAst: { type: 'Source', kind: 'location' },
      },
      {
        id: 'core:other_actors',
        expr: 'entities(core:actor)[{ var: "id", neq: { var: "actor.id" } }]',
        description: 'Other actors in the game (excluding the current actor)',
        fallbackAst: { type: 'Source', kind: 'entities', param: 'core:actor' },
      },
      {
        id: 'core:nearby_actors',
        expr: 'entities(core:actor)[{ var: "core:position.locationId", eq: { var: "actor.core:position.locationId" } }][{ var: "id", neq: { var: "actor.id" } }]',
        description: 'Other actors in the same location',
        fallbackAst: { type: 'Source', kind: 'entities', param: 'core:actor' },
      },
      {
        id: 'core:examinable_objects',
        expr: 'entities(core:object)[{ var: "core:position.locationId", eq: { var: "actor.core:position.locationId" } }]',
        description: 'Objects in the current location that can be examined',
        fallbackAst: { type: 'Source', kind: 'entities', param: 'core:object' },
      },
      {
        id: 'core:takeable_items',
        expr: 'entities(core:item)[{ var: "core:position.locationId", eq: { var: "actor.core:position.locationId" } }][{ var: "core:takeable", eq: true }]',
        description: 'Items in the current location that can be taken',
        fallbackAst: { type: 'Source', kind: 'entities', param: 'core:item' },
      },
      {
        id: 'core:inventory_items',
        expr: 'actor.core:inventory.items',
        description: "Items in the actor's inventory",
        fallbackAst: { type: 'Source', kind: 'actor' },
      },
    ];
  }

  /**
   * Creates test world configuration with connected locations
   *
   * @returns {object} World configuration object
   */
  static createTestWorld() {
    return {
      locations: [
        {
          id: 'test-location-1',
          name: 'Test Room 1',
          description: 'First test room',
          components: {
            'core:name': { name: 'Test Room 1' },
            'core:description': { description: 'First test room' },
            'core:position': { x: 0, y: 0, z: 0 },
            'core:exits': {
              north: { target: 'test-location-2', blocked: false },
              south: { target: null, blocked: false },
              east: { target: null, blocked: false },
              west: { target: null, blocked: false },
            },
          },
        },
        {
          id: 'test-location-2',
          name: 'Test Room 2',
          description: 'Second test room',
          components: {
            'core:name': { name: 'Test Room 2' },
            'core:description': { description: 'Second test room' },
            'core:position': { x: 1, y: 0, z: 0 },
            'core:exits': {
              north: { target: null, blocked: false },
              south: { target: 'test-location-1', blocked: false },
              east: { target: 'test-location-3', blocked: false },
              west: { target: null, blocked: false },
            },
          },
        },
        {
          id: 'test-location-3',
          name: 'Test Room 3',
          description: 'Third test room',
          components: {
            'core:name': { name: 'Test Room 3' },
            'core:description': { description: 'Third test room' },
            'core:position': { x: 2, y: 0, z: 0 },
            'core:exits': {
              north: { target: null, blocked: false },
              south: { target: null, blocked: false },
              east: { target: null, blocked: false },
              west: { target: 'test-location-2', blocked: false },
            },
          },
        },
      ],
      objects: [
        {
          id: 'test-object-1',
          name: 'Test Object',
          description: 'A test object for examination',
          components: {
            'core:name': { name: 'Test Object' },
            'core:description': {
              description: 'A test object for examination',
            },
            'core:position': { locationId: 'test-location-1' },
            'core:object': { examinable: true },
          },
        },
      ],
      items: [
        {
          id: 'test-item-1',
          name: 'Test Item',
          description: 'A test item that can be taken',
          components: {
            'core:name': { name: 'Test Item' },
            'core:description': {
              description: 'A test item that can be taken',
            },
            'core:position': { locationId: 'test-location-1' },
            'core:item': { takeable: true },
          },
        },
      ],
    };
  }

  /**
   * Creates test actor configurations
   *
   * @returns {object} Actor configuration object
   */
  static createTestActorConfigs() {
    return {
      // Standard player actor with full component set
      player: {
        id: 'test-player',
        components: {
          'core:name': { name: 'Test Player' },
          'core:position': { locationId: 'test-location-1' },
          'core:actor': { isPlayer: true },
          'core:movement': { locked: false },
          'core:following': { targetId: null },
          'core:health': { current: 100, max: 100 },
          'core:inventory': { items: [] },
        },
      },
      // NPC with limited components
      npc: {
        id: 'test-npc',
        components: {
          'core:name': { name: 'Test NPC' },
          'core:position': { locationId: 'test-location-1' },
          'core:actor': { isPlayer: false },
          'core:movement': { locked: false },
          'core:health': { current: 80, max: 100 },
        },
      },
      // Actor with movement locked (for testing prerequisites)
      lockedActor: {
        id: 'test-locked-actor',
        components: {
          'core:name': { name: 'Locked Actor' },
          'core:position': { locationId: 'test-location-2' },
          'core:actor': { isPlayer: false },
          'core:movement': { locked: true },
        },
      },
      // Actor without required components (for testing filtering)
      minimalActor: {
        id: 'test-minimal-actor',
        components: {
          'core:name': { name: 'Minimal Actor' },
          'core:actor': { isPlayer: false },
        },
      },
      // Actor with inventory
      inventoryActor: {
        id: 'test-inventory-actor',
        components: {
          'core:name': { name: 'Inventory Actor' },
          'core:position': { locationId: 'test-location-1' },
          'core:actor': { isPlayer: false },
          'core:inventory': { items: ['test-item-1'] },
        },
      },
    };
  }

  /**
   * Creates actions for edge case testing
   *
   * @returns {Array} Array of edge case action definitions
   */
  static createEdgeCaseActions() {
    return [
      {
        id: 'test:always-fail',
        name: 'Always Fail',
        description: 'Action that always fails prerequisites',
        scope: 'none',
        template: 'fail',
        prerequisites: ['test:always-false'],
        required_components: {
          actor: [],
        },
      },
      {
        id: 'test:missing-scope',
        name: 'Missing Scope',
        description: 'Action with non-existent scope',
        scope: 'test:non-existent-scope',
        template: 'missing scope',
        prerequisites: [],
        required_components: {
          actor: [],
        },
      },
      {
        id: 'test:missing-prerequisites',
        name: 'Missing Prerequisites',
        description: 'Action with non-existent prerequisites',
        scope: 'none',
        template: 'missing prereq',
        prerequisites: ['test:does-not-exist'],
        required_components: {
          actor: [],
        },
      },
      {
        id: 'test:complex-requirements',
        name: 'Complex Requirements',
        description: 'Action with complex component requirements',
        scope: 'core:other_actors',
        template: 'complex {target}',
        prerequisites: [
          'core:actor-can-move',
          'core:has-health',
          'core:has-inventory',
        ],
        required_components: {
          actor: [
            'core:position',
            'core:health',
            'core:inventory',
            'core:movement',
          ],
        },
      },
    ];
  }

  /**
   * Creates conditions for edge case testing
   *
   * @returns {Array} Array of edge case condition definitions
   */
  static createEdgeCaseConditions() {
    return [
      {
        id: 'test:always-true',
        description: 'Always returns true',
        logic: { '==': [1, 1] },
      },
      {
        id: 'test:always-false',
        description: 'Always returns false',
        logic: { '==': [1, 2] },
      },
      {
        id: 'test:circular-ref-a',
        description: 'Circular reference A',
        logic: { condition_ref: 'test:circular-ref-b' },
      },
      {
        id: 'test:circular-ref-b',
        description: 'Circular reference B',
        logic: { condition_ref: 'test:circular-ref-a' },
      },
      {
        id: 'test:missing-ref',
        description: 'References non-existent condition',
        logic: { condition_ref: 'test:does-not-exist' },
      },
      {
        id: 'test:invalid-logic',
        description: 'Contains invalid JSON Logic',
        logic: { invalidOperator: ['foo', 'bar'] },
      },
      {
        id: 'test:complex-failing',
        description: 'Complex condition that fails',
        logic: {
          and: [
            { '==': [{ var: 'actor.core:movement.locked' }, false] },
            { '>=': [{ var: 'actor.core:health.current' }, 50] },
            { has: [{ var: 'actor' }, 'test:special-ability'] },
          ],
        },
      },
    ];
  }

  /**
   * Creates scope definitions for edge case testing
   *
   * @returns {Array} Array of edge case scope definitions
   */
  static createEdgeCaseScopeDefinitions() {
    return [
      {
        id: 'test:empty-scope',
        expr: 'entities(test:non-existent-type)',
        description: 'Scope that will resolve to no entities',
        fallbackAst: {
          type: 'Source',
          kind: 'entities',
          param: 'test:non-existent-type',
        },
      },
      {
        id: 'test:invalid-dsl',
        expr: 'invalid.dsl.syntax[malformed',
        description: 'Scope with invalid DSL syntax',
        fallbackAst: { type: 'Source', kind: 'none' },
      },
      {
        id: 'test:complex-filtering',
        expr: 'entities(core:actor)[{ var: "core:health.current", gte: 50 }][{ var: "core:position.locationId", eq: { var: "actor.core:position.locationId" } }]',
        description: 'Complex scope with multiple filtering conditions',
        fallbackAst: { type: 'Source', kind: 'entities', param: 'core:actor' },
      },
    ];
  }

  /**
   * Creates a comprehensive test dataset including all categories
   *
   * @returns {object} Complete test dataset
   */
  static createCompleteTestDataset() {
    return {
      actions: {
        basic: TestDataFactory.createBasicActions(),
        comprehensive: TestDataFactory.createComprehensiveActions(),
        edgeCase: TestDataFactory.createEdgeCaseActions(),
      },
      conditions: {
        basic: TestDataFactory.createTestConditions(),
        edgeCase: TestDataFactory.createEdgeCaseConditions(),
      },
      scopes: {
        basic: TestDataFactory.createScopeDefinitions(),
        edgeCase: TestDataFactory.createEdgeCaseScopeDefinitions(),
      },
      world: TestDataFactory.createTestWorld(),
      actors: TestDataFactory.createTestActorConfigs(),
    };
  }
}

export default TestDataFactory;
