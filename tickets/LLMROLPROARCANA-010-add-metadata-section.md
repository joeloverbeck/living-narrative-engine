# LLMROLPROARCANA-010: Add Prompt Metadata Section

**Reference:** `reports/llm-roleplay-prompt-architecture-analysis.md` - Section 7.3, Phase 3, Task 2
**Priority:** LOW ⭐⭐
**Estimated Effort:** Low (2-3 hours)
**Impact:** 5% context awareness improvement, better debugging
**Phase:** 3 - Polish & Optimization (Week 3)

## Problem Statement

The current template lacks metadata about its own generation context, making it difficult to:
- Debug issues with specific prompt generations
- Track which template version was used
- Understand prompt scope and scale
- Correlate output quality with prompt characteristics

**Missing Information:**
- Generation timestamp
- Character ID
- Scene/turn number
- Template version
- Estimated token count
- Configuration flags

## Objective

Add a metadata section at the beginning of the prompt template that provides context about prompt generation, version, and characteristics to improve debugging and LLM context awareness.

## Acceptance Criteria

- [ ] Metadata section added at top of template
- [ ] Includes: timestamp, character ID, scene turn, version, token estimate
- [ ] Metadata formatted as valid XML
- [ ] Token count auto-calculated during assembly
- [ ] Version tracking implemented
- [ ] Tests verify metadata accuracy
- [ ] Metadata doesn't interfere with LLM processing

## Technical Implementation

### Files to Modify

1. **`src/prompting/templates/characterPromptTemplate.js`**
   - Add `buildMetadata()` method
   - Implement token counting
   - Add version tracking

2. **Template version constant**
   - Define in configuration or constants file

### Proposed Metadata Structure

```xml
<?xml version="1.0" encoding="UTF-8"?>
<character_roleplay_prompt version="2.0">

<!-- PROMPT METADATA -->
<prompt_metadata>
  <generation_timestamp>2025-11-24T15:32:10Z</generation_timestamp>
  <character_id>vespera_nightwhisper</character_id>
  <scene_turn>42</scene_turn>
  <template_version>2.0.3</template_version>
  <estimated_tokens>5200</estimated_tokens>
  <configuration>
    <simplified_note_taxonomy>true</simplified_note_taxonomy>
    <compressed_persona>true</compressed_persona>
    <categorized_actions>true</categorized_actions>
  </configuration>
</prompt_metadata>

<!-- Rest of prompt... -->
```

### Code Implementation

```javascript
// src/prompting/templates/characterPromptTemplate.js

const TEMPLATE_VERSION = '2.0.0';

class CharacterPromptTemplate {
  assemble(data) {
    const sections = [
      this.buildMetadata(data),
      this.buildSystemConstraints(data),
      this.buildCharacterIdentity(data.character),
      this.buildWorldState(data.world, data.perception),
      this.buildExecutionContext(data.actions, data.recentState),
      this.buildTaskPrompt()
    ];

    const assembled = sections.join('\n\n');

    // Update token count in metadata
    return this.injectActualTokenCount(assembled);
  }

  buildMetadata(data) {
    const timestamp = new Date().toISOString();
    const estimatedTokens = this.estimateTokenCount(data);

    return `<?xml version="1.0" encoding="UTF-8"?>
<character_roleplay_prompt version="${TEMPLATE_VERSION}">

<!-- PROMPT METADATA -->
<prompt_metadata>
  <generation_timestamp>${timestamp}</generation_timestamp>
  <character_id>${data.character.id}</character_id>
  <scene_turn>${data.sceneTurn || 0}</scene_turn>
  <template_version>${TEMPLATE_VERSION}</template_version>
  <estimated_tokens>PLACEHOLDER</estimated_tokens>
  <configuration>
    <simplified_note_taxonomy>${this.config.simplifiedNoteTaxonomy || false}</simplified_note_taxonomy>
    <compressed_persona>${this.config.compressedPersona || false}</compressed_persona>
    <categorized_actions>${this.config.categorizedActions || false}</categorized_actions>
  </configuration>
</prompt_metadata>`;
  }

  estimateTokenCount(data) {
    // Rough estimation based on section sizes
    const characterTokens = this.estimateCharacterTokens(data.character);
    const worldTokens = this.estimateWorldTokens(data.world);
    const actionsTokens = this.estimateActionsTokens(data.actions);
    const constraintsTokens = 800; // Relatively fixed

    return characterTokens + worldTokens + actionsTokens + constraintsTokens;
  }

  injectActualTokenCount(assembled) {
    const actualTokens = this.countTokens(assembled);
    return assembled.replace(
      '<estimated_tokens>PLACEHOLDER</estimated_tokens>',
      `<estimated_tokens>${actualTokens}</estimated_tokens>`
    );
  }

  countTokens(text) {
    // Use gpt-tokenizer library
    const tokenizer = require('gpt-tokenizer');
    return tokenizer.encode(text).length;
  }
}
```

### Version Tracking System

```javascript
// src/prompting/templateVersionManager.js

class TemplateVersionManager {
  static CURRENT_VERSION = '2.0.0';

  static CHANGELOG = {
    '2.0.0': {
      date: '2025-11-24',
      changes: [
        'Restructured to constraint-first architecture',
        'Simplified note taxonomy (16 → 6 types)',
        'Consolidated action tag rules',
        'Compressed persona (4000 → 2500 tokens)',
        'Added metadata section'
      ],
      tokenTarget: 5200
    },
    '1.0.0': {
      date: '2025-01-01',
      changes: ['Initial template version'],
      tokenTarget: 8200
    }
  };

  static getVersion() {
    return this.CURRENT_VERSION;
  }

  static getChangelog(version = this.CURRENT_VERSION) {
    return this.CHANGELOG[version];
  }

  static getMigrationPath(fromVersion, toVersion) {
    // Logic to determine migration steps
    const versions = Object.keys(this.CHANGELOG).sort();
    const fromIndex = versions.indexOf(fromVersion);
    const toIndex = versions.indexOf(toVersion);

    return versions.slice(fromIndex + 1, toIndex + 1);
  }
}
```

## Testing Requirements

### Metadata Accuracy Tests

```javascript
describe('Prompt Metadata', () => {
  it('should include all required metadata fields', () => {
    const prompt = assemblePrompt({
      character: { id: 'test_character' },
      sceneTurn: 42
    });

    expect(prompt).toContain('<generation_timestamp>');
    expect(prompt).toContain('<character_id>test_character</character_id>');
    expect(prompt).toContain('<scene_turn>42</scene_turn>');
    expect(prompt).toContain(`<template_version>${TEMPLATE_VERSION}</template_version>`);
    expect(prompt).toContain('<estimated_tokens>');
  });

  it('should accurately count tokens', () => {
    const prompt = assemblePrompt(testData);

    const tokenCountMatch = prompt.match(/<estimated_tokens>(\d+)<\/estimated_tokens>/);
    expect(tokenCountMatch).toBeDefined();

    const reportedTokens = parseInt(tokenCountMatch[1]);
    const actualTokens = countTokens(prompt);

    // Should be within 5% accuracy
    const accuracy = Math.abs(reportedTokens - actualTokens) / actualTokens;
    expect(accuracy).toBeLessThan(0.05);
  });

  it('should track configuration flags', () => {
    const promptV2 = assemblePrompt(testData, { version: '2.0' });

    expect(promptV2).toContain('<simplified_note_taxonomy>true</simplified_note_taxonomy>');
    expect(promptV2).toContain('<compressed_persona>true</compressed_persona>');

    const promptV1 = assemblePrompt(testData, { version: '1.0' });

    expect(promptV1).toContain('<simplified_note_taxonomy>false</simplified_note_taxonomy>');
  });

  it('should generate valid ISO timestamp', () => {
    const prompt = assemblePrompt(testData);

    const timestampMatch = prompt.match(/<generation_timestamp>(.*?)<\/generation_timestamp>/);
    expect(timestampMatch).toBeDefined();

    const timestamp = timestampMatch[1];
    const date = new Date(timestamp);

    expect(date.toString()).not.toBe('Invalid Date');
    expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});
```

### Unit Tests
- [ ] Test `buildMetadata()` generates correct XML
- [ ] Test token counting accuracy
- [ ] Test version tracking
- [ ] Test configuration flag serialization

### Integration Tests
- [ ] Test metadata appears at top of assembled prompt
- [ ] Verify metadata doesn't interfere with LLM processing
- [ ] Test token count updates correctly

## Dependencies

- **Blocks:** None
- **Blocked By:** None
- **Related:**
  - LLMROLPROARCANA-011 (Version Control Comments) - related to version tracking

## Success Metrics

| Metric | Baseline | Target | Measurement Method |
|--------|----------|--------|-------------------|
| Metadata completeness | N/A | 100% | Field presence check |
| Token count accuracy | N/A | >95% | Actual vs reported comparison |
| Debugging time | Unknown | -15% | Developer feedback |
| Context awareness | Unknown | +5% | LLM evaluation |

## Rollback Plan

Metadata section is additive and low-risk. If issues arise:
1. Remove metadata section entirely
2. Template functions without it (backward compatible)
3. Can re-add later with refinements

## Implementation Notes

### Why Metadata Matters

**For Developers:**
- Debug prompt generation issues
- Track which template version produced which outputs
- Correlate output quality with prompt characteristics
- A/B test different template versions

**For LLM:**
- Understand prompt scope (scene turn context)
- Awareness of configuration (what features are active)
- Time context (generation timestamp)

**For Analytics:**
- Track template version usage
- Monitor token budget consumption
- Identify optimization opportunities

### Token Counting Accuracy

Use `gpt-tokenizer` library for accurate token counting:

```javascript
const { encode } = require('gpt-tokenizer');

function countTokens(text) {
  return encode(text).length;
}
```

**Accuracy Targets:**
- Within 5% of actual count
- Fast enough for real-time generation (<50ms)
- Handles special characters and encoding

### Configuration Flags

Track which optimizations are active:
- `simplified_note_taxonomy`: Using 6 types vs 16
- `compressed_persona`: Using 2500 token persona vs 4000
- `categorized_actions`: Using categorized vs flat action list
- `constraint_first`: Using constraint-first vs old architecture

Helps correlate features with output quality.

## References

- Report Section 7.3: "Recommendation 9 - Add Metadata Section"
- Report Section 8.1: "Proposed Architecture"
