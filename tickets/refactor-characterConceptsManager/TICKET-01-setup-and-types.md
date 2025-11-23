# Ticket 01: Setup & Types

**Service**: Foundation (Types, Errors, Config)
**Estimated Time**: 1 hour
**Dependencies**: None
**Status**: ⬜ Not Started

---

## Goal

Create the foundational infrastructure for the refactoring:
- Directory structure
- Type definitions
- Error classes
- Configuration constants

---

## Tasks

### Task 1.1: Create Directory Structure

```bash
mkdir -p src/domUI/characterConceptsManager/{core,ui,features,utils,types,errors,config}
```

Expected directories:
```
src/domUI/characterConceptsManager/
├── core/       # Core business logic (CRUD, events, session)
├── ui/         # UI components (modals, cards, forms, notifications)
├── features/   # Feature services (search, stats, keyboard, cross-tab, optimistic)
├── utils/      # Pure utilities (formatting, escaping, CSV)
├── types/      # TypeScript-style JSDoc type definitions
├── errors/     # Custom error classes
└── config/     # Configuration constants
```

### Task 1.2: Create Type Definitions

**File**: `src/domUI/characterConceptsManager/types/conceptTypes.js`

```javascript
/**
 * @file Type definitions for Character Concepts Manager
 */

/**
 * @typedef {Object} ConceptData
 * @property {Object} concept - The concept object
 * @property {string} concept.id - Unique concept ID
 * @property {string} concept.concept - Concept text content
 * @property {string} concept.createdAt - ISO 8601 creation timestamp
 * @property {string} concept.updatedAt - ISO 8601 update timestamp
 * @property {number} directionCount - Number of associated thematic directions
 */

/**
 * @typedef {Object} ConceptStatistics
 * @property {number} totalConcepts - Total number of concepts
 * @property {number} conceptsWithDirections - Concepts with at least one direction
 * @property {number} totalDirections - Total number of directions across all concepts
 * @property {string} averageDirectionsPerConcept - Average directions (formatted string)
 * @property {number} completionRate - Percentage of concepts with directions (0-100)
 * @property {number} maxDirections - Maximum directions for any single concept
 * @property {number} conceptsWithoutDirections - Concepts without directions
 */

/**
 * @typedef {Object} SearchState
 * @property {string} filter - Current search filter term
 * @property {number} resultCount - Number of search results
 * @property {number} timestamp - State creation timestamp
 * @property {number} scrollPosition - Saved scroll position
 * @property {SearchAnalytics} analytics - Search analytics data
 */

/**
 * @typedef {Object} SearchAnalytics
 * @property {Array<SearchEntry>} recentSearches - Recent search entries
 * @property {number} totalSearches - Total search count
 */

/**
 * @typedef {Object} SearchEntry
 * @property {string} term - Search term
 * @property {number} timestamp - Search timestamp
 * @property {number} resultCount - Number of results
 * @property {number} queryLength - Length of search query
 * @property {boolean} hasSpecialChars - Contains special characters
 * @property {string} searchType - 'single-word' | 'multi-word'
 */

/**
 * @typedef {Object} SharedContext
 * @property {import('../../../interfaces/ILogger.js').ILogger} logger - Logger service
 * @property {import('../../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} eventBus - Event bus
 * @property {import('../../../characterBuilder/services/characterBuilderService.js').CharacterBuilderService} characterBuilderService - Backend service
 * @property {StateAccessors} state - State accessor methods
 * @property {DOMUtilities} dom - DOM manipulation utilities
 * @property {UIUtilities} ui - UI state utilities
 */

/**
 * @typedef {Object} StateAccessors
 * @property {() => Array<ConceptData>} getConcepts - Get concepts data
 * @property {(data: Array<ConceptData>) => void} setConcepts - Set concepts data
 * @property {() => string} getSearchFilter - Get current search filter
 * @property {(filter: string) => void} setSearchFilter - Set search filter
 * @property {() => string|null} getEditingConceptId - Get ID of concept being edited
 * @property {(id: string|null) => void} setEditingConceptId - Set editing concept ID
 * @property {() => boolean} getHasUnsavedChanges - Check for unsaved changes
 * @property {(value: boolean) => void} setHasUnsavedChanges - Set unsaved changes flag
 */

/**
 * @typedef {Object} DOMUtilities
 * @property {(id: string) => HTMLElement|null} getElement - Get DOM element by ID
 * @property {(elementId: string, event: string, handler: Function) => void} addEventListener - Add event listener
 * @property {(callback: Function, delay: number) => number} setTimeout - Managed setTimeout
 * @property {(callback: Function, delay: number) => number} setInterval - Managed setInterval
 */

/**
 * @typedef {Object} UIUtilities
 * @property {(state: string) => void} showState - Show UI state
 * @property {() => string|null} getCurrentState - Get current UI state
 */

export {
  // Re-export for IDE autocomplete
};
```

### Task 1.3: Create Error Classes

**File**: `src/domUI/characterConceptsManager/errors/ConceptErrors.js`

```javascript
/**
 * @file Custom error classes for Character Concepts Manager
 */

/**
 * Error thrown when concept validation fails
 */
export class ConceptValidationError extends Error {
  /**
   * @param {string} message - Error message
   * @param {Object} [details={}] - Validation error details
   * @param {number} [details.length] - Actual text length
   * @param {number} [details.min] - Minimum allowed length
   * @param {number} [details.max] - Maximum allowed length
   */
  constructor(message, details = {}) {
    super(message);
    this.name = 'ConceptValidationError';
    this.details = details;
  }
}

/**
 * Error thrown when a concept is not found
 */
export class ConceptNotFoundError extends Error {
  /**
   * @param {string} conceptId - The ID of the missing concept
   */
  constructor(conceptId) {
    super(`Concept not found: ${conceptId}`);
    this.name = 'ConceptNotFoundError';
    this.conceptId = conceptId;
  }
}

/**
 * Error thrown when a service operation fails
 */
export class ConceptServiceError extends Error {
  /**
   * @param {string} message - Error message
   * @param {Error} [originalError] - Original error that caused this
   */
  constructor(message, originalError) {
    super(message);
    this.name = 'ConceptServiceError';
    this.originalError = originalError;

    // Preserve stack trace
    if (originalError && originalError.stack) {
      this.stack = `${this.stack}\nCaused by: ${originalError.stack}`;
    }
  }
}
```

### Task 1.4: Create Configuration File

**File**: `src/domUI/characterConceptsManager/config/conceptManagerConfig.js`

```javascript
/**
 * @file Configuration constants for Character Concepts Manager
 */

/**
 * Configuration object for Character Concepts Manager
 * @type {Object}
 */
export const CONCEPT_CONFIG = {
  /**
   * Form validation rules
   */
  validation: {
    /** Minimum concept text length */
    minLength: 1,
    /** Maximum concept text length */
    maxLength: 6000,
    /** Character count warning threshold (90% of max) */
    characterCountThreshold: 5400,
  },

  /**
   * Animation timing settings (milliseconds)
   */
  animation: {
    /** Modal entrance animation duration */
    modalEntranceDuration: 300,
    /** Modal exit animation duration */
    modalExitDuration: 200,
    /** Statistic value animation duration */
    statUpdateDuration: 500,
    /** Number of steps in stat animation */
    statUpdateSteps: 20,
    /** Notification display duration */
    notificationDuration: 3000,
    /** Milestone notification duration */
    milestoneDuration: 4000,
  },

  /**
   * Search and filtering settings
   */
  search: {
    /** Input debounce delay (ms) */
    debounceDelay: 300,
    /** Fuzzy match similarity threshold (0-1) */
    fuzzyMatchThreshold: 0.7,
    /** Maximum recent searches to track */
    maxRecentSearches: 100,
    /** Search state expiry time (hours) */
    stateExpiryHours: 24,
  },

  /**
   * Statistics and milestones
   */
  statistics: {
    /** Concept counts that trigger milestone notifications */
    milestoneConcepts: [1, 10, 25, 50, 100],
    /** Completion rate for celebration (percentage) */
    completionCelebrationThreshold: 100,
  },

  /**
   * Cross-tab synchronization settings
   */
  crossTab: {
    /** BroadcastChannel name */
    channelName: 'character-concepts-manager',
    /** Leader election interval (ms) */
    leaderElectionInterval: 5000,
    /** Remote change debounce delay (ms) */
    remoteChangeDebounce: 500,
  },

  /**
   * Session management settings
   */
  session: {
    /** Auto-save interval (ms) */
    stateSaveInterval: 30000, // 30 seconds
    /** SessionStorage key for state */
    storageKey: 'conceptsManagerState',
    /** SessionStorage key for search (legacy) */
    searchStorageKey: 'conceptsManagerSearch',
  },
};
```

### Task 1.5: Verify Setup

Run the following checks:

```bash
# 1. Verify directory structure
ls -la src/domUI/characterConceptsManager/

# 2. Verify files created
ls -la src/domUI/characterConceptsManager/types/
ls -la src/domUI/characterConceptsManager/errors/
ls -la src/domUI/characterConceptsManager/config/

# 3. Check for syntax errors
npx eslint src/domUI/characterConceptsManager/types/conceptTypes.js
npx eslint src/domUI/characterConceptsManager/errors/ConceptErrors.js
npx eslint src/domUI/characterConceptsManager/config/conceptManagerConfig.js

# 4. Verify existing tests still pass
npm run test:unit -- --testPathPattern="characterConceptsManagerController"
```

---

## Success Criteria

- ✅ All directories created in `src/domUI/characterConceptsManager/`
- ✅ `types/conceptTypes.js` created with 10+ type definitions
- ✅ `errors/ConceptErrors.js` created with 3 error classes
- ✅ `config/conceptManagerConfig.js` created with all config sections
- ✅ No ESLint errors
- ✅ All existing tests still pass

---

## Verification Commands

```bash
# Check file creation
ls -R src/domUI/characterConceptsManager/

# Check line counts
wc -l src/domUI/characterConceptsManager/types/conceptTypes.js
wc -l src/domUI/characterConceptsManager/errors/ConceptErrors.js
wc -l src/domUI/characterConceptsManager/config/conceptManagerConfig.js

# Run linter
npx eslint src/domUI/characterConceptsManager/**/*.js

# Run tests
npm run test:unit -- --testPathPattern="characterConceptsManagerController"
```

---

## Next Ticket

[Ticket 02: Extract ConceptUtilities](./TICKET-02-concept-utilities.md)
