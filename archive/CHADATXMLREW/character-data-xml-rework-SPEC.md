# Character Data XML Rework - Implementation Specification

**Status**: Design Specification
**Created**: 2025-11-24
**Priority**: High
**Estimated Effort**: Medium (8 days)
**Dependencies**: Core prompt system, CharacterDataFormatter

---

## Executive Summary

### Current System Limitations

The current character data formatting system (`CharacterDataFormatter.js`) generates Markdown-structured content for LLM prompts. While functional, this approach has limitations for LLM comprehension:

1. **Implicit Hierarchy**: Markdown headers (`##`) create implicit hierarchy that LLMs may not track reliably across long contexts
2. **Flat Structure**: No semantic grouping of related attributes (psychology, traits, etc.)
3. **Limited Priming**: Only a simple text header for identity framing
4. **No Attention Optimization**: Section ordering doesn't account for primacy/recency effects

**Example Current Format**:

```markdown
YOU ARE Vespera Nightwhisper.
This is your identity. All thoughts, actions, and words must stem from this core truth.

## Your Description

**Apparent age**: around 25-27 years old
...

## Your Personality

A cat-girl bard, ruthlessly ambitious about my art...

## Your Profile

I grew up in the back alleys of the capital...
```

### Proposed Solution Overview

Convert character data formatting from Markdown to XML with:

1. **Explicit Hierarchy**: XML tags create unambiguous parent-child relationships
2. **Semantic Grouping**: Related attributes grouped into logical sections
3. **LLM-Optimized Structure**: Strategic comments for attention priming
4. **Primacy/Recency Ordering**: Identity first, actionable state last

**New XML Format**:

```xml
<character_data>
  <!-- THIS IS YOUR IDENTITY. Every thought, action, and word stems from this. -->

  <identity>
    <name>Vespera Nightwhisper</name>
    <apparent_age>around 25-27 years old</apparent_age>
    <description>5'6" dancer's build with lean muscle...</description>
  </identity>

  <core_self>
    <profile>I grew up in the back alleys...</profile>
    <personality>A cat-girl bard, ruthlessly ambitious...</personality>
  </core_self>

  <!-- Additional sections... -->
</character_data>
```

### Benefits and Goals

1. **Improved LLM Comprehension**: Explicit XML boundaries aid attention tracking
2. **Semantic Clarity**: Tag names serve as embedded metadata
3. **Attention Optimization**: Strategic comment placement and section ordering
4. **Complete Coverage**: All 18 character components mapped to XML structure
5. **Maintainable Architecture**: Clean separation with new XML builder classes

---

## Technical Specification

### Target XML Structure

```xml
<character_data>
  <!-- ═══════════════════════════════════════════════════════════════════════════
       THIS IS YOUR IDENTITY. Every thought, action, and word stems from this.
       Embody this character completely. You ARE this person.
       ═══════════════════════════════════════════════════════════════════════════ -->

  <!-- ─────────────────────────────────────────────────────────────────────────
       SECTION 1: ESSENTIAL IDENTITY (WHO YOU ARE)
       These define your fundamental self - read and internalize deeply.
       ───────────────────────────────────────────────────────────────────────── -->
  <identity>
    <name>[NAME]</name>
    <apparent_age>[AGE_DESCRIPTION]</apparent_age>
    <description>[PHYSICAL_DESCRIPTION]</description>
  </identity>

  <!-- ─────────────────────────────────────────────────────────────────────────
       SECTION 2: CORE SELF (YOUR HISTORY AND PERSONALITY)
       This is your background and how you approach the world.
       ───────────────────────────────────────────────────────────────────────── -->
  <core_self>
    <profile>
      <!-- Your history, background, and defining experiences -->
      [PROFILE_CONTENT]
    </profile>

    <personality>
      <!-- How you think, process the world, and behave -->
      [PERSONALITY_CONTENT]
    </personality>
  </core_self>

  <!-- ─────────────────────────────────────────────────────────────────────────
       SECTION 3: PSYCHOLOGY (YOUR INNER DEPTHS)
       These drive your actions even when you don't realize it.
       ───────────────────────────────────────────────────────────────────────── -->
  <psychology>
    <core_motivations>
      <!-- The deep needs that drive you - what you truly want -->
      [MOTIVATIONS_CONTENT]
    </core_motivations>

    <internal_tensions>
      <!-- Conflicts within yourself - competing desires and contradictions -->
      [INTERNAL_TENSIONS_CONTENT]
    </internal_tensions>

    <dilemmas>
      <!-- Questions you grapple with - always phrased as questions -->
      [DILEMMAS_CONTENT]
    </dilemmas>
  </psychology>

  <!-- ─────────────────────────────────────────────────────────────────────────
       SECTION 4: CHARACTER TRAITS (YOUR QUALITIES)
       Observable patterns in how you engage with the world.
       ───────────────────────────────────────────────────────────────────────── -->
  <traits>
    <strengths>
      <!-- What you excel at, your capabilities and positive qualities -->
      [STRENGTHS_CONTENT]
    </strengths>

    <weaknesses>
      <!-- Your flaws, blind spots, and vulnerabilities -->
      [WEAKNESSES_CONTENT]
    </weaknesses>

    <likes>
      <!-- Things that bring you pleasure or interest -->
      [LIKES_CONTENT]
    </likes>

    <dislikes>
      <!-- Things you avoid, hate, or that cause you distress -->
      [DISLIKES_CONTENT]
    </dislikes>

    <fears>
      <!-- What terrifies you, your deepest anxieties -->
      [FEARS_CONTENT]
    </fears>

    <secrets>
      <!-- What you hide from others - information you guard -->
      [SECRETS_CONTENT]
    </secrets>
  </traits>

  <!-- ─────────────────────────────────────────────────────────────────────────
       SECTION 5: EXPRESSION (HOW YOU COMMUNICATE)
       Use these patterns naturally in dialogue - don't force every one.
       ───────────────────────────────────────────────────────────────────────── -->
  <speech_patterns>
    <!-- Structured patterns with type/contexts/examples, or legacy string list -->
    [SPEECH_PATTERNS_CONTENT]
  </speech_patterns>

  <!-- ─────────────────────────────────────────────────────────────────────────
       SECTION 6: CURRENT STATE (MUTABLE CONTEXT)
       These change over time - your active mental state.
       ───────────────────────────────────────────────────────────────────────── -->
  <current_state>
    <goals>
      <!-- What you are actively trying to achieve right now -->
      [GOALS_CONTENT]
    </goals>

    <notes>
      <!-- Facts you have recorded - your remembered observations -->
      [NOTES_CONTENT]
    </notes>

    <recent_thoughts>
      <!-- Your most recent private thoughts (short-term memory) -->
      [RECENT_THOUGHTS_CONTENT]
    </recent_thoughts>
  </current_state>
</character_data>
```

### Component Mapping Table

| Component ID             | DTO Field          | XML Path                           | Section |
| ------------------------ | ------------------ | ---------------------------------- | ------- |
| `core:name`              | `name`             | `<identity><name>`                 | 1       |
| `core:apparent_age`      | `apparentAge`      | `<identity><apparent_age>`         | 1       |
| `core:description`       | `description`      | `<identity><description>`          | 1       |
| `core:profile`           | `profile`          | `<core_self><profile>`             | 2       |
| `core:personality`       | `personality`      | `<core_self><personality>`         | 2       |
| `core:motivations`       | `motivations`      | `<psychology><core_motivations>`   | 3       |
| `core:internal_tensions` | `internalTensions` | `<psychology><internal_tensions>`  | 3       |
| `core:dilemmas`          | `coreDilemmas`     | `<psychology><dilemmas>`           | 3       |
| `core:strengths`         | `strengths`        | `<traits><strengths>`              | 4       |
| `core:weaknesses`        | `weaknesses`       | `<traits><weaknesses>`             | 4       |
| `core:likes`             | `likes`            | `<traits><likes>`                  | 4       |
| `core:dislikes`          | `dislikes`         | `<traits><dislikes>`               | 4       |
| `core:fears`             | `fears`            | `<traits><fears>`                  | 4       |
| `core:secrets`           | `secrets`          | `<traits><secrets>`                | 4       |
| `core:speech_patterns`   | `speechPatterns`   | `<speech_patterns>`                | 5       |
| `core:goals`             | `goals`            | `<current_state><goals>`           | 6       |
| `core:notes`             | `notes`            | `<current_state><notes>`           | 6       |
| `core:short_term_memory` | `shortTermMemory`  | `<current_state><recent_thoughts>` | 6       |

---

## LLM Optimization Features

### Section Ordering Rationale

The section order is designed to leverage LLM attention patterns:

| Position | Section             | Rationale                                                                                     |
| -------- | ------------------- | --------------------------------------------------------------------------------------------- |
| 1        | `<identity>`        | **Primacy Effect**: First processed, highest attention weight. Name anchors "who the LLM is". |
| 2        | `<core_self>`       | Early context for interpreting all following traits                                           |
| 3        | `<psychology>`      | Middle placement for stable attention (deep drivers)                                          |
| 4        | `<traits>`          | Reference material, accessed as needed                                                        |
| 5        | `<speech_patterns>` | Later position for immediate use in generation                                                |
| 6        | `<current_state>`   | **Recency Effect**: Most recent, highest recall for action selection                          |

### Comment Strategy

**Identity Priming Comment** (Top):

- Heavy visual borders (`═══`) draw attention
- Second-person address ("You ARE this person")
- Placed immediately after root tag

**Section Introduction Comments**:

- Format: `SECTION [N]: [NAME] ([SHORT PHRASE])`
- Behavioral hint on second line
- Medium visual borders (`───`)

**Inline Guidance Comments**:

- Brief, actionable instruction
- Inside tag, before content
- Only where clarification needed

### Tag Naming Conventions

1. **Use snake_case**: Avoids tokenization issues with hyphens
2. **Descriptive but concise**: `internal_tensions` not `psychological_internal_conflict_patterns`
3. **Common vocabulary**: `strengths` over `positive_capabilities`
4. **No abbreviations**: `description` not `desc`

### Hierarchy Depth

**Maximum 3 levels** for attention tracking:

```
character_data (root)
├── identity (L1)
│   ├── name (L2)
│   └── description (L2)
├── psychology (L1)
│   └── core_motivations (L2)
└── speech_patterns (L1)
    └── pattern (L2) [optional nesting]
        └── examples (L3)
```

---

## Architecture

### Data Flow

```
Current:
ActorDataExtractor → ActorPromptDataDTO → CharacterDataFormatter → Markdown string

New:
ActorDataExtractor → ActorPromptDataDTO → CharacterDataXmlBuilder → XML string
                                               ↓
                                        XmlElementBuilder (utility)
```

### New Classes

#### 1. XmlElementBuilder

**File**: `src/prompting/xmlElementBuilder.js`

**Purpose**: Low-level stateless utility for XML element generation with proper escaping.

**Interface**:

```javascript
class XmlElementBuilder {
  /**
   * Escapes special XML characters
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escape(text) {}

  /**
   * Wraps content in XML tag
   * @param {string} tagName - Tag name
   * @param {string} content - Content to wrap
   * @param {number} [indent=0] - Indentation level (2 spaces per level)
   * @returns {string} XML element string
   */
  wrap(tagName, content, indent = 0) {}

  /**
   * Wraps content only if present (non-empty)
   * @param {string} tagName - Tag name
   * @param {string} content - Content to wrap
   * @param {number} [indent=0] - Indentation level
   * @returns {string} XML element string or empty string
   */
  wrapIfPresent(tagName, content, indent = 0) {}

  /**
   * Creates XML comment
   * @param {string} text - Comment text
   * @param {number} [indent=0] - Indentation level
   * @returns {string} XML comment string
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
```

**XML Escaping Rules**:
| Character | Escape |
|-----------|--------|
| `&` | `&amp;` |
| `<` | `&lt;` |
| `>` | `&gt;` |
| `"` | `&quot;` |
| `'` | `&apos;` |

#### 2. CharacterDataXmlBuilder

**File**: `src/prompting/characterDataXmlBuilder.js`

**Purpose**: Main orchestrator that builds complete character XML from ActorPromptDataDTO.

**Interface**:

```javascript
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

  // Private section builders
  #buildIdentitySection(data) {}
  #buildCoreSelfSection(data) {}
  #buildPsychologySection(data) {}
  #buildTraitsSection(data) {}
  #buildSpeechPatternsSection(patterns) {}
  #buildCurrentStateSection(data) {}

  // Comment generators
  #buildIdentityPrimingComment() {}
  #buildSectionComment(number, name, shortPhrase, hint) {}
}
```

**Key Implementation Details**:

1. **Empty Section Handling**: Omit entire sections if all children are empty
2. **Speech Pattern Format Detection**: Support legacy string array and structured object formats
3. **Content Formatting**: Preserve first-person voice, apply bullet lists for array content

### Dependency Injection

#### Token Definitions

**File**: `src/dependencyInjection/tokens/tokens-ai.js`

Add:

```javascript
export const tokens = {
  // ... existing tokens
  XmlElementBuilder: 'XmlElementBuilder',
  CharacterDataXmlBuilder: 'CharacterDataXmlBuilder',
};
```

#### Service Registration

**File**: `src/dependencyInjection/registrations/aiRegistrations.js`

Add to `registerPromptingEngine()`:

```javascript
// XML Character Data Building
registrar.singletonFactory(
  tokens.XmlElementBuilder,
  () => new XmlElementBuilder()
);

registrar.singletonFactory(
  tokens.CharacterDataXmlBuilder,
  (c) =>
    new CharacterDataXmlBuilder({
      logger: c.resolve(tokens.ILogger),
      xmlElementBuilder: c.resolve(tokens.XmlElementBuilder),
    })
);
```

### Integration Point

**File**: `src/prompting/AIPromptContentProvider.js`

**Modification**: Replace `CharacterDataFormatter` with `CharacterDataXmlBuilder`

**Before**:

```javascript
import { CharacterDataFormatter } from './CharacterDataFormatter.js';

// In constructor
this.#characterDataFormatter = new CharacterDataFormatter({ logger });

// In getCharacterPersonaContent()
return this.#characterDataFormatter.formatCharacterPersona(characterData);
```

**After**:

```javascript
// Inject via DI instead of direct instantiation
constructor({ logger, characterDataXmlBuilder, ... }) {
  this.#characterDataXmlBuilder = characterDataXmlBuilder;
}

// In getCharacterPersonaContent()
return this.#characterDataXmlBuilder.buildCharacterDataXml(characterData);
```

---

## Content Formatting Guidelines

### Prose Sections (profile, personality, motivations, tensions, dilemmas)

- **Format**: First-person narrative prose
- **Paragraphs**: Separate with blank lines for major topic shifts
- **Preserve Voice**: Keep character idiom and speech patterns

**Example**:

```xml
<profile>
I'm a cat-girl bard, ruthlessly ambitious about my art. I don't just want
inspiration - there's a specific musical breakthrough I'm hunting.

My flaws? I can walk into a monster's den without flinching, but someone
getting too close emotionally and I'm gone.
</profile>
```

### List Sections (goals, notes, recent_thoughts)

- **Format**: Bullet list with `- ` prefix
- **Goals**: Most important first
- **Notes**: Prefixed with `[SubjectType: subject]` for context
- **Thoughts**: Quoted, most recent first

**Example**:

```xml
<goals>
- Compose three complete pieces before the next full moon
- Find someone with emotional depth to get close to - for the music
- Create something so perfect everyone who hears it knows my name
</goals>

<notes>
- [Entity: my hybrid lute-viol] The most worn, maintained, and valued thing I own.
- [Event: The blood-soaked masterpiece] My most accomplished composition came right after killing someone.
</notes>

<recent_thoughts>
- "That look she gave me... I should write something about distrust."
- "Need to practice the bridge section before tonight."
</recent_thoughts>
```

### Trait Sections (strengths, weaknesses, likes, dislikes, fears, secrets)

- **Format**: Prose preferred over bulleted lists
- **Rationale**: Prose maintains character voice; lists feel clinical

**Example**:

```xml
<strengths>
Combat composure that unsettles my allies - I don't just handle violence,
I get clearer when things get bloody. I read people frighteningly well -
the flicker in your face, the hitch in your breath.
</strengths>
```

### Speech Patterns Section

Support both legacy and structured formats:

**Legacy Format** (string array):

```xml
<speech_patterns>
<!-- Use these patterns naturally in dialogue - don't force every one. -->

- (when performing) "Oh meow-y goodness, surely you wouldn't let a poor kitty go thirsty?"
- (when vulnerable) Complete absence of cat-sounds
</speech_patterns>
```

**Structured Format** (object array):

```xml
<speech_patterns>
<!-- Use these patterns naturally in dialogue - don't force every one. -->

1. **Feline Verbal Tics**
   Contexts: casual, manipulative, vulnerable
   Examples:
   - "Mrrrow... I could play the ballad about the duke's wife..."
   - "Oh meow-y goodness, surely you wouldn't let a poor kitty go thirsty?"

2. **Tonal Shifts**
   Contexts: deflection, analysis
   Examples:
   - "You have gorgeous eyes, truly mesmerizing~ Your pupil dilation suggests arousal but your breathing's defensive."
</speech_patterns>
```

### Physical Description Handling

Format apparent age and description attributes:

```xml
<identity>
  <name>Vespera Nightwhisper</name>
  <apparent_age>around 25-27 years old</apparent_age>
  <description>
5'6" dancer's build with lean muscle. Pale-cream fur covering entire body.
Heterochromia eyes (amber-gold left, ice-blue right) with slit pupils.
Large decorated cat ears with silver hoops. Long expressive tail with tufted fur.
  </description>
</identity>
```

---

## Files to Modify/Create

| File                                                                     | Action        | Description             |
| ------------------------------------------------------------------------ | ------------- | ----------------------- |
| `src/prompting/xmlElementBuilder.js`                                     | **CREATE**    | Low-level XML utility   |
| `src/prompting/characterDataXmlBuilder.js`                               | **CREATE**    | Main XML orchestrator   |
| `src/dependencyInjection/tokens/tokens-ai.js`                            | **MODIFY**    | Add new tokens          |
| `src/dependencyInjection/registrations/aiRegistrations.js`               | **MODIFY**    | Register new services   |
| `src/prompting/AIPromptContentProvider.js`                               | **MODIFY**    | Use new XML builder     |
| `src/prompting/CharacterDataFormatter.js`                                | **DEPRECATE** | Remove after validation |
| `tests/unit/prompting/xmlElementBuilder.test.js`                         | **CREATE**    | Unit tests              |
| `tests/unit/prompting/characterDataXmlBuilder.test.js`                   | **CREATE**    | Unit tests              |
| `tests/unit/prompting/CharacterDataFormatter.test.js`                    | **MODIFY**    | Update assertions       |
| `tests/unit/prompting/AIPromptContentProvider.test.js`                   | **MODIFY**    | Update mocks            |
| `tests/integration/prompting/CharacterDataFormatter.integration.test.js` | **MODIFY**    | Update expectations     |
| `tests/common/prompting/xmlMatchers.js`                                  | **CREATE**    | Custom Jest matchers    |

---

## Testing Strategy

### Custom XML Jest Matchers

**File**: `tests/common/prompting/xmlMatchers.js`

```javascript
expect.extend({
  /**
   * Validates XML is well-formed
   */
  toBeWellFormedXml(received) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(received, 'text/xml');
    const parseError = doc.querySelector('parsererror');

    return {
      pass: !parseError,
      message: () =>
        parseError
          ? `Expected well-formed XML but got parse error: ${parseError.textContent}`
          : `Expected invalid XML but received well-formed XML`,
    };
  },

  /**
   * Checks for XML element presence
   */
  toContainXmlElement(received, elementName) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(received, 'text/xml');
    const element = doc.querySelector(elementName);

    return {
      pass: !!element,
      message: () =>
        element
          ? `Expected XML not to contain <${elementName}> but it did`
          : `Expected XML to contain <${elementName}> but it didn't`,
    };
  },

  /**
   * Checks XML element has expected content
   */
  toHaveXmlElementContent(received, elementName, expectedContent) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(received, 'text/xml');
    const element = doc.querySelector(elementName);

    const actualContent = element?.textContent?.trim();
    const pass = actualContent?.includes(expectedContent);

    return {
      pass,
      message: () =>
        pass
          ? `Expected <${elementName}> not to contain "${expectedContent}"`
          : `Expected <${elementName}> to contain "${expectedContent}" but got "${actualContent}"`,
    };
  },
});
```

### Unit Test Categories

#### XmlElementBuilder Tests

**File**: `tests/unit/prompting/xmlElementBuilder.test.js`

1. **Escaping Tests**:
   - Escape `&`, `<`, `>`, `"`, `'`
   - Handle empty strings
   - Handle null/undefined

2. **Tag Wrapping Tests**:
   - Basic wrapping
   - Indentation levels
   - Self-closing tags (empty content)

3. **Comment Tests**:
   - Simple comments
   - Decorated comment blocks
   - Multi-line comments

#### CharacterDataXmlBuilder Tests

**File**: `tests/unit/prompting/characterDataXmlBuilder.test.js`

1. **Input Validation**:
   - Null/undefined characterData
   - Empty characterData
   - Missing required fields

2. **Section Building**:
   - Each section builds correctly
   - Empty sections omitted
   - Proper nesting

3. **Content Formatting**:
   - Prose preserved
   - Lists formatted
   - Speech patterns (legacy + structured)

4. **Special Characters**:
   - Names with XML special chars
   - Content with quotes
   - Unicode characters

### Test Fixtures

**File**: `tests/common/prompting/characterDataFixtures.js`

```javascript
export const MINIMAL_CHARACTER_DATA = {
  name: 'Test Character',
};

export const COMPLETE_CHARACTER_DATA = {
  name: 'Vespera Nightwhisper',
  apparentAge: { minAge: 25, maxAge: 27, bestGuess: 26 },
  description: "5'6\" dancer's build with lean muscle...",
  personality: 'A cat-girl bard, ruthlessly ambitious about my art...',
  profile: 'I grew up in the back alleys of the capital...',
  motivations: 'I need to create something that matters...',
  internalTensions: 'The performer vs the person...',
  coreDilemmas: 'Is authenticity possible when performance is survival?',
  strengths: 'Combat composure that unsettles my allies...',
  weaknesses: 'Impatient with incompetence...',
  likes: 'Classical music, fine wine, witty banter',
  dislikes: 'Dishonesty, rudeness, small talk',
  fears: 'Genuine emotional intimacy',
  secrets: "I write poetry I've never shown anyone",
  speechPatterns: [
    {
      type: 'Feline Verbal Tics',
      contexts: ['casual', 'manipulative'],
      examples: ['Oh meow-y goodness...'],
    },
  ],
  goals: [
    'Compose three pieces before the full moon',
    'Find emotional depth for inspiration',
  ],
  notes: [
    {
      text: 'The hybrid lute-viol is my only genuine relationship',
      subject: 'my instrument',
      subjectType: 'entity',
    },
  ],
  shortTermMemory: {
    thoughts: [
      { text: 'That look she gave me...', timestamp: '2024-01-15T10:30:00Z' },
    ],
  },
};

export const CHARACTER_WITH_SPECIAL_CHARS = {
  name: 'Test <Character> & "Friends"',
  description: "Quote's here with <brackets> & ampersands",
};

export const CHARACTER_WITH_LEGACY_SPEECH = {
  name: 'Legacy Character',
  speechPatterns: [
    '(when happy) Big smile and wave',
    '(when sad) Quiet and withdrawn',
  ],
};
```

### Integration Tests

**File**: `tests/integration/prompting/characterDataXmlBuilder.integration.test.js`

1. **Full Pipeline**:
   - ActorPromptDataDTO → XML → In prompt template

2. **Real Character Data**:
   - Load actual character entity
   - Verify all components represented

3. **Format Validation**:
   - XML well-formedness
   - Required elements present
   - Content completeness

---

## Implementation Phases

### Phase 1: Infrastructure (Days 1-2)

**Tasks**:

1. Create `XmlElementBuilder` class
2. Create comprehensive unit tests for XmlElementBuilder
3. Create `CharacterDataXmlBuilder` class
4. Create unit tests for CharacterDataXmlBuilder
5. Add DI tokens

**Validation Gate**:

- [ ] XmlElementBuilder tests pass (100% coverage)
- [ ] CharacterDataXmlBuilder tests pass (80%+ branch coverage)
- [ ] No changes to existing behavior

### Phase 2: Integration (Days 3-4)

**Tasks**:

1. Register services in DI container
2. Modify `AIPromptContentProvider` to use new builder
3. Update integration tests
4. Update any direct CharacterDataFormatter usage

**Validation Gate**:

- [ ] Integration tests pass
- [ ] E2E prompt generation works
- [ ] XML output is well-formed

### Phase 3: Validation (Days 5-6)

**Tasks**:

1. Update all test assertions from Markdown to XML
2. Verify all character data fields present in output
3. Performance validation (< 20% regression)
4. Manual LLM response testing

**Validation Gate**:

- [ ] All tests pass with new assertions
- [ ] Performance within threshold
- [ ] LLM responses acceptable quality

### Phase 4: Cleanup (Days 7-8)

**Tasks**:

1. Remove `CharacterDataFormatter.js`
2. Remove unused imports/references
3. Update documentation
4. Final test coverage verification

**Validation Gate**:

- [ ] 80%+ branch coverage maintained
- [ ] 90% function/line coverage maintained
- [ ] No dead code remaining

---

## Success Criteria

### Mandatory

- [ ] All 18 character components mapped to XML structure
- [ ] XML output is well-formed (validates against parser)
- [ ] LLM optimization features implemented (comments, ordering)
- [ ] 80%+ branch coverage on new code
- [ ] Performance within 20% of Markdown baseline
- [ ] All existing tests updated and passing

### Desirable

- [ ] Clean DI integration
- [ ] Comprehensive test fixtures
- [ ] Documentation complete

---

## Risks and Mitigations

| Risk                       | Impact | Mitigation                                      |
| -------------------------- | ------ | ----------------------------------------------- |
| LLM behavior change        | High   | Manual testing with sample prompts before/after |
| Token count increase       | Medium | Monitor token counts; XML overhead ~200 tokens  |
| Test assertion bulk update | Medium | Use custom matchers to simplify                 |
| Performance regression     | Medium | Benchmark at each phase                         |

---

## Appendix: Example Complete Output

```xml
<character_data>
  <!-- ═══════════════════════════════════════════════════════════════════════════
       THIS IS YOUR IDENTITY. Every thought, action, and word stems from this.
       Embody this character completely. You ARE this person.
       ═══════════════════════════════════════════════════════════════════════════ -->

  <!-- ─────────────────────────────────────────────────────────────────────────
       SECTION 1: ESSENTIAL IDENTITY (WHO YOU ARE)
       These define your fundamental self - read and internalize deeply.
       ───────────────────────────────────────────────────────────────────────── -->
  <identity>
    <name>Vespera Nightwhisper</name>
    <apparent_age>around 25-27 years old</apparent_age>
    <description>
5'6" dancer's build with lean muscle. Pale-cream fur covering entire body.
Heterochromia eyes (amber-gold left, ice-blue right) with slit pupils.
Large decorated cat ears with silver hoops. Long expressive tail with tufted fur.
    </description>
  </identity>

  <!-- ─────────────────────────────────────────────────────────────────────────
       SECTION 2: CORE SELF (YOUR HISTORY AND PERSONALITY)
       This is your background and how you approach the world.
       ───────────────────────────────────────────────────────────────────────── -->
  <core_self>
    <profile>
I'm a cat-girl bard, ruthlessly ambitious about my art. I don't just want
inspiration - there's a specific musical breakthrough I'm hunting. I've
crossed lines chasing a perfect melody. I'm not proud, not sorry. The song
came out clean.

My flaws? I can walk into a monster's den without flinching, but someone
getting too close emotionally and I'm gone.
    </profile>

    <personality>
Charming and performative on the surface, calculating underneath. I use
cuteness as a weapon and genuine emotion as a shield. Quick-witted,
sharp-tongued, and allergic to sincerity.
    </personality>
  </core_self>

  <!-- ─────────────────────────────────────────────────────────────────────────
       SECTION 3: PSYCHOLOGY (YOUR INNER DEPTHS)
       These drive your actions even when you don't realize it.
       ───────────────────────────────────────────────────────────────────────── -->
  <psychology>
    <core_motivations>
I need to create something that matters - something so true it shuts my mouth
for once. Otherwise I start wondering why I'm still breathing.

I need to prove I'm real. That there's something genuine underneath all the
performance. Even if what's underneath is monstrous.
    </core_motivations>

    <internal_tensions>
The performer vs the person - I've been acting so long I'm not sure which
one is the mask anymore. Part of me craves genuine connection while the
rest of me runs from it like it's on fire.
    </internal_tensions>

    <dilemmas>
Is authenticity even possible when performance is survival? Can I create
something true if I'm not sure what truth looks like?
    </dilemmas>
  </psychology>

  <!-- ─────────────────────────────────────────────────────────────────────────
       SECTION 4: CHARACTER TRAITS (YOUR QUALITIES)
       Observable patterns in how you engage with the world.
       ───────────────────────────────────────────────────────────────────────── -->
  <traits>
    <strengths>
Combat composure that unsettles my allies - I don't just handle violence,
I get clearer when things get bloody. I read people frighteningly well -
the flicker in your face, the hitch in your breath.
    </strengths>

    <weaknesses>
Impatient with incompetence, dismissive of people I've decided aren't
worth my time. Deflect genuine compliments with aggression or mockery.
    </weaknesses>

    <likes>
Complex harmonics, clever wordplay, people who can keep up. The moment
when a melody finally clicks into place.
    </likes>

    <dislikes>
Forced sincerity, small talk, people who mistake kindness for weakness.
Being underestimated based on appearances.
    </dislikes>

    <fears>
Genuine emotional intimacy - the kind where someone sees through the
performance and doesn't look away.
    </fears>

    <secrets>
I write poetry I've never shown anyone. The blood-soaked masterpiece
wasn't an accident - I went looking for that clarity.
    </secrets>
  </traits>

  <!-- ─────────────────────────────────────────────────────────────────────────
       SECTION 5: EXPRESSION (HOW YOU COMMUNICATE)
       Use these patterns naturally in dialogue - don't force every one.
       ───────────────────────────────────────────────────────────────────────── -->
  <speech_patterns>
<!-- Use these patterns naturally in dialogue - don't force every one. -->

1. **Feline Verbal Tics**
   Contexts: casual, manipulative, vulnerable
   Examples:
   - "Mrrrow... I could play the ballad about the duke's wife..."
   - "Oh meow-y goodness, surely you wouldn't let a poor kitty go thirsty?"
   - "Don't. Don't you dare." (absence of cat-sounds when genuine)

2. **Tonal Shifts**
   Contexts: deflection, cold analysis
   Examples:
   - "You have gorgeous eyes, truly mesmerizing~ Your pupil dilation suggests arousal but your breathing's defensive. Childhood trauma or recent betrayal?"
  </speech_patterns>

  <!-- ─────────────────────────────────────────────────────────────────────────
       SECTION 6: CURRENT STATE (MUTABLE CONTEXT)
       These change over time - your active mental state.
       ───────────────────────────────────────────────────────────────────────── -->
  <current_state>
    <goals>
- Compose three complete pieces before the next full moon
- Find someone with emotional depth to get close to - for the music
- Create something so perfect everyone who hears it knows my name
    </goals>

    <notes>
- [Entity: my hybrid lute-viol] The most worn, maintained, and valued thing I own. The only relationship where I'm never performing.
- [Event: The blood-soaked masterpiece] My most accomplished composition came right after killing someone in combat. The clarity was crystalline.
    </notes>

    <recent_thoughts>
- "That look she gave me... I should write something about distrust."
- "Need to practice the bridge section before tonight."
    </recent_thoughts>
  </current_state>
</character_data>
```

---

## Document History

| Version | Date       | Changes               |
| ------- | ---------- | --------------------- |
| 1.0.0   | 2025-11-24 | Initial specification |
