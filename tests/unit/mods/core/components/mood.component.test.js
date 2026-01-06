/**
 * @file Tests for the core:mood component schema validation
 * @description Validates the 7-axis emotional state model with integer ranges [-100, 100]
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TestBedClass } from '../../../../common/entities/testBed.js';

describe('core:mood component schema', () => {
  let testBed;

  beforeEach(() => {
    testBed = new TestBedClass();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  const validate = (data) => testBed.validateAgainstSchema(data, 'core:mood');

  describe('valid data', () => {
    it('should accept all axes at default values (0)', () => {
      const result = validate({
        valence: 0,
        arousal: 0,
        agency_control: 0,
        threat: 0,
        engagement: 0,
        future_expectancy: 0,
        self_evaluation: 0,
      });
      expect(result.isValid).toBe(true);
    });

    it('should accept all axes at minimum value (-100)', () => {
      const result = validate({
        valence: -100,
        arousal: -100,
        agency_control: -100,
        threat: -100,
        engagement: -100,
        future_expectancy: -100,
        self_evaluation: -100,
      });
      expect(result.isValid).toBe(true);
    });

    it('should accept all axes at maximum value (100)', () => {
      const result = validate({
        valence: 100,
        arousal: 100,
        agency_control: 100,
        threat: 100,
        engagement: 100,
        future_expectancy: 100,
        self_evaluation: 100,
      });
      expect(result.isValid).toBe(true);
    });

    it('should accept mixed positive and negative values', () => {
      const result = validate({
        valence: 50,
        arousal: -30,
        agency_control: 75,
        threat: -80,
        engagement: 25,
        future_expectancy: -15,
        self_evaluation: 90,
      });
      expect(result.isValid).toBe(true);
    });
  });

  describe('required fields', () => {
    const requiredFields = [
      'valence',
      'arousal',
      'agency_control',
      'threat',
      'engagement',
      'future_expectancy',
      'self_evaluation',
    ];

    requiredFields.forEach((field) => {
      it(`should reject missing ${field}`, () => {
        const data = {
          valence: 0,
          arousal: 0,
          agency_control: 0,
          threat: 0,
          engagement: 0,
          future_expectancy: 0,
          self_evaluation: 0,
        };
        delete data[field];
        const result = validate(data);
        expect(result.isValid).toBe(false);
      });
    });
  });

  describe('range validation', () => {
    const axes = [
      'valence',
      'arousal',
      'agency_control',
      'threat',
      'engagement',
      'future_expectancy',
      'self_evaluation',
    ];

    axes.forEach((axis) => {
      it(`should reject ${axis} below minimum (-100)`, () => {
        const data = {
          valence: 0,
          arousal: 0,
          agency_control: 0,
          threat: 0,
          engagement: 0,
          future_expectancy: 0,
          self_evaluation: 0,
        };
        data[axis] = -101;
        const result = validate(data);
        expect(result.isValid).toBe(false);
      });

      it(`should reject ${axis} above maximum (100)`, () => {
        const data = {
          valence: 0,
          arousal: 0,
          agency_control: 0,
          threat: 0,
          engagement: 0,
          future_expectancy: 0,
          self_evaluation: 0,
        };
        data[axis] = 101;
        const result = validate(data);
        expect(result.isValid).toBe(false);
      });
    });
  });

  describe('type validation', () => {
    it('should reject non-integer values', () => {
      const result = validate({
        valence: 50.5,
        arousal: 0,
        agency_control: 0,
        threat: 0,
        engagement: 0,
        future_expectancy: 0,
        self_evaluation: 0,
      });
      expect(result.isValid).toBe(false);
    });

    it('should reject string values', () => {
      const result = validate({
        valence: '50',
        arousal: 0,
        agency_control: 0,
        threat: 0,
        engagement: 0,
        future_expectancy: 0,
        self_evaluation: 0,
      });
      expect(result.isValid).toBe(false);
    });

    it('should reject null values', () => {
      const result = validate({
        valence: null,
        arousal: 0,
        agency_control: 0,
        threat: 0,
        engagement: 0,
        future_expectancy: 0,
        self_evaluation: 0,
      });
      expect(result.isValid).toBe(false);
    });
  });

  describe('additionalProperties', () => {
    it('should reject additional properties', () => {
      const result = validate({
        valence: 0,
        arousal: 0,
        agency_control: 0,
        threat: 0,
        engagement: 0,
        future_expectancy: 0,
        self_evaluation: 0,
        unknown_property: 42,
      });
      expect(result.isValid).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should reject empty object', () => {
      const result = validate({});
      expect(result.isValid).toBe(false);
    });

    it('should accept boundary values at exactly -100 and 100', () => {
      const result = validate({
        valence: -100,
        arousal: 100,
        agency_control: -100,
        threat: 100,
        engagement: -100,
        future_expectancy: 100,
        self_evaluation: -100,
      });
      expect(result.isValid).toBe(true);
    });
  });
});
