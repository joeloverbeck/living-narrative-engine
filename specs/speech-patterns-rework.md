# Speech Patterns System Rework - Implementation Specification

**Status**: Draft
**Created**: 2025-11-24
**Priority**: High
**Estimated Effort**: Medium (3-5 days)

---

## Executive Summary

### Current System Limitations

The current speech patterns system stores character dialogue patterns as a simple array of strings, requiring users to manually format each pattern with type and example information inline. This approach has several limitations:

1. **Forced Manual Formatting**: Users must write patterns in the format `"([TYPE] '[EXAMPLE]')"`, leading to inconsistent structure
2. **Poor Organization**: No structured way to categorize patterns by context or type
3. **Flat Display**: Patterns render as a simple bulleted list in LLM prompts, lacking contextual organization
4. **Limited Expressiveness**: Cannot capture the nuance of when/how different patterns should be used

**Example Current Format** (Vespera Nightwhisper):
```json
{
  "core:speech_patterns": {
    "patterns": [
      "(when performing or manipulating, she lays it on thick with weaponized cuteness) 'Oh meow-y goodness, surely you wouldn't let a poor kitty go thirsty?'"
    ]
  }
}
```

### Proposed Solution Overview

Enhance the speech patterns component to support a structured object format while maintaining backward compatibility with the existing string array format:

**New Structured Format**:
```json
{
  "core:speech_patterns": {
    "patterns": [
      {
        "type": "Feline Verbal Tics",
        "contexts": ["casual", "manipulative", "vulnerable"],
        "examples": [
          "Oh meow-y goodness, surely you wouldn't let a poor kitty go thirsty?",
          "Purr-haps you could help a girl out?",
          "That's just paw-fully rude!"
        ]
      }
    ]
  }
}
```

### Benefits and Goals

1. **Better Organization**: Group related patterns by type and context
2. **Richer Context**: Specify when patterns are appropriate (casual, manipulative, vulnerable, etc.)
3. **Improved LLM Guidance**: Structured prompt format helps AI understand pattern usage
4. **Backward Compatibility**: Existing characters with string arrays continue working
5. **Enhanced Generator**: Speech patterns generator can produce more structured output
6. **Modder-Friendly**: Easier to create and maintain complex speech patterns

---

## Technical Specification

### Component Schema Changes

**File**: `data/mods/core/components/speech_patterns.component.json`

#### Current Schema
```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "core:speech_patterns",
  "description": "Defines speech patterns for character dialogue",
  "dataSchema": {
    "type": "object",
    "properties": {
      "patterns": {
        "type": "array",
        "items": {
          "type": "string"
        }
      }
    },
    "required": ["patterns"]
  }
}
```

#### New Schema (Backward Compatible)
```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "core:speech_patterns",
  "description": "Defines speech patterns for character dialogue",
  "dataSchema": {
    "type": "object",
    "properties": {
      "patterns": {
        "type": "array",
        "items": {
          "oneOf": [
            {
              "type": "string",
              "description": "Legacy format: Free-form pattern description with inline examples"
            },
            {
              "type": "object",
              "properties": {
                "type": {
                  "type": "string",
                  "description": "Category name for this pattern group (e.g., 'Feline Verbal Tics')"
                },
                "contexts": {
                  "type": "array",
                  "items": {
                    "type": "string"
                  },
                  "description": "Situations where this pattern applies (e.g., 'casual', 'manipulative', 'vulnerable')",
                  "default": []
                },
                "examples": {
                  "type": "array",
                  "items": {
                    "type": "string"
                  },
                  "minItems": 1,
                  "description": "Dialogue examples demonstrating this pattern"
                }
              },
              "required": ["type", "examples"],
              "additionalProperties": false
            }
          ]
        }
      }
    },
    "required": ["patterns"]
  }
}
```

#### Schema Validation Rules

- **Patterns array**: Can contain string items, object items, or a mix of both
- **Object format**:
  - `type` (required): Non-empty string
  - `examples` (required): Array with at least 1 string
  - `contexts` (optional): Array of strings, defaults to empty array
- **Backward compatibility**: Existing string format remains valid

### Backward Compatibility Strategy

#### Format Detection Algorithm

**Location**: `src/prompting/CharacterDataFormatter.js`

```javascript
/**
 * Detects whether speech patterns use legacy string format or new object format
 * @param {Array} patterns - Array of speech patterns
 * @returns {'string'|'object'|'mixed'} - Detected format type
 */
function detectPatternFormat(patterns) {
  if (!patterns || patterns.length === 0) {
    return 'string'; // Default to legacy for empty arrays
  }

  const hasStrings = patterns.some(p => typeof p === 'string');
  const hasObjects = patterns.some(p => typeof p === 'object' && p !== null);

  if (hasStrings && hasObjects) {
    return 'mixed';
  }

  return hasObjects ? 'object' : 'string';
}
```

#### Handling Mixed Formats

When both formats are present:
1. Process object patterns first (structured output)
2. Process string patterns second (legacy output)
3. Apply usage guidance once at the end

#### Fallback Behavior

- If format detection fails, default to string format
- Log warning if mixed format detected (recommend consolidation)
- Never throw errors for format issues—gracefully degrade

---

## Implementation Details

### CharacterDataFormatter Modifications

**File**: `src/prompting/CharacterDataFormatter.js`
**Method**: `formatSpeechPatterns(entity)` (lines 215-241)

#### Current Implementation
```javascript
formatSpeechPatterns(entity) {
  const patterns = entity.getComponent('core:speech_patterns')?.patterns;
  if (!patterns || patterns.length === 0) {
    return '';
  }

  return patterns.map(pattern => `- ${pattern}`).join('\n');
}
```

#### New Implementation
```javascript
formatSpeechPatterns(entity) {
  const patterns = entity.getComponent('core:speech_patterns')?.patterns;
  if (!patterns || patterns.length === 0) {
    return '';
  }

  const format = this.#detectPatternFormat(patterns);

  switch (format) {
    case 'object':
      return this.#formatStructuredPatterns(patterns);
    case 'mixed':
      return this.#formatMixedPatterns(patterns);
    case 'string':
    default:
      return this.#formatLegacyPatterns(patterns);
  }
}

#formatStructuredPatterns(patterns) {
  const objectPatterns = patterns.filter(p => typeof p === 'object');

  let output = '<speech_patterns>\n';
  output += '  <!-- Use naturally, not mechanically. Examples show tendencies, not rules. -->\n\n';

  objectPatterns.forEach((pattern, index) => {
    output += `  ${index + 1}. **${pattern.type}**\n`;

    if (pattern.contexts && pattern.contexts.length > 0) {
      const contextDesc = pattern.contexts.join(', ');
      output += `     Contexts: ${contextDesc}\n`;
    }

    output += '     \n     Examples:\n';
    pattern.examples.forEach(example => {
      output += `     - "${example}"\n`;
    });
    output += '\n';
  });

  output += '</speech_patterns>\n\n';
  output += this.#getUsageGuidance();

  return output;
}

#formatLegacyPatterns(patterns) {
  const stringPatterns = patterns.filter(p => typeof p === 'string');

  let output = '<speech_patterns>\n';
  const list = stringPatterns.map(p => `  - ${p}`).join('\n');
  output += list + '\n';
  output += '</speech_patterns>\n\n';
  output += this.#getUsageGuidance();

  return output;
}

#formatMixedPatterns(patterns) {
  // Process structured patterns first
  const objectOutput = this.#formatStructuredPatterns(patterns);

  // Then legacy patterns
  const stringPatterns = patterns.filter(p => typeof p === 'string');
  if (stringPatterns.length > 0) {
    const legacySection = '\n  **Additional Patterns**\n' +
      stringPatterns.map(p => `  - ${p}`).join('\n') + '\n';

    // Insert before closing tag
    return objectOutput.replace('</speech_patterns>', legacySection + '</speech_patterns>');
  }

  return objectOutput;
}

#getUsageGuidance() {
  return `<usage_guidance>
Use these patterns NATURALLY when appropriate to situation and emotion.
DO NOT cycle through patterns mechanically.
Absence of patterns is also authentic—not every line needs special features.
</usage_guidance>`;
}

#detectPatternFormat(patterns) {
  // Implementation as shown in Format Detection Algorithm section
}
```

### Prompt Template Structure

#### Structured Format Output Example
```xml
<speech_patterns>
  <!-- Use naturally, not mechanically. Examples show tendencies, not rules. -->

  1. **Feline Verbal Tics**
     Contexts: casual, manipulative, vulnerable

     Examples:
     - "Oh meow-y goodness, surely you wouldn't let a poor kitty go thirsty?"
     - "Purr-haps you could help a girl out?"
     - "That's just paw-fully rude!"

  2. **Narrativization Bleeding**
     Contexts: casual, storytelling, evasive

     Examples:
     - "Vespera's smile never wavered, even as she..."
     - "The catgirl had always been good at..."
     - "She found herself thinking..."

  3. **Tonal Shifts**
     Contexts: manipulation, vulnerability, power dynamics

     Examples:
     - [From playful to cold] "Oh? You thought—No."
     - [Sudden softness] "Please. I'm asking nicely."

</speech_patterns>

<usage_guidance>
Use these patterns NATURALLY when appropriate to situation and emotion.
DO NOT cycle through patterns mechanically.
Absence of patterns is also authentic—not every line needs special features.
</usage_guidance>
```

#### Legacy Format Output Example
```xml
<speech_patterns>
  - (when performing or manipulating, she lays it on thick) 'Oh meow-y goodness...'
  - (casual feline wordplay) 'Purr-haps you could help a girl out?'
  - (narrativization tendency) 'Vespera's smile never wavered, even as she...'
</speech_patterns>

<usage_guidance>
Use these patterns NATURALLY when appropriate to situation and emotion.
DO NOT cycle through patterns mechanically.
Absence of patterns is also authentic—not every line needs special features.
</usage_guidance>
```

### Speech Patterns Generator Updates

#### Files Affected

1. `src/characterBuilder/prompts/speechPatternsPrompts.js`
2. `src/characterBuilder/services/SpeechPatternsGenerator.js`
3. `src/characterBuilder/services/SpeechPatternsResponseProcessor.js`
4. `speech-patterns-generator.html`

#### Prompt Template Updates

**File**: `src/characterBuilder/prompts/speechPatternsPrompts.js`

##### Current Response Schema
```javascript
const SPEECH_PATTERNS_RESPONSE_SCHEMA = `
Return 15-25 speech patterns as a JSON array of strings.
Each pattern should describe a recurring speech feature with 1-2 example phrases.

Format: ["(context) 'example'", ...]
`;
```

##### New Response Schema
```javascript
const SPEECH_PATTERNS_RESPONSE_SCHEMA = `
Return 4-8 pattern groups as a JSON array of objects.
Each group should have:
- type: Category name (e.g., "Verbal Tics", "Tonal Shifts")
- contexts: Array of situations where pattern applies (e.g., ["casual", "manipulative"])
- examples: Array of 2-5 dialogue examples demonstrating the pattern

Format:
[
  {
    "type": "Pattern Category",
    "contexts": ["context1", "context2"],
    "examples": ["example 1", "example 2", "example 3"]
  }
]

Aim for 15-25 total examples across all groups.
`;
```

##### Prompt Template Modifications

Update `createSpeechPatternsPrompt()` to:
1. Request structured output format
2. Provide examples of good pattern grouping
3. Emphasize natural context-based organization

```javascript
function createSpeechPatternsPrompt(characterData) {
  return `Generate speech patterns for this character, organized into thematic groups.

CHARACTER CONTEXT:
${characterData}

INSTRUCTIONS:
1. Identify 4-8 distinct speech pattern categories
2. For each category:
   - Name the pattern type clearly
   - List contexts where it applies (casual, formal, stressed, manipulative, etc.)
   - Provide 2-5 concrete dialogue examples
3. Ensure patterns feel authentic to character's personality and background
4. Total examples across all groups: 15-25

GOOD PATTERN CATEGORIES:
- Verbal tics (recurring words/phrases)
- Tonal shifts (mood changes in speech)
- Cultural markers (dialect, formality)
- Emotional tells (stress patterns)
- Power dynamics (how they speak to different people)

${SPEECH_PATTERNS_RESPONSE_SCHEMA}`;
}
```

#### Response Processing Updates

**File**: `src/characterBuilder/services/SpeechPatternsResponseProcessor.js`

##### Current Processing
```javascript
#parseTextResponse(responseText) {
  // Extract JSON array of strings
  // Validate each string
  // Return array
}
```

##### New Processing
```javascript
#parseTextResponse(responseText) {
  const parsed = this.#extractJSON(responseText);

  // Detect format
  if (this.#isLegacyFormat(parsed)) {
    return this.#validateLegacyFormat(parsed);
  }

  return this.#validateStructuredFormat(parsed);
}

#isLegacyFormat(parsed) {
  return Array.isArray(parsed) &&
         parsed.length > 0 &&
         typeof parsed[0] === 'string';
}

#validateStructuredFormat(parsed) {
  if (!Array.isArray(parsed)) {
    throw new Error('Response must be an array of pattern objects');
  }

  return parsed.map((pattern, index) => {
    if (typeof pattern !== 'object' || pattern === null) {
      throw new Error(`Pattern ${index} must be an object`);
    }

    if (!pattern.type || typeof pattern.type !== 'string') {
      throw new Error(`Pattern ${index} missing required 'type' field`);
    }

    if (!Array.isArray(pattern.examples) || pattern.examples.length === 0) {
      throw new Error(`Pattern ${index} missing required 'examples' array`);
    }

    if (pattern.contexts && !Array.isArray(pattern.contexts)) {
      throw new Error(`Pattern ${index} 'contexts' must be an array`);
    }

    return {
      type: pattern.type.trim(),
      contexts: pattern.contexts || [],
      examples: pattern.examples.map(e => e.trim())
    };
  });
}

#validateLegacyFormat(parsed) {
  // Existing validation logic for string arrays
  return parsed.map(p => {
    if (typeof p !== 'string' || p.trim().length === 0) {
      throw new Error('Legacy pattern must be non-empty string');
    }
    return p.trim();
  });
}
```

#### UI Display Updates

**File**: `speech-patterns-generator.html`

##### Current Display
```html
<ul class="patterns-list">
  <!-- Each pattern as a list item -->
</ul>
```

##### New Display (Structured Format)
```html
<div class="speech-patterns">
  <!-- For each pattern group -->
  <div class="pattern-group">
    <h3 class="pattern-type">Feline Verbal Tics</h3>

    <div class="pattern-contexts">
      <span class="context-label">Contexts:</span>
      <span class="context-tag">casual</span>
      <span class="context-tag">manipulative</span>
      <span class="context-tag">vulnerable</span>
    </div>

    <div class="pattern-examples">
      <span class="examples-label">Examples:</span>
      <ul>
        <li>"Oh meow-y goodness..."</li>
        <li>"Purr-haps you could..."</li>
      </ul>
    </div>
  </div>
</div>
```

##### CSS Updates
```css
.pattern-group {
  margin-bottom: 1.5rem;
  padding: 1rem;
  border-left: 3px solid var(--accent-color);
  background: var(--secondary-bg);
}

.pattern-type {
  font-size: 1.1rem;
  font-weight: bold;
  margin-bottom: 0.5rem;
  color: var(--heading-color);
}

.pattern-contexts {
  margin-bottom: 0.75rem;
}

.context-tag {
  display: inline-block;
  padding: 0.2rem 0.5rem;
  margin-right: 0.5rem;
  background: var(--tag-bg);
  border-radius: 3px;
  font-size: 0.9rem;
}

.pattern-examples ul {
  list-style-type: none;
  padding-left: 0;
}

.pattern-examples li {
  padding: 0.3rem 0;
  font-style: italic;
  color: var(--text-secondary);
}
```

##### Animation Issue Fix

**Problem**: CSS animations causing patterns to disappear after generation.

**Root Cause Investigation Required**:
1. Check for conflicting transition properties
2. Verify z-index stacking contexts
3. Examine opacity/visibility animations
4. Test with animations disabled

**Recommended Fix Pattern**:
```css
/* Replace problematic animations with stable transitions */
.pattern-group {
  opacity: 1;
  transition: opacity 0.3s ease-in;
}

.pattern-group.entering {
  opacity: 0;
}

/* Avoid: transform animations that might cause layout issues */
/* Avoid: height animations on dynamically sized content */
```

---

## Data Migration

### Vespera Nightwhisper Character Conversion

**File**: `data/mods/fantasy/entities/definitions/vespera_nightwhisper.character.json`

#### Current Format (18 string patterns)
```json
{
  "components": {
    "core:speech_patterns": {
      "patterns": [
        "(when performing or manipulating, she lays it on thick with weaponized cuteness) 'Oh meow-y goodness, surely you wouldn't let a poor kitty go thirsty?'",
        "(casual speech with feline wordplay) 'Purr-haps you could help a girl out?'",
        // ... 16 more string patterns
      ]
    }
  }
}
```

#### New Format (6 pattern categories)

```json
{
  "components": {
    "core:speech_patterns": {
      "patterns": [
        {
          "type": "Feline Verbal Tics",
          "contexts": ["casual", "manipulative", "vulnerable"],
          "examples": [
            "Oh meow-y goodness, surely you wouldn't let a poor kitty go thirsty?",
            "Purr-haps you could help a girl out?",
            "That's just paw-fully rude!",
            "You've got to be kitten me right now."
          ]
        },
        {
          "type": "Narrativization Bleeding",
          "contexts": ["casual", "storytelling", "evasive"],
          "examples": [
            "Vespera's smile never wavered, even as she considered her next move...",
            "The catgirl had always been good at reading people, and this one...",
            "She found herself thinking of old habits, old patterns...",
            "Her tail swished thoughtfully as the moment stretched."
          ]
        },
        {
          "type": "Tonal Shifts",
          "contexts": ["manipulation", "vulnerability", "power dynamics"],
          "examples": [
            "[From playful to cold] Oh? You thought that would—No.",
            "[Sudden vulnerability] Please. I'm asking nicely this time.",
            "[Casual to menacing] That's cute. Really. But you should stop now.",
            "[Soft to sharp] I said no."
          ]
        },
        {
          "type": "Violence Casualization",
          "contexts": ["combat", "threats", "dark humor"],
          "examples": [
            "Oops! Did I do that? My claws just... slipped.",
            "You're bleeding quite a lot. That's probably not good for you.",
            "Shh, shh, it'll be over soon. Well, for you anyway.",
            "I'm really very good at this part. It's almost unfair, really."
          ]
        },
        {
          "type": "Deflection & Exposure Patterns",
          "contexts": ["vulnerability", "intimacy", "revealing moments"],
          "examples": [
            "This isn't—I don't usually—",
            "[Trailing off mid-deflection, then quiet] I can't think of anything clever right now.",
            "You're really not going to let me hide behind a joke, are you?",
            "That's... that's not fair."
          ]
        },
        {
          "type": "Fragmented Memory & Possession",
          "contexts": ["confusion", "identity crisis", "supernatural influence"],
          "examples": [
            "Sometimes I forget which thoughts are mine and which are... hers.",
            "I remember being angry about that, but I don't remember why I should be.",
            "Did I—Was that me? I think that was me.",
            "The ghost whispers things sometimes. Nasty things. True things."
          ]
        }
      ]
    }
  }
}
```

### Migration Checklist for Other Characters

When converting existing characters to new format:

1. **Analyze existing patterns**: Group by theme or context
2. **Create 4-8 categories**: Don't over-fragment
3. **Extract examples**: Remove inline type descriptions
4. **Add contexts**: Specify when patterns apply
5. **Test in-game**: Verify LLM respects new structure
6. **Keep legacy format**: Only migrate when beneficial

---

## Testing Requirements

### Unit Test Updates

#### File: `tests/unit/prompting/CharacterDataFormatter.test.js`

**New Test Cases**:

```javascript
describe('CharacterDataFormatter - formatSpeechPatterns', () => {
  describe('Format Detection', () => {
    it('should detect string format correctly', () => {
      const patterns = ['pattern 1', 'pattern 2'];
      expect(formatter.detectFormat(patterns)).toBe('string');
    });

    it('should detect object format correctly', () => {
      const patterns = [
        { type: 'Type 1', examples: ['ex1'] }
      ];
      expect(formatter.detectFormat(patterns)).toBe('object');
    });

    it('should detect mixed format correctly', () => {
      const patterns = [
        'string pattern',
        { type: 'Type 1', examples: ['ex1'] }
      ];
      expect(formatter.detectFormat(patterns)).toBe('mixed');
    });

    it('should default to string for empty array', () => {
      expect(formatter.detectFormat([])).toBe('string');
    });
  });

  describe('Structured Format Output', () => {
    it('should format object patterns with XML structure', () => {
      const entity = createMockEntity({
        'core:speech_patterns': {
          patterns: [
            {
              type: 'Verbal Tics',
              contexts: ['casual'],
              examples: ['Example 1', 'Example 2']
            }
          ]
        }
      });

      const output = formatter.formatSpeechPatterns(entity);

      expect(output).toContain('<speech_patterns>');
      expect(output).toContain('**Verbal Tics**');
      expect(output).toContain('Contexts: casual');
      expect(output).toContain('- "Example 1"');
      expect(output).toContain('<usage_guidance>');
    });

    it('should handle multiple pattern groups', () => {
      const entity = createMockEntity({
        'core:speech_patterns': {
          patterns: [
            {
              type: 'Type 1',
              contexts: ['casual'],
              examples: ['Ex 1']
            },
            {
              type: 'Type 2',
              contexts: ['formal'],
              examples: ['Ex 2']
            }
          ]
        }
      });

      const output = formatter.formatSpeechPatterns(entity);

      expect(output).toContain('1. **Type 1**');
      expect(output).toContain('2. **Type 2**');
    });

    it('should handle patterns without contexts', () => {
      const entity = createMockEntity({
        'core:speech_patterns': {
          patterns: [
            {
              type: 'Type 1',
              examples: ['Ex 1']
            }
          ]
        }
      });

      const output = formatter.formatSpeechPatterns(entity);

      expect(output).toContain('**Type 1**');
      expect(output).not.toContain('Contexts:');
      expect(output).toContain('Examples:');
    });
  });

  describe('Legacy Format Output', () => {
    it('should format string patterns with XML structure', () => {
      const entity = createMockEntity({
        'core:speech_patterns': {
          patterns: ['pattern 1', 'pattern 2']
        }
      });

      const output = formatter.formatSpeechPatterns(entity);

      expect(output).toContain('<speech_patterns>');
      expect(output).toContain('- pattern 1');
      expect(output).toContain('- pattern 2');
      expect(output).toContain('<usage_guidance>');
    });
  });

  describe('Mixed Format Output', () => {
    it('should handle mixed string and object patterns', () => {
      const entity = createMockEntity({
        'core:speech_patterns': {
          patterns: [
            {
              type: 'Structured',
              examples: ['Ex 1']
            },
            'legacy pattern'
          ]
        }
      });

      const output = formatter.formatSpeechPatterns(entity);

      expect(output).toContain('**Structured**');
      expect(output).toContain('**Additional Patterns**');
      expect(output).toContain('- legacy pattern');
    });
  });

  describe('Backward Compatibility', () => {
    it('should not break existing string format characters', () => {
      const entity = createMockEntity({
        'core:speech_patterns': {
          patterns: [
            "(context) 'example'",
            "(another context) 'another example'"
          ]
        }
      });

      const output = formatter.formatSpeechPatterns(entity);

      expect(output).toBeTruthy();
      expect(output).toContain("<speech_patterns>");
      expect(output).toContain("<usage_guidance>");
    });
  });
});
```

#### File: `tests/unit/characterBuilder/services/SpeechPatternsResponseProcessor.test.js`

**New Test Cases**:

```javascript
describe('SpeechPatternsResponseProcessor', () => {
  describe('Format Detection', () => {
    it('should detect structured format', () => {
      const response = JSON.stringify([
        { type: 'Type 1', examples: ['ex1'] }
      ]);

      const result = processor.process(response);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('type', 'Type 1');
      expect(result[0]).toHaveProperty('examples');
    });

    it('should detect legacy format', () => {
      const response = JSON.stringify(['pattern 1', 'pattern 2']);

      const result = processor.process(response);

      expect(result).toHaveLength(2);
      expect(typeof result[0]).toBe('string');
    });
  });

  describe('Structured Format Validation', () => {
    it('should validate required type field', () => {
      const response = JSON.stringify([
        { examples: ['ex1'] } // Missing type
      ]);

      expect(() => processor.process(response)).toThrow(/missing.*type/i);
    });

    it('should validate required examples field', () => {
      const response = JSON.stringify([
        { type: 'Type 1' } // Missing examples
      ]);

      expect(() => processor.process(response)).toThrow(/missing.*examples/i);
    });

    it('should require at least one example', () => {
      const response = JSON.stringify([
        { type: 'Type 1', examples: [] }
      ]);

      expect(() => processor.process(response)).toThrow(/examples.*empty/i);
    });

    it('should allow optional contexts field', () => {
      const response = JSON.stringify([
        { type: 'Type 1', examples: ['ex1'] }
      ]);

      const result = processor.process(response);

      expect(result[0]).toHaveProperty('contexts', []);
    });

    it('should validate contexts is an array', () => {
      const response = JSON.stringify([
        { type: 'Type 1', contexts: 'invalid', examples: ['ex1'] }
      ]);

      expect(() => processor.process(response)).toThrow(/contexts.*array/i);
    });
  });

  describe('Data Normalization', () => {
    it('should trim whitespace from type', () => {
      const response = JSON.stringify([
        { type: '  Type 1  ', examples: ['ex1'] }
      ]);

      const result = processor.process(response);

      expect(result[0].type).toBe('Type 1');
    });

    it('should trim whitespace from examples', () => {
      const response = JSON.stringify([
        { type: 'Type 1', examples: ['  ex1  ', '  ex2  '] }
      ]);

      const result = processor.process(response);

      expect(result[0].examples).toEqual(['ex1', 'ex2']);
    });
  });
});
```

### Integration Test Scenarios

#### File: `tests/integration/prompting/speechPatternsIntegration.test.js`

**Test Scenarios**:

```javascript
describe('Speech Patterns Integration', () => {
  describe('End-to-End Formatting', () => {
    it('should load and format structured speech patterns', async () => {
      // Create test character with structured patterns
      const characterData = {
        id: 'test:character',
        components: {
          'core:speech_patterns': {
            patterns: [
              {
                type: 'Verbal Tics',
                contexts: ['casual'],
                examples: ['Example 1', 'Example 2']
              }
            ]
          }
        }
      };

      // Load character
      const character = await entityManager.createEntity(characterData);

      // Format for prompt
      const formatted = characterDataFormatter.formatSpeechPatterns(character);

      // Verify structured output
      expect(formatted).toContain('<speech_patterns>');
      expect(formatted).toContain('**Verbal Tics**');
      expect(formatted).toContain('<usage_guidance>');
    });

    it('should maintain backward compatibility with legacy format', async () => {
      const characterData = {
        id: 'test:legacy',
        components: {
          'core:speech_patterns': {
            patterns: ['(context) \'example\'']
          }
        }
      };

      const character = await entityManager.createEntity(characterData);
      const formatted = characterDataFormatter.formatSpeechPatterns(character);

      expect(formatted).toContain('<speech_patterns>');
      expect(formatted).toContain('(context)');
    });
  });

  describe('Generator Workflow', () => {
    it('should generate structured patterns via AI', async () => {
      const characterContext = {
        name: 'Test Character',
        personality: 'Witty and sarcastic'
      };

      const patterns = await speechPatternsGenerator.generate(characterContext);

      expect(Array.isArray(patterns)).toBe(true);
      if (patterns.length > 0 && typeof patterns[0] === 'object') {
        expect(patterns[0]).toHaveProperty('type');
        expect(patterns[0]).toHaveProperty('examples');
      }
    });
  });

  describe('Validation Workflow', () => {
    it('should validate structured patterns against schema', () => {
      const patterns = [
        {
          type: 'Verbal Tics',
          contexts: ['casual'],
          examples: ['Example 1']
        }
      ];

      const result = validateAgainstSchema(
        { patterns },
        'core:speech_patterns'
      );

      expect(result.valid).toBe(true);
    });

    it('should reject invalid structured patterns', () => {
      const patterns = [
        {
          type: 'Verbal Tics',
          // Missing examples
        }
      ];

      const result = validateAgainstSchema(
        { patterns },
        'core:speech_patterns'
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });
});
```

### Backward Compatibility Test Cases

```javascript
describe('Backward Compatibility', () => {
  it('should load existing characters without modification', async () => {
    // Test with real character file (Vespera)
    const vespera = await characterLoader.load('fantasy:vespera_nightwhisper');

    expect(vespera).toBeDefined();
    expect(vespera.getComponent('core:speech_patterns')).toBeDefined();
  });

  it('should format both formats in prompt generation', () => {
    const mixedPatterns = [
      { type: 'New', examples: ['ex1'] },
      'old format pattern'
    ];

    const entity = createMockEntity({
      'core:speech_patterns': { patterns: mixedPatterns }
    });

    const output = formatter.formatSpeechPatterns(entity);

    expect(output).toContain('**New**');
    expect(output).toContain('old format pattern');
  });

  it('should not break LLM integration with new format', async () => {
    const character = await createTestCharacter({
      speechPatterns: [
        { type: 'Test', examples: ['Hello'] }
      ]
    });

    const prompt = await promptBuilder.buildCharacterPrompt(character);

    expect(prompt).toContain('<speech_patterns>');
    expect(prompt).toContain('<usage_guidance>');
  });
});
```

---

## Implementation Phases

### Phase 1: Core Schema & Compatibility (Priority: Critical)

**Duration**: 1 day

**Deliverables**:
1. Update `speech_patterns.component.json` schema
2. Implement format detection in `CharacterDataFormatter`
3. Add backward compatibility tests
4. Verify existing characters still load

**Success Criteria**:
- Schema validates both formats
- Format detection works reliably
- All existing tests pass
- No breaking changes to existing characters

**Testing**:
- Unit tests for format detection
- Schema validation tests
- Load all existing character files

---

### Phase 2: Prompt Building Enhancement (Priority: High)

**Duration**: 1 day

**Deliverables**:
1. Implement `#formatStructuredPatterns()` method
2. Implement `#formatLegacyPatterns()` method
3. Implement `#formatMixedPatterns()` method
4. Add `<usage_guidance>` to all formats
5. Update prompt building tests

**Success Criteria**:
- Structured patterns render with XML formatting
- Legacy patterns maintain compatibility
- Mixed formats handled gracefully
- Usage guidance appears in all cases

**Testing**:
- Unit tests for each format method
- Integration test with real character data
- Visual inspection of generated prompts

---

### Phase 3: Character Definition Update (Priority: Medium)

**Duration**: 0.5 day

**Deliverables**:
1. Convert Vespera Nightwhisper to structured format
2. Organize into 6 pattern categories
3. Test in-game with LLM
4. Document conversion process

**Success Criteria**:
- Vespera's patterns organized logically
- LLM respects new structure in gameplay
- No loss of pattern richness
- Improved dialogue quality (subjective assessment)

**Testing**:
- Load character file successfully
- Generate dialogue with LLM
- Compare dialogue quality with legacy format

---

### Phase 4: Generator Updates (Priority: Medium)

**Duration**: 1.5 days

**Deliverables**:
1. Update `speechPatternsPrompts.js` for structured output
2. Modify `SpeechPatternsResponseProcessor.js` validation
3. Update UI display for structured patterns
4. Fix animation issues
5. Update export functionality

**Success Criteria**:
- Generator produces structured patterns
- UI displays patterns grouped by type
- Export works with new format
- No animation glitches

**Testing**:
- Unit tests for response processing
- Integration test for full generation flow
- Manual UI testing
- Export/import round-trip test

---

### Phase 5: Testing & Documentation (Priority: High)

**Duration**: 1 day

**Deliverables**:
1. Comprehensive test suite (80%+ coverage)
2. Update mod documentation
3. Create migration guide for modders
4. Add code examples to docs
5. Update CLAUDE.md if needed

**Success Criteria**:
- All tests pass
- 80%+ test coverage maintained
- Documentation is clear and complete
- Modders have migration examples

**Testing**:
- Run full test suite (`npm run test:ci`)
- Manual testing of all workflows
- Peer review of documentation

---

## Open Questions & Decisions

### 1. Context Field Design

**Question**: Should `contexts` be an enum of predefined values or free-form strings?

**Options**:
- **A. Free-form strings** (recommended)
  - Pros: Maximum flexibility, modders not restricted
  - Cons: Inconsistent values, no validation

- **B. Predefined enum**
  - Pros: Consistency, validation, autocomplete
  - Cons: Limited flexibility, needs maintenance

- **C. Suggested values with free-form fallback**
  - Pros: Best of both worlds
  - Cons: More complex validation

**Recommendation**: Start with free-form (A), add suggested values in documentation. Can migrate to (C) later if needed.

**Decision Required By**: Phase 1 (schema design)

---

### 2. Export Format Default

**Question**: When exporting from generator, should default be structured or legacy format?

**Options**:
- **A. Structured object format** (recommended)
  - Pros: Future-facing, richer data
  - Cons: Requires conversion for old workflows

- **B. Legacy string format**
  - Pros: Backward compatible
  - Cons: Loses context information

- **C. User choice with setting**
  - Pros: Flexible
  - Cons: More UI complexity

**Recommendation**: Default to structured (A), add "Export as legacy" button for compatibility.

**Decision Required By**: Phase 4 (generator updates)

---

### 3. Migration Tool

**Question**: Should we create an automated migration tool for converting existing characters?

**Options**:
- **A. No migration tool** (recommended)
  - Rationale: Both formats work, no urgent need
  - Benefit: Less development time

- **B. CLI migration script**
  - Rationale: Helps modders update in bulk
  - Cost: 0.5 days development

- **C. Interactive web tool**
  - Rationale: User-friendly conversion
  - Cost: 1 day development

**Recommendation**: No tool initially (A). Both formats work indefinitely. Add tool later if demand exists.

**Decision Required By**: Not critical (post-implementation)

---

### 4. Pattern Count Limits

**Question**: Should there be limits on number of pattern groups or examples per group?

**Current Limits**: 15-25 total examples (informal guideline)

**Options**:
- **A. Keep current total limit only** (recommended)
  - Guideline: 15-25 total examples across all groups
  - No per-group limits

- **B. Add per-group limits**
  - Example: Max 8 groups, 2-5 examples per group
  - Enforce via schema validation

- **C. No limits**
  - Let modders decide
  - Risk of prompt bloat

**Recommendation**: Keep current total guideline (A), no hard schema limits. Document best practices.

**Decision Required By**: Phase 1 (schema design)

---

### 5. Usage Guidance Customization

**Question**: Should usage guidance be customizable per character or always use default text?

**Options**:
- **A. Fixed default text** (recommended)
  - Pro: Consistency across characters
  - Con: Less flexibility

- **B. Optional custom guidance field**
  - Pro: Character-specific instructions
  - Con: More complexity, risk of poor instructions

**Recommendation**: Fixed default text (A). Usage guidance is about general LLM behavior, not character-specific.

**Decision Required By**: Phase 2 (prompt building)

---

### 6. Animation Issue Investigation

**Question**: What is causing speech patterns to disappear in the generator UI?

**Investigation Required**:
1. Check CSS transition properties on `.patterns-list`
2. Verify JavaScript DOM manipulation timing
3. Test with animations disabled
4. Examine z-index and stacking contexts

**Potential Causes**:
- Height/transform animations on dynamic content
- Opacity transitions with timing issues
- DOM replacement during animation
- CSS specificity conflicts

**Action Items**:
1. Reproduce issue consistently
2. Use browser DevTools to debug
3. Isolate problematic CSS
4. Implement fix in Phase 4

**Decision Required By**: Phase 4 (generator updates)

---

### 7. Validation Strictness

**Question**: How strict should object format validation be?

**Fields**:
- `type`: Required, non-empty string
- `examples`: Required, array with ≥1 string
- `contexts`: Optional, array of strings (can be empty)

**Options**:
- **A. Strict as described above** (recommended)
  - Clear requirements
  - Fails fast on errors

- **B. More lenient**
  - Allow empty examples array (fallback to type only)
  - Allow non-string example values (coerce to string)

- **C. More strict**
  - Require contexts (minimum 1)
  - Require minimum 2 examples
  - Validate context values against enum

**Recommendation**: Strict but reasonable (A). `type` and `examples` are essential; `contexts` is optional enhancement.

**Decision Required By**: Phase 1 (schema design)

---

## Success Criteria

### Functional Requirements

✅ **Schema Validation**
- Both formats validate correctly
- Clear error messages for invalid data
- No breaking changes to existing characters

✅ **Format Detection**
- Reliably identifies string/object/mixed formats
- Handles edge cases (empty arrays, null values)
- Fails gracefully on unexpected input

✅ **Prompt Building**
- Structured format renders with proper XML
- Legacy format maintains compatibility
- Mixed formats combine sensibly
- Usage guidance appears consistently

✅ **Generator Workflow**
- Produces structured output when configured
- Validates generated patterns
- Displays patterns in organized UI
- Exports in correct format

✅ **Backward Compatibility**
- Existing characters load without modification
- String array format continues working
- No performance regressions
- LLM integration unchanged

---

### Quality Requirements

✅ **Test Coverage**
- 80%+ branch coverage
- 90%+ function/line coverage
- Unit tests for all new methods
- Integration tests for workflows

✅ **Code Quality**
- Follows project conventions
- Proper dependency injection
- Clear error handling
- JSDoc comments for public APIs

✅ **Documentation**
- Updated mod documentation
- Migration guide for modders
- Code examples in docs
- Inline comments for complex logic

✅ **Performance**
- Format detection is O(1) (check first element)
- No significant prompt building slowdown
- Generator speed unchanged
- Schema validation overhead minimal

---

### User Experience

✅ **LLM Behavior**
- Patterns used more naturally in context
- Reduced mechanical cycling through patterns
- Better understanding of when to use patterns
- Improved overall dialogue quality

✅ **Modder Experience**
- Easier to create complex patterns
- Clear structure and organization
- Good error messages
- Helpful documentation

✅ **Generator UX**
- Patterns display clearly by group
- No visual glitches or animations issues
- Export works reliably
- Easy to understand output

---

## Appendix: Example Implementations

### Complete CharacterDataFormatter Implementation

```javascript
/**
 * Formats speech patterns for inclusion in character prompts
 * Supports both legacy string format and new structured object format
 * @param {Entity} entity - Character entity with speech_patterns component
 * @returns {string} Formatted speech patterns with usage guidance
 */
formatSpeechPatterns(entity) {
  const patterns = entity.getComponent('core:speech_patterns')?.patterns;
  if (!patterns || patterns.length === 0) {
    return '';
  }

  const format = this.#detectPatternFormat(patterns);

  switch (format) {
    case 'object':
      return this.#formatStructuredPatterns(patterns);
    case 'mixed':
      return this.#formatMixedPatterns(patterns);
    case 'string':
    default:
      return this.#formatLegacyPatterns(patterns);
  }
}

/**
 * Detects speech pattern format type
 * @private
 * @param {Array} patterns - Array of patterns
 * @returns {'string'|'object'|'mixed'} Detected format
 */
#detectPatternFormat(patterns) {
  if (!patterns || patterns.length === 0) {
    return 'string';
  }

  const hasStrings = patterns.some(p => typeof p === 'string');
  const hasObjects = patterns.some(p => typeof p === 'object' && p !== null);

  if (hasStrings && hasObjects) {
    this.#logger.warn('Mixed speech pattern formats detected. Consider consolidating to structured format.');
    return 'mixed';
  }

  return hasObjects ? 'object' : 'string';
}

/**
 * Formats structured object patterns
 * @private
 */
#formatStructuredPatterns(patterns) {
  const objectPatterns = patterns.filter(p => typeof p === 'object' && p !== null);

  let output = '<speech_patterns>\n';
  output += '  <!-- Use naturally, not mechanically. Examples show tendencies, not rules. -->\n\n';

  objectPatterns.forEach((pattern, index) => {
    // Pattern type header
    output += `  ${index + 1}. **${pattern.type}**\n`;

    // Contexts if present
    if (pattern.contexts && pattern.contexts.length > 0) {
      const contextDesc = pattern.contexts.join(', ');
      output += `     Contexts: ${contextDesc}\n`;
    }

    // Examples
    output += '     \n     Examples:\n';
    pattern.examples.forEach(example => {
      output += `     - "${example}"\n`;
    });
    output += '\n';
  });

  output += '</speech_patterns>\n\n';
  output += this.#getUsageGuidance();

  return output;
}

/**
 * Formats legacy string patterns
 * @private
 */
#formatLegacyPatterns(patterns) {
  const stringPatterns = patterns.filter(p => typeof p === 'string');

  let output = '<speech_patterns>\n';
  const list = stringPatterns.map(p => `  - ${p}`).join('\n');
  output += list + '\n';
  output += '</speech_patterns>\n\n';
  output += this.#getUsageGuidance();

  return output;
}

/**
 * Formats mixed string and object patterns
 * @private
 */
#formatMixedPatterns(patterns) {
  // Start with structured patterns
  const objectPatterns = patterns.filter(p => typeof p === 'object' && p !== null);
  let output = this.#formatStructuredPatterns(objectPatterns);

  // Add legacy patterns section
  const stringPatterns = patterns.filter(p => typeof p === 'string');
  if (stringPatterns.length > 0) {
    const legacySection = '\n  **Additional Patterns**\n' +
      stringPatterns.map(p => `  - ${p}`).join('\n') + '\n';

    // Insert before closing tag
    output = output.replace('</speech_patterns>', legacySection + '</speech_patterns>');
  }

  return output;
}

/**
 * Returns standard usage guidance
 * @private
 */
#getUsageGuidance() {
  return `<usage_guidance>
Use these patterns NATURALLY when appropriate to situation and emotion.
DO NOT cycle through patterns mechanically.
Absence of patterns is also authentic—not every line needs special features.
</usage_guidance>`;
}
```

---

## Revision History

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2025-11-24 | 1.0 | Initial specification draft | Claude Code |

---

**End of Specification**
