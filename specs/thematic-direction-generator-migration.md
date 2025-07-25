# Thematic Direction Generator Migration Specification

## Executive Summary

This specification outlines the migration of character-building functionality from the existing multi-step `character-builder.html` to a new single-purpose `thematic-direction-generator.html` page. The migration maximizes code reuse while simplifying the user experience to focus solely on generating thematic directions from character concepts.

### Key Migration Goals

1. **Simplify User Experience**: Single-page, single-purpose interface for thematic direction generation
2. **Maximize Code Reuse**: Leverage existing CharacterBuilder infrastructure
3. **Database Integration**: Store concepts and directions with proper associations
4. **Maintain Quality**: Preserve existing validation and error handling
5. **Remove Dark Mode**: Retain existing light theme CSS from character builder

## Architecture Overview

### Current vs. New Structure

| Component   | Current (Character Builder) | New (Thematic Direction Generator) |
| ----------- | --------------------------- | ---------------------------------- |
| HTML File   | character-builder.html      | thematic-direction-generator.html  |
| Entry Point | character-builder-main.js   | thematic-direction-main.js         |
| Controller  | CharacterBuilderController  | ThematicDirectionController        |
| Services    | All existing services       | Same services (reused)             |
| CSS         | character-builder.css       | thematic-direction.css (migrated)  |
| Navigation  | Multi-step breadcrumb       | None (single page)                 |
| Sidebar     | Saved concepts sidebar      | Previous concepts dropdown         |

### Component Reusability Matrix

#### Fully Reusable Components (No Changes)

1. **Services Layer**:
   - `CharacterBuilderService` - Use subset of methods:
     - `createCharacterConcept()`
     - `generateThematicDirections()`
     - `storeCharacterConcept()`
     - `getAllCharacterConcepts()`
     - `getCharacterConcept()`
   - `ThematicDirectionGenerator` - No changes needed
   - `CharacterStorageService` - No changes needed
   - `CharacterDatabase` - No changes needed

2. **Models & Schemas**:
   - `CharacterConcept` model
   - `ThematicDirection` model
   - All validation schemas

3. **Infrastructure**:
   - Dependency injection container setup
   - Event bus system
   - LLM integration
   - Error handling utilities
   - Validation utilities

#### Components Requiring Modification

1. **Controller**: New `ThematicDirectionController`
   - Simplified from CharacterBuilderController
   - Remove multi-step logic
   - Add previous concepts dropdown handling
   - Focus on single workflow

2. **Entry Point**: New `thematic-direction-main.js`
   - Simplified initialization
   - Register ThematicDirectionController
   - Same DI configuration approach

3. **HTML Template**: New `thematic-direction-generator.html`
   - Remove breadcrumb navigation
   - Simplify to two-panel layout
   - Add previous concepts dropdown
   - Remove sidebar complexity

4. **CSS**: New `thematic-direction.css`
   - Migrate from character-builder.css
   - Remove dark mode variables
   - Retain existing light theme
   - Simplify for single-page layout

## File Structure

```
/home/joeloverbeck/projects/living-narrative-engine/
├── thematic-direction-generator.html     # New HTML page
├── src/
│   ├── thematic-direction-main.js      # New entry point
│   └── thematicDirection/
│       └── controllers/
│           └── thematicDirectionController.js  # New controller
├── css/
│   └── thematic-direction.css          # Migrated CSS
└── dist/
    └── thematic-direction.js            # Built bundle
```

## HTML Structure

### thematic-direction-generator.html

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Thematic Direction Generator - Living Narrative Engine</title>
    <link rel="stylesheet" href="css/style.css" />
    <link rel="stylesheet" href="css/thematic-direction.css" />
    <!-- Favicon links same as character-builder.html -->
  </head>
  <body>
    <div id="thematic-direction-container">
      <!-- Simplified Header -->
      <header class="thematic-direction-header">
        <div class="header-content">
          <h1>Thematic Direction Generator</h1>
          <p class="header-subtitle">
            Transform character concepts into narrative possibilities
          </p>
        </div>
      </header>

      <!-- Main Content Area -->
      <main class="thematic-direction-main">
        <!-- Left Panel: Concept Input -->
        <section class="concept-input-panel">
          <h2>Character Concept</h2>

          <!-- Previous Concepts Dropdown -->
          <div class="previous-concepts-group">
            <label for="previous-concepts"> Load Previous Concept: </label>
            <select id="previous-concepts" class="concept-select">
              <option value="">-- Select a saved concept --</option>
              <!-- Populated dynamically -->
            </select>
          </div>

          <form id="concept-form" novalidate>
            <div class="input-group">
              <label for="concept-input">
                Describe your character concept:
                <span class="required" aria-hidden="true">*</span>
              </label>
              <textarea
                id="concept-input"
                name="characterConcept"
                placeholder="e.g. a ditzy female adventurer who's good with a bow"
                rows="6"
                minlength="10"
                maxlength="1000"
                required
                aria-describedby="concept-help concept-error"
              ></textarea>
              <div id="concept-help" class="input-help">
                Describe your character in a few sentences. Focus on
                personality, background, and key traits.
              </div>
              <div class="input-meta">
                <span class="char-count">0/1000</span>
                <div
                  id="concept-error"
                  class="error-message"
                  role="alert"
                  aria-live="polite"
                ></div>
              </div>
            </div>

            <div class="action-buttons">
              <button
                type="submit"
                id="generate-btn"
                class="primary-button large"
                disabled
              >
                <span class="button-text">Generate Thematic Directions</span>
                <span class="button-loading" style="display: none">
                  <span class="spinner"></span>
                  Generating...
                </span>
              </button>
            </div>
          </form>
        </section>

        <!-- Right Panel: Results Display -->
        <section class="directions-panel">
          <h2>Generated Directions</h2>
          <div id="directions-container">
            <!-- States same as character builder -->
            <!-- Loading, Empty, Error, Results states -->
          </div>
        </section>
      </main>

      <!-- Simplified Footer -->
      <footer class="thematic-direction-footer">
        <div class="footer-content">
          <button type="button" id="back-to-menu-btn" class="secondary-button">
            ← Back to Main Menu
          </button>
          <p class="footer-info">
            Living Narrative Engine - Thematic Direction Generator
          </p>
        </div>
      </footer>
    </div>

    <!-- Modals (simplified) -->
    <div id="help-modal" class="modal" style="display: none" role="dialog">
      <!-- Simplified help content -->
    </div>

    <!-- Scripts -->
    <script src="thematic-direction.js"></script>
  </body>
</html>
```

## JavaScript Architecture

### Entry Point: thematic-direction-main.js

```javascript
/**
 * @file Thematic Direction Generator main entry point
 */

import ConsoleLogger from './logging/consoleLogger.js';
import AppContainer from './dependencyInjection/appContainer.js';
import { configureBaseContainer } from './dependencyInjection/baseContainerConfig.js';
import { tokens } from './dependencyInjection/tokens.js';

class ThematicDirectionApp {
  #logger;
  #controller;
  #initialized = false;

  constructor() {
    this.#logger = new ConsoleLogger('debug');
  }

  async initialize() {
    if (this.#initialized) {
      this.#logger.warn('ThematicDirectionApp: Already initialized');
      return;
    }

    try {
      // Create and configure DI container
      const container = new AppContainer();
      container.register(tokens.ILogger, this.#logger);

      // Configure with character builder services
      await configureBaseContainer(container, {
        includeGameSystems: true,
        includeCharacterBuilder: true,
        logger: this.#logger,
      });

      // Load schemas
      const schemaLoader = container.resolve(tokens.SchemaLoader);
      await schemaLoader.loadAndCompileAllSchemas();

      // Register new controller
      this.#registerThematicDirectionController(container);

      // Initialize LLM
      const llmAdapter = container.resolve(tokens.LLMAdapter);
      await llmAdapter.init({
        llmConfigLoader: container.resolve(tokens.LlmConfigLoader),
      });

      // Get and initialize controller
      this.#controller = container.resolve(tokens.ThematicDirectionController);
      await this.#controller.initialize();

      this.#initialized = true;
      this.#logger.info('ThematicDirectionApp: Successfully initialized');
    } catch (error) {
      this.#logger.error('ThematicDirectionApp: Failed to initialize', error);
      this.#showInitializationError(error);
      throw error;
    }
  }

  #registerThematicDirectionController(container) {
    const registrar = container.getRegistrar();

    registrar.singletonFactory(tokens.ThematicDirectionController, (c) => {
      return new ThematicDirectionController({
        logger: c.resolve(tokens.ILogger),
        characterBuilderService: c.resolve(tokens.CharacterBuilderService),
        eventBus: c.resolve(tokens.ISafeEventDispatcher),
      });
    });
  }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', async () => {
  const app = new ThematicDirectionApp();
  await app.initialize();
});
```

### Controller: ThematicDirectionController

```javascript
/**
 * @file Simplified controller for thematic direction generation
 */

export class ThematicDirectionController {
  #logger;
  #characterBuilderService;
  #eventBus;
  #currentConcept = null;
  #currentDirections = [];
  #elements = {};

  constructor({ logger, characterBuilderService, eventBus }) {
    // Validate dependencies
    this.#logger = logger;
    this.#characterBuilderService = characterBuilderService;
    this.#eventBus = eventBus;
  }

  async initialize() {
    try {
      await this.#characterBuilderService.initialize();
      this.#cacheElements();
      this.#setupEventListeners();
      await this.#loadPreviousConcepts();
      this.#showEmptyState();
    } catch (error) {
      this.#logger.error('Failed to initialize', error);
      this.#showError('Failed to initialize. Please refresh the page.');
    }
  }

  #cacheElements() {
    // Form elements
    this.#elements.form = document.getElementById('concept-form');
    this.#elements.textarea = document.getElementById('concept-input');
    this.#elements.generateBtn = document.getElementById('generate-btn');
    this.#elements.previousConceptsSelect =
      document.getElementById('previous-concepts');

    // State containers
    this.#elements.emptyState = document.getElementById('empty-state');
    this.#elements.loadingState = document.getElementById('loading-state');
    this.#elements.errorState = document.getElementById('error-state');
    this.#elements.resultsState = document.getElementById('directions-results');
  }

  #setupEventListeners() {
    // Form submission
    this.#elements.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.#handleGenerate();
    });

    // Previous concepts dropdown
    this.#elements.previousConceptsSelect.addEventListener('change', (e) => {
      this.#handleConceptSelection(e.target.value);
    });

    // Text input validation
    this.#elements.textarea.addEventListener('input', () => {
      this.#validateInput();
    });
  }

  async #handleGenerate() {
    const conceptText = this.#elements.textarea.value.trim();

    this.#showLoadingState();

    try {
      // Create and store concept
      const concept =
        await this.#characterBuilderService.createCharacterConcept(conceptText);
      this.#currentConcept = concept;

      // Generate directions
      const directions =
        await this.#characterBuilderService.generateThematicDirections(concept);
      this.#currentDirections = directions;

      // Update UI
      this.#showResults(directions);
      await this.#loadPreviousConcepts(); // Refresh dropdown
    } catch (error) {
      this.#logger.error('Failed to generate directions', error);
      this.#showError(
        'Failed to generate thematic directions. Please try again.'
      );
    }
  }

  async #loadPreviousConcepts() {
    try {
      const concepts =
        await this.#characterBuilderService.getAllCharacterConcepts();
      this.#updateConceptsDropdown(concepts);
    } catch (error) {
      this.#logger.error('Failed to load previous concepts', error);
    }
  }
}
```

## CSS Migration Strategy

### thematic-direction.css

The CSS will be migrated from `character-builder.css` with the following changes:

1. **Remove Dark Mode**: Keep only light theme variables
2. **Simplify Layout**: Remove multi-step navigation styles
3. **Retain Core Styles**: Keep form, button, and panel styles
4. **Add Dropdown Styles**: For previous concepts selector

```css
/**
 * Thematic Direction Generator Styles
 * Migrated from character-builder.css - light theme only
 */

/* Container & Layout */
#thematic-direction-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--primary-bg-color); /* Using existing light theme */
  color: var(--primary-text-color);
}

.thematic-direction-header {
  background: var(--secondary-bg-color);
  border-bottom: 2px solid var(--panel-border-color);
  padding: 1.5rem 0;
  text-align: center;
}

.header-subtitle {
  color: var(--secondary-text-color);
  font-size: 1.125rem;
  margin: 0.5rem 0 0 0;
}

/* Main Content Grid */
.thematic-direction-main {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

/* Previous Concepts Dropdown */
.previous-concepts-group {
  margin-bottom: 1.5rem;
}

.concept-select {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid var(--input-border-color);
  border-radius: 8px;
  background: var(--input-bg-color);
  color: var(--input-text-color);
  font-size: 1rem;
}

/* Large Generate Button */
.primary-button.large {
  padding: 1rem 2rem;
  font-size: 1.125rem;
  font-weight: 600;
}

/* Rest of styles migrated from character-builder.css */
```

## Data Flow & Storage

### Automatic Concept Storage

When generating directions:

1. **User Input** → Concept text entered
2. **Generate Click** → Create concept in database immediately
3. **Store Concept** → Get concept ID from storage
4. **Generate Directions** → Call LLM with concept
5. **Store Directions** → Save with conceptId reference
6. **Update UI** → Display results and refresh dropdown

### Database Schema (Existing)

```javascript
// CharacterConcept
{
  id: 'uuid',
  conceptText: 'string',
  status: 'draft|active|archived',
  createdAt: 'timestamp',
  updatedAt: 'timestamp'
}

// ThematicDirection
{
  id: 'uuid',
  conceptId: 'uuid', // Links to CharacterConcept
  title: 'string',
  narrative: 'string',
  themes: ['string'],
  createdAt: 'timestamp'
}
```

## Implementation Phases

### Phase 1: Foundation (2-3 hours)

- [ ] Create `thematic-direction-generator.html`
- [ ] Create `thematic-direction-main.js` entry point
- [ ] Set up build configuration in package.json
- [ ] Create basic CSS file structure

### Phase 2: Controller Development (3-4 hours)

- [ ] Create `ThematicDirectionController` class
- [ ] Implement form handling and validation
- [ ] Add previous concepts dropdown functionality
- [ ] Integrate with existing services

### Phase 3: CSS Migration (2 hours)

- [ ] Migrate styles from character-builder.css
- [ ] Remove dark mode references
- [ ] Add dropdown styling
- [ ] Simplify layout styles

### Phase 4: Integration Testing (2 hours)

- [ ] Test concept storage workflow
- [ ] Verify direction generation
- [ ] Test previous concepts loading
- [ ] Validate error handling

### Phase 5: Cleanup & Polish (1 hour)

- [ ] Remove unused code
- [ ] Add proper error messages
- [ ] Final UI adjustments
- [ ] Documentation updates

## Build Configuration

Update `package.json` build script:

```json
{
  "scripts": {
    "build": "... && esbuild src/thematic-direction-main.js --bundle --outfile=dist/thematic-direction.js --platform=browser --sourcemap && cpy thematic-direction-generator.html dist"
  }
}
```

## Token Additions

Add to `tokens.js`:

```javascript
export const tokens = {
  // ... existing tokens
  ThematicDirectionController: Symbol('ThematicDirectionController'),
};
```

## Risk Mitigation

### Identified Risks

1. **Code Duplication**
   - Mitigation: Create shared utilities where needed
   - Keep controller logic minimal

2. **Service Compatibility**
   - Mitigation: Use only tested service methods
   - No modifications to existing services

3. **Data Migration**
   - Mitigation: Use existing database schema
   - No breaking changes to data structure

4. **User Confusion**
   - Mitigation: Clear UI labeling
   - Intuitive workflow design

## Success Criteria

1. **Functional Requirements**
   - ✓ Generate directions from concepts
   - ✓ Auto-save concepts to database
   - ✓ Load previous concepts
   - ✓ Maintain concept-direction associations

2. **Technical Requirements**
   - ✓ Reuse existing services
   - ✓ No dark mode CSS
   - ✓ Single-page architecture
   - ✓ Proper error handling

3. **User Experience**
   - ✓ Simplified workflow
   - ✓ Quick concept switching
   - ✓ Clear feedback messages
   - ✓ Responsive design

## Conclusion

This migration creates a focused, single-purpose tool for thematic direction generation while maximizing code reuse from the existing character builder. The simplified architecture removes complexity while maintaining all core functionality needed for the creative process.

The implementation follows Living Narrative Engine's established patterns and integrates seamlessly with existing infrastructure, ensuring maintainability and consistency across the application.
