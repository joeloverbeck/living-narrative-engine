/**
 * @file View component for world selection using radio buttons
 * @see src/modManager/views/ModListView.js
 */

/**
 * @typedef {object} WorldListViewOptions
 * @property {HTMLElement} container - Container element
 * @property {{debug: (message: string, ...args: unknown[]) => void}} logger - Logger instance
 * @property {(worldId: string) => void} onWorldSelect - Callback for world selection
 */

/**
 * View for displaying and selecting worlds.
 * Uses radio button pattern matching existing CSS in mod-manager.css.
 */
export class WorldListView {
  #container;
  #logger;
  #onWorldSelect;
  #listElement;
  #detailsElement;
  #loadingElement;
  #emptyElement;

  /**
   * @param {WorldListViewOptions} options
   */
  constructor({ container, logger, onWorldSelect }) {
    if (!container) {
      throw new Error('WorldListView: container is required');
    }
    if (!logger) {
      throw new Error('WorldListView: logger is required');
    }
    if (!onWorldSelect) {
      throw new Error('WorldListView: onWorldSelect is required');
    }

    this.#container = container;
    this.#logger = logger;
    this.#onWorldSelect = onWorldSelect;

    this.#createStructure();
    this.#bindEvents();
  }

  /**
   * Create the view structure
   */
  #createStructure() {
    this.#container.innerHTML = '';

    // Loading state
    this.#loadingElement = document.createElement('div');
    this.#loadingElement.className = 'world-list__loading';
    this.#loadingElement.setAttribute('role', 'status');
    this.#loadingElement.setAttribute('aria-live', 'polite');
    this.#loadingElement.innerHTML = `
      <span class="spinner" aria-hidden="true"></span>
      <span>Loading worlds...</span>
    `;
    this.#loadingElement.hidden = true;

    // Empty state
    this.#emptyElement = document.createElement('div');
    this.#emptyElement.className = 'world-list__empty';
    this.#emptyElement.setAttribute('role', 'status');
    this.#emptyElement.innerHTML = `
      <p>No worlds available. Enable mods that contain worlds.</p>
    `;
    this.#emptyElement.hidden = true;

    // World list (radio button based)
    this.#listElement = document.createElement('div');
    this.#listElement.className = 'world-list';
    this.#listElement.setAttribute('role', 'radiogroup');
    this.#listElement.setAttribute('aria-label', 'Available worlds');

    // Details panel
    this.#detailsElement = document.createElement('div');
    this.#detailsElement.className = 'world-details';
    this.#detailsElement.id = 'world-details';
    this.#detailsElement.setAttribute('role', 'region');
    this.#detailsElement.setAttribute('aria-live', 'polite');

    this.#container.appendChild(this.#loadingElement);
    this.#container.appendChild(this.#emptyElement);
    this.#container.appendChild(this.#listElement);
    this.#container.appendChild(this.#detailsElement);
  }

  /**
   * Bind event delegation for world selection
   */
  #bindEvents() {
    this.#listElement.addEventListener('change', (event) => {
      const target = /** @type {HTMLInputElement} */ (event.target);
      if (target.type === 'radio' && target.checked) {
        const worldId = target.value;
        this.#updateSelectedClass(worldId);
        this.#onWorldSelect(worldId);
      }
    });

    // Keyboard navigation for option containers
    this.#listElement.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;

      const target = /** @type {HTMLElement} */ (event.target);
      const option = target.closest('.world-option');
      if (!option) return;

      const radio = /** @type {HTMLInputElement|null} */ (
        option.querySelector('input[type="radio"]')
      );
      if (radio && !radio.disabled) {
        event.preventDefault();
        radio.checked = true;
        radio.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  }

  /**
   * Update selected class on world options
   * @param {string} worldId
   */
  #updateSelectedClass(worldId) {
    const options = this.#listElement.querySelectorAll('.world-option');
    for (const option of options) {
      const radio = /** @type {HTMLInputElement|null} */ (
        option.querySelector('input[type="radio"]')
      );
      if (radio && radio.value === worldId) {
        option.classList.add('selected');
      } else {
        option.classList.remove('selected');
      }
    }
  }

  /**
   * Render the world list
   * @param {Object} options
   * @param {import('../services/WorldDiscoveryService.js').WorldInfo[]} options.worlds
   * @param {string|null} options.selectedWorld - Currently selected world ID
   * @param {boolean} options.isLoading
   */
  render({ worlds, selectedWorld, isLoading }) {
    this.#loadingElement.hidden = !isLoading;
    this.#listElement.hidden = isLoading;
    this.#emptyElement.hidden = true;
    this.#detailsElement.hidden = isLoading;

    if (isLoading) {
      return;
    }

    if (worlds.length === 0) {
      this.#emptyElement.hidden = false;
      this.#listElement.hidden = true;
      this.#detailsElement.innerHTML = '';
      return;
    }

    this.#emptyElement.hidden = true;
    this.#listElement.hidden = false;
    this.#detailsElement.hidden = false;

    this.#renderWorldOptions(worlds, selectedWorld);
    this.#updateDetails(worlds, selectedWorld);
  }

  /**
   * Render world options as radio buttons
   * @param {import('../services/WorldDiscoveryService.js').WorldInfo[]} worlds
   * @param {string|null} selectedWorld
   */
  #renderWorldOptions(worlds, selectedWorld) {
    // Group worlds by mod
    const worldsByMod = new Map();
    for (const world of worlds) {
      if (!worldsByMod.has(world.modId)) {
        worldsByMod.set(world.modId, []);
      }
      worldsByMod.get(world.modId).push(world);
    }

    const fragment = document.createDocumentFragment();
    const hasMultipleMods = worldsByMod.size > 1;

    for (const [modId, modWorlds] of worldsByMod) {
      // Add group header if multiple mods
      if (hasMultipleMods) {
        const header = document.createElement('div');
        header.className = 'world-group-header';
        header.textContent = this.#capitalizeFirst(modId);
        header.setAttribute('role', 'presentation');
        fragment.appendChild(header);
      }

      for (const world of modWorlds) {
        const option = this.#createWorldOption(world, world.id === selectedWorld);
        fragment.appendChild(option);
      }
    }

    this.#listElement.innerHTML = '';
    this.#listElement.appendChild(fragment);

    this.#logger.debug(`Rendered ${worlds.length} world options`);
  }

  /**
   * Create a world option element
   * @param {import('../services/WorldDiscoveryService.js').WorldInfo} world
   * @param {boolean} isSelected
   * @returns {HTMLElement}
   */
  #createWorldOption(world, isSelected) {
    const option = document.createElement('label');
    option.className = `world-option${isSelected ? ' selected' : ''}`;
    option.setAttribute('tabindex', '0');
    option.setAttribute('data-world-id', world.id);

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'world-selection';
    radio.value = world.id;
    radio.checked = isSelected;
    radio.setAttribute('aria-describedby', 'world-details');

    const label = document.createElement('span');
    label.className = 'world-option-label';
    label.textContent = world.name;

    const source = document.createElement('span');
    source.className = 'world-option-source';
    source.textContent = world.modId;

    option.appendChild(radio);
    option.appendChild(label);
    option.appendChild(source);

    return option;
  }

  /**
   * Update the details panel for selected world
   * @param {import('../services/WorldDiscoveryService.js').WorldInfo[]} worlds
   * @param {string|null} selectedWorld
   */
  #updateDetails(worlds, selectedWorld) {
    if (!selectedWorld) {
      this.#detailsElement.innerHTML =
        '<p class="world-details__hint">Select a world to begin your adventure.</p>';
      return;
    }

    const world = worlds.find((w) => w.id === selectedWorld);
    if (!world) {
      this.#detailsElement.innerHTML =
        '<p class="world-details__error">Selected world not found.</p>';
      return;
    }

    this.#detailsElement.innerHTML = `
      <h4 class="world-details__name">${this.#escapeHtml(world.name)}</h4>
      <p class="world-details__description">${this.#escapeHtml(world.description)}</p>
      <p class="world-details__source">
        <span aria-hidden="true">📦</span>
        From: <strong>${this.#escapeHtml(world.modId)}</strong>
      </p>
    `;
  }

  /**
   * Set validation state for visual feedback
   * @param {'error'|'success'|'none'} type
   */
  setValidationState(type) {
    this.#listElement.classList.remove('world-list--error', 'world-list--success');

    if (type === 'error') {
      this.#listElement.classList.add('world-list--error');
      this.#listElement.setAttribute('aria-invalid', 'true');
    } else if (type === 'success') {
      this.#listElement.classList.add('world-list--success');
      this.#listElement.removeAttribute('aria-invalid');
    } else {
      this.#listElement.removeAttribute('aria-invalid');
    }
  }

  /**
   * Capitalize first letter
   * @param {string} str
   * @returns {string}
   */
  #capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} text
   * @returns {string}
   */
  #escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Get currently selected world ID
   * @returns {string|null}
   */
  getSelectedWorld() {
    const checked = /** @type {HTMLInputElement|null} */ (
      this.#listElement.querySelector('input[type="radio"]:checked')
    );
    return checked ? checked.value : null;
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.#container.innerHTML = '';
  }
}

export default WorldListView;
