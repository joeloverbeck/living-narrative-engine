/**
 * @file Unit tests for CascadeAnimator
 * @see src/modManager/animations/CascadeAnimator.js
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { CascadeAnimator } from '../../../../src/modManager/animations/CascadeAnimator.js';

describe('CascadeAnimator', () => {
  let animator;
  let mockLogger;
  let mockCards;
  let getCardElement;

  beforeEach(() => {
    jest.useFakeTimers();

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockCards = new Map();

    // Helper to create mock card elements
    const createMockCard = (modId) => {
      const card = {
        classList: {
          _classes: new Set(),
          add: jest.fn((className) => card.classList._classes.add(className)),
          remove: jest.fn((className) =>
            card.classList._classes.delete(className)
          ),
          contains: jest.fn((className) =>
            card.classList._classes.has(className)
          ),
        },
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      };
      mockCards.set(modId, card);
      return card;
    };

    // Create some mock cards
    createMockCard('primary-mod');
    createMockCard('dep-1');
    createMockCard('dep-2');
    createMockCard('dep-3');
    createMockCard('orphan-1');
    createMockCard('orphan-2');

    getCardElement = jest.fn((modId) => mockCards.get(modId) || null);

    animator = new CascadeAnimator({
      logger: mockLogger,
      staggerDelay: 100,
      animationDuration: 200,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  /**
   * Helper to advance timers and flush microtasks
   * @param {number} ms - milliseconds to advance
   */
  const advanceTimersAndFlush = async (ms) => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve(); // flush microtask queue
  };

  /**
   * Helper to run all pending timers and flush microtasks multiple times
   */
  const runAllTimersAndFlush = async () => {
    for (let i = 0; i < 10; i++) {
      jest.runAllTimers();
      await Promise.resolve();
    }
  };

  describe('constructor', () => {
    it('should use default values when not provided', () => {
      const defaultAnimator = new CascadeAnimator({ logger: mockLogger });
      expect(defaultAnimator.isAnimating()).toBe(false);
    });
  });

  describe('animateActivationCascade', () => {
    it('should animate primary card first', async () => {
      // Start the animation (don't await yet)
      const promise = animator.animateActivationCascade(
        'primary-mod',
        ['dep-1', 'dep-2'],
        getCardElement
      );

      // Primary should be animated immediately (synchronously)
      const primaryCard = mockCards.get('primary-mod');
      expect(primaryCard.classList.add).toHaveBeenCalledWith(
        'mod-card--activate-primary'
      );

      // Fast forward to complete animations
      await runAllTimersAndFlush();
      await promise;
    });

    it('should stagger dependency animations', async () => {
      const addCallOrder = [];

      // Track add calls with timestamps
      mockCards.get('primary-mod').classList.add = jest.fn((className) => {
        addCallOrder.push({ id: 'primary-mod', className });
      });
      mockCards.get('dep-1').classList.add = jest.fn((className) => {
        addCallOrder.push({ id: 'dep-1', className });
      });
      mockCards.get('dep-2').classList.add = jest.fn((className) => {
        addCallOrder.push({ id: 'dep-2', className });
      });

      const promise = animator.animateActivationCascade(
        'primary-mod',
        ['dep-1', 'dep-2'],
        getCardElement
      );

      await runAllTimersAndFlush();
      await promise;

      // Verify order: primary first, then dependencies
      expect(addCallOrder.length).toBeGreaterThanOrEqual(3);
      expect(addCallOrder[0].id).toBe('primary-mod');
      expect(addCallOrder[0].className).toBe('mod-card--activate-primary');

      // Dependencies should come after primary
      const depCalls = addCallOrder.filter(
        (c) => c.className === 'mod-card--activate-dependency'
      );
      expect(depCalls.length).toBe(2);
    });

    it('should handle missing card elements gracefully', async () => {
      const sparseGetCard = jest.fn((modId) => {
        if (modId === 'dep-1') return null; // Missing card
        return mockCards.get(modId) || null;
      });

      const promise = animator.animateActivationCascade(
        'primary-mod',
        ['dep-1', 'dep-2'],
        sparseGetCard
      );

      await runAllTimersAndFlush();
      await promise;

      // Should not throw, and should log debug
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Starting activation cascade animation',
        expect.any(Object)
      );
    });

    it('should log debug messages on start and completion', async () => {
      const promise = animator.animateActivationCascade(
        'primary-mod',
        [],
        getCardElement
      );

      await runAllTimersAndFlush();
      await promise;

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Starting activation cascade animation',
        { primary: 'primary-mod', dependencies: [] }
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Activation cascade animation complete'
      );
    });
  });

  describe('animateDeactivationCascade', () => {
    it('should animate orphans in reverse order', async () => {
      const callOrder = [];

      // Track when each card gets animated
      mockCards.get('orphan-1').classList.add = jest.fn((className) => {
        callOrder.push({ id: 'orphan-1', className });
      });
      mockCards.get('orphan-2').classList.add = jest.fn((className) => {
        callOrder.push({ id: 'orphan-2', className });
      });
      mockCards.get('primary-mod').classList.add = jest.fn((className) => {
        callOrder.push({ id: 'primary-mod', className });
      });

      const promise = animator.animateDeactivationCascade(
        'primary-mod',
        ['orphan-1', 'orphan-2'],
        getCardElement
      );

      await runAllTimersAndFlush();
      await promise;

      // Filter to just the deactivate animations
      const deactivateCalls = callOrder.filter(
        (c) =>
          c.className === 'mod-card--deactivate-orphan' ||
          c.className === 'mod-card--deactivate-primary'
      );

      // orphan-2 should be first (reverse order), then orphan-1, then primary
      expect(deactivateCalls[0].id).toBe('orphan-2');
      expect(deactivateCalls[1].id).toBe('orphan-1');
      expect(deactivateCalls[2].id).toBe('primary-mod');
    });

    it('should animate primary last', async () => {
      const callOrder = [];

      mockCards.get('orphan-1').classList.add = jest.fn((className) => {
        callOrder.push({ id: 'orphan-1', className });
      });
      mockCards.get('primary-mod').classList.add = jest.fn((className) => {
        callOrder.push({ id: 'primary-mod', className });
      });

      const promise = animator.animateDeactivationCascade(
        'primary-mod',
        ['orphan-1'],
        getCardElement
      );

      await runAllTimersAndFlush();
      await promise;

      // Primary should be last
      const lastCall = callOrder[callOrder.length - 1];
      expect(lastCall.id).toBe('primary-mod');
      expect(lastCall.className).toBe('mod-card--deactivate-primary');
    });

    it('should handle empty orphan list', async () => {
      const promise = animator.animateDeactivationCascade(
        'primary-mod',
        [],
        getCardElement
      );

      await runAllTimersAndFlush();
      await promise;

      expect(mockCards.get('primary-mod').classList.add).toHaveBeenCalledWith(
        'mod-card--deactivate-primary'
      );
    });
  });

  describe('highlightDependencyChain', () => {
    it('should add highlight class to all cards in chain', () => {
      animator.highlightDependencyChain(
        'primary-mod',
        ['dep-1', 'dep-2'],
        getCardElement
      );

      expect(mockCards.get('dep-1').classList.add).toHaveBeenCalledWith(
        'mod-card--dependency-highlight'
      );
      expect(mockCards.get('dep-2').classList.add).toHaveBeenCalledWith(
        'mod-card--dependency-highlight'
      );
    });

    it('should handle missing cards gracefully', () => {
      const sparseGetCard = jest.fn((modId) => {
        if (modId === 'dep-1') return null;
        return mockCards.get(modId) || null;
      });

      // Should not throw
      expect(() => {
        animator.highlightDependencyChain(
          'primary-mod',
          ['dep-1', 'dep-2'],
          sparseGetCard
        );
      }).not.toThrow();
    });
  });

  describe('clearDependencyHighlight', () => {
    it('should remove highlight class from all cards', () => {
      animator.clearDependencyHighlight(['dep-1', 'dep-2'], getCardElement);

      expect(mockCards.get('dep-1').classList.remove).toHaveBeenCalledWith(
        'mod-card--dependency-highlight'
      );
      expect(mockCards.get('dep-2').classList.remove).toHaveBeenCalledWith(
        'mod-card--dependency-highlight'
      );
    });

    it('should handle missing cards gracefully', () => {
      const sparseGetCard = jest.fn(() => null);

      expect(() => {
        animator.clearDependencyHighlight(['dep-1', 'dep-2'], sparseGetCard);
      }).not.toThrow();
    });
  });

  describe('isAnimating', () => {
    it('should return false when no animations are running', () => {
      expect(animator.isAnimating()).toBe(false);
    });

    it('should return true during animation', async () => {
      const promise = animator.animateActivationCascade(
        'primary-mod',
        [],
        getCardElement
      );

      // Check immediately after starting - should be animating
      expect(animator.isAnimating()).toBe(true);

      // Complete the animation
      await runAllTimersAndFlush();
      await promise;
    });
  });

  describe('cancelAll', () => {
    it('should clear all active animations', async () => {
      const promise = animator.animateActivationCascade(
        'primary-mod',
        ['dep-1'],
        getCardElement
      );

      expect(animator.isAnimating()).toBe(true);

      animator.cancelAll();

      expect(animator.isAnimating()).toBe(false);

      // Clean up
      await runAllTimersAndFlush();
      await promise;
    });
  });

  describe('animation class cleanup', () => {
    it('should remove animation classes after completion via animationend event', async () => {
      const promise = animator.animateActivationCascade(
        'primary-mod',
        [],
        getCardElement
      );

      const primaryCard = mockCards.get('primary-mod');

      // Find the animationend handler
      const animationEndCall = primaryCard.addEventListener.mock.calls.find(
        (call) => call[0] === 'animationend'
      );

      expect(animationEndCall).toBeDefined();

      // Simulate animationend event
      const handler = animationEndCall[1];
      handler();

      expect(primaryCard.classList.remove).toHaveBeenCalledWith(
        'mod-card--activate-primary'
      );

      await runAllTimersAndFlush();
      await promise;
    });

    it('should remove animation classes after timeout fallback', async () => {
      const promise = animator.animateActivationCascade(
        'primary-mod',
        [],
        getCardElement
      );

      const primaryCard = mockCards.get('primary-mod');

      // Advance past the fallback timeout (animationDuration + 50ms = 250ms)
      await advanceTimersAndFlush(251);

      expect(primaryCard.classList.remove).toHaveBeenCalledWith(
        'mod-card--activate-primary'
      );

      await runAllTimersAndFlush();
      await promise;
    });
  });

  describe('cancel existing animations', () => {
    it('should cancel existing animations when starting new ones', async () => {
      // Start first animation
      const promise1 = animator.animateActivationCascade(
        'primary-mod',
        [],
        getCardElement
      );

      // Start second animation (should cancel first)
      const promise2 = animator.animateActivationCascade(
        'primary-mod',
        [],
        getCardElement
      );

      // Complete both
      await runAllTimersAndFlush();
      await promise1;
      await promise2;

      // Should have added class twice (once per animation start)
      expect(
        mockCards.get('primary-mod').classList.add
      ).toHaveBeenCalledTimes(2);
    });
  });
});
