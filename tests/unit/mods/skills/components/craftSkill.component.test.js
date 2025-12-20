import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TestBedClass } from '../../../../common/entities/testBed.js';

describe('skills:craft_skill component schema', () => {
  let testBed;

  beforeEach(() => {
    testBed = new TestBedClass();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  const validate = (data) =>
    testBed.validateAgainstSchema(data, 'skills:craft_skill');

  it('accepts values within range', () => {
    const result = validate({ value: 50 });
    expect(result.isValid).toBe(true);
  });

  it('accepts the lowest bound', () => {
    const result = validate({ value: 0 });
    expect(result.isValid).toBe(true);
  });

  it('accepts the highest bound', () => {
    const result = validate({ value: 100 });
    expect(result.isValid).toBe(true);
  });

  it('rejects values below 0', () => {
    const result = validate({ value: -1 });
    expect(result.isValid).toBe(false);
  });

  it('rejects values above 100', () => {
    const result = validate({ value: 101 });
    expect(result.isValid).toBe(false);
  });

  it('rejects missing value', () => {
    const result = validate({});
    expect(result.isValid).toBe(false);
  });

  it('rejects additional properties', () => {
    const result = validate({ value: 10, bonus: 5 });
    expect(result.isValid).toBe(false);
  });
});
