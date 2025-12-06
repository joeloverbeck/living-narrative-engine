import { describe, it, expect } from '@jest/globals';
import UuidGenerator from '../../../src/adapters/UuidGenerator.js';

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('UuidGenerator', () => {
  it('produces a UUID v4 string using the underlying library', () => {
    const id = UuidGenerator();
    expect(typeof id).toBe('string');
    expect(id).toMatch(UUID_V4_REGEX);
  });

  it('returns a new identifier on each invocation', () => {
    const first = UuidGenerator();
    const second = UuidGenerator();
    expect(first).not.toBe(second);
    expect(first).toMatch(UUID_V4_REGEX);
    expect(second).toMatch(UUID_V4_REGEX);
  });
});
