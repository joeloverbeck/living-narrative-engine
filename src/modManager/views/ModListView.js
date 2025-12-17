/**
 * @file View component for rendering the mod list
 * @see src/domUI/components/SpeechBubbleContainer.js
 */

/**
 * @typedef {object} ModDisplayInfo
 * @property {string} status Mod status label
 * @property {boolean} isExplicit True when user-selected
 * @property {boolean} isDependency True when active as dependency
 */

/**
 * @typedef {object} ModCardComponentLike
 * @property {(mod: import('../services/ModDiscoveryService.js').ModMetadata, displayInfo: ModDisplayInfo) => HTMLElement} createCard Create a new card element
 * @property {(card: HTMLElement, displayInfo: ModDisplayInfo) => void} updateCardState Update an existing card element in-place
 */

/**
 * @typedef {object} ModListViewOptions
 * @property {HTMLElement} container Container element
 * @property {{debug: (message: string, ...args: unknown[]) => void}} logger Logger instance
 * @property {(modId: string) => void} onModToggle Callback for mod toggle
 * @property {ModCardComponentLike} modCardComponent Card renderer/updater
 */

/**
 * View for displaying the scrollable mod list
 */
export class ModListView {
  #container;
  #logger;
  #onModToggle;
  #modCardComponent;
  #listElement;
  #loadingElement;
  #emptyElement;
  #currentMods;

  /**
   * Create a new ModListView.
   *
   * @param {ModListViewOptions} options Construction options
   */
  constructor({ container, logger, onModToggle, modCardComponent }) {
    if (!container) {
      throw new Error('ModListView: container is required');
    }
    if (!logger) {
      throw new Error('ModListView: logger is required');
    }
    if (!onModToggle) {
      throw new Error('ModListView: onModToggle is required');
    }
    if (!modCardComponent) {
      throw new Error('ModListView: modCardComponent is required');
    }

    this.#container = container;
    this.#logger = logger;
    this.#onModToggle = onModToggle;
    this.#modCardComponent = modCardComponent;
    this.#currentMods = [];

    this.#createStructure();
    this.#bindEvents();
  }

  /**
   * Create the list structure
   */
  #createStructure() {
    this.#container.innerHTML = '';

    this.#loadingElement = document.createElement('div');
    this.#loadingElement.className = 'mod-list__loading';
    this.#loadingElement.setAttribute('role', 'status');
    this.#loadingElement.setAttribute('aria-live', 'polite');
    this.#loadingElement.innerHTML = `
      <span class="spinner" aria-hidden="true"></span>
      <span>Loading mods...</span>
    `;
    this.#loadingElement.hidden = true;

    this.#emptyElement = document.createElement('div');
    this.#emptyElement.className = 'mod-list__empty';
    this.#emptyElement.setAttribute('role', 'status');
    this.#emptyElement.innerHTML = `
      <p>No mods found matching your criteria.</p>
    `;
    this.#emptyElement.hidden = true;

    this.#listElement = document.createElement('div');
    this.#listElement.className = 'mod-list';
    this.#listElement.setAttribute('role', 'list');
    this.#listElement.setAttribute('aria-label', 'Available mods');

    this.#container.appendChild(this.#loadingElement);
    this.#container.appendChild(this.#emptyElement);
    this.#container.appendChild(this.#listElement);
  }

  /**
   * Bind event delegation for mod cards
   */
  #bindEvents() {
    this.#listElement.addEventListener('click', (event) => {
      const target = /** @type {HTMLElement} */ (event.target);
      const card = target.closest('[data-mod-id]');
      if (!card) return;

      const modId = card.dataset.modId;
      const checkbox =
        /** @type {HTMLInputElement|null} */ (
          target.closest('.mod-card__checkbox')
        );
      const isLocked = card.classList.contains('mod-card--locked');

      if (checkbox && !isLocked && !checkbox.disabled) {
        this.#onModToggle(modId);
      }
    });

    this.#listElement.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;

      const target = /** @type {HTMLElement} */ (event.target);
      const card = target.closest('[data-mod-id]');
      if (!card) return;

      const isLocked = card.classList.contains('mod-card--locked');
      const checkbox =
        /** @type {HTMLInputElement|null} */ (
          card.querySelector('.mod-card__checkbox')
        );

      if (!isLocked && checkbox && !checkbox.disabled) {
        event.preventDefault();
        this.#onModToggle(card.dataset.modId);
      }
    });
  }

  /**
   * Render the mod list
   *
   * @param {object} options Render options
   * @param {import('../services/ModDiscoveryService.js').ModMetadata[]} options.mods Mods to display, in UI order
   * @param {(modId: string) => ModDisplayInfo} options.getModDisplayInfo Resolver for per-mod display state
   * @param {boolean} options.isLoading Loading state toggle
   */
  render({ mods, getModDisplayInfo, isLoading }) {
    this.#loadingElement.hidden = !isLoading;
    this.#listElement.hidden = isLoading;
    this.#emptyElement.hidden = true;

    if (isLoading) {
      return;
    }

    if (mods.length === 0) {
      this.#emptyElement.hidden = false;
      this.#listElement.hidden = true;
      return;
    }

    this.#emptyElement.hidden = true;
    this.#listElement.hidden = false;

    if (!this.#hasModsChanged(mods)) {
      this.#updateCardStates(getModDisplayInfo);
      return;
    }

    this.#currentMods = mods.map((m) => m.id);
    this.#renderMods(mods, getModDisplayInfo);
  }

  /**
   * Check if mod list has changed
   *
   * @param {import('../services/ModDiscoveryService.js').ModMetadata[]} mods Mods to compare against current order
   * @returns {boolean} True when list order/size differs
   */
  #hasModsChanged(mods) {
    if (mods.length !== this.#currentMods.length) return true;
    return !mods.every((m, i) => m.id === this.#currentMods[i]);
  }

  /**
   * Update card states without re-rendering
   *
   * @param {(modId: string) => ModDisplayInfo} getModDisplayInfo Card state resolver
   */
  #updateCardStates(getModDisplayInfo) {
    const cards = this.#listElement.querySelectorAll('[data-mod-id]');
    for (const card of cards) {
      const modId = /** @type {HTMLElement} */ (card).dataset.modId;
      const displayInfo = getModDisplayInfo(modId);
      this.#modCardComponent.updateCardState(card, displayInfo);
    }
  }

  /**
   * Render all mod cards
   *
   * @param {import('../services/ModDiscoveryService.js').ModMetadata[]} mods Mods to render
   * @param {(modId: string) => ModDisplayInfo} getModDisplayInfo Card state resolver
   */
  #renderMods(mods, getModDisplayInfo) {
    const fragment = document.createDocumentFragment();

    for (const mod of mods) {
      const displayInfo = getModDisplayInfo(mod.id);
      const card = this.#modCardComponent.createCard(mod, displayInfo);
      fragment.appendChild(card);
    }

    this.#listElement.innerHTML = '';
    this.#listElement.appendChild(fragment);

    this.#logger.debug(`Rendered ${mods.length} mod cards`);
  }

  /**
   * Highlight a specific mod card (for cascade animation)
   *
   * @param {string} modId Mod ID to highlight
   * @param {'activating'|'deactivating'} type Highlight animation type
   */
  highlightMod(modId, type) {
    const card = this.#listElement.querySelector(`[data-mod-id="${modId}"]`);
    if (!card) return;

    card.classList.add(`mod-card--${type}`);
    card.addEventListener(
      'animationend',
      () => {
        card.classList.remove(`mod-card--${type}`);
      },
      { once: true }
    );
  }

  /**
   * Scroll a mod card into view
   *
   * @param {string} modId Mod ID to scroll to
   */
  scrollToMod(modId) {
    const card = this.#listElement.querySelector(`[data-mod-id="${modId}"]`);
    if (!card) return;

    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /**
   * Set empty state message
   *
   * @param {string} message Empty state message
   */
  setEmptyMessage(message) {
    this.#emptyElement.innerHTML = `<p>${message}</p>`;
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.#container.innerHTML = '';
    this.#currentMods = [];
  }
}

export default ModListView;
