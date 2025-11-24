# CHADATXMLREW-006: Update Existing Test Assertions for XML Output

**Priority:** P1 - HIGH
**Effort:** 3-4 hours
**Status:** Not Started
**Spec Reference:** [specs/character-data-xml-rework.md](../specs/character-data-xml-rework.md) - "Testing Strategy" section
**Depends On:** CHADATXMLREW-004 (integration complete), CHADATXMLREW-005 (XML matchers available)

---

## Problem Statement

After the integration in CHADATXMLREW-004, existing tests that assert on character persona output will fail because they expect Markdown format but receive XML. This ticket updates all affected test assertions to:
1. Expect XML format instead of Markdown
2. Use the custom XML matchers from CHADATXMLREW-005
3. Verify the same semantic content in the new format

---

## Files to Modify

| File | Action | Description |
|------|--------|-------------|
| `tests/unit/prompting/AIPromptContentProvider.test.js` | MODIFY | Update persona output assertions |
| `tests/unit/prompting/AIPromptContentProvider.coverage.test.js` | MODIFY | Update coverage assertions |
| `tests/unit/prompting/AIPromptContentProvider.promptData.test.js` | MODIFY | Update prompt data assertions |
| `tests/integration/prompting/CharacterDataFormatter.integration.test.js` | MODIFY | Convert to XML builder integration tests |
| `tests/integration/CharacterDataFormatter.integration.test.js` | MODIFY | Update or redirect to new test file |

---

## Out of Scope

**DO NOT modify:**
- `CharacterDataFormatter.js` - handled in CHADATXMLREW-007
- `CharacterDataXmlBuilder.js` - created in CHADATXMLREW-002
- Unit tests for CharacterDataFormatter itself (will be deprecated with the class)
- Any source files
- Tests unrelated to character persona formatting

---

## Implementation Details

### Pattern: Markdown to XML Assertion Updates

#### Before (Markdown assertions)
```javascript
const result = provider.getCharacterPersonaContent(gameState);

expect(result).toContain('YOU ARE Isabella Martinez');
expect(result).toContain('## Your Description');
expect(result).toContain('**Hair**: long, dark brown');
expect(result).toContain('## Your Personality');
```

#### After (XML assertions)
```javascript
import '../../common/prompting/xmlMatchers.js';

const result = provider.getCharacterPersonaContent(gameState);

expect(result).toBeWellFormedXml();
expect(result).toContainXmlElement('character_data');
expect(result).toContainXmlElement('identity > name');
expect(result).toHaveXmlElementContent('name', 'Isabella Martinez');
expect(result).toContainXmlElement('identity > description');
expect(result).toHaveXmlElementContent('description', 'long, dark brown');
expect(result).toContainXmlElement('core_self > personality');
```

### File-by-File Changes

#### 1. `tests/unit/prompting/AIPromptContentProvider.test.js`

- Add import: `import '../../common/prompting/xmlMatchers.js';`
- Update mock for `characterDataXmlBuilder` to return XML
- Update assertions in `getCharacterPersonaContent` tests
- Key patterns to update:
  - `'YOU ARE {name}'` → `toHaveXmlElementContent('name', '{name}')`
  - `'## Your Description'` → `toContainXmlElement('identity > description')`
  - `'## Your Personality'` → `toContainXmlElement('core_self > personality')`
  - `'## Your Profile'` → `toContainXmlElement('core_self > profile')`

#### 2. `tests/unit/prompting/AIPromptContentProvider.coverage.test.js`

- Add XML matchers import
- Update any character persona assertions
- Focus on ensuring coverage of XML builder code paths

#### 3. `tests/unit/prompting/AIPromptContentProvider.promptData.test.js`

- Add XML matchers import
- Update assertions checking promptData structure
- Verify characterPersona field contains XML

#### 4. `tests/integration/prompting/CharacterDataFormatter.integration.test.js`

**Major refactor required:**

```javascript
// RENAME/REWRITE to test the new XML builder integration
// Option A: Rename file to characterDataXmlBuilder.integration.test.js
// Option B: Update in place to test XML output

import '../../common/prompting/xmlMatchers.js';
import { CharacterDataXmlBuilder } from '../../../src/prompting/characterDataXmlBuilder.js';
import { XmlElementBuilder } from '../../../src/prompting/xmlElementBuilder.js';

describe('CharacterDataXmlBuilder Integration Tests', () => {
  let builder;
  let mockLogger;

  beforeEach(() => {
    mockLogger = { debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
    builder = new CharacterDataXmlBuilder({
      logger: mockLogger,
      xmlElementBuilder: new XmlElementBuilder()
    });
  });

  // Convert existing test cases to XML assertions
  it('should produce valid XML for complete character data', () => {
    const xml = builder.buildCharacterDataXml(COMPLETE_CHARACTER_DATA);

    expect(xml).toBeWellFormedXml();
    expect(xml).toContainXmlElement('character_data');
    expect(xml).toContainXmlElement('identity');
    expect(xml).toContainXmlElement('core_self');
    expect(xml).toContainXmlElement('psychology');
    expect(xml).toContainXmlElement('traits');
    expect(xml).toContainXmlElement('speech_patterns');
    expect(xml).toContainXmlElement('current_state');
  });
});
```

#### 5. `tests/integration/CharacterDataFormatter.integration.test.js` (root level)

- Check if this is a duplicate or different scope
- Either redirect to prompting folder or update similarly

### Assertion Translation Guide

| Old Markdown Assertion | New XML Assertion |
|------------------------|-------------------|
| `toContain('YOU ARE {name}')` | `toHaveXmlElementContent('name', '{name}')` |
| `toContain('## Your Description')` | `toContainXmlElement('identity > description')` |
| `toContain('## Your Personality')` | `toContainXmlElement('core_self > personality')` |
| `toContain('## Your Profile')` | `toContainXmlElement('core_self > profile')` |
| `toContain('**Hair**:')` | `toHaveXmlElementContent('description', ...)` |
| `toContain('## Your Strengths')` | `toContainXmlElement('traits > strengths')` |
| `toContain('## Your Weaknesses')` | `toContainXmlElement('traits > weaknesses')` |
| `toContain('## Your Likes')` | `toContainXmlElement('traits > likes')` |
| `toContain('## Your Dislikes')` | `toContainXmlElement('traits > dislikes')` |
| `toContain('## Your Fears')` | `toContainXmlElement('traits > fears')` |
| `toContain('## Your Secrets')` | `toContainXmlElement('traits > secrets')` |
| `toContain('## Your Speech Patterns')` | `toContainXmlElement('speech_patterns')` |
| `toContain('## Your Goals')` | `toContainXmlElement('current_state > goals')` |
| `toContain('## Your Notes')` | `toContainXmlElement('current_state > notes')` |

---

## Acceptance Criteria

### Tests That Must Pass

1. **All modified test files pass**
   - No failing assertions from format change
   - Coverage maintained or improved

2. **Content verification**
   - Same semantic content verified (names, descriptions, etc.)
   - XML structure matches spec

3. **Edge case coverage preserved**
   - Empty sections still tested (now with `not.toContainXmlElement`)
   - Missing data fallbacks still work
   - Special character handling still verified

### Invariants That Must Remain True

- **Same test coverage** - no reduction in covered scenarios
- **Same edge cases tested** - null handling, empty strings, etc.
- **Fallback behavior verified** - non-XML fallbacks unchanged
- **Test count approximately same** - converting, not removing tests

### Specific Tests to Preserve (Now with XML assertions)

1. Full character data produces all sections
2. Minimal character data produces identity only
3. Empty sections are omitted
4. Special characters escaped properly
5. Speech patterns (legacy format) rendered
6. Speech patterns (structured format) rendered
7. Goals formatted as list
8. Notes include subject type prefix
9. Recent thoughts quoted
10. Apparent age formatted correctly

---

## Testing Commands

```bash
# Run all modified test files
npm run test:unit -- tests/unit/prompting/AIPromptContentProvider.test.js
npm run test:unit -- tests/unit/prompting/AIPromptContentProvider.coverage.test.js
npm run test:unit -- tests/unit/prompting/AIPromptContentProvider.promptData.test.js

# Run integration tests
npm run test:integration -- tests/integration/prompting/CharacterDataFormatter.integration.test.js
npm run test:integration -- tests/integration/CharacterDataFormatter.integration.test.js

# Run all prompting tests
npm run test:unit -- --testPathPattern="prompting"
npm run test:integration -- --testPathPattern="prompting"

# Verify no regressions
npm run test:ci
```

---

## Notes

- This is largely mechanical work - translating Markdown assertions to XML assertions
- Use the assertion translation guide above as reference
- Import XML matchers at top of every file that tests character persona output
- Some integration tests may need to be renamed to reflect they're testing XML builder
- Keep the old CharacterDataFormatter tests intact for now (deprecated in CHADATXMLREW-007)
- The fallback behavior tests (when builder fails) should still test plain text fallback
