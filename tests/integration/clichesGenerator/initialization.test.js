/**
 * @file Integration tests for ClichesGeneratorController initialization issues
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ClichesGeneratorControllerTestBed } from '../../common/clichesGeneratorControllerTestBed.js';

describe('ClichesGeneratorController - Initialization Issues', () => {
  let controller;
  let testBed;

  const stringifyCall = (call) =>
    call
      .map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg)))
      .join(' ');

  const findWarning = (text) => {
    const warnCalls = testBed?.logger?.warn?.mock?.calls || [];
    return warnCalls.find((call) => stringifyCall(call).includes(text));
  };

  beforeEach(async () => {
    testBed = new ClichesGeneratorControllerTestBed();
    await testBed.setup();
    controller = testBed.controller;
  });

  afterEach(async () => {
    if (testBed) {
      await testBed.cleanup();
    }
    controller = null;
    testBed = null;
  });

  describe('UIStateManager Initialization Timing - Fixed', () => {
    it('should NOT have UIStateManager not initialized warning after fix', async () => {
      expect(findWarning('UIStateManager not initialized')).toBeUndefined();
    });

    it('should NOT have invalid idle state warning after fix', async () => {
      expect(findWarning("Invalid state 'idle'")).toBeUndefined();
    });

    it('should show that loading overlay remains visible after initialization', async () => {
      // Check if loading state is still visible (it shouldn't be)
      const loadingState = document.getElementById('loading-state');
      const emptyState = document.getElementById('empty-state');

      // The bug would cause loading state to remain visible or no proper state to be shown
      // After fixing, empty state should be visible
      expect(loadingState.style.display).toBe('none');

      // Due to the UIStateManager not being initialized properly,
      // the empty state might not be properly shown
      // This test will fail initially and pass after the fix
    });

    it('should properly show states with UIStateManager initialized', async () => {
      controller._showState('results');
      expect(testBed.getCurrentUIState()).toBe('results');

      controller._showState('empty');
      expect(testBed.getCurrentUIState()).toBe('empty');

      expect(findWarning('UIStateManager not initialized')).toBeUndefined();
    });
  });

  describe('State Management After Fix', () => {
    it('should properly initialize UIStateManager before showing states', async () => {
      expect(findWarning('UIStateManager not initialized')).toBeUndefined();

      // Empty state should be properly shown
      const emptyState = document.getElementById('empty-state');
      const loadingState = document.getElementById('loading-state');

      // After fix, empty state should be visible and loading state hidden
      expect(emptyState.style.display).toBe('flex');
      expect(loadingState.style.display).toBe('none');
    });

    it('should use valid states only (not idle)', async () => {
      const idleStateWarnings =
        testBed.logger.warn.mock.calls.filter((call) =>
          stringifyCall(call).includes("Invalid state 'idle'")
        );

      expect(idleStateWarnings.length).toBe(0);
    });
  });
});
