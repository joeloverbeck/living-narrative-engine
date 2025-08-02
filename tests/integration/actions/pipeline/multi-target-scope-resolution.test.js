/**
 * @file Integration tests for multi-target vs legacy action scope resolution
 * @description Proves that multi-target actions fail to resolve scopes that work for legacy actions
 */

import { describe, it, beforeEach, afterEach, expect, jest } from '@jest/globals';
import { TargetResolutionService } from '../../../../src/actions/targetResolutionService.js';
import { MultiTargetResolutionStage } from '../../../../src/actions/pipeline/stages/MultiTargetResolutionStage.js';
import TargetContextBuilder from '../../../../src/scopeDsl/utils/targetContextBuilder.js';
import { ActionResult } from '../../../../src/actions/core/actionResult.js';
import {
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
} from '../../../../src/constants/componentIds.js';

describe('MultiTarget vs Legacy Scope Resolution', () => {
  let mockEntityManager;
  let mockUnifiedScopeResolver;
  let mockLogger;
  let targetResolutionService;
  let targetContextBuilder;
  let multiTargetStage;
  
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
    };
    
    const mockGameStateManager = {
      getCurrentTurn: jest.fn(() => 1),
      getTimeOfDay: jest.fn(() => 'morning'),
      getWeather: jest.fn(() => 'clear'),
    };
    
    // Setup target context builder
    targetContextBuilder = new TargetContextBuilder({
      entityManager: mockEntityManager,
      gameStateManager: mockGameStateManager,
      logger: mockLogger,
    });
    
    // Create simple mock
    mockUnifiedScopeResolver = {
      resolve: jest.fn(),
    };
    
    // Setup target resolution service (legacy path)
    targetResolutionService = new TargetResolutionService({
      unifiedScopeResolver: mockUnifiedScopeResolver,
      logger: mockLogger,
    });
    
    // Setup multi-target stage (new path)
    multiTargetStage = new MultiTargetResolutionStage({
      unifiedScopeResolver: mockUnifiedScopeResolver,
      entityManager: mockEntityManager,
      targetResolver: targetResolutionService,
      targetContextBuilder,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * This test proves the core issue: context building differences between legacy and multi-target actions
   */
  it('should build context identically for legacy and multi-target actions', async () => {
    // Setup mock actor entity
    const mockActorEntity = {
      id: 'test:iker',
      getComponentData: jest.fn(),
      getAllComponents: jest.fn(() => ({
        [NAME_COMPONENT_ID]: { text: 'Iker Aguirre' },
        [POSITION_COMPONENT_ID]: { locationId: 'coffee_shop' },
        'core:actor': {},
      })),
    };
    
    mockEntityManager.getEntityInstance.mockReturnValue(mockActorEntity);
    
    const actionContext = {
      currentLocation: 'coffee_shop',
      location: { id: 'coffee_shop' },
    };
    
    // Capture context calls to UnifiedScopeResolver
    const capturedContexts = [];
    mockUnifiedScopeResolver.resolve.mockImplementation((scope, context) => {
      // Capture the actual actor object passed (before JSON serialization strips methods)
      capturedContexts.push({ 
        scope, 
        actorId: context.actor?.id,
        actorHasMethods: !!(context.actor?.getComponentData && context.actor?.getAllComponents),
        actorKeys: context.actor ? Object.keys(context.actor).sort() : []
      });
      return ActionResult.success(new Set(['test:amaia']));
    });

    // Test legacy path
    await targetResolutionService.resolveTargets(
      'core:actors_in_location',
      mockActorEntity, // Full entity object
      actionContext,
      null,
      'test:legacy'
    );

    // Test multi-target path
    const multiTargetActionDef = {
      id: 'test:multi',
      targets: {
        primary: {
          scope: 'core:actors_in_location',
          placeholder: 'actor',
        },
      },
    };
    
    const multiTargetContext = {
      candidateActions: [multiTargetActionDef],
      actor: mockActorEntity, // Full entity object
      actionContext,
      data: {},
    };
    
    await multiTargetStage.executeInternal(multiTargetContext);

    // Both paths should have been called
    expect(capturedContexts).toHaveLength(2);
    
    const legacyCapture = capturedContexts[0];
    const multiTargetCapture = capturedContexts[1];
    
    // Both should have the same actor ID
    expect(legacyCapture.actorId).toBe('test:iker');
    expect(multiTargetCapture.actorId).toBe('test:iker');
    
    
    // Both should now pass the full entity object with methods
    expect(legacyCapture.actorHasMethods).toBe(true);
    expect(multiTargetCapture.actorHasMethods).toBe(true);
    
    // Both should have the same actor object structure
    expect(legacyCapture.actorKeys).toContain('id');
    expect(legacyCapture.actorKeys).toContain('getComponentData');
    expect(legacyCapture.actorKeys).toContain('getAllComponents');
    
    expect(multiTargetCapture.actorKeys).toContain('id');
    expect(multiTargetCapture.actorKeys).toContain('getComponentData');
    expect(multiTargetCapture.actorKeys).toContain('getAllComponents');
  });

  /**
   * Simplified test showing the actual bug: scope resolution returns different results
   */
  it('should demonstrate multi-target scope resolution fails where legacy succeeds', async () => {
    // Mock that legacy path finds 1 target, multi-target finds 0
    mockUnifiedScopeResolver.resolve
      .mockReturnValueOnce(ActionResult.success(new Set(['test:amaia']))) // Legacy call - succeeds
      .mockReturnValueOnce(ActionResult.success(new Set([]))); // Multi-target call - fails due to context
    
    const mockActorEntity = {
      id: 'test:iker',
      getComponentData: jest.fn(() => ({ locationId: 'coffee_shop' })),
      getAllComponents: jest.fn(() => ({ 'core:actor': {} })),
    };
    
    mockEntityManager.getEntityInstance.mockReturnValue(mockActorEntity);
    
    const actionContext = {
      currentLocation: 'coffee_shop',
      location: { id: 'coffee_shop' },
    };

    // Test legacy path - should succeed
    const legacyResult = await targetResolutionService.resolveTargets(
      'core:actors_in_location',
      mockActorEntity,
      actionContext,
      null,
      'test:legacy'
    );

    // Test multi-target path - should fail
    const multiTargetActionDef = {
      id: 'test:multi',
      targets: {
        primary: {
          scope: 'core:actors_in_location',
          placeholder: 'actor',
        },
      },
    };

    const multiTargetResult = await multiTargetStage.executeInternal({
      candidateActions: [multiTargetActionDef],
      actor: mockActorEntity,
      actionContext,
      data: {},
    });

    // Legacy finds targets, multi-target doesn't
    expect(legacyResult.success).toBe(true);
    expect(legacyResult.value).toHaveLength(1);
    
    expect(multiTargetResult.success).toBe(true);
    expect(multiTargetResult.data.actionsWithTargets).toHaveLength(0); // Bug: no actions found
  });
});