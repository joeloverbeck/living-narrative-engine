/**
 * @file Tests for the core:sexual_state component schema validation
 * @description Validates the dual-control sexual arousal model with integer ranges
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TestBedClass } from '../../../../common/entities/testBed.js';

describe('core:sexual_state component schema', () => {
  let testBed;

  beforeEach(() => {
    testBed = new TestBedClass();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  const validate = (data) =>
    testBed.validateAgainstSchema(data, 'core:sexual_state');

  describe('valid data', () => {
    it('should accept all fields at default values (0)', () => {
      const result = validate({
        sex_excitation: 0,
        sex_inhibition: 0,
        baseline_libido: 0,
      });
      expect(result.isValid).toBe(true);
    });

    it('should accept sex_excitation at maximum (100)', () => {
      const result = validate({
        sex_excitation: 100,
        sex_inhibition: 0,
        baseline_libido: 0,
      });
      expect(result.isValid).toBe(true);
    });

    it('should accept sex_inhibition at maximum (100)', () => {
      const result = validate({
        sex_excitation: 0,
        sex_inhibition: 100,
        baseline_libido: 0,
      });
      expect(result.isValid).toBe(true);
    });

    it('should accept baseline_libido at minimum (-50)', () => {
      const result = validate({
        sex_excitation: 0,
        sex_inhibition: 0,
        baseline_libido: -50,
      });
      expect(result.isValid).toBe(true);
    });

    it('should accept baseline_libido at maximum (50)', () => {
      const result = validate({
        sex_excitation: 0,
        sex_inhibition: 0,
        baseline_libido: 50,
      });
      expect(result.isValid).toBe(true);
    });

    it('should accept mixed values within valid ranges', () => {
      const result = validate({
        sex_excitation: 75,
        sex_inhibition: 25,
        baseline_libido: -15,
      });
      expect(result.isValid).toBe(true);
    });
  });

  describe('required fields', () => {
    it('should reject missing sex_excitation', () => {
      const result = validate({
        sex_inhibition: 0,
        baseline_libido: 0,
      });
      expect(result.isValid).toBe(false);
    });

    it('should reject missing sex_inhibition', () => {
      const result = validate({
        sex_excitation: 0,
        baseline_libido: 0,
      });
      expect(result.isValid).toBe(false);
    });

    it('should reject missing baseline_libido', () => {
      const result = validate({
        sex_excitation: 0,
        sex_inhibition: 0,
      });
      expect(result.isValid).toBe(false);
    });
  });

  describe('range validation - sex_excitation [0, 100]', () => {
    it('should reject sex_excitation below minimum (0)', () => {
      const result = validate({
        sex_excitation: -1,
        sex_inhibition: 0,
        baseline_libido: 0,
      });
      expect(result.isValid).toBe(false);
    });

    it('should reject sex_excitation above maximum (100)', () => {
      const result = validate({
        sex_excitation: 101,
        sex_inhibition: 0,
        baseline_libido: 0,
      });
      expect(result.isValid).toBe(false);
    });

    it('should accept sex_excitation at boundary (0)', () => {
      const result = validate({
        sex_excitation: 0,
        sex_inhibition: 0,
        baseline_libido: 0,
      });
      expect(result.isValid).toBe(true);
    });

    it('should accept sex_excitation at boundary (100)', () => {
      const result = validate({
        sex_excitation: 100,
        sex_inhibition: 0,
        baseline_libido: 0,
      });
      expect(result.isValid).toBe(true);
    });
  });

  describe('range validation - sex_inhibition [0, 100]', () => {
    it('should reject sex_inhibition below minimum (0)', () => {
      const result = validate({
        sex_excitation: 0,
        sex_inhibition: -1,
        baseline_libido: 0,
      });
      expect(result.isValid).toBe(false);
    });

    it('should reject sex_inhibition above maximum (100)', () => {
      const result = validate({
        sex_excitation: 0,
        sex_inhibition: 101,
        baseline_libido: 0,
      });
      expect(result.isValid).toBe(false);
    });

    it('should accept sex_inhibition at boundary (0)', () => {
      const result = validate({
        sex_excitation: 0,
        sex_inhibition: 0,
        baseline_libido: 0,
      });
      expect(result.isValid).toBe(true);
    });

    it('should accept sex_inhibition at boundary (100)', () => {
      const result = validate({
        sex_excitation: 0,
        sex_inhibition: 100,
        baseline_libido: 0,
      });
      expect(result.isValid).toBe(true);
    });
  });

  describe('range validation - baseline_libido [-50, 50]', () => {
    it('should reject baseline_libido below minimum (-50)', () => {
      const result = validate({
        sex_excitation: 0,
        sex_inhibition: 0,
        baseline_libido: -51,
      });
      expect(result.isValid).toBe(false);
    });

    it('should reject baseline_libido above maximum (50)', () => {
      const result = validate({
        sex_excitation: 0,
        sex_inhibition: 0,
        baseline_libido: 51,
      });
      expect(result.isValid).toBe(false);
    });

    it('should accept baseline_libido at boundary (-50)', () => {
      const result = validate({
        sex_excitation: 0,
        sex_inhibition: 0,
        baseline_libido: -50,
      });
      expect(result.isValid).toBe(true);
    });

    it('should accept baseline_libido at boundary (50)', () => {
      const result = validate({
        sex_excitation: 0,
        sex_inhibition: 0,
        baseline_libido: 50,
      });
      expect(result.isValid).toBe(true);
    });
  });

  describe('type validation', () => {
    it('should reject non-integer values for sex_excitation', () => {
      const result = validate({
        sex_excitation: 50.5,
        sex_inhibition: 0,
        baseline_libido: 0,
      });
      expect(result.isValid).toBe(false);
    });

    it('should reject non-integer values for sex_inhibition', () => {
      const result = validate({
        sex_excitation: 0,
        sex_inhibition: 25.7,
        baseline_libido: 0,
      });
      expect(result.isValid).toBe(false);
    });

    it('should reject non-integer values for baseline_libido', () => {
      const result = validate({
        sex_excitation: 0,
        sex_inhibition: 0,
        baseline_libido: 10.3,
      });
      expect(result.isValid).toBe(false);
    });

    it('should reject string values', () => {
      const result = validate({
        sex_excitation: '50',
        sex_inhibition: 0,
        baseline_libido: 0,
      });
      expect(result.isValid).toBe(false);
    });

    it('should reject null values', () => {
      const result = validate({
        sex_excitation: null,
        sex_inhibition: 0,
        baseline_libido: 0,
      });
      expect(result.isValid).toBe(false);
    });
  });

  describe('additionalProperties', () => {
    it('should reject additional properties', () => {
      const result = validate({
        sex_excitation: 0,
        sex_inhibition: 0,
        baseline_libido: 0,
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

    it('should accept all boundary values simultaneously', () => {
      const result = validate({
        sex_excitation: 100,
        sex_inhibition: 100,
        baseline_libido: -50,
      });
      expect(result.isValid).toBe(true);
    });

    it('should accept zero values for all fields (neutral state)', () => {
      const result = validate({
        sex_excitation: 0,
        sex_inhibition: 0,
        baseline_libido: 0,
      });
      expect(result.isValid).toBe(true);
    });
  });
});
