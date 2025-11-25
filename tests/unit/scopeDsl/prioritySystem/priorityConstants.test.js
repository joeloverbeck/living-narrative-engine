import { describe, it, expect } from '@jest/globals';
import {
  COVERAGE_PRIORITY,
  LAYER_PRIORITY_WITHIN_COVERAGE,
  VALID_COVERAGE_PRIORITIES,
  VALID_LAYERS,
  PRIORITY_CONFIG,
} from '../../../../src/scopeDsl/prioritySystem/priorityConstants.js';

describe('PriorityConstants', () => {
  describe('COVERAGE_PRIORITY Constants', () => {
    it('should define all required coverage priority values', () => {
      expect(COVERAGE_PRIORITY).toBeDefined();
      expect(COVERAGE_PRIORITY).toHaveProperty('outer');
      expect(COVERAGE_PRIORITY).toHaveProperty('base');
      expect(COVERAGE_PRIORITY).toHaveProperty('underwear');
      expect(COVERAGE_PRIORITY).toHaveProperty('direct');
    });

    it('should have numeric values for all coverage priorities', () => {
      Object.values(COVERAGE_PRIORITY).forEach((value) => {
        expect(typeof value).toBe('number');
        expect(value).toBeGreaterThan(0);
      });
    });

    it('should have correct priority ordering (lower = higher priority)', () => {
      // Outer should have highest priority (lowest number)
      expect(COVERAGE_PRIORITY.outer).toBeLessThan(COVERAGE_PRIORITY.base);
      expect(COVERAGE_PRIORITY.base).toBeLessThan(COVERAGE_PRIORITY.underwear);
      expect(COVERAGE_PRIORITY.underwear).toBeLessThan(
        COVERAGE_PRIORITY.direct
      );
    });

    it('should have specific expected values', () => {
      expect(COVERAGE_PRIORITY.outer).toBe(100);
      expect(COVERAGE_PRIORITY.armor).toBe(150);
      expect(COVERAGE_PRIORITY.base).toBe(200);
      expect(COVERAGE_PRIORITY.underwear).toBe(300);
      expect(COVERAGE_PRIORITY.direct).toBe(400);
    });

    it('should maintain proper ordering with armor between outer and base', () => {
      const values = Object.values(COVERAGE_PRIORITY).sort((a, b) => a - b);

      // Verify armor fits between outer (100) and base (200)
      expect(COVERAGE_PRIORITY.outer).toBeLessThan(COVERAGE_PRIORITY.armor);
      expect(COVERAGE_PRIORITY.armor).toBeLessThan(COVERAGE_PRIORITY.base);

      // Verify overall ordering is strictly increasing
      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeGreaterThan(values[i - 1]);
      }
    });
  });

  describe('LAYER_PRIORITY_WITHIN_COVERAGE Constants', () => {
    it('should define all required layer priority values', () => {
      expect(LAYER_PRIORITY_WITHIN_COVERAGE).toBeDefined();
      expect(LAYER_PRIORITY_WITHIN_COVERAGE).toHaveProperty('outer');
      expect(LAYER_PRIORITY_WITHIN_COVERAGE).toHaveProperty('base');
      expect(LAYER_PRIORITY_WITHIN_COVERAGE).toHaveProperty('underwear');
      expect(LAYER_PRIORITY_WITHIN_COVERAGE).toHaveProperty('accessories');
    });

    it('should have numeric values for all layer priorities', () => {
      Object.values(LAYER_PRIORITY_WITHIN_COVERAGE).forEach((value) => {
        expect(typeof value).toBe('number');
        expect(value).toBeGreaterThan(0);
      });
    });

    it('should have correct priority ordering (lower = higher priority)', () => {
      // Outer should have highest priority (lowest number)
      expect(LAYER_PRIORITY_WITHIN_COVERAGE.outer).toBeLessThan(
        LAYER_PRIORITY_WITHIN_COVERAGE.base
      );
      expect(LAYER_PRIORITY_WITHIN_COVERAGE.base).toBeLessThan(
        LAYER_PRIORITY_WITHIN_COVERAGE.underwear
      );
      expect(LAYER_PRIORITY_WITHIN_COVERAGE.underwear).toBeLessThan(
        LAYER_PRIORITY_WITHIN_COVERAGE.accessories
      );
    });

    it('should have specific expected values', () => {
      expect(LAYER_PRIORITY_WITHIN_COVERAGE.outer).toBe(10);
      expect(LAYER_PRIORITY_WITHIN_COVERAGE.armor).toBe(15);
      expect(LAYER_PRIORITY_WITHIN_COVERAGE.base).toBe(20);
      expect(LAYER_PRIORITY_WITHIN_COVERAGE.underwear).toBe(30);
      expect(LAYER_PRIORITY_WITHIN_COVERAGE.accessories).toBe(40);
    });

    it('should maintain proper ordering with armor between outer and base', () => {
      const values = Object.values(LAYER_PRIORITY_WITHIN_COVERAGE).sort(
        (a, b) => a - b
      );

      // Verify armor fits between outer (10) and base (20)
      expect(LAYER_PRIORITY_WITHIN_COVERAGE.outer).toBeLessThan(
        LAYER_PRIORITY_WITHIN_COVERAGE.armor
      );
      expect(LAYER_PRIORITY_WITHIN_COVERAGE.armor).toBeLessThan(
        LAYER_PRIORITY_WITHIN_COVERAGE.base
      );

      // Verify overall ordering is strictly increasing
      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeGreaterThan(values[i - 1]);
      }
    });

    it('should have layer values that are smaller than coverage values', () => {
      // Layer priorities should be fine-grained adjustments within coverage categories
      const maxLayerPriority = Math.max(
        ...Object.values(LAYER_PRIORITY_WITHIN_COVERAGE)
      );
      const minCoverageSpacing = Math.min(
        ...Object.values(COVERAGE_PRIORITY)
          .slice(1)
          .map((val, idx) => val - Object.values(COVERAGE_PRIORITY)[idx])
      );

      expect(maxLayerPriority).toBeLessThan(minCoverageSpacing);
    });
  });

  describe('VALID_COVERAGE_PRIORITIES Array', () => {
    it('should contain all coverage priority keys', () => {
      expect(VALID_COVERAGE_PRIORITIES).toBeDefined();
      expect(Array.isArray(VALID_COVERAGE_PRIORITIES)).toBe(true);
      expect(VALID_COVERAGE_PRIORITIES).toHaveLength(5);
    });

    it('should match all keys from COVERAGE_PRIORITY object', () => {
      const coveragePriorityKeys = Object.keys(COVERAGE_PRIORITY).sort();
      const validCoveragesSorted = VALID_COVERAGE_PRIORITIES.slice().sort();

      expect(validCoveragesSorted).toEqual(coveragePriorityKeys);
    });

    it('should contain specific expected values', () => {
      expect(VALID_COVERAGE_PRIORITIES).toContain('outer');
      expect(VALID_COVERAGE_PRIORITIES).toContain('armor');
      expect(VALID_COVERAGE_PRIORITIES).toContain('base');
      expect(VALID_COVERAGE_PRIORITIES).toContain('underwear');
      expect(VALID_COVERAGE_PRIORITIES).toContain('direct');
    });

    it('should not contain invalid values', () => {
      expect(VALID_COVERAGE_PRIORITIES).not.toContain('invalid');
      expect(VALID_COVERAGE_PRIORITIES).not.toContain('');
      expect(VALID_COVERAGE_PRIORITIES).not.toContain(null);
      expect(VALID_COVERAGE_PRIORITIES).not.toContain(undefined);
    });
  });

  describe('VALID_LAYERS Array', () => {
    it('should contain all layer priority keys', () => {
      expect(VALID_LAYERS).toBeDefined();
      expect(Array.isArray(VALID_LAYERS)).toBe(true);
      expect(VALID_LAYERS).toHaveLength(5);
    });

    it('should match all keys from LAYER_PRIORITY_WITHIN_COVERAGE object', () => {
      const layerPriorityKeys = Object.keys(
        LAYER_PRIORITY_WITHIN_COVERAGE
      ).sort();
      const validLayersSorted = VALID_LAYERS.slice().sort();

      expect(validLayersSorted).toEqual(layerPriorityKeys);
    });

    it('should contain specific expected values', () => {
      expect(VALID_LAYERS).toContain('outer');
      expect(VALID_LAYERS).toContain('armor');
      expect(VALID_LAYERS).toContain('base');
      expect(VALID_LAYERS).toContain('underwear');
      expect(VALID_LAYERS).toContain('accessories');
    });

    it('should not contain invalid values', () => {
      expect(VALID_LAYERS).not.toContain('invalid');
      expect(VALID_LAYERS).not.toContain('');
      expect(VALID_LAYERS).not.toContain(null);
      expect(VALID_LAYERS).not.toContain(undefined);
    });
  });

  describe('PRIORITY_CONFIG Configuration', () => {
    it('should define all required configuration properties', () => {
      expect(PRIORITY_CONFIG).toBeDefined();
      expect(PRIORITY_CONFIG).toHaveProperty('enableCaching');
      expect(PRIORITY_CONFIG).toHaveProperty('enableTieBreaking');
      expect(PRIORITY_CONFIG).toHaveProperty('enableContextualModifiers');
      expect(PRIORITY_CONFIG).toHaveProperty('enableValidation');
      expect(PRIORITY_CONFIG).toHaveProperty('maxCacheSize');
      expect(PRIORITY_CONFIG).toHaveProperty('logInvalidPriorities');
      expect(PRIORITY_CONFIG).toHaveProperty('defaultCoveragePriority');
      expect(PRIORITY_CONFIG).toHaveProperty('defaultLayer');
    });

    it('should have boolean values for feature flags', () => {
      expect(typeof PRIORITY_CONFIG.enableCaching).toBe('boolean');
      expect(typeof PRIORITY_CONFIG.enableTieBreaking).toBe('boolean');
      expect(typeof PRIORITY_CONFIG.enableContextualModifiers).toBe('boolean');
      expect(typeof PRIORITY_CONFIG.enableValidation).toBe('boolean');
      expect(typeof PRIORITY_CONFIG.logInvalidPriorities).toBe('boolean');
    });

    it('should have numeric cache size limit', () => {
      expect(typeof PRIORITY_CONFIG.maxCacheSize).toBe('number');
      expect(PRIORITY_CONFIG.maxCacheSize).toBeGreaterThan(0);
      expect(PRIORITY_CONFIG.maxCacheSize).toBe(1000);
    });

    it('should have valid default values', () => {
      expect(VALID_COVERAGE_PRIORITIES).toContain(
        PRIORITY_CONFIG.defaultCoveragePriority
      );
      expect(VALID_LAYERS).toContain(PRIORITY_CONFIG.defaultLayer);
      expect(PRIORITY_CONFIG.defaultCoveragePriority).toBe('direct');
      expect(PRIORITY_CONFIG.defaultLayer).toBe('base');
    });

    it('should have expected default configuration', () => {
      expect(PRIORITY_CONFIG.enableCaching).toBe(true);
      expect(PRIORITY_CONFIG.enableTieBreaking).toBe(true);
      expect(PRIORITY_CONFIG.enableContextualModifiers).toBe(false); // Future feature
      expect(PRIORITY_CONFIG.enableValidation).toBe(true);
      expect(PRIORITY_CONFIG.logInvalidPriorities).toBe(true);
    });
  });

  describe('Constants Immutability', () => {
    it('should have frozen COVERAGE_PRIORITY object', () => {
      // Check if the object is frozen
      expect(Object.isFrozen(COVERAGE_PRIORITY)).toBe(true);

      // Verify that attempting to modify throws in strict mode or has no effect
      const originalValue = COVERAGE_PRIORITY.outer;
      try {
        COVERAGE_PRIORITY.outer = 999;
      } catch (e) {
        // Will throw TypeError in strict mode if frozen
      }
      expect(COVERAGE_PRIORITY.outer).toBe(originalValue);
    });

    it('should have frozen LAYER_PRIORITY_WITHIN_COVERAGE object', () => {
      // Check if the object is frozen
      expect(Object.isFrozen(LAYER_PRIORITY_WITHIN_COVERAGE)).toBe(true);

      // Verify that attempting to modify has no effect
      const originalValue = LAYER_PRIORITY_WITHIN_COVERAGE.outer;
      try {
        LAYER_PRIORITY_WITHIN_COVERAGE.outer = 999;
      } catch (e) {
        // Will throw TypeError in strict mode if frozen
      }
      expect(LAYER_PRIORITY_WITHIN_COVERAGE.outer).toBe(originalValue);
    });

    it('should have frozen validation arrays', () => {
      // Check if arrays are frozen
      expect(Object.isFrozen(VALID_COVERAGE_PRIORITIES)).toBe(true);
      expect(Object.isFrozen(VALID_LAYERS)).toBe(true);

      // Verify original lengths are preserved
      const originalCoverageLength = VALID_COVERAGE_PRIORITIES.length;
      const originalLayersLength = VALID_LAYERS.length;

      // Attempt to modify (will throw or have no effect if frozen)
      try {
        VALID_COVERAGE_PRIORITIES.push('invalid');
      } catch (e) {
        // Will throw TypeError if frozen
      }

      try {
        VALID_LAYERS.push('invalid');
      } catch (e) {
        // Will throw TypeError if frozen
      }

      expect(VALID_COVERAGE_PRIORITIES).toHaveLength(originalCoverageLength);
      expect(VALID_LAYERS).toHaveLength(originalLayersLength);
    });

    it('should have frozen PRIORITY_CONFIG object', () => {
      // Check if the config object is frozen
      expect(Object.isFrozen(PRIORITY_CONFIG)).toBe(true);

      // Verify that attempting to modify has no effect
      const originalValue = PRIORITY_CONFIG.maxCacheSize;
      try {
        PRIORITY_CONFIG.maxCacheSize = 9999;
      } catch (e) {
        // Will throw TypeError in strict mode if frozen
      }
      expect(PRIORITY_CONFIG.maxCacheSize).toBe(originalValue);
    });
  });

  describe('Cross-Constant Consistency', () => {
    it('should have consistent keys between objects and validation arrays', () => {
      // Coverage consistency
      expect(new Set(Object.keys(COVERAGE_PRIORITY))).toEqual(
        new Set(VALID_COVERAGE_PRIORITIES)
      );

      // Layer consistency
      expect(new Set(Object.keys(LAYER_PRIORITY_WITHIN_COVERAGE))).toEqual(
        new Set(VALID_LAYERS)
      );
    });

    it('should have default values that exist in their respective constants', () => {
      expect(COVERAGE_PRIORITY).toHaveProperty(
        PRIORITY_CONFIG.defaultCoveragePriority
      );
      expect(LAYER_PRIORITY_WITHIN_COVERAGE).toHaveProperty(
        PRIORITY_CONFIG.defaultLayer
      );
    });

    it('should maintain mathematical relationships', () => {
      // Combined priorities should not overflow or underflow
      const maxCombined =
        Math.max(...Object.values(COVERAGE_PRIORITY)) +
        Math.max(...Object.values(LAYER_PRIORITY_WITHIN_COVERAGE));
      const minCombined =
        Math.min(...Object.values(COVERAGE_PRIORITY)) +
        Math.min(...Object.values(LAYER_PRIORITY_WITHIN_COVERAGE));

      expect(maxCombined).toBeLessThan(Number.MAX_SAFE_INTEGER);
      expect(minCombined).toBeGreaterThan(0);
    });

    it('should allow distinguishable priority calculations', () => {
      // All combinations should produce unique values
      const priorities = [];

      for (const coverage of VALID_COVERAGE_PRIORITIES) {
        for (const layer of VALID_LAYERS) {
          const priority =
            COVERAGE_PRIORITY[coverage] + LAYER_PRIORITY_WITHIN_COVERAGE[layer];
          priorities.push(priority);
        }
      }

      const uniquePriorities = [...new Set(priorities)];
      expect(uniquePriorities).toHaveLength(priorities.length);
    });
  });

  describe('Performance Considerations', () => {
    it('should have reasonable cache size limit', () => {
      expect(PRIORITY_CONFIG.maxCacheSize).toBeGreaterThan(100); // Enough for typical usage
      expect(PRIORITY_CONFIG.maxCacheSize).toBeLessThan(10000); // Not excessive memory usage
    });

    it('should have priority values that allow fast arithmetic', () => {
      // All values should be simple integers for fast calculation
      Object.values(COVERAGE_PRIORITY).forEach((value) => {
        expect(Number.isInteger(value)).toBe(true);
      });

      Object.values(LAYER_PRIORITY_WITHIN_COVERAGE).forEach((value) => {
        expect(Number.isInteger(value)).toBe(true);
      });
    });
  });

  describe('Future Enhancement Readiness', () => {
    it('should have reasonable value ranges for future expansions', () => {
      // Values should leave room for intermediate priorities if needed
      const coverageGap = COVERAGE_PRIORITY.base - COVERAGE_PRIORITY.outer;
      expect(coverageGap).toBeGreaterThan(50); // Room for new categories

      const layerGap =
        LAYER_PRIORITY_WITHIN_COVERAGE.base -
        LAYER_PRIORITY_WITHIN_COVERAGE.outer;
      expect(layerGap).toBeGreaterThan(5); // Room for new layers
    });

    it('should have contextual modifiers disabled by default', () => {
      expect(PRIORITY_CONFIG.enableContextualModifiers).toBe(false);
    });
  });

  describe('Armor Priority Integration', () => {
    it('should have armor in COVERAGE_PRIORITY between outer and base', () => {
      expect(COVERAGE_PRIORITY.armor).toBe(150);
      expect(COVERAGE_PRIORITY.outer).toBeLessThan(COVERAGE_PRIORITY.armor);
      expect(COVERAGE_PRIORITY.armor).toBeLessThan(COVERAGE_PRIORITY.base);
    });

    it('should have armor in LAYER_PRIORITY_WITHIN_COVERAGE between outer and base', () => {
      expect(LAYER_PRIORITY_WITHIN_COVERAGE.armor).toBe(15);
      expect(LAYER_PRIORITY_WITHIN_COVERAGE.outer).toBeLessThan(
        LAYER_PRIORITY_WITHIN_COVERAGE.armor
      );
      expect(LAYER_PRIORITY_WITHIN_COVERAGE.armor).toBeLessThan(
        LAYER_PRIORITY_WITHIN_COVERAGE.base
      );
    });

    it('should include armor in validation arrays', () => {
      expect(VALID_COVERAGE_PRIORITIES).toContain('armor');
      expect(VALID_LAYERS).toContain('armor');
    });

    it('should produce unique priority calculations with armor', () => {
      // Verify armor combinations produce unique values
      const armorCoverageBase =
        COVERAGE_PRIORITY.armor + LAYER_PRIORITY_WITHIN_COVERAGE.armor;
      const outerCoverageOuter =
        COVERAGE_PRIORITY.outer + LAYER_PRIORITY_WITHIN_COVERAGE.outer;
      const baseCoverageBase =
        COVERAGE_PRIORITY.base + LAYER_PRIORITY_WITHIN_COVERAGE.base;

      expect(armorCoverageBase).not.toBe(outerCoverageOuter);
      expect(armorCoverageBase).not.toBe(baseCoverageBase);
      expect(armorCoverageBase).toBeGreaterThan(outerCoverageOuter);
      expect(armorCoverageBase).toBeLessThan(baseCoverageBase);
    });

    it('should allow armor to be worn under outer and over base', () => {
      // Scenario: Character with outer (cloak), armor (chainmail), base (shirt)
      // Outer (100+10=110) should beat armor (150+15=165) should beat base (200+20=220)
      const outerTotal =
        COVERAGE_PRIORITY.outer + LAYER_PRIORITY_WITHIN_COVERAGE.outer;
      const armorTotal =
        COVERAGE_PRIORITY.armor + LAYER_PRIORITY_WITHIN_COVERAGE.armor;
      const baseTotal =
        COVERAGE_PRIORITY.base + LAYER_PRIORITY_WITHIN_COVERAGE.base;

      expect(outerTotal).toBeLessThan(armorTotal);
      expect(armorTotal).toBeLessThan(baseTotal);
    });
  });
});
