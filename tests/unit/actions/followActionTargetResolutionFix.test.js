/**
 * Integration test to verify the fix for the follow action target resolution error
 * where actor entity has invalid ID (string 'undefined').
 */

import { beforeEach, describe, it, expect, jest } from '@jest/globals';
import { TargetResolutionService } from '../../../src/actions/targetResolutionService.js';
import ScopeEngine from '../../../src/scopeDsl/engine.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import createFilterResolver from '../../../src/scopeDsl/nodes/filterResolver.js';
import { createEvaluationContext } from '../../../src/scopeDsl/core/entityHelpers.js';
import { createMockActionErrorContextBuilder } from '../../common/mockFactories/actions.js';

describe('Follow Action Target Resolution - Invalid Entity ID Fix', () => {
  let targetResolutionService;
  let scopeEngine;
  let mockEntityManager;
  let mockLogger;
  let mockRegistryIndexes;
  let mockLocationProvider;
  let jsonLogicService;
  let mockScopeRegistry;
  let mockSafeEventDispatcher;
  let mockDslParser;

  beforeEach(() => {
    // Create mocks
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

    mockLocationProvider = {
      getLocation: jest.fn().mockReturnValue({ id: 'test-location' }),
    };

    mockRegistryIndexes = {
      searchIndex: {
        components: {
          getById: jest.fn((id) => ({ id, data: {} })),
        },
        scopes: {
          getById: jest.fn(),
        },
      },
    };

    mockScopeRegistry = {
      getScope: jest.fn(),
    };

    mockSafeEventDispatcher = {
      dispatch: jest.fn(),
    };

    mockDslParser = {
      parse: jest
        .fn()
        .mockReturnValue({ type: 'All', componentType: 'core:actor' }),
    };

    // Create JsonLogic service
    jsonLogicService = new JsonLogicEvaluationService({ logger: mockLogger });

    // Create ScopeEngine
    scopeEngine = new ScopeEngine({
      registry: { scopes: [] },
      logicEval: jsonLogicService,
      logger: mockLogger,
      entitiesGateway: {
        getEntityInstance: (id) => mockEntityManager.getEntityInstance(id),
        getEntitiesWithComponent: (compId) =>
          mockEntityManager.getEntitiesWithComponent(compId),
        getComponentData: (entityId, compId) =>
          mockEntityManager.getComponentData(entityId, compId),
        hasComponent: (entityId, compId) =>
          mockEntityManager.hasComponent(entityId, compId),
      },
      locationProvider: mockLocationProvider,
    });

    // Create TargetResolutionService
    targetResolutionService = new TargetResolutionService({
      entityManager: mockEntityManager,
      logger: mockLogger,
      registryIndexes: mockRegistryIndexes,
      scopeEngine: scopeEngine,
      componentsRegistry: mockRegistryIndexes.searchIndex.components,
      scopeRegistry: mockScopeRegistry,
      safeEventDispatcher: mockSafeEventDispatcher,
      jsonLogicEvaluationService: jsonLogicService,
      dslParser: mockDslParser,
      actionErrorContextBuilder: createMockActionErrorContextBuilder(),
    });
  });

  it('should handle actor entity with invalid ID gracefully in target resolution', async () => {
    // Mock valid actor
    const validActor = {
      id: 'valid-actor',
      componentTypeIds: ['core:actor', 'core:position', 'core:name'],
    };

    mockEntityManager.getEntityInstance.mockImplementation((id) => {
      if (id === 'valid-actor') return validActor;
      return null;
    });

    mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
      'core:actor',
      'core:position',
      'core:name',
    ]);
    mockEntityManager.getComponentData.mockReturnValue({});

    // Create action with scope
    const followAction = {
      id: 'core:follow',
      scope: 'core:potential_leaders',
      prerequisites: [],
    };

    // Mock the scope registry to return a valid scope definition
    mockScopeRegistry.getScope.mockReturnValue({
      expr: 'All("core:actor")',
    });

    // Mock the scope engine to return some valid actors
    scopeEngine.resolve = jest.fn().mockReturnValue(new Set(['valid-actor']));

    // Test 1: Valid actor should resolve targets successfully
    const validResult = await targetResolutionService.resolveTargets(
      followAction.scope,
      validActor,
      { currentLocation: { id: 'test-location' } }
    );
    expect(validResult.error).toBeUndefined();
    expect(validResult.targets).toBeDefined();

    // Test 2: Actor with 'undefined' string ID should fail gracefully
    const invalidActor = {
      id: 'undefined', // This is the problematic case
      componentTypeIds: ['core:actor'],
    };

    const invalidResult = await targetResolutionService.resolveTargets(
      followAction.scope,
      invalidActor,
      { currentLocation: { id: 'test-location' } }
    );
    expect(invalidResult.error).toBeDefined();
    expect(invalidResult.targets).toEqual([]);
  });

  it('should handle null and undefined actor entities in target resolution', async () => {
    // Test with null actor
    const nullResult = await targetResolutionService.resolveTargets(
      'core:potential_leaders',
      null,
      { currentLocation: { id: 'test-location' } }
    );
    expect(nullResult.error).toBeDefined();
    expect(nullResult.error).toBeDefined();
    expect(nullResult.targets).toEqual([]);

    // Test with undefined actor
    const undefinedResult = await targetResolutionService.resolveTargets(
      'core:potential_leaders',
      undefined,
      { currentLocation: { id: 'test-location' } }
    );
    expect(undefinedResult.error).toBeDefined();
    expect(undefinedResult.error).toBeDefined();
    expect(undefinedResult.targets).toEqual([]);
  });

  it('should handle actor entity without id property', async () => {
    const followAction = {
      id: 'core:follow',
      scope: 'core:potential_leaders',
      prerequisites: [],
    };

    // Create an object without id property
    const actorWithoutId = {
      name: 'Actor without ID',
      components: {},
    };

    const result = await targetResolutionService.resolveTargets(
      followAction.scope,
      actorWithoutId,
      { currentLocation: { id: 'test-location' } }
    );
    expect(result.error).toBeDefined();
    expect(result.error).toBeDefined();
    expect(result.targets).toEqual([]);
  });

  it('should validate actor entity in FilterResolver', () => {
    // Test that FilterResolver throws error for invalid actor IDs
    const invalidActor = { id: 'undefined', componentTypeIds: [] };

    // Create a simple filter node
    const filterNode = {
      type: 'Filter',
      parent: { type: 'All', componentType: 'core:actor' },
      logic: { '==': [1, 1] }, // Simple always-true logic
    };

    const mockDispatcher = {
      resolve: () => new Set(['some-entity']),
    };

    const filterResolver = createFilterResolver({
      logicEval: { evaluate: () => true },
      entitiesGateway: mockEntityManager,
      locationProvider: mockLocationProvider,
    });

    // Should throw error when resolving with invalid actor
    expect(() => {
      filterResolver.resolve(filterNode, {
        actorEntity: invalidActor,
        dispatcher: mockDispatcher,
      });
    }).toThrow('FilterResolver: actorEntity has invalid ID');
  });

  it('should validate actor entity in createEvaluationContext', () => {
    // Test with actor having 'undefined' as string ID
    const invalidActor = { id: 'undefined', componentTypeIds: [] };

    expect(() => {
      createEvaluationContext(
        'some-item',
        invalidActor,
        mockEntityManager,
        mockLocationProvider
      );
    }).toThrow(
      'createEvaluationContext: actorEntity has invalid ID: "undefined". This should never happen.'
    );

    // Test with null actor
    expect(() => {
      createEvaluationContext(
        'some-item',
        null,
        mockEntityManager,
        mockLocationProvider
      );
    }).toThrow(
      'createEvaluationContext: actorEntity is undefined. This should never happen during scope evaluation.'
    );

    // Test with actor without ID
    const actorWithoutId = { name: 'No ID' };
    expect(() => {
      createEvaluationContext(
        'some-item',
        actorWithoutId,
        mockEntityManager,
        mockLocationProvider
      );
    }).toThrow('createEvaluationContext: actorEntity has invalid ID');
  });
});
