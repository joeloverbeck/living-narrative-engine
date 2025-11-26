# CHADATXMLREW-001: Create XmlElementBuilder Utility Class

**Priority:** P1 - HIGH (Foundation for subsequent tickets)
**Effort:** 2-3 hours
**Status:** ✅ COMPLETED
**Spec Reference:** [specs/character-data-xml-rework.md](../specs/character-data-xml-rework.md) - "XmlElementBuilder" section

---

## Outcome

### What Was Actually Changed vs Originally Planned

**Originally Planned:**
- Create `src/prompting/xmlElementBuilder.js` with methods: `escape()`, `wrap()`, `wrapIfPresent()`, `comment()`, `decoratedComment()`
- Create `tests/unit/prompting/xmlElementBuilder.test.js` with 100% coverage

**Actually Implemented:**
- Created `src/prompting/xmlElementBuilder.js` - exactly as planned
- Created `tests/unit/prompting/xmlElementBuilder.test.js` with 46 tests covering:
  - All escape scenarios (11 tests)
  - All wrap scenarios (7 tests)
  - All wrapIfPresent scenarios (9 tests)
  - All comment scenarios (6 tests)
  - All decoratedComment scenarios (10 tests)
  - Invariant tests (3 tests)

**Coverage Achieved:** 100% statements, 100% branches, 100% functions, 100% lines

**Assumptions Validated:**
- `src/prompting/` directory exists ✅
- `tests/unit/prompting/` directory exists ✅
- Project uses camelCase naming ✅
- JSDoc documentation required ✅
- Default exports expected ✅

**No discrepancies found** - ticket assumptions were accurate.

---

## Problem Statement

Create a stateless XML element building utility class that handles:
- XML character escaping (`&`, `<`, `>`, `"`, `'`)
- Tag wrapping with indentation
- Conditional wrapping (only if content present)
- XML comments (simple and decorated multi-line)

This is a low-level foundation class with no dependencies on character data or business logic.

---

## Files Created

| File | Purpose |
|------|---------|
| `src/prompting/xmlElementBuilder.js` | Main implementation |
| `tests/unit/prompting/xmlElementBuilder.test.js` | Unit tests (46 tests) |

---

## Out of Scope

**DO NOT modify:**
- `CharacterDataFormatter.js` - handled in CHADATXMLREW-007
- `AIPromptContentProvider.js` - handled in CHADATXMLREW-004
- DI tokens or registrations - handled in CHADATXMLREW-003
- Any test files outside `tests/unit/prompting/xmlElementBuilder.test.js`
- Any existing prompting code

---

## Implementation Details

### Class Interface

```javascript
/**
 * @file Low-level stateless utility for XML element generation
 */
class XmlElementBuilder {
  /**
   * Escapes XML special characters
   * @param {string} text - Text to escape
   * @returns {string} Escaped text safe for XML content
   */
  escape(text) {}

  /**
   * Wraps content in an XML tag
   * @param {string} tagName - Tag name (no brackets)
   * @param {string} content - Content to wrap
   * @param {number} [indent=0] - Indentation level (2 spaces per level)
   * @returns {string} Complete XML element
   */
  wrap(tagName, content, indent = 0) {}

  /**
   * Wraps content only if non-empty
   * @param {string} tagName - Tag name
   * @param {string} content - Content to wrap
   * @param {number} [indent=0] - Indentation level
   * @returns {string} XML element or empty string
   */
  wrapIfPresent(tagName, content, indent = 0) {}

  /**
   * Creates an XML comment
   * @param {string} text - Comment text
   * @param {number} [indent=0] - Indentation level
   * @returns {string} XML comment
   */
  comment(text, indent = 0) {}

  /**
   * Creates multi-line decorated comment block
   * @param {string[]} lines - Comment lines
   * @param {'primary'|'secondary'} style - Visual style
   * @param {number} [indent=0] - Indentation level
   * @returns {string} Decorated comment block
   */
  decoratedComment(lines, style, indent = 0) {}
}

export default XmlElementBuilder;
```

### Escaping Rules

| Character | Escape Sequence |
|-----------|-----------------|
| `&` | `&amp;` |
| `<` | `&lt;` |
| `>` | `&gt;` |
| `"` | `&quot;` |
| `'` | `&apos;` |

### Decorated Comment Styles

**Primary style** (for identity priming):
```xml
<!-- ═══════════════════════════════════════════════════════════════════════════
     Line 1
     Line 2
     ═══════════════════════════════════════════════════════════════════════════ -->
```

**Secondary style** (for section headers):
```xml
<!-- ─────────────────────────────────────────────────────────────────────────
     Line 1
     Line 2
     ───────────────────────────────────────────────────────────────────────── -->
```

---

## Acceptance Criteria

### Tests That Must Pass

1. **Escaping Tests** ✅
   - `escape('&')` returns `'&amp;'`
   - `escape('<tag>')` returns `'&lt;tag&gt;'`
   - `escape('"quoted"')` returns `'&quot;quoted&quot;'`
   - `escape("it's")` returns `'it&apos;s'`
   - `escape('mixed <&> chars')` returns correct escaping
   - `escape('')` returns `''`
   - `escape(null)` returns `''`
   - `escape(undefined)` returns `''`

2. **Wrap Tests** ✅
   - `wrap('name', 'John')` returns `'<name>John</name>'`
   - `wrap('name', 'John', 1)` returns `'  <name>John</name>'`
   - `wrap('name', 'John', 2)` returns `'    <name>John</name>'`
   - `wrap('data', '')` returns `'<data></data>'`
   - Multiline content preserved with proper indentation

3. **WrapIfPresent Tests** ✅
   - `wrapIfPresent('name', 'John')` returns `'<name>John</name>'`
   - `wrapIfPresent('name', '')` returns `''`
   - `wrapIfPresent('name', null)` returns `''`
   - `wrapIfPresent('name', undefined)` returns `''`
   - `wrapIfPresent('name', '   ')` returns `''` (whitespace-only)

4. **Comment Tests** ✅
   - `comment('hello')` returns `'<!-- hello -->'`
   - `comment('hello', 1)` returns `'  <!-- hello -->'`
   - Comments escape `--` sequences if present

5. **DecoratedComment Tests** ✅
   - Primary style uses `═` characters
   - Secondary style uses `─` characters
   - Multi-line arrays render correctly
   - Indentation applied consistently

### Invariants That Must Remain True ✅

- **No external dependencies** - class is pure utility
- **Stateless** - no instance state, all methods could be static
- **Idempotent** - same input always produces same output
- **Safe handling of edge cases** - null/undefined/empty strings handled gracefully
- **No side effects** - no logging, no events, no mutations

### Coverage Requirements ✅

- 100% line coverage
- 100% branch coverage (all null/undefined/empty paths)
- 100% function coverage

---

## Testing Commands

```bash
# Run unit tests
npm run test:unit -- tests/unit/prompting/xmlElementBuilder.test.js

# Run with coverage
npm run test:unit -- tests/unit/prompting/xmlElementBuilder.test.js --coverage

# Lint the new file
npx eslint src/prompting/xmlElementBuilder.js
```

---

## Notes

- Follow project naming conventions (camelCase for files/methods) ✅
- Use JSDoc for all public methods ✅
- Export as default (matches project patterns) ✅
- No constructor parameters needed (stateless utility) ✅
