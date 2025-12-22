import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TestBedClass } from '../../../../common/entities/testBed.js';

describe('breaching:breached component schema', () => {
  let testBed;

  beforeEach(() => {
    testBed = new TestBedClass();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  const validate = (data) =>
    testBed.validateAgainstSchema(data, 'breaching:breached');

  it('accepts an empty object', () => {
    const result = validate({});
    expect(result.isValid).toBe(true);
  });

  it('rejects additional properties', () => {
    const result = validate({ extra: true });
    expect(result.isValid).toBe(false);
  });
});
