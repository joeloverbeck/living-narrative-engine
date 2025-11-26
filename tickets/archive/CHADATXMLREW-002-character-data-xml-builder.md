# CHADATXMLREW-002: Create CharacterDataXmlBuilder Class

**Priority:** P1 - HIGH
**Effort:** 4-5 hours
**Status:** Completed
**Spec Reference:** [specs/character-data-xml-rework.md](../specs/character-data-xml-rework.md) - "CharacterDataXmlBuilder" section
**Depends On:** CHADATXMLREW-001 (XmlElementBuilder must exist)

---

## Problem Statement

Create the main orchestrator class that transforms `ActorPromptDataDTO` into a complete XML string with:
- 6 semantic sections (identity, core_self, psychology, traits, speech_patterns, current_state)
- LLM-optimized section ordering (primacy/recency effects)
- Decorated comments for attention priming
- Support for both legacy and structured speech pattern formats
- Empty section omission

This class uses `XmlElementBuilder` (from CHADATXMLREW-001) for low-level XML operations.

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/prompting/characterDataXmlBuilder.js` | Main implementation |
| `tests/unit/prompting/characterDataXmlBuilder.test.js` | Unit tests |
| `tests/common/prompting/characterDataFixtures.js` | Shared test fixtures |

---

## Out of Scope

**DO NOT modify:**
- `CharacterDataFormatter.js` - handled in CHADATXMLREW-007
- `AIPromptContentProvider.js` - handled in CHADATXMLREW-004
- DI tokens or registrations - handled in CHADATXMLREW-003
- `XmlElementBuilder.js` - created in CHADATXMLREW-001
- Any existing test files

---

## Implementation Details

### Class Interface

```javascript
/**
 * @file Main orchestrator for building character XML from ActorPromptDataDTO
 */

/** @typedef {import('../types/ActorPromptDataDTO.js').ActorPromptDataDTO} ActorPromptDataDTO */
/** @typedef {import('../../types/ILogger.js').ILogger} ILogger */

class CharacterDataXmlBuilder {
  #logger;
  #xmlBuilder;

  /**
   * @param {object} dependencies
   * @param {ILogger} dependencies.logger
   * @param {XmlElementBuilder} dependencies.xmlElementBuilder
   */
  constructor({ logger, xmlElementBuilder }) {}

  /**
   * Main entry point - builds complete character XML
   * @param {ActorPromptDataDTO} characterData
   * @returns {string} Complete XML string
   */
  buildCharacterDataXml(characterData) {}
}

export default CharacterDataXmlBuilder;
```

### Section Structure

The XML must follow this exact ordering (for LLM attention optimization):

1. **Identity Section** (Primacy Effect - highest attention)
   - `<name>` - character name
   - `<apparent_age>` - age description
   - `<description>` - physical description

2. **Core Self Section**
   - `<profile>` - background/history
   - `<personality>` - behavioral patterns

3. **Psychology Section**
   - `<core_motivations>` - deep driving needs
   - `<internal_tensions>` - internal conflicts
   - `<dilemmas>` - questions they grapple with

4. **Traits Section**
   - `<strengths>`, `<weaknesses>`, `<likes>`, `<dislikes>`, `<fears>`, `<secrets>`

5. **Speech Patterns Section**
   - Support legacy string array format
   - Support structured object format with type/contexts/examples

6. **Current State Section** (Recency Effect - highest recall)
   - `<goals>` - bullet list format
   - `<notes>` - formatted with subject type prefixes
   - `<recent_thoughts>` - quoted format

### Component Mapping

| DTO Field | XML Path | Data Source |
|-----------|----------|-------------|
| `name` | `<identity><name>` | ActorPromptDataDTO |
| `apparentAge` | `<identity><apparent_age>` | ActorPromptDataDTO (object: `{minAge, maxAge, bestGuess?}`) |
| `description` | `<identity><description>` | ActorPromptDataDTO |
| `profile` | `<core_self><profile>` | ActorPromptDataDTO |
| `personality` | `<core_self><personality>` | ActorPromptDataDTO |
| `motivations` | `<psychology><core_motivations>` | ActorPromptDataDTO |
| `internalTensions` | `<psychology><internal_tensions>` | ActorPromptDataDTO |
| `coreDilemmas` | `<psychology><dilemmas>` | ActorPromptDataDTO |
| `strengths` | `<traits><strengths>` | ActorPromptDataDTO |
| `weaknesses` | `<traits><weaknesses>` | ActorPromptDataDTO |
| `likes` | `<traits><likes>` | ActorPromptDataDTO |
| `dislikes` | `<traits><dislikes>` | ActorPromptDataDTO |
| `fears` | `<traits><fears>` | ActorPromptDataDTO |
| `secrets` | `<traits><secrets>` | ActorPromptDataDTO |
| `speechPatterns` | `<speech_patterns>` | ActorPromptDataDTO (string[] or object[]) |
| `goals` | `<current_state><goals>` | Extended data* (array of `{text, timestamp?}`) |
| `notes` | `<current_state><notes>` | Extended data* (array of `{text, subject?, subjectType?}`) |
| `shortTermMemory` | `<current_state><recent_thoughts>` | Extended data* (object with `thoughts` array) |

*Extended data fields are passed by the caller (e.g., AIPromptContentProvider in CHADATXMLREW-004) - they are NOT part of the base ActorPromptDataDTO.

### Private Methods (Suggested)

```javascript
// Section builders
#buildIdentitySection(data) {}
#buildCoreSelfSection(data) {}
#buildPsychologySection(data) {}
#buildTraitsSection(data) {}
#buildSpeechPatternsSection(patterns) {}
#buildCurrentStateSection(data) {}

// Comment generators
#buildIdentityPrimingComment() {}
#buildSectionComment(number, name, shortPhrase, hint) {}

// Format helpers
#formatApparentAge(ageData) {}
#formatGoalsList(goals) {}
#formatNotesList(notes) {}
#formatRecentThoughts(shortTermMemory) {}
#detectPatternFormat(patterns) {}
#formatLegacyPatterns(patterns) {}
#formatStructuredPatterns(patterns) {}
```

### Empty Section Handling

- **Omit entire sections** if ALL children are empty/null/undefined
- Example: If `motivations`, `internalTensions`, AND `coreDilemmas` are all empty, omit `<psychology>` entirely
- Individual empty elements within a section: omit the element, not the section

---

## Test Fixtures

Create `tests/common/prompting/characterDataFixtures.js`:

**IMPORTANT ASSUMPTION CLARIFICATION (validated 2025-11-25):**

The actual `ActorPromptDataDTO` typedef (in `src/turns/dtos/AIGameStateDTO.js`) shows:
- `apparentAge` - The `ActorDataExtractor` extracts this as an **object** `{ minAge, maxAge, bestGuess? }` when present
- `speechPatterns` - Extracted as **string array** by `ActorDataExtractor` (not structured objects)
- `goals`, `notes`, `shortTermMemory` - These are **NOT part of ActorPromptDataDTO** - they are extracted separately by `AIPromptContentProvider._extractMemoryComponents()` from component data

For this ticket, `CharacterDataXmlBuilder.buildCharacterDataXml()` will accept a **combined character data object** that MAY include goals/notes/shortTermMemory if passed by the caller. The builder should handle both:
1. Basic `ActorPromptDataDTO` (without current_state data) - `<current_state>` section omitted
2. Extended data with goals/notes/shortTermMemory - `<current_state>` section included

```javascript
export const MINIMAL_CHARACTER_DATA = {
  name: 'Test Character'
};

export const COMPLETE_CHARACTER_DATA = {
  name: 'Vespera Nightwhisper',
  apparentAge: { minAge: 25, maxAge: 27, bestGuess: 26 },
  description: "5'6\" dancer's build with lean muscle...",
  personality: "A cat-girl bard, ruthlessly ambitious...",
  profile: "I grew up in the back alleys...",
  motivations: "I need to create something that matters...",
  internalTensions: "The performer vs the person...",
  coreDilemmas: "Is authenticity possible when performance is survival?",
  strengths: "Combat composure that unsettles my allies...",
  weaknesses: "Impatient with incompetence...",
  likes: "Classical music, fine wine, witty banter",
  dislikes: "Dishonesty, rudeness, small talk",
  fears: "Genuine emotional intimacy",
  secrets: "I write poetry I've never shown anyone",
  // NOTE: ActorDataExtractor produces string arrays, but structured objects
  // can also be passed if the caller provides them
  speechPatterns: [
    {
      type: "Feline Verbal Tics",
      contexts: ["casual", "manipulative"],
      examples: ["Oh meow-y goodness..."]
    }
  ],
  // NOTE: These are NOT part of base ActorPromptDataDTO but may be passed
  // by the integration layer (AIPromptContentProvider) in CHADATXMLREW-004
  goals: [
    { text: "Compose three pieces", timestamp: "2024-01-15T08:00:00Z" },
    { text: "Find emotional depth" }
  ],
  notes: [
    { text: "The lute is my only genuine relationship", subject: "instrument", subjectType: "entity" }
  ],
  shortTermMemory: {
    thoughts: [
      { text: "That look she gave me...", timestamp: "2024-01-15T10:30:00Z" }
    ]
  }
};

export const CHARACTER_WITH_SPECIAL_CHARS = {
  name: 'Test <Character> & "Friends"',
  description: "Quote's here with <brackets> & ampersands"
};

export const CHARACTER_WITH_LEGACY_SPEECH = {
  name: 'Legacy Character',
  speechPatterns: [
    "(when happy) Big smile and wave",
    "(when sad) Quiet and withdrawn"
  ]
};

export const CHARACTER_WITH_EMPTY_SECTIONS = {
  name: 'Minimal Character',
  personality: 'Quiet and reserved',
  // All psychology fields empty
  motivations: '',
  internalTensions: null,
  coreDilemmas: undefined,
  // Some traits present
  strengths: 'Good listener'
};

// Character data WITHOUT current_state fields (basic ActorPromptDataDTO)
export const CHARACTER_WITHOUT_CURRENT_STATE = {
  name: 'Static Character',
  description: 'A simple character without mutable state',
  personality: 'Stoic and reserved'
  // No goals, notes, or shortTermMemory
};
```

---

## Acceptance Criteria

### Tests That Must Pass

1. **Input Validation**
   - Throws meaningful error for null/undefined characterData
   - Handles empty characterData object
   - Handles missing name (throws or uses placeholder)

2. **Identity Section**
   - Name wrapped in `<identity><name>`
   - Apparent age formatted as human-readable string
   - Description preserved with proper escaping

3. **Core Self Section**
   - Profile and personality wrapped correctly
   - Empty profile/personality handled (section omitted if both empty)

4. **Psychology Section**
   - All three elements present when data exists
   - Section omitted when ALL elements empty
   - Individual empty elements omitted within section

5. **Traits Section**
   - All 6 trait types mapped correctly
   - First-person prose preserved
   - Empty traits omitted individually

6. **Speech Patterns**
   - Legacy string array format detected and formatted
   - Structured object format detected and formatted
   - Empty/null patterns handled gracefully

7. **Current State Section**
   - Goals formatted as bullet list
   - Notes prefixed with `[SubjectType: subject]`
   - Recent thoughts quoted

8. **Special Characters**
   - XML special characters escaped in content
   - Names with `<`, `>`, `&`, `"`, `'` handled
   - Unicode characters preserved

9. **Comment Structure**
   - Identity priming comment present at top
   - Section comments use correct format
   - Visual decorations correct (═ vs ─)

10. **XML Well-Formedness**
    - Output parseable by DOMParser
    - No unclosed tags
    - Proper nesting

### Invariants That Must Remain True

- **Output is always valid XML** - parseable without errors
- **Section ordering is fixed** - identity → core_self → psychology → traits → speech_patterns → current_state
- **Root tag is always `<character_data>`**
- **Empty sections are omitted entirely** - no empty container tags
- **First-person voice preserved** - no transformation of content language
- **XmlElementBuilder used for all XML operations** - no manual string concatenation for tags

### Coverage Requirements

- 80%+ branch coverage
- 90%+ line coverage
- 90%+ function coverage

---

## Testing Commands

```bash
# Run unit tests
npm run test:unit -- tests/unit/prompting/characterDataXmlBuilder.test.js

# Run with coverage
npm run test:unit -- tests/unit/prompting/characterDataXmlBuilder.test.js --coverage

# Lint the new files
npx eslint src/prompting/characterDataXmlBuilder.js tests/common/prompting/characterDataFixtures.js
```

---

## Notes

- Inject `XmlElementBuilder` via constructor (dependency injection)
- Follow existing patterns in `CharacterDataFormatter.js` for formatting logic (but output XML not Markdown)
- Use `validateDependency()` for constructor parameter validation
- Log at debug level for section building

---

## Outcome

**Completed:** 2025-11-25

### Files Created

| File | Purpose |
|------|---------|
| `src/prompting/characterDataXmlBuilder.js` | Main implementation (595 lines) |
| `tests/unit/prompting/characterDataXmlBuilder.test.js` | Unit tests (71 tests) |
| `tests/common/prompting/characterDataFixtures.js` | Shared test fixtures (273 lines) |

### Implementation Summary

The `CharacterDataXmlBuilder` class was implemented as specified with the following characteristics:

1. **Dependencies**: Uses constructor injection with `validateDependency()` for logger and xmlElementBuilder
2. **Uses existing utility**: Leverages `AgeUtils.formatAgeDescription()` from `src/utils/ageUtils.js` for apparent age formatting (named export, not default)
3. **All 6 sections implemented**: identity, core_self, psychology, traits, speech_patterns, current_state
4. **Speech pattern formats**: Supports legacy strings, structured objects, and mixed formats with automatic detection
5. **Empty section omission**: Correctly omits sections when all children are empty
6. **XML escaping**: Uses `XmlElementBuilder.escape()` for all content
7. **Fallback name**: Uses "Unknown Character" when name is missing/empty (does not throw)

### Coverage Results

| Metric | Result | Requirement |
|--------|--------|-------------|
| Statements | 96.07% | N/A |
| Branches | 88.2% | ≥80% ✅ |
| Functions | 100% | ≥90% ✅ |
| Lines | 95.93% | ≥90% ✅ |

### Deviations from Original Plan

1. **Import fix required**: Original implementation used `import AgeUtils from '../utils/ageUtils.js'` but `AgeUtils` is a named export, not default. Fixed to `import { AgeUtils } from '../utils/ageUtils.js'`
2. **Fallback behavior for missing name**: Implementation uses "Unknown Character" fallback instead of throwing an error, which is more forgiving for edge cases

### Test Categories (71 total)

- Constructor Validation: 5 tests
- Input Validation: 6 tests
- XML Structure: 3 tests
- Identity Section: 6 tests
- Core Self Section: 4 tests
- Psychology Section: 3 tests
- Traits Section: 4 tests
- Speech Patterns Section: 7 tests (Legacy, Structured, Mixed)
- Current State Section: 7 tests
- Special Character Escaping: 4 tests
- Comment Structure: 3 tests
- Empty Section Omission: 3 tests
- Integration with XmlElementBuilder: 3 tests
- Logging Behavior: 2 tests
- Performance and Scale: 3 tests
- Edge Cases: 7 tests
- Complete Character Output: 1 test
