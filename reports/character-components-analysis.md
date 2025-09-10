# Character Components Analysis Report

## Executive Summary

This report analyzes the feasibility of adding three new character components to the Living Narrative Engine: **motivations**, **internal tensions**, and **core dilemmas**. Based on a comprehensive analysis of the existing codebase, these components are sufficiently distinct from existing components and can be successfully integrated into the prompt generation system.

**Key Findings:**

- All three proposed components are distinct from existing character components
- Implementation requires modifications to 7 core files and creation of 3 new component definitions
- The components can be made optional while maintaining backward compatibility
- Clear implementation path exists with minimal risk to existing functionality

## Current State Analysis

### Existing Character Components

The system currently supports 11 character-related components that are used in LLM prompts:

1. **apparent_age** - Age range perception (minAge, maxAge, bestGuess)
2. **description** - Physical appearance and visual characteristics
3. **personality** - Character traits and temperament
4. **profile** - Background story and history
5. **likes** - Things the character enjoys
6. **dislikes** - Things the character avoids or dislikes
7. **strengths** - Character's capabilities and advantages
8. **weaknesses** - Character's limitations and vulnerabilities
9. **secrets** - Hidden information about the character
10. **fears** - What the character is afraid of
11. **speech_patterns** - How the character speaks (array of examples)

**Note**: Additionally, the **goals** component (array with timestamps) is extracted and used in prompts through a separate path via `AIPromptContentProvider.js` rather than through `actorDataExtractor.js`. This brings the total to 11 components, though they use two different extraction mechanisms.

### Prompt Generation Flow

1. **Data Extraction** (`actorDataExtractor.js`):
   - Retrieves component data from actor state
   - Applies fallback values for missing components
   - Returns structured `ActorPromptDataDTO`

2. **Data Formatting** (`CharacterDataFormatter.js`):
   - Converts raw component data into markdown format
   - Creates hierarchical structure with headers
   - Maintains first-person perspective

3. **Prompt Assembly** (`AIPromptContentProvider.js`):
   - Combines formatted character data with other prompt sections
   - Integrates into complete prompt template
   - Sends to LLM via proxy server

### Current Prompt Structure

```markdown
YOU ARE [Character Name].
This is your identity. All thoughts, actions, and words must stem from this core truth.

## Your Description

[Physical attributes]

## Your Personality

[Personality traits]

## Your Profile

[Background story]

## Your Likes

[Things character enjoys]

## Your Dislikes

[Things character avoids]

## Your Strengths

[Capabilities]

## Your Weaknesses

[Limitations]

## Your Secrets

[Hidden information]

## Your Fears

[What scares them]

## Your Speech Patterns

- [Example 1]
- [Example 2]
```

## Proposed Components Evaluation

### 1. Motivations Component

**Definition**: The underlying psychological drivers that explain WHY characters do what they do, distinct from WHAT they want to achieve (goals).

**Distinctiveness from Existing Components:**

- **Different from goals**: Goals are concrete objectives ("become captain of the guard"), while motivations are psychological drivers ("prove myself worthy because I feel inadequate")
- **Different from personality**: Personality describes traits ("brave, loyal"), while motivations explain the psychology behind behaviors
- **Different from profile**: Profile provides history, while motivations explain current psychological state

**Example Data Structure:**

```json
{
  "text": "I act tough and aggressive because deep down I feel insecure about my small stature. I seek validation through displays of strength because I never received approval from my father."
}
```

### 2. Internal Tensions Component

**Definition**: Conflicting desires or beliefs within the character that create psychological tension and drive complex behavior.

**Distinctiveness from Existing Components:**

- **Different from fears**: Fears are things to avoid, tensions are competing desires
- **Different from weaknesses**: Weaknesses are limitations, tensions are conflicts
- **Different from personality**: Personality is static traits, tensions are dynamic conflicts

**Example Data Structure:**

```json
{
  "text": "I desperately want romantic connection, but every relationship I've had has ended in disaster. I crave independence, yet I fear being alone."
}
```

### 3. Core Dilemmas Component

**Definition**: Fundamental questions the character grapples with, always phrased as questions that have no easy answers.

**Distinctiveness from Existing Components:**

- **Different from goals**: Goals are objectives to achieve, dilemmas are questions to ponder
- **Different from secrets**: Secrets are hidden facts, dilemmas are open questions
- **Different from profile**: Profile is established history, dilemmas are ongoing struggles

**Example Data Structure:**

```json
{
  "text": "Is it right for me to enforce laws I know are unjust? Can I truly protect people by working within a corrupt system?"
}
```

## Distinctiveness Assessment

### Comparison Matrix

| Component             | Purpose             | Temporal Focus | Format                | Psychological Depth        |
| --------------------- | ------------------- | -------------- | --------------------- | -------------------------- |
| **Goals**             | What to achieve     | Future         | Array with timestamps | Surface-level objectives   |
| **Motivations**       | Why they act        | Present        | Explanations          | Deep psychological drivers |
| **Personality**       | How they behave     | Static         | Traits                | Behavioral patterns        |
| **Internal Tensions** | Conflicting desires | Ongoing        | Contradictions        | Internal conflict          |
| **Profile**           | Who they were       | Past           | Narrative             | Historical context         |
| **Core Dilemmas**     | Questions they face | Ongoing        | Questions             | Philosophical struggles    |
| **Fears**             | What to avoid       | Present        | Statements            | Emotional responses        |
| **Secrets**           | Hidden information  | Past/Present   | Facts                 | Concealed truths           |

### Overlap Analysis

**Minimal Overlap Identified:**

- Each component serves a distinct narrative purpose
- Components complement rather than duplicate each other
- Clear boundaries between component responsibilities
- No redundancy in the information captured

## Implementation Requirements

### Files to Create

1. **Component Definitions** (in `data/mods/core/components/`):
   - `motivations.component.json`
   - `internal_tensions.component.json`
   - `core_dilemmas.component.json`

### Files to Modify

1. **`src/constants/componentIds.js`**
   - Add three new component ID constants

   ```javascript
   export const MOTIVATIONS_COMPONENT_ID = 'core:motivations';
   export const INTERNAL_TENSIONS_COMPONENT_ID = 'core:internal_tensions';
   export const CORE_DILEMMAS_COMPONENT_ID = 'core:core_dilemmas';
   ```

2. **`src/turns/services/actorDataExtractor.js`**
   - Add extraction logic for new components in `extractPromptData()` method
   - Include in optionalTextAttributes array

3. **`src/prompting/CharacterDataFormatter.js`**
   - Add formatting methods for each new component
   - Update `formatCharacterPersona()` to include new sections

4. **`src/constants/essentialSchemas.js`**
   - Register new component schemas if validation is required

5. **`src/loaders/defaultLoaderConfig.js`**
   - Ensure component loader includes new files

6. **`src/entities/utils/defaultComponentInjector.js`**
   - Add default injection rules if needed

7. **`src/turns/dtos/AIGameStateDTO.js`**
   - Fix missing properties in ActorPromptDataDTO typedef (strengths, weaknesses)
   - Add new properties for motivations, internalTensions, coreDilemmas

### Optional Files to Update

- Test files for modified services
- Character builder tools if they need to support new components
- Documentation files

## Technical Implementation Guide

### Step 1: Create Component JSON Files

**motivations.component.json:**

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "core:motivations",
  "description": "Stores the character's underlying psychological motivations that drive their actions, distinct from their goals.",
  "dataSchema": {
    "type": "object",
    "additionalProperties": false,
    "required": ["text"],
    "properties": {
      "text": {
        "type": "string",
        "description": "A string describing the character's core motivations, written from their first-person perspective. For example: 'I push myself to excel because I need to prove I'm more than just my family name.'"
      }
    }
  }
}
```

**internal_tensions.component.json:**

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "core:internal_tensions",
  "description": "Stores the internal conflicts and competing desires within the character's psyche.",
  "dataSchema": {
    "type": "object",
    "additionalProperties": false,
    "required": ["text"],
    "properties": {
      "text": {
        "type": "string",
        "description": "A string describing the character's internal tensions and conflicts, written from their first-person perspective. For example: 'I want to trust others, but everyone I've trusted has betrayed me.'"
      }
    }
  }
}
```

**core_dilemmas.component.json:**

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "core:core_dilemmas",
  "description": "Stores the fundamental questions the character grapples with, always phrased as questions.",
  "dataSchema": {
    "type": "object",
    "additionalProperties": false,
    "required": ["text"],
    "properties": {
      "text": {
        "type": "string",
        "description": "A string containing the core questions the character struggles with, written from their first-person perspective. For example: 'Is loyalty to friends more important than loyalty to principles? Can I be true to myself while meeting others' expectations?'"
      }
    }
  }
}
```

### Step 2: Update Component IDs

Add to `src/constants/componentIds.js`:

```javascript
// Psychological character aspects
export const MOTIVATIONS_COMPONENT_ID = 'core:motivations';
export const INTERNAL_TENSIONS_COMPONENT_ID = 'core:internal_tensions';
export const CORE_DILEMMAS_COMPONENT_ID = 'core:core_dilemmas';
```

### Step 3: Update Actor Data Extractor

In `src/turns/services/actorDataExtractor.js`, add to the imports:

```javascript
import {
  // ... existing imports ...
  MOTIVATIONS_COMPONENT_ID,
  INTERNAL_TENSIONS_COMPONENT_ID,
  CORE_DILEMMAS_COMPONENT_ID,
} from '../../constants/componentIds.js';
```

Add to optionalTextAttributes array:

```javascript
const optionalTextAttributes = [
  // ... existing attributes ...
  { key: 'motivations', componentId: MOTIVATIONS_COMPONENT_ID },
  { key: 'internalTensions', componentId: INTERNAL_TENSIONS_COMPONENT_ID },
  { key: 'coreDilemmas', componentId: CORE_DILEMMAS_COMPONENT_ID },
];
```

### Step 4: Update Character Data Formatter

In `src/prompting/CharacterDataFormatter.js`, add formatting methods:

```javascript
/**
 * Format motivations section
 * @param {string} motivationsText - Motivations description
 * @returns {string} Markdown formatted motivations section
 */
formatMotivationsSection(motivationsText) {
  if (!motivationsText || typeof motivationsText !== 'string') {
    this.#logger.debug('CharacterDataFormatter: No motivations text provided');
    return '';
  }

  const trimmedText = motivationsText.trim();
  if (trimmedText.length === 0) {
    this.#logger.debug('CharacterDataFormatter: Empty motivations text after trimming');
    return '';
  }

  const result = `## Your Core Motivations\n${trimmedText}\n`;
  this.#logger.debug('CharacterDataFormatter: Formatted motivations section');
  return result;
}

/**
 * Format internal tensions section
 * @param {string} tensionsText - Internal tensions description
 * @returns {string} Markdown formatted tensions section
 */
formatInternalTensionsSection(tensionsText) {
  if (!tensionsText || typeof tensionsText !== 'string') {
    this.#logger.debug('CharacterDataFormatter: No internal tensions text provided');
    return '';
  }

  const trimmedText = tensionsText.trim();
  if (trimmedText.length === 0) {
    this.#logger.debug('CharacterDataFormatter: Empty tensions text after trimming');
    return '';
  }

  const result = `## Your Internal Tensions\n${trimmedText}\n`;
  this.#logger.debug('CharacterDataFormatter: Formatted internal tensions section');
  return result;
}

/**
 * Format core dilemmas section
 * @param {string} dilemmasText - Core dilemmas description
 * @returns {string} Markdown formatted dilemmas section
 */
formatCoreDilemmasSection(dilemmasText) {
  if (!dilemmasText || typeof dilemmasText !== 'string') {
    this.#logger.debug('CharacterDataFormatter: No core dilemmas text provided');
    return '';
  }

  const trimmedText = dilemmasText.trim();
  if (trimmedText.length === 0) {
    this.#logger.debug('CharacterDataFormatter: Empty dilemmas text after trimming');
    return '';
  }

  const result = `## Your Core Dilemmas\n${trimmedText}\n`;
  this.#logger.debug('CharacterDataFormatter: Formatted core dilemmas section');
  return result;
}
```

Update `formatCharacterPersona()` method to include new sections:

```javascript
// Add after existing destructuring
const {
  // ... existing fields ...
  motivations,
  internalTensions,
  coreDilemmas,
} = characterData;

// Add sections in appropriate order (after profile, before likes)
const motivationsSection = this.formatMotivationsSection(motivations);
if (motivationsSection) {
  result += motivationsSection + '\n';
}

const tensionsSection = this.formatInternalTensionsSection(internalTensions);
if (tensionsSection) {
  result += tensionsSection + '\n';
}

const dilemmasSection = this.formatCoreDilemmasSection(coreDilemmas);
if (dilemmasSection) {
  result += dilemmasSection + '\n';
}
```

### Step 5: Update Type Definitions

In `src/turns/dtos/AIGameStateDTO.js`, update ActorPromptDataDTO:

```javascript
/**
 * @typedef {Object} ActorPromptDataDTO
 * // ... existing fields ...
 * @property {string} [strengths] - Character's capabilities and advantages
 * @property {string} [weaknesses] - Character's limitations and vulnerabilities
 * @property {string} [motivations] - Core psychological motivations
 * @property {string} [internalTensions] - Internal conflicts and tensions
 * @property {string} [coreDilemmas] - Fundamental questions the character grapples with
 */
```

## Testing Strategy

### Unit Tests

1. **actorDataExtractor.test.js**
   - Test extraction of new components when present
   - Test graceful handling when components are absent
   - Verify optional nature of components

2. **CharacterDataFormatter.test.js**
   - Test formatting of each new component
   - Test empty/null handling
   - Test integration with full persona formatting

3. **AIPromptContentProvider.test.js**
   - Test complete prompt generation with new components
   - Test backward compatibility without new components

### Integration Tests

1. **End-to-end prompt generation**
   - Create test entities with new components
   - Verify prompts include formatted sections
   - Confirm LLM receives properly structured data

2. **Component loading**
   - Verify new component files load correctly
   - Test schema validation
   - Confirm registration in data registry

### Manual Testing Checklist

- [ ] Create character with all three new components
- [ ] Create character with only some new components
- [ ] Create character with no new components (backward compatibility)
- [ ] Verify prompt structure in browser DevTools
- [ ] Test LLM response quality with enhanced character data
- [ ] Validate component data persistence in save/load

## Risk Assessment

### Low Risk Items

- Component definitions are isolated JSON files
- Changes to formatters are additive, not destructive
- Optional nature ensures backward compatibility

### Medium Risk Items

- Actor data extractor modifications could affect existing functionality if not careful
- Type definition updates need coordination across codebase

### Mitigation Strategies

1. Comprehensive test coverage before deployment
2. Feature flag for gradual rollout
3. Backup of existing character data before migration
4. Clear documentation for content creators

## Recommendations

1. **Implement in phases:**
   - Phase 1: Create component definitions and basic extraction
   - Phase 2: Add formatting and prompt integration
   - Phase 3: Update character builder tools
   - Phase 4: Create content guidelines for writers

2. **Priority order:**
   - Motivations (highest value, clearest distinction)
   - Internal Tensions (adds depth to character psychology)
   - Core Dilemmas (philosophical layer, most abstract)

3. **Documentation needs:**
   - Content creator guide for using new components effectively
   - Examples of well-written motivations, tensions, and dilemmas
   - Guidelines for distinguishing from existing components

4. **Future enhancements:**
   - Character builder UI for new components
   - Validation rules for component quality
   - AI-assisted generation of these components based on existing character data

## Conclusion

The proposed components—motivations, internal tensions, and core dilemmas—are sufficiently distinct from existing character components and will add valuable psychological depth to character prompts. The implementation path is clear, with minimal risk to existing functionality when following the optional component pattern already established in the codebase.

The modular nature of the Living Narrative Engine's architecture makes this enhancement straightforward to implement, test, and deploy. By maintaining backward compatibility and making these components optional, the system can be enhanced without disrupting existing content or requiring immediate updates to all character definitions.

---

_Report generated: [Current Date]_  
_Prepared for: Living Narrative Engine Development Team_
