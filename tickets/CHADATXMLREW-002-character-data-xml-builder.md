# CHADATXMLREW-002: Create CharacterDataXmlBuilder Class

**Priority:** P1 - HIGH
**Effort:** 4-5 hours
**Status:** Not Started
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

| DTO Field | XML Path |
|-----------|----------|
| `name` | `<identity><name>` |
| `apparentAge` | `<identity><apparent_age>` |
| `description` | `<identity><description>` |
| `profile` | `<core_self><profile>` |
| `personality` | `<core_self><personality>` |
| `motivations` | `<psychology><core_motivations>` |
| `internalTensions` | `<psychology><internal_tensions>` |
| `coreDilemmas` | `<psychology><dilemmas>` |
| `strengths` | `<traits><strengths>` |
| `weaknesses` | `<traits><weaknesses>` |
| `likes` | `<traits><likes>` |
| `dislikes` | `<traits><dislikes>` |
| `fears` | `<traits><fears>` |
| `secrets` | `<traits><secrets>` |
| `speechPatterns` | `<speech_patterns>` |
| `goals` | `<current_state><goals>` |
| `notes` | `<current_state><notes>` |
| `shortTermMemory` | `<current_state><recent_thoughts>` |

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
  speechPatterns: [
    {
      type: "Feline Verbal Tics",
      contexts: ["casual", "manipulative"],
      examples: ["Oh meow-y goodness..."]
    }
  ],
  goals: ["Compose three pieces", "Find emotional depth"],
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
