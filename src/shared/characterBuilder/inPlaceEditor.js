/**
 * @file In-place editing component for character-builder pages
 * @description Provides inline editing capabilities with validation and save/cancel functionality
 */

/**
 * In-place editor component for inline editing
 */
export class InPlaceEditor {
  #element;
  #originalValue;
  #onSave;
  #onCancel;
  #validator;
  #isEditing = false;
  #editor = null;
  #handleClickBound;
  #handleOutsideClickBound;

  /**
   * @param {object} config - Configuration object
   * @param {HTMLElement} config.element - Element to make editable
   * @param {string} config.originalValue - Original value
   * @param {Function} config.onSave - Save callback (value) => Promise<void>
   * @param {Function} [config.onCancel] - Cancel callback
   * @param {Function} [config.validator] - Validation function (value) => {isValid: boolean, error?: string}
   */
  constructor({ element, originalValue, onSave, onCancel, validator }) {
    if (!element) {
      throw new Error('InPlaceEditor: element is required');
    }
    if (typeof onSave !== 'function') {
      throw new Error('InPlaceEditor: onSave must be a function');
    }

    this.#element = element;
    this.#originalValue = originalValue;
    this.#onSave = onSave;
    this.#onCancel = onCancel;
    this.#validator = validator;

    this.#setupEditing();
  }

  /**
   * Start editing mode
   */
  startEditing() {
    if (this.#isEditing) return;

    this.#isEditing = true;
    this.#element.classList.add('editing');

    // Create editor
    this.#createEditor();
  }

  /**
   * Save changes
   */
  async saveChanges() {
    if (!this.#isEditing || !this.#editor) return;

    const newValue = this.#getEditorValue();

    // Validate if validator provided
    if (this.#validator) {
      const result = this.#validator(newValue);
      if (!result.isValid) {
        this.#showValidationError(result.error);
        return;
      }
    }

    // Check if value changed
    if (newValue.trim() === this.#originalValue.trim()) {
      this.cancelEditing();
      return;
    }

    try {
      // Show saving state
      this.#setSavingState(true);

      // Call save callback
      await this.#onSave(newValue.trim());

      // Update original value and display
      this.#originalValue = newValue.trim();
      this.#updateDisplay(this.#originalValue);

      // Exit editing mode
      this.#exitEditingMode();
    } catch (error) {
      console.error('InPlaceEditor: Save failed:', error);
      this.#showValidationError('Failed to save changes. Please try again.');
      this.#setSavingState(false);
    }
  }

  /**
   * Cancel editing
   */
  cancelEditing() {
    if (!this.#isEditing) return;

    // Reset to original value
    this.#updateDisplay(this.#originalValue);
    this.#exitEditingMode();

    // Call cancel callback if provided
    if (this.#onCancel) {
      this.#onCancel();
    }
  }

  /**
   * Get current value
   *
   * @returns {string} Current value
   */
  getCurrentValue() {
    return this.#isEditing ? this.#getEditorValue() : this.#originalValue;
  }

  /**
   * Check if currently editing
   *
   * @returns {boolean} Whether currently editing
   */
  isEditing() {
    return this.#isEditing;
  }

  /**
   * Destroy the editor
   */
  destroy() {
    if (this.#isEditing) {
      this.cancelEditing();
    }
    
    // Remove event listeners
    this.#element.removeEventListener('click', this.#handleClickBound);
  }

  /**
   * Setup editing functionality
   *
   * @private
   */
  #setupEditing() {
    this.#handleClickBound = this.#handleClick.bind(this);
    this.#element.addEventListener('click', this.#handleClickBound);
    this.#element.style.cursor = 'pointer';
    this.#element.title = 'Click to edit';
  }

  /**
   * Handle click to start editing
   *
   * @param event
   * @private
   */
  #handleClick(event) {
    if (this.#isEditing) return;
    
    event.preventDefault();
    event.stopPropagation();
    this.startEditing();
  }

  /**
   * Create editor interface
   *
   * @private
   */
  #createEditor() {
    // Hide original element
    this.#element.style.display = 'none';

    // Create editor container
    const editorContainer = document.createElement('div');
    editorContainer.className = 'in-place-editor';

    // Create input/textarea
    const isMultiline = this.#originalValue.length > 100 || this.#originalValue.includes('\n');
    const input = document.createElement(isMultiline ? 'textarea' : 'input');
    
    input.className = 'in-place-editor-input';
    input.value = this.#originalValue;
    
    if (isMultiline) {
      input.rows = Math.max(3, Math.ceil(this.#originalValue.length / 80));
    }

    // Create action buttons
    const actions = document.createElement('div');
    actions.className = 'in-place-editor-actions';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'in-place-save-btn';
    saveBtn.textContent = 'Save';
    saveBtn.type = 'button';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'in-place-cancel-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.type = 'button';

    actions.appendChild(saveBtn);
    actions.appendChild(cancelBtn);

    // Create error display
    const errorDisplay = document.createElement('div');
    errorDisplay.className = 'in-place-editor-error';
    errorDisplay.style.display = 'none';

    // Assemble editor
    editorContainer.appendChild(input);
    editorContainer.appendChild(errorDisplay);
    editorContainer.appendChild(actions);

    // Insert editor after original element
    this.#element.parentNode.insertBefore(editorContainer, this.#element.nextSibling);

    this.#editor = {
      container: editorContainer,
      input,
      saveBtn,
      cancelBtn,
      errorDisplay,
    };

    // Setup event listeners
    this.#setupEditorEvents();

    // Focus input
    input.focus();
    if (input.tagName === 'INPUT') {
      input.select();
    } else {
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }

  /**
   * Setup editor event listeners
   *
   * @private
   */
  #setupEditorEvents() {
    if (!this.#editor) return;

    const { input, saveBtn, cancelBtn } = this.#editor;

    // Save button
    saveBtn.addEventListener('click', () => this.saveChanges());

    // Cancel button
    cancelBtn.addEventListener('click', () => this.cancelEditing());

    // Keyboard shortcuts
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (input.tagName === 'INPUT' || e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.saveChanges();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.cancelEditing();
      }
    });

    // Clear validation errors on input
    input.addEventListener('input', () => {
      this.#hideValidationError();
    });

    // Handle clicks outside editor
    this.#handleOutsideClickBound = this.#handleOutsideClick.bind(this);
    document.addEventListener('click', this.#handleOutsideClickBound, { capture: true });
  }

  /**
   * Handle clicks outside editor
   *
   * @param event
   * @private
   */
  #handleOutsideClick(event) {
    if (!this.#isEditing || !this.#editor) return;

    // Check if click is inside editor
    if (this.#editor.container.contains(event.target)) return;

    // Check if click is on original element
    if (this.#element.contains(event.target)) return;

    // Auto-save on outside click
    this.saveChanges();
  }

  /**
   * Get current editor value
   *
   * @private
   * @returns {string} Editor value
   */
  #getEditorValue() {
    return this.#editor?.input?.value || '';
  }

  /**
   * Show validation error
   *
   * @private
   * @param {string} message - Error message
   */
  #showValidationError(message) {
    if (!this.#editor) return;

    this.#editor.errorDisplay.textContent = message;
    this.#editor.errorDisplay.style.display = 'block';
    this.#editor.input.classList.add('error');
  }

  /**
   * Hide validation error
   *
   * @private
   */
  #hideValidationError() {
    if (!this.#editor) return;

    this.#editor.errorDisplay.style.display = 'none';
    this.#editor.input.classList.remove('error');
  }

  /**
   * Set saving state
   *
   * @private
   * @param {boolean} saving - Whether currently saving
   */
  #setSavingState(saving) {
    if (!this.#editor) return;

    this.#editor.saveBtn.disabled = saving;
    this.#editor.saveBtn.textContent = saving ? 'Saving...' : 'Save';
    this.#editor.input.disabled = saving;
  }

  /**
   * Update display element
   *
   * @private
   * @param {string} value - Value to display
   */
  #updateDisplay(value) {
    this.#element.textContent = value;
  }

  /**
   * Exit editing mode
   *
   * @private
   */
  #exitEditingMode() {
    if (!this.#isEditing) return;

    this.#isEditing = false;
    this.#element.classList.remove('editing');

    // Show original element
    this.#element.style.display = '';

    // Remove editor
    if (this.#editor) {
      document.removeEventListener('click', this.#handleOutsideClickBound, { capture: true });
      this.#editor.container.remove();
      this.#editor = null;
    }
  }
}

export default InPlaceEditor;