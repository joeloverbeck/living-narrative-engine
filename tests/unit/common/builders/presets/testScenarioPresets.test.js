/**
 * @file testScenarioPresets.test.js
 * @description Unit tests for TestScenarioPresets
 */

import { describe, it, expect, jest } from '@jest/globals';
import { TestScenarioPresets } from '../../../../../tests/common/builders/presets/testScenarioPresets.js';
import { TurnExecutionTestModule } from '../../../../../tests/common/builders/modules/turnExecutionTestModule.js';

describe('TestScenarioPresets', () => {
  describe('Constructor', () => {
    it('should prevent instantiation', () => {
      expect(() => new TestScenarioPresets()).toThrow(
        'TestScenarioPresets is a static class and cannot be instantiated'
      );
    });
  });

  describe('Combat Scenario', () => {
    it('should create combat-configured module', () => {
      const module = TestScenarioPresets.combat();

      expect(module).toBeInstanceOf(TurnExecutionTestModule);

      const config = module.getConfiguration();
      expect(config.llm.strategy).toBe('tool-calling');
      expect(config.llm.temperature).toBe(0.8);
      expect(config.llm.mockResponses.default.actionId).toBe('core:attack');
    });

    it('should configure combat actors', () => {
      const module = TestScenarioPresets.combat();
      const config = module.getConfiguration();

      expect(config.actors).toHaveLength(3);
      expect(config.actors[0]).toEqual({
        id: 'ai-fighter',
        type: 'ai',
        role: 'combatant',
        name: 'Fighter',
      });
      expect(config.actors[1]).toEqual({
        id: 'enemy',
        type: 'ai',
        role: 'opponent',
        name: 'Enemy',
      });
      expect(config.actors[2]).toEqual({
        id: 'player',
        type: 'player',
        role: 'observer',
        name: 'Observer',
      });
    });

    it('should configure combat world', () => {
      const module = TestScenarioPresets.combat();
      const config = module.getConfiguration();

      expect(config.world.name).toBe('Combat Arena');
      expect(config.world.combatEnabled).toBe(true);
      expect(config.world.size).toBe('small');
    });

    it('should enable performance tracking with combat thresholds', () => {
      const module = TestScenarioPresets.combat();
      const config = module.getConfiguration();

      expect(config.monitoring.performance.enabled).toBe(true);
      expect(config.monitoring.performance.thresholds.turnExecution).toBe(150);
    });

    it('should capture combat events', () => {
      const module = TestScenarioPresets.combat();
      const config = module.getConfiguration();

      expect(config.monitoring.events).toContain('COMBAT_INITIATED');
      expect(config.monitoring.events).toContain('DAMAGE_DEALT');
      expect(config.monitoring.events).toContain('COMBAT_ENDED');
    });

    it('should accept custom mock function', () => {
      const mockFn = jest.fn;
      const module = TestScenarioPresets.combat(mockFn);

      expect(module).toBeInstanceOf(TurnExecutionTestModule);
    });
  });

  describe('Social Interaction Scenario', () => {
    it('should create social-configured module', () => {
      const module = TestScenarioPresets.socialInteraction();

      expect(module).toBeInstanceOf(TurnExecutionTestModule);

      const config = module.getConfiguration();
      expect(config.llm.strategy).toBe('json-schema');
      expect(config.llm.temperature).toBe(1.2);
      expect(config.llm.mockResponses.default.actionId).toBe('core:speak');
    });

    it('should configure social actors', () => {
      const module = TestScenarioPresets.socialInteraction();
      const config = module.getConfiguration();

      expect(config.actors).toHaveLength(2);
      expect(config.actors[0].role).toBe('merchant');
      expect(config.actors[1].role).toBe('customer');
    });

    it('should configure marketplace world', () => {
      const module = TestScenarioPresets.socialInteraction();
      const config = module.getConfiguration();

      expect(config.world.name).toBe('Marketplace');
      expect(config.world.socialInteractionsEnabled).toBe(true);
    });

    it('should capture dialogue events', () => {
      const module = TestScenarioPresets.socialInteraction();
      const config = module.getConfiguration();

      expect(config.monitoring.events).toContain('DIALOGUE_STARTED');
      expect(config.monitoring.events).toContain('RELATIONSHIP_CHANGED');
      expect(config.monitoring.events).toContain('TRADE_COMPLETED');
    });
  });

  describe('Exploration Scenario', () => {
    it('should create exploration-configured module', () => {
      const module = TestScenarioPresets.exploration();

      expect(module).toBeInstanceOf(TurnExecutionTestModule);

      const config = module.getConfiguration();
      expect(config.llm.mockResponses['ai-explorer'].actionId).toBe(
        'core:move'
      );
      expect(config.llm.mockResponses['ai-explorer'].targets.direction).toBe(
        'north'
      );
    });

    it('should configure explorer actor', () => {
      const module = TestScenarioPresets.exploration();
      const config = module.getConfiguration();

      expect(config.actors).toHaveLength(1);
      expect(config.actors[0].id).toBe('ai-explorer');
      expect(config.actors[0].role).toBe('explorer');
    });

    it('should configure large exploration world', () => {
      const module = TestScenarioPresets.exploration();
      const config = module.getConfiguration();

      expect(config.world.name).toBe('Unknown Territory');
      expect(config.world.size).toBe('large');
      expect(config.world.generateLocations).toBe(true);
      expect(config.world.explorationEnabled).toBe(true);
    });

    it('should capture exploration events', () => {
      const module = TestScenarioPresets.exploration();
      const config = module.getConfiguration();

      expect(config.monitoring.events).toContain('LOCATION_DISCOVERED');
      expect(config.monitoring.events).toContain('ITEM_FOUND');
      expect(config.monitoring.events).toContain('EXPLORATION_MILESTONE');
    });
  });

  describe('Performance Scenario', () => {
    it('should create performance-optimized module', () => {
      const module = TestScenarioPresets.performance();

      expect(module).toBeInstanceOf(TurnExecutionTestModule);

      const config = module.getConfiguration();
      expect(config.llm.fastMode).toBe(true);
      expect(config.llm.mockResponses.default.actionId).toBe('core:look');
    });

    it('should use minimal world configuration', () => {
      const module = TestScenarioPresets.performance();
      const config = module.getConfiguration();

      expect(config.world.minimal).toBe(true);
      expect(config.world.size).toBe('small');
      expect(config.world.createConnections).toBe(false);
    });

    it('should have strict performance thresholds', () => {
      const module = TestScenarioPresets.performance();
      const config = module.getConfiguration();

      expect(config.monitoring.performance.thresholds.turnExecution).toBe(50);
      expect(config.monitoring.performance.thresholds.actionDiscovery).toBe(25);
      expect(config.monitoring.performance.thresholds.eventProcessing).toBe(5);
    });
  });

  describe('Multi-Actor Scenario', () => {
    it('should create default multi-actor configuration', () => {
      const module = TestScenarioPresets.multiActor();
      const config = module.getConfiguration();

      // Default is 3 AI actors + 1 observer
      expect(config.actors).toHaveLength(4);
      expect(config.actors[0].id).toBe('ai-actor-0');
      expect(config.actors[1].id).toBe('ai-actor-1');
      expect(config.actors[2].id).toBe('ai-actor-2');
      expect(config.actors[3].id).toBe('player-observer');
    });

    it('should support custom actor count', () => {
      const module = TestScenarioPresets.multiActor(5);
      const config = module.getConfiguration();

      // 5 AI actors + 1 observer
      expect(config.actors).toHaveLength(6);
      expect(config.actors[4].id).toBe('ai-actor-4');
    });

    it('should configure for group interactions', () => {
      const module = TestScenarioPresets.multiActor();
      const config = module.getConfiguration();

      expect(config.llm.mockResponses.default.actionId).toBe('core:interact');
      expect(config.monitoring.events).toContain('ACTOR_INTERACTION');
      expect(config.monitoring.events).toContain('GROUP_FORMED');
    });
  });

  describe('Stealth Scenario', () => {
    it('should create stealth-configured module', () => {
      const module = TestScenarioPresets.stealth();

      expect(module).toBeInstanceOf(TurnExecutionTestModule);

      const config = module.getConfiguration();
      expect(config.llm.temperature).toBe(0.6); // Lower for calculated decisions
    });

    it('should configure stealth actors', () => {
      const module = TestScenarioPresets.stealth();
      const config = module.getConfiguration();

      expect(config.actors).toHaveLength(3);

      const infiltrator = config.actors.find((a) => a.id === 'ai-infiltrator');
      expect(infiltrator.role).toBe('stealth');

      const guard = config.actors.find((a) => a.id === 'ai-guard');
      expect(guard.role).toBe('guard');
    });

    it('should configure stealth mechanics', () => {
      const module = TestScenarioPresets.stealth();
      const config = module.getConfiguration();

      expect(config.world.stealthEnabled).toBe(true);
      expect(config.world.visibilitySystem).toBe(true);
    });

    it('should capture stealth events', () => {
      const module = TestScenarioPresets.stealth();
      const config = module.getConfiguration();

      expect(config.monitoring.events).toContain('STEALTH_ENTERED');
      expect(config.monitoring.events).toContain('DETECTION_SUCCESSFUL');
      expect(config.monitoring.events).toContain('ALARM_RAISED');
    });
  });

  describe('Error Handling Scenario', () => {
    it('should create error-testing module', () => {
      const module = TestScenarioPresets.errorHandling();

      expect(module).toBeInstanceOf(TurnExecutionTestModule);

      const config = module.getConfiguration();
      expect(config.llm.mockResponses['ai-error-test'].actionId).toBe(
        'invalid:action'
      );
    });

    it('should configure minimal test environment', () => {
      const module = TestScenarioPresets.errorHandling();
      const config = module.getConfiguration();

      expect(config.world.minimal).toBe(true);
      expect(config.actors).toHaveLength(1);
      expect(config.actors[0].id).toBe('ai-error-test');
    });

    it('should capture error events', () => {
      const module = TestScenarioPresets.errorHandling();
      const config = module.getConfiguration();

      expect(config.monitoring.events).toContain('ERROR_OCCURRED');
      expect(config.monitoring.events).toContain('VALIDATION_FAILED');
      expect(config.monitoring.events).toContain('RECOVERY_ATTEMPTED');
    });
  });

  describe('Scenario Customization', () => {
    it('should allow further customization of presets', () => {
      const module = TestScenarioPresets.combat()
        .withTestActors(['custom-fighter']) // Override actors
        .withMockLLM({ temperature: 0.5 }); // Adjust temperature

      const config = module.getConfiguration();

      // Preset values preserved
      expect(config.llm.strategy).toBe('tool-calling');
      expect(config.world.combatEnabled).toBe(true);

      // Customizations applied
      expect(config.actors).toHaveLength(1);
      expect(config.actors[0].id).toBe('custom-fighter');
      expect(config.llm.temperature).toBe(0.5);
    });
  });
});
