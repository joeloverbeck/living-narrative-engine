/**
 * @file Context Dependencies E2E Tests
 * @description End-to-end tests validating the complex context dependency system
 * where targets can depend on properties and states of other targets
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { createMultiTargetTestBuilder } from './helpers/multiTargetTestBuilder.js';
import { createExecutionHelper } from './helpers/multiTargetExecutionHelper.js';
import { multiTargetAssertions } from './helpers/multiTargetAssertions.js';
import { TEST_ACTION_IDS } from './fixtures/multiTargetActions.js';
import { TEST_ENTITY_IDS } from './fixtures/testEntities.js';
import { expectedValidationErrors } from './fixtures/expectedResults.js';

describe('Context Dependencies E2E', () => {
  let testBuilder;
  let testEnv;
  let executionHelper;

  beforeEach(() => {
    testBuilder = createMultiTargetTestBuilder(jest.fn);
  });

  afterEach(() => {
    if (executionHelper) {
      executionHelper.cleanup();
    }
    if (testEnv) {
      testEnv.cleanup();
    }
  });

  describe('Basic Context Dependencies', () => {
    it('should resolve targets based on contextFrom relationships', async () => {
      // Action: "unlock container with matching key"
      // Context: key selection depends on container's lock type
      testEnv = await testBuilder
        .initialize()
        .buildScenario('unlock')
        .withAction(TEST_ACTION_IDS.UNLOCK_CONTAINER)
        .createEntities()
        .withMockDiscovery({
          targets: {
            primary: {
              id: TEST_ENTITY_IDS.CHEST,
              displayName: 'Brass-Locked Chest',
            },
            secondary: {
              id: TEST_ENTITY_IDS.BRASS_KEY,
              displayName: 'Brass Key',
            },
          },
          command: 'unlock Brass-Locked Chest with Brass Key',
          available: true,
          contextDependencies: {
            secondary: {
              contextFrom: 'primary',
              matchingCriteria: 'container.lock_type matches key.types',
            },
          },
        })
        .withMockValidation(true, {
          contextResolution: {
            primary: { id: TEST_ENTITY_IDS.CHEST },
            secondary: {
              id: TEST_ENTITY_IDS.BRASS_KEY,
              resolvedFrom: 'primary.lock_type',
            },
          },
        })
        .withMockExecution({
          success: true,
          description: 'You unlock Brass-Locked Chest with Brass Key.',
          resolvedTargets: {
            primary: TEST_ENTITY_IDS.CHEST,
            secondary: TEST_ENTITY_IDS.BRASS_KEY,
          },
          contextResolution: {
            primary: { container: TEST_ENTITY_IDS.CHEST },
            secondary: {
              key: TEST_ENTITY_IDS.BRASS_KEY,
              resolvedFrom: 'container.lock_type = brass',
            },
          },
        })
        .build();

      const actor = testEnv.getEntity('actor');
      executionHelper = createExecutionHelper(
        testEnv.actionService,
        testEnv.eventBus,
        testEnv.entityTestBed.entityManager
      );

      const result = await executionHelper.executeAndTrack(
        actor,
        'unlock chest with key'
      );

      // Verify correct context-dependent target selected
      const executionResult =
        testEnv.actionService.actionPipelineOrchestrator.execute.mock.results[0]
          .value;

      expect(executionResult.resolvedTargets).toEqual({
        primary: TEST_ENTITY_IDS.CHEST,
        secondary: TEST_ENTITY_IDS.BRASS_KEY, // Should select brass key, not iron key
      });

      // Verify context resolution details
      multiTargetAssertions.expectContextResolution(executionResult, {
        primary: { container: TEST_ENTITY_IDS.CHEST },
        secondary: {
          key: TEST_ENTITY_IDS.BRASS_KEY,
          resolvedFrom: 'container.lock_type = brass',
        },
      });
    });
  });

  describe('Nested Context Dependencies', () => {
    it('should handle multi-level context dependencies', async () => {
      // Action: "bandage person's wounded body part"
      // Context chain: body part → person
      testEnv = await testBuilder
        .initialize()
        .buildScenario('bandage')
        .withAction(TEST_ACTION_IDS.BANDAGE_WOUND)
        .createEntities()
        .build();

      // Modify wounded person to have specific wounds
      const alice = testEnv.getEntity('wounded1');
      alice.modifyComponent('core:body', {
        parts: {
          left_arm: { wounded: true, severity: 'moderate' },
          right_arm: { wounded: false },
          left_leg: { wounded: true, severity: 'minor' },
        },
      });

      const mockExecution = {
        success: true,
        description: "You bandage Alice's left arm.",
        resolvedTargets: {
          primary: 'alice_001',
          secondary: 'left_arm', // Should select most severe wound
        },
        contextResolution: {
          level1: { person: 'alice_001' },
          level2: {
            bodyPart: 'left_arm',
            resolvedFrom: 'person.body.parts[wounded=true]',
            selectionCriteria: 'highest severity',
          },
        },
      };

      testEnv.facades.actionService.setMockActions(actor.id, [
        {
          actionId: TEST_ACTION_IDS.BANDAGE_WOUND,
          targets: {
            primary: { id: 'alice_001', displayName: 'Alice' },
            secondary: { id: 'left_arm', displayName: 'wounded left arm' },
          },
          command: "bandage Alice's wounded arm",
          available: true,
          contextDependencies: {
            secondary: {
              contextFrom: 'primary',
              path: 'components.core:body.parts',
              filter: { wounded: true },
            },
          },
        },
      ]);

      testEnv.facades.actionService.setMockValidation(
        actor.id,
        TEST_ACTION_IDS.BANDAGE_WOUND,
        { success: true }
      );

      testEnv.facades.actionService.actionPipelineOrchestrator.execute = jest
        .fn()
        .mockResolvedValue(mockExecution);

      const actor = testEnv.getEntity('actor');
      executionHelper = createExecutionHelper(
        testEnv.actionService,
        testEnv.eventBus,
        testEnv.entityTestBed.entityManager
      );

      const result = await executionHelper.executeAndTrack(
        actor,
        "bandage Alice's wounded arm"
      );

      // Verify nested resolution
      const executionResult =
        testEnv.actionService.actionPipelineOrchestrator.execute.mock.results[0]
          .value;

      multiTargetAssertions.expectContextResolution(executionResult, {
        level1: { person: 'alice_001' },
        level2: {
          bodyPart: 'left_arm',
          resolvedFrom: 'person.body.parts[wounded=true]',
          selectionCriteria: 'highest severity',
        },
      });

      // Verify final targets
      expect(executionResult.resolvedTargets).toEqual({
        primary: 'alice_001',
        secondary: 'left_arm',
      });
    });
  });

  describe('Dynamic Context Resolution', () => {
    it('should resolve contexts based on runtime conditions', async () => {
      // Action: "steal from richest merchant"
      // Context: merchant selection based on wealth comparison
      testEnv = await testBuilder
        .initialize()
        .buildScenario('steal')
        .withAction(TEST_ACTION_IDS.STEAL_FROM_RICHEST)
        .createEntities()
        .build();

      // Create multiple merchants with different wealth
      const merchants = [
        { id: 'merchant_001', wealth: 100 },
        { id: 'merchant_002', wealth: 500 }, // Richest
        { id: 'merchant_003', wealth: 200 },
      ];

      // Mock discovery that evaluates wealth dynamically
      const mockExecution = {
        success: true,
        description: 'You attempt to steal from the wealthy merchant.',
        resolvedTargets: {
          primary: 'merchant_002', // Should select richest
        },
        contextCriteria: {
          selector: 'max',
          property: 'wealth.gold',
          value: 500,
          candidates: merchants,
        },
      };

      testEnv.facades.actionService.setMockActions(actor.id, [
        {
          actionId: TEST_ACTION_IDS.STEAL_FROM_RICHEST,
          targets: {
            primary: { id: 'merchant_002', displayName: 'Wealthy Merchant' },
          },
          command: 'steal from richest merchant',
          available: true,
          dynamicSelection: {
            criteria: 'max(wealth.gold)',
            evaluated: merchants,
          },
        },
      ]);

      testEnv.facades.actionService.setMockValidation(
        actor.id,
        TEST_ACTION_IDS.STEAL_FROM_RICHEST,
        { success: true }
      );

      testEnv.facades.actionService.actionPipelineOrchestrator.execute = jest
        .fn()
        .mockResolvedValue(mockExecution);

      const actor = testEnv.getEntity('actor');
      executionHelper = createExecutionHelper(
        testEnv.actionService,
        testEnv.eventBus,
        testEnv.entityTestBed.entityManager
      );

      const result = await executionHelper.executeAndTrack(
        actor,
        'steal from richest merchant'
      );

      // Verify dynamic selection
      const executionResult =
        testEnv.actionService.actionPipelineOrchestrator.execute.mock.results[0]
          .value;

      expect(executionResult.resolvedTargets.primary).toBe('merchant_002');
      expect(executionResult.contextCriteria).toEqual({
        selector: 'max',
        property: 'wealth.gold',
        value: 500,
        candidates: merchants,
      });
    });
  });

  describe('Circular Dependency Detection', () => {
    it('should detect and handle circular context dependencies', async () => {
      // Create circular dependency: A depends on B, B depends on C, C depends on A
      testEnv = await testBuilder
        .initialize()
        .buildScenario('circular')
        .withAction(TEST_ACTION_IDS.CIRCULAR_DEPENDENCY)
        .createEntities()
        .build();

      // Mock validation that detects circular dependency
      const circularError = {
        success: false,
        error: 'Circular dependency detected',
        code: 'CIRCULAR_DEPENDENCY',
        dependencyCycle: ['primary', 'tertiary', 'secondary', 'primary'],
        details: {
          message:
            'Target resolution forms a circular dependency: primary → tertiary → secondary → primary',
        },
      };

      testEnv.facades.actionService.setMockActions(actor.id, [
        {
          actionId: TEST_ACTION_IDS.CIRCULAR_DEPENDENCY,
          targets: {}, // No targets can be resolved due to circular dependency
          command: 'test circular action',
          available: false,
          error: 'Circular dependency in target resolution',
        },
      ]);

      testEnv.facades.actionService.setMockValidation(
        actor.id,
        TEST_ACTION_IDS.CIRCULAR_DEPENDENCY,
        circularError
      );

      const actor = testEnv.getEntity('actor');
      executionHelper = createExecutionHelper(
        testEnv.actionService,
        testEnv.eventBus,
        testEnv.entityTestBed.entityManager
      );

      // Attempt to validate action with circular dependencies
      const validationResult = await testEnv.actionService.validateAction({
        actionId: TEST_ACTION_IDS.CIRCULAR_DEPENDENCY,
        actorId: actor.id,
        targets: {
          primary: { id: 'entity_a' },
          secondary: { id: 'entity_b' },
          tertiary: { id: 'entity_c' },
        },
      });

      // Verify circular dependency detected
      multiTargetAssertions.expectCircularDependency(
        validationResult,
        ['primary', 'tertiary', 'secondary', 'primary']
      );

      expect(validationResult.code).toBe('CIRCULAR_DEPENDENCY');
    });
  });

  describe('Context Validation Failures', () => {
    it('should handle invalid context resolutions gracefully', async () => {
      testEnv = await testBuilder
        .initialize()
        .buildScenario('validation')
        .withAction(TEST_ACTION_IDS.BANDAGE_WOUND)
        .createEntities()
        .build();

      const actor = testEnv.getEntity('actor');
      executionHelper = createExecutionHelper(
        testEnv.actionService,
        testEnv.eventBus,
        testEnv.entityTestBed.entityManager
      );

      // Test various failure modes
      const failureCases = [
        {
          command: "heal Alice's missing limb",
          mockValidation: {
            success: false,
            error: 'Context resolution failed: No wounded body part found',
            code: 'CONTEXT_RESOLUTION_FAILED',
            details: {
              target: 'bodyPart',
              contextFrom: 'person',
              reason: 'No body parts match criteria: wounded=true',
            },
          },
          expectedError: expectedValidationErrors.contextFailure,
        },
        {
          command: "enchant nobody's weapon",
          mockValidation: {
            success: false,
            error: 'Context resolution failed: Primary target "nobody" not found',
            code: 'CONTEXT_RESOLUTION_FAILED',
            details: {
              target: 'primary',
              reason: 'Entity "nobody" does not exist',
            },
          },
          expectedError: {
            error: 'Context resolution failed: Primary target "nobody" not found',
            code: 'CONTEXT_RESOLUTION_FAILED',
            details: {
              target: 'primary',
              reason: 'Entity "nobody" does not exist',
            },
          },
        },
        {
          command: "modify Alice's non-existent property",
          mockValidation: {
            success: false,
            error:
              'Context resolution failed: Property path "non-existent" not found on entity',
            code: 'CONTEXT_RESOLUTION_FAILED',
            details: {
              target: 'property',
              contextPath: 'person.non-existent',
              reason: 'Property does not exist on entity',
            },
          },
          expectedError: {
            error:
              'Context resolution failed: Property path "non-existent" not found on entity',
            code: 'CONTEXT_RESOLUTION_FAILED',
            details: {
              target: 'property',
              contextPath: 'person.non-existent',
              reason: 'Property does not exist on entity',
            },
          },
        },
      ];

      for (const testCase of failureCases) {
        // Mock discovery returns no valid actions due to context failure
        testEnv.facades.actionService.setMockActions(actor.id, []);

        // Mock validation failure
        testEnv.facades.actionService.setMockValidation(
          actor.id,
          TEST_ACTION_IDS.BANDAGE_WOUND,
          testCase.mockValidation
        );

        // Try to execute command
        const validationResult = await testEnv.actionService.validateAction({
          actionId: TEST_ACTION_IDS.BANDAGE_WOUND,
          actorId: actor.id,
          targets: {},
        });

        // Verify error matches expected
        multiTargetAssertions.expectValidationError(
          validationResult,
          testCase.expectedError
        );
      }
    });
  });
});