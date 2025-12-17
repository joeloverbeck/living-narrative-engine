/**
 * @file Handles cascade animation for dependency activation/deactivation
 */

/**
 * @typedef {Object} CascadeAnimatorOptions
 * @property {Object} logger
 * @property {number} [staggerDelay=150] - Delay between each card animation (ms)
 * @property {number} [animationDuration=300] - Duration of each animation (ms)
 */

/**
 * Animates dependency cascade effects
 */
export class CascadeAnimator {
  #logger;
  #staggerDelay;
  #animationDuration;
  #activeAnimations;

  /**
   * @param {CascadeAnimatorOptions} options
   */
  constructor({ logger, staggerDelay = 150, animationDuration = 300 }) {
    this.#logger = logger;
    this.#staggerDelay = staggerDelay;
    this.#animationDuration = animationDuration;
    this.#activeAnimations = new Map();
  }

  /**
   * Animate activation cascade
   * @param {string} primaryModId - The mod user clicked to activate
   * @param {string[]} dependencyIds - Dependencies being auto-activated
   * @param {(modId: string) => HTMLElement|null} getCardElement - Function to get card element
   * @returns {Promise<void>}
   */
  async animateActivationCascade(primaryModId, dependencyIds, getCardElement) {
    this.#logger.debug('Starting activation cascade animation', {
      primary: primaryModId,
      dependencies: dependencyIds,
    });

    // Cancel any existing animations for these mods
    this.#cancelExistingAnimations([primaryModId, ...dependencyIds]);

    // Animate primary first
    const primaryCard = getCardElement(primaryModId);
    if (primaryCard) {
      await this.#animateCard(primaryCard, 'activate-primary', primaryModId);
    }

    // Animate dependencies in sequence with stagger
    for (let i = 0; i < dependencyIds.length; i++) {
      const depId = dependencyIds[i];
      const depCard = getCardElement(depId);

      if (depCard) {
        // Wait for stagger delay
        await this.#delay(this.#staggerDelay);

        // Animate with ripple effect
        this.#animateCard(depCard, 'activate-dependency', depId);
      }
    }

    // Wait for last animation to complete
    await this.#delay(this.#animationDuration);

    this.#logger.debug('Activation cascade animation complete');
  }

  /**
   * Animate deactivation cascade
   * @param {string} primaryModId - The mod user clicked to deactivate
   * @param {string[]} orphanedIds - Dependents being auto-deactivated
   * @param {(modId: string) => HTMLElement|null} getCardElement
   * @returns {Promise<void>}
   */
  async animateDeactivationCascade(primaryModId, orphanedIds, getCardElement) {
    this.#logger.debug('Starting deactivation cascade animation', {
      primary: primaryModId,
      orphaned: orphanedIds,
    });

    // Cancel any existing animations
    this.#cancelExistingAnimations([primaryModId, ...orphanedIds]);

    // Animate orphaned dependents first (in reverse order - furthest first)
    const reversedOrphans = [...orphanedIds].reverse();

    for (let i = 0; i < reversedOrphans.length; i++) {
      const orphanId = reversedOrphans[i];
      const orphanCard = getCardElement(orphanId);

      if (orphanCard) {
        this.#animateCard(orphanCard, 'deactivate-orphan', orphanId);
        await this.#delay(this.#staggerDelay);
      }
    }

    // Then animate the primary
    const primaryCard = getCardElement(primaryModId);
    if (primaryCard) {
      await this.#animateCard(primaryCard, 'deactivate-primary', primaryModId);
    }

    this.#logger.debug('Deactivation cascade animation complete');
  }

  /**
   * Highlight a dependency chain on hover
   * @param {string} modId - Mod being hovered
   * @param {string[]} dependencyChain - All dependencies in chain
   * @param {(modId: string) => HTMLElement|null} getCardElement
   */
  highlightDependencyChain(modId, dependencyChain, getCardElement) {
    for (const depId of dependencyChain) {
      const card = getCardElement(depId);
      if (card) {
        card.classList.add('mod-card--dependency-highlight');
      }
    }
  }

  /**
   * Remove dependency chain highlight
   * @param {string[]} dependencyChain
   * @param {(modId: string) => HTMLElement|null} getCardElement
   */
  clearDependencyHighlight(dependencyChain, getCardElement) {
    for (const depId of dependencyChain) {
      const card = getCardElement(depId);
      if (card) {
        card.classList.remove('mod-card--dependency-highlight');
      }
    }
  }

  /**
   * Animate a single card
   * @param {HTMLElement} card
   * @param {string} animationType
   * @param {string} modId
   * @returns {Promise<void>}
   */
  async #animateCard(card, animationType, modId) {
    return new Promise((resolve) => {
      // Add animation class
      const animationClass = `mod-card--${animationType}`;
      card.classList.add(animationClass);

      // Track animation
      const animationId = Symbol(modId);
      this.#activeAnimations.set(modId, animationId);

      // Set up completion handler
      const onComplete = () => {
        // Only remove if this is still the current animation
        if (this.#activeAnimations.get(modId) === animationId) {
          card.classList.remove(animationClass);
          this.#activeAnimations.delete(modId);
        }
        resolve();
      };

      // Use animationend event or fallback to timeout
      const handler = () => {
        card.removeEventListener('animationend', handler);
        onComplete();
      };

      card.addEventListener('animationend', handler);

      // Fallback timeout in case animationend doesn't fire
      setTimeout(() => {
        card.removeEventListener('animationend', handler);
        onComplete();
      }, this.#animationDuration + 50);
    });
  }

  /**
   * Cancel existing animations for mods
   * @param {string[]} modIds
   */
  #cancelExistingAnimations(modIds) {
    for (const modId of modIds) {
      this.#activeAnimations.delete(modId);
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
   * Check if any animations are currently running
   * @returns {boolean}
   */
  isAnimating() {
    return this.#activeAnimations.size > 0;
  }

  /**
   * Cancel all running animations
   */
  cancelAll() {
    this.#activeAnimations.clear();
  }
}

export default CascadeAnimator;
