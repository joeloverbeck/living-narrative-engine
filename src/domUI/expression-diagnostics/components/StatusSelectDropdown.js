/**
 * @file Custom dropdown component with status circle indicators.
 * Replaces native <select> to support rich content (colored status circles)
 * inside dropdown options.
 *
 * @see statusTheme.js - Single source of truth for status colors and CSS class generation
 */

import { validateDependency } from '../../../utils/dependencyUtils.js';
import { getStatusCircleCssClass } from '../../../expressionDiagnostics/statusTheme.js';

/**
 * @typedef {Object} DropdownOption
 * @property {string} value - The option value
 * @property {string} label - The display label
 * @property {string|null} status - Diagnostic status for color coding
 */

/**
 * Custom accessible dropdown component that displays status circles
 * alongside option labels.
 */
class StatusSelectDropdown {
  /** @type {HTMLElement} */
  #containerElement;

  /** @type {HTMLButtonElement|null} */
  #triggerElement = null;

  /** @type {HTMLDivElement|null} */
  #listboxElement = null;

  /** @type {DropdownOption[]} */
  #options = [];

  /** @type {string} */
  #selectedValue = '';

  /** @type {boolean} */
  #isExpanded = false;

  /** @type {boolean} */
  #isEnabled = true;

  /** @type {Function} */
  #onSelectionChange;

  /** @type {Object} */
  #logger;

  /** @type {string} */
  #placeholder;

  /** @type {string} */
  #id;

  /** @type {number} */
  #focusedIndex = -1;

  /** @type {Function|null} */
  #boundDocumentClick = null;

  /** @type {Function|null} */
  #boundKeydownHandler = null;

  /**
   * Creates a new StatusSelectDropdown instance.
   * @param {Object} config - Configuration object
   * @param {HTMLElement} config.containerElement - Container to render dropdown into
   * @param {Function} config.onSelectionChange - Callback when selection changes
   * @param {Object} config.logger - ILogger instance
   * @param {string} [config.placeholder='-- Select an option --'] - Placeholder text
   * @param {string} [config.id='status-select'] - ID prefix for elements
   */
  constructor({
    containerElement,
    onSelectionChange,
    logger,
    placeholder = '-- Select an option --',
    id = 'status-select',
  }) {
    if (!containerElement || !(containerElement instanceof HTMLElement)) {
      throw new Error(
        'StatusSelectDropdown: containerElement must be a valid HTMLElement'
      );
    }

    if (typeof onSelectionChange !== 'function') {
      throw new Error(
        'StatusSelectDropdown: onSelectionChange must be a function'
      );
    }

    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });

    this.#containerElement = containerElement;
    this.#onSelectionChange = onSelectionChange;
    this.#logger = logger;
    this.#placeholder = placeholder;
    this.#id = id;

    this.#render();
    this.#attachEventListeners();

    this.#logger.debug('StatusSelectDropdown: Initialized', { id: this.#id });
  }

  /**
   * Renders the dropdown structure into the container.
   */
  #render() {
    this.#containerElement.innerHTML = '';

    // Create trigger button
    this.#triggerElement = document.createElement('button');
    this.#triggerElement.type = 'button';
    this.#triggerElement.id = this.#id;
    this.#triggerElement.className = 'status-select-trigger';
    this.#triggerElement.setAttribute('role', 'combobox');
    this.#triggerElement.setAttribute('aria-haspopup', 'listbox');
    this.#triggerElement.setAttribute('aria-expanded', 'false');
    this.#triggerElement.setAttribute(
      'aria-controls',
      `${this.#id}-listbox`
    );

    this.#updateTriggerContent();

    // Create listbox
    this.#listboxElement = document.createElement('div');
    this.#listboxElement.id = `${this.#id}-listbox`;
    this.#listboxElement.className = 'status-select-listbox';
    this.#listboxElement.setAttribute('role', 'listbox');
    this.#listboxElement.setAttribute('aria-hidden', 'true');
    this.#listboxElement.setAttribute(
      'aria-labelledby',
      `${this.#id}-label`
    );

    this.#containerElement.appendChild(this.#triggerElement);
    this.#containerElement.appendChild(this.#listboxElement);
  }

  /**
   * Updates the trigger button content based on current selection.
   */
  #updateTriggerContent() {
    if (!this.#triggerElement) return;

    const selectedOption = this.#options.find(
      (opt) => opt.value === this.#selectedValue
    );

    if (selectedOption) {
      const statusClass = getStatusCircleCssClass(selectedOption.status, this.#logger);
      this.#triggerElement.innerHTML = `
        <span class="status-select-trigger-content">
          <span class="status-circle ${statusClass}"></span>
          <span class="status-select-trigger-text">${this.#escapeHtml(selectedOption.label)}</span>
        </span>
      `;
    } else {
      this.#triggerElement.innerHTML = `
        <span class="status-select-trigger-content">
          <span class="status-select-placeholder">${this.#escapeHtml(this.#placeholder)}</span>
        </span>
      `;
    }
  }

  /**
   * Renders option elements into the listbox.
   */
  #renderOptions() {
    if (!this.#listboxElement) return;

    this.#listboxElement.innerHTML = '';

    this.#options.forEach((option, index) => {
      const optionElement = document.createElement('div');
      optionElement.id = `${this.#id}-option-${index}`;
      optionElement.className = 'status-select-option';
      optionElement.setAttribute('role', 'option');
      optionElement.setAttribute(
        'aria-selected',
        option.value === this.#selectedValue ? 'true' : 'false'
      );
      optionElement.dataset.value = option.value;
      optionElement.dataset.index = String(index);
      optionElement.tabIndex = -1;

      const statusClass = getStatusCircleCssClass(option.status, this.#logger);
      optionElement.innerHTML = `
        <span class="status-circle ${statusClass}"></span>
        <span class="status-select-option-text" title="${this.#escapeHtml(option.value)}">${this.#escapeHtml(option.label)}</span>
      `;

      this.#listboxElement.appendChild(optionElement);
    });
  }

  /**
   * Escapes HTML special characters.
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  #escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Attaches event listeners for interaction.
   */
  #attachEventListeners() {
    // Trigger click
    this.#triggerElement?.addEventListener('click', (e) => {
      e.preventDefault();
      this.#toggle();
    });

    // Keyboard navigation on trigger
    this.#boundKeydownHandler = this.#handleKeydown.bind(this);
    this.#triggerElement?.addEventListener(
      'keydown',
      this.#boundKeydownHandler
    );

    // Option clicks
    this.#listboxElement?.addEventListener('click', (e) => {
      const target = /** @type {HTMLElement} */ (e.target);
      const optionElement = target.closest('.status-select-option');
      if (optionElement) {
        const value = /** @type {HTMLElement} */ (optionElement).dataset.value;
        if (value !== undefined) {
          this.#selectOption(value);
        }
      }
    });

    // Keyboard navigation on listbox
    this.#listboxElement?.addEventListener(
      'keydown',
      this.#boundKeydownHandler
    );

    // Close on outside click
    this.#boundDocumentClick = this.#handleDocumentClick.bind(this);
    document.addEventListener('click', this.#boundDocumentClick);
  }

  /**
   * Handles keyboard events.
   * @param {KeyboardEvent} event - The keyboard event
   */
  #handleKeydown(event) {
    if (!this.#isEnabled) return;

    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (this.#isExpanded) {
          if (this.#focusedIndex >= 0) {
            const option = this.#options[this.#focusedIndex];
            if (option) {
              this.#selectOption(option.value);
            }
          }
        } else {
          this.#open();
        }
        break;

      case 'Escape':
        event.preventDefault();
        this.#close();
        this.#triggerElement?.focus();
        break;

      case 'ArrowDown':
        event.preventDefault();
        if (!this.#isExpanded) {
          this.#open();
        } else {
          this.#focusNextOption();
        }
        break;

      case 'ArrowUp':
        event.preventDefault();
        if (this.#isExpanded) {
          this.#focusPreviousOption();
        }
        break;

      case 'Home':
        event.preventDefault();
        if (this.#isExpanded) {
          this.#focusOptionAtIndex(0);
        }
        break;

      case 'End':
        event.preventDefault();
        if (this.#isExpanded) {
          this.#focusOptionAtIndex(this.#options.length - 1);
        }
        break;

      case 'Tab':
        if (this.#isExpanded) {
          this.#close();
        }
        break;
    }
  }

  /**
   * Handles clicks outside the dropdown.
   * @param {MouseEvent} event - The click event
   */
  #handleDocumentClick(event) {
    const target = /** @type {HTMLElement} */ (event.target);
    if (!this.#containerElement.contains(target)) {
      this.#close();
    }
  }

  /**
   * Toggles the dropdown open/closed.
   */
  #toggle() {
    if (!this.#isEnabled) return;

    if (this.#isExpanded) {
      this.#close();
    } else {
      this.#open();
    }
  }

  /**
   * Opens the dropdown.
   */
  #open() {
    if (!this.#isEnabled || this.#isExpanded) return;

    this.#isExpanded = true;
    this.#triggerElement?.setAttribute('aria-expanded', 'true');
    this.#listboxElement?.setAttribute('aria-hidden', 'false');

    // Focus the selected option, or first option
    const selectedIndex = this.#options.findIndex(
      (opt) => opt.value === this.#selectedValue
    );
    this.#focusOptionAtIndex(selectedIndex >= 0 ? selectedIndex : 0);

    this.#logger.debug('StatusSelectDropdown: Opened');
  }

  /**
   * Closes the dropdown.
   */
  #close() {
    if (!this.#isExpanded) return;

    this.#isExpanded = false;
    this.#focusedIndex = -1;
    this.#triggerElement?.setAttribute('aria-expanded', 'false');
    this.#listboxElement?.setAttribute('aria-hidden', 'true');
    this.#triggerElement?.removeAttribute('aria-activedescendant');

    // Remove focus styling from all options
    this.#listboxElement
      ?.querySelectorAll('.status-select-option')
      .forEach((opt) => {
        opt.classList.remove('focused');
      });

    this.#logger.debug('StatusSelectDropdown: Closed');
  }

  /**
   * Focuses the next option in the list.
   */
  #focusNextOption() {
    const nextIndex =
      this.#focusedIndex < this.#options.length - 1
        ? this.#focusedIndex + 1
        : 0;
    this.#focusOptionAtIndex(nextIndex);
  }

  /**
   * Focuses the previous option in the list.
   */
  #focusPreviousOption() {
    const prevIndex =
      this.#focusedIndex > 0
        ? this.#focusedIndex - 1
        : this.#options.length - 1;
    this.#focusOptionAtIndex(prevIndex);
  }

  /**
   * Focuses an option at a specific index.
   * @param {number} index - The index to focus
   */
  #focusOptionAtIndex(index) {
    if (index < 0 || index >= this.#options.length) return;

    // Remove focus from previous
    this.#listboxElement
      ?.querySelectorAll('.status-select-option')
      .forEach((opt) => {
        opt.classList.remove('focused');
      });

    // Focus new option
    const optionElement = this.#listboxElement?.querySelector(
      `#${this.#id}-option-${index}`
    );
    if (optionElement) {
      optionElement.classList.add('focused');
      /** @type {HTMLElement} */ (optionElement).focus();
      this.#triggerElement?.setAttribute(
        'aria-activedescendant',
        optionElement.id
      );
    }

    this.#focusedIndex = index;
  }

  /**
   * Selects an option by value.
   * @param {string} value - The value to select
   */
  #selectOption(value) {
    const option = this.#options.find((opt) => opt.value === value);
    if (!option) {
      this.#logger.warn('StatusSelectDropdown: Option not found', { value });
      return;
    }

    this.#selectedValue = value;
    this.#updateTriggerContent();
    this.#updateSelectedState();
    this.#close();
    this.#triggerElement?.focus();

    this.#logger.debug('StatusSelectDropdown: Selection changed', { value });
    this.#onSelectionChange(value);
  }

  /**
   * Updates aria-selected attributes on options.
   */
  #updateSelectedState() {
    this.#listboxElement
      ?.querySelectorAll('.status-select-option')
      .forEach((opt) => {
        const optValue = /** @type {HTMLElement} */ (opt).dataset.value;
        opt.setAttribute(
          'aria-selected',
          optValue === this.#selectedValue ? 'true' : 'false'
        );
      });
  }

  /**
   * Populates the dropdown with options.
   * @param {DropdownOption[]} options - Array of options
   */
  setOptions(options) {
    if (!Array.isArray(options)) {
      this.#logger.error(
        'StatusSelectDropdown: setOptions requires an array'
      );
      return;
    }

    this.#options = options;
    this.#renderOptions();

    // If current selection is not in new options, reset
    if (
      this.#selectedValue &&
      !options.some((opt) => opt.value === this.#selectedValue)
    ) {
      this.#selectedValue = '';
      this.#updateTriggerContent();
    }

    this.#logger.debug('StatusSelectDropdown: Options set', {
      count: options.length,
    });
  }

  /**
   * Gets the currently selected value.
   * @returns {string} The selected value, or empty string if none
   */
  getValue() {
    return this.#selectedValue;
  }

  /**
   * Programmatically selects a value.
   * @param {string} value - The value to select
   * @param {boolean} [triggerCallback=true] - Whether to fire onSelectionChange
   * @returns {boolean} True if the value was found and selected, false otherwise
   */
  setValue(value, triggerCallback = true) {
    const option = this.#options.find((opt) => opt.value === value);
    if (!option) {
      this.#logger.warn('StatusSelectDropdown: setValue - option not found', {
        value,
      });
      return false;
    }

    this.#selectedValue = value;
    this.#updateTriggerContent();
    this.#updateSelectedState();

    if (triggerCallback) {
      this.#onSelectionChange(value);
    }

    this.#logger.debug('StatusSelectDropdown: Value set programmatically', {
      value,
      triggerCallback,
    });
    return true;
  }

  /**
   * Updates the status circle color for a specific option.
   * @param {string} value - The option value to update
   * @param {string} status - The new diagnostic status
   */
  updateOptionStatus(value, status) {
    // Update in options array
    const option = this.#options.find((opt) => opt.value === value);
    if (!option) {
      // Include diagnostic info to help debug ID mismatches
      const optionCount = this.#options.length;
      const sampleValues =
        optionCount > 0
          ? this.#options.slice(0, 3).map((opt) => opt.value)
          : [];
      this.#logger.warn(
        'StatusSelectDropdown: updateOptionStatus - option not found',
        {
          value,
          optionCount,
          sampleValues,
        }
      );
      return;
    }

    option.status = status;

    // Update DOM
    const index = this.#options.indexOf(option);
    const optionElement = this.#listboxElement?.querySelector(
      `#${this.#id}-option-${index}`
    );
    if (optionElement) {
      const circle = optionElement.querySelector('.status-circle');
      if (circle) {
        // Remove all status-* classes
        circle.className = circle.className
          .split(' ')
          .filter((c) => !c.startsWith('status-'))
          .join(' ');
        circle.classList.add('status-circle');
        circle.classList.add(getStatusCircleCssClass(status, this.#logger));
      }
    }

    // Update trigger if this is the selected option
    if (this.#selectedValue === value) {
      this.#updateTriggerContent();
    }

    this.#logger.debug('StatusSelectDropdown: Option status updated', {
      value,
      status,
    });
  }

  /**
   * Enables or disables the dropdown.
   * @param {boolean} enabled - Whether the dropdown should be enabled
   */
  setEnabled(enabled) {
    this.#isEnabled = enabled;

    if (this.#triggerElement) {
      this.#triggerElement.disabled = !enabled;
    }

    if (!enabled) {
      this.#close();
    }

    this.#logger.debug('StatusSelectDropdown: Enabled state changed', {
      enabled,
    });
  }

  /**
   * Returns a copy of the current options array.
   *
   * @returns {Array<{value: string, label: string, status: string|null}>}
   */
  getOptions() {
    return [...this.#options];
  }

  /**
   * Cleans up event listeners and DOM.
   */
  dispose() {
    if (this.#boundDocumentClick) {
      document.removeEventListener('click', this.#boundDocumentClick);
      this.#boundDocumentClick = null;
    }

    if (this.#boundKeydownHandler && this.#triggerElement) {
      this.#triggerElement.removeEventListener(
        'keydown',
        this.#boundKeydownHandler
      );
    }

    if (this.#boundKeydownHandler && this.#listboxElement) {
      this.#listboxElement.removeEventListener(
        'keydown',
        this.#boundKeydownHandler
      );
    }

    this.#boundKeydownHandler = null;

    this.#containerElement.innerHTML = '';
    this.#triggerElement = null;
    this.#listboxElement = null;
    this.#options = [];

    this.#logger.debug('StatusSelectDropdown: Disposed');
  }
}

export default StatusSelectDropdown;
