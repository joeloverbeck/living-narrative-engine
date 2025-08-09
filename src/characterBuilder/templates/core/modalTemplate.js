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
 *
 * @typedef {object} ExtendedModalConfig
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
 *
 * @typedef {object} ModalAction
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
 *
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
    `cb-modal ${sizeClass} ${variantClass} ${centeredClass} ${scrollableClass} ${DomUtils.escapeHtml(className)}`.trim();

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
 *
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
 *
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
 *
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
 *
 * @private
 * @param {string} id - Modal ID
 * @param {string|Function} content - Modal content
 * @returns {string} Body HTML
 */
function createModalBody(id, content) {
  const renderedContent = typeof content === 'function' ? content() : content;
  // Note: Content is not escaped here as it may contain HTML markup
  // Caller is responsible for escaping if needed

  return `
    <div id="${DomUtils.escapeHtml(id)}-body" class="cb-modal-body">
      ${renderedContent || ''}
    </div>
  `;
}

/**
 * Creates modal footer with actions
 *
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
 *
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
        .map(
          ([k, v]) =>
            `data-${DomUtils.escapeHtml(k)}="${DomUtils.escapeHtml(String(v))}"`
        )
        .join(' ')
    : '';

  return `
    <button type="${action.type || 'button'}"
            class="cb-modal-action ${buttonClass} ${DomUtils.escapeHtml(action.className || '')}"
            data-action="${DomUtils.escapeHtml(action.name)}"
            ${isDismiss ? 'data-dismiss="modal"' : ''}
            ${action.disabled ? 'disabled' : ''}
            ${action.tooltip ? `title="${DomUtils.escapeHtml(action.tooltip)}"` : ''}
            ${dataAttrs}>
      ${action.icon ? `<span class="cb-action-icon">${DomUtils.escapeHtml(action.icon)}</span>` : ''}
      <span class="cb-action-label">${DomUtils.escapeHtml(action.label)}</span>
    </button>
  `;
}

/**
 * Creates close button
 *
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
 *
 * @param {object} config - Confirmation configuration
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
    onConfirm: _onConfirm,
    onCancel: _onCancel,
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
 *
 * @param {object} config - Alert configuration
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
 *
 * @param {object} config - Form modal configuration
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
 *
 * @private
 * @param {object} field - Field configuration
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
 *
 * @param {object} config - Loading modal configuration
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
 *
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
 *
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
 *
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
