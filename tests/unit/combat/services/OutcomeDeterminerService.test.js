import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import OutcomeDeterminerService from '../../../../src/combat/services/OutcomeDeterminerService.js';
import { InvalidArgumentError } from '../../../../src/errors/invalidArgumentError.js';

/**
 * Creates minimal mocks for dependencies
 *
 * @returns {object} Object containing mocked dependencies
 */
function createMocks() {
  return {
    logger: {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
  };
}

describe('OutcomeDeterminerService', () => {
  let service;
  let mockLogger;

  beforeEach(() => {
    ({ logger: mockLogger } = createMocks());
    service = new OutcomeDeterminerService({ logger: mockLogger });
  });

  describe('constructor', () => {
    it('should create instance with valid dependencies', () => {
      expect(service).toBeInstanceOf(OutcomeDeterminerService);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'OutcomeDeterminerService: Initialized'
      );
    });

    it('should throw error when logger is missing', () => {
      expect(() => {
        new OutcomeDeterminerService({});
      }).toThrow(InvalidArgumentError);
    });

    it('should throw error when logger is null', () => {
      expect(() => {
        new OutcomeDeterminerService({ logger: null });
      }).toThrow(InvalidArgumentError);
    });

    it('should throw error when logger is undefined', () => {
      expect(() => {
        new OutcomeDeterminerService({ logger: undefined });
      }).toThrow(InvalidArgumentError);
    });

    it('should throw error when logger missing required methods', () => {
      expect(() => {
        new OutcomeDeterminerService({
          logger: { debug: jest.fn() }, // Missing warn, error, info
        });
      }).toThrow(InvalidArgumentError);
    });

    it('should throw error when no params provided', () => {
      expect(() => {
        new OutcomeDeterminerService();
      }).toThrow();
    });
  });

  describe('determine - basic outcomes', () => {
    it('should return SUCCESS when roll <= finalChance', () => {
      const result = service.determine({ finalChance: 50, forcedRoll: 30 });

      expect(result.outcome).toBe('SUCCESS');
      expect(result.roll).toBe(30);
      expect(result.isCritical).toBe(false);
    });

    it('should return FAILURE when roll > finalChance', () => {
      const result = service.determine({ finalChance: 50, forcedRoll: 70 });

      expect(result.outcome).toBe('FAILURE');
      expect(result.roll).toBe(70);
      expect(result.isCritical).toBe(false);
    });

    it('should return CRITICAL_SUCCESS when roll <= criticalSuccessThreshold AND success', () => {
      const result = service.determine({ finalChance: 50, forcedRoll: 3 });

      expect(result.outcome).toBe('CRITICAL_SUCCESS');
      expect(result.roll).toBe(3);
      expect(result.isCritical).toBe(true);
    });

    it('should return FUMBLE when roll >= criticalFailureThreshold AND failure', () => {
      const result = service.determine({ finalChance: 50, forcedRoll: 97 });

      expect(result.outcome).toBe('FUMBLE');
      expect(result.roll).toBe(97);
      expect(result.isCritical).toBe(true);
    });

    it('should return SUCCESS on exact match (roll = finalChance)', () => {
      const result = service.determine({ finalChance: 50, forcedRoll: 50 });

      expect(result.outcome).toBe('SUCCESS');
      expect(result.roll).toBe(50);
    });
  });

  describe('determine - margin calculation', () => {
    it('should calculate negative margin for success (roll under chance)', () => {
      const result = service.determine({ finalChance: 50, forcedRoll: 30 });

      expect(result.margin).toBe(-20); // 30 - 50 = -20 (20 under)
    });

    it('should calculate positive margin for failure (roll over chance)', () => {
      const result = service.determine({ finalChance: 50, forcedRoll: 70 });

      expect(result.margin).toBe(20); // 70 - 50 = 20 (20 over)
    });

    it('should calculate zero margin for exact match', () => {
      const result = service.determine({ finalChance: 50, forcedRoll: 50 });

      expect(result.margin).toBe(0);
    });
  });

  describe('determine - custom thresholds', () => {
    it('should use custom criticalSuccess threshold (10)', () => {
      const result = service.determine({
        finalChance: 50,
        forcedRoll: 8,
        thresholds: { criticalSuccess: 10 },
      });

      expect(result.outcome).toBe('CRITICAL_SUCCESS');
    });

    it('should not be critical success above custom threshold', () => {
      const result = service.determine({
        finalChance: 50,
        forcedRoll: 12,
        thresholds: { criticalSuccess: 10 },
      });

      expect(result.outcome).toBe('SUCCESS');
      expect(result.isCritical).toBe(false);
    });

    it('should use custom criticalFailure threshold (90)', () => {
      const result = service.determine({
        finalChance: 50,
        forcedRoll: 92,
        thresholds: { criticalFailure: 90 },
      });

      expect(result.outcome).toBe('FUMBLE');
    });

    it('should not be fumble below custom threshold', () => {
      const result = service.determine({
        finalChance: 50,
        forcedRoll: 88,
        thresholds: { criticalFailure: 90 },
      });

      expect(result.outcome).toBe('FAILURE');
      expect(result.isCritical).toBe(false);
    });

    it('should work with both custom thresholds together', () => {
      // Critical success with custom threshold
      const critSuccess = service.determine({
        finalChance: 60,
        forcedRoll: 8,
        thresholds: { criticalSuccess: 10, criticalFailure: 90 },
      });
      expect(critSuccess.outcome).toBe('CRITICAL_SUCCESS');

      // Fumble with custom threshold
      const fumble = service.determine({
        finalChance: 60,
        forcedRoll: 92,
        thresholds: { criticalSuccess: 10, criticalFailure: 90 },
      });
      expect(fumble.outcome).toBe('FUMBLE');
    });
  });

  describe('determine - edge cases with finalChance', () => {
    it('should handle finalChance: 5 (can still critical success on roll 1-5)', () => {
      const result = service.determine({ finalChance: 5, forcedRoll: 3 });

      expect(result.outcome).toBe('CRITICAL_SUCCESS');
    });

    it('should fail on roll 6 when finalChance is 5', () => {
      const result = service.determine({ finalChance: 5, forcedRoll: 6 });

      expect(result.outcome).toBe('FAILURE');
    });

    it('should handle finalChance: 95 (can still fumble on roll 95-100)', () => {
      const result = service.determine({ finalChance: 95, forcedRoll: 98 });

      expect(result.outcome).toBe('FUMBLE');
    });

    it('should succeed on roll 95 when finalChance is 95', () => {
      const result = service.determine({ finalChance: 95, forcedRoll: 95 });

      expect(result.outcome).toBe('SUCCESS');
    });

    it('should always fail when finalChance: 0 (but can fumble)', () => {
      // Regular failure
      const failure = service.determine({ finalChance: 0, forcedRoll: 50 });
      expect(failure.outcome).toBe('FAILURE');

      // Fumble possible
      const fumble = service.determine({ finalChance: 0, forcedRoll: 97 });
      expect(fumble.outcome).toBe('FUMBLE');
    });

    it('should always succeed when finalChance: 100 (but can critical)', () => {
      // Regular success
      const success = service.determine({ finalChance: 100, forcedRoll: 80 });
      expect(success.outcome).toBe('SUCCESS');

      // Critical success possible
      const critical = service.determine({ finalChance: 100, forcedRoll: 3 });
      expect(critical.outcome).toBe('CRITICAL_SUCCESS');
    });
  });

  describe('determine - critical logic tests', () => {
    it('should NOT be critical success when roll is low but still fails (roll 3 on chance 2)', () => {
      // Roll 3 is <= default critical threshold of 5, but 3 > 2 so it's a failure
      const result = service.determine({ finalChance: 2, forcedRoll: 3 });

      expect(result.outcome).toBe('FAILURE');
      expect(result.isCritical).toBe(false);
    });

    it('should NOT be fumble when roll is high but still succeeds (roll 96 on chance 97)', () => {
      // Roll 96 is >= default fumble threshold of 95, but 96 <= 97 so it's a success
      const result = service.determine({ finalChance: 97, forcedRoll: 96 });

      expect(result.outcome).toBe('SUCCESS');
      expect(result.isCritical).toBe(false);
    });

    it('should be fumble when roll is high AND fails (roll 96 on chance 90)', () => {
      // Roll 96 >= 95 and 96 > 90 (failure)
      const result = service.determine({ finalChance: 90, forcedRoll: 96 });

      expect(result.outcome).toBe('FUMBLE');
      expect(result.isCritical).toBe(true);
    });

    it('should be critical success when roll is low AND succeeds (roll 4 on chance 10)', () => {
      // Roll 4 <= 5 and 4 <= 10 (success)
      const result = service.determine({ finalChance: 10, forcedRoll: 4 });

      expect(result.outcome).toBe('CRITICAL_SUCCESS');
      expect(result.isCritical).toBe(true);
    });

    it('should NOT be critical success when roll exceeds threshold even if success', () => {
      // Roll 6 > 5 (default threshold), even though 6 <= 50 (success)
      const result = service.determine({ finalChance: 50, forcedRoll: 6 });

      expect(result.outcome).toBe('SUCCESS');
      expect(result.isCritical).toBe(false);
    });

    it('should NOT be fumble when roll below threshold even if failure', () => {
      // Roll 94 < 95 (default threshold), even though 94 > 50 (failure)
      const result = service.determine({ finalChance: 50, forcedRoll: 94 });

      expect(result.outcome).toBe('FAILURE');
      expect(result.isCritical).toBe(false);
    });
  });

  describe('determine - input validation', () => {
    it('should handle undefined params gracefully', () => {
      const result = service.determine(undefined);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid finalChance')
      );
      expect(result.outcome).toBeDefined();
    });

    it('should handle null params gracefully', () => {
      const result = service.determine(null);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid finalChance')
      );
      expect(result.outcome).toBeDefined();
    });

    it('should default to 50% chance when finalChance is NaN', () => {
      const result = service.determine({ finalChance: NaN, forcedRoll: 30 });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid finalChance')
      );
      expect(result.outcome).toBe('SUCCESS'); // 30 <= 50
    });

    it('should default to 50% chance when finalChance is undefined', () => {
      const result = service.determine({ forcedRoll: 30 });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid finalChance')
      );
      expect(result.outcome).toBe('SUCCESS'); // 30 <= 50
    });

    it('should clamp finalChance > 100 to 100', () => {
      const result = service.determine({ finalChance: 150, forcedRoll: 99 });

      expect(result.outcome).toBe('SUCCESS'); // 99 <= 100
    });

    it('should clamp finalChance < 0 to 0', () => {
      const result = service.determine({ finalChance: -50, forcedRoll: 1 });

      expect(result.outcome).toBe('FAILURE'); // 1 > 0
    });

    it('should use default thresholds when thresholds object is empty', () => {
      const critResult = service.determine({
        finalChance: 50,
        forcedRoll: 3,
        thresholds: {},
      });
      expect(critResult.outcome).toBe('CRITICAL_SUCCESS');

      const fumbleResult = service.determine({
        finalChance: 50,
        forcedRoll: 97,
        thresholds: {},
      });
      expect(fumbleResult.outcome).toBe('FUMBLE');
    });

    it('should use default threshold values when individual values are invalid', () => {
      const result = service.determine({
        finalChance: 50,
        forcedRoll: 3,
        thresholds: { criticalSuccess: 'invalid', criticalFailure: null },
      });

      expect(result.outcome).toBe('CRITICAL_SUCCESS');
    });

    it('should ignore forcedRoll if out of valid range (< 1)', () => {
      // When forcedRoll is invalid, a random roll is used
      // We can't test the exact outcome, but we can verify the roll is in range
      const result = service.determine({ finalChance: 50, forcedRoll: 0 });

      expect(result.roll).toBeGreaterThanOrEqual(1);
      expect(result.roll).toBeLessThanOrEqual(100);
    });

    it('should ignore forcedRoll if out of valid range (> 100)', () => {
      const result = service.determine({ finalChance: 50, forcedRoll: 101 });

      expect(result.roll).toBeGreaterThanOrEqual(1);
      expect(result.roll).toBeLessThanOrEqual(100);
    });
  });

  describe('determine - boundary roll values', () => {
    it('should handle roll = 1 (minimum roll)', () => {
      const result = service.determine({ finalChance: 50, forcedRoll: 1 });

      expect(result.roll).toBe(1);
      expect(result.outcome).toBe('CRITICAL_SUCCESS');
    });

    it('should handle roll = 100 (maximum roll)', () => {
      const result = service.determine({ finalChance: 50, forcedRoll: 100 });

      expect(result.roll).toBe(100);
      expect(result.outcome).toBe('FUMBLE');
    });

    it('should handle roll = 5 (default critical threshold boundary)', () => {
      const result = service.determine({ finalChance: 50, forcedRoll: 5 });

      expect(result.outcome).toBe('CRITICAL_SUCCESS');
    });

    it('should handle roll = 95 (default fumble threshold boundary)', () => {
      const result = service.determine({ finalChance: 50, forcedRoll: 95 });

      expect(result.outcome).toBe('FUMBLE');
    });
  });

  describe('determine - logging', () => {
    it('should log debug message with outcome details', () => {
      service.determine({ finalChance: 50, forcedRoll: 30 });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('roll=30')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('chance=50')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('outcome=SUCCESS')
      );
    });
  });

  describe('determine - result structure', () => {
    it('should return all required fields', () => {
      const result = service.determine({ finalChance: 50, forcedRoll: 30 });

      expect(result).toHaveProperty('outcome');
      expect(result).toHaveProperty('roll');
      expect(result).toHaveProperty('margin');
      expect(result).toHaveProperty('isCritical');
    });

    it('should have correct types for all fields', () => {
      const result = service.determine({ finalChance: 50, forcedRoll: 30 });

      expect(typeof result.outcome).toBe('string');
      expect(typeof result.roll).toBe('number');
      expect(typeof result.margin).toBe('number');
      expect(typeof result.isCritical).toBe('boolean');
    });

    it('should only return valid outcome types', () => {
      const validOutcomes = ['CRITICAL_SUCCESS', 'SUCCESS', 'FAILURE', 'FUMBLE'];

      // Test various scenarios
      const scenarios = [
        { finalChance: 50, forcedRoll: 3 },
        { finalChance: 50, forcedRoll: 30 },
        { finalChance: 50, forcedRoll: 70 },
        { finalChance: 50, forcedRoll: 97 },
      ];

      for (const params of scenarios) {
        const result = service.determine(params);
        expect(validOutcomes).toContain(result.outcome);
      }
    });
  });

  describe('determine - random roll generation', () => {
    it('should generate rolls in valid range (1-100) when no forcedRoll', () => {
      // Run multiple times to ensure consistency
      for (let i = 0; i < 10; i++) {
        const result = service.determine({ finalChance: 50 });

        expect(result.roll).toBeGreaterThanOrEqual(1);
        expect(result.roll).toBeLessThanOrEqual(100);
      }
    });
  });
});
