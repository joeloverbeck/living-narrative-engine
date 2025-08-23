# TRAITSGEN-005: Create Traits Generator Controller

## Ticket Overview

- **Epic**: Traits Generator Implementation
- **Type**: UI/Controller Layer
- **Priority**: High
- **Estimated Effort**: 2.5 days
- **Dependencies**: 
  - ✅ Trait Model (`src/characterBuilder/models/trait.js`)
  - ✅ TraitsGenerator Service (`src/characterBuilder/services/TraitsGenerator.js`)
  - ✅ TraitsDisplayEnhancer Service (`src/characterBuilder/services/TraitsDisplayEnhancer.js`)
  - ❌ **BLOCKING**: TRAITSGEN-007 (CharacterBuilderService integration) - MUST BE COMPLETED FIRST

## Description

Create the main UI controller that orchestrates the traits generation user interface. This controller handles concept selection, user input validation, generation workflow, and results display.

## Requirements

### File Creation

- **File**: `src/characterBuilder/controllers/TraitsGeneratorController.js`
- **Template**: Extend `src/characterBuilder/controllers/BaseCharacterBuilderController.js`
- **Pattern**: Follow `src/thematicDirection/controllers/thematicDirectionController.js` for UI patterns

### Controller Architecture

Implement full controller extending base class:

```javascript
/**
 * @typedef {import('./BaseCharacterBuilderController.js').BaseCharacterBuilderController} BaseCharacterBuilderController
 * @typedef {import('../services/characterBuilderService.js').CharacterBuilderService} CharacterBuilderService
 * @typedef {import('../services/TraitsDisplayEnhancer.js').TraitsDisplayEnhancer} TraitsDisplayEnhancer
 * @typedef {import('../services/TraitsGenerator.js').TraitsGenerator} TraitsGenerator
 */

class TraitsGeneratorController extends BaseCharacterBuilderController {
  constructor(dependencies) {
    // Validate all required dependencies
    super(dependencies);

    // Traits-specific dependencies
    this.#traitsDisplayEnhancer = dependencies.traitsDisplayEnhancer;
    this.#traitsGenerator = dependencies.traitsGenerator; // Direct service access (until TRAITSGEN-007)

    // UI state
    this.#selectedDirection = null;
    this.#userInputs = {};
    this.#lastGeneratedTraits = null;
  }
}
```

### Required Dependencies

Based on specification requirements:

```javascript
const requiredDependencies = {
  // Base dependencies (inherited)
  logger: 'ILogger',
  characterBuilderService: 'CharacterBuilderService',
  uiStateManager: 'UIStateManager',

  // Traits-specific dependencies
  traitsDisplayEnhancer: 'TraitsDisplayEnhancer',
  traitsGenerator: 'TraitsGenerator', // Direct service (until TRAITSGEN-007)
};
```

### Core Functionality Implementation

#### 1. Direction Selection with Dual Filtering

```javascript
/**
 * Load thematic directions that have both clichés AND core motivations
 * Implements dual filtering requirement from specification
 */
async #loadEligibleDirections() {
  // 1. Load all thematic directions
  // 2. Filter for directions with clichés (existing pattern)
  // 3. Filter for directions with core motivations (new requirement)
  // 4. Return directions meeting both criteria
}

/**
 * Populate direction selector with organized options
 */
#populateDirectionSelector() {
  // 1. Organize directions by concept (optgroups)
  // 2. Create dropdown options with clear labeling
  // 3. Handle empty state if no eligible directions
}

/**
 * Handle direction selection and load associated data
 */
async #selectDirection(directionId) {
  // 1. Load selected direction data
  // 2. Load associated core motivations for display
  // 3. Clear previous user inputs
  // 4. Update UI state and enable input fields
}
```

#### 2. User Input Validation

```javascript
/**
 * Validate all required user input fields
 * @returns {boolean} True if all inputs valid
 */
#validateUserInputs() {
  const inputs = {
    coreMotivation: this.#getCoreMotivationInput(),
    internalContradiction: this.#getInternalContradictionInput(),
    centralQuestion: this.#getCentralQuestionInput()
  };

  // Validate each field is non-empty string
  // Show specific error messages for invalid fields
  // Update UI state based on validation results

  return isValid;
}

/**
 * Get user input values from form fields
 */
#getUserInputs() {
  return {
    coreMotivation: this.#getCoreMotivationInput(),
    internalContradiction: this.#getInternalContradictionInput(),
    centralQuestion: this.#getCentralQuestionInput()
  };
}
```

#### 3. Generation Workflow

```javascript
/**
 * Main traits generation workflow
 */
async #generateTraits() {
  try {
    // 1. Validate direction selection
    // 2. Validate user inputs
    // 3. Show loading state with progress message
    // 4. Get concept and clichés data
    // 5. Call generation service:
    //    Option A: Wait for TRAITSGEN-007 to add characterBuilderService.generateTraitsForDirection()
    //    Option B: Use traitsGenerator.generateTraits() directly:
    //    const traits = await this.#traitsGenerator.generateTraits({
    //      concept: this.#selectedConcept,
    //      direction: this.#selectedDirection,
    //      userInputs: this.#getUserInputs(),
    //      cliches: this.#loadedCliches
    //    });
    // 6. Process and display results
    // 7. Update UI state and enable export
  } catch (error) {
    // Handle and display errors appropriately
  }
}

/**
 * Display generated traits in results container
 */
#displayResults(traits) {
  // 1. Clear previous results
  // 2. Enhance traits for display using TraitsDisplayEnhancer
  // 3. Render trait categories with proper formatting
  // 4. Update UI state and show export options
  // 5. Announce results to screen readers
}
```

#### 4. Results Display Implementation

Create comprehensive results display covering all 12 trait categories:

```javascript
/**
 * Render complete traits results
 */
#renderTraitsResults(enhancedTraits) {
  // Create container for all trait categories
  const resultsContainer = this.#getResultsContainer();

  // Render each category with specific formatting:
  this.#renderNames(enhancedTraits.names);
  this.#renderPhysicalDescription(enhancedTraits.physicalDescription);
  this.#renderPersonality(enhancedTraits.personality);
  this.#renderStrengthsWeaknesses(enhancedTraits.strengths, enhancedTraits.weaknesses);
  this.#renderLikesDiscks(enhancedTraits.likes, enhancedTraits.dislikes);
  this.#renderFears(enhancedTraits.fears);
  this.#renderGoals(enhancedTraits.goals);
  this.#renderNotes(enhancedTraits.notes);
  this.#renderProfile(enhancedTraits.profile);
  this.#renderSecrets(enhancedTraits.secrets);

  // Add user input summary
  this.#renderUserInputSummary(enhancedTraits.userInputs);
}

/**
 * Render names with justifications
 */
#renderNames(names) {
  // Create list of name options with justification explanations
  // Handle structured name objects from LLM response
}

/**
 * Render personality traits with explanations
 */
#renderPersonality(personalityTraits) {
  // Create formatted list with trait names and explanations
  // Handle structured personality objects from LLM response
}
```

#### 5. Export Functionality

```javascript
/**
 * Export traits to text file
 */
#exportToText() {
  // 1. Validate traits data available
  // 2. Format traits using TraitsDisplayEnhancer
  // 3. Generate filename with timestamp
  // 4. Create and download text file
  // 5. Provide user feedback on export success
}

/**
 * Generate export filename following established patterns
 */
#generateExportFilename() {
  // Use TraitsDisplayEnhancer.generateExportFilename()
  // Follow pattern: traits_[direction-slug]_[timestamp].txt
}
```

### UI Event Handling

#### Event Listeners Setup

```javascript
/**
 * Setup all UI event listeners
 */
#setupEventListeners() {
  // Direction selector change
  this.#directionSelector.addEventListener('change', (e) => {
    this.#selectDirection(e.target.value);
  });

  // User input validation on change
  this.#setupInputValidation();

  // Generate button click
  this.#generateButton.addEventListener('click', () => {
    this.#generateTraits();
  });

  // Export button click
  this.#exportButton.addEventListener('click', () => {
    this.#exportToText();
  });

  // Clear/reset functionality
  this.#clearButton.addEventListener('click', () => {
    this.#clearDirection();
  });
}

/**
 * Setup keyboard shortcuts following established patterns
 */
#setupKeyboardShortcuts() {
  // Ctrl+Enter: Generate traits
  // Ctrl+E: Export to text
  // Ctrl+Shift+Del: Clear all
}
```

### Accessibility Implementation

#### Screen Reader Support

```javascript
/**
 * Setup screen reader integration
 */
#setupScreenReaderIntegration() {
  // ARIA live regions for status updates
  // Proper labeling for form fields
  // Results announced when generated
}

/**
 * Announce messages to screen readers
 */
#announceToScreenReader(message) {
  // Use ARIA live region for announcements
  // Follow established accessibility patterns
}
```

#### Focus Management

```javascript
/**
 * Setup proper focus management
 */
#setupFocusManagement() {
  // Focus flow for form completion
  // Focus results after generation
  // Focus management during loading states
}
```

### UI State Management

#### State Updates

```javascript
/**
 * Update UI state based on current conditions
 */
#updateUIState() {
  const hasDirection = this.#selectedDirection !== null;
  const hasValidInputs = this.#validateUserInputs();
  const hasResults = this.#lastGeneratedTraits !== null;

  // Enable/disable generate button
  this.#generateButton.disabled = !hasDirection || !hasValidInputs;

  // Show/hide export button
  this.#exportButton.style.display = hasResults ? 'block' : 'none';

  // Update loading states
  this.#updateLoadingState();
}

/**
 * Show/hide loading state with message
 */
#showLoadingState(show, message = 'Generating traits...') {
  // Show loading indicator
  // Display progress message
  // Disable form inputs during generation
}
```

### Core Motivations Display (Right Panel)

#### Display Implementation

```javascript
/**
 * Display core motivations for selected direction (read-only)
 */
async #displayCoreMotivations(directionId) {
  // 1. Load core motivations for direction
  // 2. Create scrollable list display
  // 3. Format for read-only presentation
  // 4. Handle empty state if no motivations

  // Reference: Use existing core motivations display patterns
}

/**
 * Display user input summary in right panel
 */
#displayUserInputSummary() {
  // Show user-entered values below core motivations
  // Update as user types in input fields
  // Clear when direction changes
}
```

## Technical Implementation

### Error Handling

Implement comprehensive error handling:

```javascript
/**
 * Handle generation errors with user-friendly messages
 */
#handleGenerationError(error) {
  // Log technical error details
  this.#logger.error('Traits generation failed', error);

  // Show user-friendly error message
  // Provide recovery options (retry, clear, select different direction)
  // Dispatch error events for analytics
}

/**
 * Handle validation errors
 */
#handleValidationError(validationResults) {
  // Show specific field errors
  // Highlight invalid fields
  // Provide guidance for fixing inputs
}
```

### Code Quality Requirements

- Extend BaseCharacterBuilderController properly
- Follow established controller patterns exactly
- Implement comprehensive JSDoc documentation
- Apply proper error handling with user-friendly messages
- Use # prefix for private methods and fields
- Follow camelCase naming conventions

## Acceptance Criteria

### Functional Requirements

- [ ] Direction selector shows only directions with both clichés and core motivations
- [ ] User input validation prevents generation with empty fields
- [ ] Core motivations display shows read-only list for selected direction
- [ ] Generation workflow successfully creates and displays traits
- [ ] All 12 trait categories properly displayed with formatting
- [ ] Export functionality creates downloadable text file
- [ ] Clear/reset functionality properly cleans form state

### UI/UX Requirements

- [ ] Consistent styling with other character-builder pages
- [ ] Proper loading states during generation
- [ ] Error messages clear and actionable
- [ ] Results display organized and readable
- [ ] Export button appears only when traits available
- [ ] Form validation provides real-time feedback

### Accessibility Requirements

- [ ] Proper ARIA labeling for all form fields
- [ ] Screen reader announcements for state changes
- [ ] Keyboard navigation support with shortcuts
- [ ] Focus management throughout workflow
- [ ] High contrast support for visual elements

### Error Handling Requirements

- [ ] Graceful handling of generation failures
- [ ] User-friendly error messages for all failure scenarios
- [ ] Recovery options provided for errors
- [ ] Proper error logging for debugging

### Testing Requirements

- [ ] Create `tests/unit/characterBuilder/controllers/TraitsGeneratorController.test.js`
- [ ] Test direction filtering and selection
- [ ] Test user input validation scenarios
- [ ] Test generation workflow (success and failure)
- [ ] Test results display for all trait categories
- [ ] Test export functionality
- [ ] Test UI state management and accessibility
- [ ] Achieve 85%+ test coverage

## Files Modified

- **NEW**: `src/characterBuilder/controllers/TraitsGeneratorController.js`
- **NEW**: `tests/unit/characterBuilder/controllers/TraitsGeneratorController.test.js`

## Dependencies For Next Tickets

This controller is required for:

- TRAITSGEN-006 (HTML Page Implementation)
- TRAITSGEN-008 (Build Configuration)

## Notes

- **IMPORTANT**: Complete TRAITSGEN-007 first for CharacterBuilderService integration
- Controller location is `src/characterBuilder/controllers/` (not `src/traitsGenerator/`)
- TraitsGenerator service method is `generateTraits()` not `generateTraitsForDirection()`
- Test location is `tests/unit/characterBuilder/controllers/`
- Reference thematicDirectionController.js for UI patterns
- Pay special attention to dual filtering requirement (clichés + core motivations)
- Ensure all 12 trait categories are properly displayed
- Follow established accessibility patterns from other generators
- Implement comprehensive error handling for all user scenarios
