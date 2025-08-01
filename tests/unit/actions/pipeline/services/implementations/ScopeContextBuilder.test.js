import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ScopeContextBuilder } from '../../../../../../src/actions/pipeline/services/implementations/ScopeContextBuilder.js';
import {
  ServiceError,
  ServiceErrorCodes,
} from '../../../../../../src/actions/pipeline/services/base/ServiceError.js';
import { createMockLogger } from '../../../../../common/mockFactories/loggerMocks.js';

describe('ScopeContextBuilder', () => {
  let mockLogger;
  let mockTargetContextBuilder;
  let mockEntityManager;
  let mockEntity;
  let scopeContextBuilder;

  beforeEach(() => {
    mockLogger = createMockLogger();

    mockTargetContextBuilder = {
      buildBaseContext: jest.fn(),
      buildDependentContext: jest.fn(),
    };

    mockEntity = {
      id: 'entity-123',
      getAllComponents: jest.fn().mockReturnValue({
        'core:name': { displayName: 'Test Entity' },
        'core:health': { current: 100, max: 100 },
      }),
    };

    mockEntityManager = {
      getEntityInstance: jest.fn().mockReturnValue(mockEntity),
    };

    scopeContextBuilder = new ScopeContextBuilder({
      targetContextBuilder: mockTargetContextBuilder,
      entityManager: mockEntityManager,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with valid dependencies', () => {
      expect(scopeContextBuilder).toBeInstanceOf(ScopeContextBuilder);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('ScopeContextBuilder: initialized'),
        expect.objectContaining({
          service: 'ScopeContextBuilder',
        })
      );
    });

    it('should throw error with invalid targetContextBuilder', () => {
      expect(() => {
        new ScopeContextBuilder({
          targetContextBuilder: null,
          entityManager: mockEntityManager,
          logger: mockLogger,
        });
      }).toThrow('Missing required dependency: TargetContextBuilder');
    });

    it('should throw error with invalid entityManager', () => {
      expect(() => {
        new ScopeContextBuilder({
          targetContextBuilder: mockTargetContextBuilder,
          entityManager: null,
          logger: mockLogger,
        });
      }).toThrow('Missing required dependency: IEntityManager');
    });

    it('should throw error with invalid logger', () => {
      expect(() => {
        new ScopeContextBuilder({
          targetContextBuilder: mockTargetContextBuilder,
          entityManager: mockEntityManager,
          logger: null,
        });
      }).toThrow('Missing required dependency: ILogger');
    });
  });

  describe('buildInitialContext', () => {
    let mockActor;
    let mockActionContext;

    beforeEach(() => {
      mockActor = {
        id: 'actor-123',
        getComponentData: jest
          .fn()
          .mockReturnValue({ locationId: 'location-456' }),
      };

      mockActionContext = {
        location: { id: 'location-789' },
      };

      mockTargetContextBuilder.buildBaseContext.mockReturnValue({
        actor: { id: 'actor-123' },
        location: { id: 'location-789' },
      });
    });

    it('should build initial context using location from actionContext', () => {
      const result = scopeContextBuilder.buildInitialContext(
        mockActor,
        mockActionContext
      );

      expect(mockTargetContextBuilder.buildBaseContext).toHaveBeenCalledWith(
        'actor-123',
        'location-789'
      );
      expect(result).toEqual({
        actor: { id: 'actor-123' },
        location: { id: 'location-789' },
      });
    });

    it('should fall back to actor position when actionContext has no location', () => {
      mockActionContext.location = null;

      const result = scopeContextBuilder.buildInitialContext(
        mockActor,
        mockActionContext
      );

      expect(mockTargetContextBuilder.buildBaseContext).toHaveBeenCalledWith(
        'actor-123',
        'location-456'
      );
    });

    it('should throw error with missing actor', () => {
      expect(() => {
        scopeContextBuilder.buildInitialContext(null, mockActionContext);
      }).toThrow(ServiceError);
    });

    it('should throw error with missing actionContext', () => {
      expect(() => {
        scopeContextBuilder.buildInitialContext(mockActor, null);
      }).toThrow(ServiceError);
    });
  });

  describe('buildScopeContext', () => {
    let mockActor;
    let mockActionContext;
    let mockTargetDef;
    let mockResolvedTargets;
    let mockTrace;

    beforeEach(() => {
      mockActor = {
        id: 'actor-123',
        getComponentData: jest
          .fn()
          .mockReturnValue({ locationId: 'location-456' }),
      };

      mockActionContext = {
        location: { id: 'location-789' },
      };

      mockTargetDef = {
        scope: 'actor.items',
        placeholder: 'target',
      };

      mockResolvedTargets = {};
      mockTrace = { traceId: 'trace-123' };

      mockTargetContextBuilder.buildBaseContext.mockReturnValue({
        actor: { id: 'actor-123' },
        location: { id: 'location-789' },
      });
    });

    it('should return base context for independent targets', () => {
      const result = scopeContextBuilder.buildScopeContext(
        mockActor,
        mockActionContext,
        mockResolvedTargets,
        mockTargetDef,
        mockTrace
      );

      expect(mockTargetContextBuilder.buildBaseContext).toHaveBeenCalledWith(
        'actor-123',
        'location-789'
      );
      expect(
        mockTargetContextBuilder.buildDependentContext
      ).not.toHaveBeenCalled();
      expect(result).toEqual({
        actor: { id: 'actor-123' },
        location: { id: 'location-789' },
      });
    });

    it('should build dependent context when targetDef has contextFrom', () => {
      mockTargetDef.contextFrom = 'primary';
      const mockDependentContext = {
        actor: { id: 'actor-123' },
        location: { id: 'location-789' },
        targets: { primary: { id: 'target-1' } },
      };
      mockTargetContextBuilder.buildDependentContext.mockReturnValue(
        mockDependentContext
      );

      const result = scopeContextBuilder.buildScopeContext(
        mockActor,
        mockActionContext,
        mockResolvedTargets,
        mockTargetDef,
        mockTrace
      );

      expect(
        mockTargetContextBuilder.buildDependentContext
      ).toHaveBeenCalledWith(
        { actor: { id: 'actor-123' }, location: { id: 'location-789' } },
        mockResolvedTargets,
        mockTargetDef
      );
      expect(result).toEqual(mockDependentContext);
    });

    it('should build dependent context when resolvedTargets is not empty', () => {
      mockResolvedTargets = { primary: { id: 'target-1' } };
      const mockDependentContext = {
        actor: { id: 'actor-123' },
        location: { id: 'location-789' },
        targets: { primary: { id: 'target-1' } },
      };
      mockTargetContextBuilder.buildDependentContext.mockReturnValue(
        mockDependentContext
      );

      const result = scopeContextBuilder.buildScopeContext(
        mockActor,
        mockActionContext,
        mockResolvedTargets,
        mockTargetDef,
        mockTrace
      );

      expect(
        mockTargetContextBuilder.buildDependentContext
      ).toHaveBeenCalledWith(
        { actor: { id: 'actor-123' }, location: { id: 'location-789' } },
        mockResolvedTargets,
        mockTargetDef
      );
      expect(result).toEqual(mockDependentContext);
    });

    it('should use actor position when actionContext location is missing', () => {
      mockActionContext.location = null;

      const result = scopeContextBuilder.buildScopeContext(
        mockActor,
        mockActionContext,
        mockResolvedTargets,
        mockTargetDef,
        mockTrace
      );

      expect(mockTargetContextBuilder.buildBaseContext).toHaveBeenCalledWith(
        'actor-123',
        'location-456'
      );
    });

    it('should throw error with missing required parameters', () => {
      expect(() => {
        scopeContextBuilder.buildScopeContext(
          null,
          mockActionContext,
          mockResolvedTargets,
          mockTargetDef,
          mockTrace
        );
      }).toThrow(ServiceError);
    });
  });

  describe('buildScopeContextForSpecificPrimary', () => {
    let mockActor;
    let mockActionContext;
    let mockResolvedTargets;
    let mockSpecificPrimary;
    let mockTargetDef;
    let mockTrace;
    let mockBaseContext;

    beforeEach(() => {
      mockActor = {
        id: 'actor-123',
        getComponentData: jest
          .fn()
          .mockReturnValue({ locationId: 'location-456' }),
      };

      mockActionContext = {
        location: { id: 'location-789' },
      };

      mockResolvedTargets = {
        secondary: { id: 'target-2', displayName: 'Secondary Target' },
      };

      mockSpecificPrimary = {
        id: 'entity-123',
        displayName: 'Primary Target',
      };

      mockTargetDef = {
        scope: 'actor.items',
        placeholder: 'target',
      };

      mockTrace = { traceId: 'trace-123' };

      mockBaseContext = {
        actor: { id: 'actor-123' },
        location: { id: 'location-789' },
      };

      mockTargetContextBuilder.buildBaseContext.mockReturnValue(
        mockBaseContext
      );
    });

    it('should build context with specific primary target', () => {
      const result = scopeContextBuilder.buildScopeContextForSpecificPrimary(
        mockActor,
        mockActionContext,
        mockResolvedTargets,
        mockSpecificPrimary,
        mockTargetDef,
        mockTrace
      );

      expect(mockTargetContextBuilder.buildBaseContext).toHaveBeenCalledWith(
        'actor-123',
        'location-789'
      );
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
        'entity-123'
      );

      expect(result).toEqual({
        actor: { id: 'actor-123' },
        location: { id: 'location-789' },
        targets: {
          secondary: { id: 'target-2', displayName: 'Secondary Target' },
        },
        target: {
          id: 'entity-123',
          components: {
            'core:name': { displayName: 'Test Entity' },
            'core:health': { current: 100, max: 100 },
          },
        },
      });
    });

    it('should handle specific primary without entity', () => {
      mockEntityManager.getEntityInstance.mockReturnValue(null);

      const result = scopeContextBuilder.buildScopeContextForSpecificPrimary(
        mockActor,
        mockActionContext,
        mockResolvedTargets,
        mockSpecificPrimary,
        mockTargetDef,
        mockTrace
      );

      expect(result.target).toBeUndefined();
      expect(result.targets).toEqual(mockResolvedTargets);
    });

    it('should handle entity without getAllComponents method', () => {
      const entityWithoutMethod = { id: 'entity-123' };
      mockEntityManager.getEntityInstance.mockReturnValue(entityWithoutMethod);

      const result = scopeContextBuilder.buildScopeContextForSpecificPrimary(
        mockActor,
        mockActionContext,
        mockResolvedTargets,
        mockSpecificPrimary,
        mockTargetDef,
        mockTrace
      );

      expect(result.target).toEqual({
        id: 'entity-123',
        components: {},
      });
    });

    it('should handle null specific primary', () => {
      const result = scopeContextBuilder.buildScopeContextForSpecificPrimary(
        mockActor,
        mockActionContext,
        mockResolvedTargets,
        null,
        mockTargetDef,
        mockTrace
      );

      expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
      expect(result.target).toBeUndefined();
    });

    it('should use actor position when actionContext location is missing', () => {
      mockActionContext.location = null;

      const result = scopeContextBuilder.buildScopeContextForSpecificPrimary(
        mockActor,
        mockActionContext,
        mockResolvedTargets,
        mockSpecificPrimary,
        mockTargetDef,
        mockTrace
      );

      expect(mockTargetContextBuilder.buildBaseContext).toHaveBeenCalledWith(
        'actor-123',
        'location-456'
      );
    });

    it('should throw error with missing required parameters', () => {
      expect(() => {
        scopeContextBuilder.buildScopeContextForSpecificPrimary(
          null,
          mockActionContext,
          mockResolvedTargets,
          mockSpecificPrimary,
          mockTargetDef,
          mockTrace
        );
      }).toThrow(ServiceError);
    });
  });

  describe('addResolvedTarget', () => {
    it('should add target to existing context with targets', () => {
      const context = {
        actor: { id: 'actor-123' },
        targets: { existing: { id: 'existing-1' } },
      };
      const resolvedTarget = { id: 'target-123', displayName: 'New Target' };

      const result = scopeContextBuilder.addResolvedTarget(
        context,
        'newTarget',
        resolvedTarget
      );

      expect(result).toEqual({
        actor: { id: 'actor-123' },
        targets: {
          existing: { id: 'existing-1' },
          newTarget: { id: 'target-123', displayName: 'New Target' },
        },
      });
      expect(result).not.toBe(context); // Should return new object
    });

    it('should add targets property to context without targets', () => {
      const context = { actor: { id: 'actor-123' } };
      const resolvedTarget = { id: 'target-123' };

      const result = scopeContextBuilder.addResolvedTarget(
        context,
        'newTarget',
        resolvedTarget
      );

      expect(result).toEqual({
        actor: { id: 'actor-123' },
        targets: {
          newTarget: { id: 'target-123' },
        },
      });
    });

    it('should throw error with invalid targetKey', () => {
      const context = { actor: { id: 'actor-123' } };
      const resolvedTarget = { id: 'target-123' };

      expect(() => {
        scopeContextBuilder.addResolvedTarget(context, '', resolvedTarget);
      }).toThrow(ServiceError);

      expect(() => {
        scopeContextBuilder.addResolvedTarget(context, null, resolvedTarget);
      }).toThrow(ServiceError);
    });

    it('should throw error with missing parameters', () => {
      expect(() => {
        scopeContextBuilder.addResolvedTarget(null, 'key', {});
      }).toThrow(ServiceError);
    });
  });

  describe('buildDependentContext', () => {
    let mockBaseContext;
    let mockResolvedTargets;

    beforeEach(() => {
      mockBaseContext = {
        actor: { id: 'actor-123' },
        location: { id: 'location-456' },
      };

      mockResolvedTargets = {
        primary: { id: 'target-1', displayName: 'Primary' },
      };

      mockTargetContextBuilder.buildDependentContext.mockReturnValue({
        ...mockBaseContext,
        targets: mockResolvedTargets,
      });
    });

    it('should successfully build dependent context', () => {
      const result = scopeContextBuilder.buildDependentContext(
        mockBaseContext,
        'primary',
        mockResolvedTargets
      );

      expect(
        mockTargetContextBuilder.buildDependentContext
      ).toHaveBeenCalledWith(mockBaseContext, mockResolvedTargets, {
        contextFrom: 'primary',
      });

      expect(result).toEqual({
        success: true,
        context: {
          actor: { id: 'actor-123' },
          location: { id: 'location-456' },
          targets: mockResolvedTargets,
        },
      });
    });

    it('should handle errors from TargetContextBuilder', () => {
      const error = new Error('Context building failed');
      mockTargetContextBuilder.buildDependentContext.mockImplementation(() => {
        throw error;
      });

      const result = scopeContextBuilder.buildDependentContext(
        mockBaseContext,
        'primary',
        mockResolvedTargets
      );

      expect(result).toEqual({
        success: false,
        error: 'Failed to build dependent context: Context building failed',
      });
    });

    it('should throw error with invalid contextFromKey', () => {
      expect(() => {
        scopeContextBuilder.buildDependentContext(
          mockBaseContext,
          '',
          mockResolvedTargets
        );
      }).toThrow(ServiceError);
    });

    it('should throw error with missing parameters', () => {
      expect(() => {
        scopeContextBuilder.buildDependentContext(
          null,
          'primary',
          mockResolvedTargets
        );
      }).toThrow(ServiceError);
    });
  });

  describe('mergeContexts', () => {
    it('should merge multiple contexts', () => {
      const contexts = [
        { actor: { id: 'actor-123' }, location: { id: 'location-1' } },
        { targets: { primary: { id: 'target-1' } } },
        { targets: { secondary: { id: 'target-2' } }, customData: 'test' },
      ];

      const result = scopeContextBuilder.mergeContexts(contexts);

      expect(result).toEqual({
        actor: { id: 'actor-123' },
        location: { id: 'location-1' },
        targets: {
          primary: { id: 'target-1' },
          secondary: { id: 'target-2' },
        },
        customData: 'test',
      });
    });

    it('should handle empty contexts array', () => {
      const result = scopeContextBuilder.mergeContexts([]);
      expect(result).toEqual({});
    });

    it('should handle null/undefined contexts in array', () => {
      const contexts = [
        { actor: { id: 'actor-123' } },
        null,
        undefined,
        { location: { id: 'location-1' } },
      ];

      const result = scopeContextBuilder.mergeContexts(contexts);

      expect(result).toEqual({
        actor: { id: 'actor-123' },
        location: { id: 'location-1' },
      });
    });

    it('should handle non-object contexts in array', () => {
      const contexts = [
        { actor: { id: 'actor-123' } },
        'invalid',
        123,
        { location: { id: 'location-1' } },
      ];

      const result = scopeContextBuilder.mergeContexts(contexts);

      expect(result).toEqual({
        actor: { id: 'actor-123' },
        location: { id: 'location-1' },
      });
    });

    it('should throw error with non-array input', () => {
      expect(() => {
        scopeContextBuilder.mergeContexts('not-an-array');
      }).toThrow(ServiceError);
    });

    it('should throw error with null input', () => {
      expect(() => {
        scopeContextBuilder.mergeContexts(null);
      }).toThrow(ServiceError);
    });
  });

  describe('validateContext', () => {
    it('should validate complete valid context', () => {
      const context = {
        actor: { id: 'actor-123' },
        location: { id: 'location-456' },
        targets: { primary: { id: 'target-1' } },
        target: { id: 'target-2', components: {} },
      };

      const result = scopeContextBuilder.validateContext(context);

      expect(result).toEqual({
        success: true,
        errors: [],
        warnings: [],
      });
    });

    it('should detect missing actor', () => {
      const context = {
        location: { id: 'location-456' },
      };

      const result = scopeContextBuilder.validateContext(context);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Context missing required actor field');
    });

    it('should detect actor without id', () => {
      const context = {
        actor: { name: 'Test Actor' },
        location: { id: 'location-456' },
      };

      const result = scopeContextBuilder.validateContext(context);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Context actor missing id field');
    });

    it('should warn about missing location', () => {
      const context = {
        actor: { id: 'actor-123' },
      };

      const result = scopeContextBuilder.validateContext(context);

      expect(result.success).toBe(true);
      expect(result.warnings).toContain('Context missing location field');
    });

    it('should detect invalid targets structure', () => {
      const context = {
        actor: { id: 'actor-123' },
        location: { id: 'location-456' },
        targets: 'not-an-object',
      };

      const result = scopeContextBuilder.validateContext(context);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Context targets must be an object');
    });

    it('should detect target without id', () => {
      const context = {
        actor: { id: 'actor-123' },
        location: { id: 'location-456' },
        target: { name: 'Target without ID' },
      };

      const result = scopeContextBuilder.validateContext(context);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Context target missing id field');
    });

    it('should warn about target without components', () => {
      const context = {
        actor: { id: 'actor-123' },
        location: { id: 'location-456' },
        target: { id: 'target-123' },
      };

      const result = scopeContextBuilder.validateContext(context);

      expect(result.success).toBe(true);
      expect(result.warnings).toContain(
        'Context target missing components field'
      );
    });

    it('should reject null context', () => {
      const result = scopeContextBuilder.validateContext(null);

      expect(result).toEqual({
        success: false,
        errors: ['Context must be a non-null object'],
        warnings: [],
      });
    });

    it('should reject non-object context', () => {
      const result = scopeContextBuilder.validateContext('not-an-object');

      expect(result).toEqual({
        success: false,
        errors: ['Context must be a non-null object'],
        warnings: [],
      });
    });

    it('should handle multiple errors and warnings', () => {
      const context = {
        targets: 'invalid',
        target: { name: 'No ID' },
      };

      const result = scopeContextBuilder.validateContext(context);

      expect(result.success).toBe(false);
      expect(result.errors).toEqual([
        'Context missing required actor field',
        'Context targets must be an object',
        'Context target missing id field',
      ]);
      expect(result.warnings).toEqual([
        'Context missing location field',
        'Context target missing components field',
      ]);
    });
  });
});
