import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ScopeContextBuilder } from '../../../../../src/actions/pipeline/services/implementations/ScopeContextBuilder.js';
import TargetContextBuilder from '../../../../../src/scopeDsl/utils/targetContextBuilder.js';
import { createMockLogger } from '../../../../common/mockFactories/loggerMocks.js';
import { createMockEntityManager } from '../../../../common/mockFactories/entities.js';

describe('ScopeContextBuilder Integration Tests', () => {
  let mockLogger;
  let mockEntityManager;
  let mockGameStateManager;
  let targetContextBuilder;
  let scopeContextBuilder;
  let mockActor;
  let mockLocation;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockEntityManager = createMockEntityManager();
    mockGameStateManager = {
      getState: jest.fn(),
    };

    // Create real TargetContextBuilder for integration testing
    targetContextBuilder = new TargetContextBuilder({
      entityManager: mockEntityManager,
      gameStateManager: mockGameStateManager,
      logger: mockLogger,
    });

    scopeContextBuilder = new ScopeContextBuilder({
      targetContextBuilder,
      entityManager: mockEntityManager,
      logger: mockLogger,
    });

    // Setup mock entities
    mockActor = {
      id: 'actor-123',
      getAllComponents: jest.fn().mockReturnValue({
        'core:name': { displayName: 'Test Actor' },
        'core:position': { locationId: 'location-456' },
      }),
      getComponentData: jest
        .fn()
        .mockReturnValue({ locationId: 'location-456' }),
    };

    mockLocation = {
      id: 'location-456',
      getAllComponents: jest.fn().mockReturnValue({
        'core:name': { displayName: 'Test Location' },
        'core:description': { text: 'A test location' },
      }),
    };

    // Configure entity manager responses
    mockEntityManager.getEntityInstance.mockImplementation((id) => {
      if (id === 'actor-123') return mockActor;
      if (id === 'location-456') return mockLocation;
      return null;
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('buildInitialContext integration', () => {
    it('should build initial context using real TargetContextBuilder', () => {
      const actionContext = {
        location: { id: 'location-456' },
      };

      const result = scopeContextBuilder.buildInitialContext(
        mockActor,
        actionContext
      );

      // Verify integration with TargetContextBuilder
      expect(result).toHaveProperty('actor');
      expect(result).toHaveProperty('location');
      expect(result.actor.id).toBe('actor-123');
      expect(result.location.id).toBe('location-456');

      // Verify TargetContextBuilder was called correctly
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
        'actor-123'
      );
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
        'location-456'
      );
    });

    it('should handle location fallback with real TargetContextBuilder', () => {
      const actionContext = {}; // No location in context

      const result = scopeContextBuilder.buildInitialContext(
        mockActor,
        actionContext
      );

      expect(result).toHaveProperty('actor');
      expect(result).toHaveProperty('location');
      expect(result.location.id).toBe('location-456'); // From actor position
    });
  });

  describe('buildScopeContext integration', () => {
    let actionContext;
    let targetDef;
    let resolvedTargets;

    beforeEach(() => {
      actionContext = {
        location: { id: 'location-456' },
      };

      targetDef = {
        scope: 'actor.items',
        placeholder: 'target',
      };

      resolvedTargets = {};
    });

    it('should build base context for independent targets', () => {
      const result = scopeContextBuilder.buildScopeContext(
        mockActor,
        actionContext,
        resolvedTargets,
        targetDef
      );

      expect(result).toHaveProperty('actor');
      expect(result).toHaveProperty('location');
      expect(result.actor.id).toBe('actor-123');
      expect(result.location.id).toBe('location-456');
    });

    it('should build dependent context with resolved targets', () => {
      const primaryTarget = {
        id: 'target-1',
        getAllComponents: jest.fn().mockReturnValue({
          'core:name': { displayName: 'Primary Target' },
        }),
      };

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'actor-123') return mockActor;
        if (id === 'location-456') return mockLocation;
        if (id === 'target-1') return primaryTarget;
        return null;
      });

      resolvedTargets = {
        primary: {
          id: 'target-1',
          displayName: 'Primary Target',
          entity: primaryTarget,
        },
      };

      targetDef.contextFrom = 'primary';

      const result = scopeContextBuilder.buildScopeContext(
        mockActor,
        actionContext,
        resolvedTargets,
        targetDef
      );

      // Should have base context plus resolved targets in targets object
      expect(result).toHaveProperty('actor');
      expect(result).toHaveProperty('location');
      expect(result).toHaveProperty('targets');
      expect(result.targets.primary.id).toBe('target-1');
    });
  });

  describe('buildScopeContextForSpecificPrimary integration', () => {
    let actionContext;
    let resolvedTargets;
    let specificPrimary;
    let targetDef;

    beforeEach(() => {
      actionContext = {
        location: { id: 'location-456' },
      };

      resolvedTargets = {
        secondary: {
          id: 'target-2',
          displayName: 'Secondary Target',
        },
      };

      specificPrimary = {
        id: 'target-1',
        displayName: 'Primary Target',
      };

      targetDef = {
        scope: 'actor.items',
        placeholder: 'target',
      };

      // Setup primary target entity
      const primaryEntity = {
        id: 'target-1',
        getAllComponents: jest.fn().mockReturnValue({
          'core:name': { displayName: 'Primary Target' },
          'core:inventory': { items: ['sword', 'shield'] },
        }),
      };

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'actor-123') return mockActor;
        if (id === 'location-456') return mockLocation;
        if (id === 'target-1') return primaryEntity;
        return null;
      });
    });

    it('should build context with specific primary target', () => {
      const result = scopeContextBuilder.buildScopeContextForSpecificPrimary(
        mockActor,
        actionContext,
        resolvedTargets,
        specificPrimary,
        targetDef
      );

      // Should have base context with actor set to the specific primary target
      // This is the fix for the contextFrom bug - when resolving secondary targets,
      // the context.actor should be the primary target entity so that scopes like
      // "actor.topmost_clothing[]" resolve against the primary target
      expect(result).toHaveProperty('actor');
      expect(result).toHaveProperty('location');
      expect(result.actor.id).toBe('target-1'); // Changed: actor is now the primary target
      expect(result.location.id).toBe('location-456');

      // Should have all resolved targets
      expect(result).toHaveProperty('targets');
      expect(result.targets).toEqual(resolvedTargets);

      // Should have specific primary as 'target'
      expect(result).toHaveProperty('target');
      expect(result.target.id).toBe('target-1');
      expect(result.target.components).toEqual({
        'core:name': { displayName: 'Primary Target' },
        'core:inventory': { items: ['sword', 'shield'] },
      });
    });

    it('should handle non-existent specific primary entity', () => {
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'actor-123') return mockActor;
        if (id === 'location-456') return mockLocation;
        return null; // Primary target entity doesn't exist
      });

      const result = scopeContextBuilder.buildScopeContextForSpecificPrimary(
        mockActor,
        actionContext,
        resolvedTargets,
        specificPrimary,
        targetDef
      );

      // When primary entity doesn't exist, falls back to original actor
      expect(result.actor.id).toBe('actor-123');
      // Targets property should not exist when fallback occurs
      expect(result.targets).toBeUndefined();

      // And no specific target
      expect(result.target).toBeUndefined();
    });
  });

  describe('context validation integration', () => {
    it('should validate real context structure', () => {
      const actionContext = {
        location: { id: 'location-456' },
      };

      // Build a real context
      const context = scopeContextBuilder.buildInitialContext(
        mockActor,
        actionContext
      );

      // Validate it
      const validation = scopeContextBuilder.validateContext(context);

      expect(validation.success).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect issues in malformed context', () => {
      const malformedContext = {
        actor: { name: 'No ID' }, // Missing id
        targets: 'not-an-object', // Wrong type
        target: { components: {} }, // Missing id
      };

      const validation = scopeContextBuilder.validateContext(malformedContext);

      expect(validation.success).toBe(false);
      expect(validation.errors).toContain('Context actor missing id field');
      expect(validation.errors).toContain('Context targets must be an object');
      expect(validation.errors).toContain('Context target missing id field');
      expect(validation.warnings).toContain('Context missing location field');
    });
  });

  describe('error propagation integration', () => {
    it('should handle errors from TargetContextBuilder in buildDependentContext', () => {
      const baseContext = {
        actor: { id: 'actor-123' },
        location: { id: 'location-456' },
      };

      const resolvedTargets = {
        nonexistent: { id: 'missing-target' },
      };

      // Mock TargetContextBuilder to throw an error for this test
      const originalBuildDependentContext =
        targetContextBuilder.buildDependentContext;
      targetContextBuilder.buildDependentContext = jest
        .fn()
        .mockImplementation(() => {
          throw new Error('Simulated TargetContextBuilder error');
        });

      const result = scopeContextBuilder.buildDependentContext(
        baseContext,
        'nonexistent',
        resolvedTargets
      );

      // Restore original method
      targetContextBuilder.buildDependentContext =
        originalBuildDependentContext;

      // Should return error result instead of throwing
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to build dependent context');
    });
  });

  describe('context merging integration', () => {
    it('should merge contexts from real context building', () => {
      const actionContext = {
        location: { id: 'location-456' },
      };

      // Build multiple contexts
      const baseContext = scopeContextBuilder.buildInitialContext(
        mockActor,
        actionContext
      );

      const additionalContext = {
        targets: {
          item1: { id: 'item-1', displayName: 'Test Item' },
        },
        customData: 'test-value',
      };

      const merged = scopeContextBuilder.mergeContexts([
        baseContext,
        additionalContext,
      ]);

      // Should have all properties from both contexts
      expect(merged.actor.id).toBe('actor-123');
      expect(merged.location.id).toBe('location-456');
      expect(merged.targets.item1.id).toBe('item-1');
      expect(merged.customData).toBe('test-value');
    });
  });

  describe('logging integration', () => {
    it('should log operations during real context building', () => {
      const actionContext = {
        location: { id: 'location-456' },
      };

      scopeContextBuilder.buildInitialContext(mockActor, actionContext);

      // Verify logging occurred
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('ScopeContextBuilder: buildInitialContext'),
        expect.objectContaining({
          service: 'ScopeContextBuilder',
          operation: 'buildInitialContext',
          actorId: 'actor-123',
          locationId: 'location-456',
        })
      );
    });

    it('should log validation operations', () => {
      const context = { actor: { id: 'test' } };

      scopeContextBuilder.validateContext(context);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('ScopeContextBuilder: validateContext'),
        expect.objectContaining({
          service: 'ScopeContextBuilder',
          operation: 'validateContext',
          success: true,
        })
      );
    });
  });
});
