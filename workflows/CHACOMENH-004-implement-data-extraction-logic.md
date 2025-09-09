# CHACOMENH-004: Implement Data Extraction Logic

**Phase**: Data Extraction & Processing  
**Priority**: Critical  
**Complexity**: Medium  
**Dependencies**: CHACOMENH-001, CHACOMENH-002, CHACOMENH-003  
**Estimated Time**: 2-3 hours

## Summary

Update the actor data extraction service to retrieve the three new psychological components (motivations, internal tensions, core dilemmas) from entity state and include them in the prompt data passed to the LLM. The components should be optional and use appropriate fallback behavior when not present.

## Background

The `actorDataExtractor.js` service is responsible for extracting character component data from entity state and preparing it for prompt generation. It uses a pattern of optional text attributes with fallback values to handle missing components gracefully.

## Technical Requirements

### Files to Modify

1. **src/turns/services/actorDataExtractor.js**
   - Import new component ID constants
   - Add new components to optionalTextAttributes array
   - Ensure proper extraction and fallback handling

### Implementation Pattern

The service uses an array-based pattern for optional text attributes:
```javascript
const optionalTextAttributes = [
  { key: 'propertyName', componentId: COMPONENT_ID },
  // ...
];
```

## Implementation Details

### 1. Add Imports

Add to the existing imports section:

```javascript
import {
  ACTOR_COMPONENT_ID,
  APPARENT_AGE_COMPONENT_ID,
  DESCRIPTION_COMPONENT_ID,
  PERSONALITY_COMPONENT_ID,
  PROFILE_COMPONENT_ID,
  LIKES_COMPONENT_ID,
  DISLIKES_COMPONENT_ID,
  STRENGTHS_COMPONENT_ID,
  WEAKNESSES_COMPONENT_ID,
  SECRETS_COMPONENT_ID,
  FEARS_COMPONENT_ID,
  SPEECH_PATTERNS_COMPONENT_ID,
  MOTIVATIONS_COMPONENT_ID,        // NEW
  INTERNAL_TENSIONS_COMPONENT_ID,  // NEW
  CORE_DILEMMAS_COMPONENT_ID,      // NEW
} from '../../constants/componentIds.js';
```

### 2. Update optionalTextAttributes Array

Locate the `optionalTextAttributes` array in the `extractPromptData` method and add the new components:

```javascript
const optionalTextAttributes = [
  { key: 'apparentAge', componentId: APPARENT_AGE_COMPONENT_ID },
  { key: 'description', componentId: DESCRIPTION_COMPONENT_ID },
  { key: 'personality', componentId: PERSONALITY_COMPONENT_ID },
  { key: 'profile', componentId: PROFILE_COMPONENT_ID },
  { key: 'likes', componentId: LIKES_COMPONENT_ID },
  { key: 'dislikes', componentId: DISLIKES_COMPONENT_ID },
  { key: 'strengths', componentId: STRENGTHS_COMPONENT_ID },
  { key: 'weaknesses', componentId: WEAKNESSES_COMPONENT_ID },
  { key: 'secrets', componentId: SECRETS_COMPONENT_ID },
  { key: 'fears', componentId: FEARS_COMPONENT_ID },
  { key: 'motivations', componentId: MOTIVATIONS_COMPONENT_ID },           // NEW
  { key: 'internalTensions', componentId: INTERNAL_TENSIONS_COMPONENT_ID }, // NEW
  { key: 'coreDilemmas', componentId: CORE_DILEMMAS_COMPONENT_ID },        // NEW
];
```

### 3. Verify Extraction Logic

The existing extraction loop should handle the new components automatically:

```javascript
// This existing code should work without modification
optionalTextAttributes.forEach(({ key, componentId }) => {
  const component = this.#getComponent(actorState, componentId);
  if (component?.text) {
    result[key] = component.text;
  } else if (fallbackTexts[key]) {
    result[key] = fallbackTexts[key];
  }
});
```

### 4. Fallback Behavior

The new psychological components should NOT have default fallback text (they're truly optional):

```javascript
// Existing fallback texts - DO NOT add entries for new components
const fallbackTexts = {
  description: 'No description available.',
  personality: 'Personality unknown.',
  profile: 'No background information available.',
  likes: 'Preferences unknown.',
  dislikes: 'Dislikes unknown.',
  strengths: 'No particular strengths noted.',
  weaknesses: 'No known weaknesses.',
  secrets: 'No secrets known.',
  fears: 'No known fears.',
  // DO NOT add motivations, internalTensions, or coreDilemmas here
};
```

### 5. Special Handling Considerations

Ensure speech patterns continues to work correctly (it has special array handling):

```javascript
// This should remain unchanged
const speechPatternsComponent = this.#getComponent(
  actorState,
  SPEECH_PATTERNS_COMPONENT_ID
);
if (speechPatternsComponent?.patterns && Array.isArray(speechPatternsComponent.patterns)) {
  result.speechPatterns = speechPatternsComponent.patterns;
}
```

## Testing Requirements

### Unit Test Scenarios

1. **Component Present**: Test extraction when components exist
2. **Component Absent**: Test that undefined is returned (no fallback)
3. **Mixed Presence**: Test with some new components present, others absent
4. **Empty Text**: Test behavior with empty string values
5. **Invalid Data**: Test with malformed component data

### Test Data Examples

```javascript
// Test entity with all new components
const testActor = {
  id: 'test-actor',
  components: {
    'core:actor': { name: 'Test Character' },
    'core:motivations': { 
      text: 'I seek power because I fear being powerless again.' 
    },
    'core:internal_tensions': { 
      text: 'I want revenge but also want to forgive.' 
    },
    'core:core_dilemmas': { 
      text: 'Can I achieve justice without becoming a monster?' 
    }
  }
};

// Expected extraction result
const expected = {
  id: 'test-actor',
  name: 'Test Character',
  motivations: 'I seek power because I fear being powerless again.',
  internalTensions: 'I want revenge but also want to forgive.',
  coreDilemmas: 'Can I achieve justice without becoming a monster?',
  // ... other properties
};
```

## Validation Checklist

### Code Quality
- [ ] Imports are correctly added
- [ ] Component IDs match constants
- [ ] Property names match type definitions
- [ ] No hardcoded strings for component IDs

### Functionality
- [ ] New components extract correctly when present
- [ ] Missing components return undefined (not fallback text)
- [ ] Existing component extraction still works
- [ ] No null/undefined errors

### Performance
- [ ] No additional loops or complexity
- [ ] Maintains O(n) extraction time
- [ ] No unnecessary component lookups

## Acceptance Criteria

- [ ] Three new component imports added
- [ ] optionalTextAttributes array includes new components
- [ ] Property keys match ActorPromptDataDTO typedef
- [ ] No fallback text for psychological components
- [ ] Extraction works for all three new components
- [ ] Missing components return undefined
- [ ] Existing functionality unchanged
- [ ] All existing tests still pass
- [ ] New test coverage for added components

## Integration Points

### Downstream Dependencies
- **CharacterDataFormatter**: Will receive the extracted data
- **AIPromptContentProvider**: Will include in final prompt
- **LLM Proxy**: Will process enhanced character data

### Upstream Dependencies
- **Entity State**: Must have components loaded
- **Component Registry**: Must recognize new component IDs
- **Schema Validation**: Components must pass validation

## Troubleshooting Guide

### Common Issues

1. **Component not extracted**: Check component ID matches constant
2. **Wrong property name**: Verify key matches typedef
3. **Unexpected fallback**: Ensure no fallback text defined
4. **Type errors**: Check data structure matches schema

### Debug Logging

Add temporary logging to verify extraction:

```javascript
// Temporary debug logging
this.#logger.debug('Extracting psychological components', {
  hasMotivations: !!this.#getComponent(actorState, MOTIVATIONS_COMPONENT_ID),
  hasTensions: !!this.#getComponent(actorState, INTERNAL_TENSIONS_COMPONENT_ID),
  hasDilemmas: !!this.#getComponent(actorState, CORE_DILEMMAS_COMPONENT_ID),
});
```

## Rollback Plan

If issues arise:
1. Remove new entries from optionalTextAttributes array
2. Remove new imports
3. Revert to previous version
4. No data migration needed (components are optional)

## Notes

- Maintains backward compatibility through optional pattern
- No changes to extraction algorithm, only configuration
- Follows established patterns for consistency
- Performance impact negligible (same loop, more items)

---

*Ticket created from character-components-analysis.md report*