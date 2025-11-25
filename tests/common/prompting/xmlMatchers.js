/**
 * @file Custom Jest matchers for XML validation
 * @description Provides matchers for validating XML output in character data tests
 */

/* global expect */

/**
 * Parses XML string and returns document or null if parse error
 *
 * @param {string} xmlString - XML to parse
 * @returns {{ doc: Document | null, error: string | null }}
 */
function parseXml(xmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'text/xml');
  const parseError = doc.querySelector('parsererror');

  if (parseError) {
    return { doc: null, error: parseError.textContent };
  }
  return { doc, error: null };
}

expect.extend({
  /**
   * Validates that received string is well-formed XML
   *
   * @param received
   * @example expect(xmlString).toBeWellFormedXml();
   */
  toBeWellFormedXml(received) {
    const { doc, error } = parseXml(received);

    return {
      pass: doc !== null,
      message: () =>
        doc !== null
          ? `Expected invalid XML but received well-formed XML`
          : `Expected well-formed XML but got parse error:\n${error}`,
    };
  },

  /**
   * Checks for presence of an XML element by tag name or CSS selector
   *
   * @param received
   * @param {string} selector - Tag name or CSS selector
   * @example expect(xmlString).toContainXmlElement('identity');
   * @example expect(xmlString).toContainXmlElement('identity > name');
   */
  toContainXmlElement(received, selector) {
    const { doc, error } = parseXml(received);

    if (!doc) {
      return {
        pass: false,
        message: () => `Cannot check for element - XML parse error:\n${error}`,
      };
    }

    const element = doc.querySelector(selector);

    return {
      pass: !!element,
      message: () =>
        element
          ? `Expected XML not to contain <${selector}> but it did`
          : `Expected XML to contain <${selector}> but it didn't.\nXML structure:\n${received.substring(0, 500)}...`,
    };
  },

  /**
   * Checks that XML element contains expected text content
   *
   * @param received
   * @param {string} selector - Tag name or CSS selector
   * @param {string} expectedContent - Text that should be present in element
   * @example expect(xmlString).toHaveXmlElementContent('name', 'Vespera');
   */
  toHaveXmlElementContent(received, selector, expectedContent) {
    const { doc, error } = parseXml(received);

    if (!doc) {
      return {
        pass: false,
        message: () =>
          `Cannot check element content - XML parse error:\n${error}`,
      };
    }

    const element = doc.querySelector(selector);

    if (!element) {
      return {
        pass: false,
        message: () =>
          `Expected <${selector}> to contain "${expectedContent}" but element not found`,
      };
    }

    const actualContent = element.textContent?.trim() || '';
    const pass = actualContent.includes(expectedContent);

    return {
      pass,
      message: () =>
        pass
          ? `Expected <${selector}> not to contain "${expectedContent}" but it did`
          : `Expected <${selector}> to contain "${expectedContent}" but got "${actualContent.substring(0, 100)}..."`,
    };
  },

  /**
   * Checks that XML element has exact text content (trimmed)
   *
   * @param received
   * @param {string} selector - Tag name or CSS selector
   * @param {string} expectedContent - Exact text expected (whitespace trimmed)
   * @example expect(xmlString).toHaveXmlElementExactContent('name', 'Vespera');
   */
  toHaveXmlElementExactContent(received, selector, expectedContent) {
    const { doc, error } = parseXml(received);

    if (!doc) {
      return {
        pass: false,
        message: () =>
          `Cannot check element content - XML parse error:\n${error}`,
      };
    }

    const element = doc.querySelector(selector);

    if (!element) {
      return {
        pass: false,
        message: () =>
          `Expected <${selector}> with content "${expectedContent}" but element not found`,
      };
    }

    const actualContent = element.textContent?.trim() || '';
    const pass = actualContent === expectedContent.trim();

    return {
      pass,
      message: () =>
        pass
          ? `Expected <${selector}> not to have exact content "${expectedContent}"`
          : `Expected <${selector}> to have exact content "${expectedContent}" but got "${actualContent}"`,
    };
  },

  // Note: Use with .not prefix for negative assertions: expect(xml).not.toContainXmlElement('tag')
});

export default expect;
