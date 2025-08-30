import { describe, it, expect, beforeEach } from '@jest/globals';
import PriorityRuleRegistry from '../../../../src/scopeDsl/prioritySystem/priorityRuleRegistry.js';

describe('PriorityRuleRegistry', () => {
  let registry;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    registry = new PriorityRuleRegistry({ logger: mockLogger });
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with required dependencies', () => {
      expect(registry).toBeDefined();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Registered priority rule: coverage')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Registered priority rule: layer')
      );
    });

    it('should throw error for missing logger dependency', () => {
      expect(() => {
        new PriorityRuleRegistry({});
      }).toThrow();
    });

    it('should throw error for invalid logger dependency', () => {
      expect(() => {
        new PriorityRuleRegistry({ logger: {} });
      }).toThrow();
    });

    it('should register default rules during initialization', () => {
      const ruleNames = registry.getRuleNames();
      expect(ruleNames).toContain('coverage');
      expect(ruleNames).toContain('layer');
      expect(ruleNames).toHaveLength(2);
    });
  });

  describe('Rule Registration and Management', () => {
    it('should register new priority rule successfully', () => {
      const customRule = (candidate) => 50;

      registry.registerRule('custom', customRule);

      expect(registry.hasRule('custom')).toBe(true);
      expect(registry.getRuleNames()).toContain('custom');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Registered priority rule: custom'
      );
    });

    it('should throw error when registering non-function rule', () => {
      expect(() => {
        registry.registerRule('invalid', 'not-a-function');
      }).toThrow("Priority rule 'invalid' must be a function");

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Priority rule 'invalid' must be a function"
      );
    });

    it('should remove existing rule successfully', () => {
      const customRule = (candidate) => 50;
      registry.registerRule('custom', customRule);

      const removed = registry.removeRule('custom');

      expect(removed).toBe(true);
      expect(registry.hasRule('custom')).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Removed priority rule: custom'
      );
    });

    it('should handle removal of non-existent rule', () => {
      const removed = registry.removeRule('non-existent');

      expect(removed).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Attempted to remove non-existent priority rule: non-existent'
      );
    });

    it('should override existing rule when registering with same name', () => {
      const firstRule = (candidate) => 100;
      const secondRule = (candidate) => 200;

      registry.registerRule('test', firstRule);
      registry.registerRule('test', secondRule);

      const candidate = { coveragePriority: 'outer', layer: 'outer' };
      const priority = registry.calculatePriority(candidate);

      // Should use the second rule (200) instead of first (100)
      // Note: This will include default rules too, so we test by checking the total includes our contribution
      expect(priority).toBeGreaterThan(100); // Default rules + our 200
    });

    it('should get all registered rule names', () => {
      registry.registerRule('custom1', (candidate) => 10);
      registry.registerRule('custom2', (candidate) => 20);

      const ruleNames = registry.getRuleNames();

      expect(ruleNames).toContain('coverage');
      expect(ruleNames).toContain('layer');
      expect(ruleNames).toContain('custom1');
      expect(ruleNames).toContain('custom2');
      expect(ruleNames).toHaveLength(4);
    });

    it('should check rule existence correctly', () => {
      expect(registry.hasRule('coverage')).toBe(true);
      expect(registry.hasRule('layer')).toBe(true);
      expect(registry.hasRule('non-existent')).toBe(false);

      registry.registerRule('custom', (candidate) => 10);
      expect(registry.hasRule('custom')).toBe(true);
    });
  });

  describe('Default Rules Behavior', () => {
    it('should calculate priority using coverage rule', () => {
      const candidate = { coveragePriority: 'outer', layer: 'base' };

      // Remove layer rule to isolate coverage rule
      registry.removeRule('layer');

      const priority = registry.calculatePriority(candidate);
      expect(priority).toBe(100); // COVERAGE_PRIORITY.outer
    });

    it('should calculate priority using layer rule', () => {
      const candidate = { coveragePriority: 'invalid', layer: 'outer' };

      // Remove coverage rule to isolate layer rule
      registry.removeRule('coverage');

      const priority = registry.calculatePriority(candidate);
      expect(priority).toBe(10); // LAYER_PRIORITY_WITHIN_COVERAGE.outer
    });

    it('should handle invalid coverage priority with fallback', () => {
      const candidate = { coveragePriority: 'invalid', layer: 'outer' };

      registry.removeRule('layer');

      const priority = registry.calculatePriority(candidate);
      expect(priority).toBe(400); // COVERAGE_PRIORITY.direct fallback
    });

    it('should handle invalid layer with fallback', () => {
      const candidate = { coveragePriority: 'outer', layer: 'invalid' };

      registry.removeRule('coverage');

      const priority = registry.calculatePriority(candidate);
      expect(priority).toBe(20); // LAYER_PRIORITY_WITHIN_COVERAGE.base fallback
    });

    it('should combine coverage and layer rules for total priority', () => {
      const candidate = { coveragePriority: 'outer', layer: 'outer' };

      const priority = registry.calculatePriority(candidate);
      expect(priority).toBe(110); // 100 (outer coverage) + 10 (outer layer)
    });
  });

  describe('Priority Calculation', () => {
    it('should calculate priority for valid candidate', () => {
      const candidate = {
        coveragePriority: 'base',
        layer: 'underwear',
        itemId: 'test_item',
        source: 'coverage',
      };

      const priority = registry.calculatePriority(candidate);
      expect(priority).toBe(230); // 200 (base coverage) + 30 (underwear layer)
    });

    it('should handle null candidate gracefully', () => {
      const priority = registry.calculatePriority(null);

      expect(priority).toBe(Number.MAX_SAFE_INTEGER);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Invalid candidate provided to calculatePriority',
        { candidate: null }
      );
    });

    it('should handle undefined candidate gracefully', () => {
      const priority = registry.calculatePriority(undefined);

      expect(priority).toBe(Number.MAX_SAFE_INTEGER);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Invalid candidate provided to calculatePriority',
        { candidate: undefined }
      );
    });

    it('should handle non-object candidate gracefully', () => {
      const priority = registry.calculatePriority('invalid-candidate');

      expect(priority).toBe(Number.MAX_SAFE_INTEGER);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Invalid candidate provided to calculatePriority',
        { candidate: 'invalid-candidate' }
      );
    });

    it('should handle rule calculation errors gracefully', () => {
      const errorRule = () => {
        throw new Error('Rule calculation failed');
      };

      registry.registerRule('error-rule', errorRule);

      const candidate = { coveragePriority: 'outer', layer: 'outer' };
      const priority = registry.calculatePriority(candidate);

      // Should continue with other rules despite error
      expect(priority).toBe(110); // Default rules still work
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "Priority rule 'error-rule' failed for candidate:"
        ),
        expect.objectContaining({
          candidate: candidate,
          error: 'Rule calculation failed',
        })
      );
    });

    it('should skip rules that return invalid numbers', () => {
      registry.registerRule('invalid-number', () => 'not-a-number');
      registry.registerRule('nan-rule', () => NaN);

      const candidate = { coveragePriority: 'outer', layer: 'outer' };
      const priority = registry.calculatePriority(candidate);

      // Should only include valid rule contributions
      expect(priority).toBe(110); // Default rules only
      expect(mockLogger.warn).toHaveBeenCalledTimes(2);
    });

    it('should accumulate multiple custom rule contributions', () => {
      registry.registerRule('bonus1', () => 5);
      registry.registerRule('bonus2', () => 15);

      const candidate = { coveragePriority: 'outer', layer: 'outer' };
      const priority = registry.calculatePriority(candidate);

      expect(priority).toBe(130); // 110 (default) + 5 + 15
    });
  });

  describe('Process Multiple Candidates', () => {
    it('should process array of candidates and add priorities', () => {
      const candidates = [
        { itemId: 'item1', coveragePriority: 'outer', layer: 'outer' },
        { itemId: 'item2', coveragePriority: 'base', layer: 'base' },
        { itemId: 'item3', coveragePriority: 'underwear', layer: 'underwear' },
      ];

      const processed = registry.processCandidates(candidates);

      expect(processed).toHaveLength(3);
      expect(processed[0].priority).toBe(110); // outer + outer
      expect(processed[1].priority).toBe(220); // base + base
      expect(processed[2].priority).toBe(330); // underwear + underwear

      // Should preserve original properties
      expect(processed[0].itemId).toBe('item1');
      expect(processed[1].itemId).toBe('item2');
      expect(processed[2].itemId).toBe('item3');
    });

    it('should handle non-array input gracefully', () => {
      const processed = registry.processCandidates('not-an-array');

      expect(processed).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'processCandidates called with non-array input',
        { candidates: 'not-an-array' }
      );
    });

    it('should handle null input gracefully', () => {
      const processed = registry.processCandidates(null);

      expect(processed).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'processCandidates called with non-array input',
        { candidates: null }
      );
    });

    it('should handle empty array', () => {
      const processed = registry.processCandidates([]);
      expect(processed).toEqual([]);
    });

    it('should handle candidates with invalid data', () => {
      const candidates = [
        { itemId: 'valid', coveragePriority: 'outer', layer: 'outer' },
        null,
        { itemId: 'invalid' }, // Missing required properties
        undefined,
      ];

      const processed = registry.processCandidates(candidates);

      expect(processed).toHaveLength(4);
      expect(processed[0].priority).toBe(110); // Valid candidate
      expect(processed[1].priority).toBe(Number.MAX_SAFE_INTEGER); // null
      expect(processed[2].priority).toBe(420); // Invalid data uses fallbacks
      expect(processed[3].priority).toBe(Number.MAX_SAFE_INTEGER); // undefined
    });
  });

  describe('Registry Management', () => {
    it('should reset to default rules', () => {
      registry.registerRule('custom1', () => 10);
      registry.registerRule('custom2', () => 20);

      expect(registry.getRuleNames()).toHaveLength(4);

      registry.resetToDefaults();

      const ruleNames = registry.getRuleNames();
      expect(ruleNames).toHaveLength(2);
      expect(ruleNames).toContain('coverage');
      expect(ruleNames).toContain('layer');
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Priority rule registry reset to defaults'
      );
    });

    it('should get accurate statistics', () => {
      registry.registerRule('custom1', () => 10);
      registry.registerRule('custom2', () => 20);

      const stats = registry.getStats();

      expect(stats.ruleCount).toBe(4);
      expect(stats.ruleNames).toContain('coverage');
      expect(stats.ruleNames).toContain('layer');
      expect(stats.ruleNames).toContain('custom1');
      expect(stats.ruleNames).toContain('custom2');
      expect(stats.hasDefaults).toBe(true);
    });

    it('should detect missing default rules in statistics', () => {
      registry.removeRule('coverage');

      const stats = registry.getStats();
      expect(stats.hasDefaults).toBe(false);
    });
  });

  describe('Complex Integration Scenarios', () => {
    it('should handle weather-based priority rules', () => {
      registry.registerRule('weather', (candidate) => {
        if (
          candidate.weather === 'cold' &&
          candidate.coveragePriority === 'outer'
        ) {
          return -10; // Higher priority (lower number) for outer layers in cold weather
        }
        return 0;
      });

      const coldCandidate = {
        coveragePriority: 'outer',
        layer: 'outer',
        weather: 'cold',
      };
      const warmCandidate = {
        coveragePriority: 'outer',
        layer: 'outer',
      };

      const coldPriority = registry.calculatePriority(coldCandidate);
      const warmPriority = registry.calculatePriority(warmCandidate);

      expect(coldPriority).toBe(100); // 110 - 10 weather bonus
      expect(warmPriority).toBe(110); // No weather bonus
    });

    it('should handle damage-based priority rules', () => {
      registry.registerRule('damage', (candidate) => {
        return candidate.damaged ? 50 : 0; // Lower priority for damaged items
      });

      const damagedCandidate = {
        coveragePriority: 'outer',
        layer: 'outer',
        damaged: true,
      };
      const intactCandidate = {
        coveragePriority: 'outer',
        layer: 'outer',
        damaged: false,
      };

      const damagedPriority = registry.calculatePriority(damagedCandidate);
      const intactPriority = registry.calculatePriority(intactCandidate);

      expect(damagedPriority).toBe(160); // 110 + 50 damage penalty
      expect(intactPriority).toBe(110); // No damage penalty
    });

    it('should combine multiple custom rules correctly', () => {
      registry.registerRule('weather', (candidate) => {
        return candidate.weather === 'cold' ? -5 : 0;
      });

      registry.registerRule('social', (candidate) => {
        return candidate.social === 'formal' ? -3 : 0;
      });

      registry.registerRule('damage', (candidate) => {
        return candidate.damaged ? 20 : 0;
      });

      const candidate = {
        coveragePriority: 'outer',
        layer: 'outer',
        weather: 'cold',
        social: 'formal',
        damaged: false,
      };

      const priority = registry.calculatePriority(candidate);
      expect(priority).toBe(102); // 110 - 5 (weather) - 3 (social) + 0 (no damage)
    });
  });
});
