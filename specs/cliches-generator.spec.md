# Clichés Generator Page - Implementation Specification

---

**Status**: Specification Only - Not Yet Implemented
**Created**: 2025-08-09
**Type**: Feature Specification
**Dependencies**: Character Concepts Manager, Thematic Directions Manager

> ⚠️ **Note**: This is a design specification for a feature that has not been implemented yet. All code examples and implementation details below represent the planned architecture, not existing code.

---

## 1. Overview

### 1.1 Purpose

The Clichés Generator page allows users to generate comprehensive lists of common clichés, stereotypes, and overused tropes associated with a specific thematic direction. This serves as a "what to avoid" guide for character development, helping writers steer clear of predictable and uninspired character elements.

### 1.2 Goals

- **Generate Cliché Lists**: Create comprehensive lists of common clichés for selected thematic directions
- **Associate with Directions**: Store clichés in one-to-one relationship with thematic directions
- **Provide Anti-Patterns**: Help writers identify and avoid overused character elements
- **Maintain Consistency**: Use existing architecture patterns from other character builder pages
- **Enable Quick Reference**: Allow easy access to cliché lists for character development

### 1.3 Scope

- Create new page for cliché generation and management
- Integrate with existing thematic directions data
- Store clichés in IndexedDB using existing patterns
- Generate clichés via LLM with structured prompts
- Display clichés in organized categories

### 1.4 Non-Goals

- Editing existing thematic directions
- Creating new character concepts
- Generating positive character suggestions (only anti-patterns)
- Managing multiple cliché sets per direction

## 2. Architecture Design

### 2.1 System Architecture

```
Clichés Generator System
├── Data Layer
│   ├── Cliche Model (new)
│   ├── CharacterDatabase (extend)
│   └── CharacterStorageService (extend)
├── Service Layer
│   ├── CharacterBuilderService (extend)
│   └── ClicheGenerator Service (new)
├── Controller Layer
│   ├── ClichesGeneratorController (new)
│   └── BaseCharacterBuilderController (inherit)
├── Prompt Layer
│   └── ClichesPrompt (new)
├── UI Layer
│   ├── cliches-generator.html (new)
│   └── CSS (reuse existing)
└── Build Integration
    ├── Entry Point (new)
    └── Build Config (update)
```

### 2.2 Data Flow

1. **Page Load**: Initialize controller, load concepts and directions
2. **Direction Selection**: User selects thematic direction from dropdown
3. **Validation**: Check if clichés already exist for selected direction
4. **Generation**: If no clichés exist, prepare and send LLM prompt
5. **Storage**: Store generated clichés associated with direction
6. **Display**: Render clichés in categorized format
7. **Persistence**: Save to IndexedDB for future sessions

## 3. Data Model

### 3.1 Cliche Model

```javascript
/**
 * @typedef {object} Cliche
 * @property {string} id - Unique identifier (UUID)
 * @property {string} directionId - Reference to parent ThematicDirection
 * @property {string} conceptId - Reference to original CharacterConcept
 * @property {object} categories - Cliché categories with lists
 * @property {string[]} categories.names - Common/overused names
 * @property {string[]} categories.physicalDescriptions - Clichéd physical traits
 * @property {string[]} categories.personalityTraits - Overused personality traits
 * @property {string[]} categories.skillsAbilities - Common skills/abilities
 * @property {string[]} categories.typicalLikes - Predictable likes/interests
 * @property {string[]} categories.typicalDislikes - Common dislikes
 * @property {string[]} categories.commonFears - Overused fears
 * @property {string[]} categories.genericGoals - Predictable goals/motivations
 * @property {string[]} categories.backgroundElements - Clichéd backstory elements
 * @property {string[]} categories.overusedSecrets - Common secrets/reveals
 * @property {string[]} categories.speechPatterns - Overused catchphrases/patterns
 * @property {string[]} tropesAndStereotypes - Common tropes associated
 * @property {string} createdAt - Creation timestamp (ISO string)
 * @property {object} llmMetadata - LLM response metadata
 */
```

### 3.2 Database Schema Extension

**Status**: TO BE IMPLEMENTED

```javascript
// TO BE ADDED to character-database.js stores
// Currently, the database only has: characterConcepts, thematicDirections, metadata
{
  name: 'cliches',
  keyPath: 'id',
  indexes: [
    { name: 'directionId', keyPath: 'directionId', unique: true }, // One-to-one
    { name: 'conceptId', keyPath: 'conceptId', unique: false },
    { name: 'createdAt', keyPath: 'createdAt', unique: false }
  ]
}
```

### 3.3 Relationships

- **Character Concept** → Many **Thematic Directions** (existing)
- **Thematic Direction** → One **Cliche Set** (new, one-to-one)
- Clichés cannot exist without a parent thematic direction
- Only one cliché set allowed per thematic direction

## 4. Service Layer

### 4.1 CharacterBuilderService Extension

**Status**: TO BE IMPLEMENTED

```javascript
// TO BE ADDED - These methods do not exist yet in CharacterBuilderService

/**
 * Get clichés for a thematic direction
 * @param {string} directionId - Thematic direction ID
 * @returns {Promise<Cliche|null>} Cliche data or null
 */
async getClichesByDirectionId(directionId)

/**
 * Check if clichés exist for a direction
 * @param {string} directionId - Thematic direction ID
 * @returns {Promise<boolean>} True if clichés exist
 */
async hasClichesForDirection(directionId)

/**
 * Store clichés for a direction
 * @param {Cliche} cliches - Cliche data to store
 * @returns {Promise<Cliche>} Stored cliche data
 */
async storeCliches(cliches)

/**
 * Generate clichés for a thematic direction
 * @param {CharacterConcept} concept - Original character concept
 * @param {ThematicDirection} direction - Selected thematic direction
 * @returns {Promise<Cliche>} Generated and stored clichés
 */
async generateClichesForDirection(concept, direction)
```

### 4.2 ClicheGenerator Service

**Status**: TO BE IMPLEMENTED

```javascript
// TO BE CREATED - This service does not exist yet
class ClicheGenerator {
  constructor({ llmService, logger }) {
    // Dependencies
  }

  /**
   * Generate clichés via LLM
   * @param {string} conceptText - Character concept text
   * @param {string} directionText - Thematic direction description
   * @returns {Promise<object>} Parsed cliché categories
   */
  async generateCliches(conceptText, directionText)

  /**
   * Parse LLM response into cliché model
   * @param {object} llmResponse - Raw LLM response
   * @returns {object} Structured cliché categories
   */
  parseLLMResponse(llmResponse)
}
```

## 5. Controller Implementation

### 5.1 ClichesGeneratorController

**Status**: TO BE IMPLEMENTED

```javascript
// TO BE CREATED - This controller does not exist yet
// Will extend BaseCharacterBuilderController
class ClichesGeneratorController extends BaseCharacterBuilderController {
  // Page-specific state
  #selectedDirectionId = null;
  #currentConcept = null;
  #currentDirection = null;
  #currentCliches = null;
  #directionsData = [];

  // Required abstract method implementations
  _cacheElements() {
    // Cache DOM elements
  }

  _setupEventListeners() {
    // Set up page-specific event listeners
  }

  async _loadInitialData() {
    // Load concepts and directions
  }

  // Page-specific methods
  async _handleDirectionSelection()
  async _handleGenerateCliches()
  async _displayCliches(cliches)
  _updateUIState(hasCliches)
}
```

### 5.2 Key Controller Methods

- **loadThematicDirections()**: Fetch all directions with their concepts
- **checkExistingCliches()**: Verify if clichés already exist
- **generateCliches()**: Trigger LLM generation if needed
- **displayCliches()**: Render clichés in categorized format
- **handleErrors()**: Manage generation and display errors

## 6. Prompt Structure

### 6.1 Clichés Generation Prompt

```javascript
function buildClichesPrompt(characterConcept, thematicDirection) {
  return `
<role>
You are a narrative design assistant specializing in identifying overused tropes, clichés, and stereotypes in character development.
</role>

<task>
Generate a comprehensive "what to avoid" list for the given character concept and thematic direction.
</task>

<character_concept>
${characterConcept}
</character_concept>

<thematic_direction>
${thematicDirection.title}
${thematicDirection.description}
Core Tension: ${thematicDirection.coreTension}
</thematic_direction>

<instructions>
List the most clichéd, common, and uninspired elements for the following categories:

1. Names - Common/overused character names for this archetype
2. Physical Descriptions - Clichéd appearance traits
3. Personality Traits - Overused personality characteristics
4. Skills/Abilities - Predictable capabilities
5. Typical Likes - Common interests/preferences
6. Typical Dislikes - Predictable aversions
7. Common Fears - Overused fears/phobias
8. Generic Goals - Predictable motivations
9. Background Elements - Clichéd backstory components
10. Overused Secrets - Common "twist" reveals
11. Speech Patterns - Overused catchphrases/verbal tics
12. Tropes and Stereotypes - Overall narrative patterns to avoid

Provide 3-5 specific examples for each category.
Focus on genuinely overused elements, not just common traits.
</instructions>

<response_format>
{
  "categories": {
    "names": ["example1", "example2", ...],
    "physicalDescriptions": [...],
    "personalityTraits": [...],
    "skillsAbilities": [...],
    "typicalLikes": [...],
    "typicalDislikes": [...],
    "commonFears": [...],
    "genericGoals": [...],
    "backgroundElements": [...],
    "overusedSecrets": [...],
    "speechPatterns": [...]
  },
  "tropesAndStereotypes": [...]
}
</response_format>`;
}
```

## 7. UI/UX Design

### 7.1 Page Layout

```
┌─────────────────────────────────────────────────────────┐
│                    Header                               │
│         "Clichés Generator"                            │
│    "Identify overused tropes to avoid"                 │
├─────────────────────────────┬───────────────────────────┤
│      Input Panel (Left)     │   Results Panel (Right)   │
│                             │                           │
│  Direction Selection:       │   Generated Clichés:      │
│  [Dropdown: Directions]     │                           │
│                             │   ┌─────────────────┐     │
│  Selected Direction:        │   │ Category Cards  │     │
│  ┌──────────────────┐      │   │                 │     │
│  │ Direction Info   │      │   │ • Names         │     │
│  │ • Title          │      │   │ • Physical      │     │
│  │ • Description    │      │   │ • Personality   │     │
│  │ • Core Tension   │      │   │ • Skills        │     │
│  └──────────────────┘      │   │ • Likes         │     │
│                             │   │ • Dislikes      │     │
│  Original Concept:          │   │ • Fears         │     │
│  ┌──────────────────┐      │   │ • Goals         │     │
│  │ Concept Text     │      │   │ • Background    │     │
│  └──────────────────┘      │   │ • Secrets       │     │
│                             │   │ • Speech        │     │
│  [Generate Clichés]         │   │ • Tropes        │     │
│                             │   └─────────────────┘     │
│  Status Messages            │                           │
├─────────────────────────────┴───────────────────────────┤
│                    Footer                               │
│  [← Back to Menu]          "Living Narrative Engine"    │
└─────────────────────────────────────────────────────────┘
```

### 7.2 UI States

1. **Empty State**: No direction selected
2. **Loading State**: Fetching directions or generating clichés
3. **Ready State**: Direction selected, can generate
4. **Results State**: Clichés displayed
5. **Error State**: Generation or loading failed
6. **Exists State**: Clichés already exist for direction

### 7.3 User Flow

1. User navigates to Clichés Generator page
2. Dropdown populates with thematic directions
3. User selects a thematic direction
4. System displays direction details and original concept
5. If clichés exist: Display them immediately
6. If no clichés: Enable "Generate Clichés" button
7. User clicks generate → Loading state → Display results
8. Results shown in categorized cards
9. User can select different direction to view/generate others

## 8. HTML Structure

**Status**: TO BE IMPLEMENTED

```html
<!-- TO BE CREATED - This HTML file does not exist yet -->
<!DOCTYPE html>
<html lang="en">
<head>
  <title>Clichés Generator - Living Narrative Engine</title>
  <link rel="stylesheet" href="css/style.css" />
  <link rel="stylesheet" href="css/components.css" />
  <link rel="stylesheet" href="css/cliches-generator.css" />
</head>
<body>
  <div id="cliches-generator-container" class="cb-page-container">
    <header class="cb-page-header">
      <h1>Clichés Generator</h1>
      <p class="header-subtitle">Identify overused tropes to avoid</p>
    </header>

    <main class="cb-page-main cliches-generator-main">
      <!-- Left Panel: Input -->
      <section class="cb-input-panel">
        <h2 class="cb-panel-title">Direction Selection</h2>
        
        <form id="cliches-form" novalidate>
          <div class="cb-form-group">
            <label for="direction-selector">
              Select Thematic Direction:
              <span class="required">*</span>
            </label>
            <select id="direction-selector" class="cb-select" required>
              <option value="">-- Choose a thematic direction --</option>
            </select>
          </div>

          <div id="selected-direction-display" style="display: none;">
            <h3>Selected Direction</h3>
            <div id="direction-content"></div>
            <div id="direction-meta"></div>
          </div>

          <div id="original-concept-display" style="display: none;">
            <h3>Original Concept</h3>
            <div id="concept-content"></div>
          </div>

          <div class="action-buttons">
            <button type="submit" id="generate-btn" disabled>
              Generate Clichés
            </button>
          </div>
        </form>

        <div id="status-messages"></div>
      </section>

      <!-- Right Panel: Results -->
      <section class="cb-results-panel">
        <h2 class="cb-panel-title">Generated Clichés</h2>
        
        <div id="cliches-container" class="cb-state-container">
          <!-- State containers (empty, loading, results, error) -->
        </div>
      </section>
    </main>

    <footer class="cb-page-footer">
      <button id="back-to-menu-btn">← Back to Main Menu</button>
      <p>Living Narrative Engine - Clichés Generator</p>
    </footer>
  </div>

  <script src="cliches-generator.js"></script>
</body>
</html>
```

## 9. Build Configuration

### 9.1 Entry Point (`src/cliches-generator-main.js`)

**Status**: TO BE IMPLEMENTED

```javascript
// TO BE CREATED - This file does not exist yet
// Note: The actual CharacterBuilderBootstrap uses a different pattern:

import { ClichesGeneratorController } from './clichesGenerator/controllers/clichesGeneratorController.js';
import { CharacterBuilderBootstrap } from './characterBuilder/CharacterBuilderBootstrap.js';

// Correct bootstrap pattern based on actual implementation:
const bootstrap = new CharacterBuilderBootstrap();

const initializeApp = async () => {
  try {
    const result = await bootstrap.bootstrap({
      pageName: 'cliches-generator',
      controllerClass: ClichesGeneratorController,
      // Additional configuration as needed
    });
    
    console.log('Clichés Generator initialized successfully');
  } catch (error) {
    console.error('Failed to initialize clichés generator:', error);
  }
};

initializeApp();
```

### 9.2 Build Config Update

**Status**: TO BE IMPLEMENTED

Add to `scripts/build.config.js`:

```javascript
// TO BE ADDED - Currently the build config only has these bundles:
// main, anatomy-visualizer, thematic-direction, thematic-directions-manager, character-concepts-manager

bundles: [
  // ... existing bundles
  {
    name: 'cliches-generator',
    entry: 'src/cliches-generator-main.js',
    output: 'cliches-generator.js',
  }
],

htmlFiles: [
  // ... existing files
  'cliches-generator.html'  // TO BE CREATED
]
```

## 10. Testing Strategy

### 10.1 Unit Tests

- **Model Tests**: `tests/unit/characterBuilder/models/cliche.test.js`
  - Cliche creation validation
  - Field constraints
  - Serialization/deserialization

- **Service Tests**: `tests/unit/characterBuilder/services/clicheGenerator.test.js`
  - LLM prompt generation
  - Response parsing
  - Error handling

- **Controller Tests**: `tests/unit/clichesGenerator/controllers/clichesGeneratorController.test.js`
  - Event handling
  - State management
  - UI updates

### 10.2 Integration Tests

- **Storage Tests**: `tests/integration/clichesGenerator/clicheStorage.integration.test.js`
  - IndexedDB operations
  - One-to-one relationship enforcement
  - Data persistence

- **Workflow Tests**: `tests/integration/clichesGenerator/clichesGeneratorWorkflow.test.js`
  - Complete generation flow
  - Direction selection
  - Cliché display

### 10.3 E2E Tests

- **User Journey**: `tests/e2e/clichesGenerator.e2e.test.js`
  - Page navigation
  - Direction selection
  - Generation process
  - Result display

## 11. Implementation Order

1. **Data Model** (Week 1)
   - Create Cliche model
   - Extend database schema
   - Add storage methods

2. **Service Layer** (Week 1)
   - Extend CharacterBuilderService
   - Create ClicheGenerator service
   - Implement LLM integration

3. **Prompt Development** (Week 2)
   - Create clichés prompt template
   - Define response schema
   - Implement validation

4. **Controller** (Week 2)
   - Create ClichesGeneratorController
   - Implement state management
   - Add event handlers

5. **UI Implementation** (Week 3)
   - Create HTML structure
   - Style with existing CSS
   - Add responsive behavior

6. **Testing** (Week 3-4)
   - Write unit tests
   - Integration tests
   - E2E tests

7. **Build Integration** (Week 4)
   - Update build config
   - Create entry point
   - Test build process

## 12. Success Criteria

- ✅ Users can select any thematic direction
- ✅ System prevents duplicate cliché generation
- ✅ Generated clichés are comprehensive (11 categories + tropes)
- ✅ Clichés persist across sessions
- ✅ UI follows existing character builder patterns
- ✅ Page loads in < 2 seconds
- ✅ Generation completes in < 10 seconds
- ✅ 80% test coverage achieved
- ✅ No breaking changes to existing pages
- ✅ Build process includes new page

## 13. Future Enhancements

- Export clichés to PDF/Markdown
- Compare clichés across multiple directions
- User-contributed clichés
- Cliché severity ratings
- Cultural context variations
- Genre-specific cliché lists
- Cliché evolution tracking (historical changes)

## 14. Current Implementation Status

### Existing Infrastructure (Can Be Reused)
✅ **Already Implemented:**
- `BaseCharacterBuilderController.js` - Base controller class
- `CharacterBuilderService.js` - Core service layer  
- `CharacterDatabase.js` - IndexedDB wrapper
- `CharacterBuilderBootstrap.js` - Bootstrap system
- `thematicDirection.js` - Direction model
- `characterConcept.js` - Concept model
- LLM Service infrastructure (via proxy server)
- Common CSS and styling system
- Event bus system
- Validation utilities

### Components To Be Created
❌ **Not Yet Implemented:**
- `ClichesGeneratorController` - New controller extending BaseCharacterBuilderController
- `ClicheGenerator` service - New service for cliché generation logic
- `Cliche` model - New data model for clichés
- `cliches-generator.html` - New HTML page
- `cliches-generator-main.js` - New entry point file
- Database schema extension for `cliches` store
- CharacterBuilderService method extensions (4 new methods)
- Clichés prompt template
- Build configuration updates

### Integration Points Requiring Modification
⚠️ **Files That Need Updates:**
- `character-database.js` - Add new `cliches` store definition
- `CharacterBuilderService.js` - Add 4 new methods for cliché operations
- `scripts/build.config.js` - Add new bundle and HTML file entries
- Main navigation/menu (location TBD) - Add link to new page

## 15. Dependencies

### Required Existing Files/Services
- `BaseCharacterBuilderController.js` - Base controller class (EXISTS)
- `CharacterBuilderService.js` - Core service layer (EXISTS)
- `CharacterDatabase.js` - IndexedDB wrapper (EXISTS)
- `thematicDirection.js` - Direction model (EXISTS)
- `characterConcept.js` - Concept model (EXISTS)
- `CharacterBuilderBootstrap.js` - Bootstrap system (EXISTS)

### New Files to Create
- `ClichesGeneratorController.js` - Controller implementation (NEW)
- `ClicheGenerator.js` - Service implementation (NEW)
- `cliche.js` - Model definition (NEW)
- `cliches-generator.html` - UI page (NEW)
- `cliches-generator-main.js` - Entry point (NEW)

### External Dependencies
- LLM Service (via proxy server) - EXISTS
- IndexedDB API - Browser native
- UUID generation (uuid package) - EXISTS

## 16. Risk Assessment

### Technical Risks
- **LLM Response Quality**: Mitigate with structured prompts and validation
- **Storage Limits**: IndexedDB has browser-specific limits
- **Performance**: Large cliché lists may impact render time

### Mitigation Strategies
- Implement response validation and retry logic
- Monitor storage usage and provide warnings
- Use virtual scrolling for large result sets
- Cache generated clichés aggressively

---

**End of Specification**

This specification provides a complete blueprint for implementing the Clichés Generator page while maximizing code reuse and maintaining consistency with existing character builder pages.