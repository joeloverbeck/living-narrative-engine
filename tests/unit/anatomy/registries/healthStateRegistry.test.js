import {
  HEALTH_STATE_REGISTRY,
  calculateStateFromPercentage,
  getStateOrder,
  isValidState,
  getFirstPersonDescription,
  getThirdPersonDescription,
  isDeterioration,
  getAllStateIds,
} from '../../../../src/anatomy/registries/healthStateRegistry.js';

describe('HealthStateRegistry', () => {
  describe('HEALTH_STATE_REGISTRY', () => {
    it('should be frozen', () => {
      expect(Object.isFrozen(HEALTH_STATE_REGISTRY)).toBe(true);
    });

    it('should contain all expected states', () => {
      const expectedStates = [
        'healthy',
        'scratched',
        'wounded',
        'injured',
        'critical',
        'destroyed',
      ];
      expect(Object.keys(HEALTH_STATE_REGISTRY)).toEqual(
        expect.arrayContaining(expectedStates)
      );
      expect(Object.keys(HEALTH_STATE_REGISTRY)).toHaveLength(6);
    });

    it('should have correct threshold structure', () => {
      Object.values(HEALTH_STATE_REGISTRY).forEach((state) => {
        expect(state).toHaveProperty('id');
        expect(state).toHaveProperty('thresholdMin');
        expect(state).toHaveProperty('order');
        expect(state).toHaveProperty('firstPerson');
        expect(state).toHaveProperty('thirdPerson');
        expect(state).toHaveProperty('cssClass');
      });
    });
  });

  describe('calculateStateFromPercentage', () => {
    const testCases = [
      { pct: 100, expected: 'healthy' },
      { pct: 81, expected: 'healthy' },
      { pct: 80.9, expected: 'scratched' },
      { pct: 61, expected: 'scratched' },
      { pct: 60.9, expected: 'wounded' },
      { pct: 41, expected: 'wounded' },
      { pct: 40.9, expected: 'injured' },
      { pct: 21, expected: 'injured' },
      { pct: 20.9, expected: 'critical' },
      { pct: 1, expected: 'critical' },
      { pct: 0.9, expected: 'destroyed' }, // Assuming thresholds are integers/inclusive min
      // Wait, implementation does strict comparison >= minThreshold.
      // healthy: 81
      // scratched: 61
      // wounded: 41
      // injured: 21
      // critical: 1
      // destroyed: 0
      // So 0.9 >= 0 is destroyed. Correct.
      { pct: 0, expected: 'destroyed' },
      { pct: -10, expected: 'destroyed' },
      { pct: 150, expected: 'healthy' },
    ];

    testCases.forEach(({ pct, expected }) => {
      it(`should return ${expected} for ${pct}%`, () => {
        expect(calculateStateFromPercentage(pct)).toBe(expected);
      });
    });
  });

  describe('getStateOrder', () => {
    it('should return states in ascending severity order (default)', () => {
      const order = getStateOrder();
      expect(order).toEqual([
        'healthy',
        'scratched',
        'wounded',
        'injured',
        'critical',
        'destroyed',
      ]);
    });

    it('should return states in descending severity order', () => {
      const order = getStateOrder(false);
      expect(order).toEqual([
        'destroyed',
        'critical',
        'injured',
        'wounded',
        'scratched',
        'healthy',
      ]);
    });
  });

  describe('isValidState', () => {
    it('should return true for valid states', () => {
      expect(isValidState('healthy')).toBe(true);
      expect(isValidState('critical')).toBe(true);
    });

    it('should return false for invalid states', () => {
      expect(isValidState('obliterated')).toBe(false);
      expect(isValidState('')).toBe(false);
      expect(isValidState(null)).toBe(false);
    });
  });

  describe('Descriptions', () => {
    it('should return first person descriptions', () => {
      expect(getFirstPersonDescription('healthy')).toBe('feels fine');
      expect(getFirstPersonDescription('destroyed')).toBe('is completely numb');
    });

    it('should return empty string for invalid state in first person', () => {
      expect(getFirstPersonDescription('unknown')).toBe('');
    });

    it('should return third person descriptions', () => {
      expect(getThirdPersonDescription('healthy')).toBe('is uninjured');
      expect(getThirdPersonDescription('destroyed')).toBe('has been destroyed');
    });

    it('should return empty string for invalid state in third person', () => {
      expect(getThirdPersonDescription('unknown')).toBe('');
    });
  });

  describe('isDeterioration', () => {
    it('should return true when moving to worse state', () => {
      expect(isDeterioration('healthy', 'scratched')).toBe(true);
      expect(isDeterioration('wounded', 'critical')).toBe(true);
    });

    it('should return false when moving to better state', () => {
      expect(isDeterioration('scratched', 'healthy')).toBe(false);
      expect(isDeterioration('critical', 'injured')).toBe(false);
    });

    it('should return false when state is unchanged', () => {
      expect(isDeterioration('injured', 'injured')).toBe(false);
    });

    it('should return false for invalid inputs', () => {
      expect(isDeterioration('healthy', 'unknown')).toBe(false);
      expect(isDeterioration('unknown', 'healthy')).toBe(false);
    });
  });

  describe('getAllStateIds', () => {
    it('should return all state IDs', () => {
      const ids = getAllStateIds();
      expect(ids).toHaveLength(6);
      expect(ids).toContain('healthy');
      expect(ids).toContain('destroyed');
    });
  });
});
