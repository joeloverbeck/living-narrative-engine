import { describe, it, expect } from '@jest/globals';
import { __private__ } from '../../../../src/turns/services/actionIndexingService.js';

const {
  stableSerializeForKey,
  createActionKey,
  formatParamsForLog,
  freezeClonedSet,
  cloneAndFreezeValue,
  truncateActions,
} = __private__;

describe('ActionIndexingService internals', () => {
  describe('stableSerializeForKey', () => {
    it('serializes primitives and special numeric cases', () => {
      expect(stableSerializeForKey(undefined)).toBe('undefined');
      expect(stableSerializeForKey(-0)).toBe('-0');
      expect(stableSerializeForKey(true)).toBe('true');
      expect(stableSerializeForKey('command')).toBe('"command"');
    });

    it('serializes symbols and functions with stable identifiers', () => {
      const named = function namedExample() {};
      const anonymous = () => {};
      const symbol = Symbol('mystery');

      expect(stableSerializeForKey(symbol)).toBe('Symbol(mystery)');
      expect(stableSerializeForKey(named)).toBe('[Function:namedExample]');
      expect(stableSerializeForKey(anonymous)).toBe('[Function:anonymous]');
    });

    it('serializes dates, including invalid instances', () => {
      const valid = new Date('2024-05-24T10:15:00.000Z');
      const invalid = new Date('not-a-date');

      expect(stableSerializeForKey(valid)).toBe('Date(2024-05-24T10:15:00.000Z)');
      expect(stableSerializeForKey(invalid)).toBe('Date(Invalid)');
    });

    it('handles circular structures for arrays, maps, sets, and objects', () => {
      const circularArray = [];
      circularArray.push(circularArray);

      const circularMap = new Map();
      circularMap.set('self', circularMap);
      circularMap.set('value', 2);

      const circularSet = new Set();
      circularSet.add('beta');
      circularSet.add(circularSet);
      circularSet.add('alpha');

      const circularObject = {};
      circularObject.self = circularObject;

      expect(stableSerializeForKey(circularArray)).toBe('[[Circular]]');
      expect(stableSerializeForKey(circularMap)).toBe(
        'Map{"self"=>[Circular],"value"=>2}'
      );
      expect(stableSerializeForKey(circularSet)).toBe(
        'Set{"alpha","beta",[Circular]}'
      );
      expect(stableSerializeForKey(circularObject)).toBe(
        '{"self":[Circular]}'
      );
    });

    it('produces deterministic keys for objects with undefined members', () => {
      const key = createActionKey('act', { maybe: undefined }, null);
      expect(key).toBe('act:{"maybe":undefined}:""');
    });
  });

  describe('formatParamsForLog', () => {
    it('returns fallback marker when serialization throws', () => {
      const tricky = {};
      Object.defineProperty(tricky, 'value', {
        enumerable: true,
        get() {
          throw new Error('boom');
        },
      });

      expect(formatParamsForLog(tricky)).toBe('[Unserializable params]');
    });
  });

  describe('freezeClonedSet', () => {
    it('clones entries, deep freezes them, and blocks mutations', () => {
      const nested = { data: { value: 1 } };
      const original = new Set([nested]);

      const frozen = freezeClonedSet(original);
      const [clonedEntry] = Array.from(frozen);

      expect(clonedEntry).not.toBe(nested);
      expect(Object.isFrozen(clonedEntry)).toBe(true);
      expect(Object.isFrozen(clonedEntry.data)).toBe(true);

      const has = frozen.has;
      expect(has(clonedEntry)).toBe(true);
      expect(() => frozen.add('x')).toThrow('Cannot modify frozen set');
      expect(() => frozen.delete(clonedEntry)).toThrow(
        'Cannot modify frozen set'
      );
      expect(() => frozen.clear()).toThrow('Cannot modify frozen set');
    });
  });

  describe('cloneAndFreezeValue', () => {
    it('clones and freezes regular expressions', () => {
      const regex = /hello/gi;
      const cloned = cloneAndFreezeValue(regex);

      expect(cloned).not.toBe(regex);
      expect(cloned.source).toBe(regex.source);
      expect(cloned.flags).toBe(regex.flags);
      expect(Object.isFrozen(cloned)).toBe(true);
    });

    it('clones sets via freezeClonedSet helper', () => {
      const source = new Set([1, 2, 3]);
      const cloned = cloneAndFreezeValue(source);

      expect(cloned).not.toBe(source);
      expect(Array.from(cloned)).toEqual([1, 2, 3]);
      expect(() => cloned.add(4)).toThrow('Cannot modify frozen set');
    });

    it('deeply freezes arrays and their nested entries', () => {
      const source = [
        { nested: { value: 1 } },
        ['alpha', 'beta'],
      ];
      const cloned = cloneAndFreezeValue(source);

      expect(cloned).not.toBe(source);
      expect(cloned).toEqual([
        { nested: { value: 1 } },
        ['alpha', 'beta'],
      ]);
      expect(Object.isFrozen(cloned)).toBe(true);
      expect(Object.isFrozen(cloned[0])).toBe(true);
      expect(Object.isFrozen(cloned[0].nested)).toBe(true);
      expect(Object.isFrozen(cloned[1])).toBe(true);
      expect(() => {
        cloned[0].nested.value = 42;
      }).toThrow(TypeError);
      expect(() => {
        cloned[1][0] = 'gamma';
      }).toThrow(TypeError);
    });
  });

  describe('truncateActions', () => {
    it('returns original array when under the maximum threshold', () => {
      const sample = [{ actionId: 'a' }];
      const result = truncateActions(sample);

      expect(result).toEqual({ truncatedArr: sample, truncatedCount: 0 });
    });
  });
});
