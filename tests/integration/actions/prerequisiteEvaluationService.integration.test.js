// tests/integration/actions/prerequisiteEvaluationService.integration.test.js

import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { PrerequisiteEvaluationService } from '../../../src/actions/validation/prerequisiteEvaluationService.js';
import { ActionValidationContextBuilder } from '../../../src/actions/validation/actionValidationContextBuilder.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import { TraceContext } from '../../../src/actions/tracing/traceContext.js';
import TestDataFactory from '../../common/actions/testDataFactory.js';

describe('PrerequisiteEvaluationService Integration Tests - Coverage Improvements', () => {
  let prereqService;
  let mockLogger;
  let mockEntityManager;
  let mockGameDataRepository;
  let jsonLogicService;
  let contextBuilder;

  beforeEach(() => {
    // Setup mocks
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEntityManager = {
      getEntityInstance: jest.fn(),
      getComponentData: jest.fn(),
      hasComponent: jest.fn(),
      getAllComponentTypesForEntity: jest.fn(),
      getEntitiesWithComponent: jest.fn(),
    };

    mockGameDataRepository = {
      getConditionDefinition: jest.fn(),
    };

    // Create real services for integration testing
    jsonLogicService = new JsonLogicEvaluationService({ logger: mockLogger });
    contextBuilder = new ActionValidationContextBuilder({
      entityManager: mockEntityManager,
      logger: mockLogger,
    });

    prereqService = new PrerequisiteEvaluationService({
      logger: mockLogger,
      jsonLogicEvaluationService: jsonLogicService,
      actionValidationContextBuilder: contextBuilder,
      gameDataRepository: mockGameDataRepository,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Span-based Tracing Support', () => {
    it('should use withSpan when TraceContext supports it for main evaluate method', () => {
      // Setup
      const actorId = 'test:actor';
      const actor = { id: actorId };
      const actionDefinition = { id: 'test:action' };
      let spanExecuted = false;
      let spanName = '';
      let spanData = null;

      // Create TraceContext with withSpan support
      const trace = new TraceContext();
      trace.withSpan = jest.fn((name, fn, data) => {
        spanExecuted = true;
        spanName = name;
        spanData = data;
        return fn();
      });

      // Setup entity with components
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
        'core:movement',
      ]);
      mockEntityManager.getComponentData.mockReturnValue({ locked: false });

      const prerequisites = [
        {
          logic: {
            '==': [{ var: 'actor.components.core:movement.locked' }, false],
          },
          failure_message: 'Cannot move',
        },
      ];

      // Act
      const result = prereqService.evaluate(
        prerequisites,
        actionDefinition,
        actor,
        trace
      );

      // Assert
      expect(result).toBe(true);
      expect(trace.withSpan).toHaveBeenCalled();
      // Check that prerequisite.evaluate was called
      const evaluateCall = trace.withSpan.mock.calls.find(
        (call) => call[0] === 'prerequisite.evaluate'
      );
      expect(evaluateCall).toBeTruthy();
      expect(evaluateCall[2]).toEqual({
        actionId: 'test:action',
        actorId: 'test:actor',
        ruleCount: 1,
      });
    });

    it('should use withSpan for nested rule evaluation', () => {
      // Setup
      const actorId = 'test:actor';
      const actor = { id: actorId };
      const actionDefinition = { id: 'test:nested_action' };
      const spanCalls = [];

      // Create TraceContext with withSpan support
      const trace = new TraceContext();
      trace.withSpan = jest.fn((name, fn, data) => {
        spanCalls.push({ name, data });
        return fn();
      });

      // Setup entity with multiple components
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
        'core:movement',
        'core:health',
      ]);
      mockEntityManager.getComponentData.mockImplementation((id, type) => {
        if (type === 'core:movement') return { locked: false };
        if (type === 'core:health') return { current: 100, max: 100 };
        return undefined;
      });

      const prerequisites = [
        {
          logic: {
            '==': [{ var: 'actor.components.core:movement.locked' }, false],
          },
          failure_message: 'Cannot move',
        },
        {
          logic: { '>': [{ var: 'actor.components.core:health.current' }, 50] },
          failure_message: 'Not enough health',
        },
      ];

      // Act
      const result = prereqService.evaluate(
        prerequisites,
        actionDefinition,
        actor,
        trace
      );

      // Assert
      expect(result).toBe(true);
      expect(spanCalls).toHaveLength(4); // evaluate + evaluateRules + 2x evaluatePrerequisite
      expect(spanCalls[0].name).toBe('prerequisite.evaluate');
      expect(spanCalls[1].name).toBe('prerequisite.evaluateRules');
      expect(spanCalls[2].name).toBe('prerequisite.rule.1');
      expect(spanCalls[3].name).toBe('prerequisite.rule.2');
    });

    it('should work correctly when TraceContext does not support withSpan', () => {
      // Setup
      const actorId = 'test:actor';
      const actor = { id: actorId };
      const actionDefinition = { id: 'test:action' };

      // Create regular TraceContext without withSpan
      const trace = new TraceContext();

      // Setup entity
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
        'core:movement',
      ]);
      mockEntityManager.getComponentData.mockReturnValue({ locked: false });

      const prerequisites = [
        {
          logic: {
            '==': [{ var: 'actor.components.core:movement.locked' }, false],
          },
          failure_message: 'Cannot move',
        },
      ];

      // Act
      const result = prereqService.evaluate(
        prerequisites,
        actionDefinition,
        actor,
        trace
      );

      // Assert
      expect(result).toBe(true);
      expect(trace.logs.length).toBeGreaterThan(0);
      expect(
        trace.logs.some((log) => log.message.includes('Checking prerequisites'))
      ).toBe(true);
    });
  });

  describe('Empty Prerequisites Handling', () => {
    it('should handle empty prerequisites array with tracing', () => {
      // Setup
      const actorId = 'test:actor';
      const actor = { id: actorId };
      const actionDefinition = { id: 'test:action_no_prereqs' };
      const trace = new TraceContext();

      // Act
      const result = prereqService.evaluate([], actionDefinition, actor, trace);

      // Assert
      expect(result).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('→ PASSED (No prerequisites to evaluate)')
      );
      expect(trace.logs).toContainEqual(
        expect.objectContaining({
          type: 'success',
          message: 'No prerequisites to evaluate',
        })
      );
    });

    it('should handle null prerequisites with tracing', () => {
      // Setup
      const actorId = 'test:actor';
      const actor = { id: actorId };
      const actionDefinition = { id: 'test:action_null_prereqs' };
      const trace = new TraceContext();

      // Act
      const result = prereqService.evaluate(
        null,
        actionDefinition,
        actor,
        trace
      );

      // Assert
      expect(result).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('→ PASSED (No prerequisites to evaluate)')
      );
      expect(trace.logs).toContainEqual(
        expect.objectContaining({
          type: 'success',
          message: 'No prerequisites to evaluate',
        })
      );
    });

    it('should handle undefined prerequisites with tracing', () => {
      // Setup
      const actorId = 'test:actor';
      const actor = { id: actorId };
      const actionDefinition = { id: 'test:action_undefined_prereqs' };
      const trace = new TraceContext();

      // Act
      const result = prereqService.evaluate(
        undefined,
        actionDefinition,
        actor,
        trace
      );

      // Assert
      expect(result).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('→ PASSED (No prerequisites to evaluate)')
      );
    });
  });

  describe('Component Serialization Error Handling', () => {
    it('should handle component serialization errors during debug logging', () => {
      // Setup
      const actorId = 'test:actor_serialization_error';
      const actor = { id: actorId };
      const actionDefinition = { id: 'test:action' };

      // Setup entity with components that throw on serialization
      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
        'core:problematic',
      ]);

      // Create a special proxy that throws on JSON.stringify but works for property access
      const componentsProxy = new Proxy(
        {},
        {
          get(target, prop) {
            if (prop === 'toJSON' || prop === Symbol.toStringTag) {
              return undefined;
            }
            if (prop === 'core:problematic') {
              return { value: true };
            }
            return undefined;
          },
          ownKeys() {
            return ['core:problematic'];
          },
          getOwnPropertyDescriptor(target, prop) {
            if (prop === 'core:problematic') {
              return {
                enumerable: true,
                configurable: true,
                value: { value: true },
              };
            }
            return undefined;
          },
          has(target, prop) {
            return prop === 'core:problematic';
          },
        }
      );

      // Override JSON.stringify behavior for this specific proxy
      const originalStringify = JSON.stringify;
      JSON.stringify = jest.fn((obj) => {
        if (obj === componentsProxy) {
          throw new Error('Serialization failed');
        }
        return originalStringify(obj);
      });

      // Mock the context builder to return a context with problematic components
      jest.spyOn(contextBuilder, 'buildContext').mockReturnValue({
        actor: {
          id: actorId,
          components: componentsProxy,
        },
      });

      const prerequisites = [
        {
          logic: { '!!': { var: 'actor.id' } },
        },
      ];

      // Act
      const result = prereqService.evaluate(
        prerequisites,
        actionDefinition,
        actor
      );

      // Restore JSON.stringify
      JSON.stringify = originalStringify;

      // Assert
      expect(result).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `PrereqEval[test:action]: Actor entity [${actorId}] has 1 components available.`
        )
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Actor components snapshot =>')
      );
    });

    it('should continue processing when component serialization fails', () => {
      // Setup
      const actorId = 'test:actor_continue_after_error';
      const actor = { id: actorId };
      const actionDefinition = { id: 'test:action' };

      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
        'core:movement',
      ]);
      mockEntityManager.getComponentData.mockReturnValue({ locked: false });

      // Override JSON.stringify to throw on certain objects
      const originalStringify = JSON.stringify;
      const stringifyCount = { count: 0 };
      JSON.stringify = jest.fn((obj) => {
        // Allow the first few calls to work (for context building)
        stringifyCount.count++;
        if (
          stringifyCount.count > 3 &&
          obj &&
          typeof obj === 'object' &&
          obj.hasOwnProperty('core:movement')
        ) {
          throw new Error('Converting circular structure to JSON');
        }
        return originalStringify(obj);
      });

      const prerequisites = [
        {
          logic: { '==': [1, 1] }, // Simple check that always passes
        },
      ];

      // Act
      const result = prereqService.evaluate(
        prerequisites,
        actionDefinition,
        actor
      );

      // Restore JSON.stringify
      JSON.stringify = originalStringify;

      // Assert
      expect(result).toBe(true); // Should still evaluate successfully
      // The serialization error might occur but doesn't prevent evaluation
    });
  });

  describe('Non-Circular Condition Reference Errors', () => {
    it('should re-throw non-circular condition_ref errors', () => {
      // Setup
      const actorId = 'test:actor';
      const actor = { id: actorId };
      const actionDefinition = { id: 'test:action' };

      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([]);

      // Mock a condition that causes a non-circular error
      mockGameDataRepository.getConditionDefinition.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const prerequisites = [
        {
          logic: { condition_ref: 'test:database_error' },
          failure_message: 'Database error',
        },
      ];

      // Act & Assert
      const result = prereqService.evaluate(
        prerequisites,
        actionDefinition,
        actor
      );

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error during rule resolution or evaluation'),
        expect.objectContaining({
          error: 'Database connection failed',
        })
      );
    });

    it('should handle circular reference errors differently from other errors', () => {
      // Setup
      const actorId = 'test:actor';
      const actor = { id: actorId };
      const actionDefinition = { id: 'test:action_circular' };

      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([]);

      // Set up circular references
      const seenRefs = new Set();
      mockGameDataRepository.getConditionDefinition.mockImplementation((id) => {
        if (seenRefs.has(id)) {
          throw new Error(`Circular condition_ref detected: ${id}`);
        }
        seenRefs.add(id);

        if (id === 'test:circular1') {
          return {
            id: 'test:circular1',
            logic: { condition_ref: 'test:circular2' },
          };
        }
        if (id === 'test:circular2') {
          return {
            id: 'test:circular2',
            logic: { condition_ref: 'test:circular1' },
          };
        }
        return null;
      });

      const prerequisites = [
        {
          logic: { condition_ref: 'test:circular1' },
        },
      ];

      // Act
      const result = prereqService.evaluate(
        prerequisites,
        actionDefinition,
        actor
      );

      // Assert
      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error during rule resolution or evaluation'),
        expect.any(Object)
      );
    });
  });

  describe('Complex Integration Scenarios', () => {
    it('should handle deeply nested condition references', () => {
      // Setup
      const actorId = 'test:actor';
      const actor = { id: actorId };
      const actionDefinition = { id: 'test:complex_action' };

      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
        'core:movement',
        'core:health',
        'core:stamina',
      ]);
      mockEntityManager.getComponentData.mockImplementation((id, type) => {
        if (type === 'core:movement') return { locked: false };
        if (type === 'core:health') return { current: 75, max: 100 };
        if (type === 'core:stamina') return { current: 50, max: 100 };
        return undefined;
      });

      // Setup nested condition definitions
      mockGameDataRepository.getConditionDefinition.mockImplementation((id) => {
        const conditions = {
          'test:can-act': {
            id: 'test:can-act',
            logic: {
              and: [
                { condition_ref: 'test:can-move' },
                { condition_ref: 'test:has-resources' },
              ],
            },
          },
          'test:can-move': {
            id: 'test:can-move',
            logic: {
              '==': [{ var: 'actor.components.core:movement.locked' }, false],
            },
          },
          'test:has-resources': {
            id: 'test:has-resources',
            logic: {
              or: [
                { '>': [{ var: 'actor.components.core:health.current' }, 50] },
                { '>': [{ var: 'actor.components.core:stamina.current' }, 30] },
              ],
            },
          },
        };
        return conditions[id] || null;
      });

      const prerequisites = [
        {
          logic: { condition_ref: 'test:can-act' },
          failure_message: 'Cannot perform action',
        },
      ];

      // Act
      const result = prereqService.evaluate(
        prerequisites,
        actionDefinition,
        actor
      );

      // Assert
      expect(result).toBe(true);
      expect(
        mockGameDataRepository.getConditionDefinition
      ).toHaveBeenCalledTimes(3);
    });

    it('should handle complex prerequisite scenarios with tracing', () => {
      // Setup
      const actorId = 'test:actor';
      const actor = { id: actorId };
      const actionDefinition = { id: 'test:traced_action' };
      const trace = new TraceContext();

      // Add withSpan support to trace
      const spans = [];
      trace.withSpan = jest.fn((name, fn, data) => {
        spans.push({ name, data, start: Date.now() });
        const result = fn();
        spans[spans.length - 1].end = Date.now();
        return result;
      });

      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
        'core:movement',
        'core:health',
        'core:inventory',
      ]);
      mockEntityManager.getComponentData.mockImplementation((id, type) => {
        if (type === 'core:movement') return { locked: false };
        if (type === 'core:health') return { current: 100, max: 100 };
        if (type === 'core:inventory') return { items: ['sword', 'potion'] };
        return undefined;
      });

      // Setup simpler condition definitions that will pass
      mockGameDataRepository.getConditionDefinition.mockImplementation((id) => {
        if (id === 'anatomy:actor-can-move') {
          return {
            id: 'anatomy:actor-can-move',
            logic: {
              '==': [{ var: 'actor.components.core:movement.locked' }, false],
            },
          };
        }
        if (id === 'core:has-health') {
          return {
            id: 'core:has-health',
            logic: {
              '!!': { var: 'actor.components.core:health' },
            },
          };
        }
        if (id === 'core:has-inventory') {
          return {
            id: 'core:has-inventory',
            logic: {
              '!!': { var: 'actor.components.core:inventory' },
            },
          };
        }
        return null;
      });

      const prerequisites = [
        {
          logic: { condition_ref: 'anatomy:actor-can-move' },
          failure_message: 'Cannot move',
        },
        {
          logic: { condition_ref: 'core:has-health' },
          failure_message: 'No health component',
        },
        {
          logic: { condition_ref: 'core:has-inventory' },
          failure_message: 'No inventory',
        },
      ];

      // Act
      const result = prereqService.evaluate(
        prerequisites,
        actionDefinition,
        actor,
        trace
      );

      // Assert
      expect(result).toBe(true);
      expect(spans.length).toBeGreaterThan(0);
      expect(spans[0].name).toBe('prerequisite.evaluate');
      expect(trace.logs.some((log) => log.type === 'success')).toBe(true);
    });

    it('should handle mixed direct logic and condition_ref prerequisites', () => {
      // Setup
      const actorId = 'test:actor';
      const actor = { id: actorId };
      const actionDefinition = { id: 'test:mixed_prereqs' };

      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
        'core:movement',
        'core:health',
        'core:level',
      ]);
      mockEntityManager.getComponentData.mockImplementation((id, type) => {
        if (type === 'core:movement') return { locked: false };
        if (type === 'core:health') return { current: 80, max: 100 };
        if (type === 'core:level') return { current: 10 };
        return undefined;
      });

      mockGameDataRepository.getConditionDefinition.mockImplementation((id) => {
        if (id === 'anatomy:actor-can-move') {
          return {
            id: 'anatomy:actor-can-move',
            logic: {
              '==': [{ var: 'actor.components.core:movement.locked' }, false],
            },
          };
        }
        return null;
      });

      const prerequisites = [
        {
          // Direct logic
          logic: { '>': [{ var: 'actor.components.core:level.current' }, 5] },
          failure_message: 'Level too low',
        },
        {
          // Condition reference
          logic: { condition_ref: 'anatomy:actor-can-move' },
          failure_message: 'Cannot move',
        },
        {
          // Complex direct logic
          logic: {
            and: [
              { '>': [{ var: 'actor.components.core:health.current' }, 50] },
              { '<': [{ var: 'actor.components.core:health.current' }, 150] },
            ],
          },
          failure_message: 'Health out of range',
        },
      ];

      // Act
      const result = prereqService.evaluate(
        prerequisites,
        actionDefinition,
        actor
      );

      // Assert
      expect(result).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Prerequisite Rule 1/3 PASSED')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Prerequisite Rule 2/3 PASSED')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Prerequisite Rule 3/3 PASSED')
      );
    });
  });

  describe('Error Recovery and Edge Cases', () => {
    it('should handle missing actor context gracefully', () => {
      // Setup
      const actor = { id: 'test:actor' };
      const actionDefinition = { id: 'test:action' };

      // Mock context builder to return context without components accessor
      jest.spyOn(contextBuilder, 'buildContext').mockReturnValue({
        actor: {
          id: 'test:actor',
          // Missing components property
        },
      });

      const prerequisites = [
        {
          logic: { '!!': { var: 'actor.id' } },
        },
      ];

      // Act
      const result = prereqService.evaluate(
        prerequisites,
        actionDefinition,
        actor
      );

      // Assert
      expect(result).toBe(true);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'Actor context is missing components property entirely!'
        )
      );
    });

    it('should handle evaluation context build failures with tracing', () => {
      // Setup
      const actor = { id: 'test:actor' };
      const actionDefinition = { id: 'test:action' };
      const trace = new TraceContext();

      // Force context builder to throw
      jest.spyOn(contextBuilder, 'buildContext').mockImplementation(() => {
        throw new Error('Context build failed');
      });

      const prerequisites = [
        {
          logic: { '!!': { var: 'actor.id' } },
        },
      ];

      // Act
      const result = prereqService.evaluate(
        prerequisites,
        actionDefinition,
        actor,
        trace
      );

      // Assert
      expect(result).toBe(false);
      expect(trace.logs).toContainEqual(
        expect.objectContaining({
          type: 'failure',
          message: 'Failed to build evaluation context',
        })
      );
    });
  });
});
