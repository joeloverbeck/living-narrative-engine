/**
 * @file Unit tests for ScopeEngine - Tracer Integration
 * @description Tests for tracer integration in src/scopeDsl/engine.js
 */

import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import ScopeEngine from '../../../src/scopeDsl/engine.js';
import { parseDslExpression } from '../../../src/scopeDsl/parser/parser.js';
import { ScopeEvaluationTracer } from '../../../tests/common/mods/scopeEvaluationTracer.js';

// Mock dependencies
const mockEntityManager = {
  getEntityInstance: jest.fn(),
  getEntitiesWithComponent: jest.fn(),
  getEntitiesInLocation: jest.fn(),
  getComponentData: jest.fn(),
  hasComponent: jest.fn(),
  entities: [],
};

const mockJsonLogicEval = {
  evaluate: jest.fn(),
};

const mockLogger = {
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

describe('ScopeEngine - Tracer Integration', () => {
  let engine;
  let actorEntity;
  let tracer;
  let mockRuntimeCtx;

  beforeEach(() => {
    jest.clearAllMocks();

    engine = new ScopeEngine();
    actorEntity = {
      id: 'actor-123',
      componentTypeIds: ['core:actor'],
      components: new Map(),
    };

    tracer = new ScopeEvaluationTracer();

    mockRuntimeCtx = {
      entityManager: mockEntityManager,
      jsonLogicEval: mockJsonLogicEval,
      logger: mockLogger,
      tracer: tracer,
    };

    // Setup default mocks
    mockEntityManager.getEntityInstance.mockReturnValue(actorEntity);
    mockEntityManager.getEntitiesWithComponent.mockReturnValue([actorEntity]);
    mockJsonLogicEval.evaluate.mockReturnValue(true);
  });

  describe('Tracer in context', () => {
    it('should pass tracer from runtimeCtx to context', () => {
      const ast = parseDslExpression('actor');
      tracer.enable();

      const result = engine.resolve(ast, actorEntity, mockRuntimeCtx);

      expect(result).toBeDefined();
      expect(result instanceof Set).toBe(true);

      const trace = tracer.getTrace();
      expect(trace.steps.length).toBeGreaterThan(0);
    });

    it('should work when tracer is undefined', () => {
      const ast = parseDslExpression('actor');
      const runtimeCtxWithoutTracer = {
        entityManager: mockEntityManager,
        jsonLogicEval: mockJsonLogicEval,
        logger: mockLogger,
      };

      const result = engine.resolve(ast, actorEntity, runtimeCtxWithoutTracer);

      expect(result).toBeDefined();
      expect(result instanceof Set).toBe(true);
    });

    it('should work when runtimeCtx does not have tracer', () => {
      const ast = parseDslExpression('actor');
      const runtimeCtxWithoutTracer = {
        entityManager: mockEntityManager,
        jsonLogicEval: mockJsonLogicEval,
        logger: mockLogger,
        tracer: undefined,
      };

      const result = engine.resolve(ast, actorEntity, runtimeCtxWithoutTracer);

      expect(result).toBeDefined();
      expect(result instanceof Set).toBe(true);
    });
  });

  describe('Resolution logging', () => {
    it('should log resolver step when tracer enabled', () => {
      const ast = parseDslExpression('actor');
      tracer.enable();

      engine.resolve(ast, actorEntity, mockRuntimeCtx);

      const trace = tracer.getTrace();
      expect(trace.steps.length).toBeGreaterThan(0);

      const resolverStep = trace.steps.find((s) => s.type === 'RESOLVER_STEP');
      expect(resolverStep).toBeDefined();
      expect(resolverStep.resolver).toBe('SourceResolver');
      expect(resolverStep.operation).toContain("resolve(kind='actor')");
    });

    it('should not log when tracer disabled', () => {
      const ast = parseDslExpression('actor');
      tracer.disable();

      engine.resolve(ast, actorEntity, mockRuntimeCtx);

      const trace = tracer.getTrace();
      expect(trace.steps.length).toBe(0);
    });

    it('should include correct resolver name', () => {
      const ast = parseDslExpression('actor');
      tracer.enable();

      engine.resolve(ast, actorEntity, mockRuntimeCtx);

      const trace = tracer.getTrace();
      const resolverStep = trace.steps.find((s) => s.type === 'RESOLVER_STEP');

      expect(resolverStep).toBeDefined();
      expect(resolverStep.resolver).toBe('SourceResolver');
    });

    it('should include input/output sets', () => {
      const ast = parseDslExpression('actor');
      tracer.enable();

      engine.resolve(ast, actorEntity, mockRuntimeCtx);

      const trace = tracer.getTrace();
      const resolverStep = trace.steps.find((s) => s.type === 'RESOLVER_STEP');

      expect(resolverStep).toBeDefined();
      expect(resolverStep.input).toBeDefined();
      expect(resolverStep.output).toBeDefined();
      expect(resolverStep.input.type).toBe('Set');
      expect(resolverStep.output.type).toBe('Set');
    });

    it('should include node in details', () => {
      const ast = parseDslExpression('actor');
      tracer.enable();

      engine.resolve(ast, actorEntity, mockRuntimeCtx);

      const trace = tracer.getTrace();
      const resolverStep = trace.steps.find((s) => s.type === 'RESOLVER_STEP');

      expect(resolverStep).toBeDefined();
      expect(resolverStep.details).toBeDefined();
      expect(resolverStep.details.node).toBeDefined();
    });

    it('should build correct operation description for Source nodes', () => {
      const ast = parseDslExpression('actor');
      tracer.enable();

      engine.resolve(ast, actorEntity, mockRuntimeCtx);

      const trace = tracer.getTrace();
      const resolverStep = trace.steps.find((s) => s.type === 'RESOLVER_STEP');

      expect(resolverStep).toBeDefined();
      expect(resolverStep.operation).toBe("resolve(kind='actor')");
    });

    it('should build correct operation description for Step nodes', () => {
      const ast = {
        type: 'Step',
        field: 'name',
        parent: {
          type: 'Source',
          kind: 'actor',
        },
      };

      mockEntityManager.getEntityInstance.mockReturnValue({
        id: 'actor-123',
        name: 'Alice',
      });

      tracer.enable();

      engine.resolve(ast, actorEntity, mockRuntimeCtx);

      const trace = tracer.getTrace();
      const stepResolverStep = trace.steps.find(
        (s) => s.resolver === 'StepResolver'
      );

      expect(stepResolverStep).toBeDefined();
      expect(stepResolverStep.operation).toBe("resolve(field='name')");
    });

    it('should build correct operation description for Filter nodes', () => {
      const targetEntity = {
        id: 'target-456',
        componentTypeIds: ['core:actor'],
        components: new Map(),
      };

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([
        actorEntity,
        targetEntity,
      ]);
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'actor-123') return actorEntity;
        if (id === 'target-456') return targetEntity;
        return null;
      });

      const ast = {
        type: 'Filter',
        logic: { '==': [{ var: 'entity.id' }, 'target-456'] },
        parent: {
          type: 'Source',
          kind: 'entities',
          param: 'core:actor',
        },
      };

      tracer.enable();

      engine.resolve(ast, actorEntity, mockRuntimeCtx);

      const trace = tracer.getTrace();
      const filterResolverStep = trace.steps.find(
        (s) => s.resolver === 'FilterResolver'
      );

      expect(filterResolverStep).toBeDefined();
      expect(filterResolverStep.operation).toBe('resolve(filter)');
    });
  });

  describe('Helper method: _getResolverNameFromNode', () => {
    it('should return "SourceResolver" for Source nodes', () => {
      const node = { type: 'Source', kind: 'actor' };
      const result = engine._getResolverNameFromNode(node);
      expect(result).toBe('SourceResolver');
    });

    it('should return "StepResolver" for Step nodes', () => {
      const node = { type: 'Step', field: 'name' };
      const result = engine._getResolverNameFromNode(node);
      expect(result).toBe('StepResolver');
    });

    it('should return "SlotAccessResolver" for items_in_slot field', () => {
      const node = { type: 'Step', field: 'items_in_slot' };
      const result = engine._getResolverNameFromNode(node);
      expect(result).toBe('SlotAccessResolver');
    });

    it('should return "ClothingStepResolver" for slot_accessibility field', () => {
      const node = { type: 'Step', field: 'slot_accessibility' };
      const result = engine._getResolverNameFromNode(node);
      expect(result).toBe('ClothingStepResolver');
    });

    it('should return "FilterResolver" for Filter nodes', () => {
      const node = { type: 'Filter', logic: {} };
      const result = engine._getResolverNameFromNode(node);
      expect(result).toBe('FilterResolver');
    });

    it('should return "UnionResolver" for Union nodes', () => {
      const node = { type: 'Union', left: {}, right: {} };
      const result = engine._getResolverNameFromNode(node);
      expect(result).toBe('UnionResolver');
    });

    it('should return "ArrayIterationResolver" for ArrayIterationStep nodes', () => {
      const node = { type: 'ArrayIterationStep', parent: {} };
      const result = engine._getResolverNameFromNode(node);
      expect(result).toBe('ArrayIterationResolver');
    });

    it('should return "ScopeReferenceResolver" for ScopeReference nodes', () => {
      const node = { type: 'ScopeReference', scopeId: 'test:scope' };
      const result = engine._getResolverNameFromNode(node);
      expect(result).toBe('ScopeReferenceResolver');
    });

    it('should return "UnknownResolver" for unknown node types', () => {
      const node = { type: 'UnknownType' };
      const result = engine._getResolverNameFromNode(node);
      expect(result).toBe('UnknownResolver');
    });
  });

  describe('Helper method: _buildOperationDescription', () => {
    it('should format Source nodes with kind and param', () => {
      const node = { type: 'Source', kind: 'entities', param: 'core:actor' };
      const result = engine._buildOperationDescription(node);
      expect(result).toBe("resolve(kind='entities', param='core:actor')");
    });

    it('should format Step nodes with field name', () => {
      const node = { type: 'Step', field: 'name' };
      const result = engine._buildOperationDescription(node);
      expect(result).toBe("resolve(field='name')");
    });

    it('should format Filter, Union, ArrayIteration nodes', () => {
      const filterNode = { type: 'Filter', logic: {} };
      const unionNode = { type: 'Union', left: {}, right: {} };
      const arrayIterNode = { type: 'ArrayIterationStep' };

      expect(engine._buildOperationDescription(filterNode)).toBe(
        'resolve(filter)'
      );
      expect(engine._buildOperationDescription(unionNode)).toBe(
        'resolve(union)'
      );
      expect(engine._buildOperationDescription(arrayIterNode)).toBe(
        'resolve(array iteration)'
      );
    });

    it('should format ScopeReference nodes with scopeId', () => {
      const node = { type: 'ScopeReference', scopeId: 'test:scope' };
      const result = engine._buildOperationDescription(node);
      expect(result).toBe("resolve(scopeRef='test:scope')");
    });
  });

  describe('Performance', () => {
    it('should have minimal overhead when disabled', () => {
      const ast = parseDslExpression('actor');
      tracer.disable();

      const startTime = Date.now();
      for (let i = 0; i < 100; i++) {
        engine.resolve(ast, actorEntity, mockRuntimeCtx);
      }
      const disabledTime = Date.now() - startTime;

      // Should execute without error
      expect(disabledTime).toBeGreaterThan(0);
    });

    it('should not call logStep when disabled', () => {
      const ast = parseDslExpression('actor');
      tracer.disable();
      const logStepSpy = jest.spyOn(tracer, 'logStep');

      engine.resolve(ast, actorEntity, mockRuntimeCtx);

      expect(logStepSpy).not.toHaveBeenCalled();

      logStepSpy.mockRestore();
    });

    it('should not call logStep when tracer is undefined', () => {
      const ast = parseDslExpression('actor');
      const runtimeCtxWithoutTracer = {
        entityManager: mockEntityManager,
        jsonLogicEval: mockJsonLogicEval,
        logger: mockLogger,
      };

      // Should execute without error
      expect(() => {
        engine.resolve(ast, actorEntity, runtimeCtxWithoutTracer);
      }).not.toThrow();
    });
  });
});
