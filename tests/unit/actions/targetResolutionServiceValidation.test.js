/**
 * Unit test to verify the validation fix for the target resolution error
 * where actor entity has invalid ID (string 'undefined').
 */

import { beforeEach, describe, it, expect, jest } from '@jest/globals';
import { TargetResolutionService } from '../../../src/actions/targetResolutionService.js';
import { createMockActionErrorContextBuilder } from '../../common/mockFactories/actions.js';

describe('TargetResolutionService - Actor Entity Validation', () => {
  let targetResolutionService;
  let mockDependencies;

  beforeEach(() => {
    // Create minimal mocks for all required dependencies
    mockDependencies = {
      entityManager: {
        getEntityInstance: jest.fn(),
        getComponentData: jest.fn(),
        hasComponent: jest.fn(),
        getAllComponentTypesForEntity: jest.fn(),
      },
      logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
      registryIndexes: {
        searchIndex: {
          components: {
            getById: jest.fn((id) => ({ id, data: {} })),
          },
          scopes: {
            getById: jest.fn(),
          },
        },
      },
      scopeEngine: {
        resolve: jest.fn().mockResolvedValue({ targets: [] }),
      },
      componentsRegistry: {
        getById: jest.fn((id) => ({ id, data: {} })),
      },
      scopeRegistry: {
        getScope: jest.fn(),
      },
      safeEventDispatcher: {
        dispatch: jest.fn(),
      },
      jsonLogicEvaluationService: {
        evaluate: jest.fn(),
      },
      dslParser: {
        parse: jest.fn(),
      },
      actionErrorContextBuilder: createMockActionErrorContextBuilder(),
    };

    targetResolutionService = new TargetResolutionService(mockDependencies);
  });

  describe('resolveTargets validation', () => {
    const mockAction = {
      id: 'test:action',
      scope: null, // No scope to avoid registry lookups
      prerequisites: [],
    };

    it('should return error for null actor entity', async () => {
      const result = await targetResolutionService.resolveTargets(
        'test:scope',
        null,
        {}
      );

      expect(result.success).toBe(false);
      expect(result.value).toBeNull();
      expect(result.errors).toHaveLength(1);
      expect(mockDependencies.logger.error).toHaveBeenCalledWith(
        'TargetResolutionService: Actor entity is null or undefined'
      );
    });

    it('should return error for undefined actor entity', async () => {
      const result = await targetResolutionService.resolveTargets(
        'test:scope',
        undefined,
        {}
      );

      expect(result.success).toBe(false);
      expect(result.value).toBeNull();
      expect(result.errors).toHaveLength(1);
    });

    it('should return error for actor entity with id "undefined"', async () => {
      const invalidActor = {
        id: 'undefined', // string 'undefined' - the problematic case
        componentTypeIds: ['core:actor'],
      };

      const result = await targetResolutionService.resolveTargets(
        'test:scope',
        invalidActor,
        {}
      );

      expect(result.success).toBe(false);
      expect(result.value).toBeNull();
      expect(result.errors).toHaveLength(1);
      expect(mockDependencies.logger.error).toHaveBeenCalledWith(
        'TargetResolutionService: Invalid actor entity ID: "undefined" (type: string)',
        expect.objectContaining({
          actorEntity: invalidActor,
          actorId: 'undefined',
          actorIdType: 'string',
          hasComponents: false,
          hasComponentTypeIds: true,
        })
      );
    });

    it('should return error for actor entity without id property', async () => {
      const actorWithoutId = {
        name: 'Actor without ID',
        componentTypeIds: ['core:actor'],
      };

      const result = await targetResolutionService.resolveTargets(
        'test:scope',
        actorWithoutId,
        {}
      );

      expect(result.success).toBe(false);
      expect(result.value).toBeNull();
      expect(result.errors).toHaveLength(1);
    });

    it('should return error for actor entity with empty string id', async () => {
      const actorWithEmptyId = {
        id: '',
        componentTypeIds: ['core:actor'],
      };

      const result = await targetResolutionService.resolveTargets(
        'test:scope',
        actorWithEmptyId,
        {}
      );

      expect(result.success).toBe(false);
      expect(result.value).toBeNull();
      expect(result.errors).toHaveLength(1);
    });

    it('should process valid actor entity successfully', async () => {
      const validActor = {
        id: 'valid-actor-123',
        componentTypeIds: ['core:actor', 'core:position'],
      };

      mockDependencies.entityManager.getAllComponentTypesForEntity.mockReturnValue(
        ['core:actor', 'core:position']
      );

      // Mock dslParser to parse the scope expression
      mockDependencies.dslParser.parse.mockReturnValue({
        type: 'All',
        componentType: 'core:actor',
      });

      // Mock the scope registry to return a valid scope definition
      mockDependencies.scopeRegistry.getScope.mockReturnValue({
        expr: 'mock-scope-expression',
      });

      // Mock scope engine to return some targets as a Set
      mockDependencies.scopeEngine.resolve.mockReturnValue(
        new Set(['target1', 'target2'])
      );

      // Create a discovery context with currentLocation
      const discoveryContext = {
        currentLocation: { id: 'test-location' },
      };

      const result = await targetResolutionService.resolveTargets(
        'test:scope',
        validActor,
        discoveryContext
      );

      expect(result.success).toBe(true);
      expect(result.value).toHaveLength(2);
      expect(result.value[0].entityId).toBe('target1');
      expect(result.value[1].entityId).toBe('target2');
      expect(mockDependencies.logger.error).not.toHaveBeenCalled();
    });

    it('should validate actor before building component structure', async () => {
      const invalidActor = {
        id: 'undefined',
        componentTypeIds: ['core:actor'],
      };

      await targetResolutionService.resolveTargets(
        'test:scope',
        invalidActor,
        {}
      );

      // Should not attempt to build components for invalid actor
      expect(
        mockDependencies.entityManager.getAllComponentTypesForEntity
      ).not.toHaveBeenCalled();
      expect(
        mockDependencies.entityManager.getComponentData
      ).not.toHaveBeenCalled();
      expect(mockDependencies.scopeEngine.resolve).not.toHaveBeenCalled();
    });
  });
});
