import createCycleDetector from '../../src/scopeDsl/core/cycleDetector.js';
import ScopeCycleError from '../../src/errors/scopeCycleError.js';

describe('createCycleDetector', () => {
  let detector;

  beforeEach(() => {
    detector = createCycleDetector();
  });

  describe('enter()', () => {
    it('should allow entering unique keys without throwing', () => {
      expect(() => {
        detector.enter('scope1');
        detector.enter('scope2');
        detector.enter('scope3');
      }).not.toThrow();
    });

    it('should throw ScopeCycleError when entering a key that already exists in the stack', () => {
      detector.enter('scope1');
      detector.enter('scope2');

      expect(() => {
        detector.enter('scope1');
      }).toThrow(ScopeCycleError);
    });

    it('should include the full cycle path in the error message', () => {
      detector.enter('scope1');
      detector.enter('scope2');
      detector.enter('scope3');

      try {
        detector.enter('scope2');
        fail('Should have thrown ScopeCycleError');
      } catch (error) {
        expect(error).toBeInstanceOf(ScopeCycleError);
        expect(error.message).toBe(
          'Cycle: scope1 -> scope2 -> scope3 -> scope2'
        );
        expect(error.cyclePath).toEqual([
          'scope1',
          'scope2',
          'scope3',
          'scope2',
        ]);
      }
    });

    it('should detect self-referencing cycles', () => {
      detector.enter('scope1');

      expect(() => {
        detector.enter('scope1');
      }).toThrow(ScopeCycleError);
    });
  });

  describe('leave()', () => {
    it('should pop the last entered key from the stack', () => {
      detector.enter('scope1');
      detector.enter('scope2');
      detector.leave();

      // Should be able to enter scope2 again after leaving
      expect(() => {
        detector.enter('scope2');
      }).not.toThrow();
    });

    it('should handle multiple leave calls correctly', () => {
      detector.enter('scope1');
      detector.enter('scope2');
      detector.enter('scope3');

      detector.leave(); // removes scope3
      detector.leave(); // removes scope2

      // Should be able to enter scope2 and scope3 again
      expect(() => {
        detector.enter('scope2');
        detector.enter('scope3');
      }).not.toThrow();
    });

    it('should allow re-entering a key after full traversal', () => {
      detector.enter('scope1');
      detector.enter('scope2');
      detector.leave();
      detector.leave();

      // Stack is now empty, should be able to enter scope1 again
      expect(() => {
        detector.enter('scope1');
      }).not.toThrow();
    });
  });

  describe('complex scenarios', () => {
    it('should handle interleaved enter/leave operations', () => {
      detector.enter('A');
      detector.enter('B');
      detector.leave(); // pop B
      detector.enter('C');
      detector.enter('D');
      detector.leave(); // pop D

      // Stack is now [A, C]
      expect(() => detector.enter('A')).toThrow(ScopeCycleError);
      expect(() => detector.enter('C')).toThrow(ScopeCycleError);
      expect(() => detector.enter('B')).not.toThrow();
    });

    it('should maintain correct state after catching cycle errors', () => {
      detector.enter('scope1');
      detector.enter('scope2');

      try {
        detector.enter('scope1');
      } catch (error) {
        // Ignore the error
      }

      // Stack should still be [scope1, scope2]
      expect(() => detector.enter('scope3')).not.toThrow();
      expect(() => detector.enter('scope1')).toThrow(ScopeCycleError);
    });
  });
});
