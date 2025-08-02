# Apparent Age Integration Plan

## Overview

This report outlines the plan for integrating the `apparent_age` component into character description prompts for large language models (LLMs). When assembling prompts that include character descriptions, the system should display apparent age information like "Apparent age: seems to be around X years old" at the beginning of character descriptions.

## Current State Analysis

### Component Structure

- **apparent_age.component.json**: Already defined with fields:
  - `minAge`: Minimum perceived age
  - `maxAge`: Maximum perceived age
  - `bestGuess`: Optional most likely age estimate

- **description.component.json**: Contains text field for character descriptions

- **AgeUtils**: Already provides `formatAgeDescription()` method that formats age data:
  - "around X years old" (when bestGuess provided)
  - "X years old" (when minAge equals maxAge)
  - "between X and Y years old" (when range provided)

### ⚠️ Missing Constant

- **APPARENT_AGE_COMPONENT_ID** is not yet defined in `src/constants/componentIds.js`
- This constant must be added before implementation can proceed

### Current Character Description Flow

#### For AI Actor's Own Description (in Character Persona):

1. `AIGameStateProvider` creates game state DTO
2. `actorDataExtractor.extractPromptData()` extracts character data
3. `AIPromptContentProvider.getCharacterPersonaContent()` formats persona
4. `CharacterDataFormatter.formatPhysicalDescription()` formats description section

#### For Other Characters in Location:

1. `LocationSummaryProvider.build()` gathers characters in location
2. `EntitySummaryProvider.getSummary()` extracts basic name/description
3. `AIPromptContentProvider.getWorldContextContent()` formats world context
4. Character descriptions are formatted as markdown sections

## Integration Points

### 1. Update DTOs

#### EntitySummaryDTO

Add optional apparent age field:

```javascript
/**
 * @typedef {object} EntitySummaryDTO
 * @property {string} id - The entity's unique instance ID
 * @property {string} name - The entity's display name, with a fallback
 * @property {string} description - The entity's description, with a fallback
 * @property {object} [apparentAge] - Optional apparent age data
 * @property {number} [apparentAge.minAge] - Minimum perceived age
 * @property {number} [apparentAge.maxAge] - Maximum perceived age
 * @property {number} [apparentAge.bestGuess] - Most likely age estimate
 */
```

#### ActorPromptDataDTO

Add apparent age field:

```javascript
/**
 * @property {object} [apparentAge] - Optional apparent age data
 * @property {number} [apparentAge.minAge] - Minimum perceived age
 * @property {number} [apparentAge.maxAge] - Maximum perceived age
 * @property {number} [apparentAge.bestGuess] - Most likely age estimate
 */
```

#### AICharacterInLocationDTO

Add apparent age field:

```javascript
/**
 * @property {object} [apparentAge] - Optional apparent age data
 * @property {number} [apparentAge.minAge] - Minimum perceived age
 * @property {number} [apparentAge.maxAge] - Maximum perceived age
 * @property {number} [apparentAge.bestGuess] - Most likely age estimate
 */
```

### 2. Update Data Providers

#### EntitySummaryProvider

Modify `getSummary()` to include apparent age using the existing pattern:

```javascript
getSummary(entity) {
  // ... existing code ...

  // Extract apparent age if present
  const apparentAgeData = entity.getComponentData(APPARENT_AGE_COMPONENT_ID);

  return {
    id: entity.id,
    name,
    description,
    ...(apparentAgeData && { apparentAge: apparentAgeData })
  };
}
```

Note: The actual implementation has a private `_getComponentText` helper method that could be extended if needed for consistent component extraction patterns.

#### ActorDataExtractor

Add apparent age extraction in `extractPromptData()`:

```javascript
// After existing component extractions
const apparentAgeData = actorState[APPARENT_AGE_COMPONENT_ID];
if (apparentAgeData && apparentAgeData.minAge && apparentAgeData.maxAge) {
  promptData.apparentAge = apparentAgeData;
}
```

### 3. Update Prompt Formatting

#### CharacterDataFormatter

Modify `formatPhysicalDescription()` to include apparent age:

```javascript
formatPhysicalDescription(characterData) {
  // ... existing code ...

  let result = '## Your Description\n';

  // Add apparent age first if available
  if (characterData.apparentAge) {
    const ageDescription = AgeUtils.formatAgeDescription(characterData.apparentAge);
    result += `**Apparent age**: ${ageDescription}\n\n`;
  }

  // ... rest of description formatting ...
}
```

#### AIPromptContentProvider

Update `getWorldContextContent()` to include apparent age for other characters:

```javascript
// In the characters section formatting (around line 600)
segments.push(`### ${namePart}`);

// Add apparent age if available
if (char.apparentAge) {
  const ageDescription = AgeUtils.formatAgeDescription(char.apparentAge);
  segments.push(`- **Apparent age**: ${ageDescription}`);
}

// Then add description attributes
if (descriptionText.includes(':') && descriptionText.includes(',')) {
  // ... existing structured description parsing ...
```

### 4. Required Imports

Add to files that will use apparent age:

- Import `APPARENT_AGE_COMPONENT_ID` from `'../../constants/componentIds.js'` (adjust relative path as needed)
- Import `{ AgeUtils }` from `'../../utils/ageUtils.js'` (adjust relative path as needed)

## Implementation Steps

1. **Add Constants** (MUST BE DONE FIRST):
   - Add `export const APPARENT_AGE_COMPONENT_ID = 'core:apparent_age';` to src/constants/componentIds.js

2. **Update DTOs** (3 files):
   - src/interfaces/IEntitySummaryProvider.js (EntitySummaryDTO)
   - src/turns/dtos/AIGameStateDTO.js (ActorPromptDataDTO, AICharacterInLocationDTO)

3. **Update Data Providers** (2 files):
   - src/data/providers/entitySummaryProvider.js
   - src/turns/services/actorDataExtractor.js

4. **Update Prompt Formatters** (2 files):
   - src/prompting/CharacterDataFormatter.js
   - src/prompting/AIPromptContentProvider.js

5. **Testing**:
   - Create unit tests for updated methods
   - Create integration tests for full prompt generation with apparent age
   - Test with entities that have and don't have apparent_age component

## Example Output

### For AI Actor's Description:

```
## Your Description
**Apparent age**: around 25 years old

**Build**: Athletic, lean muscle...
**Skin**: Sun-kissed bronze...
```

### For Other Characters in Location:

```
### Elena Rodriguez
- **Apparent age**: between 30 and 35 years old
- **Description**: A woman with sharp features and intense dark eyes...
```

## Benefits

1. **Consistency**: Uses existing AgeUtils formatting
2. **Non-breaking**: Optional fields won't affect existing functionality
3. **Flexibility**: Works with both AI actor and other characters
4. **Clear Context**: Provides age context early in descriptions for better LLM understanding

## Considerations

1. **Backwards Compatibility**: All apparent age fields are optional
2. **Performance**: Minimal impact - just one additional component lookup
3. **Validation**: AgeUtils already provides validation methods
4. **Localization**: Future consideration for age description formatting in different languages

## Testing Plan

1. **Unit Tests**:
   - Test EntitySummaryProvider with/without apparent_age
   - Test ActorDataExtractor apparent age extraction
   - Test CharacterDataFormatter with apparent age
   - Test AIPromptContentProvider world context formatting

2. **Integration Tests**:
   - Full prompt generation with apparent age
   - Multiple characters with different age formats
   - Edge cases (missing data, invalid ranges)

3. **E2E Tests**:
   - Verify prompts include apparent age in correct position
   - Test LLM responses acknowledge age information

## Conclusion

This integration plan provides a clean, non-breaking way to add apparent age information to character descriptions in LLM prompts. The implementation leverages existing utilities and follows established patterns in the codebase, ensuring consistency and maintainability.

## Code Review Notes (Added after analysis)

After reviewing the actual production code, the following corrections were made to this plan:

1. **Missing Constant**: The `APPARENT_AGE_COMPONENT_ID` constant is not currently defined in componentIds.js and must be added before implementation.

2. **EntitySummaryProvider Pattern**: Updated the code example to use the spread operator pattern `...(apparentAgeData && { apparentAge: apparentAgeData })` which is more consistent with modern JavaScript practices.

3. **Import Paths**: Clarified that import paths need to be adjusted based on the file location (using relative paths with `../` as needed).

4. **Implementation Order**: Reordered steps to add the constant definition first, as it's a prerequisite for all other changes.

All other aspects of the plan remain accurate and align with the existing codebase patterns.
