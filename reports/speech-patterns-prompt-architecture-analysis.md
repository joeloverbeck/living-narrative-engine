# Speech Patterns Generator Prompt Architecture Analysis

**Analysis Date:** August 27, 2025  
**Scope:** Prompt architecture comparison across character builder generators  
**Focus:** Speech Patterns Generator architectural improvements based on XML structure patterns

## Executive Summary

This report analyzes the prompt structures across four HTML-based character generation tools in the Living Narrative Engine project and provides specific architectural improvements for the Speech Patterns Generator. The analysis reveals significant structural inconsistencies and improvement opportunities, particularly in adopting the XML-like structured approach used by other successful generators.

**Key Finding:** The Speech Patterns Generator uses a different architectural pattern (direct text formatting) compared to the consistent XML-like structure used by other generators. This creates maintenance challenges and misses opportunities for enhanced extensibility and clarity.

## Analyzed Components

| Generator              | HTML Page                         | Prompt File                        | Primary Architecture       |
| ---------------------- | --------------------------------- | ---------------------------------- | -------------------------- |
| **Speech Patterns**    | speech-patterns-generator.html    | speechPatternsPrompts.js           | Direct text prompt         |
| **Thematic Direction** | thematic-direction-generator.html | thematicDirectionsPrompt.js        | XML-like structured prompt |
| **Traits Generator**   | traits-generator.html             | traitsGenerationPrompt.js          | XML-like structured prompt |
| **Core Motivations**   | core-motivations-generator.html   | coreMotivationsGenerationPrompt.js | XML-like structured prompt |

## Architecture Analysis

### 1. Prompt Structure Patterns

#### Speech Patterns Generator (Current - Direct Text Structure)

```javascript
// Location: src/characterBuilder/prompts/speechPatternsPrompts.js
function createSpeechPatternsPrompt(characterData, options = {}) {
  return `CONTENT GUIDELINES:
RATING: NC-21 (ADULTS ONLY)
NO RESTRICTIONS: ...

TASK: Generate approximately ${patternCount} unique speech patterns...

CHARACTER DEFINITION:
${characterJson}

REQUIREMENTS:
- Create ~${patternCount} examples...
- Each pattern must reflect...

RESPONSE FORMAT:
Please respond with a JSON object...`;
}
```

**Current Architecture Characteristics:**

- **Direct text approach**: Lacks XML-like structural organization
- **Content policy at top**: Different from other generators' bottom placement
- **Limited structural separation**: Sections blend together without clear boundaries
- **Minimal role definition**: No explicit role assignment for the AI

#### Other Generators (Consistent XML-like Structure)

```javascript
// Pattern used by: thematicDirectionsPrompt.js, traitsGenerationPrompt.js, coreMotivationsGenerationPrompt.js
function buildPrompt(data) {
  return `<role>
Expert character development consultant...
</role>

<task_definition>
Generate detailed analysis based on...
</task_definition>

<character_concept>
${concept}
</character_concept>

<instructions>
Based on the provided context...
</instructions>

<constraints>
- Must contain 3-5 items
- Avoid clichés listed
</constraints>

<response_format>
{
  "field": "value"
}
</response_format>

<content_policy>
CONTENT GUIDELINES:
RATING: NC-21 (ADULTS ONLY)...
</content_policy>`;
}
```

### 2. Content Guidelines Placement Analysis

| Generator              | Content Guidelines Location          | Architectural Impact                                                        |
| ---------------------- | ------------------------------------ | --------------------------------------------------------------------------- |
| **Speech Patterns**    | **Top of prompt** (lines 77-89)      | **❌ Problematic**: Content policy dominates, overshadowing task definition |
| **Thematic Direction** | **Bottom of prompt** (lines 143-155) | **✅ Optimal**: Task context and role established first                     |
| **Traits Generator**   | **Bottom of prompt** (lines 387-399) | **✅ Optimal**: Clear task definition before constraints                    |
| **Core Motivations**   | **Bottom of prompt** (lines 297-309) | **✅ Optimal**: Professional context before content policy                  |

**Pattern Analysis:**

- **75% consistency**: 3/4 generators place content guidelines at the end
- **Speech Patterns anomaly**: Only generator with content guidelines at the start
- **Impact**: Early content policy may bias LLM towards content generation over task comprehension

### 3. Structural Component Analysis

#### Speech Patterns Generator (Current Structure Issues)

```
1. CONTENT GUIDELINES (13 lines) ❌ Should be at end like other generators
2. TASK (1 line) ❌ Minimal compared to XML <task_definition> sections
3. CHARACTER DEFINITION (2 lines) ❌ No clear role definition for AI
4. REQUIREMENTS (5 lines) ❌ Lacks <instructions> detailed guidance
5. EXAMPLES (3 lines) ❌ Missing <constraints> section structure
6. RESPONSE FORMAT (12 lines) ⚠️ Good content but lacks XML organization
```

**Missing XML-like Components:**

- **`<role>`**: No explicit AI role assignment (e.g., "Expert character development consultant")
- **`<task_definition>`**: Minimal task scoping compared to structured alternatives
- **`<instructions>`**: Lacks detailed step-by-step guidance section
- **`<constraints>`**: Requirements scattered rather than clearly grouped

#### Standard Pattern (Other Generators)

```
1. <role> (2-3 lines) ✅ Clear AI role definition
2. <task_definition> (2-3 lines) ✅ Focused task scope
3. <input_sections> (Variable) ✅ Structured data inputs
4. <instructions> (10-15 lines) ✅ Detailed step-by-step guidance
5. <constraints> (5-8 lines) ✅ Clear limitations and requirements
6. <response_format> (15-20 lines) ✅ JSON schema with examples
7. <content_policy> (12 lines) ✅ Mature content guidelines at end
```

### 4. LLM Parameters Comparison

| Generator              | Temperature | Max Tokens | Token Strategy      | Output Requirements                 |
| ---------------------- | ----------- | ---------- | ------------------- | ----------------------------------- |
| **Speech Patterns**    | **0.8**     | **2,000**  | **❌ Insufficient** | ~20 detailed patterns with examples |
| **Thematic Direction** | 0.7         | 2,000      | ✅ Adequate         | 3-5 thematic directions             |
| **Traits Generator**   | 0.8         | **4,000**  | ✅ Well-allocated   | Comprehensive trait categories      |
| **Core Motivations**   | 0.8         | 3,000      | ✅ Appropriate      | 3-5 complex motivations             |

**Token Allocation Analysis:**

- **Speech Patterns**: Needs ~100 tokens per pattern × 20 patterns + overhead = ~2,200 tokens
- **Current limitation**: 2,000 tokens likely causes truncation
- **Recommended**: Increase to 3,000 tokens to match complexity requirements

### 5. Response Schema Architecture

#### Speech Patterns (Minimal Schema)

```javascript
properties: {
  characterName: { type: 'string', minLength: 1 },
  speechPatterns: {
    type: 'array',
    minItems: 3,
    items: {
      pattern: { type: 'string', minLength: 5 },
      example: { type: 'string', minLength: 3 },
      circumstances: { type: 'string', minLength: 0 } // Optional
    }
  }
}
```

#### Other Generators (Comprehensive Schemas)

- **Detailed field constraints** (min/max lengths, required fields)
- **Nested object validation** (traits generator has 12 categories)
- **Array length validation** (specific min/max items)
- **Content validation** (question marks required for centralQuestion)

## Critical Architectural Issues

### 1. Structural Inconsistency with Established Pattern ❌

**Problem:** Speech Patterns Generator uses direct text structure while other generators use proven XML-like structure.

**Evidence:**

- **75% consistency**: 3/4 generators use `<role>`, `<task_definition>`, `<instructions>`, `<constraints>`, `<content_policy>` structure
- **Maintenance burden**: Different pattern requires separate documentation and training
- **Extensibility limitation**: Direct text is harder to programmatically modify or extend

**Impact:**

- Developers must understand multiple prompt architectures
- Template modifications require different approaches
- Testing strategies diverge unnecessarily

### 2. Content Policy Misplacement ❌

**Problem:** Content guidelines appear at the beginning instead of the end like other generators.

**Comparison:**

- **Speech Patterns**: Content policy first (lines 1-13)
- **All others**: Content policy last (establishing task context first)

**Issues:**

- **Attention bias**: LLM focuses on content restrictions before understanding the task
- **Cognitive load**: Task requirements compete with content policy for attention
- **Inconsistent user experience**: Developers expect content policy at the end

### 3. Missing Structural Components ❌

**Problem:** Lacks XML-like organizational structure that provides clear boundaries.

**Missing Elements:**

- **`<role>`**: No explicit AI role definition
- **`<task_definition>`**: Task description buried in content policy section
- **`<instructions>`**: Detailed guidance scattered across sections
- **`<constraints>`**: Requirements mixed with examples and formatting

**Consequences:**

- Reduced prompt clarity and maintainability
- Harder to modify individual sections
- Inconsistent with established team patterns

### 4. Insufficient Token Allocation ❌

**Problem:** 2,000 max tokens insufficient for ~20 detailed speech patterns.

**Calculation:**

- Average pattern: ~100 tokens (pattern + example + circumstances)
- 20 patterns: ~2,000 tokens
- JSON overhead + character name: ~200 tokens
- **Total needed: ~2,200 tokens (10% over current limit)**

**Evidence:** Confirmed in `SPEECH_PATTERNS_LLM_PARAMS.max_tokens: 2000`

## Recommended Architectural Improvements

### 1. Adopt XML-like Structured Architecture ⭐ **HIGH PRIORITY**

**Current Pattern:**

```javascript
return `CONTENT GUIDELINES:
RATING: NC-21 (ADULTS ONLY)
NO RESTRICTIONS: ...

TASK: Generate approximately ${patternCount} unique speech patterns...`;
```

**Recommended XML-like Structure:**

```javascript
return `<role>
You are an expert character dialogue and speech pattern specialist with extensive knowledge of personality psychology, linguistics, and creative writing. Your expertise includes analyzing how different personality types, backgrounds, and emotional states manifest in speech patterns, word choice, and conversational behaviors.
</role>

<task_definition>
Generate ${patternCount} unique speech patterns for the provided character that demonstrate how their personality, background, and circumstances manifest in their dialogue and communication style.
</task_definition>

<character_concept>
${characterJson}
</character_concept>

<instructions>
1. Analyze the character's core personality traits and how they would manifest in speech
2. Consider their background, education level, and social circumstances
3. Incorporate emotional states and relationship dynamics into speech patterns
4. Create patterns that show both consistency and variation based on different situations
5. Ensure each pattern includes the specific example and circumstances for context
6. Focus on authentic dialogue that reveals character depth and personality
7. Consider how stress, comfort, attraction, conflict, and other emotional states affect their speech
8. Include both verbal patterns (word choice, grammar, formality) and behavioral patterns (interrupting, pausing, volume)
</instructions>

<constraints>
- Generate exactly ${patternCount} distinct speech patterns
- Each pattern must include: pattern description, specific example, and circumstances
- Avoid contradictory patterns unless they represent character complexity
- Ensure patterns are consistent with character's background and personality
- Include variety in emotional contexts and relationship dynamics
- Focus on dialogue patterns, not just personality descriptions
</constraints>

<response_format>
{
  "characterName": "string (character's name)",
  "speechPatterns": [
    {
      "pattern": "string (description of the speech pattern)",
      "example": "string (specific example of dialogue)",
      "circumstances": "string (when/why this pattern occurs)"
    }
  ]
}
</response_format>

<content_policy>
CONTENT GUIDELINES:
RATING: NC-21 (ADULTS ONLY)
NO RESTRICTIONS: Generate any content including explicit sexual themes, violence, profanity, controversial topics, or mature subject matter as needed for authentic character development. Adult characters may have adult speech patterns, crude language, sexual expressions, or discuss mature topics. Create realistic dialogue appropriate to the character's background, personality, and circumstances.
</content_policy>`;
```

**Benefits:**

- **Consistency**: Matches pattern used by 3/4 other generators
- **Maintainability**: Clear section boundaries for easier modifications
- **Extensibility**: Structured format easier to programmatically modify
- **Clarity**: Explicit role assignment and task definition

### 2. Increase Token Allocation ⭐ **HIGH PRIORITY**

**Current Limit:** 2,000 tokens  
**Recommended:** 3,000 tokens

**Justification:**

- Current patterns require ~100 tokens each (pattern + example + circumstances)
- Target 20 patterns = 2,000 tokens minimum
- JSON overhead + metadata = ~200-300 tokens
- **Buffer needed:** ~500-800 tokens to prevent truncation

**Implementation:** Update `SPEECH_PATTERNS_LLM_PARAMS.max_tokens` from 2000 to 3000

### 3. Enhanced Response Schema Design ⭐ **MEDIUM PRIORITY**

**Current Schema (Minimal):**

```javascript
properties: {
  characterName: { type: 'string', minLength: 1 },
  speechPatterns: {
    type: 'array',
    minItems: 3,
    items: {
      pattern: { type: 'string', minLength: 5 },
      example: { type: 'string', minLength: 3 },
      circumstances: { type: 'string', minLength: 0 }
    }
  }
}
```

**Recommended Enhanced Schema:**

```javascript
properties: {
  characterName: { type: 'string', minLength: 1, maxLength: 50 },
  speechPatterns: {
    type: 'array',
    minItems: 15,
    maxItems: 25,
    items: {
      pattern: {
        type: 'string',
        minLength: 20,
        maxLength: 200,
        description: "Detailed description of the speech pattern"
      },
      example: {
        type: 'string',
        minLength: 10,
        maxLength: 150,
        description: "Specific dialogue example demonstrating the pattern"
      },
      circumstances: {
        type: 'string',
        minLength: 10,
        maxLength: 100,
        description: "Context when this pattern typically occurs"
      }
    }
  },
  generationMetadata: {
    type: 'object',
    properties: {
      focusType: { type: 'string', enum: ['emotional', 'social', 'psychological', 'relationship'] },
      complexity: { type: 'string', enum: ['simple', 'moderate', 'complex'] },
      timestamp: { type: 'string', format: 'date-time' }
    },
    required: ['focusType', 'timestamp']
  }
}
```

### 4. Focus Variation Integration ⭐ **MEDIUM PRIORITY**

**Current Approach:** External focus variation system
**Recommendation:** Integrate focus variations into XML structure

**Proposed Implementation:**

```javascript
<instructions>
  ${baseFocusInstructions}$
  {focusType === 'EMOTIONAL_FOCUS'
    ? `
EMOTIONAL FOCUS ENHANCEMENT:
- Emphasize how emotions affect speech patterns, tone, and word choice
- Include patterns for different emotional states (joy, anger, sadness, fear, excitement)
- Show how emotional intensity changes dialogue structure and vocabulary
- Consider emotional vulnerability and defensive speech patterns
`
    : ''}
  $
  {focusType === 'SOCIAL_FOCUS'
    ? `
SOCIAL FOCUS ENHANCEMENT:
- Highlight how social hierarchy and relationships affect speech
- Include patterns for formal vs informal social situations
- Show adaptation to different social groups and contexts
- Consider power dynamics in conversational patterns
`
    : ''}
</instructions>
```

## Implementation Priority Matrix

| Priority   | Improvement                     | Effort | Impact | Timeline  | Business Value                    |
| ---------- | ------------------------------- | ------ | ------ | --------- | --------------------------------- |
| **HIGH**   | XML-like Structure Migration    | Medium | High   | 2-3 days  | Team consistency, maintainability |
| **HIGH**   | Token Allocation Increase       | Low    | High   | 1 hour    | Prevents response truncation      |
| **MEDIUM** | Enhanced Response Schema        | Medium | Medium | 1-2 days  | Better validation, metadata       |
| **MEDIUM** | Focus Variation XML Integration | Low    | Medium | 4-6 hours | Structural consistency            |
| **LOW**    | Content Policy Repositioning    | Low    | Low    | 1 hour    | Consistency with other generators |

## Migration Strategy for XML Structure Adoption

### Phase 1: Core Structure Migration (2-3 days)

1. **Restructure prompt template** to use XML-like format
   - Add `<role>` section with expert persona definition
   - Create `<task_definition>` with clear objectives
   - Implement `<instructions>` with detailed step-by-step guidance
   - Define `<constraints>` section for requirements
   - Move `<content_policy>` to end of prompt

2. **Update token allocation** from 2,000 to 3,000 in `SPEECH_PATTERNS_LLM_PARAMS`

3. **Integration testing** to ensure XML structure works with existing focus variations

### Phase 2: Enhanced Schema Implementation (1-2 days)

1. **Upgrade response schema** with enhanced validation rules
2. **Add metadata tracking** for focus types and generation timestamps
3. **Implement length constraints** for pattern components
4. **Testing with enhanced schema** validation

### Phase 3: Focus Variation Integration (4-6 hours)

1. **Integrate focus variations** directly into XML `<instructions>` section
2. **Remove external focus variation** dependency where possible
3. **Validate focus-specific prompting** works correctly
4. **Performance testing** of integrated system

### Phase 4: Final Consistency Updates (2-3 hours)

1. **Content policy repositioning** validation
2. **Cross-generator consistency** testing
3. **Documentation updates** reflecting new structure
4. **Team training** on new prompt architecture

## Testing Requirements

### XML Structure Validation

- [ ] Prompt structure matches XML-like pattern of other generators
- [ ] Content policy positioned at end of prompt (not beginning)
- [ ] Role definition clearly establishes AI expertise
- [ ] Task definition provides focused scope
- [ ] Instructions section offers detailed step-by-step guidance
- [ ] Constraints section groups all requirements clearly
- [ ] Character data integration works correctly within new structure

### Token Allocation Testing

- [ ] Generate 20+ patterns with 3,000 token limit
- [ ] Validate no truncation occurs with complex characters
- [ ] Test performance with maximum pattern counts (25 patterns)
- [ ] Confirm JSON overhead fits within token budget
- [ ] Verify response completeness across different focus types

### Response Quality Testing

- [ ] Enhanced schema validation catches all error conditions
- [ ] Metadata tracking works correctly (focus type, timestamp)
- [ ] Pattern length constraints enforced properly
- [ ] Focus variation integration produces specialized content
- [ ] XML structure improves response clarity and completeness

### Cross-Generator Consistency Testing

- [ ] Prompt format matches thematic direction generator pattern
- [ ] Content policy positioning consistent with other generators
- [ ] Response schema follows established patterns
- [ ] Token allocation appropriate for output complexity

## Conclusion

**Primary Finding:** The Speech Patterns Generator uses an inconsistent architectural pattern compared to other character generation tools, creating maintenance challenges and missing opportunities for improved structure and extensibility.

### Critical Issues Identified

1. **Structural Inconsistency** - Only generator not using XML-like structure (75% consistency gap)
2. **Content Policy Misplacement** - Guidelines at beginning instead of end like other generators
3. **Missing Structural Components** - Lacks explicit role, task definition, and instruction sections
4. **Insufficient Token Allocation** - 2,000 tokens inadequate for ~20 detailed speech patterns

### Recommended Approach

1. **Migrate to XML-like structure** to match successful pattern used by other generators
2. **Increase token allocation** from 2,000 to 3,000 for sufficient response capacity
3. **Enhance response schema** with better validation and metadata tracking
4. **Integrate focus variations** directly into structured prompt format

### Benefits of XML Structure Adoption

- **Team consistency**: Single prompt architecture across all generators
- **Maintainability**: Clear section boundaries for easier modifications
- **Extensibility**: Structured format supports programmatic enhancements
- **Clarity**: Explicit role assignment and task definition improve LLM comprehension

### Implementation Impact

- **Development effort**: 2-3 days for core migration, 1-2 days for enhancements
- **Risk level**: Low (proven pattern used by other successful generators)
- **Business value**: Improved maintainability, consistency, and extensibility

The migration to XML-like structure represents a strategic alignment with established team patterns while preserving and enhancing the existing functionality.

---

_Generated by Claude Code Architecture Analysis System_
