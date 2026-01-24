/**
 * @file Tests for the core:mood component schema validation
 * @description Validates the 11-axis emotional/regulatory state model with integer ranges [-100, 100]
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
        temporal_orientation: 0,
        self_evaluation: 0,
        affiliation: 0,
        inhibitory_control: 0,
        uncertainty: 0,
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
        temporal_orientation: -100,
        self_evaluation: -100,
        affiliation: -100,
        inhibitory_control: -100,
        uncertainty: -100,
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
        temporal_orientation: 100,
        self_evaluation: 100,
        affiliation: 100,
        inhibitory_control: 100,
        uncertainty: 100,
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
        temporal_orientation: 10,
        self_evaluation: 90,
        affiliation: -45,
        inhibitory_control: 0,
        uncertainty: 40,
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
      'temporal_orientation',
      'self_evaluation',
      'affiliation',
      'inhibitory_control',
      'uncertainty',
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
          temporal_orientation: 0,
          self_evaluation: 0,
          affiliation: 0,
          inhibitory_control: 0,
          uncertainty: 0,
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
      'temporal_orientation',
      'self_evaluation',
      'affiliation',
      'inhibitory_control',
      'uncertainty',
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
          temporal_orientation: 0,
          self_evaluation: 0,
          affiliation: 0,
          inhibitory_control: 0,
          uncertainty: 0,
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
          temporal_orientation: 0,
          self_evaluation: 0,
          affiliation: 0,
          inhibitory_control: 0,
          uncertainty: 0,
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
        temporal_orientation: 0,
        self_evaluation: 0,
        affiliation: 0,
        inhibitory_control: 0,
        uncertainty: 0,
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
        temporal_orientation: 0,
        self_evaluation: 0,
        affiliation: 0,
        inhibitory_control: 0,
        uncertainty: 0,
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
        affiliation: 0,
        inhibitory_control: 0,
        uncertainty: 0,
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
        temporal_orientation: 0,
        self_evaluation: 0,
        affiliation: 0,
        inhibitory_control: 0,
        uncertainty: 0,
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
        temporal_orientation: -100,
        self_evaluation: -100,
        affiliation: 100,
        inhibitory_control: -100,
        uncertainty: 100,
      });
      expect(result.isValid).toBe(true);
    });
  });

  describe('uncertainty axis specific tests', () => {
    it('should accept uncertainty at 0 (neutral cognitive state)', () => {
      const result = validate({
        valence: 0,
        arousal: 0,
        agency_control: 0,
        threat: 0,
        engagement: 0,
        future_expectancy: 0,
        temporal_orientation: 0,
        self_evaluation: 0,
        affiliation: 0,
        inhibitory_control: 0,
        uncertainty: 0,
      });
      expect(result.isValid).toBe(true);
    });

    it('should accept high uncertainty (+100 = highly uncertain / cannot integrate)', () => {
      const result = validate({
        valence: 0,
        arousal: 0,
        agency_control: 0,
        threat: 0,
        engagement: 0,
        future_expectancy: 0,
        temporal_orientation: 0,
        self_evaluation: 0,
        affiliation: 0,
        inhibitory_control: 0,
        uncertainty: 100,
      });
      expect(result.isValid).toBe(true);
    });

    it('should accept low uncertainty (-100 = highly certain / coherent model)', () => {
      const result = validate({
        valence: 0,
        arousal: 0,
        agency_control: 0,
        threat: 0,
        engagement: 0,
        future_expectancy: 0,
        temporal_orientation: 0,
        self_evaluation: 0,
        affiliation: 0,
        inhibitory_control: 0,
        uncertainty: -100,
      });
      expect(result.isValid).toBe(true);
    });

    it('should reject uncertainty value of -101', () => {
      const result = validate({
        valence: 0,
        arousal: 0,
        agency_control: 0,
        threat: 0,
        engagement: 0,
        future_expectancy: 0,
        temporal_orientation: 0,
        self_evaluation: 0,
        affiliation: 0,
        inhibitory_control: 0,
        uncertainty: -101,
      });
      expect(result.isValid).toBe(false);
    });

    it('should reject uncertainty value of 101', () => {
      const result = validate({
        valence: 0,
        arousal: 0,
        agency_control: 0,
        threat: 0,
        engagement: 0,
        future_expectancy: 0,
        temporal_orientation: 0,
        self_evaluation: 0,
        affiliation: 0,
        inhibitory_control: 0,
        uncertainty: 101,
      });
      expect(result.isValid).toBe(false);
    });

    it('should reject floating point uncertainty values', () => {
      const result = validate({
        valence: 0,
        arousal: 0,
        agency_control: 0,
        threat: 0,
        engagement: 0,
        future_expectancy: 0,
        temporal_orientation: 0,
        self_evaluation: 0,
        affiliation: 0,
        inhibitory_control: 0,
        uncertainty: 50.5,
      });
      expect(result.isValid).toBe(false);
    });
  });
});
