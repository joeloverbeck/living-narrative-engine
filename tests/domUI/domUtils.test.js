import { DomUtils } from '../../src/domUI/domUtils.js';
import { describe, expect, it } from '@jest/globals';

describe('DomUtils.escapeHtml', () => {
  it('should return an empty string for non-string inputs', () => {
    expect(DomUtils.escapeHtml(null)).toBe('');
    expect(DomUtils.escapeHtml(undefined)).toBe('');
    expect(DomUtils.escapeHtml(123)).toBe('');
    expect(DomUtils.escapeHtml({})).toBe('');
    expect(DomUtils.escapeHtml([])).toBe('');
    expect(DomUtils.escapeHtml(() => {})).toBe('');
  });

  it('should return an empty string for an empty string input', () => {
    expect(DomUtils.escapeHtml('')).toBe('');
  });

  it('should not alter a string with no special characters', () => {
    const safeString = 'Hello world, this is a test.';
    expect(DomUtils.escapeHtml(safeString)).toBe(safeString);
  });

  it('should escape the ampersand character', () => {
    expect(DomUtils.escapeHtml('AT&T')).toBe('AT&amp;T');
  });

  it('should escape the less-than character', () => {
    expect(DomUtils.escapeHtml('<div>')).toBe('&lt;div&gt;');
  });

  it('should escape the greater-than character', () => {
    expect(DomUtils.escapeHtml('a > b')).toBe('a &gt; b');
  });

  it('should escape the double-quote character', () => {
    expect(DomUtils.escapeHtml('He said "Hello"')).toBe(
      'He said &quot;Hello&quot;'
    );
  });

  it('should escape the single-quote character', () => {
    expect(DomUtils.escapeHtml("It's a beautiful day")).toBe(
      'It&#39;s a beautiful day'
    );
  });

  it('should escape all special characters in a single string', () => {
    const maliciousInput =
      '<script>window.location.href = "http://evil.com?q=\'foo\'&bar=baz"</script>';
    const expectedOutput =
      '&lt;script&gt;window.location.href = &quot;http://evil.com?q=&#39;foo&#39;&amp;bar=baz&quot;&lt;/script&gt;';
    expect(DomUtils.escapeHtml(maliciousInput)).toBe(expectedOutput);
  });
});
