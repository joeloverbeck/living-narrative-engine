# CHACOMENH-002: Update Component Constants

**Phase**: Component Foundation  
**Priority**: Critical  
**Complexity**: Low  
**Dependencies**: CHACOMENH-001 (component JSON definitions)  
**Estimated Time**: 1 hour

## Summary

Add new component ID constants for the three psychological character components (motivations, internal tensions, core dilemmas) to the centralized constants file and register them in the essential schemas configuration if required.

## Background

The Living Narrative Engine uses centralized constant definitions for component IDs to ensure consistency across the codebase. All component references should use these constants rather than hardcoded strings. This ticket adds the constants needed for the new psychological components.

## Technical Requirements

### Files to Modify

1. **src/constants/componentIds.js**
   - Add three new component ID constants
   - Follow existing naming patterns
   - Group with other character-related constants

2. **src/constants/essentialSchemas.js** (if validation required)
   - Register new component schemas
   - Ensure they're loaded during initialization

## Implementation Details

### 1. Update componentIds.js

Location: `src/constants/componentIds.js`

Add the following constants in the appropriate section (likely near other character components like PERSONALITY_COMPONENT_ID):

```javascript
// Psychological character aspects
export const MOTIVATIONS_COMPONENT_ID = 'core:motivations';
export const INTERNAL_TENSIONS_COMPONENT_ID = 'core:internal_tensions';
export const CORE_DILEMMAS_COMPONENT_ID = 'core:core_dilemmas';
```

#### Placement Guidelines
- Look for existing character component constants (e.g., PERSONALITY_COMPONENT_ID, PROFILE_COMPONENT_ID)
- Add new constants in the same section
- Maintain alphabetical or logical grouping
- Add a comment header if creating a new section

#### Full Context Example
```javascript
// Existing character components
export const APPARENT_AGE_COMPONENT_ID = 'core:apparent_age';
export const DESCRIPTION_COMPONENT_ID = 'core:description';
export const PERSONALITY_COMPONENT_ID = 'core:personality';
export const PROFILE_COMPONENT_ID = 'core:profile';
export const LIKES_COMPONENT_ID = 'core:likes';
export const DISLIKES_COMPONENT_ID = 'core:dislikes';
export const STRENGTHS_COMPONENT_ID = 'core:strengths';
export const WEAKNESSES_COMPONENT_ID = 'core:weaknesses';
export const SECRETS_COMPONENT_ID = 'core:secrets';
export const FEARS_COMPONENT_ID = 'core:fears';
export const SPEECH_PATTERNS_COMPONENT_ID = 'core:speech_patterns';

// Psychological character aspects (NEW)
export const MOTIVATIONS_COMPONENT_ID = 'core:motivations';
export const INTERNAL_TENSIONS_COMPONENT_ID = 'core:internal_tensions';
export const CORE_DILEMMAS_COMPONENT_ID = 'core:core_dilemmas';
```

### 2. Update essentialSchemas.js (Conditional)

Location: `src/constants/essentialSchemas.js`

**First check if this file exists and if component schemas are registered here.**

If component schemas need registration, add:

```javascript
// In the appropriate section or array of essential schemas
'core:motivations',
'core:internal_tensions',
'core:core_dilemmas',
```

## Validation Requirements

### Code Standards
- Constants must match the component IDs defined in JSON files
- Use UPPER_SNAKE_CASE for constant names
- Use exact string values from component definitions
- Maintain consistent formatting with existing code

### Import Verification
After adding constants, verify they can be imported correctly:

```javascript
// Example test import
import {
  MOTIVATIONS_COMPONENT_ID,
  INTERNAL_TENSIONS_COMPONENT_ID,
  CORE_DILEMMAS_COMPONENT_ID,
} from './constants/componentIds.js';

console.log(MOTIVATIONS_COMPONENT_ID); // Should output: 'core:motivations'
```

## Testing Checklist

### Manual Testing
- [ ] Constants are exported correctly
- [ ] No syntax errors in modified files
- [ ] Constants match component JSON IDs exactly
- [ ] Existing constants remain unchanged
- [ ] File maintains consistent formatting

### Automated Testing
- [ ] ESLint passes on modified files
- [ ] Existing unit tests still pass
- [ ] Constants can be imported in other modules
- [ ] No circular dependency issues

## Code Review Guidelines

### What to Check
1. **Naming Consistency**: Constants follow UPPER_SNAKE_CASE pattern
2. **Value Accuracy**: String values match component JSON definitions exactly
3. **Placement**: Constants are logically grouped with related constants
4. **Comments**: Section has appropriate documentation
5. **No Breaking Changes**: Existing constants unchanged

### Common Issues to Avoid
- Typos in component ID strings
- Inconsistent naming patterns
- Missing exports
- Placing constants in wrong section
- Forgetting to update related configuration files

## Acceptance Criteria

- [ ] Three new constants added to componentIds.js
- [ ] Constants use proper UPPER_SNAKE_CASE naming
- [ ] Values match component JSON IDs exactly ('core:motivations', etc.)
- [ ] Constants are properly exported
- [ ] Code follows existing patterns and style
- [ ] ESLint validation passes
- [ ] No regression in existing functionality
- [ ] Essential schemas updated if required

## Dependencies for Next Steps

This ticket enables:
- CHACOMENH-004: Data extraction logic can import these constants
- CHACOMENH-005: Character formatter can reference constants
- CHACOMENH-007: Unit tests can use constants

## Migration Notes

No migration required as these are new additions. However, future code should use these constants rather than hardcoded strings:

```javascript
// Good - use constant
import { MOTIVATIONS_COMPONENT_ID } from '../../constants/componentIds.js';
const motivations = getComponent(entity, MOTIVATIONS_COMPONENT_ID);

// Bad - hardcoded string
const motivations = getComponent(entity, 'core:motivations');
```

## Rollback Plan

If issues arise:
1. Remove the three new constant definitions
2. Remove any essentialSchemas.js additions
3. No other changes needed as these are new additions

---

*Ticket created from character-components-analysis.md report*