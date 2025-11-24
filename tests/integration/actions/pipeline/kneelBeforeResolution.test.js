/**
 * @file Integration test to reproduce the kneel_before action resolution error
 * @description Tests that multi-target actions like kneel_before can resolve their scopes correctly
 */

import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import { createMultiTargetResolutionStage } from '../../../common/actions/multiTargetStageTestUtilities.js';
import { ActionResult } from '../../../../src/actions/core/actionResult.js';

describe('Kneel Before Action Resolution', () => {
  let mockLogger;
  let mockEntityManager;
  let multiTargetStage;
  let mockUnifiedScopeResolver;
  let mockTargetResolver;

  beforeEach(() => {
    // Setup logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Mock entity manager
    mockEntityManager = {
      getEntityInstance: jest.fn(),
      getEntity: jest.fn(),
    };

    // Mock unified scope resolver
    mockUnifiedScopeResolver = {
      resolve: jest.fn(),
    };

    // Mock target resolver
    mockTargetResolver = {
      resolveTargets: jest.fn(),
    };

    // Create multi-target stage using test utility
    multiTargetStage = createMultiTargetResolutionStage({
      entityManager: mockEntityManager,
      logger: mockLogger,
      unifiedScopeResolver: mockUnifiedScopeResolver,
      targetResolver: mockTargetResolver,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should successfully resolve kneel_before action targets after fix', async () => {
    // Setup mock actor entity
    const mockActorEntity = {
      id: 'p_erotica:iker_aguirre_instance',
      getComponentData: jest.fn(() => ({
        locationId: 'p_erotica:outside_tables_coffee_shop_instance',
      })),
      getAllComponents: jest.fn(() => ({
        'core:actor': {},
        'core:position': {
          locationId: 'p_erotica:outside_tables_coffee_shop_instance',
        },
      })),
    };

    // Setup kneel_before action
    const kneelBeforeAction = {
      id: 'positioning:kneel_before',
      name: 'Kneel Before',
      targets: {
        primary: {
          scope: 'core:actors_in_location',
          placeholder: 'actor',
          description: 'The actor to kneel before',
        },
      },
      template: 'kneel before {actor}',
    };

    const context = {
      candidateActions: [kneelBeforeAction],
      actor: mockActorEntity,
      actionContext: {
        location: { id: 'p_erotica:outside_tables_coffee_shop_instance' },
      },
      data: {},
    };

    // The target context builder is now handled by the test utility

    // Mock unified scope resolver to succeed now that the fix is applied
    mockUnifiedScopeResolver.resolve.mockImplementation(
      (scope, context, options) => {
        // After the fix, context should have actor property properly set
        expect(context.actor).toBeDefined();
        expect(context.actor.id).toBe('p_erotica:iker_aguirre_instance');
        return ActionResult.success(
          new Set(['p_erotica:amaia_castillo_instance'])
        );
      }
    );

    // Mock entity manager to return target entity
    const mockLocationEntity = {
      id: 'p_erotica:outside_tables_coffee_shop_instance',
      getComponentData: jest.fn(),
      getAllComponents: jest.fn(() => ({
        'core:location': { name: 'Outside Tables' },
      })),
    };

    mockEntityManager.getEntityInstance.mockImplementation((id) => {
      if (id === 'p_erotica:iker_aguirre_instance') {
        return mockActorEntity;
      }
      if (id === 'p_erotica:outside_tables_coffee_shop_instance') {
        return mockLocationEntity;
      }
      if (id === 'p_erotica:amaia_castillo_instance') {
        return {
          id: 'p_erotica:amaia_castillo_instance',
          getComponent: jest.fn(),
        };
      }
      return null;
    });

    mockEntityManager.getEntity.mockImplementation((id) => {
      if (id === 'p_erotica:iker_aguirre_instance') {
        return mockActorEntity;
      }
      if (id === 'p_erotica:outside_tables_coffee_shop_instance') {
        return mockLocationEntity;
      }
      if (id === 'p_erotica:amaia_castillo_instance') {
        return {
          id: 'p_erotica:amaia_castillo_instance',
          getComponent: jest.fn(() => ({ text: 'Amaia Castillo' })),
        };
      }
      return null;
    });

    // Execute the multi-target resolution
    const result = await multiTargetStage.executeInternal(context);

    // Now the resolution should succeed with the fix
    expect(result.success).toBe(true);
    expect(result.data.actionsWithTargets).toHaveLength(1);

    // Verify the action has the correct target
    const actionWithTargets = result.data.actionsWithTargets[0];
    expect(actionWithTargets.actionDef).toBe(kneelBeforeAction);
    expect(actionWithTargets.targetContexts).toHaveLength(1);
    expect(actionWithTargets.targetContexts[0]).toEqual({
      type: 'entity',
      entityId: 'p_erotica:amaia_castillo_instance',
      displayName: 'p_erotica:amaia_castillo_instance',
      placeholder: 'actor',
    });

    // Verify that resolve was called correctly
    expect(mockUnifiedScopeResolver.resolve).toHaveBeenCalledTimes(1);
    const resolveCall = mockUnifiedScopeResolver.resolve.mock.calls[0];
    expect(resolveCall[0]).toBe('core:actors_in_location'); // scope
    expect(resolveCall[1]).toHaveProperty('actor'); // context with actor
    expect(resolveCall[2]).toEqual({ useCache: false }); // options
  });
});
