/**
 * @file turnExecutionTestModule.test.js
 * @description Unit tests for TurnExecutionTestModule
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TurnExecutionTestModule } from '../../../../../tests/common/builders/modules/turnExecutionTestModule.js';
import { TestModuleValidationError } from '../../../../../tests/common/builders/errors/testModuleValidationError.js';

describe('TurnExecutionTestModule', () => {
  let module;
  let mockFn;

  beforeEach(() => {
    mockFn = jest.fn;
    module = new TurnExecutionTestModule(mockFn);
  });

  describe('Constructor and Defaults', () => {
    it('should initialize with default configuration', () => {
      const config = module.getConfiguration();
      
      expect(config.llm.strategy).toBe('tool-calling');
      expect(config.llm.temperature).toBe(1.0);
      expect(config.actors).toEqual([]);
      expect(config.world.name).toBe('Test World');
      expect(config.monitoring.performance).toBe(false);
      expect(config.monitoring.events).toEqual([]);
    });

    it('should accept mock function creator', () => {
      const customMockFn = () => () => 'mocked';
      const customModule = new TurnExecutionTestModule(customMockFn);
      
      expect(customModule).toBeDefined();
    });
  });

  describe('Fluent API Methods', () => {
    describe('withMockLLM()', () => {
      it('should configure LLM settings', () => {
        module.withMockLLM({
          strategy: 'json-schema',
          temperature: 0.7,
          mockResponses: { 'actor-1': { actionId: 'test' } },
        });
        
        const config = module.getConfiguration();
        expect(config.llm.strategy).toBe('json-schema');
        expect(config.llm.temperature).toBe(0.7);
        expect(config.llm.mockResponses['actor-1']).toEqual({ actionId: 'test' });
      });

      it('should merge with existing LLM config', () => {
        module
          .withMockLLM({ temperature: 0.5 })
          .withMockLLM({ strategy: 'json-schema' });
        
        const config = module.getConfiguration();
        expect(config.llm.temperature).toBe(0.5);
        expect(config.llm.strategy).toBe('json-schema');
      });
    });

    describe('withTestActors()', () => {
      it('should convert string actors to objects', () => {
        module.withTestActors(['ai-actor', 'player']);
        
        const config = module.getConfiguration();
        expect(config.actors).toEqual([
          { id: 'ai-actor', type: 'ai' },
          { id: 'player', type: 'player' },
        ]);
      });

      it('should preserve object actors', () => {
        const actors = [
          { id: 'custom-ai', type: 'ai', name: 'Custom AI' },
          { id: 'custom-player', type: 'player', role: 'hero' },
        ];
        
        module.withTestActors(actors);
        
        const config = module.getConfiguration();
        expect(config.actors).toEqual(actors);
      });
    });

    describe('withWorld()', () => {
      it('should configure world settings', () => {
        module.withWorld({
          name: 'Custom World',
          size: 'large',
          generateLocations: true,
        });
        
        const config = module.getConfiguration();
        expect(config.world.name).toBe('Custom World');
        expect(config.world.size).toBe('large');
        expect(config.world.generateLocations).toBe(true);
      });

      it('should merge with existing world config', () => {
        module
          .withWorld({ name: 'First Name' })
          .withWorld({ size: 'medium', name: 'Final Name' });
        
        const config = module.getConfiguration();
        expect(config.world.name).toBe('Final Name');
        expect(config.world.size).toBe('medium');
        expect(config.world.createConnections).toBe(true); // Default preserved
      });
    });

    describe('withPerformanceTracking()', () => {
      it('should enable performance tracking with defaults', () => {
        module.withPerformanceTracking();
        
        const config = module.getConfiguration();
        expect(config.monitoring.performance.enabled).toBe(true);
        expect(config.monitoring.performance.thresholds).toEqual({
          turnExecution: 100,
          actionDiscovery: 50,
          eventProcessing: 10,
        });
      });

      it('should allow custom thresholds', () => {
        module.withPerformanceTracking({
          thresholds: {
            turnExecution: 200,
            customMetric: 25,
          },
        });
        
        const config = module.getConfiguration();
        expect(config.monitoring.performance.thresholds.turnExecution).toBe(200);
        expect(config.monitoring.performance.thresholds.customMetric).toBe(25);
        expect(config.monitoring.performance.thresholds.actionDiscovery).toBe(50); // Default preserved
      });
    });

    describe('withEventCapture()', () => {
      it('should configure event types to capture', () => {
        const events = ['AI_DECISION_MADE', 'ACTION_EXECUTED'];
        module.withEventCapture(events);
        
        const config = module.getConfiguration();
        expect(config.monitoring.events).toEqual(events);
      });

      it('should replace previous event configuration', () => {
        module
          .withEventCapture(['EVENT_A'])
          .withEventCapture(['EVENT_B', 'EVENT_C']);
        
        const config = module.getConfiguration();
        expect(config.monitoring.events).toEqual(['EVENT_B', 'EVENT_C']);
      });
    });

    describe('withCustomFacades()', () => {
      it('should store custom facade implementations', () => {
        const customFacades = {
          actionService: { customMethod: 'test' },
          llmService: { customMethod: 'test' },
        };
        
        module.withCustomFacades(customFacades);
        
        const config = module.getConfiguration();
        expect(config.facades).toEqual(customFacades);
      });
    });
  });

  describe('Validation', () => {
    it('should validate valid configuration', () => {
      module
        .withMockLLM({ strategy: 'tool-calling' })
        .withTestActors(['ai-actor'])
        .withWorld({ name: 'Test' });
      
      const result = module.validate();
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid LLM strategy', () => {
      module.withMockLLM({ strategy: 'invalid-strategy' });
      
      const result = module.validate();
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_LLM_STRATEGY')).toBe(true);
    });

    it('should warn about no actors', () => {
      const result = module.validate();
      
      expect(result.valid).toBe(true); // Still valid, just a warning
      expect(result.warnings.some(w => w.code === 'NO_ACTORS')).toBe(true);
    });

    it('should warn about high performance thresholds', () => {
      module.withPerformanceTracking({
        thresholds: { turnExecution: 2000 },
      });
      
      const result = module.validate();
      
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.code === 'HIGH_PERFORMANCE_THRESHOLD')).toBe(true);
    });
  });

  describe('Build', () => {
    it('should throw on invalid configuration', async () => {
      // Create invalid config
      module.withMockLLM({ strategy: 'invalid' });
      
      await expect(module.build()).rejects.toThrow(TestModuleValidationError);
    });

    it('should return frozen configuration in test environment', async () => {
      module
        .withMockLLM({ strategy: 'tool-calling' })
        .withTestActors(['ai-actor']);
      
      const testEnv = await module.build();
      
      expect(testEnv.config).toBeDefined();
      expect(() => testEnv.config.llm = 'modified').toThrow(); // Frozen
    });

    it('should provide convenience methods', async () => {
      module
        .withMockLLM({ strategy: 'tool-calling' })
        .withTestActors(['ai-actor']);
      
      const testEnv = await module.build();
      
      expect(typeof testEnv.executeAITurn).toBe('function');
      expect(typeof testEnv.executePlayerTurn).toBe('function');
      expect(typeof testEnv.cleanup).toBe('function');
    });

    it('should include performance methods when tracking enabled', async () => {
      module
        .withMockLLM({ strategy: 'tool-calling' })
        .withTestActors(['ai-actor'])
        .withPerformanceTracking();
      
      const testEnv = await module.build();
      
      expect(typeof testEnv.getPerformanceMetrics).toBe('function');
      expect(typeof testEnv.checkPerformanceThresholds).toBe('function');
    });

    it('should include event capture methods when enabled', async () => {
      module
        .withMockLLM({ strategy: 'tool-calling' })
        .withTestActors(['ai-actor'])
        .withEventCapture(['TEST_EVENT']);
      
      const testEnv = await module.build();
      
      expect(typeof testEnv.getCapturedEvents).toBe('function');
      expect(typeof testEnv.clearCapturedEvents).toBe('function');
    });
  });

  describe('Reset', () => {
    it('should reset to default configuration', () => {
      module
        .withMockLLM({ temperature: 0.5 })
        .withTestActors(['actor1', 'actor2'])
        .withWorld({ name: 'Custom' })
        .reset();
      
      const config = module.getConfiguration();
      
      expect(config.llm.temperature).toBe(1.0);
      expect(config.actors).toEqual([]);
      expect(config.world.name).toBe('Test World');
    });

    it('should return module instance for chaining', () => {
      const result = module.reset();
      expect(result).toBe(module);
    });
  });

  describe('Clone', () => {
    it('should create independent copy with same configuration', () => {
      module
        .withMockLLM({ temperature: 0.7 })
        .withTestActors(['original-actor']);
      
      const cloned = module.clone();
      
      // Verify configurations match
      expect(cloned.getConfiguration()).toEqual(module.getConfiguration());
      
      // Verify independence
      cloned.withTestActors(['cloned-actor']);
      
      expect(module.getConfiguration().actors[0].id).toBe('original-actor');
      expect(cloned.getConfiguration().actors[0].id).toBe('cloned-actor');
    });

    it('should preserve mock function creator', () => {
      const customMockFn = () => () => 'custom';
      const original = new TurnExecutionTestModule(customMockFn);
      const cloned = original.clone();
      
      expect(cloned).toBeDefined();
    });
  });

  describe('Method Chaining', () => {
    it('should support full method chaining', () => {
      const result = module
        .withMockLLM({ strategy: 'json-schema' })
        .withTestActors(['actor1', 'actor2'])
        .withWorld({ name: 'Chain Test' })
        .withPerformanceTracking()
        .withEventCapture(['EVENT_A', 'EVENT_B'])
        .withCustomFacades({ custom: true });
      
      expect(result).toBe(module);
      
      const config = module.getConfiguration();
      expect(config.llm.strategy).toBe('json-schema');
      expect(config.actors).toHaveLength(2);
      expect(config.world.name).toBe('Chain Test');
      expect(config.monitoring.performance.enabled).toBe(true);
      expect(config.monitoring.events).toHaveLength(2);
      expect(config.facades.custom).toBe(true);
    });
  });
});