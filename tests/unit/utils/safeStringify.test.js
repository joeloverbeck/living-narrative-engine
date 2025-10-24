import { describe, expect, test } from '@jest/globals';
import { safeStringify } from '../../../src/utils/safeStringify.js';

describe('safeStringify', () => {
  test('serializes non-circular data the same as JSON.stringify', () => {
    const payload = {
      id: 42,
      label: 'example',
      nested: { value: [1, 2, 3], flag: true },
    };

    const result = safeStringify(payload);

    expect(result).toBe(JSON.stringify(payload));
  });

  test('replaces circular references with a placeholder', () => {
    const person = { name: 'Ada' };
    person.self = person;

    const result = safeStringify(person);

    expect(JSON.parse(result)).toEqual({
      name: 'Ada',
      self: '[Circular]',
    });
  });

  test('marks repeated references as circular after the first occurrence', () => {
    const shared = { feature: 'shared' };
    const container = { first: shared, second: shared };

    const result = safeStringify(container);

    expect(JSON.parse(result)).toEqual({
      first: { feature: 'shared' },
      second: '[Circular]',
    });
  });

  test('handles primitive values without modification', () => {
    expect(safeStringify('plain string')).toBe('"plain string"');
    expect(safeStringify(123)).toBe('123');
    expect(safeStringify(null)).toBe('null');
  });

  test('converts bigint values to strings to avoid serialization errors', () => {
    const payload = { count: 123n, nested: { depth: 456n } };

    const parsed = JSON.parse(safeStringify(payload));

    expect(parsed).toEqual({ count: '123', nested: { depth: '456' } });
    expect(safeStringify(789n)).toBe('"789"');
  });
});
