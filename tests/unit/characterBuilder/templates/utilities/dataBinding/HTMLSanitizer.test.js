/**
 * @file Unit tests for HTMLSanitizer
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { HTMLSanitizer } from '../../../../../../src/characterBuilder/templates/utilities/dataBinding/HTMLSanitizer.js';

// Mock JSDOM for DOM operations
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.document = dom.window.document;
global.window = dom.window;
global.Node = dom.window.Node;
global.URL = dom.window.URL;

describe('HTMLSanitizer', () => {
  let sanitizer;

  beforeEach(() => {
    sanitizer = new HTMLSanitizer();
  });

  describe('constructor', () => {
    it('should create sanitizer with default configuration', () => {
      expect(sanitizer).toBeInstanceOf(HTMLSanitizer);
    });

    it('should create sanitizer with custom configuration', () => {
      const customSanitizer = new HTMLSanitizer({
        allowedTags: new Set(['div', 'span']),
        allowDataUri: true,
      });
      expect(customSanitizer).toBeInstanceOf(HTMLSanitizer);
    });
  });

  describe('sanitize()', () => {
    it('should allow safe HTML tags', () => {
      const html = '<div><p>Safe content</p><strong>Bold</strong></div>';
      const result = sanitizer.sanitize(html);

      expect(result).toContain('<div>');
      expect(result).toContain('<p>');
      expect(result).toContain('<strong>');
      expect(result).toContain('Safe content');
    });

    it('should remove script tags', () => {
      const html = '<div>Safe content<script>alert("xss")</script></div>';
      const result = sanitizer.sanitize(html);

      expect(result).not.toContain('<script>');
      expect(result).not.toContain('alert("xss")');
      expect(result).toContain('Safe content');
    });

    it('should remove dangerous attributes', () => {
      const html = '<div onclick="alert(1)" onload="alert(2)">Content</div>';
      const result = sanitizer.sanitize(html);

      expect(result).not.toContain('onclick');
      expect(result).not.toContain('onload');
      expect(result).toContain('Content');
    });

    it('should sanitize href attributes', () => {
      const html = '<a href="javascript:alert(1)">Link</a>';
      const result = sanitizer.sanitize(html);

      expect(result).not.toContain('javascript:');
      expect(result).toContain('Link');
    });

    it('should allow safe URLs', () => {
      const html = '<a href="https://example.com">Link</a>';
      const result = sanitizer.sanitize(html);

      expect(result).toContain('https://example.com');
      expect(result).toContain('Link');
    });

    it('should remove dangerous CSS', () => {
      const html =
        '<div style="background: url(javascript:alert(1))">Content</div>';
      const result = sanitizer.sanitize(html);

      expect(result).not.toContain('javascript:');
      expect(result).toContain('Content');
    });

    it('should handle empty input', () => {
      expect(sanitizer.sanitize('')).toBe('');
      expect(sanitizer.sanitize(null)).toBe('');
      expect(sanitizer.sanitize(undefined)).toBe('');
    });

    it('should remove comments', () => {
      const html = '<div><!-- comment --><p>Content</p></div>';
      const result = sanitizer.sanitize(html);

      expect(result).not.toContain('<!-- comment -->');
      expect(result).toContain('<p>Content</p>');
    });

    it('should replace disallowed tags with text content', () => {
      const html = '<video>Video content</video>';
      const result = sanitizer.sanitize(html);

      expect(result).not.toContain('<video>');
      expect(result).toContain('Video content');
    });
  });

  describe('escapeHtml()', () => {
    it('should escape HTML special characters', () => {
      const text = '<script>alert("test")</script>';
      const result = sanitizer.escapeHtml(text);

      expect(result).toContain('&lt;');
      expect(result).toContain('&gt;');
      expect(result).not.toContain('<script>');
    });

    it('should handle empty input', () => {
      expect(sanitizer.escapeHtml('')).toBe('');
      expect(sanitizer.escapeHtml(null)).toBe('');
    });

    it('should escape quotes', () => {
      const text = 'He said "Hello" & \'Goodbye\'';
      const result = sanitizer.escapeHtml(text);

      expect(result).toContain('&amp;');
      expect(result).toContain('&quot;');
    });
  });

  describe('configuration', () => {
    it('should allow custom allowed tags', () => {
      sanitizer.setAllowedTags(['div', 'span']);
      const html = '<div><span>Allowed</span><p>Not allowed</p></div>';
      const result = sanitizer.sanitize(html);

      expect(result).toContain('<div>');
      expect(result).toContain('<span>');
      expect(result).not.toContain('<p>');
      expect(result).toContain('Not allowed'); // Text content preserved
    });

    it('should allow adding tags', () => {
      sanitizer.addAllowedTags(['video', 'audio']);
      const html = '<video>Video content</video>';
      const result = sanitizer.sanitize(html);

      expect(result).toContain('<video>');
    });

    it('should allow custom attributes per tag', () => {
      sanitizer.setAllowedAttributes('a', ['href', 'target', 'custom-attr']);
      const html = '<a href="#" target="_blank" custom-attr="value">Link</a>';
      const result = sanitizer.sanitize(html);

      expect(result).toContain('href="#"');
      expect(result).toContain('target="_blank"');
      expect(result).toContain('custom-attr="value"');
    });
  });

  describe('URL sanitization', () => {
    it('should block javascript URLs', () => {
      const html = '<a href="javascript:alert(1)">Link</a>';
      const result = sanitizer.sanitize(html);

      expect(result).toContain('<a');
      expect(result).not.toContain('javascript:');
    });

    it('should allow data URLs when configured', () => {
      const dataSanitizer = new HTMLSanitizer({ allowDataUri: true });
      const html = '<img src="data:image/gif;base64,R0lGOD...">';
      const result = dataSanitizer.sanitize(html);

      expect(result).toContain('data:image/gif');
    });

    it('should block data URLs by default', () => {
      const html = '<img src="data:image/gif;base64,R0lGOD...">';
      const result = sanitizer.sanitize(html);

      expect(result).not.toContain('data:image/gif');
    });

    it('should allow relative URLs', () => {
      const html = '<a href="/path/to/page">Link</a>';
      const result = sanitizer.sanitize(html);

      expect(result).toContain('href="/path/to/page"');
    });
  });

  describe('style sanitization', () => {
    it('should remove dangerous CSS expressions', () => {
      const html =
        '<div style="background: expression(alert(1))">Content</div>';
      const result = sanitizer.sanitize(html);

      expect(result).not.toContain('expression(');
      expect(result).toContain('Content');
    });

    it('should remove CSS imports', () => {
      const html = '<div style="@import url(malicious.css)">Content</div>';
      const result = sanitizer.sanitize(html);

      expect(result).not.toContain('@import');
    });

    it('should allow safe CSS', () => {
      const html = '<div style="color: red; font-size: 14px;">Content</div>';
      const result = sanitizer.sanitize(html);

      expect(result).toContain('color: red');
      expect(result).toContain('font-size: 14px');
    });
  });

  describe('edge cases', () => {
    it('should handle malformed HTML', () => {
      const html = '<div><span>Unclosed tags';
      const result = sanitizer.sanitize(html);

      expect(result).toBeDefined();
      expect(result).toContain('Unclosed tags');
    });

    it('should handle deeply nested elements', () => {
      const html =
        '<div><div><div><div><span>Deep</span></div></div></div></div>';
      const result = sanitizer.sanitize(html);

      expect(result).toContain('Deep');
      expect(result).toContain('<span>');
    });

    it('should handle mixed content', () => {
      const html = 'Text before <div>HTML content</div> text after';
      const result = sanitizer.sanitize(html);

      expect(result).toContain('Text before');
      expect(result).toContain('<div>');
      expect(result).toContain('HTML content');
      expect(result).toContain('text after');
    });

    it('should handle special characters in attributes', () => {
      const html = '<div title="Title with &quot;quotes&quot;">Content</div>';
      const result = sanitizer.sanitize(html);

      expect(result).toContain('title=');
      expect(result).toContain('Content');
    });
  });
});
