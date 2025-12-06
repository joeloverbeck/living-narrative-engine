# CHADATXMLREW-005: Create Custom XML Jest Matchers

**Priority:** P2 - MEDIUM
**Effort:** 1-2 hours
**Status:** ✅ COMPLETED
**Completed Date:** 2025-11-25
**Spec Reference:** [specs/character-data-xml-rework.md](../specs/character-data-xml-rework.md) - "Custom XML Jest Matchers" section
**Depends On:** None (can be done in parallel with other tickets)

---

## Outcome

### What Was Originally Planned

- Create custom Jest matchers for XML validation
- Implement 4 matchers: `toBeWellFormedXml`, `toContainXmlElement`, `toHaveXmlElementContent`, `toHaveXmlElementExactContent`
- Create self-test file to validate matchers
- Ticket specified paths: `tests/common/prompting/xmlMatchers.js` and `tests/unit/common/prompting/xmlMatchers.test.js`

### What Was Actually Changed

- **Created**: `tests/common/prompting/xmlMatchers.js` - Custom Jest matchers with all 4 matchers
- **Created**: `tests/unit/common/prompting/xmlMatchers.test.js` - Comprehensive test suite with 38 tests
- **Created**: `tests/unit/common/prompting/` directory (did not exist previously)

### Implementation Notes

- All 4 matchers implemented as specified
- Added `/* global expect */` directive to satisfy ESLint
- Test file refactored to avoid conditional expects (Jest best practice)
- 38 tests covering all matcher behaviors, edge cases, and error messages

### Test Results

- All 38 matcher self-tests pass
- All 505 prompting unit tests pass (no regressions)
- Related tests (xmlElementBuilder.test.js, characterDataXmlBuilder.test.js) continue to pass

### Files Created

| File                                              | Purpose                                 |
| ------------------------------------------------- | --------------------------------------- |
| `tests/common/prompting/xmlMatchers.js`           | Custom Jest matchers for XML validation |
| `tests/unit/common/prompting/xmlMatchers.test.js` | Self-tests for the matchers             |

---

## Problem Statement

Create custom Jest matchers for XML validation to simplify test assertions in CHADATXMLREW-002 and CHADATXMLREW-006. These matchers provide:

- XML well-formedness validation
- Element presence checking
- Element content assertions

Without these matchers, tests would require verbose DOMParser boilerplate in every test file.

---

## Files Created

| File                                    | Purpose              |
| --------------------------------------- | -------------------- |
| `tests/common/prompting/xmlMatchers.js` | Custom Jest matchers |

---

## Out of Scope

**DO NOT modify:**

- Any source files in `src/`
- Any existing test files
- Jest configuration files
- Any other test helpers

---

## Implementation Details

### Matcher Implementations

**File:** `tests/common/prompting/xmlMatchers.js`

```javascript
/**
 * @file Custom Jest matchers for XML validation
 * @description Provides matchers for validating XML output in character data tests
 */

/* global expect */

/**
 * Parses XML string and returns document or null if parse error
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
```

### Usage Examples

```javascript
// In test files:
import '../../common/prompting/xmlMatchers.js';

describe('CharacterDataXmlBuilder', () => {
  it('should produce well-formed XML', () => {
    const xml = builder.buildCharacterDataXml(characterData);
    expect(xml).toBeWellFormedXml();
  });

  it('should include identity section', () => {
    const xml = builder.buildCharacterDataXml(characterData);
    expect(xml).toContainXmlElement('identity');
    expect(xml).toContainXmlElement('identity > name');
  });

  it('should have correct name', () => {
    const xml = builder.buildCharacterDataXml({ name: 'Vespera' });
    expect(xml).toHaveXmlElementExactContent('name', 'Vespera');
  });

  it('should omit empty psychology section', () => {
    const xml = builder.buildCharacterDataXml({
      name: 'Test',
      motivations: '',
    });
    expect(xml).not.toContainXmlElement('psychology');
  });
});
```

---

## Acceptance Criteria

### Tests That Must Pass ✅

Created a self-test file to validate the matchers work correctly:

**File:** `tests/unit/common/prompting/xmlMatchers.test.js`

1. **toBeWellFormedXml** ✅
   - Passes for valid XML: `<root><child/></root>`
   - Fails for unclosed tags: `<root><child></root>`
   - Fails for invalid characters
   - Provides helpful error message on failure

2. **toContainXmlElement** ✅
   - Finds root element by tag name
   - Finds nested element by tag name
   - Supports CSS selector syntax (`parent > child`)
   - Returns false for missing elements
   - Handles malformed XML gracefully

3. **toHaveXmlElementContent** ✅
   - Matches partial content (substring)
   - Case-sensitive matching
   - Handles whitespace in content
   - Returns false for missing element
   - Returns false for wrong content

4. **toHaveXmlElementExactContent** ✅
   - Matches exact content (after trim)
   - Fails for partial matches
   - Trims whitespace before comparison

### Invariants That Must Remain True ✅

- **No external dependencies** - only uses DOMParser (built-in) ✅
- **Graceful degradation** - malformed XML handled without throwing ✅
- **Helpful error messages** - failures include context for debugging ✅
- **Composable** - works with Jest's `.not` modifier ✅
- **No side effects** - matchers are pure functions ✅

### Coverage Requirements ✅

- 100% function coverage on matchers ✅
- Self-tests validate all matcher behaviors ✅ (38 tests)

---

## Testing Commands

```bash
# Run matcher self-tests
npm run test:unit -- tests/unit/common/prompting/xmlMatchers.test.js

# Verify matchers work with existing test setup
npm run test:unit -- tests/unit/prompting/xmlElementBuilder.test.js
```

---

## Notes

- Import the file in any test that needs XML assertions
- Matchers extend Jest's `expect` globally when imported
- Use CSS selectors for nested elements (e.g., `identity > name`)
- The `.not` modifier works automatically for all matchers
- DOMParser is available in jsdom environment (Jest's default)
