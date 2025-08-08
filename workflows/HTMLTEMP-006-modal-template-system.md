# HTMLTEMP-006: Create Modal Template System

## Status

**Status**: Not Started  
**Priority**: High  
**Estimated**: 4 hours  
**Complexity**: High  
**Dependencies**: HTMLTEMP-001, HTMLTEMP-002

## Objective

Create a comprehensive modal template system that provides accessible dialog components for character builder pages, including support for various modal types, sizes, animations, and proper focus management.

## Background

Character builder pages currently have a placeholder modal implementation in `pageTemplate.js` (lines 115-142) that needs to be replaced with a proper, standardized modal system. This template will provide fully accessible modal dialogs with proper focus management and keyboard navigation.

## Technical Requirements

### 1. Modal Template Implementation

#### File: `src/characterBuilder/templates/core/modalTemplate.js`

```javascript
/**
 * @file Modal template system for character builder pages
 * @module characterBuilder/templates/core/modalTemplate
 */

import { DomUtils } from '../../../utils/domUtils.js';
import { string } from '../../../utils/validationCore.js';

/** @typedef {import('../types.js').ModalConfig} ModalConfig */
/** @typedef {import('../types.js').Action} Action */

/**
 * Extended modal configuration
 * @typedef {Object} ExtendedModalConfig
 * @property {string} id - Modal ID (required)
 * @property {string} title - Modal title (required)
 * @property {string|Function} content - Modal content
 * @property {Array<Action>} [actions] - Modal action buttons
 * @property {'small'|'medium'|'large'|'fullscreen'} [size='medium'] - Modal size
 * @property {boolean} [closeOnEscape=true] - Close on ESC key
 * @property {boolean} [closeOnBackdrop=true] - Close on backdrop click
 * @property {boolean} [centered=true] - Center modal vertically
 * @property {boolean} [scrollable=false] - Make body scrollable
 * @property {boolean} [showClose=true] - Show close button
 * @property {'default'|'danger'|'warning'|'success'} [variant='default'] - Modal variant
 * @property {string} [className] - Additional CSS classes
 * @property {Function} [onOpen] - Callback when modal opens
 * @property {Function} [onClose] - Callback when modal closes
 */

/**
 * Modal action with additional properties
 * @typedef {Object} ModalAction
 * @property {string} label - Action label (required)
 * @property {string} name - Action name (required)
 * @property {'button'|'submit'|'reset'} [type='button'] - Button type
 * @property {string} [className] - Additional CSS classes
 * @property {boolean} [disabled=false] - Whether action is disabled
 * @property {object} [data] - Data attributes
 * @property {string} [icon] - Action icon
 * @property {string} [tooltip] - Action tooltip
 * @property {boolean} [primary=false] - Whether this is a primary action
 * @property {boolean} [dismiss=false] - Whether this dismisses the modal
 */

/**
 * Creates a modal dialog
 * @param {ExtendedModalConfig} config - Modal configuration
 * @returns {string} Modal HTML
 */
export function createModal(config) {
  validateModalConfig(config);

  const {
    id,
    title,
    content,
    actions = [],
    size = 'medium',
    closeOnEscape = true,
    closeOnBackdrop = true,
    centered = true,
    scrollable = false,
    showClose = true,
    variant = 'default',
    className = '',
  } = config;

  const sizeClass = `cb-modal-${size}`;
  const variantClass = `cb-modal-${variant}`;
  const centeredClass = centered ? 'cb-modal-centered' : '';
  const scrollableClass = scrollable ? 'cb-modal-scrollable' : '';
  const modalClasses =
    `cb-modal ${sizeClass} ${variantClass} ${centeredClass} ${scrollableClass} ${className}`.trim();

  return `
    <div id="${DomUtils.escapeHtml(id)}" 
         class="${modalClasses}"
         role="dialog"
         aria-modal="true"
         aria-labelledby="${DomUtils.escapeHtml(id)}-title"
         aria-describedby="${DomUtils.escapeHtml(id)}-body"
         data-close-on-escape="${closeOnEscape}"
         data-close-on-backdrop="${closeOnBackdrop}"
         tabindex="-1"
         style="display: none;">
      ${createModalBackdrop(closeOnBackdrop)}
      <div class="cb-modal-dialog" role="document">
        ${createModalContent(id, title, content, actions, showClose, variant)}
      </div>
    </div>
  `;
}

/**
 * Creates modal backdrop
 * @private
 * @param {boolean} closeOnBackdrop - Whether clicking backdrop closes modal
 * @returns {string} Backdrop HTML
 */
function createModalBackdrop(closeOnBackdrop) {
  return `
    <div class="cb-modal-backdrop" 
         ${closeOnBackdrop ? 'data-dismiss="modal"' : ''}
         aria-hidden="true"></div>
  `;
}

/**
 * Creates modal content container
 * @private
 * @param {string} id - Modal ID
 * @param {string} title - Modal title
 * @param {string|Function} content - Modal content
 * @param {Array<ModalAction>} actions - Modal actions
 * @param {boolean} showClose - Show close button
 * @param {string} variant - Modal variant
 * @returns {string} Modal content HTML
 */
function createModalContent(id, title, content, actions, showClose, variant) {
  return `
    <div class="cb-modal-content">
      ${createModalHeader(id, title, showClose, variant)}
      ${createModalBody(id, content)}
      ${actions.length > 0 ? createModalFooter(actions) : ''}
    </div>
  `;
}

/**
 * Creates modal header
 * @private
 * @param {string} id - Modal ID
 * @param {string} title - Modal title
 * @param {boolean} showClose - Show close button
 * @param {string} variant - Modal variant
 * @returns {string} Header HTML
 */
function createModalHeader(id, title, showClose, variant) {
  const icon = getVariantIcon(variant);

  return `
    <div class="cb-modal-header">
      <h2 id="${DomUtils.escapeHtml(id)}-title" class="cb-modal-title">
        ${icon ? `<span class="cb-modal-icon" aria-hidden="true">${icon}</span>` : ''}
        <span class="cb-modal-title-text">${DomUtils.escapeHtml(title)}</span>
      </h2>
      ${showClose ? createCloseButton() : ''}
    </div>
  `;
}

/**
 * Creates modal body
 * @private
 * @param {string} id - Modal ID
 * @param {string|Function} content - Modal content
 * @returns {string} Body HTML
 */
function createModalBody(id, content) {
  const renderedContent = typeof content === 'function' ? content() : content;

  return `
    <div id="${DomUtils.escapeHtml(id)}-body" class="cb-modal-body">
      ${renderedContent || ''}
    </div>
  `;
}

/**
 * Creates modal footer with actions
 * @private
 * @param {Array<ModalAction>} actions - Modal actions
 * @returns {string} Footer HTML
 */
function createModalFooter(actions) {
  return `
    <div class="cb-modal-footer">
      ${actions.map((action) => createModalAction(action)).join('')}
    </div>
  `;
}

/**
 * Creates modal action button
 * @private
 * @param {ModalAction} action - Action configuration
 * @returns {string} Action button HTML
 */
function createModalAction(action) {
  const isPrimary = action.primary || false;
  const isDismiss = action.dismiss || false;
  const buttonClass = isPrimary ? 'cb-btn-primary' : 'cb-btn-secondary';

  const dataAttrs = action.data
    ? Object.entries(action.data)
        .map(([k, v]) => `data-${DomUtils.escapeHtml(k)}="${DomUtils.escapeHtml(String(v))}"`)
        .join(' ')
    : '';

  return `
    <button type="${action.type || 'button'}"
            class="cb-modal-action ${buttonClass} ${action.className || ''}"
            data-action="${DomUtils.escapeHtml(action.name)}"
            ${isDismiss ? 'data-dismiss="modal"' : ''}
            ${action.disabled ? 'disabled' : ''}
            ${action.tooltip ? `title="${DomUtils.escapeHtml(action.tooltip)}"` : ''}
            ${dataAttrs}>
      ${action.icon ? `<span class="cb-action-icon">${action.icon}</span>` : ''}
      <span class="cb-action-label">${DomUtils.escapeHtml(action.label)}</span>
    </button>
  `;
}

/**
 * Creates close button
 * @private
 * @returns {string} Close button HTML
 */
function createCloseButton() {
  return `
    <button type="button"
            class="cb-modal-close"
            data-dismiss="modal"
            aria-label="Close dialog">
      <span aria-hidden="true">×</span>
    </button>
  `;
}

/**
 * Creates a confirmation modal
 * @param {Object} config - Confirmation configuration
 * @returns {string} Confirmation modal HTML
 */
export function createConfirmModal(config) {
  const {
    id = 'confirm-modal',
    title = 'Confirm Action',
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    variant = 'warning',
    onConfirm,
    onCancel,
  } = config;

  return createModal({
    id,
    title,
    content: `<p class="cb-modal-message">${DomUtils.escapeHtml(message)}</p>`,
    variant,
    size: 'small',
    actions: [
      {
        label: cancelLabel,
        name: 'cancel',
        dismiss: true,
        className: 'cb-btn-outline',
      },
      {
        label: confirmLabel,
        name: 'confirm',
        primary: true,
        data: { callback: 'onConfirm' },
      },
    ],
  });
}

/**
 * Creates an alert modal
 * @param {Object} config - Alert configuration
 * @returns {string} Alert modal HTML
 */
export function createAlertModal(config) {
  const {
    id = 'alert-modal',
    title = 'Alert',
    message,
    variant = 'default',
    dismissLabel = 'OK',
  } = config;

  return createModal({
    id,
    title,
    content: `<p class="cb-modal-message">${DomUtils.escapeHtml(message)}</p>`,
    variant,
    size: 'small',
    closeOnEscape: true,
    actions: [
      {
        label: dismissLabel,
        name: 'dismiss',
        primary: true,
        dismiss: true,
      },
    ],
  });
}

/**
 * Creates a form modal
 * @param {Object} config - Form modal configuration
 * @returns {string} Form modal HTML
 */
export function createFormModal(config) {
  const {
    id,
    title,
    fields = [],
    submitLabel = 'Submit',
    cancelLabel = 'Cancel',
    variant = 'default',
  } = config;

  const formContent = `
    <form class="cb-modal-form" id="${DomUtils.escapeHtml(id)}-form">
      ${fields.map((field) => createFormField(field)).join('')}
    </form>
  `;

  return createModal({
    id,
    title,
    content: formContent,
    variant,
    scrollable: true,
    actions: [
      {
        label: cancelLabel,
        name: 'cancel',
        dismiss: true,
      },
      {
        label: submitLabel,
        name: 'submit',
        type: 'submit',
        primary: true,
        data: { form: `${id}-form` },
      },
    ],
  });
}

/**
 * Creates a form field for modal forms
 * @private
 * @param {Object} field - Field configuration
 * @returns {string} Form field HTML
 */
function createFormField(field) {
  const {
    type = 'text',
    id,
    name,
    label,
    value = '',
    placeholder = '',
    required = false,
    disabled = false,
    help = '',
  } = field;

  const fieldId = id || `field-${name}`;

  return `
    <div class="cb-form-group">
      <label for="${DomUtils.escapeHtml(fieldId)}" class="cb-form-label">
        ${DomUtils.escapeHtml(label)}
        ${required ? '<span class="cb-required" aria-label="required">*</span>' : ''}
      </label>
      ${
        type === 'textarea'
          ? `
        <textarea id="${DomUtils.escapeHtml(fieldId)}"
                  name="${DomUtils.escapeHtml(name)}"
                  class="cb-form-control"
                  placeholder="${DomUtils.escapeHtml(placeholder)}"
                  ${required ? 'required' : ''}
                  ${disabled ? 'disabled' : ''}>${DomUtils.escapeHtml(value)}</textarea>
      `
          : `
        <input type="${DomUtils.escapeHtml(type)}"
               id="${DomUtils.escapeHtml(fieldId)}"
               name="${DomUtils.escapeHtml(name)}"
               class="cb-form-control"
               value="${DomUtils.escapeHtml(value)}"
               placeholder="${DomUtils.escapeHtml(placeholder)}"
               ${required ? 'required' : ''}
               ${disabled ? 'disabled' : ''}>
      `
      }
      ${help ? `<small class="cb-form-help">${DomUtils.escapeHtml(help)}</small>` : ''}
    </div>
  `;
}

/**
 * Creates a loading modal
 * @param {Object} config - Loading modal configuration
 * @returns {string} Loading modal HTML
 */
export function createLoadingModal(config = {}) {
  const {
    id = 'loading-modal',
    title = 'Loading',
    message = 'Please wait...',
    showProgress = false,
  } = config;

  const content = `
    <div class="cb-modal-loading">
      <div class="cb-loading-spinner" aria-hidden="true"></div>
      <p class="cb-loading-message">${DomUtils.escapeHtml(message)}</p>
      ${
        showProgress
          ? `
        <div class="cb-loading-progress">
          <div class="cb-progress-bar" role="progressbar" 
               aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">
            <span class="cb-progress-value">0%</span>
          </div>
        </div>
      `
          : ''
      }
    </div>
  `;

  return createModal({
    id,
    title,
    content,
    size: 'small',
    closeOnEscape: false,
    closeOnBackdrop: false,
    showClose: false,
    centered: true,
  });
}

/**
 * Creates a modal container for multiple modals
 * Note: This replaces the placeholder implementation in pageTemplate.js
 * @param {Array<ModalConfig>} modals - Array of modal configurations
 * @returns {string} Modals container HTML
 */
export function createModalsContainer(modals = []) {
  if (!modals.length) return '';

  return `
    <div class="cb-modals-container" aria-hidden="true">
      ${modals.map((modal) => createModal(modal)).join('')}
    </div>
  `;
}

/**
 * Gets variant icon
 * @private
 * @param {string} variant - Modal variant
 * @returns {string} Icon HTML
 */
function getVariantIcon(variant) {
  const icons = {
    danger: '⚠️',
    warning: '⚡',
    success: '✅',
    info: 'ℹ️',
  };

  return icons[variant] || '';
}

/**
 * Validates modal configuration
 * @private
 * @param {ModalConfig} config - Configuration to validate
 * @throws {Error} If configuration is invalid
 */
function validateModalConfig(config) {
  if (!config) {
    throw new Error('Modal configuration is required');
  }

  // Use project validation utilities for consistency
  string.assertNonBlank(config.id, 'id', 'Modal configuration');
  string.assertNonBlank(config.title, 'title', 'Modal configuration');
}

// Export for testing
export const __testUtils = {
  validateModalConfig,
  getVariantIcon,
};
```

### 2. Integration with Page Template

The existing `pageTemplate.js` file contains a placeholder implementation (lines 115-142) that needs to be replaced:

#### Update `src/characterBuilder/templates/core/pageTemplate.js`:

1. **Remove** the existing `createModalsContainer()` function (lines 115-142)
2. **Remove** the existing `createModalActions()` function (lines 151-157) if present
3. **Add import** at the top of the file:
   ```javascript
   import { createModalsContainer } from './modalTemplate.js';
   ```
4. **Export** the imported function if needed

### 3. Update Index Exports

#### Update `src/characterBuilder/templates/core/index.js`:

The file already has a placeholder export for `createModal`. Update it to export all modal functions:

```javascript
export {
  createModal,
  createConfirmModal,
  createAlertModal,
  createFormModal,
  createLoadingModal,
  createModalsContainer,
} from './modalTemplate.js';
```

### 4. Type Definitions

The existing `ModalConfig` type in `types.js` (lines 32-41) may need to be extended or a new `ExtendedModalConfig` type should be added. Consider whether to:

1. Extend the existing `ModalConfig` type to include all new properties
2. Create a separate `ExtendedModalConfig` that extends `ModalConfig`
3. Create a separate `ModalAction` type that extends the base `Action` type

### 5. CSS Structure (Reference)

```css
/* Modal styles to be added to character-builder.css */

.cb-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1050;
  display: none;
  overflow: hidden;
  outline: 0;
}

.cb-modal.cb-modal-open {
  display: flex;
  align-items: center;
  justify-content: center;
}

.cb-modal-backdrop {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  animation: fadeIn 0.3s;
}

.cb-modal-dialog {
  position: relative;
  width: auto;
  margin: 1rem;
  pointer-events: none;
  animation: slideIn 0.3s;
}

.cb-modal-content {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  pointer-events: auto;
  background: white;
  border-radius: 8px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  max-height: calc(100vh - 2rem);
}

/* Modal Sizes */
.cb-modal-small .cb-modal-dialog {
  max-width: 300px;
}

.cb-modal-medium .cb-modal-dialog {
  max-width: 500px;
}

.cb-modal-large .cb-modal-dialog {
  max-width: 800px;
}

.cb-modal-fullscreen .cb-modal-dialog {
  max-width: calc(100vw - 2rem);
  max-height: calc(100vh - 2rem);
}

/* Modal Variants */
.cb-modal-danger .cb-modal-header {
  background: var(--cb-danger-bg, #f8d7da);
  color: var(--cb-danger-color, #721c24);
}

.cb-modal-warning .cb-modal-header {
  background: var(--cb-warning-bg, #fff3cd);
  color: var(--cb-warning-color, #856404);
}

.cb-modal-success .cb-modal-header {
  background: var(--cb-success-bg, #d4edda);
  color: var(--cb-success-color, #155724);
}

/* Modal Parts */
.cb-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  border-bottom: 1px solid var(--cb-border-color, #dee2e6);
}

.cb-modal-body {
  position: relative;
  flex: 1 1 auto;
  padding: 1rem;
  overflow-y: auto;
}

.cb-modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 1rem;
  border-top: 1px solid var(--cb-border-color, #dee2e6);
}

/* Animations */
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideIn {
  from {
    transform: translateY(-50px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

/* Focus trap styles */
.cb-modal:focus {
  outline: none;
}

.cb-modal-close {
  padding: 0;
  background: transparent;
  border: 0;
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1;
  color: #000;
  opacity: 0.5;
  cursor: pointer;
  transition: opacity 0.2s;
}

.cb-modal-close:hover {
  opacity: 0.8;
}
```

## Implementation Steps

### Step 1: Create Modal Template File

1. Create `src/characterBuilder/templates/core/modalTemplate.js`
2. Import required utilities (`DomUtils.escapeHtml()`, `string` validation)
3. Implement all modal functions using existing project utilities
4. Add comprehensive JSDoc comments

### Step 2: Integrate with Existing Code

1. Remove placeholder implementation from `pageTemplate.js` (lines 115-142)
2. Import new modal functions in `pageTemplate.js`
3. Update exports in `index.js`

### Step 3: Implement Modal Variants

1. Basic modal with all options
2. Confirmation modal
3. Alert modal
4. Form modal
5. Loading modal

### Step 4: Add Accessibility Features

1. Proper ARIA attributes
2. Focus management setup
3. Keyboard navigation support
4. Screen reader announcements

## Testing Requirements

### Unit Tests

```javascript
// tests/unit/characterBuilder/templates/core/modalTemplate.test.js
import { describe, it, expect } from '@jest/globals';
import {
  createModal,
  createConfirmModal,
  createAlertModal,
  createFormModal,
  createLoadingModal,
  __testUtils,
} from '../../../../../src/characterBuilder/templates/core/modalTemplate.js';

describe('Modal Template System', () => {
  describe('createModal', () => {
    it('should create basic modal with required fields', () => {
      const html = createModal({
        id: 'test-modal',
        title: 'Test Modal',
        content: 'Modal content',
      });

      expect(html).toContain('test-modal');
      expect(html).toContain('Test Modal');
      expect(html).toContain('Modal content');
      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-modal="true"');
    });

    it('should support different sizes', () => {
      const small = createModal({
        id: 'modal',
        title: 'Title',
        size: 'small',
      });

      expect(small).toContain('cb-modal-small');
    });

    it('should support variants', () => {
      const danger = createModal({
        id: 'modal',
        title: 'Delete',
        variant: 'danger',
      });

      expect(danger).toContain('cb-modal-danger');
      expect(danger).toContain('⚠️');
    });

    it('should render actions', () => {
      const html = createModal({
        id: 'modal',
        title: 'Title',
        actions: [
          { label: 'Cancel', name: 'cancel' },
          { label: 'Save', name: 'save', primary: true },
        ],
      });

      expect(html).toContain('cb-modal-footer');
      expect(html).toContain('Cancel');
      expect(html).toContain('Save');
      expect(html).toContain('cb-btn-primary');
    });

    it('should escape HTML content using DomUtils', () => {
      const html = createModal({
        id: 'modal',
        title: '<script>alert("XSS")</script>',
        content: '<img onerror="alert(1)">',
      });

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });
  });

  describe('createConfirmModal', () => {
    it('should create confirmation modal', () => {
      const html = createConfirmModal({
        message: 'Are you sure?',
        confirmLabel: 'Yes',
        cancelLabel: 'No',
      });

      expect(html).toContain('Are you sure?');
      expect(html).toContain('Yes');
      expect(html).toContain('No');
      expect(html).toContain('cb-modal-warning');
    });
  });

  describe('createFormModal', () => {
    it('should create form modal with fields', () => {
      const html = createFormModal({
        id: 'form-modal',
        title: 'User Form',
        fields: [
          { name: 'username', label: 'Username', required: true },
          { name: 'email', label: 'Email', type: 'email' },
        ],
      });

      expect(html).toContain('cb-modal-form');
      expect(html).toContain('Username');
      expect(html).toContain('Email');
      expect(html).toContain('required');
    });
  });

  describe('Validation', () => {
    const { validateModalConfig } = __testUtils;

    it('should validate required fields', () => {
      expect(() => validateModalConfig(null)).toThrow();
      expect(() => validateModalConfig({})).toThrow('id is required');
      expect(() => validateModalConfig({ id: 'test' })).toThrow(
        'title is required'
      );
    });
  });
});
```

## Acceptance Criteria

- [ ] Basic modal renders with all required elements
- [ ] Modal sizes work correctly (small, medium, large, fullscreen)
- [ ] Modal variants display appropriate styling and icons
- [ ] Actions render in footer with proper styling
- [ ] Close button works when enabled
- [ ] Backdrop renders with configurable click behavior
- [ ] Form modal creates proper form structure
- [ ] Confirmation modal has correct layout
- [ ] Alert modal displays message properly
- [ ] Loading modal shows spinner and progress
- [ ] All ARIA attributes are present
- [ ] Focus management attributes included
- [ ] Content is properly HTML-escaped using DomUtils
- [ ] Validation uses project utilities (string.assertNonBlank)
- [ ] Integration with existing pageTemplate.js is clean
- [ ] All tests pass with 100% coverage

## Performance Requirements

- Template rendering < 5ms
- No memory leaks from event handlers
- Efficient HTML string concatenation

## Notes

- **IMPORTANT**: This replaces the placeholder implementation in `pageTemplate.js` (lines 115-142)
- Uses existing `DomUtils.escapeHtml()` from `src/utils/domUtils.js` (not a local implementation)
- Uses `string.assertNonBlank()` from `src/utils/validationCore.js` for validation
- The `ModalAction` type extends the base `Action` type with `primary` and `dismiss` properties
- JavaScript implementation needed for:
  - Focus trap management
  - Keyboard navigation (ESC key, Tab cycling)
  - Opening/closing animations
  - Backdrop click handling
- Consider adding transition/animation options
- May need z-index management for stacked modals

## Related Tickets

- **Depends on**: HTMLTEMP-001, HTMLTEMP-002
- **Next**: HTMLTEMP-007 (Template Composition)
- **Related**: HTMLTEMP-026 (Event Manager), HTMLTEMP-031 (Controller Integration)