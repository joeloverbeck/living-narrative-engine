/**
 * @file Tests for advanced metrics configuration
 * @see src/expressionDiagnostics/config/advancedMetricsConfig.js
 */

import { describe, it, expect, afterEach } from '@jest/globals';
import {
  advancedMetricsConfig,
  detectDomain,
  getEpsilonForVariable,
  isAdvancedMetricsEnabled,
  isMetricEnabled,
} from '../../../../src/expressionDiagnostics/config/advancedMetricsConfig.js';

describe('advancedMetricsConfig', () => {
  describe('detectDomain()', () => {
    it('should detect emotions domain', () => {
      expect(detectDomain('emotions.joy')).toBe('emotions');
      expect(detectDomain('emotions.anger')).toBe('emotions');
      expect(detectDomain('emotions.fear')).toBe('emotions');
    });

    it('should detect mood axes domain', () => {
      expect(detectDomain('mood.valence')).toBe('moodAxes');
      expect(detectDomain('mood.energy')).toBe('moodAxes');
      expect(detectDomain('mood.dominance')).toBe('moodAxes');
    });

    it('should detect sexual states domain', () => {
      expect(detectDomain('sexualStates.sex_excitation')).toBe('sexualStates');
      expect(detectDomain('sexual.arousal')).toBe('sexualStates');
    });

    it('should detect traits domain', () => {
      expect(detectDomain('traits.openness')).toBe('traits');
      expect(detectDomain('traits.neuroticism')).toBe('traits');
      expect(detectDomain('personalityTraits.agreeableness')).toBe('traits');
    });

    it('should return default for unknown variable paths', () => {
      expect(detectDomain('unknown.variable')).toBe('default');
      expect(detectDomain('custom.path')).toBe('default');
    });

    it('should return default for null and undefined', () => {
      expect(detectDomain(null)).toBe('default');
      expect(detectDomain(undefined)).toBe('default');
    });

    it('should return default for non-string inputs', () => {
      expect(detectDomain(123)).toBe('default');
      expect(detectDomain({})).toBe('default');
      expect(detectDomain([])).toBe('default');
    });

    it('should return default for empty string', () => {
      expect(detectDomain('')).toBe('default');
    });
  });

  describe('getEpsilonForVariable()', () => {
    it('should return correct epsilon for each domain', () => {
      expect(getEpsilonForVariable('emotions.joy')).toBe(0.05);
      expect(getEpsilonForVariable('mood.valence')).toBe(5);
      expect(getEpsilonForVariable('sexualStates.arousal')).toBe(5);
      expect(getEpsilonForVariable('traits.openness')).toBe(0.1);
    });

    it('should return default epsilon for unknown paths', () => {
      expect(getEpsilonForVariable('unknown.var')).toBe(0.05);
    });

    it('should return default epsilon for invalid inputs', () => {
      expect(getEpsilonForVariable(null)).toBe(0.05);
      expect(getEpsilonForVariable(undefined)).toBe(0.05);
      expect(getEpsilonForVariable('')).toBe(0.05);
    });
  });

  describe('isAdvancedMetricsEnabled()', () => {
    const originalEnabled = advancedMetricsConfig.enabled;

    afterEach(() => {
      advancedMetricsConfig.enabled = originalEnabled;
    });

    it('should return enabled state from config', () => {
      expect(isAdvancedMetricsEnabled()).toBe(true);
    });

    it('should reflect config changes', () => {
      advancedMetricsConfig.enabled = false;
      expect(isAdvancedMetricsEnabled()).toBe(false);

      advancedMetricsConfig.enabled = true;
      expect(isAdvancedMetricsEnabled()).toBe(true);
    });
  });

  describe('isMetricEnabled()', () => {
    const originalEnabled = advancedMetricsConfig.enabled;

    afterEach(() => {
      advancedMetricsConfig.enabled = originalEnabled;
    });

    it('should check individual metric enablement', () => {
      expect(isMetricEnabled('percentiles')).toBe(true);
      expect(isMetricEnabled('nearMiss')).toBe(true);
      expect(isMetricEnabled('lastMile')).toBe(true);
      expect(isMetricEnabled('maxObserved')).toBe(true);
    });

    it('should return false for unknown metrics', () => {
      expect(isMetricEnabled('unknownMetric')).toBe(false);
      expect(isMetricEnabled('invalid')).toBe(false);
    });

    it('should return false when advanced metrics are disabled', () => {
      advancedMetricsConfig.enabled = false;

      expect(isMetricEnabled('percentiles')).toBe(false);
      expect(isMetricEnabled('nearMiss')).toBe(false);
      expect(isMetricEnabled('lastMile')).toBe(false);
      expect(isMetricEnabled('maxObserved')).toBe(false);
    });
  });

  describe('advancedMetricsConfig object', () => {
    it('should have positive epsilon values for all domains', () => {
      const epsilons = advancedMetricsConfig.nearMissEpsilon;
      for (const epsilon of Object.values(epsilons)) {
        expect(epsilon).toBeGreaterThan(0);
      }
    });

    it('should have all required configuration keys', () => {
      expect(advancedMetricsConfig).toHaveProperty('enabled');
      expect(advancedMetricsConfig).toHaveProperty('nearMissEpsilon');
      expect(advancedMetricsConfig).toHaveProperty('maxViolationsSampled');
      expect(advancedMetricsConfig).toHaveProperty('includePercentiles');
      expect(advancedMetricsConfig).toHaveProperty('includeNearMiss');
      expect(advancedMetricsConfig).toHaveProperty('includeLastMile');
      expect(advancedMetricsConfig).toHaveProperty('includeMaxObserved');
    });

    it('should have default epsilon in nearMissEpsilon', () => {
      expect(advancedMetricsConfig.nearMissEpsilon).toHaveProperty('default');
      expect(advancedMetricsConfig.nearMissEpsilon.default).toBe(0.05);
    });
  });
});
