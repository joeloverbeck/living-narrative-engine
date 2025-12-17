/**
 * @file Handles shake animation for conflict indication
 */

/**
 * @typedef {Object} ConflictShakeAnimatorOptions
 * @property {Object} logger
 * @property {number} [shakeDuration=400] - Duration of shake animation (ms)
 * @property {number} [conflictHighlightDuration=2000] - How long to highlight conflicting mods (ms)
 */

/**
 * Animates conflict shake effects
 */
export class ConflictShakeAnimator {
  #logger;
  #shakeDuration;
  #conflictHighlightDuration;
  #activeHighlights;

  /**
   * @param {ConflictShakeAnimatorOptions} options
   */
  constructor({ logger, shakeDuration = 400, conflictHighlightDuration = 2000 }) {
    this.#logger = logger;
    this.#shakeDuration = shakeDuration;
    this.#conflictHighlightDuration = conflictHighlightDuration;
    this.#activeHighlights = new Set();
  }

  /**
   * Shake a card to indicate activation blocked
   * @param {HTMLElement} card - Card element to shake
   * @param {string} modId - Mod ID for tracking
   * @returns {Promise<void>}
   */
  async shakeCard(card, modId) {
    this.#logger.debug('Shaking card for blocked activation', { modId });

    return new Promise((resolve) => {
      card.classList.add('mod-card--shake');

      const cleanup = () => {
        card.classList.remove('mod-card--shake');
        resolve();
      };

      // Listen for animation end
      const handler = () => {
        card.removeEventListener('animationend', handler);
        cleanup();
      };

      card.addEventListener('animationend', handler);

      // Fallback timeout
      setTimeout(() => {
        card.removeEventListener('animationend', handler);
        cleanup();
      }, this.#shakeDuration + 50);
    });
  }

  /**
   * Shake and highlight conflicting mods
   * @param {string} attemptedModId - Mod that couldn't be activated
   * @param {string[]} conflictingModIds - Mods causing the conflict
   * @param {(modId: string) => HTMLElement|null} getCardElement
   * @returns {Promise<void>}
   */
  async animateConflict(attemptedModId, conflictingModIds, getCardElement) {
    this.#logger.debug('Animating conflict', {
      attempted: attemptedModId,
      conflicts: conflictingModIds,
    });

    // Shake the attempted mod card
    const attemptedCard = getCardElement(attemptedModId);
    if (attemptedCard) {
      this.shakeCard(attemptedCard, attemptedModId);
    }

    // Highlight conflicting mods
    for (const conflictId of conflictingModIds) {
      const conflictCard = getCardElement(conflictId);
      if (conflictCard) {
        this.#highlightConflictingCard(conflictCard, conflictId);
      }
    }

    // Wait for shake to complete
    await this.#delay(this.#shakeDuration);

    // Auto-remove highlights after duration
    setTimeout(() => {
      this.clearConflictHighlights(conflictingModIds, getCardElement);
    }, this.#conflictHighlightDuration);
  }

  /**
   * Highlight a conflicting card
   * @param {HTMLElement} card
   * @param {string} modId
   */
  #highlightConflictingCard(card, modId) {
    card.classList.add('mod-card--conflict-source');
    this.#activeHighlights.add(modId);
  }

  /**
   * Clear conflict highlights from cards
   * @param {string[]} modIds
   * @param {(modId: string) => HTMLElement|null} getCardElement
   */
  clearConflictHighlights(modIds, getCardElement) {
    for (const modId of modIds) {
      if (this.#activeHighlights.has(modId)) {
        const card = getCardElement(modId);
        if (card) {
          card.classList.remove('mod-card--conflict-source');
        }
        this.#activeHighlights.delete(modId);
      }
    }
  }

  /**
   * Clear all conflict highlights
   * @param {(modId: string) => HTMLElement|null} getCardElement
   */
  clearAllHighlights(getCardElement) {
    for (const modId of this.#activeHighlights) {
      const card = getCardElement(modId);
      if (card) {
        card.classList.remove('mod-card--conflict-source');
      }
    }
    this.#activeHighlights.clear();
  }

  /**
   * Add permanent conflict indicator to a card
   * @param {HTMLElement} card
   */
  addConflictBadge(card) {
    // Check if badge already exists
    if (card.querySelector('.mod-card__conflict-badge')) return;

    const badge = document.createElement('span');
    badge.className = 'mod-card__conflict-badge';
    badge.setAttribute('aria-label', 'Has conflicts with other mods');
    badge.innerHTML = '<span aria-hidden="true">⚠️</span>';

    // Add to card header or appropriate location
    const header = card.querySelector('.mod-card__header');
    if (header) {
      header.appendChild(badge);
    }
  }

  /**
   * Remove conflict indicator from a card
   * @param {HTMLElement} card
   */
  removeConflictBadge(card) {
    const badge = card.querySelector('.mod-card__conflict-badge');
    if (badge) {
      badge.remove();
    }
  }

  /**
   * Promisified delay
   * @param {number} ms
   * @returns {Promise<void>}
   */
  #delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if there are active highlights
   * @returns {boolean}
   */
  hasActiveHighlights() {
    return this.#activeHighlights.size > 0;
  }
}

export default ConflictShakeAnimator;
