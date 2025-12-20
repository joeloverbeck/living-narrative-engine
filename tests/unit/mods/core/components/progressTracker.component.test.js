import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TestBedClass } from '../../../../common/entities/testBed.js';

describe('core:progress_tracker component schema', () => {
  let testBed;

  beforeEach(() => {
    testBed = new TestBedClass();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  const validate = (data) =>
    testBed.validateAgainstSchema(data, 'core:progress_tracker');

  it('accepts value 0', () => {
    const result = validate({ value: 0 });
    expect(result.isValid).toBe(true);
  });

  it('accepts positive values', () => {
    const result = validate({ value: 100 });
    expect(result.isValid).toBe(true);
  });

  it('accepts large values', () => {
    const result = validate({ value: 1000000 });
    expect(result.isValid).toBe(true);
  });

  it('rejects negative values', () => {
    const result = validate({ value: -1 });
    expect(result.isValid).toBe(false);
  });

  it('rejects non-integer values', () => {
    const result = validate({ value: 1.5 });
    expect(result.isValid).toBe(false);
  });

  it('rejects missing value', () => {
    const result = validate({});
    expect(result.isValid).toBe(false);
  });

  it('rejects additional properties', () => {
    const result = validate({ value: 1, extra: true });
    expect(result.isValid).toBe(false);
  });
});
