import { describe, it, expect, beforeEach } from '@jest/globals';
import { DomUtils } from '../../../src/utils/domUtils.js';

describe('DomUtils', () => {
  beforeEach(() => {
    // Setup DOM environment for tests
    document.body.innerHTML = '';
  });

  describe('clearElement', () => {
    it('should remove all child nodes from an element', () => {
      const div = document.createElement('div');
      div.innerHTML = '<span>Child 1</span><span>Child 2</span>';
      expect(div.childNodes.length).toBe(2);

      DomUtils.clearElement(div);
      expect(div.childNodes.length).toBe(0);
    });

    it('should handle null or undefined gracefully', () => {
      expect(() => DomUtils.clearElement(null)).not.toThrow();
      expect(() => DomUtils.clearElement(undefined)).not.toThrow();
    });

    it('should handle empty element', () => {
      const div = document.createElement('div');
      expect(() => DomUtils.clearElement(div)).not.toThrow();
      expect(div.childNodes.length).toBe(0);
    });
  });

  describe('escapeHtml', () => {
    it('should escape HTML special characters', () => {
      expect(DomUtils.escapeHtml('<script>alert("XSS")</script>')).toBe(
        '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'
      );

      expect(DomUtils.escapeHtml('Hello & goodbye')).toBe(
        'Hello &amp; goodbye'
      );

      expect(DomUtils.escapeHtml('"Quotes" and \'apostrophes\'')).toBe(
        '&quot;Quotes&quot; and &#x27;apostrophes&#x27;'
      );
    });

    it('should handle empty string', () => {
      expect(DomUtils.escapeHtml('')).toBe('');
    });

    it('should handle null or undefined', () => {
      expect(DomUtils.escapeHtml(null)).toBe('');
      expect(DomUtils.escapeHtml(undefined)).toBe('');
    });

    it('should handle plain text without changes', () => {
      expect(DomUtils.escapeHtml('Hello world')).toBe('Hello world');
    });
  });

  describe('textToHtml', () => {
    it('should convert newlines to <br> tags', () => {
      expect(DomUtils.textToHtml('Line 1\nLine 2\nLine 3')).toBe(
        'Line 1<br>Line 2<br>Line 3'
      );
    });

    it('should escape HTML while converting newlines', () => {
      expect(
        DomUtils.textToHtml('<script>alert("XSS")</script>\nNext line')
      ).toBe(
        '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;<br>Next line'
      );
    });

    it('should handle Windows-style line breaks', () => {
      expect(DomUtils.textToHtml('Line 1\r\nLine 2')).toBe(
        'Line 1\r<br>Line 2'
      );
    });

    it('should handle multiple consecutive newlines', () => {
      expect(DomUtils.textToHtml('Line 1\n\nLine 3')).toBe(
        'Line 1<br><br>Line 3'
      );
    });

    it('should handle empty string', () => {
      expect(DomUtils.textToHtml('')).toBe('');
    });

    it('should handle null or undefined', () => {
      expect(DomUtils.textToHtml(null)).toBe('');
      expect(DomUtils.textToHtml(undefined)).toBe('');
    });

    it('should handle text without newlines', () => {
      expect(DomUtils.textToHtml('Single line text')).toBe('Single line text');
    });

    it('should handle anatomy descriptions correctly', () => {
      const anatomyDescription =
        'Hair: long, blonde, wavy\nEyes: green, almond\nBreasts: G-cup, meaty, soft\nLegs: long, shapely\nPubic hair: curly';
      const expected =
        'Hair: long, blonde, wavy<br>Eyes: green, almond<br>Breasts: G-cup, meaty, soft<br>Legs: long, shapely<br>Pubic hair: curly';
      expect(DomUtils.textToHtml(anatomyDescription)).toBe(expected);
    });
  });
});
