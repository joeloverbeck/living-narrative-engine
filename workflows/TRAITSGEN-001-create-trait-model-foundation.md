# TRAITSGEN-001: Create Trait Model Foundation

## Ticket Overview
- **Epic**: Traits Generator Implementation
- **Type**: Foundation/Model Layer
- **Priority**: High
- **Estimated Effort**: 1.5 days
- **Dependencies**: None

## Description
Create the foundational trait model class that defines the data structure and validation for character traits. This model serves as the core data representation for all trait-related operations.

## Requirements

### File Creation
- **File**: `src/characterBuilder/models/trait.js`
- **Template**: Follow `src/characterBuilder/models/coreMotivation.js` pattern
- **Architecture**: Extend established model patterns with trait-specific properties

### Core Properties
Based on specification requirements, implement these trait properties:

```javascript
class Trait {
  // Core identification
  this.id = data.id || uuidv4();
  
  // Trait content (all categories from spec)
  this.names = data.names;           // Array of name objects with justifications
  this.physicalDescription = data.physicalDescription;
  this.personality = data.personality;
  this.strengths = data.strengths;
  this.weaknesses = data.weaknesses;
  this.likes = data.likes;
  this.dislikes = data.dislikes;
  this.fears = data.fears;
  this.goals = data.goals;
  this.notes = data.notes;
  this.profile = data.profile;
  this.secrets = data.secrets;
  
  // Metadata
  this.generatedAt = data.generatedAt || new Date().toISOString();
  this.metadata = data.metadata || {};
}
```

### Required Methods
Implement these methods following established patterns:

1. **`static fromLLMResponse(rawTraits, metadata)`**
   - Transform LLM response into Trait instance
   - Handle response parsing and validation
   - Apply metadata tracking
   - No persistent ID generation (per storage policy)

2. **`validate()`**
   - Validate all trait categories are present and properly structured
   - Check content quality and completeness
   - Validate against minimum/maximum length requirements
   - Return validation result with detailed error messages

3. **`toJSON()`**
   - Serialize trait for API responses
   - Include all trait categories and metadata
   - Ensure clean JSON structure

4. **`toExportText()`**
   - Format trait for text file export
   - Create human-readable format
   - Include all trait categories with clear sections
   - Follow export formatting requirements from specification

### Validation Requirements
Implement comprehensive validation for all trait categories:

- **Names**: 3-5 items with name and justification properties
- **Physical Description**: String 100-500 characters
- **Personality**: 3-5 items with trait and explanation properties  
- **Strengths/Weaknesses**: 2-4 items each, array of strings
- **Likes/Dislikes**: 3-5 items each, array of strings
- **Fears**: 1-2 items, array of strings
- **Goals**: Object with shortTerm (1-2 items) and longTerm (string)
- **Notes**: 2-3 items, array of strings
- **Profile**: String 200-800 characters
- **Secrets**: 1-2 items, array of strings

## Technical Implementation

### Dependencies
```javascript
import { v4 as uuidv4 } from 'uuid';
import { 
  assertPresent, 
  assertNonBlankString, 
  assertValidArray 
} from '../utils/validationUtils.js';
```

### Code Quality Requirements
- Follow camelCase file naming: `trait.js`
- Use PascalCase for class: `Trait`
- Implement comprehensive JSDoc documentation
- Include @typedef imports for type safety
- Use # prefix for private methods
- Apply proper error handling with descriptive messages

### Storage Policy Compliance
**IMPORTANT**: Per specification requirements:
- Generated traits MUST NOT be stored permanently
- Generated traits MUST NOT be associated with concepts/thematic directions  
- Traits exist only during current session for user review
- Model should NOT include persistent storage methods

## Acceptance Criteria

### Functional Requirements
- [ ] Trait class properly instantiated with all required properties
- [ ] `fromLLMResponse()` correctly transforms LLM data into trait instances
- [ ] `validate()` returns comprehensive validation results for all categories
- [ ] `toJSON()` produces clean, serializable output
- [ ] `toExportText()` creates human-readable export format
- [ ] All trait categories validated according to specification requirements

### Code Quality Requirements
- [ ] Follows established model patterns from coreMotivation.js
- [ ] Comprehensive JSDoc documentation with type definitions
- [ ] Proper error handling with descriptive messages
- [ ] No persistent storage methods (compliance with storage policy)
- [ ] Clean, readable code following project conventions

### Testing Requirements
- [ ] Create `tests/unit/characterBuilder/models/trait.test.js`
- [ ] Test all constructor scenarios (valid/invalid data)
- [ ] Test `fromLLMResponse()` with various LLM response formats
- [ ] Test validation with valid/invalid trait data for all categories
- [ ] Test export functionality with different trait configurations
- [ ] Achieve 90%+ test coverage for model layer

## Files Modified
- **NEW**: `src/characterBuilder/models/trait.js`
- **NEW**: `tests/unit/characterBuilder/models/trait.test.js`

## Dependencies For Next Tickets
This foundation model is required for:
- TRAITSGEN-002 (Prompt Implementation)
- TRAITSGEN-003 (Service Layer)
- All subsequent UI and integration tickets

## Notes
- Reference existing `coreMotivation.js` for established patterns
- Pay special attention to storage policy compliance
- Ensure validation covers all 12 trait categories from specification
- Export functionality crucial for user data management workflow