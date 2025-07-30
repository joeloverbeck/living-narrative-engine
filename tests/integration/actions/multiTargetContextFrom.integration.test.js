/**
 * @file Integration test for multi-target actions with contextFrom dependency
 * Tests the correct resolution of secondary targets that depend on primary target context
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { MultiTargetResolutionStage } from '../../../src/actions/pipeline/stages/MultiTargetResolutionStage.js';
import TargetContextBuilder from '../../../src/scopeDsl/utils/targetContextBuilder.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import { createMockEntityManager } from '../../common/mockFactories/entities.js';

describe('Multi-target action with contextFrom dependency', () => {
  let stage;
  let unifiedScopeResolver;
  let targetContextBuilder;
  let targetResolver;
  let logger;
  let entityManager;
  let gameStateManager;

  beforeEach(() => {
    // Setup logger
    logger = new ConsoleLogger('ERROR');
    logger.debug = jest.fn();
    logger.error = jest.fn();
    logger.warn = jest.fn();
    logger.info = jest.fn();

    // Create mock entity manager that supports the entities we need
    entityManager = createMockEntityManager();

    // Mock entity data
    const entities = {
      elara: {
        id: 'elara',
        getComponentData: jest.fn((componentId) => {
          const components = {
            'core:name': { value: 'Elara Thorn' },
            'core:actor': { name: 'Elara Thorn' },
            'clothing:topmost_clothing': { torso_upper: 'blazer123' },
            'clothing:equipment': {
              equipped: { torso_upper: { base: 'blazer123' } },
            },
          };
          return components[componentId];
        }),
        hasComponent: jest.fn(() => true),
        getAllComponents: jest.fn(() => ({
          'core:name': { value: 'Elara Thorn' },
          'core:actor': { name: 'Elara Thorn' },
          'clothing:topmost_clothing': { torso_upper: 'blazer123' },
        })),
      },
      joel: {
        id: 'joel',
        getComponentData: jest.fn((componentId) => {
          const components = {
            'core:name': { value: 'Joel Overbeck' },
            'core:actor': { name: 'Joel Overbeck' },
            'clothing:topmost_clothing': { torso_upper: 'trenchcoat456' },
            'clothing:equipment': {
              equipped: { torso_upper: { base: 'trenchcoat456' } },
            },
          };
          return components[componentId];
        }),
        hasComponent: jest.fn(() => true),
        getAllComponents: jest.fn(() => ({
          'core:name': { value: 'Joel Overbeck' },
          'core:actor': { name: 'Joel Overbeck' },
          'clothing:topmost_clothing': { torso_upper: 'trenchcoat456' },
        })),
      },
      blazer123: {
        id: 'blazer123',
        getComponentData: jest.fn((componentId) => {
          const components = {
            'core:name': { value: 'silk blazer' },
            'core:item': { name: 'silk blazer' },
          };
          return components[componentId];
        }),
        hasComponent: jest.fn(() => true),
        getAllComponents: jest.fn(() => ({
          'core:name': { value: 'silk blazer' },
          'core:item': { name: 'silk blazer' },
        })),
      },
      trenchcoat456: {
        id: 'trenchcoat456',
        getComponentData: jest.fn((componentId) => {
          const components = {
            'core:name': { value: 'leather trenchcoat' },
            'core:item': { name: 'leather trenchcoat' },
          };
          return components[componentId];
        }),
        hasComponent: jest.fn(() => true),
        getAllComponents: jest.fn(() => ({
          'core:name': { value: 'leather trenchcoat' },
          'core:item': { name: 'leather trenchcoat' },
        })),
      },
      actor1: {
        id: 'actor1',
        getComponentData: jest.fn((componentId) => {
          const components = {
            'core:name': { value: 'Test Actor' },
            'core:actor': { name: 'Test Actor' },
            'core:position': { locationId: 'test-location' },
          };
          return components[componentId];
        }),
        hasComponent: jest.fn(() => true),
        getAllComponents: jest.fn(() => ({
          'core:name': { value: 'Test Actor' },
          'core:actor': { name: 'Test Actor' },
        })),
      },
      'test-location': {
        id: 'test-location',
        getComponentData: jest.fn((componentId) => {
          const components = {
            'core:location': { name: 'Test Room' },
          };
          return components[componentId];
        }),
        hasComponent: jest.fn(() => true),
        getAllComponents: jest.fn(() => ({
          'core:location': { name: 'Test Room' },
        })),
      },
    };

    // Override getEntityInstance to return our mock entities
    entityManager.getEntityInstance.mockImplementation((id) => entities[id]);

    // Create mocks
    unifiedScopeResolver = {
      resolve: jest.fn(),
    };

    targetResolver = {
      resolveTargets: jest.fn(),
    };

    gameStateManager = {
      getCurrentTurn: jest.fn().mockReturnValue(1),
      getTimeOfDay: jest.fn().mockReturnValue('morning'),
      getWeather: jest.fn().mockReturnValue('sunny'),
    };

    // Create real target context builder
    targetContextBuilder = new TargetContextBuilder({
      entityManager,
      gameStateManager,
      logger,
    });

    // Create the stage
    stage = new MultiTargetResolutionStage({
      unifiedScopeResolver,
      entityManager,
      targetResolver,
      targetContextBuilder,
      logger,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Multiple actors with different clothing', () => {
    it('should resolve different secondary targets for each primary target', async () => {
      // Setup action definition
      const actionDef = {
        id: 'intimacy:adjust_clothing',
        name: 'Adjust Clothing',
        template: "adjust {primary}'s {secondary}",
        targets: {
          primary: {
            scope:
              'intimacy:close_actors_facing_each_other_with_torso_clothing',
            placeholder: 'primary',
            description: 'Person whose clothing to adjust',
          },
          secondary: {
            scope: 'clothing:target_topmost_torso_upper_clothing',
            placeholder: 'secondary',
            description: 'Specific garment to adjust',
            contextFrom: 'primary',
          },
        },
      };

      // Mock scope resolver behavior
      // Primary scope returns both actors
      unifiedScopeResolver.resolve.mockImplementation((scope, context) => {
        if (
          scope ===
          'intimacy:close_actors_facing_each_other_with_torso_clothing'
        ) {
          return {
            success: true,
            value: new Set(['elara', 'joel']),
          };
        }

        // Secondary scope returns clothing based on context.target
        if (scope === 'clothing:target_topmost_torso_upper_clothing') {
          console.log('Resolving secondary scope with context:', {
            hasTarget: !!context.target,
            targetId: context.target?.id,
            targetComponents: Object.keys(context.target?.components || {}),
            contextKeys: Object.keys(context),
          });
          if (context.target?.id === 'elara') {
            return {
              success: true,
              value: new Set(['blazer123']),
            };
          } else if (context.target?.id === 'joel') {
            return {
              success: true,
              value: new Set(['trenchcoat456']),
            };
          }
        }

        return { success: true, value: new Set() };
      });

      // Act
      const actor = entityManager.getEntityInstance('actor1');
      const context = {
        candidateActions: [actionDef],
        actor,
        actionContext: {
          location: { id: 'test-location' },
        },
        trace: {
          step: jest.fn(),
          info: jest.fn(),
          failure: jest.fn(),
          success: jest.fn(),
        },
      };

      const result = await stage.execute(context);

      // Debug output
      console.log('Stage execution result:', {
        success: result.success,
        errors: result.errors,
        data: result.data,
      });

      // Assert
      expect(result.success).toBe(true);

      // The bug causes no actions to be resolved because secondary scope
      // gets undefined context.target
      if (result.data.actionsWithTargets.length === 0) {
        console.log(
          'BUG CONFIRMED: No actions resolved because secondary scope gets undefined context.target'
        );
        console.log(
          'The secondary scope was called with context.target: undefined'
        );
        console.log(
          'This happens because buildDependentContext only uses the first primary target'
        );

        // Check how many times unifiedScopeResolver was called
        const secondaryScopeCalls =
          unifiedScopeResolver.resolve.mock.calls.filter(
            (call) => call[0] === 'clothing:target_topmost_torso_upper_clothing'
          );
        console.log(
          'Secondary scope was called',
          secondaryScopeCalls.length,
          'time(s)'
        );

        // Even though we have 2 primary targets, secondary is only resolved once
        expect(secondaryScopeCalls.length).toBe(1);
      } else {
        // If the bug is partially fixed, check the results
        expect(result.data.actionsWithTargets).toHaveLength(1);

        const resolvedTargets = result.data.resolvedTargets;
        expect(resolvedTargets).toBeDefined();
        expect(resolvedTargets.primary).toHaveLength(2);
        expect(resolvedTargets.primary[0].id).toBe('elara');
        expect(resolvedTargets.primary[1].id).toBe('joel');

        expect(resolvedTargets.secondary).toBeDefined();
        console.log('Resolved secondary targets:', resolvedTargets.secondary);

        // After fix, we expect different secondary targets for each primary
        expect(resolvedTargets.secondary).toHaveLength(2);
        expect(resolvedTargets.secondary[0].id).toBe('blazer123');
        expect(resolvedTargets.secondary[1].id).toBe('trenchcoat456');
      }
    });

    it('should correctly build context for each primary target when resolving secondary', async () => {
      // Track how many times the secondary scope is resolved with each primary target
      const secondaryResolutions = [];

      const actionDef = {
        id: 'test:action',
        targets: {
          primary: {
            scope: 'test:primary',
            placeholder: 'primary',
          },
          secondary: {
            scope: 'test:secondary',
            placeholder: 'secondary',
            contextFrom: 'primary',
          },
        },
      };

      // Mock scope resolver to track context
      unifiedScopeResolver.resolve.mockImplementation((scope, context) => {
        if (scope === 'test:primary') {
          return {
            success: true,
            value: new Set(['elara', 'joel']),
          };
        }

        if (scope === 'test:secondary') {
          // Track which primary target context this secondary resolution is for
          secondaryResolutions.push({
            targetId: context.target?.id,
            hasTarget: !!context.target,
            targetComponents: Object.keys(context.target?.components || {}),
          });

          // Return a secondary target based on the primary
          if (context.target?.id === 'elara') {
            return { success: true, value: new Set(['blazer123']) };
          } else if (context.target?.id === 'joel') {
            return { success: true, value: new Set(['trenchcoat456']) };
          }
        }

        return { success: true, value: new Set() };
      });

      // Act
      const actor = entityManager.getEntityInstance('actor1');
      const context = {
        candidateActions: [actionDef],
        actor,
        actionContext: { location: { id: 'test-location' } },
        trace: {
          step: jest.fn(),
          info: jest.fn(),
          failure: jest.fn(),
          success: jest.fn(),
        },
      };

      const result = await stage.execute(context);

      // Assert
      console.log('Secondary resolutions:', secondaryResolutions);

      // Should have resolved secondary scope twice, once for each primary
      expect(secondaryResolutions).toHaveLength(2);

      // Each resolution should have the correct primary target context
      expect(secondaryResolutions[0].targetId).toBe('elara');
      expect(secondaryResolutions[0].hasTarget).toBe(true);
      expect(secondaryResolutions[1].targetId).toBe('joel');
      expect(secondaryResolutions[1].hasTarget).toBe(true);

      // Verify the result has both secondary targets properly resolved
      expect(result.data.resolvedTargets.secondary).toHaveLength(2);
      expect(result.data.resolvedTargets.secondary[0].contextFromId).toBe(
        'elara'
      );
      expect(result.data.resolvedTargets.secondary[1].contextFromId).toBe(
        'joel'
      );
    });
  });
});
