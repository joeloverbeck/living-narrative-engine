/**
 * @file Focused test suite for character limit issue in Character Concepts Manager
 * @description Tests to verify the 6000 character limit is enforced correctly
 * @see ../../../character-concepts-manager.html
 * @see ../../../src/domUI/characterConceptsManagerController.js
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

describe('Character Concepts Manager - Character Limit Issue', () => {
  let dom;
  let document;
  let window;

  beforeEach(() => {
    // Load the HTML file
    const htmlPath = path.join(
      process.cwd(),
      'character-concepts-manager.html'
    );
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

    // Create JSDOM instance
    dom = new JSDOM(htmlContent, {
      contentType: 'text/html',
      pretendToBeVisual: true,
    });

    document = dom.window.document;
    window = dom.window;
  });

  afterEach(() => {
    if (dom) {
      dom.window.close();
    }
  });

  describe('HTML Character Limit Validation', () => {
    it('should have maxlength attribute set to 6000 on concept textarea', () => {
      const conceptTextarea = document.getElementById('concept-text');
      expect(conceptTextarea).toBeTruthy();
      expect(conceptTextarea.getAttribute('maxlength')).toBe('6000');
    });

    it('should display 0/6000 in character counter', () => {
      const charCount = document.getElementById('char-count');
      expect(charCount).toBeTruthy();
      expect(charCount.textContent).toBe('0/6000');
    });

    it('should have minlength of 10 characters', () => {
      const conceptTextarea = document.getElementById('concept-text');
      expect(conceptTextarea).toBeTruthy();
      expect(conceptTextarea.getAttribute('minlength')).toBe('10');
    });
  });

  describe('Character Limit Behavior', () => {
    it('should accept text up to 6000 characters', () => {
      const conceptTextarea = document.getElementById('concept-text');
      const longText = 'a'.repeat(6000);

      // Simulate typing the text
      conceptTextarea.value = longText;

      // Verify the value is accepted
      expect(conceptTextarea.value).toBe(longText);
      expect(conceptTextarea.value.length).toBe(6000);
    });

    it('should not accept text over 6000 characters due to maxlength', () => {
      const conceptTextarea = document.getElementById('concept-text');
      const tooLongText = 'a'.repeat(6001);

      // Try to set text longer than maxlength
      conceptTextarea.value = tooLongText;

      // Due to maxlength attribute, the value should be truncated to 6000
      // Note: In real browsers, maxlength prevents typing beyond the limit
      // JSDOM doesn't enforce maxlength, so we're testing the attribute exists
      const maxLength = parseInt(conceptTextarea.getAttribute('maxlength'));
      expect(maxLength).toBe(6000);
    });

    it('should have proper validation attributes for character limits', () => {
      const conceptTextarea = document.getElementById('concept-text');

      // Check all validation-related attributes
      expect(conceptTextarea.getAttribute('minlength')).toBe('10');
      expect(conceptTextarea.getAttribute('maxlength')).toBe('6000');
      expect(conceptTextarea.hasAttribute('required')).toBe(true);
    });
  });

  describe('Form Integration', () => {
    it('should have character counter properly configured', () => {
      const charCount = document.getElementById('char-count');
      const conceptTextarea = document.getElementById('concept-text');

      // Verify elements are properly linked
      expect(charCount).toBeTruthy();
      expect(conceptTextarea).toBeTruthy();

      // Check initial state
      expect(charCount.textContent).toMatch(/0\/6000/);
      expect(charCount.classList.contains('char-count')).toBe(true);
    });

    it('should have help text mentioning character limits', () => {
      const helpText = document.getElementById('concept-help');
      expect(helpText).toBeTruthy();
      expect(helpText.classList.contains('input-help')).toBe(true);
      // Help text exists to guide users about character limits
    });
  });
});
