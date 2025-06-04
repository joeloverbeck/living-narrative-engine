/* ------------------------------------------------------------------
 * src/tests/utils/resolvePath.test.js
 * ------------------------------------------------------------------ */

import { describe, it, expect } from '@jest/globals';
import resolvePath from '../../src/utils/resolvePath.js'; // <— adjust only if you move files

describe('utils/resolvePath', () => {
  /* -------------------------------------------------
   *  Happy-path look-ups
   * ------------------------------------------------- */
  describe('happy path (nested hit)', () => {
    it('returns the deeply nested value when every segment exists', () => {
      const obj = {
        components: { health: { current: 42 } },
      };
      expect(resolvePath(obj, 'components.health.current')).toBe(42);
    });

    it('works with a single-segment path', () => {
      const obj = { answer: 42 };
      expect(resolvePath(obj, 'answer')).toBe(42);
    });

    it('handles leading/trailing whitespace in dotPath', () => {
      const obj = { foo: { bar: 'baz' } };
      expect(resolvePath(obj, '  foo.bar  ')).toBe('baz');
    });
  });

  /* -------------------------------------------------
   *  Early bail-outs on null / undefined hops
   * ------------------------------------------------- */
  describe('early undefined', () => {
    it('returns undefined when the root itself is null', () => {
      expect(resolvePath(null, 'a.b')).toBeUndefined();
    });

    it('returns undefined when the root itself is undefined', () => {
      expect(resolvePath(undefined, 'a.b')).toBeUndefined();
    });

    it('returns undefined when an intermediate segment is undefined', () => {
      const obj = { a: undefined };
      expect(resolvePath(obj, 'a.b.c')).toBeUndefined();
    });

    it('returns undefined when an intermediate segment is null', () => {
      const obj = { a: { b: null } };
      expect(resolvePath(obj, 'a.b.c')).toBeUndefined();
    });
  });

  /* -------------------------------------------------
   *  Non-existent leaves
   * ------------------------------------------------- */
  describe('non-existent leaf', () => {
    it('returns undefined when the final segment is missing', () => {
      const obj = { a: { b: {} } };
      expect(resolvePath(obj, 'a.b.c')).toBeUndefined();
    });

    it('returns undefined when nothing matches at all', () => {
      const obj = { x: 1 };
      expect(resolvePath(obj, 'completely.missing.path')).toBeUndefined();
    });
  });

  /* -------------------------------------------------
   *  Root is a primitive
   * ------------------------------------------------- */
  describe('root is primitive', () => {
    it.each([
      ['a string', 'foo'],
      ['a number', 123],
      ['a boolean', true],
    ])('returns undefined when root is %s', (_, primitive) => {
      expect(resolvePath(primitive, 'does.not.matter')).toBeUndefined();
    });
  });

  /* -------------------------------------------------
   *  Invalid dotPath parameter
   * ------------------------------------------------- */
  describe('bad path param', () => {
    it.each([[null], [undefined], [42], [{}], [''], ['   ']])(
      'throws TypeError when dotPath is %p',
      (badPath) => {
        expect(() => resolvePath({}, badPath)).toThrow(TypeError);
      }
    );
  });

  /* -------------------------------------------------
   *  Purity (no mutation) check
   * ------------------------------------------------- */
  describe('function purity', () => {
    it('does not mutate the original object', () => {
      const obj = { a: { b: 1 } };
      Object.freeze(obj);
      Object.freeze(obj.a);

      // Should not throw—any mutation would violate the freeze
      expect(() => resolvePath(obj, 'a.b')).not.toThrow();
      // And the object structure remains intact
      expect(obj).toEqual({ a: { b: 1 } });
    });
  });
});
