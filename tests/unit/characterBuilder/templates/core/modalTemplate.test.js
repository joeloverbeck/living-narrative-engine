/**
 * @file Unit tests for modal template system
 */

import { describe, it, expect } from '@jest/globals';
import {
  createModal,
  createConfirmModal,
  createAlertModal,
  createFormModal,
  createLoadingModal,
  createModalsContainer,
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
      expect(html).toContain('aria-labelledby="test-modal-title"');
      expect(html).toContain('aria-describedby="test-modal-body"');
    });

    it('should support different sizes', () => {
      const small = createModal({
        id: 'modal',
        title: 'Title',
        size: 'small',
      });

      const medium = createModal({
        id: 'modal',
        title: 'Title',
        size: 'medium',
      });

      const large = createModal({
        id: 'modal',
        title: 'Title',
        size: 'large',
      });

      const fullscreen = createModal({
        id: 'modal',
        title: 'Title',
        size: 'fullscreen',
      });

      expect(small).toContain('cb-modal-small');
      expect(medium).toContain('cb-modal-medium');
      expect(large).toContain('cb-modal-large');
      expect(fullscreen).toContain('cb-modal-fullscreen');
    });

    it('should support different variants', () => {
      const danger = createModal({
        id: 'modal',
        title: 'Delete',
        variant: 'danger',
      });

      const warning = createModal({
        id: 'modal',
        title: 'Warning',
        variant: 'warning',
      });

      const success = createModal({
        id: 'modal',
        title: 'Success',
        variant: 'success',
      });

      expect(danger).toContain('cb-modal-danger');
      expect(danger).toContain('⚠️'); // danger icon
      expect(warning).toContain('cb-modal-warning');
      expect(warning).toContain('⚡'); // warning icon
      expect(success).toContain('cb-modal-success');
      expect(success).toContain('✅'); // success icon
    });

    it('should render actions in footer', () => {
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
      expect(html).toContain('cb-btn-secondary');
      expect(html).toContain('data-action="cancel"');
      expect(html).toContain('data-action="save"');
    });

    it('should handle dismiss actions', () => {
      const html = createModal({
        id: 'modal',
        title: 'Title',
        actions: [{ label: 'Close', name: 'close', dismiss: true }],
      });

      expect(html).toContain('data-dismiss="modal"');
    });

    it('should handle disabled actions', () => {
      const html = createModal({
        id: 'modal',
        title: 'Title',
        actions: [{ label: 'Submit', name: 'submit', disabled: true }],
      });

      expect(html).toContain('disabled');
    });

    it('should add action icons and tooltips', () => {
      const html = createModal({
        id: 'modal',
        title: 'Title',
        actions: [
          {
            label: 'Delete',
            name: 'delete',
            icon: '🗑️',
            tooltip: 'Delete this item',
          },
        ],
      });

      expect(html).toContain('🗑️');
      expect(html).toContain('title="Delete this item"');
    });

    it('should add custom data attributes to actions', () => {
      const html = createModal({
        id: 'modal',
        title: 'Title',
        actions: [
          {
            label: 'Action',
            name: 'action',
            data: { foo: 'bar', count: 42 },
          },
        ],
      });

      expect(html).toContain('data-foo="bar"');
      expect(html).toContain('data-count="42"');
    });

    it('should respect close button visibility', () => {
      const withClose = createModal({
        id: 'modal',
        title: 'Title',
        showClose: true,
      });

      const withoutClose = createModal({
        id: 'modal',
        title: 'Title',
        showClose: false,
      });

      expect(withClose).toContain('cb-modal-close');
      expect(withClose).toContain('aria-label="Close dialog"');
      expect(withoutClose).not.toContain('cb-modal-close');
    });

    it('should handle backdrop click configuration', () => {
      const clickable = createModal({
        id: 'modal',
        title: 'Title',
        closeOnBackdrop: true,
      });

      const notClickable = createModal({
        id: 'modal',
        title: 'Title',
        closeOnBackdrop: false,
      });

      expect(clickable).toContain('data-close-on-backdrop="true"');
      expect(clickable).toContain('data-dismiss="modal"');
      expect(notClickable).toContain('data-close-on-backdrop="false"');
      expect(notClickable).not.toContain(
        'cb-modal-backdrop" data-dismiss="modal"'
      );
    });

    it('should handle escape key configuration', () => {
      const escapable = createModal({
        id: 'modal',
        title: 'Title',
        closeOnEscape: true,
      });

      const notEscapable = createModal({
        id: 'modal',
        title: 'Title',
        closeOnEscape: false,
      });

      expect(escapable).toContain('data-close-on-escape="true"');
      expect(notEscapable).toContain('data-close-on-escape="false"');
    });

    it('should handle centered and scrollable options', () => {
      const centered = createModal({
        id: 'modal',
        title: 'Title',
        centered: true,
      });

      const scrollable = createModal({
        id: 'modal',
        title: 'Title',
        scrollable: true,
      });

      expect(centered).toContain('cb-modal-centered');
      expect(scrollable).toContain('cb-modal-scrollable');
    });

    it('should add custom CSS classes', () => {
      const html = createModal({
        id: 'modal',
        title: 'Title',
        className: 'custom-class another-class',
      });

      expect(html).toContain('custom-class');
      expect(html).toContain('another-class');
    });

    it('should render function content', () => {
      const contentFunction = () => '<div>Dynamic content</div>';
      const html = createModal({
        id: 'modal',
        title: 'Title',
        content: contentFunction,
      });

      expect(html).toContain('Dynamic content');
    });

    it('should escape HTML in id and title but allow content HTML', () => {
      const html = createModal({
        id: 'modal<script>',
        title: '<script>alert("XSS")</script>',
        content: '<div class="test">Valid HTML content</div>',
      });

      // ID and title should be escaped
      expect(html).toContain('id="modal&lt;script&gt;"');
      expect(html).toContain('&lt;script&gt;alert("XSS")&lt;/script&gt;');

      // Content HTML should be preserved (caller responsibility to escape if needed)
      expect(html).toContain('<div class="test">Valid HTML content</div>');
    });

    it('should set default display style to none', () => {
      const html = createModal({
        id: 'modal',
        title: 'Title',
      });

      expect(html).toContain('style="display: none;"');
    });

    it('should include tabindex for focus management', () => {
      const html = createModal({
        id: 'modal',
        title: 'Title',
      });

      expect(html).toContain('tabindex="-1"');
    });
  });

  describe('createConfirmModal', () => {
    it('should create confirmation modal with default values', () => {
      const html = createConfirmModal({
        message: 'Are you sure?',
      });

      expect(html).toContain('confirm-modal'); // default id
      expect(html).toContain('Confirm Action'); // default title
      expect(html).toContain('Are you sure?');
      expect(html).toContain('Cancel'); // default cancel label
      expect(html).toContain('Confirm'); // default confirm label
      expect(html).toContain('cb-modal-warning'); // default variant
      expect(html).toContain('cb-modal-small'); // size
    });

    it('should create confirmation modal with custom labels', () => {
      const html = createConfirmModal({
        id: 'delete-confirm',
        title: 'Delete Item',
        message: 'This cannot be undone',
        confirmLabel: 'Yes, Delete',
        cancelLabel: 'Keep It',
        variant: 'danger',
      });

      expect(html).toContain('delete-confirm');
      expect(html).toContain('Delete Item');
      expect(html).toContain('This cannot be undone');
      expect(html).toContain('Yes, Delete');
      expect(html).toContain('Keep It');
      expect(html).toContain('cb-modal-danger');
    });

    it('should properly set action properties', () => {
      const html = createConfirmModal({
        message: 'Test',
      });

      // Cancel button should have dismiss
      expect(html).toContain('data-action="cancel"');
      expect(html).toMatch(/data-action="cancel"[^>]*data-dismiss="modal"/);

      // Confirm button should be primary
      expect(html).toContain('data-action="confirm"');
      expect(html).toContain('cb-btn-primary');
    });
  });

  describe('createAlertModal', () => {
    it('should create alert modal with default values', () => {
      const html = createAlertModal({
        message: 'Operation completed',
      });

      expect(html).toContain('alert-modal'); // default id
      expect(html).toContain('Alert'); // default title
      expect(html).toContain('Operation completed');
      expect(html).toContain('OK'); // default dismiss label
      expect(html).toContain('cb-modal-default'); // default variant
      expect(html).toContain('cb-modal-small'); // size
    });

    it('should create alert modal with custom values', () => {
      const html = createAlertModal({
        id: 'success-alert',
        title: 'Success!',
        message: 'Your changes have been saved',
        variant: 'success',
        dismissLabel: 'Got it',
      });

      expect(html).toContain('success-alert');
      expect(html).toContain('Success!');
      expect(html).toContain('Your changes have been saved');
      expect(html).toContain('Got it');
      expect(html).toContain('cb-modal-success');
    });

    it('should have dismiss button as primary', () => {
      const html = createAlertModal({
        message: 'Test',
      });

      expect(html).toContain('data-action="dismiss"');
      expect(html).toContain('cb-btn-primary');
      expect(html).toContain('data-dismiss="modal"');
    });
  });

  describe('createFormModal', () => {
    it('should create form modal with fields', () => {
      const html = createFormModal({
        id: 'user-form',
        title: 'User Information',
        fields: [
          {
            name: 'username',
            label: 'Username',
            required: true,
            placeholder: 'Enter username',
          },
          {
            name: 'email',
            label: 'Email',
            type: 'email',
            help: 'We will never share your email',
          },
          {
            name: 'bio',
            label: 'Biography',
            type: 'textarea',
            placeholder: 'Tell us about yourself',
          },
        ],
      });

      expect(html).toContain('user-form');
      expect(html).toContain('User Information');
      expect(html).toContain('cb-modal-form');
      expect(html).toContain('id="user-form-form"');

      // Check fields
      expect(html).toContain('Username');
      expect(html).toContain('Email');
      expect(html).toContain('Biography');

      // Check field attributes
      expect(html).toContain('name="username"');
      expect(html).toContain('type="email"');
      expect(html).toContain('<textarea');
      expect(html).toContain('required');
      expect(html).toContain('placeholder="Enter username"');
      expect(html).toContain('We will never share your email');
    });

    it('should generate field IDs when not provided', () => {
      const html = createFormModal({
        id: 'form',
        title: 'Form',
        fields: [{ name: 'test-field', label: 'Test' }],
      });

      expect(html).toContain('id="field-test-field"');
      expect(html).toContain('for="field-test-field"');
    });

    it('should use custom field IDs when provided', () => {
      const html = createFormModal({
        id: 'form',
        title: 'Form',
        fields: [{ id: 'custom-id', name: 'field', label: 'Test' }],
      });

      expect(html).toContain('id="custom-id"');
      expect(html).toContain('for="custom-id"');
    });

    it('should handle disabled fields', () => {
      const html = createFormModal({
        id: 'form',
        title: 'Form',
        fields: [{ name: 'readonly', label: 'Read Only', disabled: true }],
      });

      expect(html).toContain('disabled');
    });

    it('should show required indicator', () => {
      const html = createFormModal({
        id: 'form',
        title: 'Form',
        fields: [{ name: 'required-field', label: 'Required', required: true }],
      });

      expect(html).toContain(
        '<span class="cb-required" aria-label="required">*</span>'
      );
    });

    it('should handle field values', () => {
      const html = createFormModal({
        id: 'form',
        title: 'Form',
        fields: [
          { name: 'input', label: 'Input', value: 'Initial value' },
          {
            name: 'textarea',
            label: 'Textarea',
            type: 'textarea',
            value: 'Text content',
          },
        ],
      });

      expect(html).toContain('value="Initial value"');
      expect(html).toContain('>Text content</textarea>');
    });

    it('should create submit and cancel actions', () => {
      const html = createFormModal({
        id: 'form',
        title: 'Form',
        submitLabel: 'Save',
        cancelLabel: 'Discard',
      });

      expect(html).toContain('Save');
      expect(html).toContain('Discard');
      expect(html).toContain('type="submit"');
      expect(html).toContain('data-form="form-form"');
    });

    it('should make form modal scrollable', () => {
      const html = createFormModal({
        id: 'form',
        title: 'Form',
        fields: [],
      });

      expect(html).toContain('cb-modal-scrollable');
    });
  });

  describe('createLoadingModal', () => {
    it('should create loading modal with defaults', () => {
      const html = createLoadingModal();

      expect(html).toContain('loading-modal'); // default id
      expect(html).toContain('Loading'); // default title
      expect(html).toContain('Please wait...'); // default message
      expect(html).toContain('cb-loading-spinner');
      expect(html).toContain('cb-modal-small');
      expect(html).toContain('data-close-on-escape="false"');
      expect(html).toContain('data-close-on-backdrop="false"');
      expect(html).not.toContain('cb-modal-close'); // no close button
    });

    it('should create loading modal with custom values', () => {
      const html = createLoadingModal({
        id: 'upload-progress',
        title: 'Uploading',
        message: 'Uploading your files...',
      });

      expect(html).toContain('upload-progress');
      expect(html).toContain('Uploading');
      expect(html).toContain('Uploading your files...');
    });

    it('should show progress bar when enabled', () => {
      const html = createLoadingModal({
        showProgress: true,
      });

      expect(html).toContain('cb-loading-progress');
      expect(html).toContain('cb-progress-bar');
      expect(html).toContain('role="progressbar"');
      expect(html).toContain('aria-valuenow="0"');
      expect(html).toContain('aria-valuemin="0"');
      expect(html).toContain('aria-valuemax="100"');
      expect(html).toContain('0%');
    });

    it('should not show progress bar when disabled', () => {
      const html = createLoadingModal({
        showProgress: false,
      });

      expect(html).not.toContain('cb-loading-progress');
      expect(html).not.toContain('cb-progress-bar');
    });
  });

  describe('createModalsContainer', () => {
    it('should return empty string for empty array', () => {
      const html = createModalsContainer([]);
      expect(html).toBe('');
    });

    it('should return empty string for no argument', () => {
      const html = createModalsContainer();
      expect(html).toBe('');
    });

    it('should create container with multiple modals', () => {
      const modals = [
        { id: 'modal1', title: 'First Modal' },
        { id: 'modal2', title: 'Second Modal' },
        { id: 'modal3', title: 'Third Modal' },
      ];

      const html = createModalsContainer(modals);

      expect(html).toContain('cb-modals-container');
      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain('modal1');
      expect(html).toContain('First Modal');
      expect(html).toContain('modal2');
      expect(html).toContain('Second Modal');
      expect(html).toContain('modal3');
      expect(html).toContain('Third Modal');
    });
  });

  describe('Validation', () => {
    const { validateModalConfig, getVariantIcon } = __testUtils;

    describe('validateModalConfig', () => {
      it('should throw error for null config', () => {
        expect(() => validateModalConfig(null)).toThrow(
          'Modal configuration is required'
        );
      });

      it('should throw error for undefined config', () => {
        expect(() => validateModalConfig(undefined)).toThrow(
          'Modal configuration is required'
        );
      });

      it('should throw error for missing id', () => {
        expect(() => validateModalConfig({})).toThrow();
        expect(() => validateModalConfig({ title: 'Test' })).toThrow();
      });

      it('should throw error for blank id', () => {
        expect(() => validateModalConfig({ id: '', title: 'Test' })).toThrow();
        expect(() =>
          validateModalConfig({ id: '   ', title: 'Test' })
        ).toThrow();
      });

      it('should throw error for missing title', () => {
        expect(() => validateModalConfig({ id: 'test' })).toThrow();
      });

      it('should throw error for blank title', () => {
        expect(() => validateModalConfig({ id: 'test', title: '' })).toThrow();
        expect(() =>
          validateModalConfig({ id: 'test', title: '   ' })
        ).toThrow();
      });

      it('should not throw for valid config', () => {
        expect(() =>
          validateModalConfig({ id: 'test', title: 'Test Modal' })
        ).not.toThrow();
      });
    });

    describe('getVariantIcon', () => {
      it('should return correct icons for variants', () => {
        expect(getVariantIcon('danger')).toBe('⚠️');
        expect(getVariantIcon('warning')).toBe('⚡');
        expect(getVariantIcon('success')).toBe('✅');
        expect(getVariantIcon('info')).toBe('ℹ️');
      });

      it('should return empty string for unknown variant', () => {
        expect(getVariantIcon('unknown')).toBe('');
        expect(getVariantIcon('default')).toBe('');
        expect(getVariantIcon()).toBe('');
      });
    });
  });

  describe('XSS Prevention', () => {
    it('should escape user-provided attributes except content', () => {
      const html = createModal({
        id: '<img src=x onerror=alert(1)>',
        title: '<script>alert("title")</script>',
        content: '<p>HTML content is preserved</p>',
        className: '"><script>alert("class")</script>',
        actions: [
          {
            label: '<script>alert("label")</script>',
            name: '"><script>alert("name")</script>',
            tooltip: '"><script>alert("tooltip")</script>',
            className: '"><script>alert("actionClass")</script>',
            data: {
              test: '"><script>alert("data")</script>',
            },
          },
        ],
      });

      // ID and title should be escaped
      expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
      expect(html).toContain('&lt;script&gt;alert("title")&lt;/script&gt;');

      // Action attributes should be escaped
      expect(html).toContain('&lt;script&gt;alert("label")&lt;/script&gt;');

      // Content HTML should be preserved
      expect(html).toContain('<p>HTML content is preserved</p>');
    });
  });

  describe('Accessibility', () => {
    it('should include all required ARIA attributes', () => {
      const html = createModal({
        id: 'accessible-modal',
        title: 'Accessible Modal',
        content: 'Content here',
      });

      // Dialog attributes
      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-modal="true"');
      expect(html).toContain('aria-labelledby="accessible-modal-title"');
      expect(html).toContain('aria-describedby="accessible-modal-body"');

      // Backdrop
      expect(html).toContain('aria-hidden="true"');

      // Close button
      expect(html).toContain('aria-label="Close dialog"');

      // Focus management
      expect(html).toContain('tabindex="-1"');
    });

    it('should include role="document" on dialog', () => {
      const html = createModal({
        id: 'modal',
        title: 'Title',
      });

      expect(html).toContain('role="document"');
    });

    it('should add aria-label for required fields', () => {
      const html = createFormModal({
        id: 'form',
        title: 'Form',
        fields: [{ name: 'field', label: 'Field', required: true }],
      });

      expect(html).toContain('aria-label="required"');
    });

    it('should add aria attributes for progress bar', () => {
      const html = createLoadingModal({ showProgress: true });

      expect(html).toContain('role="progressbar"');
      expect(html).toContain('aria-valuenow="0"');
      expect(html).toContain('aria-valuemin="0"');
      expect(html).toContain('aria-valuemax="100"');
    });
  });
});
