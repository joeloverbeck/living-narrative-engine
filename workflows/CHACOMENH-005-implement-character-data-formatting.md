# CHACOMENH-005: Implement Character Data Formatting

**Phase**: Data Extraction & Processing  
**Priority**: Critical  
**Complexity**: Medium  
**Dependencies**: CHACOMENH-001, CHACOMENH-002, CHACOMENH-003, CHACOMENH-004  
**Estimated Time**: 2-3 hours

## Summary

Add formatting methods to CharacterDataFormatter.js for the three new psychological components and integrate them into the character persona generation. The formatted sections will be included in the LLM prompt to provide deeper psychological context for character behavior.

## Background

The CharacterDataFormatter service converts raw character component data into markdown-formatted text for inclusion in LLM prompts. Each component type has its own formatting method that handles validation, formatting, and logging. The new psychological components need similar formatting methods and integration into the main persona formatting flow.

## Technical Requirements

### Files to Modify

1. **src/prompting/CharacterDataFormatter.js**
   - Add three new formatting methods
   - Update formatCharacterPersona method
   - Maintain consistent formatting patterns

### Formatting Patterns

Each component formatter should:

- Validate input (check for null/undefined/empty)
- Log debug information
- Return markdown-formatted section
- Use consistent header levels (##)
- Maintain first-person perspective

## Implementation Details

### 1. Add Formatting Methods

Add these three methods to the CharacterDataFormatter class:

#### formatMotivationsSection Method

```javascript
/**
 * Format motivations section
 * @param {string} motivationsText - Core psychological motivations
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
  this.#logger.debug('CharacterDataFormatter: Formatted motivations section', {
    textLength: trimmedText.length
  });
  return result;
}
```

#### formatInternalTensionsSection Method

```javascript
/**
 * Format internal tensions section
 * @param {string} tensionsText - Internal conflicts and competing desires
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
  this.#logger.debug('CharacterDataFormatter: Formatted internal tensions section', {
    textLength: trimmedText.length
  });
  return result;
}
```

#### formatCoreDilemmasSection Method

```javascript
/**
 * Format core dilemmas section
 * @param {string} dilemmasText - Fundamental questions the character grapples with
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
  this.#logger.debug('CharacterDataFormatter: Formatted core dilemmas section', {
    textLength: trimmedText.length
  });
  return result;
}
```

### 2. Update formatCharacterPersona Method

Locate the `formatCharacterPersona` method and integrate the new sections:

#### Add to Destructuring

```javascript
formatCharacterPersona(characterData) {
  // ... validation code ...

  const {
    name,
    description,
    personality,
    profile,
    likes,
    dislikes,
    strengths,
    weaknesses,
    secrets,
    fears,
    speechPatterns,
    motivations,        // NEW
    internalTensions,   // NEW
    coreDilemmas,       // NEW
  } = characterData;
```

#### Add Sections in Logical Order

Insert the new sections after profile but before likes (placing psychological aspects early):

```javascript
// ... existing header and description ...

// Profile section
const profileSection = this.formatProfileSection(profile);
if (profileSection) {
  result += profileSection + '\n';
}

// NEW: Psychological components (place after profile, before likes)
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

// Continue with existing sections
const likesSection = this.formatLikesSection(likes);
if (likesSection) {
  result += likesSection + '\n';
}

// ... rest of existing sections ...
```

### 3. Expected Output Format

When all three components are present, the prompt structure will be:

```markdown
YOU ARE [Character Name].
This is your identity. All thoughts, actions, and words must stem from this core truth.

## Your Description

[Physical description]

## Your Personality

[Personality traits]

## Your Profile

[Background story]

## Your Core Motivations

[Why the character acts - psychological drivers]

## Your Internal Tensions

[Conflicting desires and internal struggles]

## Your Core Dilemmas

[Fundamental questions without easy answers]

## Your Likes

[Things enjoyed]

## Your Dislikes

[Things avoided]

[... rest of sections ...]
```

## Testing Requirements

### Unit Test Scenarios

For each formatting method, test:

1. **Valid Input**: Normal text input produces formatted section
2. **Empty String**: Empty string returns empty result
3. **Null/Undefined**: Returns empty result without errors
4. **Whitespace Only**: Trimmed to empty, returns empty result
5. **Long Text**: Handles long text appropriately
6. **Special Characters**: Preserves markdown and special characters

### Integration Test Scenarios

1. **All Components Present**: Full persona includes all sections
2. **No Psychological Components**: Persona works without new sections
3. **Mixed Presence**: Some psychological components present
4. **Section Order**: Sections appear in correct order

### Example Test Case

```javascript
describe('formatMotivationsSection', () => {
  it('should format valid motivations text', () => {
    const input = 'I seek power because I fear being powerless.';
    const expected =
      '## Your Core Motivations\nI seek power because I fear being powerless.\n';

    const result = formatter.formatMotivationsSection(input);
    expect(result).toBe(expected);
  });

  it('should return empty string for null input', () => {
    const result = formatter.formatMotivationsSection(null);
    expect(result).toBe('');
  });

  it('should handle empty string', () => {
    const result = formatter.formatMotivationsSection('');
    expect(result).toBe('');
  });
});
```

## Validation Checklist

### Code Quality

- [ ] Methods follow existing naming patterns
- [ ] Consistent parameter validation
- [ ] Appropriate debug logging
- [ ] JSDoc comments complete and accurate

### Formatting Consistency

- [ ] Section headers use ## level
- [ ] Consistent spacing (single newline between sections)
- [ ] First-person perspective maintained
- [ ] Markdown formatting preserved

### Integration

- [ ] Sections appear in logical order
- [ ] Optional sections handled gracefully
- [ ] No impact on existing sections
- [ ] Clean output format

## Acceptance Criteria

- [ ] Three formatting methods implemented
- [ ] Methods handle null/undefined/empty inputs
- [ ] Debug logging included
- [ ] JSDoc documentation complete
- [ ] formatCharacterPersona updated
- [ ] New properties destructured correctly
- [ ] Sections integrated in proper order
- [ ] All existing tests pass
- [ ] New test coverage added
- [ ] Output format matches specification

## Performance Considerations

### Optimization Notes

- String concatenation is acceptable for this use case
- No need for StringBuilder pattern (small strings)
- Trim once and reuse result
- Early return for invalid input

### Memory Usage

- Minimal impact (text formatting only)
- No data persistence
- Garbage collection friendly

## Troubleshooting Guide

### Common Issues

1. **Section not appearing**: Check if property exists in characterData
2. **Wrong order**: Verify insertion point in formatCharacterPersona
3. **Extra spacing**: Check newline handling
4. **Missing header**: Ensure markdown format correct

### Debug Tips

```javascript
// Add logging to verify data flow
this.#logger.debug('Character data received', {
  hasMotivations: !!characterData.motivations,
  hasTensions: !!characterData.internalTensions,
  hasDilemmas: !!characterData.coreDilemmas,
});
```

## Rollback Plan

If issues arise:

1. Remove three new formatting methods
2. Remove calls from formatCharacterPersona
3. Remove destructuring additions
4. No data changes needed

## Future Enhancements

Consider for future iterations:

- Markdown validation
- Character limit enforcement
- Template customization
- Section reordering configuration
- Conditional formatting based on context

## Notes

- Maintains existing patterns for consistency
- No breaking changes to API
- Graceful handling of missing data
- Debug logging aids troubleshooting
- First-person perspective crucial for LLM understanding

---

_Ticket created from character-components-analysis.md report_
