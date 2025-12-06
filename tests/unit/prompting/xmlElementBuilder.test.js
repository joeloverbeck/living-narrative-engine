/**
 * @file Unit tests for XmlElementBuilder
 * @description Tests XML character escaping, tag wrapping, conditional wrapping,
 * and XML comments (simple and decorated multi-line).
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import XmlElementBuilder from '../../../src/prompting/xmlElementBuilder.js';

describe('XmlElementBuilder', () => {
  let builder;

  beforeEach(() => {
    builder = new XmlElementBuilder();
  });

  describe('escape()', () => {
    it('should escape ampersand', () => {
      expect(builder.escape('&')).toBe('&amp;');
    });

    it('should escape less-than sign', () => {
      expect(builder.escape('<tag>')).toBe('&lt;tag&gt;');
    });

    it('should preserve double quotes (readable for LLM prompts)', () => {
      expect(builder.escape('"quoted"')).toBe('"quoted"');
    });

    it('should preserve single quotes/apostrophes (readable for LLM prompts)', () => {
      expect(builder.escape("it's")).toBe("it's");
    });

    it('should escape mixed special characters', () => {
      expect(builder.escape('mixed <&> chars')).toBe(
        'mixed &lt;&amp;&gt; chars'
      );
    });

    it('should return empty string for empty input', () => {
      expect(builder.escape('')).toBe('');
    });

    it('should return empty string for null', () => {
      expect(builder.escape(null)).toBe('');
    });

    it('should return empty string for undefined', () => {
      expect(builder.escape(undefined)).toBe('');
    });

    it('should handle text with all special characters', () => {
      // Only &, <, > are escaped; quotes/apostrophes remain readable for LLM prompts
      expect(builder.escape('&<>"\'all')).toBe('&amp;&lt;&gt;"\'all');
    });

    it('should preserve normal text unchanged', () => {
      expect(builder.escape('Hello World')).toBe('Hello World');
    });

    it('should handle numbers by converting to string', () => {
      expect(builder.escape(123)).toBe('123');
    });
  });

  describe('wrap()', () => {
    it('should wrap content in XML tags', () => {
      expect(builder.wrap('name', 'John')).toBe('<name>John</name>');
    });

    it('should apply indentation level 1 (2 spaces)', () => {
      expect(builder.wrap('name', 'John', 1)).toBe('  <name>John</name>');
    });

    it('should apply indentation level 2 (4 spaces)', () => {
      expect(builder.wrap('name', 'John', 2)).toBe('    <name>John</name>');
    });

    it('should wrap empty content', () => {
      expect(builder.wrap('data', '')).toBe('<data></data>');
    });

    it('should preserve multiline content', () => {
      const content = 'line1\nline2\nline3';
      expect(builder.wrap('text', content)).toBe(
        '<text>line1\nline2\nline3</text>'
      );
    });

    it('should handle zero indentation', () => {
      expect(builder.wrap('tag', 'value', 0)).toBe('<tag>value</tag>');
    });

    it('should handle deep indentation', () => {
      expect(builder.wrap('deep', 'value', 5)).toBe(
        '          <deep>value</deep>'
      );
    });
  });

  describe('wrapIfPresent()', () => {
    it('should wrap non-empty content', () => {
      expect(builder.wrapIfPresent('name', 'John')).toBe('<name>John</name>');
    });

    it('should return empty string for empty content', () => {
      expect(builder.wrapIfPresent('name', '')).toBe('');
    });

    it('should return empty string for null', () => {
      expect(builder.wrapIfPresent('name', null)).toBe('');
    });

    it('should return empty string for undefined', () => {
      expect(builder.wrapIfPresent('name', undefined)).toBe('');
    });

    it('should return empty string for whitespace-only content', () => {
      expect(builder.wrapIfPresent('name', '   ')).toBe('');
    });

    it('should return empty string for tabs and newlines only', () => {
      expect(builder.wrapIfPresent('name', '\t\n  \t')).toBe('');
    });

    it('should wrap content with leading/trailing whitespace (preserves original)', () => {
      expect(builder.wrapIfPresent('name', '  John  ')).toBe(
        '<name>  John  </name>'
      );
    });

    it('should apply indentation when wrapping', () => {
      expect(builder.wrapIfPresent('name', 'John', 1)).toBe(
        '  <name>John</name>'
      );
    });

    it('should not apply indentation to empty result', () => {
      expect(builder.wrapIfPresent('name', '', 5)).toBe('');
    });
  });

  describe('comment()', () => {
    it('should create a simple XML comment', () => {
      expect(builder.comment('hello')).toBe('<!-- hello -->');
    });

    it('should apply indentation to comments', () => {
      expect(builder.comment('hello', 1)).toBe('  <!-- hello -->');
    });

    it('should escape double dashes in comments', () => {
      expect(builder.comment('test--value')).toBe('<!-- test- -value -->');
    });

    it('should handle multiple double dashes', () => {
      expect(builder.comment('a--b--c')).toBe('<!-- a- -b- -c -->');
    });

    it('should handle empty comment text', () => {
      expect(builder.comment('')).toBe('<!--  -->');
    });

    it('should handle deep indentation', () => {
      expect(builder.comment('test', 3)).toBe('      <!-- test -->');
    });
  });

  describe('decoratedComment()', () => {
    describe('primary style', () => {
      it('should use double-line equals characters', () => {
        const result = builder.decoratedComment(['Line 1'], 'primary');
        expect(result).toContain('===');
      });

      it('should format single line correctly', () => {
        const result = builder.decoratedComment(['Test Line'], 'primary');
        const lines = result.split('\n');
        expect(lines).toHaveLength(3);
        expect(lines[0]).toMatch(/^<!-- =+$/);
        expect(lines[1]).toContain('Test Line');
        expect(lines[2]).toMatch(/=+ -->$/);
      });

      it('should format multiple lines correctly', () => {
        const result = builder.decoratedComment(
          ['Line 1', 'Line 2'],
          'primary'
        );
        const lines = result.split('\n');
        expect(lines).toHaveLength(4);
        expect(lines[1]).toContain('Line 1');
        expect(lines[2]).toContain('Line 2');
      });
    });

    describe('secondary style', () => {
      it('should use single-line dash characters', () => {
        const result = builder.decoratedComment(['Line 1'], 'secondary');
        expect(result).toContain('---');
        expect(result).not.toContain('===');
      });

      it('should format single line correctly', () => {
        const result = builder.decoratedComment(['Test Line'], 'secondary');
        const lines = result.split('\n');
        expect(lines).toHaveLength(3);
        expect(lines[0]).toMatch(/^<!-- -+$/);
        expect(lines[1]).toContain('Test Line');
        expect(lines[2]).toMatch(/-+ -->$/);
      });
    });

    describe('critical style', () => {
      it('should use asterisk border characters', () => {
        const result = builder.decoratedComment(['Line 1'], 'critical');
        expect(result).toContain('***');
        expect(result).not.toContain('===');
        expect(result).not.toContain('---');
      });

      it('should format single line correctly', () => {
        const result = builder.decoratedComment(
          ['Critical Content'],
          'critical'
        );
        const lines = result.split('\n');
        expect(lines).toHaveLength(3);
        expect(lines[0]).toMatch(/^<!-- \*+$/);
        expect(lines[1]).toContain('Critical Content');
        expect(lines[2]).toMatch(/\*+ -->$/);
      });

      it('should format multiple lines correctly', () => {
        const result = builder.decoratedComment(
          ['Rule 1', 'Rule 2'],
          'critical'
        );
        const lines = result.split('\n');
        expect(lines).toHaveLength(4);
        expect(lines[1]).toContain('Rule 1');
        expect(lines[2]).toContain('Rule 2');
      });
    });

    describe('reference style', () => {
      it('should use dot border characters', () => {
        const result = builder.decoratedComment(['Line 1'], 'reference');
        expect(result).toContain('...');
        expect(result).not.toContain('===');
        expect(result).not.toContain('---');
        expect(result).not.toContain('***');
      });

      it('should format single line correctly', () => {
        const result = builder.decoratedComment(
          ['Reference Info'],
          'reference'
        );
        const lines = result.split('\n');
        expect(lines).toHaveLength(3);
        expect(lines[0]).toMatch(/^<!-- \.+$/);
        expect(lines[1]).toContain('Reference Info');
        expect(lines[2]).toMatch(/\.+ -->$/);
      });

      it('should format multiple lines correctly', () => {
        const result = builder.decoratedComment(
          ['Context 1', 'Context 2'],
          'reference'
        );
        const lines = result.split('\n');
        expect(lines).toHaveLength(4);
        expect(lines[1]).toContain('Context 1');
        expect(lines[2]).toContain('Context 2');
      });
    });

    describe('unknown style fallback', () => {
      it('should fall back to secondary (dash) for unknown styles', () => {
        const result = builder.decoratedComment(['Line 1'], 'unknown');
        expect(result).toContain('---');
        expect(result).not.toContain('===');
      });

      it('should fall back to secondary (dash) for undefined style', () => {
        const result = builder.decoratedComment(['Line 1'], undefined);
        expect(result).toContain('---');
      });

      it('should fall back to secondary (dash) for null style', () => {
        const result = builder.decoratedComment(['Line 1'], null);
        expect(result).toContain('---');
      });
    });

    describe('indentation', () => {
      it('should apply indentation to all lines', () => {
        const result = builder.decoratedComment(['Line 1'], 'primary', 1);
        const lines = result.split('\n');
        lines.forEach((line) => {
          expect(line.startsWith('  ')).toBe(true);
        });
      });

      it('should apply deep indentation correctly', () => {
        const result = builder.decoratedComment(['Test'], 'secondary', 2);
        const lines = result.split('\n');
        lines.forEach((line) => {
          expect(line.startsWith('    ')).toBe(true);
        });
      });
    });

    describe('edge cases', () => {
      it('should handle empty lines array', () => {
        const result = builder.decoratedComment([], 'primary');
        const lines = result.split('\n');
        // Should have opening border and closing border only
        expect(lines).toHaveLength(2);
      });

      it('should handle lines with special characters', () => {
        const result = builder.decoratedComment(
          ['Test <special> & "chars"'],
          'primary'
        );
        // Content should be preserved as-is (comments don't need escaping)
        expect(result).toContain('Test <special> & "chars"');
      });

      it('should handle lines with whitespace', () => {
        const result = builder.decoratedComment(['  indented  '], 'primary');
        expect(result).toContain('  indented  ');
      });
    });
  });

  describe('invariants', () => {
    it('should be stateless - same input produces same output', () => {
      const result1 = builder.wrap('tag', 'value');
      const result2 = builder.wrap('tag', 'value');
      expect(result1).toBe(result2);
    });

    it('should produce idempotent results across instances', () => {
      const builder1 = new XmlElementBuilder();
      const builder2 = new XmlElementBuilder();
      expect(builder1.escape('test & value')).toBe(
        builder2.escape('test & value')
      );
    });

    it('should have no side effects on input', () => {
      const input = 'test value';
      builder.escape(input);
      expect(input).toBe('test value');
    });
  });
});
