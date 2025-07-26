/**
 * @file testModuleIntegration.test.js
 * @description Integration tests for the Test Module Pattern implementation
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import {
  TestModuleBuilder,
  TestScenarioPresets,
  createTestModules,
} from '../../common/testing/builders/index.js';
import { createMockFacades } from '../../common/facades/testingFacadeRegistrations.js';

describe('Test Module Pattern Integration', () => {
  let testEnv;

  afterEach(async () => {
    if (testEnv?.cleanup) {
      await testEnv.cleanup();
    }
  });

  describe('TestModuleBuilder', () => {
    it('should create a turn execution test environment', async () => {
      testEnv = await TestModuleBuilder.forTurnExecution()
        .withMockLLM({ strategy: 'tool-calling' })
        .withTestActors(['ai-actor'])
        .withWorld({ name: 'Test World' })
        .build();

      expect(testEnv).toBeDefined();
      expect(testEnv.facades).toBeDefined();
      expect(testEnv.config.llm.strategy).toBe('tool-calling');
      expect(testEnv.config.actors).toHaveLength(1);
      expect(testEnv.config.world.name).toBe('Test World');
    });

    it('should create an entity management test environment', async () => {
      testEnv = await TestModuleBuilder.forEntityManagement()
        .withEntities([
          { type: 'core:actor', id: 'test-actor' },
          { type: 'core:item', id: 'test-item' },
        ])
        .withComponents({
          'test-actor': { 'core:health': { current: 100, max: 100 } },
        })
        .build();

      expect(testEnv).toBeDefined();
      expect(testEnv.entities).toBeDefined();
      expect(Object.keys(testEnv.entities)).toHaveLength(2);
      expect(testEnv.createEntity).toBeDefined();
      expect(testEnv.updateComponent).toBeDefined();
    });

    it('should create an LLM testing environment', async () => {
      testEnv = await TestModuleBuilder.forLLMTesting()
        .withStrategy('tool-calling')
        .withMockResponses({
          default: { actionId: 'core:wait' },
        })
        .build();

      expect(testEnv).toBeDefined();
      expect(testEnv.strategy).toBe('tool-calling');
      expect(testEnv.getAIDecision).toBeDefined();
      expect(testEnv.generatePrompt).toBeDefined();
    });
  });

  describe('Scenario Presets', () => {
    it('should create a combat scenario', async () => {
      testEnv = await TestModuleBuilder.scenarios.combat().build();

      expect(testEnv).toBeDefined();
      expect(testEnv.config.actors).toContainEqual(
        expect.objectContaining({ role: 'combatant' })
      );
      expect(testEnv.config.world.combatEnabled).toBe(true);
      expect(testEnv.config.monitoring.events).toContain('COMBAT_INITIATED');
    });

    it('should create a social interaction scenario', async () => {
      testEnv = await TestModuleBuilder.scenarios.socialInteraction().build();

      expect(testEnv).toBeDefined();
      expect(testEnv.config.actors).toContainEqual(
        expect.objectContaining({ role: 'merchant' })
      );
      expect(testEnv.config.world.socialInteractionsEnabled).toBe(true);
    });

    it('should create an entity management preset', async () => {
      testEnv = await TestScenarioPresets.entityManagement().build();

      expect(testEnv).toBeDefined();
      expect(testEnv.entities).toBeDefined();
      expect(testEnv.entities['player-1']).toBeDefined();
      expect(testEnv.entities['sword-legendary']).toBeDefined();
    });

    it('should create an LLM behavior preset', async () => {
      testEnv = await TestScenarioPresets.llmBehavior().build();

      expect(testEnv).toBeDefined();
      expect(testEnv.config.scenarios).toBeDefined();
      expect(testEnv.config.scenarios).toHaveLength(3);
      expect(testEnv.runScenario).toBeDefined();
    });
  });

  describe('Integration with Facades', () => {
    it('should work seamlessly with createMockFacades', async () => {
      const facades = createMockFacades({}, jest.fn);

      testEnv = await TestModuleBuilder.forTurnExecution()
        .withCustomFacades({
          llm: {
            llmAdapter: {
              getAIDecision: jest.fn().mockResolvedValue({
                actionId: 'core:custom-action',
              }),
            },
          },
        })
        .build();

      expect(testEnv.facades).toBeDefined();
      expect(testEnv.facades.llmService).toBeDefined();
    });

    it('should support performance tracking', async () => {
      testEnv = await TestModuleBuilder.forTurnExecution()
        .withTestActors(['ai-actor'])
        .withPerformanceTracking({
          thresholds: { turnExecution: 100 },
        })
        .build();

      expect(testEnv.getPerformanceMetrics).toBeDefined();
      expect(testEnv.checkPerformanceThresholds).toBeDefined();
    });

    it('should support event capture', async () => {
      testEnv = await TestModuleBuilder.forTurnExecution()
        .withTestActors(['ai-actor'])
        .withEventCapture(['AI_DECISION_MADE', 'ACTION_EXECUTED'])
        .build();

      expect(testEnv.getCapturedEvents).toBeDefined();
      expect(testEnv.clearCapturedEvents).toBeDefined();
    });
  });

  describe('Advanced Features', () => {
    it('should support cloning modules', async () => {
      const baseModule = TestModuleBuilder.forTurnExecution()
        .withMockLLM({ strategy: 'tool-calling' })
        .withTestActors(['ai-actor']);

      const clonedModule = baseModule.clone().withTestActors(['ai-actor-2']);

      const env1 = await baseModule.build();
      const env2 = await clonedModule.build();

      expect(env1.config.actors).toHaveLength(1);
      expect(env2.config.actors).toHaveLength(1);
      expect(env1.config.actors[0].id).not.toBe(env2.config.actors[0].id);

      await env1.cleanup();
      await env2.cleanup();
    });

    it('should validate configurations before building', () => {
      const module = TestModuleBuilder.forTurnExecution();

      // Test with invalid configuration (clear LLM config completely)
      module.withMockLLM({ strategy: null });
      const validation = module.validate();

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContainEqual(
        expect.objectContaining({
          code: 'MISSING_LLM_STRATEGY',
        })
      );
    });

    it('should support resetting module configuration', async () => {
      const module = TestModuleBuilder.forTurnExecution()
        .withMockLLM({ strategy: 'json-schema' })
        .withTestActors(['custom-actor']);

      // Reset the module
      module.reset();

      testEnv = await module
        .withMockLLM({ strategy: 'tool-calling' })
        .withTestActors(['reset-actor'])
        .build();

      expect(testEnv.config.llm.strategy).toBe('tool-calling');
      expect(testEnv.config.actors[0].id).toBe('reset-actor');
    });
  });

  describe('createTestModules Factory', () => {
    it('should create test modules with jest mocking', async () => {
      const { forTurnExecution, scenarios } = createTestModules(jest.fn);

      testEnv = await forTurnExecution()
        .withMockLLM({ strategy: 'tool-calling' })
        .withTestActors(['ai-actor'])
        .build();

      expect(testEnv).toBeDefined();
      expect(
        testEnv.facades.mockDeps.llm.llmAdapter.getAIDecision
      ).toBeDefined();
    });

    it('should provide access to all scenario presets', () => {
      const { scenarios } = createTestModules(jest.fn);

      expect(scenarios.combat).toBeDefined();
      expect(scenarios.socialInteraction).toBeDefined();
      expect(scenarios.exploration).toBeDefined();
      expect(scenarios.performance).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should throw validation error for invalid configuration', async () => {
      const module = TestModuleBuilder.forTurnExecution().withMockLLM({
        strategy: null,
      }); // Invalid LLM strategy

      await expect(module.build()).rejects.toThrow(
        'Invalid test module configuration'
      );
    });

    it('should provide helpful validation messages', () => {
      const module =
        TestModuleBuilder.forLLMTesting().withStrategy('invalid-strategy');

      const validation = module.validate();

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContainEqual(
        expect.objectContaining({
          code: 'INVALID_STRATEGY',
          message: expect.stringContaining(
            'Must be one of: tool-calling, json-schema'
          ),
        })
      );
    });
  });

  describe('Module Interoperability', () => {
    it('should allow switching between module types', async () => {
      // Start with turn execution
      const turnEnv = await TestModuleBuilder.forTurnExecution()
        .withMockLLM({ strategy: 'tool-calling' })
        .withTestActors(['ai-actor'])
        .build();

      expect(turnEnv.executeAITurn).toBeDefined();
      await turnEnv.cleanup();

      // Switch to entity management
      const entityEnv = await TestModuleBuilder.forEntityManagement()
        .withEntities([{ type: 'core:actor', id: 'test' }])
        .build();

      expect(entityEnv.createEntity).toBeDefined();
      await entityEnv.cleanup();

      // Switch to LLM testing
      testEnv = await TestModuleBuilder.forLLMTesting()
        .withStrategy('json-schema')
        .build();

      expect(testEnv.getAIDecision).toBeDefined();
    });
  });
});
