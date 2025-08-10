# CLIGEN-006: State Management & Data Flow

## Summary

Implement comprehensive state management for the Clichés Generator, including data caching, state persistence, reactive updates, and efficient data flow between components. This ensures smooth user experience and optimal performance.

## Status

- **Type**: Implementation
- **Priority**: Medium
- **Complexity**: Medium
- **Estimated Time**: 4 hours
- **Dependencies**: CLIGEN-005 (Controller Implementation)

## Objectives

### Primary Goals

1. **State Management** - Centralized state for page data
2. **Data Caching** - Efficient caching strategy
3. **Reactive Updates** - UI updates based on state changes
4. **Session Persistence** - Maintain state across interactions
5. **Performance Optimization** - Minimize redundant operations
6. **Memory Management** - Prevent memory leaks

### Success Criteria

- [ ] State changes trigger appropriate UI updates
- [ ] Cached data reduces API calls by 50%+
- [ ] No duplicate data fetching
- [ ] State persists during session
- [ ] Memory usage remains stable
- [ ] State transitions are smooth
- [ ] 90% test coverage achieved

## Technical Specification

### 1. State Manager Implementation

#### File: `src/clichesGenerator/state/ClichesStateManager.js`

```javascript
/**
 * @file State management for Clichés Generator
 */

import { validateDependency } from '../../utils/validationUtils.js';
import { EventEmitter } from '../../events/EventEmitter.js';

/**
 * @typedef {object} ClichesPageState
 * @property {string|null} selectedDirectionId - Currently selected direction
 * @property {object|null} currentConcept - Active concept data
 * @property {object|null} currentDirection - Active direction data
 * @property {object|null} currentCliches - Generated clichés
 * @property {Array} directionsData - All available directions
 * @property {boolean} isGenerating - Generation in progress
 * @property {boolean} isLoading - Data loading in progress
 * @property {string|null} error - Current error message
 * @property {object} cache - Cached data
 */

/**
 * State manager for Clichés Generator
 */
export class ClichesStateManager extends EventEmitter {
  #state;
  #previousState;
  #stateHistory;
  #maxHistorySize = 10;
  #cache;
  #cacheTTL = 300000; // 5 minutes

  constructor() {
    super();
    this.#initializeState();
    this.#cache = new Map();
    this.#stateHistory = [];
  }

  /**
   * Initialize default state
   * @private
   */
  #initializeState() {
    this.#state = {
      selectedDirectionId: null,
      currentConcept: null,
      currentDirection: null,
      currentCliches: null,
      directionsData: [],
      isGenerating: false,
      isLoading: false,
      error: null,
      cache: {
        concepts: new Map(),
        directions: new Map(),
        cliches: new Map(),
      },
    };

    this.#previousState = null;
  }

  /**
   * Get current state
   * @returns {ClichesPageState} Current state
   */
  getState() {
    return { ...this.#state };
  }

  /**
   * Get specific state property
   * @param {string} key - Property key
   * @returns {any} Property value
   */
  get(key) {
    return this.#state[key];
  }

  /**
   * Update state with partial updates
   * @param {Partial<ClichesPageState>} updates - State updates
   */
  setState(updates) {
    // Store previous state
    this.#previousState = { ...this.#state };

    // Apply updates
    this.#state = {
      ...this.#state,
      ...updates,
    };

    // Add to history
    this.#addToHistory(updates);

    // Emit change events
    this.#emitStateChanges(updates);
  }

  /**
   * Add state change to history
   * @private
   */
  #addToHistory(updates) {
    this.#stateHistory.push({
      timestamp: Date.now(),
      updates,
      previousState: this.#previousState,
    });

    // Limit history size
    if (this.#stateHistory.length > this.#maxHistorySize) {
      this.#stateHistory.shift();
    }
  }

  /**
   * Emit state change events
   * @private
   */
  #emitStateChanges(updates) {
    // Emit general state change
    this.emit('stateChanged', {
      updates,
      previousState: this.#previousState,
      currentState: this.#state,
    });

    // Emit specific property changes
    for (const [key, value] of Object.entries(updates)) {
      this.emit(`${key}Changed`, {
        oldValue: this.#previousState?.[key],
        newValue: value,
      });
    }
  }

  // ============= Direction Management =============

  /**
   * Set selected direction
   * @param {string} directionId - Direction ID
   * @param {object} directionData - Direction data
   */
  setSelectedDirection(directionId, directionData) {
    this.setState({
      selectedDirectionId: directionId,
      currentDirection: directionData,
      error: null,
    });
  }

  /**
   * Clear direction selection
   */
  clearSelection() {
    this.setState({
      selectedDirectionId: null,
      currentDirection: null,
      currentConcept: null,
      currentCliches: null,
      error: null,
    });
  }

  /**
   * Set directions data
   * @param {Array} directions - All directions
   */
  setDirectionsData(directions) {
    // Cache directions
    for (const direction of directions) {
      this.#cacheData(`direction:${direction.id}`, direction);
    }

    this.setState({
      directionsData: directions,
    });
  }

  // ============= Concept Management =============

  /**
   * Set current concept
   * @param {object} concept - Concept data
   */
  setCurrentConcept(concept) {
    if (concept) {
      this.#cacheData(`concept:${concept.id}`, concept);
    }

    this.setState({
      currentConcept: concept,
    });
  }

  // ============= Cliché Management =============

  /**
   * Set current clichés
   * @param {object} cliches - Generated clichés
   */
  setCurrentCliches(cliches) {
    if (cliches && this.#state.selectedDirectionId) {
      this.#cacheData(`cliches:${this.#state.selectedDirectionId}`, cliches);
    }

    this.setState({
      currentCliches: cliches,
      isGenerating: false,
      error: null,
    });
  }

  /**
   * Start cliché generation
   */
  startGeneration() {
    this.setState({
      isGenerating: true,
      error: null,
    });
  }

  /**
   * Complete cliché generation
   * @param {object} cliches - Generated clichés
   */
  completeGeneration(cliches) {
    this.setCurrentCliches(cliches);
  }

  /**
   * Fail cliché generation
   * @param {string} error - Error message
   */
  failGeneration(error) {
    this.setState({
      isGenerating: false,
      error,
    });
  }

  // ============= Loading States =============

  /**
   * Set loading state
   * @param {boolean} isLoading - Loading state
   */
  setLoading(isLoading) {
    this.setState({ isLoading });
  }

  /**
   * Set error state
   * @param {string|null} error - Error message
   */
  setError(error) {
    this.setState({ error });
  }

  // ============= Cache Management =============

  /**
   * Cache data with TTL
   * @param {string} key - Cache key
   * @param {any} data - Data to cache
   */
  #cacheData(key, data) {
    this.#cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: this.#cacheTTL,
    });

    // Clean expired entries
    this.#cleanExpiredCache();
  }

  /**
   * Get cached data
   * @param {string} key - Cache key
   * @returns {any|null} Cached data or null
   */
  getCached(key) {
    const entry = this.#cache.get(key);

    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.#cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Clean expired cache entries
   * @private
   */
  #cleanExpiredCache() {
    const now = Date.now();

    for (const [key, entry] of this.#cache) {
      if (now - entry.timestamp > entry.ttl) {
        this.#cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  clearCache() {
    this.#cache.clear();
    this.setState({
      cache: {
        concepts: new Map(),
        directions: new Map(),
        cliches: new Map(),
      },
    });
  }

  // ============= History Management =============

  /**
   * Get state history
   * @returns {Array} State history
   */
  getHistory() {
    return [...this.#stateHistory];
  }

  /**
   * Undo last state change
   */
  undo() {
    if (this.#stateHistory.length === 0) return;

    const lastChange = this.#stateHistory.pop();
    if (lastChange.previousState) {
      this.#state = lastChange.previousState;
      this.emit('stateChanged', {
        updates: this.#state,
        isUndo: true,
      });
    }
  }

  // ============= State Persistence =============

  /**
   * Save state to session storage
   */
  saveToSession() {
    try {
      const stateToSave = {
        selectedDirectionId: this.#state.selectedDirectionId,
        timestamp: Date.now(),
      };

      sessionStorage.setItem(
        'clichesGeneratorState',
        JSON.stringify(stateToSave)
      );
    } catch (error) {
      console.error('Failed to save state:', error);
    }
  }

  /**
   * Load state from session storage
   * @returns {boolean} True if state was loaded
   */
  loadFromSession() {
    try {
      const saved = sessionStorage.getItem('clichesGeneratorState');
      if (!saved) return false;

      const state = JSON.parse(saved);

      // Check if state is still valid (< 1 hour old)
      if (Date.now() - state.timestamp < 3600000) {
        this.setState({
          selectedDirectionId: state.selectedDirectionId,
        });
        return true;
      }

      // Clear expired state
      sessionStorage.removeItem('clichesGeneratorState');
    } catch (error) {
      console.error('Failed to load state:', error);
    }

    return false;
  }

  // ============= State Validation =============

  /**
   * Validate current state
   * @returns {object} Validation result
   */
  validateState() {
    const errors = [];
    const warnings = [];

    // Check for inconsistencies
    if (this.#state.selectedDirectionId && !this.#state.currentDirection) {
      errors.push('Selected direction ID without direction data');
    }

    if (this.#state.currentDirection && !this.#state.currentConcept) {
      warnings.push('Direction without associated concept');
    }

    if (this.#state.isGenerating && this.#state.currentCliches) {
      errors.push('Generation in progress but clichés already exist');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Reset state to initial
   */
  reset() {
    this.#initializeState();
    this.#cache.clear();
    this.#stateHistory = [];
    this.emit('stateReset');
  }
}

export default ClichesStateManager;
```

### 2. State Integration with Controller

#### File: `src/clichesGenerator/controllers/ClichesGeneratorController.js` (partial update)

```javascript
// Add to controller constructor
constructor(dependencies) {
  super(dependencies);

  // Initialize state manager
  this.#stateManager = new ClichesStateManager();
  this.#setupStateListeners();
}

/**
 * Set up state change listeners
 * @private
 */
#setupStateListeners() {
  // React to state changes
  this.#stateManager.on('selectedDirectionIdChanged', ({ newValue }) => {
    if (newValue) {
      this.#loadDirectionData(newValue);
    } else {
      this.#clearUI();
    }
  });

  this.#stateManager.on('currentClichesChanged', ({ newValue }) => {
    if (newValue) {
      this.#displayCliches(newValue);
    }
  });

  this.#stateManager.on('isGeneratingChanged', ({ newValue }) => {
    this.#updateGenerateButton(!newValue, newValue ? 'Generating...' : 'Generate Clichés');
  });

  this.#stateManager.on('errorChanged', ({ newValue }) => {
    if (newValue) {
      this._showErrorMessage(newValue);
    }
  });

  this.#stateManager.on('isLoadingChanged', ({ newValue }) => {
    if (newValue) {
      this._showLoadingState();
    } else {
      this._hideLoadingState();
    }
  });
}

/**
 * Handle direction selection with state management
 * @private
 */
async #handleDirectionSelection(directionId) {
  if (!directionId) {
    this.#stateManager.clearSelection();
    return;
  }

  // Check cache first
  const cachedDirection = this.#stateManager.getCached(`direction:${directionId}`);
  const cachedCliches = this.#stateManager.getCached(`cliches:${directionId}`);

  if (cachedDirection && cachedCliches) {
    // Use cached data
    this.#stateManager.setSelectedDirection(directionId, cachedDirection);
    this.#stateManager.setCurrentCliches(cachedCliches);
    return;
  }

  // Load fresh data
  try {
    this.#stateManager.setLoading(true);

    const directionData = await this.#loadDirectionData(directionId);
    this.#stateManager.setSelectedDirection(directionId, directionData.direction);
    this.#stateManager.setCurrentConcept(directionData.concept);

    // Check for existing clichés
    const hasCliches = await this._services.characterBuilderService.hasClichesForDirection(directionId);

    if (hasCliches) {
      const cliches = await this._services.characterBuilderService.getClichesByDirectionId(directionId);
      this.#stateManager.setCurrentCliches(cliches);
    }

  } catch (error) {
    this.#stateManager.setError(error.message);
  } finally {
    this.#stateManager.setLoading(false);
  }
}
```

### 3. Data Flow Orchestrator

#### File: `src/clichesGenerator/orchestration/DataFlowOrchestrator.js`

```javascript
/**
 * Orchestrates data flow between components
 */
export class DataFlowOrchestrator {
  #stateManager;
  #services;
  #eventBus;
  #logger;

  constructor({ stateManager, services, eventBus, logger }) {
    this.#stateManager = stateManager;
    this.#services = services;
    this.#eventBus = eventBus;
    this.#logger = logger;

    this.#setupEventListeners();
  }

  /**
   * Set up event listeners for data flow
   * @private
   */
  #setupEventListeners() {
    // Service events
    this.#eventBus.on('CLICHES_GENERATION_STARTED', () => {
      this.#stateManager.startGeneration();
    });

    this.#eventBus.on('CLICHES_GENERATION_COMPLETED', (event) => {
      this.#stateManager.completeGeneration(event.payload.cliches);
    });

    this.#eventBus.on('CLICHES_GENERATION_FAILED', (event) => {
      this.#stateManager.failGeneration(event.payload.error);
    });

    // State change reactions
    this.#stateManager.on('stateChanged', ({ updates }) => {
      this.#logger.debug('State changed:', updates);

      // Save critical state to session
      if (updates.selectedDirectionId !== undefined) {
        this.#stateManager.saveToSession();
      }
    });
  }

  /**
   * Load initial data
   */
  async loadInitialData() {
    try {
      this.#stateManager.setLoading(true);

      // Try to restore from session
      const restored = this.#stateManager.loadFromSession();

      // Load directions
      const directions =
        await this.#services.characterBuilderService.getAllThematicDirections();
      this.#stateManager.setDirectionsData(directions);

      // If restored, reload that direction
      if (restored) {
        const directionId = this.#stateManager.get('selectedDirectionId');
        if (directionId) {
          await this.loadDirection(directionId);
        }
      }
    } catch (error) {
      this.#stateManager.setError('Failed to load initial data');
      this.#logger.error('Initial data load failed:', error);
    } finally {
      this.#stateManager.setLoading(false);
    }
  }

  /**
   * Load specific direction
   */
  async loadDirection(directionId) {
    // Check cache
    const cached = this.#stateManager.getCached(`fullDirection:${directionId}`);
    if (cached) {
      this.#applyDirectionData(cached);
      return;
    }

    try {
      // Load direction and concept
      const direction =
        await this.#services.characterBuilderService.getThematicDirection(
          directionId
        );
      const concept =
        await this.#services.characterBuilderService.getCharacterConcept(
          direction.conceptId
        );

      const data = { direction, concept };

      // Cache the full data
      this.#stateManager.cacheData(`fullDirection:${directionId}`, data);

      this.#applyDirectionData(data);
    } catch (error) {
      this.#stateManager.setError(`Failed to load direction: ${error.message}`);
    }
  }

  /**
   * Apply direction data to state
   * @private
   */
  #applyDirectionData(data) {
    this.#stateManager.setSelectedDirection(data.direction.id, data.direction);
    this.#stateManager.setCurrentConcept(data.concept);
  }

  /**
   * Generate clichés for current selection
   */
  async generateCliches() {
    const state = this.#stateManager.getState();

    if (!state.currentConcept || !state.currentDirection) {
      this.#stateManager.setError('No direction selected');
      return;
    }

    try {
      this.#stateManager.startGeneration();

      const cliches =
        await this.#services.characterBuilderService.generateClichesForDirection(
          state.currentConcept,
          state.currentDirection
        );

      this.#stateManager.completeGeneration(cliches);
    } catch (error) {
      this.#stateManager.failGeneration(error.message);
    }
  }
}
```

## Implementation Tasks

### Phase 1: State Manager (1.5 hours)

1. **Create state manager**
   - [ ] Initialize state structure
   - [ ] Implement state updates
   - [ ] Add event emission

2. **Add state methods**
   - [ ] Direction management
   - [ ] Concept management
   - [ ] Cliché management

### Phase 2: Cache System (1 hour)

1. **Implement caching**
   - [ ] Cache structure
   - [ ] TTL management
   - [ ] Cache cleanup

2. **Session persistence**
   - [ ] Save to session
   - [ ] Load from session
   - [ ] Expiration handling

### Phase 3: Data Flow (1 hour)

1. **Create orchestrator**
   - [ ] Event listeners
   - [ ] Data loading
   - [ ] Error handling

2. **Integrate with controller**
   - [ ] State listeners
   - [ ] UI updates
   - [ ] Action handlers

### Phase 4: Testing (30 minutes)

1. **Test state manager**
   - [ ] State updates
   - [ ] Event emission
   - [ ] Cache behavior

2. **Test data flow**
   - [ ] Load sequences
   - [ ] Error scenarios
   - [ ] Cache hits/misses

## Testing Requirements

```javascript
describe('ClichesStateManager', () => {
  let stateManager;

  beforeEach(() => {
    stateManager = new ClichesStateManager();
  });

  describe('State Updates', () => {
    it('should update state and emit events', () => {
      const listener = jest.fn();
      stateManager.on('selectedDirectionIdChanged', listener);

      stateManager.setSelectedDirection('dir-1', { id: 'dir-1' });

      expect(stateManager.get('selectedDirectionId')).toBe('dir-1');
      expect(listener).toHaveBeenCalled();
    });

    it('should maintain state history', () => {
      stateManager.setState({ isLoading: true });
      stateManager.setState({ isLoading: false });

      const history = stateManager.getHistory();
      expect(history).toHaveLength(2);
    });
  });

  describe('Cache Management', () => {
    it('should cache and retrieve data', () => {
      const data = { id: 'test' };
      stateManager.cacheData('test-key', data);

      const cached = stateManager.getCached('test-key');
      expect(cached).toEqual(data);
    });

    it('should expire old cache entries', () => {
      jest.useFakeTimers();

      stateManager.cacheData('test-key', { id: 'test' });

      // Advance time past TTL
      jest.advanceTimersByTime(6 * 60 * 1000);

      const cached = stateManager.getCached('test-key');
      expect(cached).toBeNull();

      jest.useRealTimers();
    });
  });
});
```

## Acceptance Criteria

- [ ] State management working
- [ ] Cache reduces API calls
- [ ] Session persistence functional
- [ ] UI reacts to state changes
- [ ] No memory leaks
- [ ] Tests passing
- [ ] Documentation complete

## Definition of Done

- [ ] Code implemented per specification
- [ ] Unit tests passing (90% coverage)
- [ ] Integration tested
- [ ] Performance validated
- [ ] Code reviewed and approved
- [ ] Documentation updated
