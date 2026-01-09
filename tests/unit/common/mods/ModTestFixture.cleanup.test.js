/**
 * @file Tests for ModTestFixture cleanup chain robustness
 * @see SCODSLROB-001
 */

import { describe, it, expect, jest } from '@jest/globals';

// We test the cleanup logic by creating a minimal mock scenario
// that simulates the cleanup behavior

describe('ModTestFixture cleanup robustness', () => {
  /**
   * Simulates the cleanup pattern from ModTestFixture
   * to test error handling behavior in isolation.
   *
   * @param root0
   * @param root0.scopeTracerThrows
   * @param root0.testEnvThrows
   */
  function createMockFixture({
    scopeTracerThrows = false,
    testEnvThrows = false,
  } = {}) {
    const errors = [];
    const callOrder = [];

    const mockScopeTracer = {
      clear: jest.fn(() => {
        callOrder.push('scopeTracer.clear');
        if (scopeTracerThrows) {
          throw new Error('scopeTracer.clear failed');
        }
      }),
      disable: jest.fn(() => {
        callOrder.push('scopeTracer.disable');
      }),
    };

    const mockTestEnv = {
      cleanup: jest.fn(() => {
        callOrder.push('testEnv.cleanup');
        if (testEnvThrows) {
          throw new Error('testEnv.cleanup failed');
        }
      }),
    };

    // Mock console.error for test verification
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Simulate the cleanup function pattern from ModTestFixture
    /**
     *
     */
    function cleanup() {
      // disableDiagnostics() equivalent (assumed not to throw)
      callOrder.push('disableDiagnostics');

      try {
        if (mockScopeTracer) {
          mockScopeTracer.clear();
          mockScopeTracer.disable();
        }
      } catch (err) {
        errors.push({ step: 'scopeTracer.clear', error: err });
      }

      try {
        if (mockTestEnv) {
          mockTestEnv.cleanup();
        }
      } catch (err) {
        errors.push({ step: 'testEnv.cleanup', error: err });
      }

      // Report aggregated errors
      if (errors.length > 0) {
        const message = errors
          .map((e) => `${e.step}: ${e.error.message}`)
          .join('\n');
        console.error(
          `Cleanup encountered ${errors.length} error(s):\n${message}`
        );
      }
    }

    return {
      cleanup,
      mockScopeTracer,
      mockTestEnv,
      callOrder,
      errors,
      consoleErrorSpy,
      restore: () => consoleErrorSpy.mockRestore(),
    };
  }

  describe('error resilience', () => {
    it('should continue cleanup when scopeTracer.clear throws', () => {
      const fixture = createMockFixture({ scopeTracerThrows: true });

      // Should not throw
      expect(() => fixture.cleanup()).not.toThrow();

      // testEnv.cleanup should still be called
      expect(fixture.mockTestEnv.cleanup).toHaveBeenCalled();

      // Error should be captured
      expect(fixture.errors).toHaveLength(1);
      expect(fixture.errors[0].step).toBe('scopeTracer.clear');
      expect(fixture.errors[0].error.message).toBe('scopeTracer.clear failed');

      fixture.restore();
    });

    it('should continue cleanup when testEnv.cleanup throws', () => {
      const fixture = createMockFixture({ testEnvThrows: true });

      // Should not throw
      expect(() => fixture.cleanup()).not.toThrow();

      // scopeTracer operations should have completed
      expect(fixture.mockScopeTracer.clear).toHaveBeenCalled();
      expect(fixture.mockScopeTracer.disable).toHaveBeenCalled();

      // Error should be captured
      expect(fixture.errors).toHaveLength(1);
      expect(fixture.errors[0].step).toBe('testEnv.cleanup');
      expect(fixture.errors[0].error.message).toBe('testEnv.cleanup failed');

      fixture.restore();
    });

    it('should report aggregated errors', () => {
      const fixture = createMockFixture({
        scopeTracerThrows: true,
        testEnvThrows: true,
      });

      fixture.cleanup();

      // Both errors should be captured
      expect(fixture.errors).toHaveLength(2);

      // Error message should be logged
      expect(fixture.consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cleanup encountered 2 error(s)')
      );
      expect(fixture.consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('scopeTracer.clear: scopeTracer.clear failed')
      );
      expect(fixture.consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('testEnv.cleanup: testEnv.cleanup failed')
      );

      fixture.restore();
    });

    it('should maintain correct call order even with errors', () => {
      const fixture = createMockFixture({
        scopeTracerThrows: true,
        testEnvThrows: true,
      });

      fixture.cleanup();

      // Verify order: disableDiagnostics -> scopeTracer.clear (throws) -> testEnv.cleanup (throws)
      expect(fixture.callOrder).toEqual([
        'disableDiagnostics',
        'scopeTracer.clear',
        // scopeTracer.disable is skipped because clear threw
        'testEnv.cleanup',
      ]);

      fixture.restore();
    });

    it('should not log errors when cleanup succeeds', () => {
      const fixture = createMockFixture();

      fixture.cleanup();

      expect(fixture.errors).toHaveLength(0);
      expect(fixture.consoleErrorSpy).not.toHaveBeenCalled();

      fixture.restore();
    });
  });

  describe('invariants', () => {
    it('INV-CLEAN-1: all cleanup steps execute regardless of previous step failures', () => {
      const fixture = createMockFixture({ scopeTracerThrows: true });

      fixture.cleanup();

      // Despite scopeTracer failing, testEnv.cleanup should be called
      expect(fixture.mockTestEnv.cleanup).toHaveBeenCalled();

      fixture.restore();
    });
  });
});
