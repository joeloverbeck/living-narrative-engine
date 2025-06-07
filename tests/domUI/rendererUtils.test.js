// tests/domUI/rendererUtils.test.js

/**
 * @file Unit tests for the RendererUtils module.
 * @see Ticket: Safe Rendering & Truncation Utilities
 */

import { describe, expect, it, jest } from '@jest/globals';
import {
  createToggleElement,
  escapeHtml,
  truncateText,
} from '../../src/utils/rendererUtils.js';

describe('RendererUtils', () => {
  describe('escapeHtml', () => {
    it('should correctly escape all special HTML characters', () => {
      const input = `<script>"'&</script>`;
      const expected = `&lt;script&gt;&quot;&#39;&amp;&lt;/script&gt;`;
      expect(escapeHtml(input)).toBe(expected);
    });

    it('should return an empty string for non-string inputs', () => {
      expect(escapeHtml(null)).toBe('');
      expect(escapeHtml(undefined)).toBe('');
      expect(escapeHtml(123)).toBe('');
      expect(escapeHtml({})).toBe('');
    });

    it('should pass the XSS script specified in the acceptance criteria', () => {
      const input = "<script>alert('X')</script>";
      // FIX: The expectation is updated to reflect the correct and safer behavior
      // of escaping single quotes.
      const expected = '&lt;script&gt;alert(&#39;X&#39;)&lt;/script&gt;';
      expect(escapeHtml(input)).toBe(expected);
    });
  });

  describe('truncateText', () => {
    it('should not truncate text shorter than or equal to maxLength', () => {
      const text = 'Hello world';
      const result = truncateText(text, 20);
      expect(result.truncated).toBe(false);
      expect(result.preview).toBe(text);
      expect(result.remainder).toBe('');
    });

    it('should truncate text longer than maxLength', () => {
      const text = 'This is a long string that needs to be truncated.';
      const result = truncateText(text, 10);
      expect(result.truncated).toBe(true);
      expect(result.preview).toBe('This is a ');
      expect(result.remainder).toBe('long string that needs to be truncated.');
    });

    it('should correctly partition a 500-char string with a 200-char limit', () => {
      const longString = 'a'.repeat(500);
      const result = truncateText(longString, 200);
      expect(result.truncated).toBe(true);
      expect(result.preview.length).toBe(200);
      expect(result.remainder.length).toBe(300);
      expect(result.preview).toBe('a'.repeat(200));
      expect(result.remainder).toBe('a'.repeat(300));
    });

    it('should correctly handle a 2000-char JSON string with a 100-char limit', () => {
      const longJson = JSON.stringify({ key: 'a'.repeat(1989) }); // ~2000 chars
      const result = truncateText(longJson, 100);
      expect(result.truncated).toBe(true);
      expect(result.preview.length).toBe(100);
      expect(result.remainder.length).toBe(longJson.length - 100);
      expect(result.preview).toBe(longJson.slice(0, 100));
      expect(result.remainder).toBe(longJson.slice(100));
    });
  });

  describe('createToggleElement & Toggling Behavior', () => {
    it('should create a "Show more" button for the "collapsed" initial state', () => {
      const button = createToggleElement('text', 'collapsed');
      expect(button.tagName).toBe('BUTTON');
      expect(button.textContent).toBe('Show more');
      expect(button.classList.contains('toggle-text')).toBe(true);
      expect(button.getAttribute('tabindex')).toBe('0');
    });

    it('should create a "Show less" button for the "expanded" initial state', () => {
      const button = createToggleElement('details', 'expanded');
      expect(button.textContent).toBe('Show less');
      expect(button.classList.contains('toggle-details')).toBe(true);
    });

    it('should facilitate toggling between preview and full text on click', () => {
      // --- Arrange ---
      document.body.innerHTML = '<div id="container"></div>';
      const container = document.getElementById('container');

      const fullText = 'This is the preview. ' + 'This is the remainder.';
      const { preview, remainder } = truncateText(fullText, 21);

      // Create DOM structure to simulate usage in ChatAlertRenderer
      const previewSpan = document.createElement('span');
      previewSpan.textContent = preview;

      const remainderSpan = document.createElement('span');
      remainderSpan.textContent = remainder;
      remainderSpan.style.display = 'none'; // Initially hidden

      const toggleButton = createToggleElement('text', 'collapsed');

      container.appendChild(previewSpan);
      container.appendChild(remainderSpan);
      container.appendChild(toggleButton);

      // Add the event listener that ChatAlertRenderer would add
      toggleButton.addEventListener('click', () => {
        const isCollapsed = remainderSpan.style.display === 'none';
        if (isCollapsed) {
          remainderSpan.style.display = 'inline';
          toggleButton.textContent = 'Show less';
        } else {
          remainderSpan.style.display = 'none';
          toggleButton.textContent = 'Show more';
        }
      });

      // --- Assert Initial State ---
      // FIX: Assert against specific element properties instead of unreliable
      // container.textContent, which ignores `display: none`.
      expect(previewSpan.textContent).toBe('This is the preview. ');
      expect(remainderSpan.style.display).toBe('none');
      expect(toggleButton.textContent).toBe('Show more');

      // --- Act: Simulate first click to expand ---
      toggleButton.click();

      // --- Assert Expanded State ---
      expect(remainderSpan.style.display).toBe('inline');
      expect(toggleButton.textContent).toBe('Show less');

      // --- Act: Simulate second click to collapse ---
      toggleButton.click();

      // --- Assert Collapsed State ---
      expect(remainderSpan.style.display).toBe('none');
      expect(toggleButton.textContent).toBe('Show more');
    });
  });
});
