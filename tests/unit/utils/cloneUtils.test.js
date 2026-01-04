import { deepClone, freezeMap } from '../../../src/utils/cloneUtils.js';
import { describe, it, expect, jest } from '@jest/globals';

describe('deepClone', () => {
  it('creates an independent copy of nested objects', () => {
    const obj = { a: { b: { c: 1 } } };
    const clone = deepClone(obj);
    expect(clone).toEqual(obj);
    expect(clone).not.toBe(obj);
    clone.a.b.c = 2;
    expect(obj.a.b.c).toBe(1);
  });

  it('clones arrays within objects', () => {
    const obj = { list: [1, { v: 2 }] };
    const clone = deepClone(obj);
    expect(clone).toEqual(obj);
    expect(clone.list).not.toBe(obj.list);
    clone.list[1].v = 99;
    expect(obj.list[1].v).toBe(2);
  });

  it('uses structuredClone when available', () => {
    const original = global.structuredClone;
    const spy = jest.fn((v) => ({ ...v }));
    global.structuredClone = spy;

    const obj = { x: 1 };
    const clone = deepClone(obj);

    expect(spy).toHaveBeenCalledWith(obj);
    expect(clone).toEqual(obj);
    expect(clone).not.toBe(obj);

    global.structuredClone = original;
  });

  it('falls back to JSON methods when structuredClone is absent', () => {
    const original = global.structuredClone;

    global.structuredClone = undefined;

    const obj = { a: { b: 3 } };
    const clone = deepClone(obj);

    expect(clone).toEqual(obj);
    expect(clone).not.toBe(obj);

    global.structuredClone = original;
  });

  it('drops function properties when JSON fallback is used', () => {
    const original = global.structuredClone;
    global.structuredClone = undefined;

    const obj = { a: 1, fn: () => 2 };
    const clone = deepClone(obj);

    expect(clone).toEqual({ a: 1 });

    global.structuredClone = original;
  });

  it('throws on circular structures', () => {
    const obj = {};
    obj.self = obj;
    expect(() => deepClone(obj)).toThrow();
  });

  // ENTIDAPI-004: Document undefined value handling behavior
  describe('undefined value handling', () => {
    it('should strip undefined values when JSON fallback is used', () => {
      const original = global.structuredClone;
      global.structuredClone = undefined;

      const source = { a: 1, b: undefined, c: 2 };
      const cloned = deepClone(source);

      // JSON serialization strips undefined values - this is documented behavior
      expect(cloned).toEqual({ a: 1, c: 2 });
      expect(Object.keys(cloned).length).toBe(2);
      expect('b' in cloned).toBe(false);

      global.structuredClone = original;
    });

    it('should preserve undefined values when native structuredClone is used', () => {
      // Test with a mock that mimics real structuredClone behavior
      const original = global.structuredClone;
      // Create a mock that preserves undefined like real structuredClone does
      global.structuredClone = (obj) => {
        // Real structuredClone preserves undefined - simulate with JSON but add undefined back
        const result = {};
        for (const key of Object.keys(obj)) {
          result[key] = obj[key];
        }
        return result;
      };

      const source = { a: 1, b: undefined, c: 2 };
      const cloned = deepClone(source);

      // When structuredClone is available, undefined values are preserved
      expect('b' in cloned).toBe(true);
      expect(cloned.b).toBeUndefined();
      expect(Object.keys(cloned).length).toBe(3);

      global.structuredClone = original;
    });

    it('should document property count difference when undefined values are stripped', () => {
      const original = global.structuredClone;
      global.structuredClone = undefined;

      const source = { a: 1, b: undefined, c: undefined, d: 2 };
      const cloned = deepClone(source);

      // This demonstrates the data loss scenario described in ENTIDAPI-001
      const sourceKeys = Object.keys(source).length;
      const clonedKeys = Object.keys(cloned).length;

      expect(sourceKeys).toBe(4);
      expect(clonedKeys).toBe(2);
      expect(sourceKeys).not.toBe(clonedKeys); // Data loss occurred

      global.structuredClone = original;
    });

    it('should strip nested undefined values in JSON fallback', () => {
      const original = global.structuredClone;
      global.structuredClone = undefined;

      // This mimics the equipment component scenario from the bug
      const source = {
        equipped: {
          torso: { base: 'shirt_id', accessories: undefined },
          legs: { base: undefined },
        },
      };
      const cloned = deepClone(source);

      // Nested undefined values are stripped
      expect(cloned.equipped.torso).toEqual({ base: 'shirt_id' });
      expect('accessories' in cloned.equipped.torso).toBe(false);
      expect(cloned.equipped.legs).toEqual({});

      global.structuredClone = original;
    });

    it('should preserve string IDs correctly (common createEntity pattern)', () => {
      const original = global.structuredClone;
      global.structuredClone = undefined;

      // This is the CORRECT pattern: using string IDs directly
      const beltId = 'belt_entity_id'; // fixture.createEntity returns string
      const pantsId = 'pants_entity_id';

      const source = {
        equipped: {
          torso_lower: { accessories: beltId },
          legs: { base: pantsId },
        },
      };
      const cloned = deepClone(source);

      // String IDs are preserved correctly
      expect(cloned.equipped.torso_lower.accessories).toBe('belt_entity_id');
      expect(cloned.equipped.legs.base).toBe('pants_entity_id');

      global.structuredClone = original;
    });
  });
});

describe('freezeMap', () => {
  it('returns a readonly map that preserves all map properties', () => {
    const map = new Map([
      ['key1', { value: 'data1' }],
      ['key2', { value: 'data2' }],
    ]);
    const frozen = freezeMap(map);

    // Should access size without error
    expect(frozen.size).toBe(2);

    // Should access has() without error
    expect(frozen.has('key1')).toBe(true);
    expect(frozen.has('key3')).toBe(false);

    // Should access get() without error
    expect(frozen.get('key1')).toEqual({ value: 'data1' });
    expect(frozen.get('key2')).toEqual({ value: 'data2' });
  });

  it('allows iteration over keys, values, and entries', () => {
    const map = new Map([
      ['a', 1],
      ['b', 2],
    ]);
    const frozen = freezeMap(map);

    // Test keys()
    const keys = Array.from(frozen.keys());
    expect(keys).toEqual(['a', 'b']);

    // Test values()
    const values = Array.from(frozen.values());
    expect(values).toEqual([1, 2]);

    // Test entries()
    const entries = Array.from(frozen.entries());
    expect(entries).toEqual([
      ['a', 1],
      ['b', 2],
    ]);

    // Test forEach
    const collected = [];
    frozen.forEach((value, key) => collected.push([key, value]));
    expect(collected).toEqual([
      ['a', 1],
      ['b', 2],
    ]);
  });

  it('prevents modification via set()', () => {
    const map = new Map([['key', 'value']]);
    const frozen = freezeMap(map);

    expect(() => frozen.set('newKey', 'newValue')).toThrow(
      'Cannot modify frozen map'
    );
  });

  it('prevents modification via delete()', () => {
    const map = new Map([['key', 'value']]);
    const frozen = freezeMap(map);

    expect(() => frozen.delete('key')).toThrow('Cannot modify frozen map');
  });

  it('prevents modification via clear()', () => {
    const map = new Map([['key', 'value']]);
    const frozen = freezeMap(map);

    expect(() => frozen.clear()).toThrow('Cannot modify frozen map');
  });

  it('deeply freezes values stored in the map', () => {
    const map = new Map([['key', { nested: { value: 1 } }]]);
    const frozen = freezeMap(map);

    const value = frozen.get('key');
    expect(() => {
      value.nested.value = 2;
    }).toThrow();
    expect(() => {
      value.newProp = 'test';
    }).toThrow();
  });

  it('works with for...of iteration', () => {
    const map = new Map([
      ['x', 10],
      ['y', 20],
    ]);
    const frozen = freezeMap(map);

    const entries = [];
    for (const [key, value] of frozen) {
      entries.push([key, value]);
    }

    expect(entries).toEqual([
      ['x', 10],
      ['y', 20],
    ]);
  });

  it('preserves Map.prototype methods', () => {
    const map = new Map([['test', 'value']]);
    const frozen = freezeMap(map);

    // Verify it's still a Map
    expect(frozen instanceof Map).toBe(true);

    // Verify toString works
    expect(frozen.toString()).toBe('[object Map]');
  });
});
