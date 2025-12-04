/**
 * @file Integration tests for GET_DAMAGE_CAPABILITIES operation handler
 * @description Validates that the GET_DAMAGE_CAPABILITIES operation correctly retrieves
 * damage capabilities from entities with explicit damage definitions and generates
 * appropriate improvised damage capabilities for entities with only weight.
 */

import {
  describe,
  beforeEach,
  afterEach,
  test,
  expect,
  jest,
} from '@jest/globals';

// Core system components
import OperationInterpreter from '../../../../src/logic/operationInterpreter.js';
import OperationRegistry from '../../../../src/logic/operationRegistry.js';
import GetDamageCapabilitiesHandler from '../../../../src/logic/operationHandlers/getDamageCapabilitiesHandler.js';

// Test utilities
import { SimpleEntityManager } from '../../../common/entities/index.js';

describe('GET_DAMAGE_CAPABILITIES - Integration Tests', () => {
  let entityManager;
  let operationRegistry;
  let operationInterpreter;
  let handler;
  let mockLogger;
  let mockDispatcher;
  let mockJsonLogicService;
  let executionContext;

  const DAMAGE_CAPABILITIES_COMPONENT = 'damage-types:damage_capabilities';
  const WEIGHT_COMPONENT = 'core:weight';

  beforeEach(() => {
    // Create logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    // Create dispatcher mock
    mockDispatcher = {
      dispatch: jest.fn().mockResolvedValue(true),
    };

    // Create entity manager
    entityManager = new SimpleEntityManager();

    // Create operation system
    operationRegistry = new OperationRegistry({ logger: mockLogger });
    operationInterpreter = new OperationInterpreter({
      logger: mockLogger,
      operationRegistry,
    });

    // Create mock JSON Logic service
    mockJsonLogicService = {
      evaluate: jest.fn(),
    };

    // Create handler and register it
    handler = new GetDamageCapabilitiesHandler({
      entityManager,
      logger: mockLogger,
      safeEventDispatcher: mockDispatcher,
      jsonLogicService: mockJsonLogicService,
    });
    operationRegistry.register(
      'GET_DAMAGE_CAPABILITIES',
      handler.execute.bind(handler)
    );

    // Create execution context
    executionContext = {
      event: {
        payload: {
          actorId: 'actor_1',
          targetId: 'target_1',
          primaryId: 'weapon_1',
        },
      },
      evaluationContext: {
        actor: { id: 'actor_1' },
        target: { id: 'target_1' },
        context: {},
        event: {
          payload: {
            actorId: 'actor_1',
            targetId: 'target_1',
            primaryId: 'weapon_1',
          },
        },
      },
      logger: mockLogger,
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Real Weapon Entities with Explicit Damage Capabilities', () => {
    test('should return existing damage capabilities from weapon entity', async () => {
      // Create a weapon with explicit damage capabilities (like vespera_rapier)
      entityManager.addComponent('rapier', 'items:item', {});
      entityManager.addComponent('rapier', 'items:portable', {});
      entityManager.addComponent('rapier', 'weapons:weapon', {});
      entityManager.addComponent('rapier', DAMAGE_CAPABILITIES_COMPONENT, {
        entries: [
          {
            name: 'piercing',
            amount: 18,
            penetration: 0.6,
            bleed: {
              enabled: true,
              severity: 'moderate',
              baseDurationTurns: 3,
            },
          },
          {
            name: 'slashing',
            amount: 8,
            penetration: 0.1,
            bleed: {
              enabled: true,
              severity: 'minor',
              baseDurationTurns: 2,
            },
            dismember: {
              enabled: true,
              thresholdFraction: 0.9,
            },
          },
        ],
      });
      entityManager.addComponent('rapier', WEIGHT_COMPONENT, { weight: 1.2 });

      const params = {
        entity_ref: 'rapier',
        output_variable: 'weapon_damage',
      };

      await handler.execute(params, executionContext);

      // Verify capabilities were stored
      const storedCapabilities =
        executionContext.evaluationContext.context.weapon_damage;
      expect(storedCapabilities).toBeDefined();
      expect(Array.isArray(storedCapabilities)).toBe(true);
      expect(storedCapabilities.length).toBe(2);

      // Verify first entry (piercing)
      expect(storedCapabilities[0].name).toBe('piercing');
      expect(storedCapabilities[0].amount).toBe(18);
      expect(storedCapabilities[0].penetration).toBe(0.6);

      // Verify second entry (slashing)
      expect(storedCapabilities[1].name).toBe('slashing');
      expect(storedCapabilities[1].amount).toBe(8);
    });

    test('should handle weapon with single damage type', async () => {
      entityManager.addComponent('sword', 'weapons:weapon', {});
      entityManager.addComponent('sword', DAMAGE_CAPABILITIES_COMPONENT, {
        entries: [
          {
            name: 'slashing',
            amount: 25,
            effects: { canSever: true },
          },
        ],
      });

      const params = {
        entity_ref: 'sword',
        output_variable: 'sword_damage',
      };

      await handler.execute(params, executionContext);

      const storedCapabilities =
        executionContext.evaluationContext.context.sword_damage;
      expect(storedCapabilities).toHaveLength(1);
      expect(storedCapabilities[0].name).toBe('slashing');
      expect(storedCapabilities[0].amount).toBe(25);
    });
  });

  describe('Non-Weapon Portable Items with Weight', () => {
    test('should generate improvised blunt damage from heavy item (gold bar)', async () => {
      // Create a gold bar (12.4 kg) - heavy item for improvised weapon
      entityManager.addComponent('gold_bar', 'items:item', {});
      entityManager.addComponent('gold_bar', 'items:portable', {});
      entityManager.addComponent('gold_bar', WEIGHT_COMPONENT, { weight: 12.4 });
      // No damage_capabilities component - should generate from weight

      const params = {
        entity_ref: 'gold_bar',
        output_variable: 'improvised_damage',
      };

      await handler.execute(params, executionContext);

      const storedCapabilities =
        executionContext.evaluationContext.context.improvised_damage;
      expect(storedCapabilities).toBeDefined();
      expect(storedCapabilities.length).toBe(1);

      const bluntEntry = storedCapabilities[0];
      expect(bluntEntry.name).toBe('blunt');
      // Formula: Math.ceil(12.4 * 5) = 62, capped at 50
      expect(bluntEntry.amount).toBe(50);
      expect(bluntEntry.penetration).toBe(0);
      // Fracture enabled for items >= 1.0kg
      expect(bluntEntry.fracture).toBeDefined();
      expect(bluntEntry.fracture.enabled).toBe(true);
      // Improvised flag should be present
      expect(bluntEntry.flags).toContain('improvised');
    });

    test('should generate minimal damage from light item (coffee cup)', async () => {
      // Create a light item (< 0.2 kg gives 1 damage)
      entityManager.addComponent('coffee_cup', 'items:item', {});
      entityManager.addComponent('coffee_cup', 'items:portable', {});
      entityManager.addComponent('coffee_cup', WEIGHT_COMPONENT, { weight: 0.15 });

      const params = {
        entity_ref: 'coffee_cup',
        output_variable: 'cup_damage',
      };

      await handler.execute(params, executionContext);

      const storedCapabilities =
        executionContext.evaluationContext.context.cup_damage;
      expect(storedCapabilities.length).toBe(1);

      const bluntEntry = storedCapabilities[0];
      expect(bluntEntry.name).toBe('blunt');
      // Formula: Math.ceil(0.15 * 5) = 1 (minimum)
      expect(bluntEntry.amount).toBe(1);
      expect(bluntEntry.penetration).toBe(0);
      // Fracture disabled for items < 1.0kg
      expect(bluntEntry.fracture.enabled).toBe(false);
      expect(bluntEntry.flags).toContain('improvised');
    });

    test('should calculate correct damage at threshold (1kg item)', async () => {
      entityManager.addComponent('book', 'items:item', {});
      entityManager.addComponent('book', WEIGHT_COMPONENT, { weight: 1.0 });

      const params = {
        entity_ref: 'book',
        output_variable: 'book_damage',
      };

      await handler.execute(params, executionContext);

      const storedCapabilities =
        executionContext.evaluationContext.context.book_damage;
      const bluntEntry = storedCapabilities[0];
      // Formula: Math.ceil(1.0 * 5) = 5
      expect(bluntEntry.amount).toBe(5);
      // Fracture enabled at exactly 1.0kg threshold
      expect(bluntEntry.fracture.enabled).toBe(true);
    });
  });

  describe('Entities Without Weight Component (Weightless Fallback)', () => {
    test('should return fallback entry for entity with no weight or damage capabilities', async () => {
      // Create entity with no weight and no damage capabilities
      entityManager.addComponent('magic_orb', 'items:item', {});
      entityManager.addComponent('magic_orb', 'items:portable', {});
      // No weight component, no damage capabilities

      const params = {
        entity_ref: 'magic_orb',
        output_variable: 'orb_damage',
      };

      await handler.execute(params, executionContext);

      const storedCapabilities =
        executionContext.evaluationContext.context.orb_damage;
      expect(storedCapabilities.length).toBe(1);

      const fallbackEntry = storedCapabilities[0];
      expect(fallbackEntry.name).toBe('blunt');
      expect(fallbackEntry.amount).toBe(1);
      expect(fallbackEntry.penetration).toBe(0);
      expect(fallbackEntry.fracture.enabled).toBe(false);
      expect(fallbackEntry.flags).toContain('improvised');
      expect(fallbackEntry.flags).toContain('weightless');
    });

    test('should handle entity with weight of 0', async () => {
      entityManager.addComponent('feather', 'items:item', {});
      entityManager.addComponent('feather', WEIGHT_COMPONENT, { weight: 0 });

      const params = {
        entity_ref: 'feather',
        output_variable: 'feather_damage',
      };

      await handler.execute(params, executionContext);

      const storedCapabilities =
        executionContext.evaluationContext.context.feather_damage;
      const entry = storedCapabilities[0];
      // Math.ceil(0 * 5) = 0, clamped to minimum 1
      expect(entry.amount).toBe(1);
      expect(entry.flags).toContain('improvised');
    });
  });

  describe('Entity Resolution with Keywords', () => {
    test('should resolve "primary" keyword to primary target entity', async () => {
      // Setup primary entity (weapon_1 from event payload)
      entityManager.addComponent('weapon_1', 'weapons:weapon', {});
      entityManager.addComponent('weapon_1', DAMAGE_CAPABILITIES_COMPONENT, {
        entries: [{ name: 'slashing', amount: 20 }],
      });

      const params = {
        entity_ref: 'primary',
        output_variable: 'primary_damage',
      };

      await handler.execute(params, executionContext);

      const storedCapabilities =
        executionContext.evaluationContext.context.primary_damage;
      expect(storedCapabilities).toBeDefined();
      expect(storedCapabilities[0].name).toBe('slashing');
      expect(storedCapabilities[0].amount).toBe(20);
    });

    test('should resolve "actor" keyword to actor entity', async () => {
      entityManager.addComponent('actor_1', WEIGHT_COMPONENT, { weight: 80 });

      const params = {
        entity_ref: 'actor',
        output_variable: 'actor_damage',
      };

      await handler.execute(params, executionContext);

      const storedCapabilities =
        executionContext.evaluationContext.context.actor_damage;
      expect(storedCapabilities).toBeDefined();
      // 80kg * 5 = 400, capped at 50
      expect(storedCapabilities[0].amount).toBe(50);
    });
  });

  describe('JSON Logic Entity Resolution', () => {
    test('should resolve entity via JSON Logic expression', async () => {
      entityManager.addComponent('dynamic_weapon', 'weapons:weapon', {});
      entityManager.addComponent('dynamic_weapon', DAMAGE_CAPABILITIES_COMPONENT, {
        entries: [{ name: 'crushing', amount: 30 }],
      });

      // Set up context with dynamic entity reference
      executionContext.evaluationContext.context.selectedWeaponId =
        'dynamic_weapon';

      // Mock JSON Logic evaluation to return the entity ID
      mockJsonLogicService.evaluate.mockReturnValue('dynamic_weapon');

      const params = {
        entity_ref: { var: 'context.selectedWeaponId' },
        output_variable: 'json_logic_damage',
      };

      await handler.execute(params, executionContext);

      const storedCapabilities =
        executionContext.evaluationContext.context.json_logic_damage;
      expect(storedCapabilities).toBeDefined();
      expect(storedCapabilities[0].name).toBe('crushing');
      expect(storedCapabilities[0].amount).toBe(30);
    });
  });

  describe('Error Handling in Integration Context', () => {
    test('should dispatch error when entity_ref cannot be resolved', async () => {
      // Use an object ref that JSON Logic will fail to evaluate
      mockJsonLogicService.evaluate.mockReturnValue(null);

      const params = {
        entity_ref: { var: 'nonexistent.path' },
        output_variable: 'should_not_exist',
      };

      handler.execute(params, executionContext);

      // Should dispatch system error via safeDispatchError
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining(
            'GET_DAMAGE_CAPABILITIES: Could not resolve entity'
          ),
        })
      );

      // Output variable should not be set
      expect(
        executionContext.evaluationContext.context.should_not_exist
      ).toBeUndefined();
    });

    test('should dispatch error for missing output_variable', async () => {
      entityManager.addComponent('test_item', WEIGHT_COMPONENT, { weight: 2.0 });

      const params = {
        entity_ref: 'test_item',
        // output_variable missing
      };

      handler.execute(params, executionContext);

      // Handler uses safeDispatchError for missing parameters
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('output_variable'),
        })
      );
    });

    test('should dispatch error for missing evaluation context', async () => {
      entityManager.addComponent('test_weapon', DAMAGE_CAPABILITIES_COMPONENT, {
        entries: [{ name: 'piercing', amount: 15 }],
      });

      const incompleteContext = {
        logger: mockLogger,
        // Missing evaluationContext
      };

      const params = {
        entity_ref: 'test_weapon',
        output_variable: 'result',
      };

      // Handler is synchronous and won't throw - it dispatches error
      handler.execute(params, incompleteContext);

      // Should dispatch error about missing execution context
      expect(mockDispatcher.dispatch).toHaveBeenCalled();
    });
  });

  describe('Integration with Operation Interpreter', () => {
    test('should execute correctly through operation interpreter', async () => {
      entityManager.addComponent('interpreter_weapon', 'weapons:weapon', {});
      entityManager.addComponent(
        'interpreter_weapon',
        DAMAGE_CAPABILITIES_COMPONENT,
        {
          entries: [{ name: 'bludgeoning', amount: 12, penetration: 0.2 }],
        }
      );

      const operation = {
        type: 'GET_DAMAGE_CAPABILITIES',
        parameters: {
          entity_ref: 'interpreter_weapon',
          output_variable: 'interpreter_result',
        },
      };

      await operationInterpreter.execute(operation, executionContext);

      const storedCapabilities =
        executionContext.evaluationContext.context.interpreter_result;
      expect(storedCapabilities).toBeDefined();
      expect(storedCapabilities[0].name).toBe('bludgeoning');
      expect(storedCapabilities[0].amount).toBe(12);
    });
  });

  describe('Real-World Entity Patterns', () => {
    test('should handle practice weapon with low damage', async () => {
      // Similar to rill_practice_stick entity pattern
      entityManager.addComponent('practice_stick', 'items:item', {});
      entityManager.addComponent('practice_stick', 'weapons:weapon', {});
      entityManager.addComponent('practice_stick', DAMAGE_CAPABILITIES_COMPONENT, {
        entries: [
          {
            name: 'blunt',
            amount: 3,
            penetration: 0,
            effects: {},
          },
        ],
      });

      const params = {
        entity_ref: 'practice_stick',
        output_variable: 'practice_damage',
      };

      await handler.execute(params, executionContext);

      const storedCapabilities =
        executionContext.evaluationContext.context.practice_damage;
      expect(storedCapabilities[0].name).toBe('blunt');
      expect(storedCapabilities[0].amount).toBe(3);
    });

    test('should handle multi-damage-type weapon (sword with slash and thrust)', async () => {
      entityManager.addComponent('longsword', 'weapons:weapon', {});
      entityManager.addComponent('longsword', DAMAGE_CAPABILITIES_COMPONENT, {
        entries: [
          { name: 'slashing', amount: 22, penetration: 0.3 },
          { name: 'piercing', amount: 15, penetration: 0.5 },
          { name: 'blunt', amount: 5, penetration: 0 }, // Pommel strike
        ],
      });

      const params = {
        entity_ref: 'longsword',
        output_variable: 'longsword_damage',
      };

      await handler.execute(params, executionContext);

      const storedCapabilities =
        executionContext.evaluationContext.context.longsword_damage;
      expect(storedCapabilities).toHaveLength(3);
      expect(storedCapabilities.map((e) => e.name)).toEqual([
        'slashing',
        'piercing',
        'blunt',
      ]);
    });
  });
});
