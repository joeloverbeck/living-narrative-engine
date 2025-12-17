/**
 * @file Unit tests for ConflictShakeAnimator
 * @see src/modManager/animations/ConflictShakeAnimator.js
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ConflictShakeAnimator } from '../../../../src/modManager/animations/ConflictShakeAnimator.js';

describe('ConflictShakeAnimator', () => {
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
        querySelector: jest.fn((selector) => {
          // Return mock elements based on selector
          if (selector === '.mod-card__conflict-badge') {
            return card._badge || null;
          }
          if (selector === '.mod-card__header') {
            return card._header || { appendChild: jest.fn() };
          }
          return null;
        }),
        _badge: null,
        _header: { appendChild: jest.fn() },
      };
      mockCards.set(modId, card);
      return card;
    };

    // Create some mock cards
    createMockCard('attempted-mod');
    createMockCard('conflict-1');
    createMockCard('conflict-2');
    createMockCard('conflict-3');

    getCardElement = jest.fn((modId) => mockCards.get(modId) || null);

    animator = new ConflictShakeAnimator({
      logger: mockLogger,
      shakeDuration: 400,
      conflictHighlightDuration: 2000,
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
    await Promise.resolve();
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
      const defaultAnimator = new ConflictShakeAnimator({ logger: mockLogger });
      expect(defaultAnimator.hasActiveHighlights()).toBe(false);
    });
  });

  describe('shakeCard', () => {
    it('should add shake class to card', async () => {
      const card = mockCards.get('attempted-mod');

      const promise = animator.shakeCard(card, 'attempted-mod');

      expect(card.classList.add).toHaveBeenCalledWith('mod-card--shake');

      await runAllTimersAndFlush();
      await promise;
    });

    it('should remove shake class after animation via animationend event', async () => {
      const card = mockCards.get('attempted-mod');

      const promise = animator.shakeCard(card, 'attempted-mod');

      // Find the animationend handler
      const animationEndCall = card.addEventListener.mock.calls.find(
        (call) => call[0] === 'animationend'
      );
      expect(animationEndCall).toBeDefined();

      // Simulate animationend event
      const handler = animationEndCall[1];
      handler();

      expect(card.classList.remove).toHaveBeenCalledWith('mod-card--shake');

      await runAllTimersAndFlush();
      await promise;
    });

    it('should remove shake class after timeout fallback', async () => {
      const card = mockCards.get('attempted-mod');

      const promise = animator.shakeCard(card, 'attempted-mod');

      // Advance past the fallback timeout (shakeDuration + 50ms = 450ms)
      await advanceTimersAndFlush(451);

      expect(card.classList.remove).toHaveBeenCalledWith('mod-card--shake');

      await runAllTimersAndFlush();
      await promise;
    });

    it('should log debug message', async () => {
      const card = mockCards.get('attempted-mod');

      const promise = animator.shakeCard(card, 'attempted-mod');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Shaking card for blocked activation',
        { modId: 'attempted-mod' }
      );

      await runAllTimersAndFlush();
      await promise;
    });
  });

  describe('animateConflict', () => {
    it('should shake attempted card', async () => {
      const promise = animator.animateConflict(
        'attempted-mod',
        ['conflict-1', 'conflict-2'],
        getCardElement
      );

      const attemptedCard = mockCards.get('attempted-mod');
      expect(attemptedCard.classList.add).toHaveBeenCalledWith('mod-card--shake');

      await runAllTimersAndFlush();
      await promise;
    });

    it('should highlight conflicting cards', async () => {
      const promise = animator.animateConflict(
        'attempted-mod',
        ['conflict-1', 'conflict-2'],
        getCardElement
      );

      const conflict1 = mockCards.get('conflict-1');
      const conflict2 = mockCards.get('conflict-2');

      expect(conflict1.classList.add).toHaveBeenCalledWith('mod-card--conflict-source');
      expect(conflict2.classList.add).toHaveBeenCalledWith('mod-card--conflict-source');

      await runAllTimersAndFlush();
      await promise;
    });

    it('should auto-remove highlights after duration', async () => {
      const promise = animator.animateConflict(
        'attempted-mod',
        ['conflict-1', 'conflict-2'],
        getCardElement
      );

      // Initially highlights should be active
      expect(animator.hasActiveHighlights()).toBe(true);

      // Advance past shake duration
      await advanceTimersAndFlush(401);

      // Then advance past highlight duration
      await advanceTimersAndFlush(2001);

      const conflict1 = mockCards.get('conflict-1');
      const conflict2 = mockCards.get('conflict-2');

      expect(conflict1.classList.remove).toHaveBeenCalledWith('mod-card--conflict-source');
      expect(conflict2.classList.remove).toHaveBeenCalledWith('mod-card--conflict-source');

      await runAllTimersAndFlush();
      await promise;
    });

    it('should handle null card elements gracefully', async () => {
      const sparseGetCard = jest.fn((modId) => {
        if (modId === 'conflict-1') return null;
        return mockCards.get(modId) || null;
      });

      // Should not throw
      const promise = animator.animateConflict(
        'attempted-mod',
        ['conflict-1', 'conflict-2'],
        sparseGetCard
      );

      await runAllTimersAndFlush();
      await promise;

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Animating conflict',
        expect.any(Object)
      );
    });

    it('should log debug messages on start', async () => {
      const promise = animator.animateConflict(
        'attempted-mod',
        ['conflict-1'],
        getCardElement
      );

      expect(mockLogger.debug).toHaveBeenCalledWith('Animating conflict', {
        attempted: 'attempted-mod',
        conflicts: ['conflict-1'],
      });

      await runAllTimersAndFlush();
      await promise;
    });
  });

  describe('clearConflictHighlights', () => {
    it('should remove highlight class from cards', async () => {
      // First add highlights via animateConflict
      const promise = animator.animateConflict(
        'attempted-mod',
        ['conflict-1', 'conflict-2'],
        getCardElement
      );

      await runAllTimersAndFlush();
      await promise;

      // Clear just one
      animator.clearConflictHighlights(['conflict-1'], getCardElement);

      const conflict1 = mockCards.get('conflict-1');
      expect(conflict1.classList.remove).toHaveBeenCalledWith('mod-card--conflict-source');
    });

    it('should only clear tracked highlights', () => {
      // Attempt to clear a mod that was never highlighted
      animator.clearConflictHighlights(['non-existent'], getCardElement);

      // Should not throw and no card operations should happen
      expect(getCardElement).not.toHaveBeenCalledWith('non-existent');
    });

    it('should handle missing cards gracefully', async () => {
      // First add highlights
      const promise = animator.animateConflict(
        'attempted-mod',
        ['conflict-1'],
        getCardElement
      );

      await runAllTimersAndFlush();
      await promise;

      // Create getter that returns null
      const sparseGetCard = jest.fn(() => null);

      // Should not throw
      expect(() => {
        animator.clearConflictHighlights(['conflict-1'], sparseGetCard);
      }).not.toThrow();
    });
  });

  describe('clearAllHighlights', () => {
    it('should clear all active highlights', async () => {
      // First add highlights via animateConflict
      const promise = animator.animateConflict(
        'attempted-mod',
        ['conflict-1', 'conflict-2'],
        getCardElement
      );

      // Wait for shake animation to complete
      await advanceTimersAndFlush(401);

      expect(animator.hasActiveHighlights()).toBe(true);

      animator.clearAllHighlights(getCardElement);

      expect(animator.hasActiveHighlights()).toBe(false);

      const conflict1 = mockCards.get('conflict-1');
      const conflict2 = mockCards.get('conflict-2');

      expect(conflict1.classList.remove).toHaveBeenCalledWith('mod-card--conflict-source');
      expect(conflict2.classList.remove).toHaveBeenCalledWith('mod-card--conflict-source');

      await runAllTimersAndFlush();
      await promise;
    });

    it('should handle missing cards gracefully', async () => {
      // Add highlights
      const promise = animator.animateConflict(
        'attempted-mod',
        ['conflict-1'],
        getCardElement
      );

      await advanceTimersAndFlush(401);

      // Clear with a getter that returns null
      const sparseGetCard = jest.fn(() => null);

      expect(() => {
        animator.clearAllHighlights(sparseGetCard);
      }).not.toThrow();

      expect(animator.hasActiveHighlights()).toBe(false);

      await runAllTimersAndFlush();
      await promise;
    });
  });

  describe('addConflictBadge', () => {
    it('should create badge element', () => {
      const card = mockCards.get('attempted-mod');

      animator.addConflictBadge(card);

      expect(card._header.appendChild).toHaveBeenCalled();
    });

    it('should not duplicate badge if already exists', () => {
      const card = mockCards.get('attempted-mod');

      // Simulate badge already existing
      card._badge = { remove: jest.fn() };

      animator.addConflictBadge(card);

      // appendChild should not be called because badge exists
      expect(card._header.appendChild).not.toHaveBeenCalled();
    });

    it('should set correct accessibility attributes', () => {
      const card = mockCards.get('attempted-mod');
      let createdBadge = null;

      card._header.appendChild = jest.fn((badge) => {
        createdBadge = badge;
      });

      animator.addConflictBadge(card);

      expect(createdBadge).not.toBeNull();
      expect(createdBadge.className).toBe('mod-card__conflict-badge');
      expect(createdBadge.getAttribute('aria-label')).toBe('Has conflicts with other mods');
    });
  });

  describe('removeConflictBadge', () => {
    it('should remove badge element', () => {
      const card = mockCards.get('attempted-mod');
      const mockBadge = { remove: jest.fn() };
      card._badge = mockBadge;

      animator.removeConflictBadge(card);

      expect(mockBadge.remove).toHaveBeenCalled();
    });

    it('should do nothing if badge does not exist', () => {
      const card = mockCards.get('attempted-mod');
      card._badge = null;

      // Should not throw
      expect(() => {
        animator.removeConflictBadge(card);
      }).not.toThrow();
    });
  });

  describe('hasActiveHighlights', () => {
    it('should return false when no highlights are active', () => {
      expect(animator.hasActiveHighlights()).toBe(false);
    });

    it('should return true when highlights are active', async () => {
      const promise = animator.animateConflict(
        'attempted-mod',
        ['conflict-1'],
        getCardElement
      );

      expect(animator.hasActiveHighlights()).toBe(true);

      await runAllTimersAndFlush();
      await promise;
    });

    it('should return correct state after clearing', async () => {
      const promise = animator.animateConflict(
        'attempted-mod',
        ['conflict-1'],
        getCardElement
      );

      expect(animator.hasActiveHighlights()).toBe(true);

      animator.clearAllHighlights(getCardElement);

      expect(animator.hasActiveHighlights()).toBe(false);

      await runAllTimersAndFlush();
      await promise;
    });
  });

  describe('rapid conflicts handling', () => {
    it('should not break animation state with rapid sequential conflicts', async () => {
      // Start first conflict
      const promise1 = animator.animateConflict(
        'attempted-mod',
        ['conflict-1'],
        getCardElement
      );

      // Start second conflict immediately
      const promise2 = animator.animateConflict(
        'attempted-mod',
        ['conflict-2'],
        getCardElement
      );

      // Both conflicts should be tracked
      expect(animator.hasActiveHighlights()).toBe(true);

      // Clear and verify state is consistent
      animator.clearAllHighlights(getCardElement);
      expect(animator.hasActiveHighlights()).toBe(false);

      await runAllTimersAndFlush();
      await Promise.all([promise1, promise2]);
    });
  });
});
