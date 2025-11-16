/**
 * @file Unit tests for PlanningEffectsSimulator
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import PlanningEffectsSimulator from '../../../../src/goap/planner/planningEffectsSimulator.js';

describe('PlanningEffectsSimulator - Constructor', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should construct with valid dependencies', () => {
    const mockLogger = testBed.createMockLogger();
    const mockParameterResolution = testBed.createMock(
      'IParameterResolutionService',
      ['resolve', 'clearCache']
    );
    const mockContextAssembly = testBed.createMock(
      'IContextAssemblyService',
      ['assemblePlanningContext']
    );

    const simulator = new PlanningEffectsSimulator({
      parameterResolutionService: mockParameterResolution,
      contextAssemblyService: mockContextAssembly,
      logger: mockLogger,
    });

    expect(simulator).toBeDefined();
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'PlanningEffectsSimulator initialized'
    );
  });

  it('should throw error if parameterResolutionService is missing required methods', () => {
    const mockLogger = testBed.createMockLogger();
    const invalidService = { resolve: jest.fn() }; // missing clearCache
    const mockContextAssembly = testBed.createMock(
      'IContextAssemblyService',
      ['assemblePlanningContext']
    );

    expect(
      () =>
        new PlanningEffectsSimulator({
          parameterResolutionService: invalidService,
          contextAssemblyService: mockContextAssembly,
          logger: mockLogger,
        })
    ).toThrow();
  });

  it('should throw error if contextAssemblyService is missing required methods', () => {
    const mockLogger = testBed.createMockLogger();
    const mockParameterResolution = testBed.createMock(
      'IParameterResolutionService',
      ['resolve', 'clearCache']
    );
    const invalidService = {};

    expect(
      () =>
        new PlanningEffectsSimulator({
          parameterResolutionService: mockParameterResolution,
          contextAssemblyService: invalidService,
          logger: mockLogger,
        })
    ).toThrow();
  });
});

describe('PlanningEffectsSimulator - ADD_COMPONENT Simulation', () => {
  let testBed;
  let simulator;
  let mockLogger;
  let mockParameterResolution;
  let mockContextAssembly;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    mockParameterResolution = testBed.createMock(
      'IParameterResolutionService',
      ['resolve', 'clearCache']
    );
    mockContextAssembly = testBed.createMock(
      'IContextAssemblyService',
      ['assemblePlanningContext']
    );

    simulator = new PlanningEffectsSimulator({
      parameterResolutionService: mockParameterResolution,
      contextAssemblyService: mockContextAssembly,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should add component with empty value to state', () => {
    const currentState = { 'entity-1:core:hungry': true };
    const planningEffects = [
      {
        type: 'ADD_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:satiated',
          value: {},
        },
      },
    ];
    const context = { actor: 'entity-1' };

    mockParameterResolution.resolve.mockReturnValueOnce('entity-1');

    const result = simulator.simulateEffects(
      currentState,
      planningEffects,
      context
    );

    expect(result.success).toBe(true);
    expect(result.state).toEqual({
      'entity-1:core:hungry': true,
      'entity-1:core:satiated': {},
    });
    // Verify original state unchanged
    expect(currentState).toEqual({ 'entity-1:core:hungry': true });
  });

  it('should add component with complex value to state', () => {
    const currentState = {};
    const planningEffects = [
      {
        type: 'ADD_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:nutrition',
          value: { hungerLevel: 0, satiation: 100 },
        },
      },
    ];
    const context = { actor: 'entity-1' };

    mockParameterResolution.resolve.mockReturnValueOnce('entity-1');

    const result = simulator.simulateEffects(
      currentState,
      planningEffects,
      context
    );

    expect(result.success).toBe(true);
    expect(result.state).toEqual({
      'entity-1:core:nutrition': { hungerLevel: 0, satiation: 100 },
    });
  });

  it('should add component with boolean value to state', () => {
    const currentState = {};
    const planningEffects = [
      {
        type: 'ADD_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:rested',
          value: true,
        },
      },
    ];
    const context = { actor: 'entity-1' };

    mockParameterResolution.resolve.mockReturnValueOnce('entity-1');

    const result = simulator.simulateEffects(
      currentState,
      planningEffects,
      context
    );

    expect(result.success).toBe(true);
    expect(result.state).toEqual({
      'entity-1:core:rested': true,
    });
  });

  it('should default value to empty object if not provided', () => {
    const currentState = {};
    const planningEffects = [
      {
        type: 'ADD_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:sitting',
        },
      },
    ];
    const context = { actor: 'entity-1' };

    mockParameterResolution.resolve.mockReturnValueOnce('entity-1');

    const result = simulator.simulateEffects(
      currentState,
      planningEffects,
      context
    );

    expect(result.success).toBe(true);
    expect(result.state).toEqual({
      'entity-1:core:sitting': {},
    });
  });
});

describe('PlanningEffectsSimulator - MODIFY_COMPONENT Simulation', () => {
  let testBed;
  let simulator;
  let mockLogger;
  let mockParameterResolution;
  let mockContextAssembly;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    mockParameterResolution = testBed.createMock(
      'IParameterResolutionService',
      ['resolve', 'clearCache']
    );
    mockContextAssembly = testBed.createMock(
      'IContextAssemblyService',
      ['assemblePlanningContext']
    );

    simulator = new PlanningEffectsSimulator({
      parameterResolutionService: mockParameterResolution,
      contextAssemblyService: mockContextAssembly,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should modify component field with set mode', () => {
    const currentState = {
      'entity-1:core:nutrition': { hungerLevel: 50 },
    };
    const planningEffects = [
      {
        type: 'MODIFY_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:nutrition',
          field: 'hungerLevel',
          mode: 'set',
          value: 0,
        },
      },
    ];
    const context = { actor: 'entity-1' };

    mockParameterResolution.resolve.mockReturnValueOnce('entity-1');

    const result = simulator.simulateEffects(
      currentState,
      planningEffects,
      context
    );

    expect(result.success).toBe(true);
    expect(result.state).toEqual({
      'entity-1:core:nutrition': { hungerLevel: 0 },
    });
  });

  it('should modify component field with increment mode', () => {
    const currentState = {
      'entity-1:core:health': { points: 50 },
    };
    const planningEffects = [
      {
        type: 'MODIFY_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:health',
          field: 'points',
          mode: 'increment',
          value: 25,
        },
      },
    ];
    const context = { actor: 'entity-1' };

    mockParameterResolution.resolve.mockReturnValueOnce('entity-1');

    const result = simulator.simulateEffects(
      currentState,
      planningEffects,
      context
    );

    expect(result.success).toBe(true);
    expect(result.state).toEqual({
      'entity-1:core:health': { points: 75 },
    });
  });

  it('should modify component field with decrement mode', () => {
    const currentState = {
      'entity-1:core:stamina': { points: 100 },
    };
    const planningEffects = [
      {
        type: 'MODIFY_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:stamina',
          field: 'points',
          mode: 'decrement',
          value: 30,
        },
      },
    ];
    const context = { actor: 'entity-1' };

    mockParameterResolution.resolve.mockReturnValueOnce('entity-1');

    const result = simulator.simulateEffects(
      currentState,
      planningEffects,
      context
    );

    expect(result.success).toBe(true);
    expect(result.state).toEqual({
      'entity-1:core:stamina': { points: 70 },
    });
  });

  it('should handle nested field paths as state keys', () => {
    const currentState = {
      'entity-1:core:nutrition:hungerLevel': 50,
    };
    const planningEffects = [
      {
        type: 'MODIFY_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:nutrition',
          field: 'hungerLevel',
          mode: 'set',
          value: 0,
        },
      },
    ];
    const context = { actor: 'entity-1' };

    mockParameterResolution.resolve.mockReturnValueOnce('entity-1');

    const result = simulator.simulateEffects(
      currentState,
      planningEffects,
      context
    );

    expect(result.success).toBe(true);
    expect(result.state).toEqual({
      'entity-1:core:nutrition:hungerLevel': 0,
    });
  });

  it('should default mode to set if not provided', () => {
    const currentState = {
      'entity-1:core:status': { level: 1 },
    };
    const planningEffects = [
      {
        type: 'MODIFY_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:status',
          field: 'level',
          value: 5,
        },
      },
    ];
    const context = { actor: 'entity-1' };

    mockParameterResolution.resolve.mockReturnValueOnce('entity-1');

    const result = simulator.simulateEffects(
      currentState,
      planningEffects,
      context
    );

    expect(result.success).toBe(true);
    expect(result.state['entity-1:core:status'].level).toBe(5);
  });

  it('should not affect other fields when modifying', () => {
    const currentState = {
      'entity-1:core:nutrition': { hungerLevel: 50, thirst: 30 },
    };
    const planningEffects = [
      {
        type: 'MODIFY_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:nutrition',
          field: 'hungerLevel',
          mode: 'set',
          value: 0,
        },
      },
    ];
    const context = { actor: 'entity-1' };

    mockParameterResolution.resolve.mockReturnValueOnce('entity-1');

    const result = simulator.simulateEffects(
      currentState,
      planningEffects,
      context
    );

    expect(result.success).toBe(true);
    expect(result.state['entity-1:core:nutrition'].thirst).toBe(30);
    expect(result.state['entity-1:core:nutrition'].hungerLevel).toBe(0);
  });
});

describe('PlanningEffectsSimulator - REMOVE_COMPONENT Simulation', () => {
  let testBed;
  let simulator;
  let mockLogger;
  let mockParameterResolution;
  let mockContextAssembly;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    mockParameterResolution = testBed.createMock(
      'IParameterResolutionService',
      ['resolve', 'clearCache']
    );
    mockContextAssembly = testBed.createMock(
      'IContextAssemblyService',
      ['assemblePlanningContext']
    );

    simulator = new PlanningEffectsSimulator({
      parameterResolutionService: mockParameterResolution,
      contextAssemblyService: mockContextAssembly,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should remove component from state', () => {
    const currentState = {
      'entity-1:core:hungry': true,
      'entity-1:core:tired': true,
    };
    const planningEffects = [
      {
        type: 'REMOVE_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:hungry',
        },
      },
    ];
    const context = { actor: 'entity-1' };

    mockParameterResolution.resolve.mockReturnValueOnce('entity-1');

    const result = simulator.simulateEffects(
      currentState,
      planningEffects,
      context
    );

    expect(result.success).toBe(true);
    expect(result.state).toEqual({
      'entity-1:core:tired': true,
    });
    expect(result.state['entity-1:core:hungry']).toBeUndefined();
  });

  it('should remove component and its nested fields', () => {
    const currentState = {
      'entity-1:core:nutrition': { hungerLevel: 50 },
      'entity-1:core:nutrition:thirst': 30,
      'entity-1:core:health': { points: 100 },
    };
    const planningEffects = [
      {
        type: 'REMOVE_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:nutrition',
        },
      },
    ];
    const context = { actor: 'entity-1' };

    mockParameterResolution.resolve.mockReturnValueOnce('entity-1');

    const result = simulator.simulateEffects(
      currentState,
      planningEffects,
      context
    );

    expect(result.success).toBe(true);
    expect(result.state).toEqual({
      'entity-1:core:health': { points: 100 },
    });
    expect(result.state['entity-1:core:nutrition']).toBeUndefined();
    expect(result.state['entity-1:core:nutrition:thirst']).toBeUndefined();
  });

  it('should handle removing non-existent component gracefully', () => {
    const currentState = {
      'entity-1:core:health': { points: 100 },
    };
    const planningEffects = [
      {
        type: 'REMOVE_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:nonexistent',
        },
      },
    ];
    const context = { actor: 'entity-1' };

    mockParameterResolution.resolve.mockReturnValueOnce('entity-1');

    const result = simulator.simulateEffects(
      currentState,
      planningEffects,
      context
    );

    expect(result.success).toBe(true);
    expect(result.state).toEqual({
      'entity-1:core:health': { points: 100 },
    });
  });
});

describe('PlanningEffectsSimulator - Operation Sequences', () => {
  let testBed;
  let simulator;
  let mockLogger;
  let mockParameterResolution;
  let mockContextAssembly;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    mockParameterResolution = testBed.createMock(
      'IParameterResolutionService',
      ['resolve', 'clearCache']
    );
    mockContextAssembly = testBed.createMock(
      'IContextAssemblyService',
      ['assemblePlanningContext']
    );

    simulator = new PlanningEffectsSimulator({
      parameterResolutionService: mockParameterResolution,
      contextAssemblyService: mockContextAssembly,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should apply multiple operations in order', () => {
    const currentState = {
      'entity-1:core:hungry': true,
    };
    const planningEffects = [
      {
        type: 'REMOVE_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:hungry',
        },
      },
      {
        type: 'ADD_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:satiated',
          value: {},
        },
      },
      {
        type: 'ADD_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:nutrition',
          value: { hungerLevel: 0 },
        },
      },
    ];
    const context = { actor: 'entity-1' };

    mockParameterResolution.resolve
      .mockReturnValueOnce('entity-1')
      .mockReturnValueOnce('entity-1')
      .mockReturnValueOnce('entity-1');

    const result = simulator.simulateEffects(
      currentState,
      planningEffects,
      context
    );

    expect(result.success).toBe(true);
    expect(result.state).toEqual({
      'entity-1:core:satiated': {},
      'entity-1:core:nutrition': { hungerLevel: 0 },
    });
  });

  it('should handle interdependent operations (modify after add)', () => {
    const currentState = {};
    const planningEffects = [
      {
        type: 'ADD_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:health',
          value: { points: 50 },
        },
      },
      {
        type: 'MODIFY_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:health',
          field: 'points',
          mode: 'increment',
          value: 25,
        },
      },
    ];
    const context = { actor: 'entity-1' };

    mockParameterResolution.resolve
      .mockReturnValueOnce('entity-1')
      .mockReturnValueOnce('entity-1');

    const result = simulator.simulateEffects(
      currentState,
      planningEffects,
      context
    );

    expect(result.success).toBe(true);
    expect(result.state['entity-1:core:health'].points).toBe(75);
  });
});

describe('PlanningEffectsSimulator - State Immutability', () => {
  let testBed;
  let simulator;
  let mockLogger;
  let mockParameterResolution;
  let mockContextAssembly;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    mockParameterResolution = testBed.createMock(
      'IParameterResolutionService',
      ['resolve', 'clearCache']
    );
    mockContextAssembly = testBed.createMock(
      'IContextAssemblyService',
      ['assemblePlanningContext']
    );

    simulator = new PlanningEffectsSimulator({
      parameterResolutionService: mockParameterResolution,
      contextAssemblyService: mockContextAssembly,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should NOT mutate input state (CRITICAL)', () => {
    const currentState = {
      'entity-1:core:hungry': true,
      'entity-1:core:nutrition': { hungerLevel: 50 },
    };
    const originalState = JSON.parse(JSON.stringify(currentState));
    const planningEffects = [
      {
        type: 'ADD_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:satiated',
          value: {},
        },
      },
    ];
    const context = { actor: 'entity-1' };

    mockParameterResolution.resolve.mockReturnValueOnce('entity-1');

    simulator.simulateEffects(currentState, planningEffects, context);

    // Verify original state completely unchanged
    expect(currentState).toEqual(originalState);
    expect(currentState['entity-1:core:satiated']).toBeUndefined();
  });

  it('should return new state instance', () => {
    const currentState = {
      'entity-1:core:hungry': true,
    };
    const planningEffects = [
      {
        type: 'ADD_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:satiated',
          value: {},
        },
      },
    ];
    const context = { actor: 'entity-1' };

    mockParameterResolution.resolve.mockReturnValueOnce('entity-1');

    const result = simulator.simulateEffects(
      currentState,
      planningEffects,
      context
    );

    expect(result.state).not.toBe(currentState);
    expect(typeof result.state).toBe('object');
  });

  it('should deep clone nested objects', () => {
    const currentState = {
      'entity-1:core:inventory': { items: [{ id: 'sword' }] },
    };
    const originalItems = currentState['entity-1:core:inventory'].items;
    const planningEffects = [
      {
        type: 'MODIFY_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:inventory',
          field: 'count',
          mode: 'set',
          value: 1,
        },
      },
    ];
    const context = { actor: 'entity-1' };

    mockParameterResolution.resolve.mockReturnValueOnce('entity-1');

    const result = simulator.simulateEffects(
      currentState,
      planningEffects,
      context
    );

    // Original nested array should be unchanged
    expect(currentState['entity-1:core:inventory'].items).toBe(originalItems);
    expect(currentState['entity-1:core:inventory'].items).toEqual([
      { id: 'sword' },
    ]);
  });
});

describe('PlanningEffectsSimulator - Parameter Resolution', () => {
  let testBed;
  let simulator;
  let mockLogger;
  let mockParameterResolution;
  let mockContextAssembly;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    mockParameterResolution = testBed.createMock(
      'IParameterResolutionService',
      ['resolve', 'clearCache']
    );
    mockContextAssembly = testBed.createMock(
      'IContextAssemblyService',
      ['assemblePlanningContext']
    );

    simulator = new PlanningEffectsSimulator({
      parameterResolutionService: mockParameterResolution,
      contextAssemblyService: mockContextAssembly,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should resolve actor reference', () => {
    const currentState = {};
    const planningEffects = [
      {
        type: 'ADD_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:test',
          value: {},
        },
      },
    ];
    const context = { actor: 'entity-123' };

    mockParameterResolution.resolve.mockReturnValueOnce('entity-123');

    const result = simulator.simulateEffects(
      currentState,
      planningEffects,
      context
    );

    expect(result.success).toBe(true);
    expect(result.state['entity-123:core:test']).toBeDefined();
    expect(mockParameterResolution.resolve).toHaveBeenCalledWith(
      'actor',
      context,
      { validateEntity: true, contextType: 'planning' }
    );
  });

  it('should resolve task.params.* references', () => {
    const currentState = {};
    const planningEffects = [
      {
        type: 'ADD_COMPONENT',
        parameters: {
          entity_ref: 'task.params.target',
          component_type: 'core:test',
          value: {},
        },
      },
    ];
    const context = { task: { params: { target: 'entity-456' } } };

    mockParameterResolution.resolve.mockReturnValueOnce('entity-456');

    const result = simulator.simulateEffects(
      currentState,
      planningEffects,
      context
    );

    expect(result.success).toBe(true);
    expect(result.state['entity-456:core:test']).toBeDefined();
  });

  it('should handle literal values without resolution', () => {
    const currentState = {};
    const planningEffects = [
      {
        type: 'ADD_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:literal',
          value: { directValue: 42 },
        },
      },
    ];
    const context = { actor: 'entity-1' };

    mockParameterResolution.resolve.mockReturnValueOnce('entity-1');

    const result = simulator.simulateEffects(
      currentState,
      planningEffects,
      context
    );

    expect(result.success).toBe(true);
    expect(result.state['entity-1:core:literal'].directValue).toBe(42);
  });
});

describe('PlanningEffectsSimulator - Error Handling', () => {
  let testBed;
  let simulator;
  let mockLogger;
  let mockParameterResolution;
  let mockContextAssembly;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    mockParameterResolution = testBed.createMock(
      'IParameterResolutionService',
      ['resolve', 'clearCache']
    );
    mockContextAssembly = testBed.createMock(
      'IContextAssemblyService',
      ['assemblePlanningContext']
    );

    simulator = new PlanningEffectsSimulator({
      parameterResolutionService: mockParameterResolution,
      contextAssemblyService: mockContextAssembly,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should handle invalid operation type gracefully', () => {
    const currentState = { 'entity-1:core:test': {} };
    const planningEffects = [
      {
        type: 'INVALID_OPERATION',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:test',
        },
      },
    ];
    const context = { actor: 'entity-1' };

    mockParameterResolution.resolve.mockReturnValueOnce('entity-1');

    const result = simulator.simulateEffects(
      currentState,
      planningEffects,
      context
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Critical');
    expect(result.state).toBe(currentState);
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it('should handle parameter resolution failure', () => {
    const currentState = {};
    const planningEffects = [
      {
        type: 'ADD_COMPONENT',
        parameters: {
          entity_ref: 'actor', // Use a reference that exists in context to trigger resolution
          component_type: 'core:test',
          value: {},
        },
      },
    ];
    const context = { actor: 'entity-1' }; // Context entry makes it a reference, not literal

    // Mock the resolution to throw an error
    mockParameterResolution.resolve.mockImplementationOnce(() => {
      throw new Error('Entity not found');
    });

    const result = simulator.simulateEffects(
      currentState,
      planningEffects,
      context
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Critical');
  });

  it('should handle catastrophic failures from deep cloning', () => {
    const currentState = { 'entity-1:core:state': true };
    const planningEffects = [];
    const context = {};
    const originalStructuredClone = globalThis.structuredClone;
    globalThis.structuredClone = () => {
      throw new Error('clone explosion');
    };

    try {
      const result = simulator.simulateEffects(
        currentState,
        planningEffects,
        context
      );

      expect(result.success).toBe(false);
      expect(result.state).toBe(currentState);
      expect(result.error).toBe('clone explosion');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Effects simulation failed catastrophically',
        expect.any(Error)
      );
    } finally {
      globalThis.structuredClone = originalStructuredClone;
    }
  });

  it('should return error when effect parameters block is missing', () => {
    const currentState = {};
    const planningEffects = [
      {
        type: 'ADD_COMPONENT',
      },
    ];
    const context = {};

    const result = simulator.simulateEffects(
      currentState,
      planningEffects,
      context
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Effect missing parameters');
  });

  it('should surface unknown component type errors', () => {
    const currentState = {};
    const planningEffects = [
      {
        type: 'ADD_COMPONENT',
        parameters: {
          entity_ref: 'actor',
        },
      },
    ];
    const context = { actor: 'entity-1' };

    mockParameterResolution.resolve.mockReturnValueOnce('entity-1');

    const result = simulator.simulateEffects(
      currentState,
      planningEffects,
      context
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('component_type');
  });

  it('should surface errors for missing modify fields', () => {
    const currentState = { 'entity-1:core:stats': { level: 1 } };
    const planningEffects = [
      {
        type: 'MODIFY_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:stats',
          value: 5,
        },
      },
    ];
    const context = { actor: 'entity-1' };

    mockParameterResolution.resolve.mockReturnValueOnce('entity-1');

    const result = simulator.simulateEffects(
      currentState,
      planningEffects,
      context
    );

    expect(result.success).toBe(true);
    expect(result.state['entity-1:core:stats']).toEqual({ level: 1 });
    const warnCall = mockLogger.warn.mock.calls.find((call) =>
      call[0].includes('Failed to simulate effect')
    );
    expect(warnCall[1].error).toContain('requires field');
  });

  it('should prevent field modification when component is not an object', () => {
    const currentState = { 'entity-1:core:stats': true };
    const planningEffects = [
      {
        type: 'MODIFY_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:stats',
          field: 'level',
          mode: 'set',
          value: 5,
        },
      },
    ];
    const context = { actor: 'entity-1' };

    mockParameterResolution.resolve.mockReturnValueOnce('entity-1');

    const result = simulator.simulateEffects(
      currentState,
      planningEffects,
      context
    );

    expect(result.success).toBe(true);
    expect(result.state['entity-1:core:stats']).toBe(true);
    const warnCall = mockLogger.warn.mock.calls.find((call) =>
      call[0].includes('Failed to simulate effect')
    );
    expect(warnCall[1].error).toContain('non-object component');
  });

  it('should throw when modification mode is unknown', () => {
    const currentState = { 'entity-1:core:stats': { level: 1 } };
    const planningEffects = [
      {
        type: 'MODIFY_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:stats',
          field: 'level',
          mode: 'multiply',
          value: 5,
        },
      },
    ];
    const context = { actor: 'entity-1' };

    mockParameterResolution.resolve.mockReturnValueOnce('entity-1');

    const result = simulator.simulateEffects(
      currentState,
      planningEffects,
      context
    );

    expect(result.success).toBe(true);
    expect(result.state['entity-1:core:stats'].level).toBe(1);
    // With safe modification, unknown mode is logged directly by #applyModification
    const warnCall = mockLogger.warn.mock.calls.find((call) =>
      call[0].includes('Unknown modification mode')
    );
    expect(warnCall).toBeDefined();
    expect(warnCall[0]).toContain('Unknown modification mode');
  });

  it('should surface unknown operation type if effect mutates mid-execution', () => {
    const currentState = {};
    const context = { actor: 'entity-1' };
    mockParameterResolution.resolve.mockReturnValue('entity-1');
    let accessCount = 0;
    const effect = {
      parameters: {
        entity_ref: 'actor',
        component_type: 'core:test',
        value: {},
      },
    };

    Object.defineProperty(effect, 'type', {
      get() {
        accessCount += 1;
        if (accessCount < 3) {
          return PlanningEffectsSimulator.OPERATION_TYPES.ADD_COMPONENT;
        }
        return 'MUTATED_OPERATION';
      },
    });

    const result = simulator.simulateEffects(currentState, [effect], context);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown operation type');
  });

  it('should return original state on failure', () => {
    const currentState = { 'entity-1:core:original': true };
    const planningEffects = [
      {
        type: 'ADD_COMPONENT',
        parameters: {
          // Missing entity_ref - critical error
          component_type: 'core:test',
          value: {},
        },
      },
    ];
    const context = { actor: 'entity-1' };

    const result = simulator.simulateEffects(
      currentState,
      planningEffects,
      context
    );

    expect(result.success).toBe(false);
    expect(result.state).toBe(currentState);
  });

  it('should NOT throw exceptions on errors', () => {
    const currentState = {};
    const planningEffects = [
      {
        type: 'INVALID',
        parameters: {},
      },
    ];
    const context = {};

    expect(() =>
      simulator.simulateEffects(currentState, planningEffects, context)
    ).not.toThrow();
  });

  it('should validate inputs and return error for invalid currentState', () => {
    const result = simulator.simulateEffects(null, [], {});

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid currentState');
  });

  it('should validate inputs and return error for invalid planningEffects', () => {
    const result = simulator.simulateEffects({}, 'not-an-array', {});

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid planningEffects');
  });

  it('should validate inputs and return error for invalid context', () => {
    const result = simulator.simulateEffects({}, [], null);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid context');
  });
});

describe('PlanningEffectsSimulator - Edge Case Simulations', () => {
  let testBed;
  let simulator;
  let mockLogger;
  let mockParameterResolution;
  let mockContextAssembly;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    mockParameterResolution = testBed.createMock(
      'IParameterResolutionService',
      ['resolve', 'clearCache']
    );
    mockParameterResolution.resolve.mockImplementation(() => 'entity-1');
    mockContextAssembly = testBed.createMock(
      'IContextAssemblyService',
      ['assemblePlanningContext']
    );

    simulator = new PlanningEffectsSimulator({
      parameterResolutionService: mockParameterResolution,
      contextAssemblyService: mockContextAssembly,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should create component entries when modifying a missing component', () => {
    const currentState = {};
    const planningEffects = [
      {
        type: 'MODIFY_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:nutrition',
          field: 'hungerLevel',
          mode: 'set',
          value: 10,
        },
      },
    ];
    const context = { actor: 'entity-1' };

    const result = simulator.simulateEffects(
      currentState,
      planningEffects,
      context
    );

    expect(result.success).toBe(true);
    expect(result.state['entity-1:core:nutrition']).toEqual({ hungerLevel: 10 });
  });

  it('should support increment and decrement on nested field keys', () => {
    const currentState = {
      'entity-1:core:nutrition:hungerLevel': 5,
    };
    const planningEffects = [
      {
        type: 'MODIFY_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:nutrition',
          field: 'hungerLevel',
          mode: 'increment',
          value: 3,
        },
      },
      {
        type: 'MODIFY_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:nutrition',
          field: 'hungerLevel',
          mode: 'decrement',
          value: 2,
        },
      },
    ];
    const context = { actor: 'entity-1' };

    const result = simulator.simulateEffects(
      currentState,
      planningEffects,
      context
    );

    expect(result.success).toBe(true);
    expect(result.state['entity-1:core:nutrition:hungerLevel']).toBe(6);
  });
});

describe('PlanningEffectsSimulator - MODIFY_COMPONENT Type Safety', () => {
  let testBed;
  let simulator;
  let mockLogger;
  let mockParameterResolution;
  let mockContextAssembly;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    mockParameterResolution = testBed.createMock(
      'IParameterResolutionService',
      ['resolve', 'clearCache']
    );
    mockContextAssembly = testBed.createMock(
      'IContextAssemblyService',
      ['assemblePlanningContext']
    );

    simulator = new PlanningEffectsSimulator({
      parameterResolutionService: mockParameterResolution,
      contextAssemblyService: mockContextAssembly,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should reject string modification values', () => {
    const currentState = { 'entity-1:core:nutrition': { hungerLevel: 50 } };
    const planningEffects = [
      {
        type: 'MODIFY_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:nutrition',
          field: 'hungerLevel',
          mode: 'increment', // Changed from 'set' - type validation only applies to increment/decrement
          value: 'not a number',
        },
      },
    ];
    const context = { actor: 'entity-1' };

    mockParameterResolution.resolve.mockReturnValueOnce('entity-1');

    const result = simulator.simulateEffects(
      currentState,
      planningEffects,
      context
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('type validation failed');
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('value is not a number'),
      expect.objectContaining({
        entityId: 'entity-1',
        componentType: 'core:nutrition',
        field: 'hungerLevel',
        valueType: 'string',
      })
    );
  });

  it('should reject NaN modification values', () => {
    const currentState = { 'entity-1:core:nutrition': { hungerLevel: 50 } };
    const planningEffects = [
      {
        type: 'MODIFY_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:nutrition',
          field: 'hungerLevel',
          mode: 'increment',
          value: NaN,
        },
      },
    ];
    const context = { actor: 'entity-1' };

    mockParameterResolution.resolve.mockReturnValueOnce('entity-1');

    const result = simulator.simulateEffects(
      currentState,
      planningEffects,
      context
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('type validation failed');
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('value is NaN'),
      expect.objectContaining({
        entityId: 'entity-1',
        componentType: 'core:nutrition',
        field: 'hungerLevel',
      })
    );
  });

  it('should reject Infinity modification values', () => {
    const currentState = { 'entity-1:core:nutrition': { hungerLevel: 50 } };
    const planningEffects = [
      {
        type: 'MODIFY_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:nutrition',
          field: 'hungerLevel',
          mode: 'increment', // Changed from 'set' - type validation only applies to increment/decrement
          value: Infinity,
        },
      },
    ];
    const context = { actor: 'entity-1' };

    mockParameterResolution.resolve.mockReturnValueOnce('entity-1');

    const result = simulator.simulateEffects(
      currentState,
      planningEffects,
      context
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('type validation failed');
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('value is Infinity'),
      expect.objectContaining({
        entityId: 'entity-1',
        componentType: 'core:nutrition',
        field: 'hungerLevel',
      })
    );
  });

  it('should reject negative Infinity modification values', () => {
    const currentState = { 'entity-1:core:nutrition': { hungerLevel: 50 } };
    const planningEffects = [
      {
        type: 'MODIFY_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:nutrition',
          field: 'hungerLevel',
          mode: 'decrement',
          value: -Infinity,
        },
      },
    ];
    const context = { actor: 'entity-1' };

    mockParameterResolution.resolve.mockReturnValueOnce('entity-1');

    const result = simulator.simulateEffects(
      currentState,
      planningEffects,
      context
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('type validation failed');
  });

  it('should reject null modification values', () => {
    const currentState = { 'entity-1:core:nutrition': { hungerLevel: 50 } };
    const planningEffects = [
      {
        type: 'MODIFY_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:nutrition',
          field: 'hungerLevel',
          mode: 'increment', // Changed from 'set' - type validation only applies to increment/decrement
          value: null,
        },
      },
    ];
    const context = { actor: 'entity-1' };

    mockParameterResolution.resolve.mockReturnValueOnce('entity-1');

    const result = simulator.simulateEffects(
      currentState,
      planningEffects,
      context
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('type validation failed');
  });

  it('should reject undefined modification values', () => {
    const currentState = { 'entity-1:core:nutrition': { hungerLevel: 50 } };
    const planningEffects = [
      {
        type: 'MODIFY_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:nutrition',
          field: 'hungerLevel',
          mode: 'increment', // Changed from 'set' - type validation only applies to increment/decrement
          value: undefined,
        },
      },
    ];
    const context = { actor: 'entity-1' };

    mockParameterResolution.resolve.mockReturnValueOnce('entity-1');

    const result = simulator.simulateEffects(
      currentState,
      planningEffects,
      context
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('type validation failed');
  });

  it('should accept valid integer modification values', () => {
    const currentState = { 'entity-1:core:nutrition': { hungerLevel: 50 } };
    const planningEffects = [
      {
        type: 'MODIFY_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:nutrition',
          field: 'hungerLevel',
          mode: 'set',
          value: 100,
        },
      },
    ];
    const context = { actor: 'entity-1' };

    mockParameterResolution.resolve.mockReturnValueOnce('entity-1');

    const result = simulator.simulateEffects(
      currentState,
      planningEffects,
      context
    );

    expect(result.success).toBe(true);
    expect(result.state['entity-1:core:nutrition'].hungerLevel).toBe(100);
  });

  it('should accept valid float modification values', () => {
    const currentState = { 'entity-1:core:nutrition': { hungerLevel: 50 } };
    const planningEffects = [
      {
        type: 'MODIFY_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:nutrition',
          field: 'hungerLevel',
          mode: 'increment',
          value: 10.5,
        },
      },
    ];
    const context = { actor: 'entity-1' };

    mockParameterResolution.resolve.mockReturnValueOnce('entity-1');

    const result = simulator.simulateEffects(
      currentState,
      planningEffects,
      context
    );

    expect(result.success).toBe(true);
    expect(result.state['entity-1:core:nutrition'].hungerLevel).toBe(60.5);
  });

  it('should accept negative modification values', () => {
    const currentState = { 'entity-1:core:nutrition': { hungerLevel: 50 } };
    const planningEffects = [
      {
        type: 'MODIFY_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:nutrition',
          field: 'hungerLevel',
          mode: 'increment',
          value: -10,
        },
      },
    ];
    const context = { actor: 'entity-1' };

    mockParameterResolution.resolve.mockReturnValueOnce('entity-1');

    const result = simulator.simulateEffects(
      currentState,
      planningEffects,
      context
    );

    expect(result.success).toBe(true);
    expect(result.state['entity-1:core:nutrition'].hungerLevel).toBe(40);
  });

  it('should accept zero as modification value', () => {
    const currentState = { 'entity-1:core:nutrition': { hungerLevel: 50 } };
    const planningEffects = [
      {
        type: 'MODIFY_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:nutrition',
          field: 'hungerLevel',
          mode: 'set',
          value: 0,
        },
      },
    ];
    const context = { actor: 'entity-1' };

    mockParameterResolution.resolve.mockReturnValueOnce('entity-1');

    const result = simulator.simulateEffects(
      currentState,
      planningEffects,
      context
    );

    expect(result.success).toBe(true);
    expect(result.state['entity-1:core:nutrition'].hungerLevel).toBe(0);
  });
});

describe('PlanningEffectsSimulator - Modification Application Safety', () => {
  let testBed;
  let simulator;
  let mockLogger;
  let mockParameterResolution;
  let mockContextAssembly;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    mockParameterResolution = testBed.createMock(
      'IParameterResolutionService',
      ['resolve', 'clearCache']
    );
    mockContextAssembly = testBed.createMock(
      'IContextAssemblyService',
      ['assemblePlanningContext']
    );

    simulator = new PlanningEffectsSimulator({
      parameterResolutionService: mockParameterResolution,
      contextAssemblyService: mockContextAssembly,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should detect overflow in increment mode', () => {
    const currentState = {
      'entity-1:core:nutrition': { hungerLevel: Number.MAX_SAFE_INTEGER },
    };
    const planningEffects = [
      {
        type: 'MODIFY_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:nutrition',
          field: 'hungerLevel',
          mode: 'increment',
          value: 1,
        },
      },
    ];
    const context = { actor: 'entity-1' };

    mockParameterResolution.resolve.mockReturnValueOnce('entity-1');

    const result = simulator.simulateEffects(
      currentState,
      planningEffects,
      context
    );

    // Should succeed but skip the modification
    expect(result.success).toBe(true);
    expect(result.state['entity-1:core:nutrition'].hungerLevel).toBe(
      Number.MAX_SAFE_INTEGER
    );
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('overflow'),
      expect.any(Object)
    );
  });

  it('should detect underflow in decrement mode', () => {
    const currentState = {
      'entity-1:core:nutrition': { hungerLevel: Number.MIN_SAFE_INTEGER },
    };
    const planningEffects = [
      {
        type: 'MODIFY_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:nutrition',
          field: 'hungerLevel',
          mode: 'decrement',
          value: 1,
        },
      },
    ];
    const context = { actor: 'entity-1' };

    mockParameterResolution.resolve.mockReturnValueOnce('entity-1');

    const result = simulator.simulateEffects(
      currentState,
      planningEffects,
      context
    );

    // Should succeed but skip the modification
    expect(result.success).toBe(true);
    expect(result.state['entity-1:core:nutrition'].hungerLevel).toBe(
      Number.MIN_SAFE_INTEGER
    );
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('underflow'),
      expect.any(Object)
    );
  });

  it('should handle set mode with valid value', () => {
    const currentState = { 'entity-1:core:nutrition': { hungerLevel: 50 } };
    const planningEffects = [
      {
        type: 'MODIFY_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:nutrition',
          field: 'hungerLevel',
          mode: 'set',
          value: 75,
        },
      },
    ];
    const context = { actor: 'entity-1' };

    mockParameterResolution.resolve.mockReturnValueOnce('entity-1');

    const result = simulator.simulateEffects(
      currentState,
      planningEffects,
      context
    );

    expect(result.success).toBe(true);
    expect(result.state['entity-1:core:nutrition'].hungerLevel).toBe(75);
  });

  it('should handle increment mode with valid value', () => {
    const currentState = { 'entity-1:core:nutrition': { hungerLevel: 50 } };
    const planningEffects = [
      {
        type: 'MODIFY_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:nutrition',
          field: 'hungerLevel',
          mode: 'increment',
          value: 25,
        },
      },
    ];
    const context = { actor: 'entity-1' };

    mockParameterResolution.resolve.mockReturnValueOnce('entity-1');

    const result = simulator.simulateEffects(
      currentState,
      planningEffects,
      context
    );

    expect(result.success).toBe(true);
    expect(result.state['entity-1:core:nutrition'].hungerLevel).toBe(75);
  });

  it('should handle decrement mode with valid value', () => {
    const currentState = { 'entity-1:core:nutrition': { hungerLevel: 50 } };
    const planningEffects = [
      {
        type: 'MODIFY_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:nutrition',
          field: 'hungerLevel',
          mode: 'decrement',
          value: 25,
        },
      },
    ];
    const context = { actor: 'entity-1' };

    mockParameterResolution.resolve.mockReturnValueOnce('entity-1');

    const result = simulator.simulateEffects(
      currentState,
      planningEffects,
      context
    );

    expect(result.success).toBe(true);
    expect(result.state['entity-1:core:nutrition'].hungerLevel).toBe(25);
  });

  it('should default missing field to 0 for increment mode', () => {
    const currentState = { 'entity-1:core:nutrition': {} };
    const planningEffects = [
      {
        type: 'MODIFY_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:nutrition',
          field: 'hungerLevel',
          mode: 'increment',
          value: 10,
        },
      },
    ];
    const context = { actor: 'entity-1' };

    mockParameterResolution.resolve.mockReturnValueOnce('entity-1');

    const result = simulator.simulateEffects(
      currentState,
      planningEffects,
      context
    );

    expect(result.success).toBe(true);
    expect(result.state['entity-1:core:nutrition'].hungerLevel).toBe(10);
  });

  it('should default missing field to 0 for decrement mode', () => {
    const currentState = { 'entity-1:core:nutrition': {} };
    const planningEffects = [
      {
        type: 'MODIFY_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:nutrition',
          field: 'hungerLevel',
          mode: 'decrement',
          value: 10,
        },
      },
    ];
    const context = { actor: 'entity-1' };

    mockParameterResolution.resolve.mockReturnValueOnce('entity-1');

    const result = simulator.simulateEffects(
      currentState,
      planningEffects,
      context
    );

    expect(result.success).toBe(true);
    expect(result.state['entity-1:core:nutrition'].hungerLevel).toBe(-10);
  });
});

describe('PlanningEffectsSimulator - Edge Cases', () => {
  let testBed;
  let simulator;
  let mockLogger;
  let mockParameterResolution;
  let mockContextAssembly;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    mockParameterResolution = testBed.createMock(
      'IParameterResolutionService',
      ['resolve', 'clearCache']
    );
    mockContextAssembly = testBed.createMock(
      'IContextAssemblyService',
      ['assemblePlanningContext']
    );

    simulator = new PlanningEffectsSimulator({
      parameterResolutionService: mockParameterResolution,
      contextAssemblyService: mockContextAssembly,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should skip modification when component is missing from state', () => {
    const currentState = {};
    const planningEffects = [
      {
        type: 'MODIFY_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:nutrition',
          field: 'hungerLevel',
          mode: 'increment',
          value: 10,
        },
      },
    ];
    const context = { actor: 'entity-1' };

    mockParameterResolution.resolve.mockReturnValueOnce('entity-1');

    const result = simulator.simulateEffects(
      currentState,
      planningEffects,
      context
    );

    // Should create component and apply modification
    expect(result.success).toBe(true);
    expect(result.state['entity-1:core:nutrition'].hungerLevel).toBe(10);
  });

  it('should handle nested field key modifications with overflow detection', () => {
    const currentState = {
      'entity-1:core:nutrition:hungerLevel': Number.MAX_SAFE_INTEGER,
    };
    const planningEffects = [
      {
        type: 'MODIFY_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:nutrition',
          field: 'hungerLevel',
          mode: 'increment',
          value: 1,
        },
      },
    ];
    const context = { actor: 'entity-1' };

    mockParameterResolution.resolve.mockReturnValueOnce('entity-1');

    const result = simulator.simulateEffects(
      currentState,
      planningEffects,
      context
    );

    expect(result.success).toBe(true);
    expect(result.state['entity-1:core:nutrition:hungerLevel']).toBe(
      Number.MAX_SAFE_INTEGER
    );
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('overflow'),
      expect.any(Object)
    );
  });

  it('should handle multiple modifications with some failures gracefully', () => {
    const currentState = {
      'entity-1:core:nutrition': { hungerLevel: 50, satiation: 50 },
    };
    const planningEffects = [
      {
        type: 'MODIFY_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:nutrition',
          field: 'hungerLevel',
          mode: 'increment', // Changed from 'set' - type validation only applies to increment/decrement
          value: 'invalid', // This will fail type validation
        },
      },
      {
        type: 'MODIFY_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:nutrition',
          field: 'satiation',
          mode: 'increment',
          value: 10, // This should succeed
        },
      },
    ];
    const context = { actor: 'entity-1' };

    mockParameterResolution.resolve.mockReturnValueOnce('entity-1');

    const result = simulator.simulateEffects(
      currentState,
      planningEffects,
      context
    );

    // First effect should fail, second should be skipped due to first failure
    expect(result.success).toBe(false);
    expect(result.error).toContain('type validation failed');
  });

  it('should preserve immutability when modification is skipped', () => {
    const currentState = {
      'entity-1:core:nutrition': { hungerLevel: Number.MAX_SAFE_INTEGER },
    };
    const originalState = JSON.parse(JSON.stringify(currentState));
    const planningEffects = [
      {
        type: 'MODIFY_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:nutrition',
          field: 'hungerLevel',
          mode: 'increment',
          value: 1,
        },
      },
    ];
    const context = { actor: 'entity-1' };

    mockParameterResolution.resolve.mockReturnValueOnce('entity-1');

    const result = simulator.simulateEffects(
      currentState,
      planningEffects,
      context
    );

    // Original state should not be mutated
    expect(currentState).toEqual(originalState);
    // Result state should be a new object
    expect(result.state).not.toBe(currentState);
  });

  it('should handle non-numeric current value by defaulting to 0', () => {
    const currentState = {
      'entity-1:core:nutrition': { hungerLevel: 'not a number' },
    };
    const planningEffects = [
      {
        type: 'MODIFY_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:nutrition',
          field: 'hungerLevel',
          mode: 'increment',
          value: 10,
        },
      },
    ];
    const context = { actor: 'entity-1' };

    mockParameterResolution.resolve.mockReturnValueOnce('entity-1');

    const result = simulator.simulateEffects(
      currentState,
      planningEffects,
      context
    );

    // Should treat non-numeric current value as 0 and apply increment
    expect(result.success).toBe(true);
    expect(result.state['entity-1:core:nutrition'].hungerLevel).toBe(10);
  });
});
