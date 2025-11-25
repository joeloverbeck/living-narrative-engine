/**
 * @file Unit tests for custom XML Jest matchers
 * @description Self-tests validating the XML matchers work correctly
 */

import { describe, it, expect } from '@jest/globals';
import '../../../common/prompting/xmlMatchers.js';

describe('XML Jest Matchers', () => {
  describe('toBeWellFormedXml', () => {
    it('should pass for valid XML with root element only', () => {
      expect('<root/>').toBeWellFormedXml();
    });

    it('should pass for valid XML with nested elements', () => {
      expect('<root><child/></root>').toBeWellFormedXml();
    });

    it('should pass for valid XML with text content', () => {
      expect('<root>text content</root>').toBeWellFormedXml();
    });

    it('should pass for valid XML with attributes', () => {
      expect('<root attr="value"><child id="1"/></root>').toBeWellFormedXml();
    });

    it('should fail for unclosed tags', () => {
      expect(() => {
        expect('<root><child></root>').toBeWellFormedXml();
      }).toThrow();
    });

    it('should fail for invalid characters', () => {
      expect(() => {
        expect('<root>&invalid;</root>').toBeWellFormedXml();
      }).toThrow();
    });

    it('should fail for empty string', () => {
      expect(() => {
        expect('').toBeWellFormedXml();
      }).toThrow();
    });

    it('should fail for non-XML text', () => {
      expect(() => {
        expect('this is not xml').toBeWellFormedXml();
      }).toThrow();
    });

    it('should provide helpful error message on failure', () => {
      let errorMessage = '';
      try {
        expect('<root><unclosed>').toBeWellFormedXml();
      } catch (e) {
        errorMessage = e.message;
      }
      expect(errorMessage).toContain('Expected well-formed XML');
      expect(errorMessage).toContain('parse error');
    });
  });

  describe('toContainXmlElement', () => {
    const validXml = `
      <root>
        <parent>
          <child>content</child>
          <sibling>other</sibling>
        </parent>
      </root>
    `;

    it('should find root element by tag name', () => {
      expect(validXml).toContainXmlElement('root');
    });

    it('should find nested element by tag name', () => {
      expect(validXml).toContainXmlElement('child');
    });

    it('should find element by CSS selector (parent > child)', () => {
      expect(validXml).toContainXmlElement('parent > child');
    });

    it('should find element by descendant selector', () => {
      expect(validXml).toContainXmlElement('root child');
    });

    it('should return false for missing elements', () => {
      expect(() => {
        expect(validXml).toContainXmlElement('nonexistent');
      }).toThrow();
    });

    it('should handle malformed XML gracefully', () => {
      let errorMessage = '';
      try {
        expect('<root><unclosed>').toContainXmlElement('root');
      } catch (e) {
        errorMessage = e.message;
      }
      expect(errorMessage).toContain('XML parse error');
    });

    it('should work with .not modifier for absence check', () => {
      expect(validXml).not.toContainXmlElement('missing');
    });

    it('should fail with .not modifier when element exists', () => {
      expect(() => {
        expect(validXml).not.toContainXmlElement('child');
      }).toThrow();
    });
  });

  describe('toHaveXmlElementContent', () => {
    const xmlWithContent = `
      <root>
        <name>Vespera Nightwhisper</name>
        <description>A cat-girl bard with feline grace</description>
        <empty></empty>
        <whitespace>   trimmed   </whitespace>
      </root>
    `;

    it('should match partial content (substring)', () => {
      expect(xmlWithContent).toHaveXmlElementContent('name', 'Vespera');
    });

    it('should match full content', () => {
      expect(xmlWithContent).toHaveXmlElementContent(
        'name',
        'Vespera Nightwhisper'
      );
    });

    it('should be case-sensitive', () => {
      expect(() => {
        expect(xmlWithContent).toHaveXmlElementContent('name', 'vespera');
      }).toThrow();
    });

    it('should handle whitespace in content', () => {
      expect(xmlWithContent).toHaveXmlElementContent('whitespace', 'trimmed');
    });

    it('should return false for missing element', () => {
      expect(() => {
        expect(xmlWithContent).toHaveXmlElementContent('missing', 'content');
      }).toThrow();
    });

    it('should return false for wrong content', () => {
      expect(() => {
        expect(xmlWithContent).toHaveXmlElementContent('name', 'WrongName');
      }).toThrow();
    });

    it('should handle empty elements', () => {
      expect(() => {
        expect(xmlWithContent).toHaveXmlElementContent('empty', 'content');
      }).toThrow();
    });

    it('should work with .not modifier', () => {
      expect(xmlWithContent).not.toHaveXmlElementContent('name', 'WrongName');
    });
  });

  describe('toHaveXmlElementExactContent', () => {
    const xmlWithContent = `
      <root>
        <name>Vespera</name>
        <greeting>  Hello World  </greeting>
        <empty></empty>
      </root>
    `;

    it('should match exact content (after trim)', () => {
      expect(xmlWithContent).toHaveXmlElementExactContent('name', 'Vespera');
    });

    it('should fail for partial matches', () => {
      expect(() => {
        expect(xmlWithContent).toHaveXmlElementExactContent('name', 'Vesp');
      }).toThrow();
    });

    it('should trim whitespace before comparison', () => {
      expect(xmlWithContent).toHaveXmlElementExactContent(
        'greeting',
        'Hello World'
      );
    });

    it('should trim expected content before comparison', () => {
      expect(xmlWithContent).toHaveXmlElementExactContent(
        'name',
        '  Vespera  '
      );
    });

    it('should return false for missing element', () => {
      expect(() => {
        expect(xmlWithContent).toHaveXmlElementExactContent(
          'missing',
          'content'
        );
      }).toThrow();
    });

    it('should work with empty element and empty expected', () => {
      expect(xmlWithContent).toHaveXmlElementExactContent('empty', '');
    });

    it('should work with .not modifier', () => {
      expect(xmlWithContent).not.toHaveXmlElementExactContent(
        'name',
        'WrongName'
      );
    });
  });

  describe('error message quality', () => {
    it('should show XML structure in toContainXmlElement failure', () => {
      const xml = '<root><child/></root>';
      let errorMessage = '';
      try {
        expect(xml).toContainXmlElement('missing');
      } catch (e) {
        errorMessage = e.message;
      }
      expect(errorMessage).toContain('<root>');
    });

    it('should show actual content in toHaveXmlElementExactContent failure', () => {
      const xml = '<root><name>Actual</name></root>';
      let errorMessage = '';
      try {
        expect(xml).toHaveXmlElementExactContent('name', 'Expected');
      } catch (e) {
        errorMessage = e.message;
      }
      expect(errorMessage).toContain('Actual');
      expect(errorMessage).toContain('Expected');
    });

    it('should indicate element not found in toHaveXmlElementContent', () => {
      const xml = '<root><other/></root>';
      let errorMessage = '';
      try {
        expect(xml).toHaveXmlElementContent('missing', 'content');
      } catch (e) {
        errorMessage = e.message;
      }
      expect(errorMessage).toContain('element not found');
    });
  });

  describe('complex XML structures', () => {
    const complexXml = `
      <character_data>
        <!-- Identity Section -->
        <identity>
          <name>Vespera</name>
          <age>26</age>
        </identity>
        <psychology>
          <motivations>Power and influence</motivations>
        </psychology>
      </character_data>
    `;

    it('should handle XML with comments', () => {
      expect(complexXml).toBeWellFormedXml();
    });

    it('should navigate complex selectors', () => {
      expect(complexXml).toContainXmlElement('identity > name');
      expect(complexXml).toContainXmlElement('psychology > motivations');
    });

    it('should find content in nested structures', () => {
      expect(complexXml).toHaveXmlElementContent(
        'psychology > motivations',
        'Power'
      );
    });
  });
});
