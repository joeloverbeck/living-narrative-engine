# Character Builder Step 1 Implementation Specification

## Overview

This specification defines the implementation of Step 1: Thematic Directions for the Living Narrative Engine's character building system. The system will integrate with existing LLM infrastructure to provide AI-assisted character concept development, following the modding-first philosophy and ECS architecture patterns established in the project.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Data Models & Storage](#data-models--storage)
3. [LLM Integration](#llm-integration)
4. [Service Layer](#service-layer)
5. [UI Architecture](#ui-architecture)
6. [File Structure](#file-structure)
7. [Implementation Guidelines](#implementation-guidelines)
8. [Integration Points](#integration-points)
9. [Testing Strategy](#testing-strategy)

## Architecture Overview

The character builder follows the established patterns of the Living Narrative Engine:

```
Character Builder UI → Service Layer → Storage Layer
         ↓                ↓              ↓
    UI Controllers → CharacterBuilderService → IndexedDB
         ↓                ↓
    LLM Integration → ConfigurableLLMAdapter → LLM Proxy Server
```

### Core Components

- **UI Layer**: Character builder HTML page with input forms and thematic direction displays
- **Service Layer**: Character building orchestration and business logic
- **Storage Layer**: IndexedDB-based persistence for character data
- **LLM Integration**: Specialized adapters for character concept brainstorming
- **Data Models**: Structured representations of character concepts and thematic directions

## Data Models & Storage

### Character Concept Model

```javascript
/**
 * @typedef {Object} CharacterConcept
 * @property {string} id - Unique identifier (UUID)
 * @property {string} concept - User-provided character concept text
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Last modification timestamp
 * @property {string} status - Current processing status: 'draft', 'processing', 'completed', 'error'
 * @property {ThematicDirection[]} thematicDirections - Generated thematic directions
 * @property {Object} metadata - Additional metadata for future steps
 */
```

### Thematic Direction Model

```javascript
/**
 * @typedef {Object} ThematicDirection
 * @property {string} id - Unique identifier (UUID)
 * @property {string} conceptId - Reference to parent CharacterConcept
 * @property {string} title - Brief title/summary of the direction
 * @property {string} description - Detailed description of the thematic direction
 * @property {string} coreTension - Core tension or conflict this direction embodies
 * @property {string} uniqueTwist - Suggested unique twist or deeper archetype
 * @property {string} narrativePotential - Description of narrative possibilities
 * @property {Date} createdAt - Creation timestamp
 * @property {Object} llmMetadata - LLM response metadata (model, tokens, etc.)
 */
```

### JSON Schemas

#### CharacterConcept Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "id": "character-concept.schema.json",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "pattern": "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
    },
    "concept": {
      "type": "string",
      "minLength": 10,
      "maxLength": 1000
    },
    "status": {
      "type": "string",
      "enum": ["draft", "processing", "completed", "error"]
    },
    "createdAt": {
      "type": "string",
      "format": "date-time"
    },
    "updatedAt": {
      "type": "string",
      "format": "date-time"
    },
    "thematicDirections": {
      "type": "array",
      "items": { "$ref": "#/definitions/ThematicDirection" },
      "minItems": 0,
      "maxItems": 10
    },
    "metadata": {
      "type": "object",
      "additionalProperties": true
    }
  },
  "required": ["id", "concept", "status", "createdAt", "updatedAt"],
  "additionalProperties": false
}
```

#### ThematicDirection Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "id": "thematic-direction.schema.json",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "pattern": "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
    },
    "conceptId": {
      "type": "string",
      "pattern": "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
    },
    "title": {
      "type": "string",
      "minLength": 5,
      "maxLength": 200
    },
    "description": {
      "type": "string",
      "minLength": 20,
      "maxLength": 2000
    },
    "coreTension": {
      "type": "string",
      "minLength": 10,
      "maxLength": 500
    },
    "uniqueTwist": {
      "type": "string",
      "minLength": 10,
      "maxLength": 500
    },
    "narrativePotential": {
      "type": "string",
      "minLength": 10,
      "maxLength": 1000
    },
    "createdAt": {
      "type": "string",
      "format": "date-time"
    },
    "llmMetadata": {
      "type": "object",
      "properties": {
        "modelId": { "type": "string" },
        "promptTokens": { "type": "number" },
        "responseTokens": { "type": "number" },
        "processingTime": { "type": "number" }
      }
    }
  },
  "required": [
    "id",
    "conceptId",
    "title",
    "description",
    "coreTension",
    "uniqueTwist",
    "narrativePotential",
    "createdAt"
  ],
  "additionalProperties": false
}
```

### IndexedDB Storage Schema

```javascript
// Database: CharacterBuilder
// Version: 1
// Object Stores:

// 1. characterConcepts
{
  keyPath: 'id',
  indexes: [
    { name: 'status', keyPath: 'status', unique: false },
    { name: 'createdAt', keyPath: 'createdAt', unique: false },
    { name: 'updatedAt', keyPath: 'updatedAt', unique: false }
  ]
}

// 2. thematicDirections
{
  keyPath: 'id',
  indexes: [
    { name: 'conceptId', keyPath: 'conceptId', unique: false },
    { name: 'createdAt', keyPath: 'createdAt', unique: false }
  ]
}

// 3. metadata (for future expansion)
{
  keyPath: 'key',
  indexes: []
}
```

## LLM Integration

### Prompt Template for Thematic Directions

```xml
<task_definition>
You are a creative writing assistant helping to develop original character concepts for narrative-driven games. Your task is to analyze a basic character concept and brainstorm thematic directions that move beyond surface descriptions to create compelling narrative potential.
</task_definition>

<character_concept>
{characterConcept}
</character_concept>

<instructions>
Based on the character concept provided, help brainstorm 3-5 distinct thematic directions or core tensions this character could embody. For each direction:

1. Provide a clear, concise title (5-10 words)
2. Describe the thematic direction in detail (2-3 sentences)
3. Identify the core tension or conflict this direction creates
4. Suggest a unique twist or deeper archetype it could lean into
5. Explain the narrative potential and story possibilities

Focus on:
- Moving beyond surface descriptors to deeper character essence
- Creating inherent tensions and conflicts for compelling storytelling
- Ensuring originality and avoiding cliché interpretations
- Establishing clear narrative hooks and story potential

Respond with a JSON object containing an array of thematic directions.
</instructions>

<response_format>
{
  "thematicDirections": [
    {
      "title": "Brief direction title",
      "description": "Detailed description of the thematic direction",
      "coreTension": "The central tension or conflict",
      "uniqueTwist": "Unique twist or deeper archetype",
      "narrativePotential": "Story possibilities and narrative hooks"
    }
  ]
}
</response_format>
```

### LLM Response Schema

```javascript
const THEMATIC_DIRECTIONS_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    thematicDirections: {
      type: 'array',
      minItems: 3,
      maxItems: 5,
      items: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            minLength: 5,
            maxLength: 100,
          },
          description: {
            type: 'string',
            minLength: 50,
            maxLength: 500,
          },
          coreTension: {
            type: 'string',
            minLength: 20,
            maxLength: 200,
          },
          uniqueTwist: {
            type: 'string',
            minLength: 20,
            maxLength: 200,
          },
          narrativePotential: {
            type: 'string',
            minLength: 30,
            maxLength: 300,
          },
        },
        required: [
          'title',
          'description',
          'coreTension',
          'uniqueTwist',
          'narrativePotential',
        ],
        additionalProperties: false,
      },
    },
  },
  required: ['thematicDirections'],
};
```

## Service Layer

### CharacterBuilderService

Primary orchestration service for character building operations:

```javascript
/**
 * @class CharacterBuilderService
 * @description Orchestrates character building operations, coordinating between
 * storage, LLM integration, and validation services.
 */
class CharacterBuilderService {
  constructor({
    logger,
    characterStorageService,
    thematicDirectionGenerator,
    validationService,
    eventBus,
  }) {
    // Service dependencies via dependency injection
  }

  /**
   * Create a new character concept
   * @param {string} concept - User-provided character concept
   * @returns {Promise<CharacterConcept>} Created character concept
   */
  async createCharacterConcept(concept) {}

  /**
   * Generate thematic directions for a character concept
   * @param {string} conceptId - Character concept ID
   * @returns {Promise<ThematicDirection[]>} Generated thematic directions
   */
  async generateThematicDirections(conceptId) {}

  /**
   * Get all character concepts
   * @returns {Promise<CharacterConcept[]>} Array of character concepts
   */
  async getAllCharacterConcepts() {}

  /**
   * Get character concept by ID
   * @param {string} conceptId - Character concept ID
   * @returns {Promise<CharacterConcept>} Character concept
   */
  async getCharacterConcept(conceptId) {}

  /**
   * Delete character concept and associated data
   * @param {string} conceptId - Character concept ID
   * @returns {Promise<void>}
   */
  async deleteCharacterConcept(conceptId) {}
}
```

### CharacterStorageService

IndexedDB storage operations:

```javascript
/**
 * @class CharacterStorageService
 * @description Handles persistent storage operations for character data
 */
class CharacterStorageService {
  constructor({ logger, databaseManager, schemaValidator }) {}

  /**
   * Save character concept
   * @param {CharacterConcept} concept - Character concept to save
   * @returns {Promise<CharacterConcept>} Saved concept
   */
  async saveCharacterConcept(concept) {}

  /**
   * Save thematic directions
   * @param {ThematicDirection[]} directions - Thematic directions to save
   * @returns {Promise<ThematicDirection[]>} Saved directions
   */
  async saveThematicDirections(directions) {}

  /**
   * Get all character concepts
   * @returns {Promise<CharacterConcept[]>} Array of concepts
   */
  async getAllCharacterConcepts() {}

  /**
   * Get character concept by ID with thematic directions
   * @param {string} conceptId - Concept ID
   * @returns {Promise<CharacterConcept>} Concept with directions
   */
  async getCharacterConceptWithDirections(conceptId) {}

  /**
   * Delete character concept and associated data
   * @param {string} conceptId - Concept ID
   * @returns {Promise<void>}
   */
  async deleteCharacterConcept(conceptId) {}
}
```

### ThematicDirectionGenerator

LLM integration for thematic direction generation:

```javascript
/**
 * @class ThematicDirectionGenerator
 * @description Generates thematic directions using LLM integration
 */
class ThematicDirectionGenerator {
  constructor({
    logger,
    llmAdapter,
    promptBuilder,
    responseParser,
    validationService,
  }) {}

  /**
   * Generate thematic directions for a character concept
   * @param {string} characterConcept - Character concept text
   * @returns {Promise<Object[]>} Raw thematic direction data from LLM
   */
  async generateDirections(characterConcept) {}

  /**
   * Validate LLM response structure
   * @param {Object} response - LLM response
   * @returns {boolean} Validation result
   */
  validateResponse(response) {}

  /**
   * Parse and transform LLM response to domain models
   * @param {Object} response - LLM response
   * @param {string} conceptId - Parent concept ID
   * @returns {ThematicDirection[]} Parsed thematic directions
   */
  parseResponse(response, conceptId) {}
}
```

## UI Architecture

### HTML Structure (character-builder.html)

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Character Builder - Living Narrative Engine</title>
    <link rel="stylesheet" href="css/style.css" />
    <link rel="stylesheet" href="css/character-builder.css" />
  </head>
  <body>
    <div id="character-builder-container">
      <!-- Header -->
      <header class="character-builder-header">
        <h1>Character Builder</h1>
        <nav class="breadcrumb">
          <span class="step active">Step 1: Thematic Directions</span>
          <span class="step disabled">Step 2: Cliché Analysis</span>
          <span class="step disabled">Step 3: Core Motivations</span>
          <span class="step disabled">Step 4: Character Details</span>
          <span class="step disabled">Step 5: Final Polish</span>
        </nav>
      </header>

      <!-- Main Content Area -->
      <main class="character-builder-main">
        <!-- Left Panel: Concept Input -->
        <section class="concept-input-panel">
          <h2>Character Concept</h2>
          <form id="character-concept-form">
            <div class="input-group">
              <label for="character-concept-input">
                Describe your character concept:
              </label>
              <textarea
                id="character-concept-input"
                placeholder="e.g. a ditzy female adventurer who's good with a bow"
                rows="4"
                maxlength="1000"
                required
              ></textarea>
              <div class="input-meta">
                <span class="char-count">0/1000</span>
              </div>
            </div>
            <div class="action-buttons">
              <button
                type="submit"
                id="generate-directions-btn"
                class="primary-button"
              >
                Generate Thematic Directions
              </button>
              <button
                type="button"
                id="save-concept-btn"
                class="secondary-button"
                disabled
              >
                Save Concept
              </button>
            </div>
          </form>
        </section>

        <!-- Right Panel: Results Display -->
        <section class="thematic-directions-panel">
          <h2>Thematic Directions</h2>
          <div id="directions-container">
            <!-- Loading State -->
            <div
              id="loading-state"
              class="loading-state"
              style="display: none;"
            >
              <div class="spinner"></div>
              <p>Generating thematic directions...</p>
            </div>

            <!-- Empty State -->
            <div id="empty-state" class="empty-state">
              <p>Enter a character concept to generate thematic directions.</p>
            </div>

            <!-- Error State -->
            <div id="error-state" class="error-state" style="display: none;">
              <p class="error-message">
                Failed to generate thematic directions. Please try again.
              </p>
              <button type="button" id="retry-btn" class="secondary-button">
                Retry
              </button>
            </div>

            <!-- Results Display -->
            <div
              id="directions-results"
              class="directions-results"
              style="display: none;"
            >
              <!-- Dynamic content populated by JavaScript -->
            </div>
          </div>
        </section>
      </main>

      <!-- Footer -->
      <footer class="character-builder-footer">
        <div class="navigation-buttons">
          <button type="button" id="back-to-menu-btn" class="secondary-button">
            Back to Main Menu
          </button>
          <button
            type="button"
            id="continue-step2-btn"
            class="primary-button"
            disabled
          >
            Continue to Step 2
          </button>
        </div>
      </footer>
    </div>

    <!-- Saved Concepts Sidebar -->
    <aside id="saved-concepts-sidebar" class="sidebar">
      <div class="sidebar-header">
        <h3>Saved Concepts</h3>
        <button type="button" id="toggle-sidebar-btn" class="toggle-button">
          ≡
        </button>
      </div>
      <div class="sidebar-content">
        <div id="saved-concepts-list">
          <!-- Dynamic content populated by JavaScript -->
        </div>
      </div>
    </aside>

    <!-- Character Builder Scripts -->
    <script src="dist/character-builder.js"></script>
  </body>
</html>
```

### CSS Architecture (character-builder.css)

Key styling considerations:

- Responsive grid layout for dual-panel design
- Loading states and animations
- Card-based display for thematic directions
- Form styling consistent with game UI
- Accessibility considerations (focus states, ARIA labels)

### JavaScript Architecture

#### Main Controller

```javascript
/**
 * @class CharacterBuilderController
 * @description Main UI controller for character builder step 1
 */
class CharacterBuilderController {
  constructor({
    logger,
    characterBuilderService,
    eventBus,
    validationService,
  }) {}

  /**
   * Initialize the character builder UI
   */
  async initialize() {}

  /**
   * Handle character concept form submission
   */
  async handleConceptSubmission(event) {}

  /**
   * Display generated thematic directions
   */
  displayThematicDirections(directions) {}

  /**
   * Handle error states
   */
  handleError(error) {}

  /**
   * Update UI loading states
   */
  updateLoadingState(isLoading) {}
}
```

#### UI State Management

```javascript
/**
 * @class CharacterBuilderUIState
 * @description Manages UI state for character builder
 */
class CharacterBuilderUIState {
  constructor() {
    this.currentConcept = null;
    this.thematicDirections = [];
    this.isLoading = false;
    this.hasError = false;
  }

  setState(newState) {}
  getState() {}
  subscribe(callback) {}
  unsubscribe(callback) {}
}
```

## File Structure

```
/
├── character-builder.html                 # Main character builder page
├── css/
│   └── character-builder.css             # Character builder specific styles
├── src/
│   ├── characterBuilder/
│   │   ├── controllers/
│   │   │   ├── characterBuilderController.js
│   │   │   └── uiStateManager.js
│   │   ├── services/
│   │   │   ├── characterBuilderService.js
│   │   │   ├── characterStorageService.js
│   │   │   ├── thematicDirectionGenerator.js
│   │   │   └── characterValidationService.js
│   │   ├── models/
│   │   │   ├── characterConcept.js
│   │   │   └── thematicDirection.js
│   │   ├── storage/
│   │   │   ├── characterDatabase.js
│   │   │   └── databaseMigrations.js
│   │   ├── prompts/
│   │   │   └── thematicDirectionsPrompt.js
│   │   └── interfaces/
│   │       ├── ICharacterStorageService.js
│   │       └── IThematicDirectionGenerator.js
│   └── schemas/
│       ├── character-concept.schema.json
│       └── thematic-direction.schema.json
├── tests/
│   ├── unit/
│   │   └── characterBuilder/
│   │       ├── services/
│   │       ├── controllers/
│   │       └── storage/
│   └── integration/
│       └── characterBuilder/
└── dist/
    └── character-builder.js              # Bundled character builder code
```

## Implementation Guidelines

### Development Process

1. **Schema First**: Define and validate all data schemas before implementation
2. **Service Layer First**: Implement core services with comprehensive tests
3. **Storage Layer**: Implement IndexedDB operations with migration support
4. **LLM Integration**: Extend existing LLM adapter for character building use case
5. **UI Implementation**: Build UI components with real data integration
6. **Integration Testing**: End-to-end testing of complete workflow

### Code Standards

- Follow existing project conventions (camelCase files, PascalCase classes)
- Use dependency injection for all services
- Implement comprehensive error handling
- Include JSDoc documentation for all public methods
- Maintain 80%+ test coverage
- Follow established validation patterns

### Error Handling

```javascript
// Character Builder specific errors
class CharacterConceptValidationError extends Error {}
class ThematicDirectionGenerationError extends Error {}
class CharacterStorageError extends Error {}
class LLMIntegrationError extends Error {}
```

### Validation Strategy

- Client-side validation for immediate feedback
- Schema-based validation for all stored data
- LLM response validation before processing
- Sanitization of user inputs
- Error state management and recovery

## Integration Points

### Existing Services

- **ConfigurableLLMAdapter**: Extend for character building prompts
- **HTTP Utils**: Use for consistent error handling and retry logic
- **Event Bus**: Dispatch character building events
- **Validation Utils**: Leverage existing validation helpers
- **Logger Utils**: Consistent logging patterns

### Dependency Injection

```javascript
// Character builder token registration
const characterBuilderTokens = {
  ICharacterBuilderService: Symbol('ICharacterBuilderService'),
  ICharacterStorageService: Symbol('ICharacterStorageService'),
  IThematicDirectionGenerator: Symbol('IThematicDirectionGenerator'),
  ICharacterValidationService: Symbol('ICharacterValidationService'),
};

// Service registration in container
container.register(
  characterBuilderTokens.ICharacterBuilderService,
  CharacterBuilderService
);
// ... additional registrations
```

### Event Integration

```javascript
// Character builder events
const CHARACTER_BUILDER_EVENTS = {
  CONCEPT_CREATED: 'CHARACTER_CONCEPT_CREATED',
  DIRECTIONS_GENERATED: 'THEMATIC_DIRECTIONS_GENERATED',
  CONCEPT_SAVED: 'CHARACTER_CONCEPT_SAVED',
  ERROR_OCCURRED: 'CHARACTER_BUILDER_ERROR_OCCURRED',
};
```

## Testing Strategy

### Unit Tests

- Service layer methods with mocked dependencies
- Storage operations with mock IndexedDB
- Validation functions with edge cases
- LLM integration with mocked responses
- UI controller methods with DOM mocks

### Integration Tests

- Complete character concept creation workflow
- IndexedDB operations with real database
- LLM integration with test API calls
- UI interactions with real DOM
- Error handling and recovery scenarios

### E2E Tests

- Full character building workflow from concept to completion
- Cross-browser compatibility testing
- Performance testing with large datasets
- Accessibility compliance testing

### Test Data

```javascript
// Test fixtures
export const testCharacterConcepts = [
  {
    concept: "a ditzy female adventurer who's good with a bow",
    expectedDirections: 5,
    testCase: 'basic_archer_concept',
  },
  {
    concept: 'a brooding vampire lord seeking redemption',
    expectedDirections: 4,
    testCase: 'vampire_redemption_concept',
  },
];
```

## Future Considerations

### Extensibility for Next Steps

- Storage schema designed to accommodate additional character building steps
- Service layer interfaces that can be extended for cliché analysis and motivations
- UI architecture that supports progressive disclosure of character building steps
- Event system that enables cross-step communication and validation

### Performance Optimization

- Lazy loading of thematic directions
- Caching of LLM responses for repeated concepts
- IndexedDB query optimization with proper indexes
- Bundle splitting for character builder code

### Accessibility

- ARIA labels for all interactive elements
- Keyboard navigation support
- Screen reader compatibility
- High contrast mode support
- Focus management during state transitions

This specification provides a comprehensive foundation for implementing Step 1 of the character building system while establishing the architectural patterns needed for subsequent steps. The implementation should follow the established Living Narrative Engine patterns and leverage existing infrastructure wherever possible.
