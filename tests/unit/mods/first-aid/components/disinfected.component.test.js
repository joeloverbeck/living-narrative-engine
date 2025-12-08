import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TestBedClass } from '../../../../common/entities/testBed.js';

describe('first-aid:disinfected component schema', () => {
  let testBed;

  beforeEach(() => {
    testBed = new TestBedClass();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  const validate = (data) =>
    testBed.validateAgainstSchema(data, 'first-aid:disinfected');

  it('accepts minimal required data', () => {
    const result = validate({
      appliedById: 'actors:medic',
      sourceItemId: 'items:antiseptic_bottle',
    });
    expect(result.isValid).toBe(true);
  });

  it('rejects missing required fields', () => {
    const result = validate({
      sourceItemId: 'items:antiseptic_bottle',
    });
    expect(result.isValid).toBe(false);
  });

  it('rejects empty identifiers', () => {
    const result = validate({
      appliedById: '',
      sourceItemId: 'items:antiseptic_bottle',
    });
    expect(result.isValid).toBe(false);
  });

  it('rejects additional properties', () => {
    const result = validate({
      appliedById: 'actors:medic',
      sourceItemId: 'items:antiseptic_bottle',
      extra: true,
    });
    expect(result.isValid).toBe(false);
  });
});
