/**
 * @file Unit tests for AgeUtils helper functions
 */

import { describe, it, expect } from '@jest/globals';
import { AgeUtils } from '../../../src/utils/ageUtils.js';

describe('AgeUtils', () => {
  describe('getAverageAge', () => {
    it('should return bestGuess when available', () => {
      const ageComponent = { minAge: 20, maxAge: 30, bestGuess: 25 };
      expect(AgeUtils.getAverageAge(ageComponent)).toBe(25);
    });

    it('should throw error when bestGuess is not a number', () => {
      const ageComponent = { minAge: 20, maxAge: 30, bestGuess: '25' };

      expect(() => AgeUtils.getAverageAge(ageComponent)).toThrow(
        'bestGuess must be a number'
      );
    });

    it('should return average of min and max when no bestGuess', () => {
      const ageComponent = { minAge: 20, maxAge: 30 };
      expect(AgeUtils.getAverageAge(ageComponent)).toBe(25);
    });

    it('should handle exact age (min equals max)', () => {
      const ageComponent = { minAge: 25, maxAge: 25 };
      expect(AgeUtils.getAverageAge(ageComponent)).toBe(25);
    });

    it('should throw error for null component', () => {
      expect(() => AgeUtils.getAverageAge(null)).toThrow(
        'Age component is required'
      );
    });

    it('should throw error for missing minAge', () => {
      const ageComponent = { maxAge: 30 };
      expect(() => AgeUtils.getAverageAge(ageComponent)).toThrow(
        'Age component must have minAge'
      );
    });

    it('should throw error for missing maxAge', () => {
      const ageComponent = { minAge: 20 };
      expect(() => AgeUtils.getAverageAge(ageComponent)).toThrow(
        'Age component must have maxAge'
      );
    });

    it('should throw error for non-numeric ages', () => {
      const ageComponent = { minAge: '20', maxAge: 30 };
      expect(() => AgeUtils.getAverageAge(ageComponent)).toThrow(
        'Age values must be numbers'
      );
    });

    it('should throw error when maxAge is less than minAge', () => {
      const ageComponent = { minAge: 30, maxAge: 20 };
      expect(() => AgeUtils.getAverageAge(ageComponent)).toThrow(
        'maxAge must be greater than or equal to minAge'
      );
    });
  });

  describe('getAgeUncertainty', () => {
    it('should return difference between max and min age', () => {
      const ageComponent = { minAge: 20, maxAge: 30 };
      expect(AgeUtils.getAgeUncertainty(ageComponent)).toBe(10);
    });

    it('should return 0 for exact age', () => {
      const ageComponent = { minAge: 25, maxAge: 25 };
      expect(AgeUtils.getAgeUncertainty(ageComponent)).toBe(0);
    });

    it('should handle large age ranges', () => {
      const ageComponent = { minAge: 0, maxAge: 200 };
      expect(AgeUtils.getAgeUncertainty(ageComponent)).toBe(200);
    });

    it('should throw error for non-numeric age values', () => {
      const ageComponent = { minAge: '0', maxAge: 200 };

      expect(() => AgeUtils.getAgeUncertainty(ageComponent)).toThrow(
        'Age values must be numbers'
      );
    });

    it('should throw error for null component', () => {
      expect(() => AgeUtils.getAgeUncertainty(null)).toThrow(
        'Age component is required'
      );
    });

    it('should throw error when maxAge is less than minAge', () => {
      const ageComponent = { minAge: 30, maxAge: 20 };
      expect(() => AgeUtils.getAgeUncertainty(ageComponent)).toThrow(
        'maxAge must be greater than or equal to minAge'
      );
    });
  });

  describe('isAgeInRange', () => {
    it('should return true for age within range', () => {
      const ageComponent = { minAge: 20, maxAge: 30 };
      expect(AgeUtils.isAgeInRange(ageComponent, 25)).toBe(true);
    });

    it('should return true for age at minimum boundary', () => {
      const ageComponent = { minAge: 20, maxAge: 30 };
      expect(AgeUtils.isAgeInRange(ageComponent, 20)).toBe(true);
    });

    it('should return true for age at maximum boundary', () => {
      const ageComponent = { minAge: 20, maxAge: 30 };
      expect(AgeUtils.isAgeInRange(ageComponent, 30)).toBe(true);
    });

    it('should return false for age below range', () => {
      const ageComponent = { minAge: 20, maxAge: 30 };
      expect(AgeUtils.isAgeInRange(ageComponent, 19)).toBe(false);
    });

    it('should return false for age above range', () => {
      const ageComponent = { minAge: 20, maxAge: 30 };
      expect(AgeUtils.isAgeInRange(ageComponent, 31)).toBe(false);
    });

    it('should handle exact age range', () => {
      const ageComponent = { minAge: 25, maxAge: 25 };
      expect(AgeUtils.isAgeInRange(ageComponent, 25)).toBe(true);
      expect(AgeUtils.isAgeInRange(ageComponent, 24)).toBe(false);
      expect(AgeUtils.isAgeInRange(ageComponent, 26)).toBe(false);
    });

    it('should throw error for null component', () => {
      expect(() => AgeUtils.isAgeInRange(null, 25)).toThrow(
        'Age component is required'
      );
    });

    it('should throw error for null target age', () => {
      const ageComponent = { minAge: 20, maxAge: 30 };
      expect(() => AgeUtils.isAgeInRange(ageComponent, null)).toThrow(
        'Target age is required'
      );
    });

    it('should throw error for non-numeric target age', () => {
      const ageComponent = { minAge: 20, maxAge: 30 };
      expect(() => AgeUtils.isAgeInRange(ageComponent, '25')).toThrow(
        'Target age must be a number'
      );
    });

    it('should throw error for non-numeric age values', () => {
      const ageComponent = { minAge: '20', maxAge: 30 };

      expect(() => AgeUtils.isAgeInRange(ageComponent, 25)).toThrow(
        'Age values must be numbers'
      );
    });

    it('should throw error when maxAge is less than minAge', () => {
      const ageComponent = { minAge: 30, maxAge: 20 };

      expect(() => AgeUtils.isAgeInRange(ageComponent, 25)).toThrow(
        'maxAge must be greater than or equal to minAge'
      );
    });
  });

  describe('formatAgeDescription', () => {
    it('should format with bestGuess when available', () => {
      const ageComponent = { minAge: 20, maxAge: 30, bestGuess: 25 };
      expect(AgeUtils.formatAgeDescription(ageComponent)).toBe(
        'around 25 years old'
      );
    });

    it('should format exact age when min equals max', () => {
      const ageComponent = { minAge: 25, maxAge: 25 };
      expect(AgeUtils.formatAgeDescription(ageComponent)).toBe('25 years old');
    });

    it('should format age range when no bestGuess', () => {
      const ageComponent = { minAge: 20, maxAge: 30 };
      expect(AgeUtils.formatAgeDescription(ageComponent)).toBe(
        'between 20 and 30 years old'
      );
    });

    it('should handle single year range', () => {
      const ageComponent = { minAge: 24, maxAge: 25 };
      expect(AgeUtils.formatAgeDescription(ageComponent)).toBe(
        'between 24 and 25 years old'
      );
    });

    it('should throw error for null component', () => {
      expect(() => AgeUtils.formatAgeDescription(null)).toThrow(
        'Age component is required'
      );
    });

    it('should throw error for non-numeric age values', () => {
      const ageComponent = { minAge: '20', maxAge: 30 };

      expect(() => AgeUtils.formatAgeDescription(ageComponent)).toThrow(
        'Age values must be numbers'
      );
    });

    it('should throw error when maxAge is less than minAge', () => {
      const ageComponent = { minAge: 30, maxAge: 20 };

      expect(() => AgeUtils.formatAgeDescription(ageComponent)).toThrow(
        'maxAge must be greater than or equal to minAge'
      );
    });

    it('should throw error for non-numeric bestGuess', () => {
      const ageComponent = { minAge: 20, maxAge: 30, bestGuess: '25' };
      expect(() => AgeUtils.formatAgeDescription(ageComponent)).toThrow(
        'bestGuess must be a number'
      );
    });

    it('should throw error for bestGuess outside range', () => {
      const ageComponent = { minAge: 20, maxAge: 30, bestGuess: 35 };
      expect(() => AgeUtils.formatAgeDescription(ageComponent)).toThrow(
        'bestGuess must be between minAge and maxAge'
      );
    });

    it('should throw error for bestGuess below range', () => {
      const ageComponent = { minAge: 20, maxAge: 30, bestGuess: 15 };
      expect(() => AgeUtils.formatAgeDescription(ageComponent)).toThrow(
        'bestGuess must be between minAge and maxAge'
      );
    });
  });

  describe('validateAgeComponent', () => {
    it('should return true for valid component with bestGuess', () => {
      const ageComponent = { minAge: 20, maxAge: 30, bestGuess: 25 };
      expect(AgeUtils.validateAgeComponent(ageComponent)).toBe(true);
    });

    it('should return true for valid component without bestGuess', () => {
      const ageComponent = { minAge: 20, maxAge: 30 };
      expect(AgeUtils.validateAgeComponent(ageComponent)).toBe(true);
    });

    it('should return true for exact age', () => {
      const ageComponent = { minAge: 25, maxAge: 25 };
      expect(AgeUtils.validateAgeComponent(ageComponent)).toBe(true);
    });

    it('should return true for boundary values', () => {
      const ageComponent = { minAge: 0, maxAge: 200 };
      expect(AgeUtils.validateAgeComponent(ageComponent)).toBe(true);
    });

    it('should throw error for null component', () => {
      expect(() => AgeUtils.validateAgeComponent(null)).toThrow(
        'Age component is required'
      );
    });

    it('should throw error for missing minAge', () => {
      const ageComponent = { maxAge: 30 };
      expect(() => AgeUtils.validateAgeComponent(ageComponent)).toThrow(
        'Age component must have minAge'
      );
    });

    it('should throw error for missing maxAge', () => {
      const ageComponent = { minAge: 20 };
      expect(() => AgeUtils.validateAgeComponent(ageComponent)).toThrow(
        'Age component must have maxAge'
      );
    });

    it('should throw error for non-numeric ages', () => {
      const ageComponent = { minAge: '20', maxAge: 30 };
      expect(() => AgeUtils.validateAgeComponent(ageComponent)).toThrow(
        'Age values must be numbers'
      );
    });

    it('should throw error for negative ages', () => {
      const ageComponent = { minAge: -5, maxAge: 30 };
      expect(() => AgeUtils.validateAgeComponent(ageComponent)).toThrow(
        'Age values must be non-negative'
      );
    });

    it('should throw error for ages exceeding 200', () => {
      const ageComponent = { minAge: 20, maxAge: 250 };
      expect(() => AgeUtils.validateAgeComponent(ageComponent)).toThrow(
        'Age values must not exceed 200'
      );
    });

    it('should throw error when maxAge is less than minAge', () => {
      const ageComponent = { minAge: 30, maxAge: 20 };
      expect(() => AgeUtils.validateAgeComponent(ageComponent)).toThrow(
        'maxAge must be greater than or equal to minAge'
      );
    });

    it('should throw error for non-numeric bestGuess', () => {
      const ageComponent = { minAge: 20, maxAge: 30, bestGuess: '25' };
      expect(() => AgeUtils.validateAgeComponent(ageComponent)).toThrow(
        'bestGuess must be a number'
      );
    });

    it('should throw error for negative bestGuess', () => {
      const ageComponent = { minAge: 20, maxAge: 30, bestGuess: -5 };
      expect(() => AgeUtils.validateAgeComponent(ageComponent)).toThrow(
        'bestGuess must be between 0 and 200'
      );
    });

    it('should throw error for bestGuess exceeding 200', () => {
      const ageComponent = { minAge: 20, maxAge: 30, bestGuess: 250 };
      expect(() => AgeUtils.validateAgeComponent(ageComponent)).toThrow(
        'bestGuess must be between 0 and 200'
      );
    });

    it('should throw error for bestGuess outside component range', () => {
      const ageComponent = { minAge: 20, maxAge: 30, bestGuess: 35 };
      expect(() => AgeUtils.validateAgeComponent(ageComponent)).toThrow(
        'bestGuess must be between minAge and maxAge'
      );
    });

    it('should throw error for bestGuess below component range', () => {
      const ageComponent = { minAge: 20, maxAge: 30, bestGuess: 15 };
      expect(() => AgeUtils.validateAgeComponent(ageComponent)).toThrow(
        'bestGuess must be between minAge and maxAge'
      );
    });
  });

  describe('edge cases and comprehensive scenarios', () => {
    it('should handle zero age values', () => {
      const ageComponent = { minAge: 0, maxAge: 5 };
      expect(AgeUtils.getAverageAge(ageComponent)).toBe(2.5);
      expect(AgeUtils.getAgeUncertainty(ageComponent)).toBe(5);
      expect(AgeUtils.isAgeInRange(ageComponent, 0)).toBe(true);
      expect(AgeUtils.formatAgeDescription(ageComponent)).toBe(
        'between 0 and 5 years old'
      );
    });

    it('should respect a bestGuess value of zero', () => {
      const ageComponent = { minAge: 0, maxAge: 10, bestGuess: 0 };

      expect(AgeUtils.validateAgeComponent(ageComponent)).toBe(true);
      expect(AgeUtils.getAverageAge(ageComponent)).toBe(0);
      expect(AgeUtils.isAgeInRange(ageComponent, 0)).toBe(true);
      expect(AgeUtils.formatAgeDescription(ageComponent)).toBe(
        'around 0 years old'
      );
    });

    it('should handle maximum age values', () => {
      const ageComponent = { minAge: 195, maxAge: 200 };
      expect(AgeUtils.getAverageAge(ageComponent)).toBe(197.5);
      expect(AgeUtils.getAgeUncertainty(ageComponent)).toBe(5);
      expect(AgeUtils.isAgeInRange(ageComponent, 200)).toBe(true);
      expect(AgeUtils.formatAgeDescription(ageComponent)).toBe(
        'between 195 and 200 years old'
      );
    });

    it('should handle bestGuess at boundaries', () => {
      const ageComponentMin = { minAge: 20, maxAge: 30, bestGuess: 20 };
      const ageComponentMax = { minAge: 20, maxAge: 30, bestGuess: 30 };

      expect(AgeUtils.validateAgeComponent(ageComponentMin)).toBe(true);
      expect(AgeUtils.validateAgeComponent(ageComponentMax)).toBe(true);
      expect(AgeUtils.formatAgeDescription(ageComponentMin)).toBe(
        'around 20 years old'
      );
      expect(AgeUtils.formatAgeDescription(ageComponentMax)).toBe(
        'around 30 years old'
      );
    });
  });
});
