# CHACOMENH-003: Update Type Definitions

**Phase**: Component Foundation  
**Priority**: Critical  
**Complexity**: Low  
**Dependencies**: CHACOMENH-001 (component definitions), CHACOMENH-002 (constants)  
**Estimated Time**: 1 hour

## Summary

Update the ActorPromptDataDTO type definition to include the three new psychological component properties (motivations, internalTensions, coreDilemmas) and fix existing missing properties (strengths, weaknesses) that were identified in the analysis.

## Background

The ActorPromptDataDTO type definition in AIGameStateDTO.js defines the structure of character data passed to the LLM prompt generation system. The analysis revealed that some existing properties (strengths, weaknesses) are missing from the typedef, and the new psychological components need to be added.

## Technical Requirements

### Files to Modify

1. **src/turns/dtos/AIGameStateDTO.js**
   - Fix missing existing properties
   - Add new psychological component properties
   - Maintain JSDoc format consistency

## Implementation Details

### Update ActorPromptDataDTO

Location: `src/turns/dtos/AIGameStateDTO.js`

Find the ActorPromptDataDTO typedef and update it:

```javascript
/**
 * @typedef {Object} ActorPromptDataDTO
 * @property {string} id - The entity ID of the actor
 * @property {string} name - The name of the actor
 * @property {string} [apparentAge] - How old the character appears to be
 * @property {string} [description] - Physical appearance and visual characteristics
 * @property {string} [personality] - Character traits and temperament
 * @property {string} [profile] - Background story and history
 * @property {string} [likes] - Things the character enjoys
 * @property {string} [dislikes] - Things the character avoids or dislikes
 * @property {string} [strengths] - Character's capabilities and advantages
 * @property {string} [weaknesses] - Character's limitations and vulnerabilities
 * @property {string} [secrets] - Hidden information about the character
 * @property {string} [fears] - What the character is afraid of
 * @property {Array<string>} [speechPatterns] - Examples of how the character speaks
 * @property {string} [motivations] - Core psychological motivations driving behavior
 * @property {string} [internalTensions] - Internal conflicts and competing desires
 * @property {string} [coreDilemmas] - Fundamental questions the character grapples with
 * @property {Array<Object>} [goals] - Character's objectives with timestamps
 * @property {Array<Object>} [memories] - Character's memory entries
 * @property {Array<Object>} [relationships] - Character's relationships with other entities
 * @property {Object} [notes] - Character's notes and observations
 */
```

### Key Changes Explained

1. **Fixed Missing Properties**:
   - Added `@property {string} [strengths]`
   - Added `@property {string} [weaknesses]`

2. **New Psychological Properties**:
   - Added `@property {string} [motivations]`
   - Added `@property {string} [internalTensions]`
   - Added `@property {string} [coreDilemmas]`

3. **Property Descriptions**:
   - Each property has a clear, concise description
   - Descriptions match the component purposes
   - Optional properties marked with `[]` brackets

### Property Naming Conventions

- Use camelCase for property names (matching JavaScript conventions)
- Component IDs use snake_case, but DTO properties use camelCase
- Mapping:
  - `core:motivations` → `motivations`
  - `core:internal_tensions` → `internalTensions`
  - `core:core_dilemmas` → `coreDilemmas`

## Validation Requirements

### Type Safety

- All new properties are optional (using `[propertyName]` syntax)
- Property types match data structure (string for text components)
- Maintain backward compatibility with existing code

### Documentation Standards

- Each property must have a description
- Use consistent JSDoc format
- Mark optional properties correctly

## Testing Checklist

### Code Validation

- [ ] No syntax errors in JSDoc comments
- [ ] Type definitions follow JSDoc standards
- [ ] All properties properly documented
- [ ] Optional properties marked with brackets

### Integration Testing

- [ ] Type checking tools recognize new properties
- [ ] IDE autocomplete shows new properties
- [ ] No type errors in consuming code
- [ ] Existing code continues to work

## Related Type Updates

Check if these related types need updates:

1. **CharacterData type** (if exists separately)
2. **ActorState type** (if used internally)
3. **PromptData interfaces** (if TypeScript interfaces exist)

## Usage Example

After update, the new properties can be used in data extraction:

```javascript
// In actorDataExtractor.js
const promptData = {
  id: actor.id,
  name: actor.name,
  // ... existing properties ...
  strengths: strengthsComponent?.text || 'No particular strengths noted',
  weaknesses: weaknessesComponent?.text || 'No known weaknesses',
  motivations: motivationsComponent?.text || undefined,
  internalTensions: tensionsComponent?.text || undefined,
  coreDilemmas: dilemmasComponent?.text || undefined,
};
```

## Acceptance Criteria

- [ ] ActorPromptDataDTO typedef is updated with all new properties
- [ ] Missing properties (strengths, weaknesses) are added
- [ ] New psychological properties are included
- [ ] All properties have appropriate type annotations
- [ ] All properties have clear descriptions
- [ ] Optional properties are correctly marked
- [ ] JSDoc format is valid and consistent
- [ ] No breaking changes to existing properties

## Dependencies for Next Steps

This type definition update enables:

- CHACOMENH-004: Data extraction can use typed properties
- CHACOMENH-005: Formatter knows expected data structure
- CHACOMENH-007/008: Tests can validate against types

## Migration Impact

### No Breaking Changes

- All new properties are optional
- Existing code will continue to work
- Type checking becomes more accurate

### Future Code Benefits

- Better IDE autocomplete
- Clearer API contracts
- Easier debugging with proper types
- Documentation through types

## Code Review Focus Areas

1. **Consistency**: Property names match project conventions
2. **Completeness**: All character properties are documented
3. **Accuracy**: Types match actual data structures
4. **Clarity**: Descriptions are clear and helpful
5. **Standards**: JSDoc format is correct

## Notes

- This is primarily a documentation update but critical for type safety
- Ensures all team members understand the data structure
- Provides IDE support for development
- Forms the contract between data extraction and formatting layers

---

_Ticket created from character-components-analysis.md report_
