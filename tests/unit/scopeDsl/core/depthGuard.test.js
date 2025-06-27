import createDepthGuard from '../../../../src/scopeDsl/core/depthGuard.js';
import ScopeDepthError from '../../../../src/errors/scopeDepthError.js';

describe('depthGuard', () => {
  describe('ensure', () => {
    it('does not throw when level is less than max', () => {
      const guard = createDepthGuard(4);

      expect(() => guard.ensure(0)).not.toThrow();
      expect(() => guard.ensure(1)).not.toThrow();
      expect(() => guard.ensure(3)).not.toThrow();
    });

    it('does not throw when level equals max', () => {
      const guard = createDepthGuard(4);

      expect(() => guard.ensure(4)).not.toThrow();
    });

    it('throws ScopeDepthError when level exceeds max', () => {
      const guard = createDepthGuard(4);

      expect(() => guard.ensure(5)).toThrow(ScopeDepthError);
    });

    it('throws error with correct message and properties', () => {
      const guard = createDepthGuard(4);

      try {
        guard.ensure(5);
        fail('Expected ScopeDepthError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ScopeDepthError);
        expect(error.message).toBe('Depth 5 exceeds 4');
        expect(error.depth).toBe(5);
        expect(error.maxDepth).toBe(4);
      }
    });

    it('works with different max depth values', () => {
      const guard1 = createDepthGuard(1);
      expect(() => guard1.ensure(1)).not.toThrow();
      expect(() => guard1.ensure(2)).toThrow(ScopeDepthError);

      const guard10 = createDepthGuard(10);
      expect(() => guard10.ensure(10)).not.toThrow();
      expect(() => guard10.ensure(11)).toThrow(ScopeDepthError);
    });

    it('handles edge case of max depth 0', () => {
      const guard = createDepthGuard(0);
      expect(() => guard.ensure(0)).not.toThrow();
      expect(() => guard.ensure(1)).toThrow(ScopeDepthError);
    });
  });
});
