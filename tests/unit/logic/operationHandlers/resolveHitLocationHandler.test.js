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

    // Run 1000 times to test distribution
    for (let i = 0; i < 1000; i++) {
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

    // Allow 5% variance (50 hits)
    expect(results.torso).toBeGreaterThan(450);
    expect(results.torso).toBeLessThan(550);

    expect(results.head).toBeGreaterThan(50);
    expect(results.head).toBeLessThan(150);

    expect(results.arms).toBeGreaterThan(350);
    expect(results.arms).toBeLessThan(450);
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
});
