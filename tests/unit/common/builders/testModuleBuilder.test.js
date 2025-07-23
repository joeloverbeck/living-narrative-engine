/**
 * @file testModuleBuilder.test.js
 * @description Unit tests for TestModuleBuilder entry point
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { TestModuleBuilder } from '../../../../tests/common/builders/testModuleBuilder.js';
import { TurnExecutionTestModule } from '../../../../tests/common/builders/modules/turnExecutionTestModule.js';
import { ActionProcessingTestModule } from '../../../../tests/common/builders/modules/actionProcessingTestModule.js';
import { EntityManagementTestModule } from '../../../../tests/common/builders/modules/entityManagementTestModule.js';
import { LLMTestingModule } from '../../../../tests/common/builders/modules/llmTestingModule.js';

describe('TestModuleBuilder', () => {
  describe('Factory Methods', () => {
    it('should create TurnExecutionTestModule via forTurnExecution()', () => {
      const module = TestModuleBuilder.forTurnExecution();
      
      expect(module).toBeInstanceOf(TurnExecutionTestModule);
      expect(module.build).toBeDefined();
      expect(module.validate).toBeDefined();
      expect(module.reset).toBeDefined();
    });

    it('should create ActionProcessingTestModule via forActionProcessing()', () => {
      const module = TestModuleBuilder.forActionProcessing();
      
      expect(module).toBeInstanceOf(ActionProcessingTestModule);
      expect(module.build).toBeDefined();
      expect(module.validate).toBeDefined();
      expect(module.reset).toBeDefined();
    });

    it('should create EntityManagementTestModule via forEntityManagement()', () => {
      const module = TestModuleBuilder.forEntityManagement();
      
      expect(module).toBeInstanceOf(EntityManagementTestModule);
      expect(module.build).toBeDefined();
      expect(module.validate).toBeDefined();
      expect(module.reset).toBeDefined();
    });

    it('should create LLMTestingModule via forLLMTesting()', () => {
      const module = TestModuleBuilder.forLLMTesting();
      
      expect(module).toBeInstanceOf(LLMTestingModule);
      expect(module.build).toBeDefined();
      expect(module.validate).toBeDefined();
      expect(module.reset).toBeDefined();
    });
  });

  describe('Scenario Presets', () => {
    it('should create combat scenario', () => {
      const module = TestModuleBuilder.scenarios.combat();
      
      expect(module).toBeInstanceOf(TurnExecutionTestModule);
      
      const config = module.getConfiguration();
      expect(config.llm.strategy).toBe('tool-calling');
      expect(config.llm.temperature).toBe(0.8);
      expect(config.actors).toHaveLength(3); // fighter, enemy, observer
      expect(config.world.combatEnabled).toBe(true);
    });

    it('should create social interaction scenario', () => {
      const module = TestModuleBuilder.scenarios.socialInteraction();
      
      expect(module).toBeInstanceOf(TurnExecutionTestModule);
      
      const config = module.getConfiguration();
      expect(config.llm.strategy).toBe('json-schema');
      expect(config.llm.temperature).toBe(1.2);
      expect(config.actors).toHaveLength(2); // npc, player
      expect(config.world.socialInteractionsEnabled).toBe(true);
    });

    it('should create exploration scenario', () => {
      const module = TestModuleBuilder.scenarios.exploration();
      
      expect(module).toBeInstanceOf(TurnExecutionTestModule);
      
      const config = module.getConfiguration();
      expect(config.llm.strategy).toBe('tool-calling');
      expect(config.actors).toHaveLength(1); // explorer
      expect(config.world.size).toBe('large');
      expect(config.world.generateLocations).toBe(true);
    });

    it('should create performance scenario', () => {
      const module = TestModuleBuilder.scenarios.performance();
      
      expect(module).toBeInstanceOf(TurnExecutionTestModule);
      
      const config = module.getConfiguration();
      expect(config.llm.fastMode).toBe(true);
      expect(config.world.minimal).toBe(true);
      expect(config.monitoring.performance.thresholds.turnExecution).toBe(50);
    });
  });

  describe('Utilities', () => {
    it('should validate configuration', () => {
      const validConfig = {
        llm: { strategy: 'tool-calling' },
        actors: [{ id: 'test' }],
        world: { name: 'Test' },
      };
      
      const result = TestModuleBuilder.utils.validateConfig(validConfig, 'turnExecution');
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should report validation errors', () => {
      const invalidConfig = {
        // Missing required fields
        actors: [],
      };
      
      const result = TestModuleBuilder.utils.validateConfig(invalidConfig, 'turnExecution');
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.field === 'llm')).toBe(true);
    });

    it('should throw for unknown module type validation', () => {
      expect(() => TestModuleBuilder.utils.validateConfig({}, 'unknown')).toThrow(
        'Unknown module type: unknown'
      );
    });
  });

  describe('Advanced Builders', () => {
    it('should throw for unimplemented advanced builders', () => {
      expect(() => TestModuleBuilder.advanced.custom({})).toThrow(
        'Custom scenario builder not yet implemented'
      );
      
      expect(() => TestModuleBuilder.advanced.multiActor(5)).toThrow(
        'Multi-actor scenario builder not yet implemented'
      );
    });
  });

  describe('Constructor', () => {
    it('should prevent instantiation', () => {
      expect(() => new TestModuleBuilder()).toThrow(
        'TestModuleBuilder is a static class and cannot be instantiated'
      );
    });
  });
});