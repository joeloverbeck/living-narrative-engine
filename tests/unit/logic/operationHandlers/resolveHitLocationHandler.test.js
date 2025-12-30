import ResolveHitLocationHandler from '../../../../src/logic/operationHandlers/resolveHitLocationHandler.js';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

describe('ResolveHitLocationHandler', () => {
  let handler;
  let mockEntityManager;
  let mockLogger;
  let mockDispatcher;
  let mockBodyGraphService;
  let executionContext;

  beforeEach(() => {
    mockEntityManager = {
      getComponentData: jest.fn(),
    };
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    mockDispatcher = {
      dispatch: jest.fn(),
    };
    mockBodyGraphService = {
      getAllParts: jest.fn(),
    };

    executionContext = {
      evaluationContext: {
        context: {},
        actor: { id: 'entity1' }, // Default actor
        target: { id: 'target1' }, // Default target
      },
    };

    handler = new ResolveHitLocationHandler({
      entityManager: mockEntityManager,
      logger: mockLogger,
      safeEventDispatcher: mockDispatcher,
      bodyGraphService: mockBodyGraphService,
    });
  });

  it('should return early when params is null', () => {
    handler.execute(null, executionContext);
    expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
      'core:system_error_occurred',
      expect.objectContaining({
        message: expect.stringContaining('params missing or invalid'),
      })
    );
  });

  it('should return early when params is undefined', () => {
    handler.execute(undefined, executionContext);
    expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
      'core:system_error_occurred',
      expect.objectContaining({
        message: expect.stringContaining('params missing or invalid'),
      })
    );
  });

  it('should return early when evaluationContext is missing', () => {
    const params = { entity_ref: 'actor', result_variable: 'hit_location' };
    handler.execute(params, {});
    expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
      'core:system_error_occurred',
      expect.objectContaining({
        message: expect.stringContaining(
          'evaluationContext.context is missing or invalid'
        ),
      })
    );
  });

  it('should handle invalid entity_ref', () => {
    const params = { entity_ref: null, result_variable: 'hit_location' };
    handler.execute(params, executionContext);
    expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
      expect.stringContaining('core:system_error_occurred'),
      expect.any(Object)
    );
  });

  it('should handle missing anatomy:body', () => {
    mockEntityManager.getComponentData.mockReturnValue(null); // No body component

    const params = { entity_ref: 'actor', result_variable: 'hit_location' };

    handler.execute(params, executionContext);

    expect(executionContext.evaluationContext.context.hit_location).toBeNull();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('has no anatomy:body')
    );
  });

  it('should distribute hits according to weights', () => {
    // Mock body component
    const bodyComponent = { root: 'torso' };
    mockEntityManager.getComponentData.mockImplementation(
      (entityId, componentType) => {
        if (entityId === 'target1' && componentType === 'anatomy:body')
          return bodyComponent;
        if (entityId === 'torso' && componentType === 'anatomy:part')
          return { hit_probability_weight: 50 };
        if (entityId === 'head' && componentType === 'anatomy:part')
          return { hit_probability_weight: 10 };
        if (entityId === 'arms' && componentType === 'anatomy:part')
          return { hit_probability_weight: 40 };
        if (entityId === 'ghost' && componentType === 'anatomy:part')
          return { hit_probability_weight: 0 };
        return null;
      }
    );

    mockBodyGraphService.getAllParts.mockReturnValue([
      'torso',
      'head',
      'arms',
      'ghost',
    ]);

    const params = { entity_ref: 'target', result_variable: 'hit_location' };

    const results = {
      torso: 0,
      head: 0,
      arms: 0,
      ghost: 0,
      null: 0,
    };

    // Run 10000 times for statistically robust distribution testing
    const iterations = 10000;
    for (let i = 0; i < iterations; i++) {
      handler.execute(params, executionContext);
      const result =
        executionContext.evaluationContext.context.hit_location || 'null';
      if (results[result] !== undefined) {
        results[result]++;
      } else {
        results.null++;
      }
    }

    expect(results.ghost).toBe(0);
    expect(results.null).toBe(0);

    // With 10,000 samples and ±5% tolerance, this provides ~10σ confidence
    // Standard deviation for binomial: σ = √(n × p × (1-p))
    // For torso (p=0.5): σ ≈ 50, tolerance of ±500 = ~10σ
    expect(results.torso).toBeGreaterThan(4500);
    expect(results.torso).toBeLessThan(5500);

    expect(results.head).toBeGreaterThan(500);
    expect(results.head).toBeLessThan(1500);

    expect(results.arms).toBeGreaterThan(3500);
    expect(results.arms).toBeLessThan(4500);
  });

  it('should handle missing anatomy:part components gracefully', () => {
    const bodyComponent = { root: 'torso' };

    mockEntityManager.getComponentData.mockImplementation(
      (entityId, componentType) => {
        if (entityId === 'target1' && componentType === 'anatomy:body')
          return bodyComponent;
        if (entityId === 'torso' && componentType === 'anatomy:part')
          return { hit_probability_weight: 100 };
        // 'missing' part has no anatomy:part component (returns null/undefined)
        return null;
      }
    );

    mockBodyGraphService.getAllParts.mockReturnValue(['torso', 'missing']);

    const params = { entity_ref: 'target', result_variable: 'hit_location' };

    handler.execute(params, executionContext);

    // Should always pick torso
    expect(executionContext.evaluationContext.context.hit_location).toBe(
      'torso'
    );
  });

  it('should handle error from bodyGraphService.getAllParts gracefully', () => {
    mockEntityManager.getComponentData.mockImplementation(
      (entityId, componentType) => {
        if (entityId === 'target1' && componentType === 'anatomy:body')
          return { root: 'torso' };
        return null;
      }
    );
    mockBodyGraphService.getAllParts.mockImplementation(() => {
      throw new Error('Service unavailable');
    });

    const params = {
      entity_ref: 'target',
      result_variable: 'hit_location',
    };

    handler.execute(params, executionContext);

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Error retrieving parts')
    );
    expect(executionContext.evaluationContext.context.hit_location).toBeNull();
  });

  it('should handle all parts having zero weight (no eligible parts)', () => {
    mockEntityManager.getComponentData.mockImplementation(
      (entityId, componentType) => {
        if (entityId === 'target1' && componentType === 'anatomy:body')
          return { root: 'torso' };
        if (componentType === 'anatomy:part')
          return { hit_probability_weight: 0 };
        return null;
      }
    );
    mockBodyGraphService.getAllParts.mockReturnValue(['torso', 'arm']);

    const params = {
      entity_ref: 'target',
      result_variable: 'hit_location',
    };

    handler.execute(params, executionContext);

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('No eligible parts')
    );
    expect(executionContext.evaluationContext.context.hit_location).toBeNull();
  });

});
