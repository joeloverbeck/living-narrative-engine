# Speech Patterns Generator - Feature Specification

## ⚠️ Implementation Status

**IMPORTANT: This describes planned functionality that has NOT been implemented.**

| Component | Status | Notes |
|-----------|--------|-------|
| HTML Page | ❌ Not Implemented | `speech-patterns-generator.html` does not exist |
| Controller | ❌ Not Implemented | `SpeechPatternsGeneratorController.js` does not exist |
| Display Service | ❌ Not Implemented | `SpeechPatternsDisplayEnhancer.js` does not exist |
| CSS Styles | ❌ Not Implemented | `css/speech-patterns-generator.css` does not exist |
| Index Integration | ❌ Not Implemented | No button in index.html |
| Build Config | ❌ Not Implemented | No entry point in build system |
| Component Schema | ✅ Exists | `data/mods/core/components/speech_patterns.component.json` |
| Requirements Doc | ✅ Exists | `reports/speech-patterns-generator.md` |

**This specification serves as an implementation guide for future development.**

## Implementation Roadmap

### Phase 1: Foundation Setup
1. Create basic HTML structure (`speech-patterns-generator.html`)
2. Set up CSS file (`css/speech-patterns-generator.css`) with base styling
3. Add button to index.html and navigation handler
4. Configure build system entry point

### Phase 2: Core Implementation
1. Implement `SpeechPatternsGeneratorController.js` with input validation
2. Create `SpeechPatternsDisplayEnhancer.js` for display formatting
3. Implement LLM prompt generation and service integration
4. Create response schema and validation (`data/schemas/speech-patterns-response.schema.json`)

### Phase 3: Polish & Testing
1. Complete UI styling and responsive design
2. Implement keyboard shortcuts and accessibility features
3. Add comprehensive test coverage (unit, integration, e2e)
4. Performance optimization and error handling

### Phase 4: Enhancement
1. Export functionality implementation
2. Advanced validation and error messaging
3. Loading states and user feedback
4. Integration with existing character builder ecosystem

### Dependencies
- ✅ **CharacterBuilderBootstrap**: Already exists for unified initialization
- ✅ **BaseCharacterBuilderController**: Already exists for common functionality
- ✅ **LLM Service**: Already integrated in other character builders
- ✅ **Component Schema**: `speech_patterns.component.json` already exists
- ❌ **Page Implementation**: All page-specific components need to be built

## Overview

This specification describes a planned Character Builder page that would generate distinctive speech patterns for characters based on their complete persona. Unlike other generators that require thematic direction selection, this planned tool would accept a JSON character definition directly and produce ~20 unique speech pattern examples with character voice snippets.

## Planned Requirements Summary

- **Input**: Single textarea for JSON character definition
- **Output**: ~20 speech pattern examples with character voice snippets and circumstance indicators  
- **Content Policy**: NC-21 (Adults Only) content guidelines used verbatim
- **Export**: Text export functionality (no permanent storage)
- **Integration**: New button in index.html after existing Character Builder tools

## Proposed Architecture

### Planned File Structure

```
/
├── speech-patterns-generator.html          # 🔄 Planned: Main HTML page
├── src/
│   ├── speech-patterns-generator-main.js   # 🔄 Planned: Entry point and bootstrap
│   └── characterBuilder/
│       ├── controllers/
│       │   └── SpeechPatternsGeneratorController.js  # 🔄 Planned: Page controller
│       └── services/
│           └── SpeechPatternsDisplayEnhancer.js      # 🔄 Planned: Display service
├── css/
│   └── speech-patterns-generator.css       # 🔄 Planned: Page-specific styles
├── data/
│   ├── mods/core/components/
│   │   └── speech_patterns.component.json  # ✅ Exists: Component schema
│   └── schemas/
│       └── speech-patterns-response.schema.json  # 🔄 Planned: Response validation
└── specs/
    └── speech-patterns-generator.spec.md   # ✅ Exists: This specification
```

### Dependencies and Reuse Strategy

**Existing Components to Leverage:**
- `CharacterBuilderBootstrap` - Unified initialization system
- `BaseCharacterBuilderController` - Common controller functionality
- Character builder CSS classes and layouts
- Event system and error handling patterns
- LLM service integration and prompt system

**New Components to Implement:**
- `SpeechPatternsGeneratorController` - Would handle page-specific controller logic
- `SpeechPatternsDisplayEnhancer` - Would format results for display and export
- Page-specific HTML template and CSS customizations

## Planned HTML Structure

### Proposed Page Layout (`speech-patterns-generator.html`)

**Status**: ❌ Not Implemented - This HTML structure would need to be created.

```html
<!doctype html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="Generate unique speech patterns for your character based on their complete persona" />
    <title>Speech Patterns Generator - Living Narrative Engine</title>
    
    <!-- Reuse existing character builder styles -->
    <link rel="stylesheet" href="css/style.css" />
    <link rel="stylesheet" href="css/components.css" />
    <link rel="stylesheet" href="css/speech-patterns-generator.css" />
    
    <!-- Standard favicon links (matching other pages) -->
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
    <link rel="manifest" href="/site.webmanifest" />
    
    <script type="module" src="speech-patterns-generator.js"></script>
</head>
<body>
    <!-- Skip link for accessibility -->
    <a href="#main-content" class="skip-link">Skip to main content</a>
    
    <div id="app" class="cb-page-container">
        <!-- Header Section -->
        <header class="cb-page-header">
            <div class="header-content">
                <h1>Speech Patterns Generator</h1>
                <p class="header-subtitle">
                    Generate unique speech patterns for your character based on their complete persona
                </p>
            </div>
        </header>

        <!-- Main Content Area -->
        <main id="main-content" class="cb-page-main speech-patterns-main">
            <!-- Left Panel: Character Input -->
            <aside class="cb-input-panel character-input-panel">
                <h2 class="cb-panel-title">Character Definition</h2>
                
                <!-- Content Guidelines Notice -->
                <div class="content-guidelines-notice">
                    <div class="notice-header">
                        <span class="notice-icon">⚠️</span>
                        <strong>Content Guidelines: NC-21 (Adults Only)</strong>
                    </div>
                    <p class="notice-text">
                        This application is for mature users. All topics, themes, and content are permissible 
                        if they serve authentic character portrayal, however dark, explicit, or controversial.
                    </p>
                </div>

                <!-- Character Input Section -->
                <div class="character-input-section">
                    <label for="character-definition" class="input-label">
                        Character Definition (JSON)
                    </label>
                    <p class="input-description">
                        Paste your complete character definition in JSON format. The generator will analyze 
                        their personality, background, and traits to create distinctive speech patterns.
                    </p>
                    
                    <textarea
                        id="character-definition"
                        class="character-definition-input"
                        placeholder="Paste your character JSON definition here..."
                        rows="20"
                        aria-label="Character definition in JSON format"
                        aria-describedby="character-input-help"
                    ></textarea>
                    
                    <div id="character-input-help" class="input-help">
                        <p>Expected format: Complete character entity with components like core:name, 
                        core:personality, core:profile, etc.</p>
                    </div>
                    
                    <!-- Validation Error Display -->
                    <div id="character-input-error" class="cb-error-message" style="display: none" role="alert">
                        <!-- Error messages will be inserted here -->
                    </div>
                </div>

                <!-- Generation Controls -->
                <div class="generation-controls">
                    <button
                        id="generate-btn"
                        class="cb-button cb-button-primary"
                        disabled
                        aria-label="Generate speech patterns"
                    >
                        <span class="button-icon">🎭</span>
                        <span class="button-text">Generate Speech Patterns</span>
                    </button>

                    <!-- Keyboard Shortcuts Help -->
                    <div class="shortcut-hint">
                        <div><kbd>Ctrl</kbd> + <kbd>Enter</kbd> to generate</div>
                        <div><kbd>Ctrl</kbd> + <kbd>E</kbd> to export</div>
                        <div><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Del</kbd> to clear</div>
                        <div><kbd>Esc</kbd> to close dialogs</div>
                    </div>
                </div>
            </aside>

            <!-- Right Panel: Results Display -->
            <section class="cb-output-panel speech-patterns-display-panel">
                <div class="cb-panel-header">
                    <h2 class="cb-panel-title">Generated Speech Patterns</h2>
                    <div class="panel-actions">
                        <button
                            id="clear-all-btn"
                            class="cb-button cb-button-danger"
                            disabled
                            aria-label="Clear character input and results"
                        >
                            <span class="button-icon">🗑️</span>
                            <span class="button-text">Clear All</span>
                        </button>
                        <button
                            id="export-btn"
                            class="cb-button cb-button-secondary"
                            disabled
                            aria-label="Export speech patterns to text file"
                        >
                            <span class="button-icon">📄</span>
                            <span class="button-text">Export</span>
                        </button>
                    </div>
                </div>

                <!-- Loading Indicator -->
                <div id="loading-indicator" class="loading-indicator" style="display: none" role="status" aria-live="polite">
                    <div class="spinner" aria-hidden="true"></div>
                    <p id="loading-message">Generating speech patterns...</p>
                </div>

                <!-- Speech Patterns Results Container -->
                <div id="speech-patterns-container" class="speech-patterns-container" role="region" aria-label="Generated speech patterns">
                    <!-- Speech pattern results will be dynamically added here -->
                </div>

                <!-- Empty State -->
                <div id="empty-state" class="empty-state">
                    <div class="empty-state-icon">🎭</div>
                    <p class="empty-state-text">
                        Paste a character definition and click "Generate Speech Patterns" to begin
                    </p>
                    <p class="empty-state-subtext">
                        The generator will create ~20 unique speech patterns with character voice examples
                    </p>
                </div>
            </section>
        </main>

        <!-- Footer -->
        <footer class="cb-page-footer">
            <nav class="footer-navigation">
                <button id="back-btn" class="cb-button cb-button-navigation" aria-label="Back to Main Menu">
                    ← Back to Main Menu
                </button>
            </nav>
            
            <div class="footer-info">
                <span class="pattern-count" id="pattern-count">0 patterns generated</span>
            </div>
        </footer>

        <!-- Screen Reader Announcements -->
        <div id="screen-reader-announcement" class="screen-reader-only" aria-live="polite" aria-atomic="true">
            <!-- Dynamic announcements for screen readers -->
        </div>
    </div>
</body>
</html>
```

## Planned Controller Implementation

### SpeechPatternsGeneratorController

**Status**: ❌ Not Implemented  
**Planned File**: `src/characterBuilder/controllers/SpeechPatternsGeneratorController.js`

This controller would need to be created with the following structure:

```javascript
/**
 * @file Speech patterns generator controller for character building
 * @description Manages UI for speech pattern generation based on character definitions
 * @see BaseCharacterBuilderController.js
 */

import { BaseCharacterBuilderController } from './BaseCharacterBuilderController.js';
import { DomUtils } from '../../utils/domUtils.js';
import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * Controller for speech patterns generator interface
 * Handles character input validation, generation workflow, and results display
 */
export class SpeechPatternsGeneratorController extends BaseCharacterBuilderController {
    // Dependencies
    /** @private @type {SpeechPatternsDisplayEnhancer} */
    #displayEnhancer;

    // UI State
    /** @private @type {object|null} */
    #characterDefinition = null;
    
    /** @private @type {Array<object>|null} */
    #lastGeneratedPatterns = null;

    /**
     * Create a new SpeechPatternsGeneratorController instance
     * @param {object} dependencies - Service dependencies
     */
    constructor(dependencies) {
        super(dependencies);
        
        validateDependency(dependencies.speechPatternsDisplayEnhancer, 'SpeechPatternsDisplayEnhancer', null, {
            requiredMethods: ['enhanceForDisplay', 'formatForExport', 'generateExportFilename']
        });
        
        this.#displayEnhancer = dependencies.speechPatternsDisplayEnhancer;
    }

    /**
     * Cache DOM elements specific to speech patterns generation
     * @protected
     */
    _cacheElements() {
        this._cacheElementsFromMap({
            // Input elements
            characterDefinition: '#character-definition',
            characterInputError: '#character-input-error',
            
            // Controls
            generateBtn: '#generate-btn',
            exportBtn: '#export-btn',
            clearBtn: '#clear-all-btn',
            backBtn: '#back-btn',
            
            // Display elements
            speechPatternsContainer: '#speech-patterns-container',
            loadingIndicator: '#loading-indicator',
            loadingMessage: '#loading-message',
            emptyState: '#empty-state',
            patternCount: '#pattern-count',
            
            // Screen reader support
            screenReaderAnnouncement: {
                selector: '#screen-reader-announcement',
                required: false
            }
        });
    }

    /**
     * Set up event listeners for speech patterns generation UI
     * @protected
     */
    _setupEventListeners() {
        // Character input validation
        if (this._getElement('characterDefinition')) {
            this._addEventListener('characterDefinition', 'input', () => {
                this.#handleCharacterInput();
            });
            
            this._addEventListener('characterDefinition', 'blur', () => {
                this.#validateCharacterInput();
            });
        }

        // Generate button
        if (this._getElement('generateBtn')) {
            this._addEventListener('generateBtn', 'click', () => {
                this.#generateSpeechPatterns();
            });
        }

        // Export button  
        if (this._getElement('exportBtn')) {
            this._addEventListener('exportBtn', 'click', () => {
                this.#exportToText();
            });
        }

        // Clear button
        if (this._getElement('clearBtn')) {
            this._addEventListener('clearBtn', 'click', () => {
                this.#clearAll();
            });
        }

        // Back button
        if (this._getElement('backBtn')) {
            this._addEventListener('backBtn', 'click', () => {
                window.location.href = 'index.html';
            });
        }

        // Keyboard shortcuts
        this.#setupKeyboardShortcuts();
    }

    /**
     * Load initial data (minimal for this generator)
     * @protected  
     */
    async _loadInitialData() {
        // No initial data loading required for this generator
        this.logger.debug('Speech patterns generator initialized - no initial data required');
    }

    /**
     * Initialize UI state
     * @protected
     */
    async _initializeUIState() {
        await super._initializeUIState();
        
        // Set initial empty state
        this._showState('empty');
        this.#updateUIState();
    }

    // Implementation methods would continue here...
    // Including input validation, generation workflow, display rendering, etc.
}
```

### Key Controller Methods

The planned controller would need to implement these core methods:

1. **Input Handling**:
   - `#handleCharacterInput()` - Process character definition changes
   - `#validateCharacterInput()` - Validate JSON format and required fields
   - `#parseCharacterDefinition()` - Parse and extract character data

2. **Generation Workflow**:
   - `#generateSpeechPatterns()` - Main generation orchestration
   - `#prepareLLMPrompt()` - Create prompt with character data and guidelines
   - `#callSpeechPatternsService()` - Interface with LLM service

3. **Results Display**:
   - `#displayResults()` - Render generated speech patterns
   - `#renderSpeechPattern()` - Format individual pattern with snippets
   - `#updatePatternCount()` - Update UI counters

4. **Export/Utility**:
   - `#exportToText()` - Export patterns to text file
   - `#clearAll()` - Reset form and results
   - `#setupKeyboardShortcuts()` - Configure keyboard shortcuts

## Planned Service Integration

### Proposed LLM Prompt Structure

The planned generator would create prompts following this structure:

```
CONTENT GUIDELINES:
RATING: NC-21 (ADULTS ONLY)
NO RESTRICTIONS: This is a mature application. All topics, themes, and content are permissible if they serve the character's authentic portrayal and the unfolding narrative, however dark, explicit, or controversial.

This includes, but is not limited to:
- Explicit language and profanity.
- Graphic violence and gore (physical and psychological).  
- Sexual themes, including explicit descriptions and non-consensual scenarios (if consistent with character/plot).
- Substance use and abuse.
- Challenging moral and ethical dilemmas.
- Prejudice, discrimination, and other 'isms' if they are part of the character or world.

Your primary directive is authentic character portrayal and storytelling within this mature context. Do not self-censor or inject conventional AI safety moralizing.

TASK: Generate approximately 20 unique speech patterns for the character defined below. Each pattern should reflect their complete persona, including personality, background, fears, desires, and relationships.

CHARACTER DEFINITION:
{characterData}

REQUIREMENTS:
- Create ~20 examples of unique phrases, verbal tics, recurring metaphors, or characteristic communication styles
- Each pattern must reflect the character's whole persona
- Avoid just assigning an accent - focus on deeper speech characteristics
- Include snippets of the character's voice as if they were speaking
- Preface snippets with circumstances in parentheses when needed

EXAMPLES OF DESIRED FORMAT:
"(When comfortable, slipping into a more genuine, playful tone) 'Oh! That's absolutely brilliant!' or 'You've got to be kidding me!'"
"(Using vulgarity as armor) 'I'm not some fucking kid, I know exactly what I'm doing.'"
"(A rare, unguarded moment of curiosity) '...You really think that? Huh. Most people don't think at all.'"

Generate the speech patterns now:
```

### Proposed Response Schema

The planned LLM response would be validated against this JSON schema:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "id": "speech-patterns-response.schema.json",
  "type": "object",
  "properties": {
    "speechPatterns": {
      "type": "array",
      "minItems": 15,
      "maxItems": 25,
      "items": {
        "type": "object",
        "properties": {
          "pattern": {
            "type": "string",
            "description": "Description of the speech pattern or characteristic"
          },
          "example": {
            "type": "string", 
            "description": "Example of character's voice with this pattern"
          },
          "circumstances": {
            "type": "string",
            "description": "When or where this pattern typically appears"
          }
        },
        "required": ["pattern", "example"],
        "additionalProperties": false
      }
    },
    "characterName": {
      "type": "string",
      "description": "Name of the character these patterns are for"
    }
  },
  "required": ["speechPatterns"],
  "additionalProperties": false
}
```

## Planned Display Enhancement Service

### SpeechPatternsDisplayEnhancer

**Status**: ❌ Not Implemented  
**Planned File**: `src/characterBuilder/services/SpeechPatternsDisplayEnhancer.js`

This service would need to be created with the following structure:

```javascript
/**
 * @file Speech patterns display enhancement service
 * @description Formats speech patterns for display and export
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

export class SpeechPatternsDisplayEnhancer {
    /** @private @type {ILogger} */
    #logger;

    constructor(dependencies) {
        validateDependency(dependencies.logger, 'ILogger');
        this.#logger = dependencies.logger;
    }

    /**
     * Enhance speech patterns for display
     * @param {object} patterns - Raw patterns from LLM
     * @param {object} options - Display options
     * @returns {object} Enhanced patterns for display
     */
    enhanceForDisplay(patterns, options = {}) {
        // Format patterns with HTML-safe content and improved structure
        return {
            patterns: patterns.speechPatterns.map((pattern, index) => ({
                id: `pattern-${index + 1}`,
                index: index + 1,
                pattern: pattern.pattern,
                example: pattern.example,
                circumstances: pattern.circumstances || null,
                htmlSafeExample: this.#escapeHtml(pattern.example),
                htmlSafePattern: this.#escapeHtml(pattern.pattern)
            })),
            characterName: patterns.characterName || 'Character',
            totalCount: patterns.speechPatterns.length
        };
    }

    /**
     * Format patterns for text export
     * @param {object} patterns - Generated patterns  
     * @param {object} options - Export options
     * @returns {string} Formatted text for export
     */
    formatForExport(patterns, options = {}) {
        const timestamp = new Date().toISOString();
        const characterName = patterns.characterName || 'Character';
        
        let exportText = `SPEECH PATTERNS FOR ${characterName.toUpperCase()}\n`;
        exportText += `Generated: ${timestamp}\n`;
        exportText += `Total Patterns: ${patterns.speechPatterns.length}\n\n`;
        
        patterns.speechPatterns.forEach((pattern, index) => {
            exportText += `${index + 1}. ${pattern.pattern}\n`;
            if (pattern.circumstances) {
                exportText += `   Context: ${pattern.circumstances}\n`;
            }
            exportText += `   Example: ${pattern.example}\n\n`;
        });

        if (options.includeCharacterData && options.characterDefinition) {
            exportText += '\n---\nCHARACTER DEFINITION:\n';
            exportText += JSON.stringify(options.characterDefinition, null, 2);
        }
        
        return exportText;
    }

    /**
     * Generate filename for export
     * @param {string} characterName - Character name
     * @returns {string} Export filename
     */
    generateExportFilename(characterName = 'Character') {
        const sanitized = characterName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        const timestamp = new Date().toISOString().slice(0, 10);
        return `speech_patterns_${sanitized}_${timestamp}.txt`;
    }

    /**
     * Escape HTML for safe display
     * @private
     * @param {string} text
     * @returns {string}
     */
    #escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
```

## Planned CSS Styling

### Proposed Page-Specific Styles (`css/speech-patterns-generator.css`)

**Status**: ❌ Not Implemented - This CSS file would need to be created.

```css
/* Speech Patterns Generator Specific Styles */

.speech-patterns-main {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
    min-height: calc(100vh - var(--header-height) - var(--footer-height));
}

/* Character Input Panel */
.character-input-panel {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

.content-guidelines-notice {
    background: var(--warning-bg-color, #fff3cd);
    border: 1px solid var(--warning-border-color, #ffeaa7);
    border-radius: 6px;
    padding: 1rem;
    margin-bottom: 1rem;
}

.notice-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 600;
    color: var(--warning-text-color, #856404);
    margin-bottom: 0.5rem;
}

.notice-text {
    font-size: 0.9rem;
    color: var(--warning-text-color, #856404);
    margin: 0;
    line-height: 1.4;
}

/* Character Input Section */
.character-input-section {
    flex: 1;
    display: flex;
    flex-direction: column;
}

.input-label {
    font-weight: 600;
    margin-bottom: 0.5rem;
    color: var(--primary-text-color);
}

.input-description {
    font-size: 0.9rem;
    color: var(--secondary-text-color);
    margin-bottom: 1rem;
    line-height: 1.4;
}

.character-definition-input {
    flex: 1;
    min-height: 400px;
    padding: 1rem;
    border: 2px solid var(--border-color);
    border-radius: 8px;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 0.875rem;
    line-height: 1.4;
    resize: vertical;
    background: var(--input-bg-color, #ffffff);
    color: var(--primary-text-color);
    transition: border-color 0.2s ease;
}

.character-definition-input:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px var(--primary-color-alpha);
}

.character-definition-input.error {
    border-color: var(--error-color);
}

.input-help {
    margin-top: 0.5rem;
}

.input-help p {
    font-size: 0.8rem;
    color: var(--secondary-text-color);
    margin: 0;
    line-height: 1.3;
}

/* Speech Patterns Display */
.speech-patterns-container {
    max-height: 70vh;
    overflow-y: auto;
    padding-right: 0.5rem;
}

.speech-patterns-results {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

.results-header {
    text-align: center;
    margin-bottom: 2rem;
    padding-bottom: 1rem;
    border-bottom: 2px solid var(--border-color);
}

.results-header h2 {
    color: var(--primary-color);
    margin-bottom: 0.5rem;
}

.results-subtitle {
    color: var(--secondary-text-color);
    font-style: italic;
}

/* Individual Speech Pattern Display */
.speech-pattern-item {
    background: var(--card-bg-color, #ffffff);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1.5rem;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.speech-pattern-item:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px var(--shadow-color, rgba(0, 0, 0, 0.1));
}

.pattern-number {
    display: inline-block;
    background: var(--primary-color);
    color: white;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    text-align: center;
    line-height: 32px;
    font-size: 0.9rem;
    font-weight: 600;
    margin-bottom: 1rem;
}

.pattern-description {
    font-size: 1rem;
    color: var(--primary-text-color);
    margin-bottom: 1rem;
    font-weight: 500;
    line-height: 1.5;
}

.pattern-example {
    background: var(--code-bg-color, #f8f9fa);
    border-left: 4px solid var(--accent-color, #6c757d);
    padding: 1rem;
    border-radius: 4px;
    font-style: italic;
    color: var(--secondary-text-color);
    margin-bottom: 0.5rem;
}

.pattern-circumstances {
    font-size: 0.85rem;
    color: var(--tertiary-text-color);
    margin-top: 0.5rem;
}

.pattern-circumstances::before {
    content: "Context: ";
    font-weight: 600;
}

/* Responsive Design */
@media (max-width: 1024px) {
    .speech-patterns-main {
        grid-template-columns: 1fr;
        gap: 1.5rem;
    }
    
    .character-definition-input {
        min-height: 300px;
    }
}

@media (max-width: 768px) {
    .speech-patterns-main {
        gap: 1rem;
        padding: 1rem;
    }
    
    .character-definition-input {
        min-height: 250px;
        font-size: 0.8rem;
    }
    
    .speech-pattern-item {
        padding: 1rem;
    }
}

/* Loading and Empty States */
.loading-indicator {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    text-align: center;
}

.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    text-align: center;
    color: var(--secondary-text-color);
}

.empty-state-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
    opacity: 0.5;
}

.empty-state-text {
    font-size: 1.2rem;
    margin-bottom: 0.5rem;
    color: var(--primary-text-color);
}

.empty-state-subtext {
    font-size: 0.9rem;
    line-height: 1.4;
}
```

## Planned Bootstrap Integration

### Proposed Entry Point (`src/speech-patterns-generator-main.js`)

**Status**: ❌ Not Implemented - This entry point would need to be created.

```javascript
/**
 * @file Entry point for Speech Patterns Generator
 * @description Bootstrap the speech patterns generator page
 */

import { CharacterBuilderBootstrap } from './characterBuilder/CharacterBuilderBootstrap.js';
import { SpeechPatternsGeneratorController } from './characterBuilder/controllers/SpeechPatternsGeneratorController.js';
import { SpeechPatternsDisplayEnhancer } from './characterBuilder/services/SpeechPatternsDisplayEnhancer.js';

/**
 * Initialize the speech patterns generator page
 */
async function initializeSpeechPatternsGenerator() {
    try {
        const bootstrap = new CharacterBuilderBootstrap();
        
        const config = {
            pageName: 'Speech Patterns Generator',
            controllerClass: SpeechPatternsGeneratorController,
            includeModLoading: false, // No mod data needed
            
            // Page-specific services
            services: {
                speechPatternsDisplayEnhancer: SpeechPatternsDisplayEnhancer
            },
            
            // Custom schemas for validation
            customSchemas: [
                '/data/schemas/speech-patterns-response.schema.json'
            ],
            
            // Error display configuration
            errorDisplay: {
                elementId: 'character-input-error',
                displayDuration: 8000,
                dismissible: true
            }
        };
        
        const result = await bootstrap.bootstrap(config);
        
        // Page successfully initialized
        console.log(`Speech Patterns Generator initialized in ${result.bootstrapTime.toFixed(2)}ms`);
        
    } catch (error) {
        console.error('Failed to initialize Speech Patterns Generator:', error);
        
        // Show user-friendly error
        document.body.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: var(--error-color, #d32f2f);">
                <h1>⚠️ Initialization Failed</h1>
                <p>The Speech Patterns Generator could not be started.</p>
                <p>Please refresh the page or <a href="index.html">return to the main menu</a>.</p>
                <details style="margin-top: 1rem; text-align: left; max-width: 600px; margin-left: auto; margin-right: auto;">
                    <summary>Technical Details</summary>
                    <pre style="background: #f5f5f5; padding: 1rem; border-radius: 4px; overflow-x: auto;">${error.message}</pre>
                </details>
            </div>
        `;
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSpeechPatternsGenerator);
} else {
    initializeSpeechPatternsGenerator();
}
```

## Planned Index.html Integration

### Proposed Button Addition

**Status**: ❌ Not Implemented - This button would need to be added to the Character Building section in `index.html` after the existing buttons:

```html
<!-- Add after the traits-generator-button -->
<button
    id="speech-patterns-generator-button" 
    class="menu-button nav-button nav-button--character nav-button--orange"
>
    <span class="button-icon" aria-hidden="true">💬</span>
    <span class="button-text">Speech Patterns Generator</span>
</button>
```

### Proposed JavaScript Event Handler

**Status**: ❌ Not Implemented - This would need to be added to the existing script section in `index.html`:

```javascript
document.getElementById('speech-patterns-generator-button')
    .addEventListener('click', () => {
        window.location.href = 'speech-patterns-generator.html';
    });
```

## Planned Build Configuration

### Proposed esbuild Integration

**Status**: ❌ Not Implemented - This entry point would need to be added to the build configuration:

```javascript
// In build configuration
{
    entryPoints: [
        // ... existing entry points
        'src/speech-patterns-generator-main.js'
    ],
    outdir: 'dist/',
    // ... other build options
}
```

The built file would be `dist/speech-patterns-generator.js` and would be loaded by the HTML page.

## Planned JSON Schema Definition

### Proposed Speech Patterns Response Schema

**Status**: ❌ Not Implemented  
**Planned File**: `data/schemas/speech-patterns-response.schema.json`

This schema would need to be created for response validation:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "id": "schema://living-narrative-engine/speech-patterns-response.schema.json",
  "title": "Speech Patterns Response Schema",
  "description": "Validates the response from LLM for speech patterns generation",
  "type": "object",
  "properties": {
    "speechPatterns": {
      "type": "array",
      "description": "Array of generated speech patterns for the character",
      "minItems": 15,
      "maxItems": 30,
      "items": {
        "$ref": "#/definitions/SpeechPattern"
      }
    },
    "characterName": {
      "type": "string",
      "description": "Name of the character these patterns are for",
      "minLength": 1,
      "maxLength": 100
    },
    "generatedAt": {
      "type": "string",
      "format": "date-time",
      "description": "ISO 8601 timestamp of when patterns were generated"
    }
  },
  "required": ["speechPatterns"],
  "additionalProperties": false,
  "definitions": {
    "SpeechPattern": {
      "type": "object",
      "description": "Individual speech pattern with example and context",
      "properties": {
        "pattern": {
          "type": "string",
          "description": "Description of the speech pattern or characteristic",
          "minLength": 10,
          "maxLength": 500
        },
        "example": {
          "type": "string", 
          "description": "Example of character's voice demonstrating this pattern",
          "minLength": 5,
          "maxLength": 1000
        },
        "circumstances": {
          "type": "string",
          "description": "Optional context for when this pattern appears",
          "maxLength": 200
        }
      },
      "required": ["pattern", "example"],
      "additionalProperties": false
    }
  }
}
```

## Testing Strategy

### Unit Tests Required

1. **Controller Tests** (`tests/unit/characterBuilder/controllers/SpeechPatternsGeneratorController.test.js`)
   - Input validation and parsing
   - UI state management
   - Event handling
   - Error scenarios

2. **Display Enhancer Tests** (`tests/unit/characterBuilder/services/SpeechPatternsDisplayEnhancer.test.js`)
   - Format for display
   - Export formatting 
   - Filename generation
   - HTML escaping

3. **Integration Tests** (`tests/integration/characterBuilder/speechPatternsGenerator.integration.test.js`)
   - End-to-end generation workflow
   - LLM service integration
   - Schema validation
   - Bootstrap initialization

### Test Data

Create test fixtures with sample character definitions and expected speech pattern responses for consistent testing.

## Accessibility Compliance

### WCAG 2.1 AA Requirements

1. **Keyboard Navigation**
   - All interactive elements accessible via keyboard
   - Focus indicators clearly visible
   - Logical tab order

2. **Screen Reader Support**
   - Proper ARIA labels and descriptions
   - Live regions for dynamic content updates
   - Semantic HTML structure

3. **Visual Design**
   - Sufficient color contrast ratios
   - Text scalable to 200% without horizontal scrolling
   - Focus indicators meet minimum size requirements

4. **Form Accessibility**
   - Labels associated with form controls
   - Error messages linked to relevant inputs
   - Clear instructions and help text

## Performance Considerations

1. **Efficient Rendering**
   - Virtualization for large pattern lists
   - Debounced input validation
   - Optimized DOM updates

2. **Memory Management**
   - Cleanup of event listeners on navigation
   - Efficient data structures
   - Proper disposal of resources

3. **Loading States**
   - Progressive loading indicators
   - Graceful handling of slow responses
   - User feedback during processing

## Security Considerations

1. **Input Validation**
   - JSON parsing with error handling
   - Schema validation of character definitions
   - Sanitization of user input for display

2. **Content Security**
   - HTML escaping for all user content
   - Safe handling of potentially malicious JSON
   - XSS prevention in dynamic content

3. **Data Privacy**
   - No permanent storage of character data
   - Client-side processing where possible
   - Secure transmission to LLM services

## Error Handling

### Error Categories

1. **Input Validation Errors**
   - Invalid JSON format
   - Missing required character components
   - Malformed character definition structure

2. **Service Errors**
   - LLM service unavailable
   - Network connectivity issues
   - Response validation failures

3. **System Errors**
   - Bootstrap initialization failures
   - Missing dependencies
   - Configuration issues

### User Experience

- Clear, actionable error messages
- Graceful degradation when services are unavailable
- Recovery suggestions and retry mechanisms
- Proper error state management in UI

## Future Enhancements

### Potential Extensions

1. **Pattern Categories**
   - Group patterns by emotion, formality, situation
   - Filtering and sorting options

2. **Character Analysis**
   - Automatic extraction of key personality traits
   - Suggestions for speech pattern categories

3. **Integration Features**
   - Direct integration with other character builders
   - Import/export to game engine character format

4. **Advanced Configuration**
   - Customizable pattern count
   - Style and tone preferences
   - Cultural and linguistic considerations

---

## Summary

This specification provides a complete implementation guide for the **planned** Speech Patterns Generator that would maximize code reuse from existing Character Builder infrastructure while meeting all the specific requirements outlined in the original feature request in `reports/speech-patterns-generator.md`.

### Current Reality Check
- **No implementation exists** - all described functionality would need to be built from scratch
- **Existing foundation** - Character Builder infrastructure and component schema provide a solid base
- **Implementation ready** - This specification provides detailed guidance for development
- **Testing required** - Comprehensive test coverage would be needed for all new components

### Next Steps for Implementation
1. Review this specification against current project architecture
2. Validate technical approach with existing character builder patterns
3. Begin with Phase 1: Foundation Setup as outlined in the Implementation Roadmap
4. Create test plans based on the testing strategy section
5. Implement incrementally following the specified architecture

This document serves as the definitive guide for implementing the Speech Patterns Generator feature in the Living Narrative Engine.