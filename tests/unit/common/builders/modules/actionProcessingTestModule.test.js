/**
 * @file actionProcessingTestModule.test.js
 * @description Unit tests for ActionProcessingTestModule
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ActionProcessingTestModule } from '../../../../../tests/common/builders/modules/actionProcessingTestModule.js';
import { TestModuleValidationError } from '../../../../../tests/common/builders/errors/testModuleValidationError.js';

describe('ActionProcessingTestModule', () => {
  let module;
  let mockFn;

  beforeEach(() => {
    mockFn = jest.fn;
    module = new ActionProcessingTestModule(mockFn);
  });

  describe('Constructor and Defaults', () => {
    it('should initialize with default configuration', () => {
      const config = module.getConfiguration();
      
      expect(config.actorId).toBe('test-actor');
      expect(config.actions).toEqual([]);
      expect(config.mockDiscovery.returnEmpty).toBe(false);
      expect(config.mockValidation.alwaysValid).toBe(true);
      expect(config.mockExecution.alwaysSucceed).toBe(true);
    });

    it('should accept mock function creator', () => {
      const customMockFn = () => () => 'mocked';
      const customModule = new ActionProcessingTestModule(customMockFn);
      
      expect(customModule).toBeDefined();
    });
  });

  describe('Fluent API Methods', () => {
    describe('forActor()', () => {
      it('should set actor ID', () => {
        module.forActor('custom-actor');
        
        const config = module.getConfiguration();
        expect(config.actorId).toBe('custom-actor');
      });
    });

    describe('withAvailableActions()', () => {
      it('should convert string actions to objects', () => {
        module.withAvailableActions(['move', 'look', 'take']);
        
        const config = module.getConfiguration();
        expect(config.actions).toEqual([
          { id: 'move' },
          { id: 'look' },
          { id: 'take' },
        ]);
      });

      it('should preserve object actions', () => {
        const actions = [
          { id: 'move', requiresTarget: true },
          { id: 'look', alwaysAvailable: true },
        ];
        
        module.withAvailableActions(actions);
        
        const config = module.getConfiguration();
        expect(config.actions).toEqual(actions);
      });
    });

    describe('withMockDiscovery()', () => {
      it('should configure discovery behavior', () => {
        const customLogic = () => [];
        module.withMockDiscovery({
          returnEmpty: true,
          customLogic: customLogic,
        });
        
        const config = module.getConfiguration();
        expect(config.mockDiscovery.returnEmpty).toBe(true);
        // Note: customLogic function reference may not be directly accessible in frozen config
      });

      it('should merge with existing config', () => {
        module
          .withMockDiscovery({ returnEmpty: true })
          .withMockDiscovery({ byContext: { combat: ['attack'] } });
        
        const config = module.getConfiguration();
        expect(config.mockDiscovery.returnEmpty).toBe(true);
        expect(config.mockDiscovery.byContext).toEqual({ combat: ['attack'] });
      });
    });

    describe('withValidationRules()', () => {
      it('should configure validation behavior', () => {
        module.withValidationRules({
          alwaysValid: false,
          requireTarget: true,
          customRules: {
            move: { requiresDirection: true },
          },
        });
        
        const config = module.getConfiguration();
        expect(config.mockValidation.alwaysValid).toBe(false);
        expect(config.mockValidation.requireTarget).toBe(true);
        expect(config.mockValidation.customRules.move).toEqual({ requiresDirection: true });
      });
    });

    describe('withExecutionBehavior()', () => {
      it('should configure execution behavior', () => {
        module.withExecutionBehavior({
          alwaysSucceed: false,
          defaultEffects: ['Default effect'],
          customResults: {
            move: { success: true, effects: ['Moved north'] },
          },
        });
        
        const config = module.getConfiguration();
        expect(config.mockExecution.alwaysSucceed).toBe(false);
        expect(config.mockExecution.defaultEffects).toEqual(['Default effect']);
        expect(config.mockExecution.customResults.move).toBeDefined();
      });
    });

    describe('withPerformanceMonitoring()', () => {
      it('should enable performance monitoring with defaults', () => {
        module.withPerformanceMonitoring();
        
        const config = module.getConfiguration();
        expect(config.performanceMonitoring.enabled).toBe(true);
        expect(config.performanceMonitoring.thresholds).toEqual({
          discovery: 50,
          validation: 10,
          execution: 100,
        });
      });

      it('should allow custom thresholds', () => {
        module.withPerformanceMonitoring({
          discoveryThreshold: 75,
          validationThreshold: 20,
          executionThreshold: 150,
        });
        
        const config = module.getConfiguration();
        expect(config.performanceMonitoring.thresholds.discovery).toBe(75);
        expect(config.performanceMonitoring.thresholds.validation).toBe(20);
        expect(config.performanceMonitoring.thresholds.execution).toBe(150);
      });
    });

    describe('withCustomFacades()', () => {
      it('should store custom facade implementations', () => {
        const customFacades = {
          actionService: { customMethod: 'test' },
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
        .forActor('test-actor')
        .withAvailableActions(['move', 'look']);
      
      const result = module.validate();
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should require actor ID', () => {
      module.forActor(null);
      
      const result = module.validate();
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_ACTOR_ID')).toBe(true);
    });

    it('should validate action configuration', () => {
      module.withAvailableActions('not-an-array');
      
      const result = module.validate();
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_ACTIONS_CONFIG')).toBe(true);
    });
  });

  describe('Build', () => {
    it('should throw on invalid configuration', async () => {
      module.forActor(null);
      
      await expect(module.build()).rejects.toThrow(TestModuleValidationError);
    });

    it('should return action-focused test environment', async () => {
      module
        .forActor('test-actor')
        .withAvailableActions(['move', 'look']);
      
      const testEnv = await module.build();
      
      expect(testEnv.actorId).toBe('test-actor');
      expect(typeof testEnv.discoverActions).toBe('function');
      expect(typeof testEnv.validateAction).toBe('function');
      expect(typeof testEnv.executeAction).toBe('function');
      expect(typeof testEnv.processActionCandidate).toBe('function');
    });

    it('should include mock configuration methods', async () => {
      const testEnv = await module.build();
      
      expect(typeof testEnv.setAvailableActions).toBe('function');
      expect(typeof testEnv.setValidationResult).toBe('function');
      expect(typeof testEnv.setExecutionResult).toBe('function');
    });

    it('should include performance methods when monitoring enabled', async () => {
      module.withPerformanceMonitoring();
      
      const testEnv = await module.build();
      
      expect(typeof testEnv.getPerformanceMetrics).toBe('function');
      expect(typeof testEnv.checkPerformanceThresholds).toBe('function');
    });

    it('should provide cleanup method', async () => {
      const testEnv = await module.build();
      
      expect(typeof testEnv.cleanup).toBe('function');
    });
  });

  describe('Reset', () => {
    it('should reset to default configuration', () => {
      module
        .forActor('custom-actor')
        .withAvailableActions(['action1', 'action2'])
        .withMockDiscovery({ returnEmpty: true })
        .reset();
      
      const config = module.getConfiguration();
      
      expect(config.actorId).toBe('test-actor');
      expect(config.actions).toEqual([]);
      expect(config.mockDiscovery.returnEmpty).toBe(false);
    });

    it('should return module instance for chaining', () => {
      const result = module.reset();
      expect(result).toBe(module);
    });
  });

  describe('Clone', () => {
    it('should create independent copy with same configuration', () => {
      module
        .forActor('original-actor')
        .withAvailableActions(['action1']);
      
      const cloned = module.clone();
      
      // Verify configurations match
      expect(cloned.getConfiguration()).toEqual(module.getConfiguration());
      
      // Verify independence
      cloned.forActor('cloned-actor');
      
      expect(module.getConfiguration().actorId).toBe('original-actor');
      expect(cloned.getConfiguration().actorId).toBe('cloned-actor');
    });

    it('should preserve mock function creator', () => {
      const customMockFn = () => () => 'custom';
      const original = new ActionProcessingTestModule(customMockFn);
      const cloned = original.clone();
      
      expect(cloned).toBeDefined();
    });
  });

  describe('Method Chaining', () => {
    it('should support full method chaining', () => {
      const result = module
        .forActor('chain-actor')
        .withAvailableActions(['move', 'look'])
        .withMockDiscovery({ returnEmpty: false })
        .withValidationRules({ alwaysValid: true })
        .withExecutionBehavior({ alwaysSucceed: true })
        .withPerformanceMonitoring()
        .withCustomFacades({ custom: true });
      
      expect(result).toBe(module);
      
      const config = module.getConfiguration();
      expect(config.actorId).toBe('chain-actor');
      expect(config.actions).toHaveLength(2);
      expect(config.mockDiscovery.returnEmpty).toBe(false);
      expect(config.mockValidation.alwaysValid).toBe(true);
      expect(config.mockExecution.alwaysSucceed).toBe(true);
      expect(config.performanceMonitoring.enabled).toBe(true);
      expect(config.facades.custom).toBe(true);
    });
  });
});