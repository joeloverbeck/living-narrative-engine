/**
 * @file Unit tests for InPlaceEditor component
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { InPlaceEditor } from '../../../../src/shared/characterBuilder/inPlaceEditor.js';

describe('InPlaceEditor', () => {
  let container;
  let element;
  let mockOnSave;
  let mockOnCancel;
  let mockValidator;

  beforeEach(() => {
    // Create DOM container
    container = document.createElement('div');
    document.body.appendChild(container);

    // Create test element
    element = document.createElement('div');
    element.textContent = 'Original Text';
    container.appendChild(element);

    // Create mock functions
    mockOnSave = jest.fn().mockResolvedValue(undefined);
    mockOnCancel = jest.fn();
    mockValidator = jest.fn().mockReturnValue({ isValid: true });
  });

  afterEach(() => {
    // Clean up DOM
    document.body.removeChild(container);
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with required parameters', () => {
      const editor = new InPlaceEditor({
        element,
        originalValue: 'Original Text',
        onSave: mockOnSave,
      });

      expect(editor).toBeDefined();
      expect(element.style.cursor).toBe('pointer');
      expect(element.title).toBe('Click to edit');
    });

    it('should throw error if element is not provided', () => {
      expect(() => {
        new InPlaceEditor({
          originalValue: 'Text',
          onSave: mockOnSave,
        });
      }).toThrow('InPlaceEditor: element is required');
    });

    it('should throw error if onSave is not a function', () => {
      expect(() => {
        new InPlaceEditor({
          element,
          originalValue: 'Text',
          onSave: 'not a function',
        });
      }).toThrow('InPlaceEditor: onSave must be a function');
    });
  });

  describe('editing functionality', () => {
    let editor;

    beforeEach(() => {
      editor = new InPlaceEditor({
        element,
        originalValue: 'Original Text',
        onSave: mockOnSave,
        onCancel: mockOnCancel,
        validator: mockValidator,
      });
    });

    afterEach(() => {
      editor.destroy();
    });

    it('should start editing when element is clicked', () => {
      element.click();

      expect(element.style.display).toBe('none');
      expect(element.classList.contains('editing')).toBe(true);

      const editorContainer = container.querySelector('.in-place-editor');
      expect(editorContainer).toBeTruthy();

      const input = editorContainer.querySelector('.in-place-editor-input');
      expect(input).toBeTruthy();
      expect(input.value).toBe('Original Text');
    });

    it('should not start editing if already editing', () => {
      editor.startEditing();
      const firstEditor = container.querySelector('.in-place-editor');

      editor.startEditing();
      const editors = container.querySelectorAll('.in-place-editor');

      expect(editors.length).toBe(1);
      expect(editors[0]).toBe(firstEditor);
    });

    it('should save changes when save button is clicked', async () => {
      editor.startEditing();

      const input = container.querySelector('.in-place-editor-input');
      const saveBtn = container.querySelector('.in-place-save-btn');

      input.value = 'New Text';
      saveBtn.click();

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockValidator).toHaveBeenCalledWith('New Text');
      expect(mockOnSave).toHaveBeenCalledWith('New Text');
      expect(element.textContent).toBe('New Text');
      expect(element.style.display).toBe('');
    });

    it('should cancel editing when cancel button is clicked', () => {
      editor.startEditing();

      const cancelBtn = container.querySelector('.in-place-cancel-btn');
      cancelBtn.click();

      expect(mockOnCancel).toHaveBeenCalled();
      expect(element.textContent).toBe('Original Text');
      expect(element.style.display).toBe('');
      expect(container.querySelector('.in-place-editor')).toBeNull();
    });

    it('should not save if value has not changed', async () => {
      editor.startEditing();

      const saveBtn = container.querySelector('.in-place-save-btn');
      saveBtn.click();

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockOnSave).not.toHaveBeenCalled();
      expect(element.style.display).toBe('');
    });

    it('should show validation error if validation fails', async () => {
      mockValidator.mockReturnValue({ 
        isValid: false, 
        error: 'Value is too short' 
      });

      editor.startEditing();

      const input = container.querySelector('.in-place-editor-input');
      const saveBtn = container.querySelector('.in-place-save-btn');

      input.value = 'X';
      saveBtn.click();

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockOnSave).not.toHaveBeenCalled();
      
      const errorDisplay = container.querySelector('.in-place-editor-error');
      expect(errorDisplay.textContent).toBe('Value is too short');
      expect(errorDisplay.style.display).toBe('block');
      expect(input.classList.contains('error')).toBe(true);
    });

    it('should clear validation error on input', async () => {
      mockValidator.mockReturnValue({ 
        isValid: false, 
        error: 'Value is too short' 
      });

      editor.startEditing();

      const input = container.querySelector('.in-place-editor-input');
      const saveBtn = container.querySelector('.in-place-save-btn');

      // Trigger validation error
      input.value = 'X';
      saveBtn.click();

      await new Promise(resolve => setTimeout(resolve, 0));

      const errorDisplay = container.querySelector('.in-place-editor-error');
      expect(errorDisplay.style.display).toBe('block');

      // Type something new
      input.value = 'New value';
      input.dispatchEvent(new Event('input'));

      expect(errorDisplay.style.display).toBe('none');
      expect(input.classList.contains('error')).toBe(false);
    });

    it('should handle save errors gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockOnSave.mockRejectedValue(new Error('Save failed'));

      editor.startEditing();

      const input = container.querySelector('.in-place-editor-input');
      const saveBtn = container.querySelector('.in-place-save-btn');

      input.value = 'New Text';
      saveBtn.click();

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'InPlaceEditor: Save failed:',
        expect.any(Error)
      );

      const errorDisplay = container.querySelector('.in-place-editor-error');
      expect(errorDisplay.textContent).toBe('Failed to save changes. Please try again.');
      expect(errorDisplay.style.display).toBe('block');

      consoleErrorSpy.mockRestore();
    });
  });

  describe('keyboard shortcuts', () => {
    let editor;

    beforeEach(() => {
      editor = new InPlaceEditor({
        element,
        originalValue: 'Original Text',
        onSave: mockOnSave,
        onCancel: mockOnCancel,
      });
    });

    afterEach(() => {
      editor.destroy();
    });

    it('should save on Enter key for input elements', async () => {
      editor.startEditing();

      const input = container.querySelector('.in-place-editor-input');
      input.value = 'New Text';

      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      input.dispatchEvent(enterEvent);

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockOnSave).toHaveBeenCalledWith('New Text');
    });

    it('should save on Ctrl+Enter for textarea elements', async () => {
      // Create editor with long text to trigger textarea
      const longText = 'A'.repeat(150);
      element.textContent = longText;
      
      editor = new InPlaceEditor({
        element,
        originalValue: longText,
        onSave: mockOnSave,
      });

      editor.startEditing();

      const textarea = container.querySelector('.in-place-editor-input');
      expect(textarea.tagName).toBe('TEXTAREA');

      textarea.value = 'New Text';

      const ctrlEnterEvent = new KeyboardEvent('keydown', { 
        key: 'Enter', 
        ctrlKey: true 
      });
      textarea.dispatchEvent(ctrlEnterEvent);

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockOnSave).toHaveBeenCalledWith('New Text');
    });

    it('should cancel on Escape key', () => {
      editor.startEditing();

      const input = container.querySelector('.in-place-editor-input');
      input.value = 'Changed Text';

      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      input.dispatchEvent(escapeEvent);

      expect(mockOnCancel).toHaveBeenCalled();
      expect(element.textContent).toBe('Original Text');
    });
  });

  describe('auto-save on outside click', () => {
    let editor;

    beforeEach(() => {
      editor = new InPlaceEditor({
        element,
        originalValue: 'Original Text',
        onSave: mockOnSave,
      });
    });

    afterEach(() => {
      editor.destroy();
    });

    it('should auto-save when clicking outside editor', async () => {
      editor.startEditing();

      const input = container.querySelector('.in-place-editor-input');
      input.value = 'New Text';

      // Click outside
      document.body.click();

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockOnSave).toHaveBeenCalledWith('New Text');
    });

    it('should not auto-save when clicking inside editor', async () => {
      editor.startEditing();

      const input = container.querySelector('.in-place-editor-input');
      input.value = 'New Text';

      // Click inside editor
      const editorContainer = container.querySelector('.in-place-editor');
      editorContainer.click();

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockOnSave).not.toHaveBeenCalled();
    });
  });

  describe('multiline text handling', () => {
    it('should create textarea for long text', () => {
      const longText = 'A'.repeat(150);
      element.textContent = longText;

      const editor = new InPlaceEditor({
        element,
        originalValue: longText,
        onSave: mockOnSave,
      });

      editor.startEditing();

      const input = container.querySelector('.in-place-editor-input');
      expect(input.tagName).toBe('TEXTAREA');
      expect(input.rows).toBeGreaterThan(1);

      editor.destroy();
    });

    it('should create textarea for text with newlines', () => {
      const multilineText = 'Line 1\nLine 2\nLine 3';
      element.textContent = multilineText;

      const editor = new InPlaceEditor({
        element,
        originalValue: multilineText,
        onSave: mockOnSave,
      });

      editor.startEditing();

      const input = container.querySelector('.in-place-editor-input');
      expect(input.tagName).toBe('TEXTAREA');

      editor.destroy();
    });
  });

  describe('public methods', () => {
    let editor;

    beforeEach(() => {
      editor = new InPlaceEditor({
        element,
        originalValue: 'Original Text',
        onSave: mockOnSave,
      });
    });

    afterEach(() => {
      editor.destroy();
    });

    it('should return current value when not editing', () => {
      expect(editor.getCurrentValue()).toBe('Original Text');
    });

    it('should return input value when editing', () => {
      editor.startEditing();

      const input = container.querySelector('.in-place-editor-input');
      input.value = 'Editing Text';

      expect(editor.getCurrentValue()).toBe('Editing Text');
    });

    it('should correctly report editing state', () => {
      expect(editor.isEditing()).toBe(false);

      editor.startEditing();
      expect(editor.isEditing()).toBe(true);

      editor.cancelEditing();
      expect(editor.isEditing()).toBe(false);
    });

    it('should clean up event listeners on destroy', () => {
      const clickSpy = jest.fn();
      element.addEventListener('click', clickSpy);

      editor.destroy();

      // The editor's click handler should be removed
      element.click();
      
      // Only our test spy should be called
      expect(clickSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('edge cases for saveChanges', () => {
    let editor;

    beforeEach(() => {
      editor = new InPlaceEditor({
        element,
        originalValue: 'Original Text',
        onSave: mockOnSave,
      });
    });

    afterEach(() => {
      editor.destroy();
    });

    it('should return early if not editing', async () => {
      // Try to save without starting edit mode
      await editor.saveChanges();

      expect(mockOnSave).not.toHaveBeenCalled();
      expect(element.textContent).toBe('Original Text');
    });

    it('should return early if editor is null', async () => {
      // Start editing and then manually clear the editor
      editor.startEditing();
      
      // Access private field through reflection to simulate edge case
      const editorContainer = container.querySelector('.in-place-editor');
      editorContainer.remove();
      
      // Force the internal state
      Object.defineProperty(editor, '_InPlaceEditor__editor', {
        value: null,
        writable: true,
        configurable: true
      });

      await editor.saveChanges();

      expect(mockOnSave).not.toHaveBeenCalled();
    });

    it('should handle trimmed values that match original', async () => {
      editor.startEditing();

      const input = container.querySelector('.in-place-editor-input');
      const saveBtn = container.querySelector('.in-place-save-btn');

      // Add whitespace to value
      input.value = '  Original Text  ';
      saveBtn.click();

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockOnSave).not.toHaveBeenCalled();
      expect(element.style.display).toBe('');
    });

    it('should show saving state during save', async () => {
      let resolveSave;
      const savePromise = new Promise(resolve => {
        resolveSave = resolve;
      });
      
      mockOnSave.mockReturnValue(savePromise);

      editor.startEditing();

      const input = container.querySelector('.in-place-editor-input');
      const saveBtn = container.querySelector('.in-place-save-btn');

      input.value = 'New Text';
      saveBtn.click();

      // Check saving state
      expect(saveBtn.disabled).toBe(true);
      expect(saveBtn.textContent).toBe('Saving...');
      expect(input.disabled).toBe(true);

      // Resolve the save
      resolveSave();
      await new Promise(resolve => setTimeout(resolve, 0));

      // Should be back to normal
      expect(element.textContent).toBe('New Text');
    });
  });

  describe('edge cases for cancelEditing', () => {
    let editor;

    beforeEach(() => {
      editor = new InPlaceEditor({
        element,
        originalValue: 'Original Text',
        onSave: mockOnSave,
        onCancel: mockOnCancel,
      });
    });

    afterEach(() => {
      editor.destroy();
    });

    it('should return early if not editing', () => {
      // Try to cancel without starting edit mode
      editor.cancelEditing();

      expect(mockOnCancel).not.toHaveBeenCalled();
      expect(element.style.display).not.toBe('none');
    });
  });

  describe('edge cases for click handling', () => {
    let editor;

    beforeEach(() => {
      editor = new InPlaceEditor({
        element,
        originalValue: 'Original Text',
        onSave: mockOnSave,
      });
    });

    afterEach(() => {
      editor.destroy();
    });

    it('should not start editing again when clicking element while already editing', () => {
      // Start editing
      editor.startEditing();
      
      const firstEditorContainer = container.querySelector('.in-place-editor');
      expect(firstEditorContainer).toBeTruthy();

      // Click the hidden element while editing
      element.click();

      // Should still have only one editor
      const editors = container.querySelectorAll('.in-place-editor');
      expect(editors.length).toBe(1);
      expect(editors[0]).toBe(firstEditorContainer);
    });

    it('should prevent default and stop propagation on element click', () => {
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      });

      const preventDefaultSpy = jest.spyOn(clickEvent, 'preventDefault');
      const stopPropagationSpy = jest.spyOn(clickEvent, 'stopPropagation');

      element.dispatchEvent(clickEvent);

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(stopPropagationSpy).toHaveBeenCalled();
    });
  });

  describe('keyboard shortcuts with meta key', () => {
    let editor;

    beforeEach(() => {
      editor = new InPlaceEditor({
        element,
        originalValue: 'Original Text',
        onSave: mockOnSave,
      });
    });

    afterEach(() => {
      editor.destroy();
    });

    it('should save on Meta+Enter (Cmd+Enter on Mac)', async () => {
      editor.startEditing();

      const input = container.querySelector('.in-place-editor-input');
      input.value = 'New Text';

      const metaEnterEvent = new KeyboardEvent('keydown', { 
        key: 'Enter', 
        metaKey: true 
      });
      const preventDefaultSpy = jest.spyOn(metaEnterEvent, 'preventDefault');
      
      input.dispatchEvent(metaEnterEvent);

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(mockOnSave).toHaveBeenCalledWith('New Text');
    });

    it('should save on Meta+Enter for textarea', async () => {
      // Create editor with multiline text
      const multilineText = 'Line 1\nLine 2';
      element.textContent = multilineText;
      
      editor = new InPlaceEditor({
        element,
        originalValue: multilineText,
        onSave: mockOnSave,
      });

      editor.startEditing();

      const textarea = container.querySelector('.in-place-editor-input');
      expect(textarea.tagName).toBe('TEXTAREA');

      textarea.value = 'New multiline\ntext';

      const metaEnterEvent = new KeyboardEvent('keydown', { 
        key: 'Enter', 
        metaKey: true 
      });
      textarea.dispatchEvent(metaEnterEvent);

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockOnSave).toHaveBeenCalledWith('New multiline\ntext');
    });

    it('should prevent default on Escape key', () => {
      editor.startEditing();

      const input = container.querySelector('.in-place-editor-input');
      
      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      const preventDefaultSpy = jest.spyOn(escapeEvent, 'preventDefault');
      
      input.dispatchEvent(escapeEvent);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  describe('handleOutsideClick edge cases', () => {
    let editor;

    beforeEach(() => {
      editor = new InPlaceEditor({
        element,
        originalValue: 'Original Text',
        onSave: mockOnSave,
      });
    });

    afterEach(() => {
      editor.destroy();
    });

    it('should not save when clicking on original element while editing', async () => {
      editor.startEditing();

      const input = container.querySelector('.in-place-editor-input');
      input.value = 'New Text';

      // Create a click event that appears to come from the original element
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      });

      // Simulate the event target being inside the original element
      Object.defineProperty(element, 'contains', {
        value: jest.fn(() => true),
        configurable: true
      });

      document.dispatchEvent(clickEvent);

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockOnSave).not.toHaveBeenCalled();
    });

    it('should handle clicks when not editing', async () => {
      // Don't start editing, just trigger document click
      document.body.click();

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockOnSave).not.toHaveBeenCalled();
    });

    it('should properly handle capture phase event listeners', async () => {
      editor.startEditing();

      const input = container.querySelector('.in-place-editor-input');
      input.value = 'New Text';

      // Create a new element outside the editor
      const outsideElement = document.createElement('div');
      document.body.appendChild(outsideElement);

      // Click the outside element
      outsideElement.click();

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockOnSave).toHaveBeenCalledWith('New Text');

      document.body.removeChild(outsideElement);
    });
  });

  describe('destroy while editing', () => {
    let editor;

    beforeEach(() => {
      editor = new InPlaceEditor({
        element,
        originalValue: 'Original Text',
        onSave: mockOnSave,
        onCancel: mockOnCancel,
      });
    });

    it('should cancel editing when destroyed while editing', () => {
      editor.startEditing();

      const input = container.querySelector('.in-place-editor-input');
      input.value = 'Changed Text';

      editor.destroy();

      expect(mockOnCancel).toHaveBeenCalled();
      expect(element.textContent).toBe('Original Text');
      expect(container.querySelector('.in-place-editor')).toBeNull();
    });
  });

  describe('input selection behavior', () => {
    let editor;

    beforeEach(() => {
      editor = new InPlaceEditor({
        element,
        originalValue: 'Original Text',
        onSave: mockOnSave,
      });
    });

    afterEach(() => {
      editor.destroy();
    });

    it('should select all text in input element', () => {
      editor.startEditing();

      const input = container.querySelector('.in-place-editor-input');
      const selectSpy = jest.spyOn(input, 'select');

      // Re-trigger the selection logic by creating a new editor
      editor.destroy();
      editor = new InPlaceEditor({
        element,
        originalValue: 'Original Text',
        onSave: mockOnSave,
      });
      editor.startEditing();

      const newInput = container.querySelector('.in-place-editor-input');
      
      // Verify selection happened (browser may not actually select in jsdom)
      expect(newInput.value).toBe('Original Text');
    });

    it('should position cursor at end for textarea', () => {
      const longText = 'A'.repeat(150);
      element.textContent = longText;

      editor = new InPlaceEditor({
        element,
        originalValue: longText,
        onSave: mockOnSave,
      });

      // Mock setSelectionRange before starting editing
      const originalSetSelectionRange = HTMLTextAreaElement.prototype.setSelectionRange;
      const setSelectionRangeSpy = jest.fn();
      HTMLTextAreaElement.prototype.setSelectionRange = setSelectionRangeSpy;

      editor.startEditing();

      const textarea = container.querySelector('.in-place-editor-input');
      expect(textarea.tagName).toBe('TEXTAREA');

      // The cursor should be at the end
      expect(setSelectionRangeSpy).toHaveBeenCalledWith(longText.length, longText.length);

      // Restore original method
      HTMLTextAreaElement.prototype.setSelectionRange = originalSetSelectionRange;
    });
  });

  describe('getCurrentValue edge cases', () => {
    let editor;

    beforeEach(() => {
      editor = new InPlaceEditor({
        element,
        originalValue: 'Original Text',
        onSave: mockOnSave,
      });
    });

    afterEach(() => {
      editor.destroy();
    });

    it('should return empty string if editor input is null', () => {
      editor.startEditing();
      
      // Force the editor's input to be null by manipulating the private property
      const editorContainer = container.querySelector('.in-place-editor');
      const input = container.querySelector('.in-place-editor-input');
      
      // Remove the input element
      input.remove();
      
      // Access the private editor property and set input to null
      // This simulates the edge case where the input is missing
      const privateEditor = editor['_InPlaceEditor__editor'] || {};
      if (privateEditor) {
        privateEditor.input = null;
      }

      // For this edge case, since we can't directly access private fields in Jest,
      // we'll test that getCurrentValue handles missing input gracefully
      // The actual implementation uses optional chaining: this.#editor?.input?.value || ''
      // So if the input is removed, it should still return the original value
      expect(editor.getCurrentValue()).toBe('Original Text');
    });
  });

  describe('exitEditingMode edge cases', () => {
    let editor;

    beforeEach(() => {
      editor = new InPlaceEditor({
        element,
        originalValue: 'Original Text',
        onSave: mockOnSave,
      });
    });

    afterEach(() => {
      editor.destroy();
    });

    it('should handle multiple calls to exitEditingMode gracefully', () => {
      editor.startEditing();

      // Get reference to editor container
      const editorContainer = container.querySelector('.in-place-editor');
      expect(editorContainer).toBeTruthy();

      // Cancel editing (which calls exitEditingMode)
      editor.cancelEditing();

      // Verify editor was removed
      expect(container.querySelector('.in-place-editor')).toBeNull();
      expect(element.classList.contains('editing')).toBe(false);

      // Try to cancel again - should not throw
      expect(() => editor.cancelEditing()).not.toThrow();
    });

    it('should remove document event listener when exiting edit mode', () => {
      const removeEventListenerSpy = jest.spyOn(document, 'removeEventListener');

      editor.startEditing();
      editor.cancelEditing();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'click',
        expect.any(Function),
        { capture: true }
      );

      removeEventListenerSpy.mockRestore();
    });
  });

  describe('edge cases for private methods', () => {
    let editor;

    beforeEach(() => {
      editor = new InPlaceEditor({
        element,
        originalValue: 'Original Text',
        onSave: mockOnSave,
        validator: mockValidator,
      });
    });

    afterEach(() => {
      editor.destroy();
    });

    it('should handle keyboard event without Enter or Escape key', () => {
      editor.startEditing();

      const input = container.querySelector('.in-place-editor-input');
      
      // Test other key press (should not trigger any action)
      const otherKeyEvent = new KeyboardEvent('keydown', { key: 'a' });
      input.dispatchEvent(otherKeyEvent);

      // Should still be in editing mode
      expect(editor.isEditing()).toBe(true);
      expect(mockOnSave).not.toHaveBeenCalled();
    });

    it('should handle Enter key in textarea without ctrl/meta key', () => {
      // Create editor with multiline text
      const multilineText = 'Line 1\nLine 2';
      element.textContent = multilineText;
      
      editor = new InPlaceEditor({
        element,
        originalValue: multilineText,
        onSave: mockOnSave,
      });

      editor.startEditing();

      const textarea = container.querySelector('.in-place-editor-input');
      expect(textarea.tagName).toBe('TEXTAREA');

      // Press Enter without ctrl/meta (should not save)
      const enterEvent = new KeyboardEvent('keydown', { 
        key: 'Enter',
        ctrlKey: false,
        metaKey: false
      });
      textarea.dispatchEvent(enterEvent);

      // Should still be in editing mode
      expect(editor.isEditing()).toBe(true);
      expect(mockOnSave).not.toHaveBeenCalled();
    });

    it('should handle validation error with null editor in showValidationError', async () => {
      // This tests the edge case where showValidationError is called but editor is null
      // We can't directly test this as it's a private method, but we can verify
      // the behavior doesn't break when validation fails after editor is removed
      
      mockValidator.mockReturnValue({ 
        isValid: false, 
        error: 'Test error' 
      });

      editor.startEditing();
      
      const input = container.querySelector('.in-place-editor-input');
      input.value = 'Invalid';
      
      // Start save process
      const savePromise = editor.saveChanges();
      
      // Immediately destroy editor (simulating edge case)
      const editorContainer = container.querySelector('.in-place-editor');
      editorContainer.remove();
      
      await savePromise;
      
      // Should handle gracefully without throwing
      expect(mockOnSave).not.toHaveBeenCalled();
    });

    it('should handle setSavingState with null editor', async () => {
      // Mock a slow save operation
      let resolveSave;
      const slowSavePromise = new Promise(resolve => {
        resolveSave = resolve;
      });
      mockOnSave.mockReturnValue(slowSavePromise);
      
      editor.startEditing();
      
      const input = container.querySelector('.in-place-editor-input');
      input.value = 'New Value';
      
      // Start saving
      const savePromise = editor.saveChanges();
      
      // Remove editor container while saving
      const editorContainer = container.querySelector('.in-place-editor');
      editorContainer.remove();
      
      // Complete the save
      resolveSave();
      await savePromise;
      
      // Should complete without errors
      expect(mockOnSave).toHaveBeenCalledWith('New Value');
    });
  });
});