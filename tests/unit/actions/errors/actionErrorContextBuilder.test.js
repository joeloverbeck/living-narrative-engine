/**
 * @file Unit tests for ActionErrorContextBuilder
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ActionErrorContextBuilder } from '../../../../src/actions/errors/actionErrorContextBuilder.js';
import {
  ERROR_PHASES,
  EVALUATION_STEP_TYPES,
} from '../../../../src/actions/errors/actionErrorTypes.js';
import { TraceContext } from '../../../../src/actions/tracing/traceContext.js';

describe('ActionErrorContextBuilder', () => {
  let builder;
  let mockEntityManager;
  let mockLogger;
  let mockFixSuggestionEngine;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
    };

    mockEntityManager = {
      getEntity: jest.fn(),
      getAllComponents: jest.fn(),
      // Required by ActionErrorContextBuilder constructor validation
      getEntityInstance: jest.fn(),
      getAllComponentTypesForEntity: jest.fn(),
      getComponentData: jest.fn(),
    };

    mockFixSuggestionEngine = {
      suggestFixes: jest.fn().mockReturnValue([]),
    };

    builder = new ActionErrorContextBuilder({
      entityManager: mockEntityManager,
      logger: mockLogger,
      fixSuggestionEngine: mockFixSuggestionEngine,
    });
  });

  describe('buildErrorContext', () => {
    const mockError = new Error('Test error');
    const mockActionDef = {
      id: 'core:move',
      name: 'Move',
      scope: 'adjacent',
      prerequisites: [],
    };
    const actorId = 'actor123';

    beforeEach(() => {
      const mockComponents = {
        'core:location': { value: 'room1' },
        'core:health': { value: 100, max: 100 },
        'core:inventory': { items: [] },
      };

      mockEntityManager.getEntity.mockReturnValue({
        id: actorId,
        type: 'character',
      });

      mockEntityManager.getAllComponents.mockReturnValue(mockComponents);

      // Set up mocks for ActionErrorContextBuilder required methods
      mockEntityManager.getEntityInstance.mockReturnValue({
        id: actorId,
        type: 'character',
      });

      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue(
        Object.keys(mockComponents)
      );

      mockEntityManager.getComponentData.mockImplementation(
        (id, componentType) => {
          return mockComponents[componentType];
        }
      );

      mockFixSuggestionEngine.suggestFixes.mockReturnValue([
        {
          type: 'missing_component',
          description: 'Add missing component',
          details: {},
          confidence: 0.8,
        },
      ]);
    });

    it('should build basic error context without trace', () => {
      const context = builder.buildErrorContext({
        error: mockError,
        actionDef: mockActionDef,
        actorId,
        phase: ERROR_PHASES.VALIDATION,
      });

      expect(context).toMatchObject({
        actionId: 'core:move',
        targetId: null,
        error: mockError,
        actionDefinition: mockActionDef,
        phase: ERROR_PHASES.VALIDATION,
        timestamp: expect.any(Number),
      });

      expect(context.actorSnapshot).toMatchObject({
        id: actorId,
        location: 'room1',
        components: expect.any(Object),
        metadata: {
          entityType: 'character',
          capturedAt: expect.any(Number),
        },
      });

      expect(context.suggestedFixes).toHaveLength(1);
      expect(context.environmentContext).toMatchObject({
        errorName: 'Error',
        phase: ERROR_PHASES.VALIDATION,
      });
    });

    it('should include target ID when provided', () => {
      const targetId = 'target456';
      const context = builder.buildErrorContext({
        error: mockError,
        actionDef: mockActionDef,
        actorId,
        phase: ERROR_PHASES.VALIDATION,
        targetId,
      });

      expect(context.targetId).toBe(targetId);
    });

    it('should include additional context when provided', () => {
      const additionalContext = {
        customField: 'customValue',
        debugInfo: { test: true },
      };

      const context = builder.buildErrorContext({
        error: mockError,
        actionDef: mockActionDef,
        actorId,
        phase: ERROR_PHASES.DISCOVERY,
        additionalContext,
      });

      expect(context.environmentContext).toMatchObject({
        customField: 'customValue',
        debugInfo: { test: true },
      });
    });

    it('should extract evaluation trace from TraceContext', () => {
      const trace = new TraceContext();
      trace.step('Starting prerequisite check', 'PrerequisiteService');
      trace.success('Prerequisite passed', 'PrerequisiteService', {
        result: true,
      });
      trace.failure('Scope resolution failed', 'ScopeEngine', { targets: [] });

      const context = builder.buildErrorContext({
        error: mockError,
        actionDef: mockActionDef,
        actorId,
        phase: ERROR_PHASES.VALIDATION,
        trace,
      });

      expect(context.evaluationTrace.steps).toHaveLength(3);
      expect(context.evaluationTrace.failurePoint).toBe(
        'Scope resolution failed'
      );
      expect(context.evaluationTrace.steps[0]).toMatchObject({
        type: EVALUATION_STEP_TYPES.PREREQUISITE,
        message: 'Starting prerequisite check',
        success: true,
      });
      expect(context.evaluationTrace.steps[2]).toMatchObject({
        success: false,
      });
    });

    it('should handle entity manager errors gracefully', () => {
      mockEntityManager.getEntity.mockImplementation(() => {
        throw new Error('Entity not found');
      });
      mockEntityManager.getEntityInstance.mockImplementation(() => {
        throw new Error('Entity not found');
      });

      const context = builder.buildErrorContext({
        error: mockError,
        actionDef: mockActionDef,
        actorId,
        phase: ERROR_PHASES.VALIDATION,
      });

      expect(context.actorSnapshot).toMatchObject({
        id: actorId,
        components: {},
        location: 'unknown',
        metadata: {
          error: 'Failed to capture snapshot',
        },
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create complete actor snapshot'),
        expect.any(Error)
      );
    });

    it('should sanitize large components', () => {
      const largeString = 'x'.repeat(2000);
      const largeArray = new Array(200).fill('item');

      const testComponents = {
        'core:description': { text: largeString },
        'core:inventory': { items: largeArray },
        'core:normal': { value: 'normal' },
      };

      mockEntityManager.getAllComponents.mockReturnValue(testComponents);
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue(
        Object.keys(testComponents)
      );
      mockEntityManager.getComponentData.mockImplementation(
        (id, componentType) => {
          return testComponents[componentType];
        }
      );

      const context = builder.buildErrorContext({
        error: mockError,
        actionDef: mockActionDef,
        actorId,
        phase: ERROR_PHASES.VALIDATION,
      });

      const components = context.actorSnapshot.components;

      // String should be truncated
      expect(components['core:description'].text).toContain('...(truncated)');
      expect(components['core:description'].text.length).toBeLessThan(1100);

      // Array should be truncated
      expect(components['core:inventory'].items).toHaveLength(101); // 100 items + truncation marker
      expect(components['core:inventory'].items[100]).toMatchObject({
        _truncated: true,
        _originalLength: 200,
      });

      // Normal component should be unchanged
      expect(components['core:normal']).toEqual({ value: 'normal' });
    });

    it('should handle very large components by marking them as truncated', () => {
      // Create a component that would be too large when serialized
      const hugeComponent = {};
      for (let i = 0; i < 1000; i++) {
        hugeComponent[`field${i}`] = 'x'.repeat(100);
      }

      const testComponents = {
        'core:huge': hugeComponent,
      };

      mockEntityManager.getAllComponents.mockReturnValue(testComponents);
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue(
        Object.keys(testComponents)
      );
      mockEntityManager.getComponentData.mockImplementation(
        (id, componentType) => {
          return testComponents[componentType];
        }
      );

      const context = builder.buildErrorContext({
        error: mockError,
        actionDef: mockActionDef,
        actorId,
        phase: ERROR_PHASES.VALIDATION,
      });

      expect(context.actorSnapshot.components['core:huge']).toMatchObject({
        _truncated: true,
        _reason: 'Component too large',
        _size: expect.any(Number),
      });
    });

    it('should flag components that cannot be serialized', () => {
      const circularComponent = {};
      circularComponent.self = circularComponent;

      const testComponents = {
        'core:location': { value: 'room1' },
        'core:circular': circularComponent,
      };

      mockEntityManager.getAllComponents.mockReturnValue(testComponents);
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue(
        Object.keys(testComponents)
      );
      mockEntityManager.getComponentData.mockImplementation(
        (id, componentType) => testComponents[componentType]
      );

      const context = builder.buildErrorContext({
        error: mockError,
        actionDef: mockActionDef,
        actorId,
        phase: ERROR_PHASES.VALIDATION,
      });

      expect(context.actorSnapshot.components['core:circular']).toEqual({
        _error: true,
        _reason: 'Failed to serialize component',
      });
    });

    it('should preserve null component values', () => {
      const testComponents = {
        'core:location': { value: 'room1' },
        'core:optional': null,
      };

      mockEntityManager.getAllComponents.mockReturnValue(testComponents);
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue(
        Object.keys(testComponents)
      );
      mockEntityManager.getComponentData.mockImplementation(
        (id, componentType) => testComponents[componentType]
      );

      const context = builder.buildErrorContext({
        error: mockError,
        actionDef: mockActionDef,
        actorId,
        phase: ERROR_PHASES.VALIDATION,
      });

      expect(context.actorSnapshot.components['core:optional']).toBeNull();
    });

    it('should include error stack in environment context', () => {
      const errorWithStack = new Error('Test error with stack');
      errorWithStack.stack = 'Error: Test error with stack\n    at test.js:123';

      const context = builder.buildErrorContext({
        error: errorWithStack,
        actionDef: mockActionDef,
        actorId,
        phase: ERROR_PHASES.EXECUTION,
      });

      expect(context.environmentContext.errorStack).toBe(errorWithStack.stack);
    });

    it('should handle missing action definition and entity type defaults', () => {
      mockEntityManager.getEntityInstance.mockReturnValue({ id: actorId });
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
        'core:location',
      ]);
      mockEntityManager.getComponentData.mockImplementation(() => ({
        value: 'fallback-location',
      }));

      const nowSpy = jest.spyOn(Date, 'now');
      nowSpy.mockImplementationOnce(() => 4000);
      nowSpy.mockImplementationOnce(() => 5000);
      nowSpy.mockImplementation(() => 5000);

      const context = builder.buildErrorContext({
        error: mockError,
        actionDef: null,
        actorId,
        phase: ERROR_PHASES.VALIDATION,
      });

      expect(context.actionId).toBeNull();
      expect(context.actionDefinition).toBeNull();
      expect(context.actorSnapshot.metadata.entityType).toBe('unknown');
      expect(context.actorSnapshot.location).toBe('fallback-location');

      nowSpy.mockRestore();
    });

    it('should handle empty trace logs by falling back to current time', () => {
      const trace = { logs: [] };
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
        'core:location',
      ]);
      mockEntityManager.getComponentData.mockImplementation(() => ({
        value: 'room1',
      }));

      const nowSpy = jest.spyOn(Date, 'now');
      nowSpy.mockImplementationOnce(() => 6000);
      nowSpy.mockImplementationOnce(() => 7000);
      nowSpy.mockImplementationOnce(() => 8000);
      nowSpy.mockImplementation(() => 8000);

      const context = builder.buildErrorContext({
        error: mockError,
        actionDef: mockActionDef,
        actorId,
        phase: ERROR_PHASES.VALIDATION,
        trace,
      });

      expect(context.evaluationTrace).toEqual({
        steps: [],
        finalContext: {},
        failurePoint: 'Unknown',
      });
      expect(nowSpy).toHaveBeenCalledTimes(3);

      nowSpy.mockRestore();
    });

    it('should properly categorize trace log types into evaluation steps', () => {
      const trace = new TraceContext();
      trace.info('Checking JSON Logic', 'JsonLogicService');
      trace.step('Resolving condition_ref', 'ConditionResolver');
      trace.data('Evaluation context', 'ContextBuilder', { actor: actorId });

      const context = builder.buildErrorContext({
        error: mockError,
        actionDef: mockActionDef,
        actorId,
        phase: ERROR_PHASES.VALIDATION,
        trace,
      });

      const steps = context.evaluationTrace.steps;
      expect(steps[0].type).toBe(EVALUATION_STEP_TYPES.JSON_LOGIC);
      expect(steps[1].type).toBe(EVALUATION_STEP_TYPES.CONDITION_REF);
      expect(context.evaluationTrace.finalContext).toMatchObject({
        actor: actorId,
      });
    });

    it('should default evaluation step type to validation when no keywords match', () => {
      const trace = new TraceContext();
      trace.step('Generic evaluation underway', 'GenericService');

      const context = builder.buildErrorContext({
        error: mockError,
        actionDef: mockActionDef,
        actorId,
        phase: ERROR_PHASES.VALIDATION,
        trace,
      });

      const [singleStep] = context.evaluationTrace.steps;
      expect(singleStep.type).toBe(EVALUATION_STEP_TYPES.VALIDATION);
      expect(singleStep.message).toBe('Generic evaluation underway');
    });
  });
});
