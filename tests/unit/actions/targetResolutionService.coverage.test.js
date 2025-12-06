import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TargetResolutionService } from '../../../src/actions/targetResolutionService.js';
import { ActionTargetContext } from '../../../src/models/actionTargetContext.js';
import { ActionResult } from '../../../src/actions/core/actionResult.js';

describe('TargetResolutionService - Coverage for Missing Lines', () => {
  let service;
  let mockUnifiedScopeResolver;
  let mockLogger;
  let mockTrace;
  let actorEntity;
  let discoveryContext;

  beforeEach(() => {
    // Setup mock dependencies
    mockUnifiedScopeResolver = {
      resolve: jest.fn(),
    };

    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Create service with mocks
    service = new TargetResolutionService({
      unifiedScopeResolver: mockUnifiedScopeResolver,
      logger: mockLogger,
    });

    // Setup common test data
    actorEntity = {
      id: 'test-actor',
      name: 'Test Actor',
    };

    discoveryContext = {
      currentLocation: 'test-location',
      entityManager: {},
    };

    mockTrace = null;
  });

  describe('Trace API with withSpan method (lines 77-94)', () => {
    it('should use trace.withSpan when available', () => {
      const withSpanMock = jest.fn((spanName, fn) => {
        // Call the function passed to withSpan
        return fn();
      });

      mockTrace = {
        withSpan: withSpanMock,
        info: jest.fn(),
      };

      // Setup resolver to return a successful ActionResult
      mockUnifiedScopeResolver.resolve.mockReturnValue(
        ActionResult.success(new Set(['entity-1', 'entity-2']))
      );

      // Call resolveTargets with trace that has withSpan
      const result = service.resolveTargets(
        'test:scope',
        actorEntity,
        discoveryContext,
        mockTrace,
        'test-action'
      );

      // Verify withSpan was called
      expect(withSpanMock).toHaveBeenCalledTimes(1);
      expect(withSpanMock).toHaveBeenCalledWith(
        'target.resolve',
        expect.any(Function),
        {
          scopeName: 'test:scope',
          actorId: 'test-actor',
          actionId: 'test-action',
        }
      );

      // Verify result is correct
      expect(result.success).toBe(true);
      expect(result.value).toHaveLength(2);
      expect(result.value[0]).toEqual(
        ActionTargetContext.forEntity('entity-1')
      );
      expect(result.value[1]).toEqual(
        ActionTargetContext.forEntity('entity-2')
      );
    });

    it('should fallback to direct execution when trace.withSpan is not available', () => {
      mockTrace = {
        // No withSpan method
        info: jest.fn(),
      };

      // Setup resolver to return a successful ActionResult
      mockUnifiedScopeResolver.resolve.mockReturnValue(
        ActionResult.success(new Set(['entity-1']))
      );

      // Call resolveTargets with trace that lacks withSpan
      const result = service.resolveTargets(
        'test:scope',
        actorEntity,
        discoveryContext,
        mockTrace,
        'test-action'
      );

      // Verify trace.info was called (part of internal implementation)
      expect(mockTrace.info).toHaveBeenCalled();

      // Verify result is correct
      expect(result.success).toBe(true);
      expect(result.value).toHaveLength(1);
      expect(result.value[0]).toEqual(
        ActionTargetContext.forEntity('entity-1')
      );
    });

    it('should handle trace being null', () => {
      // Setup resolver to return a successful ActionResult
      mockUnifiedScopeResolver.resolve.mockReturnValue(
        ActionResult.success(new Set(['entity-1']))
      );

      // Call resolveTargets with null trace
      const result = service.resolveTargets(
        'test:scope',
        actorEntity,
        discoveryContext,
        null,
        'test-action'
      );

      // Verify result is correct
      expect(result.success).toBe(true);
      expect(result.value).toHaveLength(1);
      expect(result.value[0]).toEqual(
        ActionTargetContext.forEntity('entity-1')
      );
    });
  });

  describe('Debug logging for sit_down action (lines 128, 157, 174)', () => {
    it('should log debug info when actionId is positioning:sit_down', () => {
      // Setup resolver to return a successful ActionResult
      mockUnifiedScopeResolver.resolve.mockReturnValue(
        ActionResult.success(new Set(['chair-1', 'bench-1']))
      );

      // Call with sit_down actionId
      const result = service.resolveTargets(
        'positioning:available_furniture',
        actorEntity,
        discoveryContext,
        null,
        'positioning:sit_down'
      );

      // Verify debug logging was called for sit_down
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Resolving scope for sit_down'),
        expect.objectContaining({
          scopeName: 'positioning:available_furniture',
          actionId: 'positioning:sit_down',
          actorId: 'test-actor',
          actorLocation: 'test-location',
        })
      );

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Context built for UnifiedScopeResolver'),
        expect.objectContaining({
          hasActor: true,
          actorId: 'test-actor',
          actorLocation: 'test-location',
        })
      );

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('UnifiedScopeResolver result for sit_down'),
        expect.objectContaining({
          success: true,
          hasValue: true,
          valueSize: 2,
          entities: ['chair-1', 'bench-1'],
        })
      );

      // Verify result is correct
      expect(result.success).toBe(true);
      expect(result.value).toHaveLength(2);
    });

    it('should log debug info when scopeName is positioning:available_furniture', () => {
      // Setup resolver to return a successful ActionResult
      mockUnifiedScopeResolver.resolve.mockReturnValue(
        ActionResult.success(new Set(['sofa-1']))
      );

      // Call with available_furniture scope
      const result = service.resolveTargets(
        'positioning:available_furniture',
        actorEntity,
        discoveryContext,
        null,
        'some-other-action'
      );

      // Verify debug logging was called for available_furniture scope
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Resolving scope for sit_down'),
        expect.objectContaining({
          scopeName: 'positioning:available_furniture',
        })
      );

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Context built for UnifiedScopeResolver'),
        expect.anything()
      );

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('UnifiedScopeResolver result for sit_down'),
        expect.objectContaining({
          success: true,
          hasValue: true,
          valueSize: 1,
          entities: ['sofa-1'],
        })
      );

      // Verify result is correct
      expect(result.success).toBe(true);
      expect(result.value).toHaveLength(1);
    });

    it('should not log debug info for non-sit_down actions with different scopes', () => {
      // Reset mock to track calls
      mockLogger.debug.mockClear();

      // Setup resolver to return a successful ActionResult
      mockUnifiedScopeResolver.resolve.mockReturnValue(
        ActionResult.success(new Set(['entity-1']))
      );

      // Call with different action and scope
      const result = service.resolveTargets(
        'combat:enemies',
        actorEntity,
        discoveryContext,
        null,
        'combat:attack'
      );

      // Verify debug logging was NOT called
      expect(mockLogger.debug).not.toHaveBeenCalled();

      // Verify result is still correct
      expect(result.success).toBe(true);
      expect(result.value).toHaveLength(1);
    });
  });

  describe('Empty result set handling (lines 205-206)', () => {
    it('should return empty array for non-none scopes that resolve to empty set', () => {
      // Setup resolver to return empty set
      mockUnifiedScopeResolver.resolve.mockReturnValue(
        ActionResult.success(new Set()) // Empty set
      );

      // Create a mock trace to verify logging
      mockTrace = {
        info: jest.fn(),
      };

      // Call with a regular scope (not 'none')
      const result = service.resolveTargets(
        'combat:enemies',
        actorEntity,
        discoveryContext,
        mockTrace,
        'combat:attack'
      );

      // Verify trace.info was called with appropriate message
      expect(mockTrace.info).toHaveBeenCalledWith(
        expect.stringContaining(
          "Scope 'combat:enemies' resolved to no targets"
        ),
        expect.any(String)
      );

      // Verify result is successful but with empty array
      expect(result.success).toBe(true);
      expect(result.value).toEqual([]);
      expect(result.value).toHaveLength(0);
    });

    it('should return noTarget context for none scope with empty set', () => {
      // Setup resolver to return empty set
      mockUnifiedScopeResolver.resolve.mockReturnValue(
        ActionResult.success(new Set()) // Empty set
      );

      // Create a mock trace to verify logging
      mockTrace = {
        info: jest.fn(),
      };

      // Call with 'none' scope
      const result = service.resolveTargets(
        'none',
        actorEntity,
        discoveryContext,
        mockTrace,
        'test-action'
      );

      // Verify trace.info was called with appropriate message for 'none' scope
      expect(mockTrace.info).toHaveBeenCalledWith(
        expect.stringContaining(
          "Scope 'none' resolved to no targets - returning noTarget context"
        ),
        expect.any(String)
      );

      // Verify result contains noTarget context
      expect(result.success).toBe(true);
      expect(result.value).toHaveLength(1);
      expect(result.value[0]).toEqual(ActionTargetContext.noTarget());
    });

    it('should handle empty set without trace object', () => {
      // Setup resolver to return empty set
      mockUnifiedScopeResolver.resolve.mockReturnValue(
        ActionResult.success(new Set()) // Empty set
      );

      // Call without trace
      const result = service.resolveTargets(
        'test:scope',
        actorEntity,
        discoveryContext,
        null,
        'test-action'
      );

      // Verify result is successful but with empty array
      expect(result.success).toBe(true);
      expect(result.value).toEqual([]);
      expect(result.value).toHaveLength(0);
    });
  });

  describe('Integration of all features', () => {
    it('should handle sit_down action with withSpan trace and empty results', () => {
      const withSpanMock = jest.fn((spanName, fn) => {
        return fn();
      });

      mockTrace = {
        withSpan: withSpanMock,
        info: jest.fn(),
      };

      // Setup resolver to return empty set
      mockUnifiedScopeResolver.resolve.mockReturnValue(
        ActionResult.success(new Set())
      );

      // Call with sit_down action
      const result = service.resolveTargets(
        'positioning:available_furniture',
        actorEntity,
        discoveryContext,
        mockTrace,
        'positioning:sit_down'
      );

      // Verify withSpan was called
      expect(withSpanMock).toHaveBeenCalledWith(
        'target.resolve',
        expect.any(Function),
        {
          scopeName: 'positioning:available_furniture',
          actorId: 'test-actor',
          actionId: 'positioning:sit_down',
        }
      );

      // Verify debug logging for sit_down
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Resolving scope for sit_down'),
        expect.any(Object)
      );

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('UnifiedScopeResolver result for sit_down'),
        expect.objectContaining({
          success: true,
          hasValue: true,
          valueSize: 0,
          entities: [],
        })
      );

      // Verify empty result handling
      expect(mockTrace.info).toHaveBeenCalledWith(
        expect.stringContaining(
          "Scope 'positioning:available_furniture' resolved to no targets"
        ),
        expect.any(String)
      );

      // Verify result is empty array
      expect(result.success).toBe(true);
      expect(result.value).toEqual([]);
    });
  });
});
