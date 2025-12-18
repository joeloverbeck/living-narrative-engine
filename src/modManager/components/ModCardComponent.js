/**
 * @file Reusable component for mod card rendering
 * @see src/modManager/views/ModListView.js
 */

/**
 * @typedef {Object} ModDisplayInfo
 * @property {'explicit'|'dependency'|'core'|'inactive'} status
 * @property {boolean} isExplicit
 * @property {boolean} isDependency
 * @property {boolean} hasExplicitDependents
 */

/**
 * Component for creating and updating mod cards.
 * Implements the ModCardComponentLike interface expected by ModListView.
 */
export class ModCardComponent {
  #logger;

  /**
   * @param {Object} options
   * @param {{debug: (msg: string, ...args: unknown[]) => void}} options.logger
   */
  constructor({ logger }) {
    if (!logger) {
      throw new Error('ModCardComponent: logger is required');
    }
    this.#logger = logger;
  }

  /**
   * Create a mod card element
   * @param {import('../services/ModDiscoveryService.js').ModMetadata} mod
   * @param {ModDisplayInfo} displayInfo
   * @param {((modId: string) => string)|null} [getModName=null] - Optional function to resolve mod ID to name
   * @returns {HTMLElement}
   */
  createCard(mod, displayInfo, getModName = null) {
    const card = document.createElement('article');
    card.className = this.#getCardClasses(displayInfo);
    card.setAttribute('role', 'listitem');
    card.setAttribute('data-mod-id', mod.id);
    card.setAttribute('tabindex', '0');

    const isCore = displayInfo.status === 'core';
    const isActive = displayInfo.status !== 'inactive';

    // Build card structure using CSS classes from mod-manager.css
    const checkboxWrapper = document.createElement('div');
    checkboxWrapper.className = 'mod-card-checkbox';
    checkboxWrapper.appendChild(
      this.#createCheckbox(mod.id, isActive, isCore, displayInfo)
    );
    if (isCore) {
      checkboxWrapper.appendChild(this.#createLockIcon());
    }

    const content = document.createElement('div');
    content.className = 'mod-card-content';

    // Header with name, version, badges
    const header = document.createElement('div');
    header.className = 'mod-card-header';

    const name = document.createElement('span');
    if (mod.actionVisual) {
      name.className = 'mod-card-name mod-card-name-tag';
      name.style.backgroundColor = mod.actionVisual.backgroundColor;
      name.style.color = mod.actionVisual.textColor;
    } else {
      name.className = 'mod-card-name';
    }
    name.textContent = mod.name;

    const version = document.createElement('span');
    version.className = 'mod-card-version';
    version.textContent = `v${mod.version}`;

    const badges = document.createElement('div');
    badges.className = 'mod-card-badges';
    const badge = this.#createStatusBadge(displayInfo);
    if (badge) {
      badges.appendChild(badge);
    }
    if (mod.hasWorlds) {
      badges.appendChild(this.#createWorldsBadge());
    }

    header.appendChild(name);
    header.appendChild(version);
    header.appendChild(badges);

    // Description
    const description = document.createElement('p');
    description.className = 'mod-card-description';
    description.textContent = mod.description;

    // Dependencies
    const deps = this.#createDependenciesElement(mod.dependencies, getModName);

    content.appendChild(header);
    content.appendChild(description);
    if (deps) {
      content.appendChild(deps);
    }

    card.appendChild(checkboxWrapper);
    card.appendChild(content);

    // Set accessible label
    card.setAttribute('aria-label', this.#getAriaLabel(mod, displayInfo));

    this.#logger.debug(`Created card for mod: ${mod.id}`, { status: displayInfo.status });

    return card;
  }

  /**
   * Update an existing card's state without re-rendering
   * @param {HTMLElement} card
   * @param {ModDisplayInfo} displayInfo
   */
  updateCardState(card, displayInfo) {
    const isCore = displayInfo.status === 'core';
    const isActive = displayInfo.status !== 'inactive';

    // Update classes
    card.className = this.#getCardClasses(displayInfo);

    // Update checkbox
    const checkbox = /** @type {HTMLInputElement|null} */ (
      card.querySelector('.mod-card__checkbox')
    );
    if (checkbox) {
      checkbox.checked = isActive;
      // Disable for core, pure dependencies, or explicit mods with explicit dependents
      checkbox.disabled = isCore || displayInfo.isDependency || displayInfo.hasExplicitDependents;
      checkbox.setAttribute('aria-checked', String(isActive));
    }

    // Update status badge
    const badgesContainer = card.querySelector('.mod-card-badges');
    if (badgesContainer) {
      // Remove existing status badge (keep worlds badge)
      const existingBadge = badgesContainer.querySelector('.mod-badge:not([aria-label="Contains worlds"])');
      if (existingBadge) {
        existingBadge.remove();
      }
      // Add new status badge
      const newBadge = this.#createStatusBadge(displayInfo);
      if (newBadge) {
        badgesContainer.insertBefore(newBadge, badgesContainer.firstChild);
      }
    }

    // Update lock icon
    const checkboxWrapper = card.querySelector('.mod-card-checkbox');
    const existingLock = card.querySelector('.mod-card-lock-icon');
    if (isCore && !existingLock && checkboxWrapper) {
      checkboxWrapper.appendChild(this.#createLockIcon());
    } else if (!isCore && existingLock) {
      existingLock.remove();
    }
  }

  /**
   * Add conflict indicator to card
   * @param {HTMLElement} card
   * @param {string[]} conflictingMods
   */
  addConflictIndicator(card, conflictingMods) {
    if (card.querySelector('.mod-card-conflict')) {
      return; // Already has indicator
    }

    const indicator = document.createElement('div');
    indicator.className = 'mod-card-conflict';
    indicator.setAttribute('role', 'alert');

    const icon = document.createElement('span');
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '⚠️';

    const text = document.createTextNode(
      ` Conflicts with: ${conflictingMods.join(', ')}`
    );

    indicator.appendChild(icon);
    indicator.appendChild(text);

    card.appendChild(indicator);
    card.classList.add('conflict');
  }

  /**
   * Remove conflict indicator from card
   * @param {HTMLElement} card
   */
  removeConflictIndicator(card) {
    const indicator = card.querySelector('.mod-card-conflict');
    if (indicator) {
      indicator.remove();
    }
    card.classList.remove('conflict');
  }

  /**
   * Get CSS classes for card based on status
   * @param {ModDisplayInfo} displayInfo
   * @returns {string}
   */
  #getCardClasses(displayInfo) {
    const classes = ['mod-card'];

    switch (displayInfo.status) {
      case 'core':
        classes.push('active-core', 'mod-card--locked');
        break;
      case 'explicit':
        classes.push('active-explicit');
        break;
      case 'dependency':
        classes.push('active-dependency');
        break;
      case 'inactive':
      default:
        classes.push('inactive');
    }

    return classes.join(' ');
  }

  /**
   * Create checkbox element
   * @param {string} modId
   * @param {boolean} isActive
   * @param {boolean} isCore
   * @param {ModDisplayInfo} displayInfo
   * @returns {HTMLInputElement}
   */
  #createCheckbox(modId, isActive, isCore, displayInfo) {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    // Use BEM class that ModListView expects
    checkbox.className = 'mod-card__checkbox';
    checkbox.id = `mod-checkbox-${modId}`;
    checkbox.checked = isActive;
    // Disable for core, pure dependencies, or explicit mods with explicit dependents
    checkbox.disabled = isCore || displayInfo.isDependency || displayInfo.hasExplicitDependents;
    checkbox.setAttribute('aria-checked', String(isActive));
    checkbox.setAttribute(
      'aria-label',
      isCore ? 'Core mod (always enabled)' : `Toggle ${modId}`
    );
    return checkbox;
  }

  /**
   * Create lock icon element
   * @returns {HTMLSpanElement}
   */
  #createLockIcon() {
    const lock = document.createElement('span');
    lock.className = 'mod-card-lock-icon';
    lock.setAttribute('aria-hidden', 'true');
    lock.textContent = '🔒';
    return lock;
  }

  /**
   * Create status badge element
   * @param {ModDisplayInfo} displayInfo
   * @returns {HTMLSpanElement|null}
   */
  #createStatusBadge(displayInfo) {
    let badgeClass = 'mod-badge';
    let badgeText = '';

    switch (displayInfo.status) {
      case 'core':
        badgeClass += ' core';
        badgeText = 'Core';
        break;
      case 'dependency':
        badgeClass += ' auto';
        badgeText = 'Dependency';
        break;
      case 'explicit':
        // Explicit mods with explicit dependents show "Required" badge
        if (displayInfo.hasExplicitDependents) {
          badgeClass += ' required';
          badgeText = 'Required';
          break;
        }
        // No badge for regular explicitly selected mods (they're just "active")
        return null;
      case 'inactive':
      default:
        return null;
    }

    const badge = document.createElement('span');
    badge.className = badgeClass;
    badge.textContent = badgeText;
    return badge;
  }

  /**
   * Create worlds badge element
   * @returns {HTMLSpanElement}
   */
  #createWorldsBadge() {
    const badge = document.createElement('span');
    badge.className = 'mod-badge';
    badge.setAttribute('aria-label', 'Contains worlds');
    badge.textContent = '🌍';
    return badge;
  }

  /**
   * Create dependencies element
   * @param {Array<{id: string, version: string}>} dependencies
   * @param {((modId: string) => string)|null} [getModName=null] - Optional function to resolve mod ID to name
   * @returns {HTMLSpanElement|null}
   */
  #createDependenciesElement(dependencies, getModName = null) {
    if (!dependencies || dependencies.length === 0) {
      return null;
    }

    // Resolve names for display (fall back to IDs if resolver not provided)
    const depNames = dependencies.map((d) => {
      if (getModName) {
        const name = getModName(d.id);
        return name || d.id;
      }
      return d.id;
    });

    // Create tooltip with both names and IDs: "Name (id), Name2 (id2)"
    const tooltipParts = dependencies.map((d) => {
      if (getModName) {
        const name = getModName(d.id);
        return name && name !== d.id ? `${name} (${d.id})` : d.id;
      }
      return d.id;
    });
    const tooltipText = `Dependencies: ${tooltipParts.join(', ')}`;

    // Display text: "4 dependencies - Name1, Name2, Name3, Name4"
    const depList = depNames.join(', ');
    const countText = `${dependencies.length} ${dependencies.length === 1 ? 'dependency' : 'dependencies'}`;
    const displayText = `${countText} - ${depList}`;

    const span = document.createElement('span');
    span.className = 'mod-card-dependencies';
    span.setAttribute('title', tooltipText);

    const icon = document.createElement('span');
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '📦 ';

    const srText = document.createElement('span');
    srText.className = 'visually-hidden';
    srText.textContent = `Depends on: ${depList}`;

    const text = document.createTextNode(displayText);

    span.appendChild(icon);
    span.appendChild(srText);
    span.appendChild(text);

    return span;
  }

  /**
   * Generate accessible label for card
   * @param {import('../services/ModDiscoveryService.js').ModMetadata} mod
   * @param {ModDisplayInfo} displayInfo
   * @returns {string}
   */
  #getAriaLabel(mod, displayInfo) {
    const parts = [mod.name, `version ${mod.version}`];

    switch (displayInfo.status) {
      case 'core':
        parts.push('core mod, always enabled');
        break;
      case 'explicit':
        parts.push('active');
        break;
      case 'dependency':
        parts.push('active as dependency');
        break;
      default:
        parts.push('inactive');
    }

    return parts.join(', ');
  }
}

export default ModCardComponent;
