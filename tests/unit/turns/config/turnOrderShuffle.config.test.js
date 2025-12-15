/**
 * @file Unit tests for turn order shuffle configuration
 * @see src/turns/config/turnOrderShuffle.config.js
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  jest,
} from '@jest/globals';

// Mock environmentUtils before importing the config
jest.mock('../../../../src/utils/environmentUtils.js', () => ({
  getEnvironmentMode: jest.fn(),
}));

import { getEnvironmentMode } from '../../../../src/utils/environmentUtils.js';
import {
  turnOrderShuffleConfig,
  getTurnOrderShuffleConfig,
  isShuffleEnabled,
  isShuffleEnabledForStrategy,
  getPlayerTypeDetectionConfig,
  getDiagnosticsConfig,
  isDiagnosticsEnabled,
} from '../../../../src/turns/config/turnOrderShuffle.config.js';

describe('turnOrderShuffleConfig', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getEnvironmentMode.mockReturnValue('test');
  });

  describe('base configuration structure', () => {
    it('should have enabled property at top level', () => {
      expect(turnOrderShuffleConfig.enabled).toBeDefined();
      expect(typeof turnOrderShuffleConfig.enabled).toBe('boolean');
    });

    it('should have strategies section', () => {
      expect(turnOrderShuffleConfig.strategies).toBeDefined();
      expect(typeof turnOrderShuffleConfig.strategies).toBe('object');
    });

    it('should have round-robin strategy configuration', () => {
      expect(turnOrderShuffleConfig.strategies['round-robin']).toBeDefined();
      expect(
        turnOrderShuffleConfig.strategies['round-robin'].shuffleNonHumans
      ).toBeDefined();
    });

    it('should have initiative strategy configuration', () => {
      expect(turnOrderShuffleConfig.strategies.initiative).toBeDefined();
      expect(
        turnOrderShuffleConfig.strategies.initiative.shuffleTieBreakers
      ).toBeDefined();
    });

    it('should have playerTypeDetection section', () => {
      expect(turnOrderShuffleConfig.playerTypeDetection).toBeDefined();
      expect(turnOrderShuffleConfig.playerTypeDetection.componentId).toBe(
        'core:player_type'
      );
      expect(turnOrderShuffleConfig.playerTypeDetection.humanTypeValue).toBe(
        'human'
      );
    });

    it('should have diagnostics section', () => {
      expect(turnOrderShuffleConfig.diagnostics).toBeDefined();
      expect(
        typeof turnOrderShuffleConfig.diagnostics.logShuffleResults
      ).toBe('boolean');
      expect(typeof turnOrderShuffleConfig.diagnostics.logOriginalOrder).toBe(
        'boolean'
      );
    });

    it('should have environments section', () => {
      expect(turnOrderShuffleConfig.environments).toBeDefined();
      expect(turnOrderShuffleConfig.environments.development).toBeDefined();
      expect(turnOrderShuffleConfig.environments.test).toBeDefined();
      expect(turnOrderShuffleConfig.environments.production).toBeDefined();
    });
  });

  describe('getTurnOrderShuffleConfig', () => {
    it('should return merged config for test environment', () => {
      getEnvironmentMode.mockReturnValue('test');
      const config = getTurnOrderShuffleConfig();

      expect(config.enabled).toBe(true);
      expect(config.diagnostics.logShuffleResults).toBe(false);
    });

    it('should return merged config for development environment', () => {
      getEnvironmentMode.mockReturnValue('development');
      const config = getTurnOrderShuffleConfig();

      expect(config.diagnostics.logShuffleResults).toBe(true);
      expect(config.diagnostics.logOriginalOrder).toBe(true);
      expect(config.diagnostics.includeActorNames).toBe(true);
    });

    it('should return merged config for production environment', () => {
      getEnvironmentMode.mockReturnValue('production');
      const config = getTurnOrderShuffleConfig();

      expect(config.enabled).toBe(true);
      expect(config.diagnostics.logShuffleResults).toBe(false);
      expect(config.diagnostics.includeActorNames).toBe(false);
    });

    it('should handle unknown environment by using base config', () => {
      getEnvironmentMode.mockReturnValue('unknown-env');
      const config = getTurnOrderShuffleConfig();

      expect(config.enabled).toBe(true);
      expect(config.strategies['round-robin'].shuffleNonHumans).toBe(true);
    });

    it('should preserve base config properties not overridden by environment', () => {
      getEnvironmentMode.mockReturnValue('test');
      const config = getTurnOrderShuffleConfig();

      expect(config.playerTypeDetection.componentId).toBe('core:player_type');
      expect(config.strategies['round-robin'].shuffleNonHumans).toBe(true);
    });
  });

  describe('isShuffleEnabled', () => {
    it('should return true when enabled in base config', () => {
      getEnvironmentMode.mockReturnValue('test');
      expect(isShuffleEnabled()).toBe(true);
    });

    it('should return true for production environment', () => {
      getEnvironmentMode.mockReturnValue('production');
      expect(isShuffleEnabled()).toBe(true);
    });

    it('should return true for development environment', () => {
      getEnvironmentMode.mockReturnValue('development');
      expect(isShuffleEnabled()).toBe(true);
    });
  });

  describe('isShuffleEnabledForStrategy', () => {
    beforeEach(() => {
      getEnvironmentMode.mockReturnValue('test');
    });

    it('should return true for round-robin strategy when shuffleNonHumans is true', () => {
      expect(isShuffleEnabledForStrategy('round-robin')).toBe(true);
    });

    it('should return false for initiative strategy when shuffleTieBreakers is false', () => {
      expect(isShuffleEnabledForStrategy('initiative')).toBe(false);
    });

    it('should return false for unknown strategy', () => {
      expect(isShuffleEnabledForStrategy('unknown-strategy')).toBe(false);
    });

    it('should return false for null strategy', () => {
      expect(isShuffleEnabledForStrategy(null)).toBe(false);
    });

    it('should return false for undefined strategy', () => {
      expect(isShuffleEnabledForStrategy(undefined)).toBe(false);
    });
  });

  describe('getPlayerTypeDetectionConfig', () => {
    it('should return component ID', () => {
      const config = getPlayerTypeDetectionConfig();
      expect(config.componentId).toBe('core:player_type');
    });

    it('should return human type value', () => {
      const config = getPlayerTypeDetectionConfig();
      expect(config.humanTypeValue).toBe('human');
    });

    it('should return consistent values across environments', () => {
      getEnvironmentMode.mockReturnValue('development');
      const devConfig = getPlayerTypeDetectionConfig();

      getEnvironmentMode.mockReturnValue('production');
      const prodConfig = getPlayerTypeDetectionConfig();

      expect(devConfig.componentId).toBe(prodConfig.componentId);
      expect(devConfig.humanTypeValue).toBe(prodConfig.humanTypeValue);
    });
  });

  describe('getDiagnosticsConfig', () => {
    it('should return diagnostics with logging disabled in test', () => {
      getEnvironmentMode.mockReturnValue('test');
      const config = getDiagnosticsConfig();

      expect(config.logShuffleResults).toBe(false);
      expect(config.logOriginalOrder).toBe(false);
    });

    it('should return diagnostics with logging enabled in development', () => {
      getEnvironmentMode.mockReturnValue('development');
      const config = getDiagnosticsConfig();

      expect(config.logShuffleResults).toBe(true);
      expect(config.logOriginalOrder).toBe(true);
      expect(config.includeActorNames).toBe(true);
    });

    it('should return diagnostics with logging disabled in production', () => {
      getEnvironmentMode.mockReturnValue('production');
      const config = getDiagnosticsConfig();

      expect(config.logShuffleResults).toBe(false);
      expect(config.logOriginalOrder).toBe(false);
    });
  });

  describe('isDiagnosticsEnabled', () => {
    it('should return false in test environment', () => {
      getEnvironmentMode.mockReturnValue('test');
      expect(isDiagnosticsEnabled()).toBe(false);
    });

    it('should return true in development environment', () => {
      getEnvironmentMode.mockReturnValue('development');
      expect(isDiagnosticsEnabled()).toBe(true);
    });

    it('should return false in production environment', () => {
      getEnvironmentMode.mockReturnValue('production');
      expect(isDiagnosticsEnabled()).toBe(false);
    });
  });

  describe('deep merge behavior', () => {
    it('should deep merge nested objects', () => {
      getEnvironmentMode.mockReturnValue('development');
      const config = getTurnOrderShuffleConfig();

      // Should have base config structure
      expect(config.strategies).toBeDefined();
      expect(config.strategies['round-robin']).toBeDefined();

      // Should have merged diagnostics
      expect(config.diagnostics.logShuffleResults).toBe(true);
    });

    it('should not mutate base configuration', () => {
      const originalEnabled = turnOrderShuffleConfig.enabled;
      const originalDiagnostics = {
        ...turnOrderShuffleConfig.diagnostics,
      };

      getEnvironmentMode.mockReturnValue('development');
      getTurnOrderShuffleConfig();

      expect(turnOrderShuffleConfig.enabled).toBe(originalEnabled);
      expect(turnOrderShuffleConfig.diagnostics.logShuffleResults).toBe(
        originalDiagnostics.logShuffleResults
      );
    });
  });

  describe('default export', () => {
    it('should export default as turnOrderShuffleConfig', async () => {
      const module = await import(
        '../../../../src/turns/config/turnOrderShuffle.config.js'
      );
      expect(module.default).toBe(turnOrderShuffleConfig);
    });
  });
});
