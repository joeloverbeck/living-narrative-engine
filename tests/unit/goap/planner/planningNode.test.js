/**
 * @file Unit tests for PlanningNode
 */

import { describe, it, expect } from '@jest/globals';
import PlanningNode from '../../../../src/goap/planner/planningNode.js';

describe('PlanningNode - Node Creation', () => {
  it('should create a start node with null parent and task', () => {
    const state = {
      'entity-1:core:hungry': true,
      'entity-1:core:health': 100,
    };

    const node = new PlanningNode({
      state,
      gScore: 0,
      hScore: 10,
      parent: null,
      task: null,
      taskParameters: null,
    });

    expect(node.state).toEqual(state);
    expect(node.gScore).toBe(0);
    expect(node.hScore).toBe(10);
    expect(node.fScore).toBe(10); // 0 + 10
    expect(node.parent).toBeNull();
    expect(node.task).toBeNull();
    expect(node.taskParameters).toBeNull();
  });

  it('should create a successor node with parent and task', () => {
    const parentState = { 'entity-1:core:hungry': true };
    const parentNode = new PlanningNode({
      state: parentState,
      gScore: 0,
      hScore: 10,
      parent: null,
      task: null,
      taskParameters: null,
    });

    const childState = { 'entity-1:core:hungry': false };
    const task = { id: 'core:consume_food', name: 'Consume Food' };
    const parameters = { itemId: 'item-123' };

    const childNode = new PlanningNode({
      state: childState,
      gScore: 5,
      hScore: 5,
      parent: parentNode,
      task,
      taskParameters: parameters,
    });

    expect(childNode.state).toEqual(childState);
    expect(childNode.gScore).toBe(5);
    expect(childNode.hScore).toBe(5);
    expect(childNode.fScore).toBe(10); // 5 + 5
    expect(childNode.parent).toBe(parentNode);
    expect(childNode.task).toEqual(task);
    expect(childNode.taskParameters).toEqual(parameters);
  });

  it('should calculate f-score correctly as g + h', () => {
    const node = new PlanningNode({
      state: { 'entity-1:core:hungry': true },
      gScore: 7,
      hScore: 13,
      parent: null,
      task: null,
      taskParameters: null,
    });

    expect(node.fScore).toBe(20); // 7 + 13
  });

  it('should throw error if state is missing', () => {
    expect(() => {
      new PlanningNode({
        state: null,
        gScore: 0,
        hScore: 0,
        parent: null,
        task: null,
        taskParameters: null,
      });
    }).toThrow('PlanningNode requires a state object');
  });

  it('should throw error if gScore is negative', () => {
    expect(() => {
      new PlanningNode({
        state: {},
        gScore: -5,
        hScore: 0,
        parent: null,
        task: null,
        taskParameters: null,
      });
    }).toThrow('PlanningNode requires a non-negative gScore');
  });

  it('should throw error if hScore is negative', () => {
    expect(() => {
      new PlanningNode({
        state: {},
        gScore: 0,
        hScore: -10,
        parent: null,
        task: null,
        taskParameters: null,
      });
    }).toThrow('PlanningNode requires a non-negative hScore');
  });

  it('should accept empty state object', () => {
    const node = new PlanningNode({
      state: {},
      gScore: 0,
      hScore: 0,
      parent: null,
      task: null,
      taskParameters: null,
    });

    expect(node.state).toEqual({});
    expect(node.fScore).toBe(0);
  });

  it('should handle large state objects', () => {
    const largeState = {};
    for (let i = 0; i < 1000; i++) {
      largeState[`entity-${i}:core:value`] = i;
    }

    const node = new PlanningNode({
      state: largeState,
      gScore: 10,
      hScore: 20,
      parent: null,
      task: null,
      taskParameters: null,
    });

    expect(Object.keys(node.state).length).toBe(1000);
    expect(node.state['entity-999:core:value']).toBe(999);
  });
});

describe('PlanningNode - Immutability', () => {
  it('should prevent mutation of state object', () => {
    const state = { 'entity-1:core:hungry': true };
    const node = new PlanningNode({
      state,
      gScore: 0,
      hScore: 0,
      parent: null,
      task: null,
      taskParameters: null,
    });

    // Attempt to mutate state should throw or fail
    expect(() => {
      node.state['entity-1:core:hungry'] = false;
    }).toThrow();
  });

  it('should prevent mutation of taskParameters object', () => {
    const parameters = { itemId: 'item-123' };
    const node = new PlanningNode({
      state: {},
      gScore: 0,
      hScore: 0,
      parent: null,
      task: { id: 'core:test' },
      taskParameters: parameters,
    });

    // Attempt to mutate parameters should throw or fail
    expect(() => {
      node.taskParameters.itemId = 'item-456';
    }).toThrow();
  });

  it('should create independent copy of state', () => {
    const state = { 'entity-1:core:hungry': true };
    const node = new PlanningNode({
      state,
      gScore: 0,
      hScore: 0,
      parent: null,
      task: null,
      taskParameters: null,
    });

    // Mutating original state should not affect node
    state['entity-1:core:hungry'] = false;
    expect(node.state['entity-1:core:hungry']).toBe(true);
  });

  it('should create independent copy of taskParameters', () => {
    const parameters = { itemId: 'item-123' };
    const node = new PlanningNode({
      state: {},
      gScore: 0,
      hScore: 0,
      parent: null,
      task: { id: 'core:test' },
      taskParameters: parameters,
    });

    // Mutating original parameters should not affect node
    parameters.itemId = 'item-456';
    expect(node.taskParameters.itemId).toBe('item-123');
  });

  it('should handle deep nested state objects', () => {
    const state = {
      'entity-1:core:inventory': {
        items: [{ id: 'item-1', quantity: 5 }],
      },
    };

    const node = new PlanningNode({
      state,
      gScore: 0,
      hScore: 0,
      parent: null,
      task: null,
      taskParameters: null,
    });

    // Mutating original nested structure should not affect node
    state['entity-1:core:inventory'].items[0].quantity = 10;
    expect(node.state['entity-1:core:inventory'].items[0].quantity).toBe(5);
  });
});

describe('PlanningNode - State Comparison', () => {
  it('should return true for nodes with identical states', () => {
    const state = {
      'entity-1:core:hungry': true,
      'entity-1:core:health': 50,
    };

    const node1 = new PlanningNode({
      state,
      gScore: 0,
      hScore: 10,
      parent: null,
      task: null,
      taskParameters: null,
    });

    const node2 = new PlanningNode({
      state,
      gScore: 5,
      hScore: 5,
      parent: null,
      task: null,
      taskParameters: null,
    });

    expect(node1.stateEquals(node2)).toBe(true);
  });

  it('should return false for nodes with different state values', () => {
    const state1 = { 'entity-1:core:hungry': true };
    const state2 = { 'entity-1:core:hungry': false };

    const node1 = new PlanningNode({
      state: state1,
      gScore: 0,
      hScore: 0,
      parent: null,
      task: null,
      taskParameters: null,
    });

    const node2 = new PlanningNode({
      state: state2,
      gScore: 0,
      hScore: 0,
      parent: null,
      task: null,
      taskParameters: null,
    });

    expect(node1.stateEquals(node2)).toBe(false);
  });

  it('should return false for nodes with different state keys', () => {
    const state1 = { 'entity-1:core:hungry': true };
    const state2 = { 'entity-1:core:thirsty': true };

    const node1 = new PlanningNode({
      state: state1,
      gScore: 0,
      hScore: 0,
      parent: null,
      task: null,
      taskParameters: null,
    });

    const node2 = new PlanningNode({
      state: state2,
      gScore: 0,
      hScore: 0,
      parent: null,
      task: null,
      taskParameters: null,
    });

    expect(node1.stateEquals(node2)).toBe(false);
  });

  it('should return true regardless of key order', () => {
    const state1 = {
      'entity-1:core:hungry': true,
      'entity-1:core:health': 50,
    };

    const state2 = {
      'entity-1:core:health': 50,
      'entity-1:core:hungry': true,
    };

    const node1 = new PlanningNode({
      state: state1,
      gScore: 0,
      hScore: 0,
      parent: null,
      task: null,
      taskParameters: null,
    });

    const node2 = new PlanningNode({
      state: state2,
      gScore: 0,
      hScore: 0,
      parent: null,
      task: null,
      taskParameters: null,
    });

    expect(node1.stateEquals(node2)).toBe(true);
  });

  it('should return false when comparing with null', () => {
    const node = new PlanningNode({
      state: {},
      gScore: 0,
      hScore: 0,
      parent: null,
      task: null,
      taskParameters: null,
    });

    expect(node.stateEquals(null)).toBe(false);
  });

  it('should return false when comparing with non-PlanningNode', () => {
    const node = new PlanningNode({
      state: {},
      gScore: 0,
      hScore: 0,
      parent: null,
      task: null,
      taskParameters: null,
    });

    expect(node.stateEquals({ state: {} })).toBe(false);
  });

  it('should handle deep nested state comparison', () => {
    const state1 = {
      'entity-1:core:inventory': {
        items: [{ id: 'item-1', quantity: 5 }],
      },
    };

    const state2 = {
      'entity-1:core:inventory': {
        items: [{ id: 'item-1', quantity: 5 }],
      },
    };

    const node1 = new PlanningNode({
      state: state1,
      gScore: 0,
      hScore: 0,
      parent: null,
      task: null,
      taskParameters: null,
    });

    const node2 = new PlanningNode({
      state: state2,
      gScore: 0,
      hScore: 0,
      parent: null,
      task: null,
      taskParameters: null,
    });

    expect(node1.stateEquals(node2)).toBe(true);
  });
});

describe('PlanningNode - Path Reconstruction', () => {
  it('should return empty path for start node', () => {
    const node = new PlanningNode({
      state: {},
      gScore: 0,
      hScore: 0,
      parent: null,
      task: null,
      taskParameters: null,
    });

    const path = node.getPath();
    expect(path).toEqual([]);
  });

  it('should return single task for direct successor', () => {
    const startNode = new PlanningNode({
      state: {},
      gScore: 0,
      hScore: 10,
      parent: null,
      task: null,
      taskParameters: null,
    });

    const task = { id: 'core:consume_food' };
    const parameters = { itemId: 'item-123' };

    const childNode = new PlanningNode({
      state: {},
      gScore: 5,
      hScore: 5,
      parent: startNode,
      task,
      taskParameters: parameters,
    });

    const path = childNode.getPath();
    expect(path).toEqual([
      {
        taskId: 'core:consume_food',
        parameters: { itemId: 'item-123' },
      },
    ]);
  });

  it('should return tasks in execution order for multi-node chain', () => {
    const startNode = new PlanningNode({
      state: {},
      gScore: 0,
      hScore: 20,
      parent: null,
      task: null,
      taskParameters: null,
    });

    const node1 = new PlanningNode({
      state: {},
      gScore: 5,
      hScore: 15,
      parent: startNode,
      task: { id: 'core:find_food' },
      taskParameters: { targetType: 'edible' },
    });

    const node2 = new PlanningNode({
      state: {},
      gScore: 10,
      hScore: 10,
      parent: node1,
      task: { id: 'core:pick_up_item' },
      taskParameters: { itemId: 'item-123' },
    });

    const node3 = new PlanningNode({
      state: {},
      gScore: 15,
      hScore: 5,
      parent: node2,
      task: { id: 'core:consume_food' },
      taskParameters: { itemId: 'item-123' },
    });

    const path = node3.getPath();
    expect(path).toEqual([
      {
        taskId: 'core:find_food',
        parameters: { targetType: 'edible' },
      },
      {
        taskId: 'core:pick_up_item',
        parameters: { itemId: 'item-123' },
      },
      {
        taskId: 'core:consume_food',
        parameters: { itemId: 'item-123' },
      },
    ]);
  });

  it('should handle tasks with null parameters', () => {
    const startNode = new PlanningNode({
      state: {},
      gScore: 0,
      hScore: 10,
      parent: null,
      task: null,
      taskParameters: null,
    });

    const childNode = new PlanningNode({
      state: {},
      gScore: 5,
      hScore: 5,
      parent: startNode,
      task: { id: 'core:rest' },
      taskParameters: null,
    });

    const path = childNode.getPath();
    expect(path).toEqual([
      {
        taskId: 'core:rest',
        parameters: {},
      },
    ]);
  });

  it('should preserve parameter objects without mutation', () => {
    const startNode = new PlanningNode({
      state: {},
      gScore: 0,
      hScore: 10,
      parent: null,
      task: null,
      taskParameters: null,
    });

    const parameters = { itemId: 'item-123', quantity: 5 };
    const childNode = new PlanningNode({
      state: {},
      gScore: 5,
      hScore: 5,
      parent: startNode,
      task: { id: 'core:consume_food' },
      taskParameters: parameters,
    });

    // Verify the node's parameters are preserved
    expect(childNode.taskParameters.quantity).toBe(5);

    // Verify that the frozen taskParameters prevent mutation
    expect(() => {
      childNode.taskParameters.quantity = 10;
    }).toThrow();
  });
});

describe('PlanningNode - State Diff Calculation', () => {
  it('should identify added properties', () => {
    const node1 = new PlanningNode({
      state: { 'entity-1:core:hungry': true },
      gScore: 0,
      hScore: 0,
      parent: null,
      task: null,
      taskParameters: null,
    });

    const node2 = new PlanningNode({
      state: {
        'entity-1:core:hungry': true,
        'entity-1:core:thirsty': true,
      },
      gScore: 0,
      hScore: 0,
      parent: null,
      task: null,
      taskParameters: null,
    });

    const diff = node2.getStateDiff(node1);
    expect(diff.added).toContain('entity-1:core:thirsty');
    expect(diff.removed).toEqual([]);
    expect(diff.changed).toEqual([]);
  });

  it('should identify removed properties', () => {
    const node1 = new PlanningNode({
      state: {
        'entity-1:core:hungry': true,
        'entity-1:core:thirsty': true,
      },
      gScore: 0,
      hScore: 0,
      parent: null,
      task: null,
      taskParameters: null,
    });

    const node2 = new PlanningNode({
      state: { 'entity-1:core:hungry': true },
      gScore: 0,
      hScore: 0,
      parent: null,
      task: null,
      taskParameters: null,
    });

    const diff = node2.getStateDiff(node1);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toContain('entity-1:core:thirsty');
    expect(diff.changed).toEqual([]);
  });

  it('should identify changed property values', () => {
    const node1 = new PlanningNode({
      state: { 'entity-1:core:health': 50 },
      gScore: 0,
      hScore: 0,
      parent: null,
      task: null,
      taskParameters: null,
    });

    const node2 = new PlanningNode({
      state: { 'entity-1:core:health': 75 },
      gScore: 0,
      hScore: 0,
      parent: null,
      task: null,
      taskParameters: null,
    });

    const diff = node2.getStateDiff(node1);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
    expect(diff.changed).toEqual([
      {
        key: 'entity-1:core:health',
        from: 50,
        to: 75,
      },
    ]);
  });

  it('should handle multiple changes simultaneously', () => {
    const node1 = new PlanningNode({
      state: {
        'entity-1:core:hungry': true,
        'entity-1:core:health': 50,
      },
      gScore: 0,
      hScore: 0,
      parent: null,
      task: null,
      taskParameters: null,
    });

    const node2 = new PlanningNode({
      state: {
        'entity-1:core:hungry': false,
        'entity-1:core:thirsty': true,
      },
      gScore: 0,
      hScore: 0,
      parent: null,
      task: null,
      taskParameters: null,
    });

    const diff = node2.getStateDiff(node1);
    expect(diff.added).toContain('entity-1:core:thirsty');
    expect(diff.removed).toContain('entity-1:core:health');
    expect(diff.changed).toEqual([
      {
        key: 'entity-1:core:hungry',
        from: true,
        to: false,
      },
    ]);
  });

  it('should return all properties as added when comparing with null', () => {
    const node = new PlanningNode({
      state: {
        'entity-1:core:hungry': true,
        'entity-1:core:health': 50,
      },
      gScore: 0,
      hScore: 0,
      parent: null,
      task: null,
      taskParameters: null,
    });

    const diff = node.getStateDiff(null);
    expect(diff.added).toEqual([
      'entity-1:core:hungry',
      'entity-1:core:health',
    ]);
    expect(diff.removed).toEqual([]);
    expect(diff.changed).toEqual([]);
  });

  it('should return empty diff for identical states', () => {
    const state = { 'entity-1:core:hungry': true };
    const node1 = new PlanningNode({
      state,
      gScore: 0,
      hScore: 0,
      parent: null,
      task: null,
      taskParameters: null,
    });

    const node2 = new PlanningNode({
      state,
      gScore: 0,
      hScore: 0,
      parent: null,
      task: null,
      taskParameters: null,
    });

    const diff = node1.getStateDiff(node2);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
    expect(diff.changed).toEqual([]);
  });
});

describe('PlanningNode - Edge Cases', () => {
  it('should handle zero scores', () => {
    const node = new PlanningNode({
      state: {},
      gScore: 0,
      hScore: 0,
      parent: null,
      task: null,
      taskParameters: null,
    });

    expect(node.gScore).toBe(0);
    expect(node.hScore).toBe(0);
    expect(node.fScore).toBe(0);
  });

  it('should handle very large scores', () => {
    const node = new PlanningNode({
      state: {},
      gScore: Number.MAX_SAFE_INTEGER - 1000,
      hScore: 1000,
      parent: null,
      task: null,
      taskParameters: null,
    });

    expect(node.fScore).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('should handle complex nested state structures', () => {
    const state = {
      'entity-1:core:inventory': {
        items: [
          { id: 'item-1', properties: { weight: 5, value: 10 } },
          { id: 'item-2', properties: { weight: 3, value: 7 } },
        ],
        capacity: 100,
      },
    };

    const node = new PlanningNode({
      state,
      gScore: 0,
      hScore: 0,
      parent: null,
      task: null,
      taskParameters: null,
    });

    expect(node.state['entity-1:core:inventory'].items.length).toBe(2);
    expect(node.state['entity-1:core:inventory'].items[0].properties.weight).toBe(5);
  });

  it('should handle special values in state', () => {
    const state = {
      'entity-1:core:value1': null,
      'entity-1:core:value2': undefined,
      'entity-1:core:value3': 0,
      'entity-1:core:value4': false,
      'entity-1:core:value5': '',
    };

    const node = new PlanningNode({
      state,
      gScore: 0,
      hScore: 0,
      parent: null,
      task: null,
      taskParameters: null,
    });

    expect(node.state['entity-1:core:value1']).toBeNull();
    expect(node.state['entity-1:core:value3']).toBe(0);
    expect(node.state['entity-1:core:value4']).toBe(false);
    expect(node.state['entity-1:core:value5']).toBe('');
  });

  it('should handle circular reference detection in parent chain', () => {
    const startNode = new PlanningNode({
      state: {},
      gScore: 0,
      hScore: 10,
      parent: null,
      task: null,
      taskParameters: null,
    });

    const node1 = new PlanningNode({
      state: {},
      gScore: 5,
      hScore: 5,
      parent: startNode,
      task: { id: 'core:task1' },
      taskParameters: null,
    });

    const node2 = new PlanningNode({
      state: {},
      gScore: 10,
      hScore: 0,
      parent: node1,
      task: { id: 'core:task2' },
      taskParameters: null,
    });

    // This should work fine - no circular reference
    const path = node2.getPath();
    expect(path.length).toBe(2);
  });
});
