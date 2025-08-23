# Traits Generator Specification

## Overview

This specification defines the requirements and implementation guidelines for creating a new traits generation page in the character-builder series. The traits generator will create detailed character traits based on core motivations, thematic directions, and clichés to avoid.

## Feature Requirements

### Page Integration

- Add new button in `index.html` immediately after the core-motivations-generator.html button
- Create dedicated page `traits-generator.html` following existing character-builder patterns
- Maintain consistent navigation and styling with other generator pages

### Core Functionality

#### Thematic Direction Selection

- Selector that filters thematic directions based on:
  1. Must have associated clichés generated
  2. Must have associated core motivations generated
- Use filtering logic similar to `core-motivations-generator.html` with additional core motivations filter
- Reference existing core motivations association structure from core-motivations-generator codebase

#### User Interface Layout

##### Left Panel - Selection Interface

- **Thematic Direction Selector**: Dropdown with filtered thematic directions
- **User Input Fields** (all required):
  - Core Motivation (text input)
  - Internal Contradiction (text input)
  - Central Question (text input)
- **Generate Button**: Triggers traits generation after validation

##### Right Panel - Context Display

- **Core Motivations Panel**:
  - Scrollable list of associated core motivations for selected thematic direction
  - Read-only display (no generation capability)
  - Reference existing core motivations display patterns
- **User Input Panel**:
  - Below core motivations panel
  - Display user-entered core motivation, internal contradiction, and central question

### Traits Generation Requirements

#### LLM Integration

The traits generator must create comprehensive character traits using the following prompt structure:

**Required Prompt Elements:**

- Based on this core concept: [CONCEPT THAT ORIGINATED THE CHOSEN THEMATIC DIRECTION]
- Based on this thematic direction: [CHOSEN THEMATIC DIRECTION, INCLUDING ALL OF ITS ELEMENTS]
- Based on this Core Motivation: [USER WRITTEN-IN CORE MOTIVATION]
- Based on this Internal Contradiction: [USER WRITTEN-IN INTERNAL CONTRADICTION]
- Based on this Central Question: [USER WRITTEN-IN CENTRAL QUESTION]
- Having in mind the following list of clichés: [LIST OF CLICHÉS SIMILAR TO cliches-generator.html EXPORT FORMAT]

#### Content Policy Requirements

The `<content_policy>` section of the prompt MUST use the exact same text as other generators:

```xml
<content_policy>
CONTENT GUIDELINES:
RATING: NC-21 (ADULTS ONLY)
NO RESTRICTIONS: This is a mature application. All topics, themes, and content are permissible if they serve the character development analysis and cliché identification, however dark, explicit, or controversial.
This includes, but is not limited to:
-   Explicit language and profanity.
-   Graphic violence and gore (physical and psychological).
-   Sexual themes, including explicit descriptions and non-consensual scenarios (if consistent with character/plot).
-   Substance use and abuse.
-   Challenging moral and ethical dilemmas.
-   Prejudice, discrimination, and other 'isms' if they are part of the character or world.
Your primary directive is authentic character analysis and cliché identification within this mature context. Do not self-censor or inject conventional AI safety moralizing when identifying problematic tropes.
</content_policy>
```

#### Generated Traits Categories

The LLM must generate traits in the following categories with specific requirements:

1. **Name**: 3-5 unique names with 1-sentence justifications showing cliché subversion
2. **Physical Description**: 2-3 distinctive features that subvert typical appearances and hint at persona
3. **Personality**: 3-5 key personality traits forming coherent, nuanced personality with explanations
4. **Strengths**: Unexpected or uniquely applied strengths that subvert clichés and relate to core
5. **Weaknesses**: Unexpected or uniquely applied weaknesses that subvert clichés and relate to core
6. **Likes**: 3-5 specific, telling likes connecting to deeper motivations and avoiding generic preferences
7. **Dislikes**: 3-5 specific dislikes revealing sensitivities/principles and avoiding clichéd dislikes
8. **Fears**: 1-2 profound, specific fears deeply rooted in character cores (beyond generic fears)
9. **Goals**: 1-2 short-term goals and 1 major long-term goal driven by core motivations
10. **Notes**: 2-3 pieces of unique knowledge/lore acquired in non-clichéd ways
11. **Profile**: 3-5 sentence background summary explaining current situation and core origin
12. **Secrets**: 1-2 significant secrets tied to core motivations/contradictions with relationship impact potential

### Data Management Requirements

#### Storage Policy

- Generated traits **MUST NOT** be stored permanently
- Generated traits **MUST NOT** be associated with concepts/thematic directions
- Traits exist only during current session for user review

#### Export Functionality

- Provide export option to text file format
- User maintains full control over trait selection and usage
- User responsible for creating JSON files for game integration and future character builder use

## Technical Implementation Guidelines

### Architecture Requirements

#### File Structure

Follow established character-builder patterns:

```
traits-generator.html                                         # Main page
src/traitsGenerator/controllers/TraitsGeneratorController.js # UI controller
src/characterBuilder/services/TraitsGenerator.js             # Service layer (renamed from TraitGenerator)
src/characterBuilder/models/trait.js                         # Data model
src/characterBuilder/prompts/traitsGenerationPrompt.js      # LLM prompts
src/traitsGenerator/services/TraitsDisplayEnhancer.js       # Display enhancement service
```

#### Code Reuse Strategy

Maximize reuse of existing character-builder components:

1. **BaseCharacterBuilderController** (100% reuse)
   - Extend for TraitsGeneratorController
   - Inherit all infrastructure and utilities

2. **Concept Selection UI** (95% reuse)
   - Reuse thematic direction selector patterns
   - Adapt filtering logic for core motivations requirement

3. **Service Architecture** (90% reuse)
   - Follow CoreMotivationsGenerator.js patterns
   - Maintain consistent validation and error handling

4. **Model Patterns** (85% reuse)
   - Follow coreMotivation.js structure
   - Adapt for trait-specific properties

5. **Prompt Structure** (80% reuse)
   - Use established XML prompt format
   - Maintain role/task/instructions/constraints pattern

### Service Layer Implementation

#### TraitsGenerator Service

**File**: `src/characterBuilder/services/TraitsGenerator.js`

**Dependencies**:

- `logger` - ILogger instance for logging
- `llmJsonService` - LlmJsonService for JSON processing
- `llmStrategyFactory` - ConfigurableLLMAdapter for LLM integration (renamed from llmAdapter)
- `llmConfigManager` - ILLMConfigurationManager for configuration management
- `eventBus` - ISafeEventDispatcher for event dispatching (renamed from eventDispatcher)
- `database` - CharacterDatabase for data persistence (optional)
- `schemaValidator` - ISchemaValidator for response validation (optional)

**Key Methods**:

```javascript
async generateTraits(concept, direction, userInputs, cliches, options = {})
// 1. Validate inputs (concept object, direction object, userInputs, cliches)
// 2. Build generation prompt with all required elements from feature requirements
// 3. Call LLM using #callLLM() with tool schema for structured response
// 4. Parse and clean response using llmJsonService
// 5. Validate response structure against TRAITS_RESPONSE_SCHEMA
// 6. Return traits data (not stored - as per storage policy requirements)
// 7. Dispatch generation events (started, completed, failed)

async #callLLM(prompt, llmConfigId)
// Internal method for LLM communication with tool schema

async #parseResponse(rawResponse)
// Parse and repair JSON response

#validateResponseStructure(response)
// Validate against schema

getResponseSchema()
// Return schema for external validation
```

### Model Layer Implementation

#### Trait Model

**File**: `src/characterBuilder/models/trait.js`

**Note**: Based on storage policy ("Generated traits MUST NOT be stored permanently"), this model is primarily for session data structure and export formatting.

**Properties**:

```javascript
class Trait {
  constructor(data) {
    this.id = data.id || uuidv4();
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
    this.generatedAt = data.generatedAt || new Date().toISOString(); // Renamed from createdAt
    this.metadata = data.metadata || {};
  }

  static fromLLMResponse(rawTraits, metadata)  // Simplified - no persistent IDs
  validate()
  toJSON()
  toExportText()  // Method for text export functionality
}
```

### Prompt Implementation

#### Prompt Structure

**File**: `src/characterBuilder/prompts/traitsGenerationPrompt.js`

**Required Exports** (following existing prompt patterns):

```javascript
/**
 * Prompt version information and management
 */
export const PROMPT_VERSION_INFO = {
  version: '1.0.0',
  previousVersions: {},
  currentChanges: ['Initial implementation for traits generation'],
};

/**
 * Default parameters for traits generation LLM requests
 */
export const TRAITS_LLM_PARAMS = {
  temperature: 0.8,
  max_tokens: 4000,
};

/**
 * LLM response schema for traits generation validation
 */
export const TRAITS_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,  // Following existing schema patterns
  properties: {
    names: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          justification: { type: 'string' }
        },
        required: ['name', 'justification']
      },
      minItems: 3,
      maxItems: 5
    },
    physicalDescription: { type: 'string', minLength: 100, maxLength: 500 },
    personality: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          trait: { type: 'string' },
          explanation: { type: 'string' }
        },
        required: ['trait', 'explanation']
      },
      minItems: 3,
      maxItems: 5
    },
    strengths: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 4 },
    weaknesses: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 4 },
    likes: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 5 },
    dislikes: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 5 },
    fears: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 2 },
    goals: {
      type: 'object',
      properties: {
        shortTerm: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 2 },
        longTerm: { type: 'string' }
      },
      required: ['shortTerm', 'longTerm']
    },
    notes: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 3 },
    profile: { type: 'string', minLength: 200, maxLength: 800 },
    secrets: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 2 }
  },
  required: ['names', 'physicalDescription', 'personality', 'strengths', 'weaknesses', 'likes', 'dislikes', 'fears', 'goals', 'notes', 'profile', 'secrets']
};

// Core function exports following existing patterns
export function buildTraitsGenerationPrompt(concept, direction, userInputs, cliches)
export function validateTraitsGenerationResponse(response)
export function formatClichesForPrompt(cliches)  // Helper function for cliche formatting
```

### Controller Implementation

#### TraitsGeneratorController

**File**: `src/traitsGenerator/controllers/TraitsGeneratorController.js`

**Key Features**:

- Extend BaseCharacterBuilderController (following existing pattern exactly)
- Direction selection with dual filtering (clichés + core motivations)
- User input validation for required fields (coreMotivation, internalContradiction, centralQuestion)
- Generate button with loading states and accessibility support
- Results display with trait categories (names, physical, personality, etc.)
- Export functionality for text file (download + clipboard)
- Error handling with proper event dispatching
- Accessibility features (ARIA live regions, keyboard shortcuts, focus management)

**Key Methods** (following existing controller patterns):

```javascript
class TraitsGeneratorController extends BaseCharacterBuilderController {
  constructor(dependencies)  // Validate dependencies like existing controllers

  async initialize()  // Setup UI, load eligible directions

  async #loadEligibleDirections()  // Load directions with both clichés and core motivations
  #populateDirectionSelector()   // Create optgroups by concept
  #organizeDirectionsByConcept() // Helper for UI organization

  async #selectDirection(directionId)  // Handle direction selection
  #clearDirection()  // Clear selection state

  #validateUserInputs()  // Validate required text fields
  async #generateTraits()  // Main generation workflow
  #displayResults(traits)  // Show generated traits in UI

  #exportToText()  // Export with filename generation
  #generateExportFilename()  // Following existing pattern

  #setupEventListeners()  // UI event binding
  #setupKeyboardShortcuts() // Ctrl+Enter, Ctrl+E, Ctrl+Shift+Del
  #updateUIState()  // Enable/disable buttons
  #showLoadingState(show, message)  // Loading indicator management

  // Accessibility methods following existing patterns
  #setupFocusManagement()
  #setupScreenReaderIntegration()
  #announceToScreenReader(message)
}
```

### HTML Page Implementation

#### Page Structure

**File**: `traits-generator.html`

**Template Base**: Use `thematic-direction-generator.html` structure

**Required Sections**:

- Header with navigation breadcrumbs
- Left panel: concept selection and user input forms
- Right panel: core motivations display and user input summary
- Results container for generated traits display
- Loading/error state containers
- Footer with keyboard shortcuts and export options

### Integration Requirements

#### CharacterBuilderService Integration

**File**: `src/characterBuilder/services/characterBuilderService.js`

Add methods:

```javascript
async generateTraitsForDirection(concept, direction, userInputs, cliches, options = {})
// Coordinate with TraitsGenerator service
// Validate inputs match the service's expected signature
// Return generated traits without persistence (per storage policy)
// Dispatch appropriate events (generation_started, completed, failed)

async getDirectionsWithClichesAndMotivations()
// Filter thematic directions that have both clichés AND core motivations
// Support the enhanced filtering requirements from feature specification
// Return array of {direction, concept} objects with full data

async hasCoreMot­ivationsForDirection(directionId)
// Check if direction has core motivations (extends existing hasClichesForDirection pattern)
// Required for the dual filter (clichés + core motivations)
```

#### Build Configuration

Add traits-generator build target to `package.json` following existing patterns:

```json
"build:traits-generator": "node scripts/build.js --entry=src/traits-generator-main.js --outfile=dist/traits-generator.js"
```

**Entry Point File**: `src/traits-generator-main.js` (following existing pattern like `core-motivations-generator-main.js`)

### Validation Requirements

#### Input Validation

- All user input fields (core motivation, internal contradiction, central question) must be non-empty strings
- Selected thematic direction must have both clichés AND core motivations (dual filtering requirement)
- Character concept object must be valid and accessible
- Clichés must be present and properly formatted for context
- User inputs must pass assertNonBlankString validation (following existing patterns)

#### Response Validation

- LLM response must conform to TRAITS_RESPONSE_SCHEMA (with additionalProperties: false)
- All required trait categories must be present and properly structured
- Content must meet minimum/maximum length requirements specified in schema
- Names and personality traits must include structured justifications/explanations
- Response validation follows existing validateTraitsGenerationResponse pattern

#### Error Handling

- Graceful handling of LLM service failures using TraitsGenerationError
- User-friendly error messages for validation failures
- Circuit breaker pattern for repeated failures (following characterBuilderService pattern)
- Event dispatching for error states (traits_generation_failed events)
- Proper error propagation without exposing internal details

### Testing Requirements

#### Required Test Coverage

Following established patterns, create comprehensive tests:

**Unit Tests**:

- `tests/unit/characterBuilder/models/trait.test.js`
- `tests/unit/characterBuilder/services/TraitsGenerator.test.js` (renamed from TraitGenerator)
- `tests/unit/characterBuilder/prompts/traitsGenerationPrompt.test.js`
- `tests/unit/traitsGenerator/controllers/TraitsGeneratorController.test.js`
- `tests/unit/traitsGenerator/services/TraitsDisplayEnhancer.test.js` (new service)

**Integration Tests**:

- `tests/integration/traitsGenerator/traitsGeneratorIntegration.test.js`

**Test Requirements Pattern** (following existing test structure):

- Use TestBedClass pattern from `/tests/common/testbed.js`
- Mock LLM services appropriately using existing mock patterns
- Test both success and failure scenarios for all major methods
- Validate event dispatching using existing event testing patterns

**Test Requirements**:

- 80%+ code coverage following project standards
- Test all error conditions and edge cases including LLM failures
- Mock LLM service interactions appropriately using existing patterns
- Validate UI state management thoroughly including loading states
- Test prompt generation and response processing with schema validation
- Verify dual filtering logic (clichés + core motivations) works correctly
- Test export functionality and text formatting
- Validate accessibility features and keyboard shortcuts

### Quality Assurance Standards

#### Code Quality

- Follow camelCase file naming conventions (traitsGeneratorController.js, not TraitsGeneratorController.js)
- Use PascalCase for class names (TraitsGenerator, TraitsGeneratorController)
- Implement comprehensive JSDoc documentation with @typedef imports
- Apply dependency injection patterns consistently using validateDependency()
- Include proper error handling with TraitsGenerationError custom error type
- Implement metadata tracking for LLM operations following existing llmMetadata patterns
- Use # prefix for private methods and fields following existing patterns
- Follow existing event naming conventions (traits_generation_started, traits_generation_completed, traits_generation_failed)

#### Architectural Consistency

- Extend BaseCharacterBuilderController properly
- Follow established service patterns with validation
- Use consistent model structure with immutability
- Apply standard prompt structure and validation
- Integrate with existing event system appropriately

#### User Experience

- Maintain consistent UI patterns with other generators
- Implement proper loading and error states
- Follow established keyboard shortcut patterns (Ctrl+Enter for generate, Ctrl+E for export)
- Ensure responsive design consistency
- Apply consistent styling and theming

### Performance Considerations

#### Token Optimization

- Estimate prompt token usage and optimize where possible
- Implement token estimation for generation requests
- Consider prompt caching strategies for repeated elements
- Monitor LLM response times and implement appropriate timeouts

#### UI Responsiveness

- Implement proper loading states during generation
- Use non-blocking UI patterns for long-running operations
- Provide progress feedback where appropriate
- Implement proper cleanup on component destruction

## Implementation Phases

### Phase 1: Foundation (Days 1-2)

- Create trait model with comprehensive validation
- Set up basic service structure following established patterns
- Implement prompt template with required content policy

### Phase 2: Core Logic (Days 3-4)

- Complete service implementation with LLM integration
- Add comprehensive error handling and response validation
- Implement user input validation and processing

### Phase 3: UI Implementation (Days 5-6)

- Create HTML page structure following template patterns
- Implement controller with concept selection and filtering
- Add results display functionality with export capability

### Phase 4: Integration (Day 7)

- Integrate with CharacterBuilderService
- Add build configuration following existing patterns
- Implement event dispatching and analytics integration

### Phase 5: Testing & Polish (Days 8-9)

- Create comprehensive test suite following project standards
- Fix identified bugs and edge cases
- Polish UI and ensure consistent user experience

### Phase 6: Documentation (Day 10)

- Update project documentation as needed
- Add inline code documentation where appropriate
- Create usage notes for future development reference

## Success Criteria

- [ ] Page integrates seamlessly with existing character-builder series
- [ ] Filtering works correctly for thematic directions with clichés and core motivations
- [ ] User input validation prevents invalid generation attempts
- [ ] LLM integration produces properly formatted trait responses
- [ ] Generated traits demonstrate clear cliché subversion and thematic consistency
- [ ] Export functionality works reliably for user data management
- [ ] All tests pass with 80%+ coverage following project standards
- [ ] Code follows all established architectural and quality patterns
- [ ] User experience matches existing generator pages for consistency

## Constraints

- **No Persistent Storage**: Generated traits must not be stored in application (per feature requirements)
- **No Auto-Association**: Traits must not be automatically linked to concepts/directions (per feature requirements)
- **User Control**: All data management decisions remain with the user including JSON file creation
- **Architectural Consistency**: Must follow all established character-builder patterns exactly
- **Content Policy Compliance**: Must use exact content policy text from other generators
- **Dual Filtering Requirement**: Must filter directions with both clichés AND core motivations (enhanced from original requirements)
- **Event System Integration**: Must use existing event patterns and naming conventions
- **Error Handling Consistency**: Must follow existing error patterns (CircuitBreaker, custom errors, event dispatching)
