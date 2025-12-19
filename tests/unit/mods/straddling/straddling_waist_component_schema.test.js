/**
 * @file Unit tests for the positioning:straddling_waist component schema validation
 * @description Tests that the component schema correctly validates straddling waist data
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TestBedClass } from '../../../common/entities/testBed.js';

describe('positioning:straddling_waist Component - Schema Validation', () => {
  let testBed;

  beforeEach(() => {
    testBed = new TestBedClass();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should pass validation with valid component data', () => {
    const validData = {
      target_id: 'actor:target_123',
      facing_away: false,
    };

    const result = testBed.validateAgainstSchema(
      validData,
      'positioning:straddling_waist'
    );

    expect(result.isValid).toBe(true);
  });

  it('should pass validation with facing_away true', () => {
    const validData = {
      target_id: 'actor:target_456',
      facing_away: true,
    };

    const result = testBed.validateAgainstSchema(
      validData,
      'positioning:straddling_waist'
    );

    expect(result.isValid).toBe(true);
  });

  it('should fail validation when target_id is missing', () => {
    const invalidData = {
      facing_away: false,
    };

    const result = testBed.validateAgainstSchema(
      invalidData,
      'positioning:straddling_waist'
    );

    expect(result.isValid).toBe(false);
    expect(result.errors.some((err) => err.includes('target_id'))).toBe(true);
  });

  it('should fail validation when facing_away is missing', () => {
    const invalidData = {
      target_id: 'actor:target_123',
    };

    const result = testBed.validateAgainstSchema(
      invalidData,
      'positioning:straddling_waist'
    );

    expect(result.isValid).toBe(false);
    expect(result.errors.some((err) => err.includes('facing_away'))).toBe(true);
  });

  it('should fail validation when target_id has invalid format', () => {
    const invalidData = {
      target_id: 'invalid-format',
      facing_away: false,
    };

    const result = testBed.validateAgainstSchema(
      invalidData,
      'positioning:straddling_waist'
    );

    expect(result.isValid).toBe(false);
  });

  it('should fail validation when facing_away is not a boolean', () => {
    const invalidData = {
      target_id: 'actor:target_123',
      facing_away: 'yes',
    };

    const result = testBed.validateAgainstSchema(
      invalidData,
      'positioning:straddling_waist'
    );

    expect(result.isValid).toBe(false);
    expect(
      result.errors.some(
        (err) => err.includes('facing_away') || err.includes('boolean')
      )
    ).toBe(true);
  });

  it('should fail validation with additional properties', () => {
    const invalidData = {
      target_id: 'actor:target_123',
      facing_away: false,
      extra_property: 'not allowed',
    };

    const result = testBed.validateAgainstSchema(
      invalidData,
      'positioning:straddling_waist'
    );

    expect(result.isValid).toBe(false);
  });

  it('should accept special namespaced IDs like "self"', () => {
    const validData = {
      target_id: 'self',
      facing_away: false,
    };

    const result = testBed.validateAgainstSchema(
      validData,
      'positioning:straddling_waist'
    );

    expect(result.isValid).toBe(true);
  });
});
