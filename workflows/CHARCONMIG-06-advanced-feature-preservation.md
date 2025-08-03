# CHARCONMIG-06: Advanced Feature Preservation

## Overview

Preserve and enhance the controller's advanced features including cross-tab synchronization, search analytics, animation management, and keyboard shortcuts using base class patterns. This migration ensures all sophisticated functionality is maintained while leveraging base class infrastructure for improved reliability and consistency.

## Priority

**High** - Critical for maintaining advanced functionality that distinguishes this controller from basic implementations.

## Dependencies

- CHARCONMIG-01: Structural Foundation Setup (completed)
- CHARCONMIG-02: Abstract Method Implementation (completed)
- CHARCONMIG-03: Lifecycle Method Migration (completed)
- CHARCONMIG-04: Field Access Pattern Updates (completed)
- CHARCONMIG-05: State Management Integration (completed)

## Estimated Effort

**8 hours** - Complex feature preservation with base class integration and comprehensive testing

## Acceptance Criteria

1. ✅ Cross-tab synchronization fully preserved and enhanced with base class patterns
2. ✅ Search analytics and state restoration maintained with improved reliability
3. ✅ Animation management integrated with base class cleanup mechanisms
4. ✅ Keyboard shortcuts preserved using base class event management
5. ✅ Advanced modal workflows maintained with enhanced error handling
6. ✅ Session state persistence improved with base class patterns
7. ✅ Leader election algorithm preserved for cross-tab coordination
8. ✅ All existing advanced functionality working identically
9. ✅ Enhanced reliability through base class infrastructure
10. ✅ Improved code organization and maintainability

## Advanced Features Analysis

### Cross-Tab Synchronization (Critical Feature)

```javascript
// Current cross-tab synchronization implementation (200+ lines)
#initializeCrossTabSync() {
  this.#tabId = `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Create broadcast channel for cross-tab communication
  this.#syncChannel = new BroadcastChannel('character-concepts-sync');
  this.#syncChannel.addEventListener('message', this.#handleCrossTabMessage.bind(this));

  // Set up leader election
  this.#startLeaderElection();

  // Clean up on page unload
  window.addEventListener('beforeunload', () => {
    this.#cleanupCrossTabSync();
  });
}

#handleCrossTabMessage(event) {
  const { type, data, tabId } = event.data;

  if (tabId === this.#tabId) return; // Ignore own messages

  switch (type) {
    case 'CONCEPT_CREATED':
      this.#handleRemoteConceptCreated(data);
      break;
    case 'CONCEPT_UPDATED':
      this.#handleRemoteConceptUpdated(data);
      break;
    case 'CONCEPT_DELETED':
      this.#handleRemoteConceptDeleted(data);
      break;
    case 'LEADER_ELECTION':
      this.#handleLeaderElection(data);
      break;
    case 'SEARCH_SYNC':
      this.#handleRemoteSearchSync(data);
      break;
  }
}

#startLeaderElection() {
  // Leader election algorithm for coordinating data refresh
  this.#isLeader = true;
  this.#broadcastLeaderElection();

  this.#leaderElectionTimer = setInterval(() => {
    if (this.#isLeader) {
      this.#broadcastLeaderElection();
    }
  }, 30000); // Re-elect every 30 seconds
}
```

### Search Analytics and State Restoration

```javascript
// Current search analytics (150+ lines)
#searchAnalytics = {
  searches: [],
  noResultSearches: [],
  totalSearches: 0,
  lastSearchTime: null
};

#handleSearch(searchTerm) {
  this.#searchFilter = searchTerm;

  // Analytics tracking
  this.#searchAnalytics.searches.push({
    term: searchTerm,
    timestamp: Date.now(),
    resultsCount: this.#getFilteredConcepts().length
  });

  // Track no-result searches
  if (this.#getFilteredConcepts().length === 0 && searchTerm.trim()) {
    this.#searchAnalytics.noResultSearches.push({
      term: searchTerm,
      timestamp: Date.now()
    });
  }

  this.#applySearchFilter();
  this.#saveSearchState();

  // Sync search across tabs
  this.#broadcastSearchSync(searchTerm);
}

#saveSearchState() {
  try {
    sessionStorage.setItem('conceptsSearchFilter', this.#searchFilter);
    sessionStorage.setItem('conceptsScrollPosition', window.scrollY.toString());
    sessionStorage.setItem('searchAnalytics', JSON.stringify(this.#searchAnalytics));
  } catch (error) {
    this.#logger.warn('Failed to save search state', error);
  }
}

#restoreSearchState() {
  try {
    const savedFilter = sessionStorage.getItem('conceptsSearchFilter');
    const savedScroll = sessionStorage.getItem('conceptsScrollPosition');
    const savedAnalytics = sessionStorage.getItem('searchAnalytics');

    if (savedFilter) {
      this.#searchFilter = savedFilter;
      this.#elements.conceptSearch.value = savedFilter;
      this.#applySearchFilter();
    }

    if (savedScroll) {
      setTimeout(() => {
        window.scrollTo(0, parseInt(savedScroll, 10));
      }, 100);
    }

    if (savedAnalytics) {
      this.#searchAnalytics = JSON.parse(savedAnalytics);
    }
  } catch (error) {
    this.#logger.warn('Failed to restore search state', error);
  }
}
```

### Animation Management

```javascript
// Current animation management (100+ lines)
#animationCleanup = [];

#showCreateModal() {
  const modal = this.#elements.conceptModal;

  // Animation sequence
  modal.style.display = 'block';
  modal.style.opacity = '0';
  modal.style.transform = 'scale(0.9)';

  const animation = modal.animate([
    { opacity: 0, transform: 'scale(0.9)' },
    { opacity: 1, transform: 'scale(1)' }
  ], {
    duration: 250,
    easing: 'ease-out'
  });

  // Track animation for cleanup
  this.#animationCleanup.push(() => {
    animation.cancel();
  });

  animation.addEventListener('finish', () => {
    modal.style.opacity = '1';
    modal.style.transform = 'scale(1)';
  });

  // Focus first input
  setTimeout(() => {
    this.#elements.conceptText.focus();
  }, 300);
}

#cleanupAnimations() {
  this.#animationCleanup.forEach(cleanup => {
    try {
      cleanup();
    } catch (error) {
      this.#logger.warn('Animation cleanup failed', error);
    }
  });
  this.#animationCleanup = [];
}
```

## Implementation Steps

### Step 1: Enhance Cross-Tab Synchronization with Base Class Patterns

**Duration:** 3 hours

**Current Implementation Issues:**

- Manual event listener setup and cleanup
- Manual error handling in message processing
- Inconsistent logging patterns
- Manual timer management

**Target Enhanced Implementation:**

```javascript
/**
 * Initialize cross-tab synchronization using base class patterns
 * @private
 */
_initializeCrossTabSync() {
  // Generate unique tab identifier
  this.#tabId = `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  try {
    // Create broadcast channel for cross-tab communication
    this.#syncChannel = new BroadcastChannel('character-concepts-sync');

    // Use base class event management for proper cleanup
    this._addEventListener('syncChannel', 'message', this._handleCrossTabMessage.bind(this));

    // Set up leader election with base class timer management
    this._startLeaderElection();

    // Register cleanup with base class
    this._registerCleanupHandler(() => this._cleanupCrossTabSync());

    this.logger.debug('Cross-tab synchronization initialized', { tabId: this.#tabId });

  } catch (error) {
    this.logger.error('Failed to initialize cross-tab synchronization', error);
    // Graceful degradation - disable cross-tab features
    this.#syncChannel = null;
  }
}

/**
 * Handle cross-tab messages with enhanced error handling
 * @private
 * @param {MessageEvent} event - Broadcast channel message event
 */
_handleCrossTabMessage(event) {
  try {
    const { type, data, tabId, timestamp } = event.data;

    // Ignore own messages and old messages
    if (tabId === this.#tabId) return;
    if (timestamp && (Date.now() - timestamp > 30000)) return; // Ignore messages older than 30s

    this.logger.debug('Received cross-tab message', { type, tabId });

    switch (type) {
      case 'CONCEPT_CREATED':
        this._handleRemoteConceptCreated(data);
        break;
      case 'CONCEPT_UPDATED':
        this._handleRemoteConceptUpdated(data);
        break;
      case 'CONCEPT_DELETED':
        this._handleRemoteConceptDeleted(data);
        break;
      case 'LEADER_ELECTION':
        this._handleLeaderElection(data);
        break;
      case 'SEARCH_SYNC':
        this._handleRemoteSearchSync(data);
        break;
      default:
        this.logger.warn('Unknown cross-tab message type', { type });
    }

  } catch (error) {
    this.logger.error('Error handling cross-tab message', error, event.data);
  }
}

/**
 * Start leader election with base class timer management
 * @private
 */
_startLeaderElection() {
  this.#isLeader = true;
  this._broadcastLeaderElection();

  // Use base class timer management for automatic cleanup
  this.#leaderElectionTimer = this._setInterval(() => {
    if (this.#isLeader) {
      this._broadcastLeaderElection();
    }
  }, 30000);

  this.logger.debug('Leader election started', { isLeader: this.#isLeader });
}

/**
 * Broadcast leader election message
 * @private
 */
_broadcastLeaderElection() {
  this._broadcastCrossTabMessage('LEADER_ELECTION', {
    tabId: this.#tabId,
    timestamp: Date.now(),
    concepts: this.#conceptsData.length
  });
}

/**
 * Broadcast message to other tabs with error handling
 * @private
 * @param {string} type - Message type
 * @param {Object} data - Message data
 */
_broadcastCrossTabMessage(type, data) {
  if (!this.#syncChannel) return;

  try {
    this.#syncChannel.postMessage({
      type,
      data,
      tabId: this.#tabId,
      timestamp: Date.now()
    });
  } catch (error) {
    this.logger.error('Failed to broadcast cross-tab message', error, { type, data });
  }
}

/**
 * Clean up cross-tab synchronization
 * @private
 */
_cleanupCrossTabSync() {
  try {
    if (this.#syncChannel) {
      this.#syncChannel.close();
      this.#syncChannel = null;
    }

    if (this.#leaderElectionTimer) {
      this._clearInterval(this.#leaderElectionTimer);
      this.#leaderElectionTimer = null;
    }

    this.logger.debug('Cross-tab synchronization cleaned up');

  } catch (error) {
    this.logger.error('Error cleaning up cross-tab sync', error);
  }
}
```

**Implementation Details:**

1. **Base Class Event Management**
   - Use `_addEventListener()` for broadcast channel events
   - Automatic cleanup through base class resource management
   - Consistent error handling patterns

2. **Enhanced Error Handling**
   - Graceful degradation when BroadcastChannel unavailable
   - Message validation and timestamp checking
   - Comprehensive error logging

3. **Timer Management**
   - Use base class timer methods for automatic cleanup
   - Proper timer cleanup in destroy/cleanup methods

**Validation:**

- Cross-tab messages sent and received correctly
- Leader election works across multiple tabs
- Proper cleanup on page unload
- Error handling prevents crashes

### Step 2: Enhance Search Analytics with Base Class Patterns

**Duration:** 2 hours

**Current Search Analytics Issues:**

- Manual session storage error handling
- Inconsistent state restoration timing
- No analytics data validation

**Target Enhanced Implementation:**

```javascript
/**
 * Handle search input with enhanced analytics and cross-tab sync
 * @protected
 * @param {string} searchTerm - The search term to filter by
 */
_handleSearch(searchTerm) {
  try {
    this.#searchFilter = searchTerm;

    // Enhanced analytics tracking
    this._trackSearchAnalytics(searchTerm);

    // Apply search filter
    this._applySearchFilter();

    // Save state with error handling
    this._saveSearchState();

    // Sync search across tabs
    this._broadcastSearchSync(searchTerm);

    this.logger.debug('Search performed', {
      term: searchTerm,
      resultsCount: this._getFilteredConcepts().length
    });

  } catch (error) {
    this.logger.error('Error handling search', error, { searchTerm });
  }
}

/**
 * Track search analytics with validation
 * @private
 * @param {string} searchTerm - The search term
 */
_trackSearchAnalytics(searchTerm) {
  try {
    const resultsCount = this._getFilteredConcepts().length;
    const timestamp = Date.now();

    // Track all searches
    this.#searchAnalytics.searches.push({
      term: searchTerm,
      timestamp,
      resultsCount,
      tabId: this.#tabId
    });

    // Track no-result searches
    if (resultsCount === 0 && searchTerm.trim()) {
      this.#searchAnalytics.noResultSearches.push({
        term: searchTerm,
        timestamp,
        tabId: this.#tabId
      });
    }

    // Update totals
    this.#searchAnalytics.totalSearches++;
    this.#searchAnalytics.lastSearchTime = timestamp;

    // Limit analytics data size (keep last 1000 searches)
    if (this.#searchAnalytics.searches.length > 1000) {
      this.#searchAnalytics.searches = this.#searchAnalytics.searches.slice(-1000);
    }

    if (this.#searchAnalytics.noResultSearches.length > 100) {
      this.#searchAnalytics.noResultSearches = this.#searchAnalytics.noResultSearches.slice(-100);
    }

  } catch (error) {
    this.logger.error('Error tracking search analytics', error, { searchTerm });
  }
}

/**
 * Save search state to session storage with enhanced error handling
 * @private
 */
_saveSearchState() {
  try {
    const stateData = {
      searchFilter: this.#searchFilter,
      scrollPosition: window.scrollY,
      analytics: this.#searchAnalytics,
      timestamp: Date.now(),
      tabId: this.#tabId
    };

    // Use structured storage with validation
    sessionStorage.setItem('conceptsSearchState', JSON.stringify(stateData));

    this.logger.debug('Search state saved', {
      filter: this.#searchFilter,
      scrollPosition: window.scrollY
    });

  } catch (error) {
    // Handle quota exceeded or other storage errors
    this.logger.warn('Failed to save search state', error);

    // Try to save minimal state
    try {
      sessionStorage.setItem('conceptsSearchFilter', this.#searchFilter);
    } catch (fallbackError) {
      this.logger.error('Failed to save minimal search state', fallbackError);
    }
  }
}

/**
 * Restore search state from session storage with validation
 * @private
 */
_restoreSearchState() {
  try {
    // Try to restore structured state first
    const stateJson = sessionStorage.getItem('conceptsSearchState');
    if (stateJson) {
      const stateData = JSON.parse(stateJson);

      // Validate state data
      if (this._validateSearchState(stateData)) {
        this._applyRestoredState(stateData);
        return;
      }
    }

    // Fallback to legacy restoration
    this._restoreLegacySearchState();

  } catch (error) {
    this.logger.warn('Failed to restore search state', error);

    // Try legacy restoration as fallback
    try {
      this._restoreLegacySearchState();
    } catch (fallbackError) {
      this.logger.error('Failed to restore legacy search state', fallbackError);
    }
  }
}

/**
 * Validate restored search state data
 * @private
 * @param {Object} stateData - The state data to validate
 * @returns {boolean} - Whether the state data is valid
 */
_validateSearchState(stateData) {
  return (
    stateData &&
    typeof stateData.searchFilter === 'string' &&
    typeof stateData.scrollPosition === 'number' &&
    stateData.analytics &&
    Array.isArray(stateData.analytics.searches) &&
    Array.isArray(stateData.analytics.noResultSearches) &&
    stateData.timestamp &&
    (Date.now() - stateData.timestamp < 24 * 60 * 60 * 1000) // Less than 24 hours old
  );
}

/**
 * Apply restored search state
 * @private
 * @param {Object} stateData - Validated state data
 */
_applyRestoredState(stateData) {
  // Restore search filter
  this.#searchFilter = stateData.searchFilter;
  const searchInput = this._getElement('conceptSearch');
  if (searchInput) {
    searchInput.value = stateData.searchFilter;
    this._applySearchFilter();
  }

  // Restore scroll position
  if (stateData.scrollPosition > 0) {
    setTimeout(() => {
      window.scrollTo(0, stateData.scrollPosition);
    }, 100);
  }

  // Restore analytics (merge with current)
  if (stateData.analytics) {
    this.#searchAnalytics = {
      ...this.#searchAnalytics,
      ...stateData.analytics
    };
  }

  this.logger.debug('Search state restored', {
    filter: stateData.searchFilter,
    scrollPosition: stateData.scrollPosition,
    searchCount: stateData.analytics.searches.length
  });
}
```

**Implementation Details:**

1. **Enhanced Analytics**
   - Structured analytics data with validation
   - Data size limits to prevent memory issues
   - Tab identification for multi-tab analytics

2. **Improved State Persistence**
   - Structured state storage with validation
   - Graceful fallback for storage errors
   - Legacy state restoration support

3. **Error Resilience**
   - Comprehensive error handling for storage operations
   - Fallback mechanisms for partial failures
   - Detailed error logging for debugging

**Validation:**

- Search analytics track correctly across tabs
- State restoration works after page reload
- Error handling prevents data loss
- Performance impact is minimal

### Step 3: Enhance Animation Management with Base Class Integration

**Duration:** 1.5 hours

**Current Animation Issues:**

- Manual animation cleanup tracking
- No error handling for animation failures
- Inconsistent animation patterns

**Target Enhanced Implementation:**

```javascript
/**
 * Show create concept modal with enhanced animations
 * @protected
 */
_showCreateModal() {
  try {
    const modal = this._getElement('conceptModal');
    if (!modal) {
      throw new Error('Concept modal element not found');
    }

    // Reset form and prepare modal
    this._resetConceptForm();
    this.#editingConceptId = null;

    // Use base class animation management
    this._animateModalShow(modal, {
      duration: 250,
      easing: 'ease-out',
      onComplete: () => {
        // Focus first input after animation
        const conceptText = this._getElement('conceptText');
        if (conceptText) {
          conceptText.focus();
        }
      }
    });

    this.logger.debug('Create concept modal shown');

  } catch (error) {
    this.logger.error('Error showing create modal', error);
    // Fallback: show modal without animation
    this._showModalFallback('conceptModal');
  }
}

/**
 * Animate modal show with base class patterns
 * @private
 * @param {HTMLElement} modal - The modal element
 * @param {Object} options - Animation options
 */
_animateModalShow(modal, options = {}) {
  const {
    duration = 250,
    easing = 'ease-out',
    onComplete = null
  } = options;

  try {
    // Initial state
    modal.style.display = 'block';
    modal.style.opacity = '0';
    modal.style.transform = 'scale(0.9)';

    // Create animation
    const animation = modal.animate([
      {
        opacity: 0,
        transform: 'scale(0.9)',
        filter: 'blur(1px)'
      },
      {
        opacity: 1,
        transform: 'scale(1)',
        filter: 'blur(0px)'
      }
    ], {
      duration,
      easing,
      fill: 'forwards'
    });

    // Register animation for cleanup with base class
    this._registerAnimation(animation);

    // Handle animation completion
    animation.addEventListener('finish', () => {
      modal.style.opacity = '1';
      modal.style.transform = 'scale(1)';
      modal.style.filter = 'none';

      if (onComplete) {
        onComplete();
      }
    });

    // Handle animation errors
    animation.addEventListener('cancel', () => {
      this.logger.debug('Modal animation cancelled');
    });

  } catch (error) {
    this.logger.error('Error creating modal animation', error);
    // Fallback: show immediately
    modal.style.display = 'block';
    modal.style.opacity = '1';
    modal.style.transform = 'scale(1)';

    if (options.onComplete) {
      options.onComplete();
    }
  }
}

/**
 * Close concept modal with animation
 * @protected
 */
_closeConceptModal() {
  try {
    const modal = this._getElement('conceptModal');
    if (!modal) return;

    // Animate modal close
    this._animateModalHide(modal, {
      duration: 200,
      easing: 'ease-in',
      onComplete: () => {
        modal.style.display = 'none';
        this._resetConceptForm();
        this.#editingConceptId = null;
      }
    });

    this.logger.debug('Concept modal closed');

  } catch (error) {
    this.logger.error('Error closing modal', error);
    // Fallback: hide immediately
    this._hideModalFallback('conceptModal');
  }
}

/**
 * Animate modal hide
 * @private
 * @param {HTMLElement} modal - The modal element
 * @param {Object} options - Animation options
 */
_animateModalHide(modal, options = {}) {
  const {
    duration = 200,
    easing = 'ease-in',
    onComplete = null
  } = options;

  try {
    const animation = modal.animate([
      {
        opacity: 1,
        transform: 'scale(1)',
        filter: 'blur(0px)'
      },
      {
        opacity: 0,
        transform: 'scale(0.9)',
        filter: 'blur(1px)'
      }
    ], {
      duration,
      easing,
      fill: 'forwards'
    });

    // Register animation for cleanup
    this._registerAnimation(animation);

    animation.addEventListener('finish', () => {
      if (onComplete) {
        onComplete();
      }
    });

  } catch (error) {
    this.logger.error('Error creating hide animation', error);
    if (options.onComplete) {
      options.onComplete();
    }
  }
}

/**
 * Register animation for cleanup with base class
 * @private
 * @param {Animation} animation - The animation to register
 */
_registerAnimation(animation) {
  // Add to cleanup array for manual tracking
  this.#animationCleanup.push(() => {
    try {
      if (animation.playState !== 'finished') {
        animation.cancel();
      }
    } catch (error) {
      this.logger.debug('Error cancelling animation', error);
    }
  });

  // Also register with base class if available
  if (this._registerCleanupHandler) {
    this._registerCleanupHandler(() => {
      try {
        if (animation.playState !== 'finished') {
          animation.cancel();
        }
      } catch (error) {
        // Silent cleanup - don't log in cleanup
      }
    });
  }
}

/**
 * Clean up all animations
 * @private
 */
_cleanupAnimations() {
  this.#animationCleanup.forEach(cleanup => {
    try {
      cleanup();
    } catch (error) {
      this.logger.debug('Animation cleanup failed', error);
    }
  });
  this.#animationCleanup = [];
}
```

**Implementation Details:**

1. **Enhanced Animation Patterns**
   - Structured animation options with defaults
   - Error handling for animation failures
   - Graceful fallbacks for animation issues

2. **Base Class Integration**
   - Register animations for automatic cleanup
   - Use base class element access methods
   - Consistent error logging patterns

3. **Performance Optimization**
   - Use efficient CSS transforms and opacity
   - Minimal animation cleanup overhead
   - Proper animation lifecycle management

**Validation:**

- Modal animations work smoothly
- Animation cleanup prevents memory leaks
- Fallback behavior works when animations fail
- Performance impact is minimal

### Step 4: Enhance Keyboard Shortcuts with Base Class Event Management

**Duration:** 1 hour

**Current Keyboard Shortcut Issues:**

- Manual event listener setup
- No conflict detection with other shortcuts
- Limited accessibility support

**Target Enhanced Implementation:**

```javascript
/**
 * Set up keyboard shortcuts using base class event management
 * @private
 */
_setupKeyboardShortcuts() {
  try {
    // Use base class event management for automatic cleanup
    this._addEventListener('document', 'keydown', (e) => {
      this._handleKeyboardShortcut(e);
    });

    this.logger.debug('Keyboard shortcuts initialized');

  } catch (error) {
    this.logger.error('Failed to setup keyboard shortcuts', error);
  }
}

/**
 * Handle keyboard shortcuts with enhanced functionality
 * @private
 * @param {KeyboardEvent} e - The keyboard event
 */
_handleKeyboardShortcut(e) {
  try {
    // Check if shortcuts should be disabled (input focus, modal open, etc.)
    if (this._shouldDisableShortcuts(e)) {
      return;
    }

    const { ctrlKey, metaKey, altKey, shiftKey, key } = e;
    const modifierKey = ctrlKey || metaKey;

    // Create new concept (Ctrl/Cmd + N)
    if (modifierKey && key === 'n' && !altKey && !shiftKey) {
      e.preventDefault();
      this._showCreateModal();
      return;
    }

    // Focus search (Ctrl/Cmd + F)
    if (modifierKey && key === 'f' && !altKey && !shiftKey) {
      e.preventDefault();
      this._focusSearch();
      return;
    }

    // Close modal (Escape)
    if (key === 'Escape' && !modifierKey && !altKey && !shiftKey) {
      this._handleEscapeKey();
      return;
    }

    // Refresh data (F5 or Ctrl/Cmd + R) - with confirmation
    if ((key === 'F5' || (modifierKey && key === 'r')) && !altKey && !shiftKey) {
      if (this._hasUnsavedChanges()) {
        e.preventDefault();
        this._confirmRefresh();
      }
      return;
    }

    // Help dialog (F1 or Ctrl/Cmd + ?)
    if (key === 'F1' || (modifierKey && key === '?')) {
      e.preventDefault();
      this._showHelpDialog();
      return;
    }

  } catch (error) {
    this.logger.error('Error handling keyboard shortcut', error, { key: e.key });
  }
}

/**
 * Check if keyboard shortcuts should be disabled
 * @private
 * @param {KeyboardEvent} e - The keyboard event
 * @returns {boolean} - Whether shortcuts should be disabled
 */
_shouldDisableShortcuts(e) {
  // Disable when focus is in input elements
  const activeElement = document.activeElement;
  if (activeElement && (
    activeElement.tagName === 'INPUT' ||
    activeElement.tagName === 'TEXTAREA' ||
    activeElement.contentEditable === 'true'
  )) {
    return true;
  }

  // Disable when modals are open (except Escape)
  if (e.key !== 'Escape') {
    const conceptModal = this._getElement('conceptModal');
    const deleteModal = this._getElement('deleteConfirmationModal');

    if (conceptModal && conceptModal.style.display !== 'none') return true;
    if (deleteModal && deleteModal.style.display !== 'none') return true;
  }

  return false;
}

/**
 * Handle escape key press
 * @private
 */
_handleEscapeKey() {
  const conceptModal = this._getElement('conceptModal');
  const deleteModal = this._getElement('deleteConfirmationModal');

  // Close modals in order of priority
  if (conceptModal && conceptModal.style.display !== 'none') {
    this._closeConceptModal();
  } else if (deleteModal && deleteModal.style.display !== 'none') {
    this._closeDeleteModal();
  } else {
    // Clear search if no modals open
    this._clearSearch();
  }
}

/**
 * Focus search input with selection
 * @private
 */
_focusSearch() {
  const searchInput = this._getElement('conceptSearch');
  if (searchInput) {
    searchInput.focus();
    searchInput.select(); // Select existing text for easy replacement

    this.logger.debug('Search input focused via keyboard shortcut');
  }
}

/**
 * Show help dialog with keyboard shortcuts
 * @private
 */
_showHelpDialog() {
  // Implementation for showing help dialog
  // This could be a modal or a toast notification
  const helpText = `
Keyboard Shortcuts:
• Ctrl/Cmd + N: Create new concept
• Ctrl/Cmd + F: Focus search
• Escape: Close modal or clear search
• F1 or Ctrl/Cmd + ?: Show this help
• F5 or Ctrl/Cmd + R: Refresh (with confirmation)
  `;

  // Use base class notification system if available
  if (this._showNotification) {
    this._showNotification(helpText, { type: 'info', duration: 10000 });
  } else {
    // Fallback to alert
    alert(helpText);
  }

  this.logger.debug('Help dialog shown');
}
```

**Implementation Details:**

1. **Enhanced Shortcut Management**
   - Context-aware shortcut handling
   - Conflict detection and prevention
   - Accessibility considerations

2. **Base Class Integration**
   - Use base class event management
   - Automatic cleanup on destroy
   - Consistent error handling

3. **User Experience Improvements**
   - Smart focus management
   - Help system for shortcuts
   - Confirmation for destructive actions

**Validation:**

- All keyboard shortcuts work correctly
- Shortcuts disabled appropriately in input contexts
- Escape key closes modals in correct order
- Help system displays shortcuts

### Step 5: Session State Persistence Enhancement

**Duration:** 30 minutes

**Enhanced Session Management:**

```javascript
/**
 * Enhanced session state management
 * @private
 */
_initializeSessionManagement() {
  // Restore state on initialization
  this._restoreSearchState();

  // Set up periodic state saving
  this._setupPeriodicStateSave();

  // Register page unload handler
  this._registerPageUnloadHandler();
}

/**
 * Set up periodic state saving
 * @private
 */
_setupPeriodicStateSave() {
  // Save state every 30 seconds to prevent data loss
  this._setInterval(() => {
    this._saveSearchState();
  }, 30000);
}

/**
 * Register page unload handler using base class
 * @private
 */
_registerPageUnloadHandler() {
  this._addEventListener('window', 'beforeunload', (e) => {
    // Save final state
    this._saveSearchState();

    // Clean up cross-tab sync
    this._cleanupCrossTabSync();

    // Check for unsaved changes
    if (this._hasUnsavedChanges()) {
      e.preventDefault();
      e.returnValue = ''; // Chrome requires returnValue to be set
      return 'You have unsaved changes. Are you sure you want to leave?';
    }
  });
}
```

## Testing Strategy

### Unit Testing Advanced Features

```javascript
describe('Advanced Feature Preservation', () => {
  describe('Cross-Tab Synchronization', () => {
    it('should initialize cross-tab sync correctly', () => {
      const controller = createTestController();

      controller._initializeCrossTabSync();

      expect(controller.#syncChannel).toBeInstanceOf(BroadcastChannel);
      expect(controller.#tabId).toMatch(/^tab-\d+-[a-z0-9]+$/);
      expect(controller.#isLeader).toBe(true);
    });

    it('should handle cross-tab messages correctly', () => {
      const controller = createTestController();
      controller._initializeCrossTabSync();

      const mockEvent = {
        data: {
          type: 'CONCEPT_CREATED',
          data: { id: '1', concept: 'Test' },
          tabId: 'other-tab',
          timestamp: Date.now(),
        },
      };

      const handleSpy = jest.spyOn(controller, '_handleRemoteConceptCreated');
      controller._handleCrossTabMessage(mockEvent);

      expect(handleSpy).toHaveBeenCalledWith(mockEvent.data.data);
    });
  });

  describe('Search Analytics', () => {
    it('should track search analytics correctly', () => {
      const controller = createTestController();

      controller._trackSearchAnalytics('test search');

      expect(controller.#searchAnalytics.searches).toHaveLength(1);
      expect(controller.#searchAnalytics.totalSearches).toBe(1);
      expect(controller.#searchAnalytics.lastSearchTime).toBeTruthy();
    });

    it('should save and restore search state', () => {
      const controller = createTestController();
      setupMockDOM();

      // Set up search state
      controller.#searchFilter = 'test';
      controller._saveSearchState();

      // Create new controller and restore
      const newController = createTestController();
      newController._restoreSearchState();

      expect(newController.#searchFilter).toBe('test');
    });
  });

  describe('Animation Management', () => {
    it('should register animations for cleanup', () => {
      const controller = createTestController();
      const mockAnimation = { cancel: jest.fn(), playState: 'running' };

      controller._registerAnimation(mockAnimation);
      controller._cleanupAnimations();

      expect(mockAnimation.cancel).toHaveBeenCalled();
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should handle keyboard shortcuts correctly', () => {
      const controller = createTestController();
      const showModalSpy = jest.spyOn(controller, '_showCreateModal');

      const mockEvent = {
        ctrlKey: true,
        key: 'n',
        preventDefault: jest.fn(),
      };

      controller._handleKeyboardShortcut(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(showModalSpy).toHaveBeenCalled();
    });
  });
});
```

## Verification Steps

### 1. Cross-Tab Synchronization Testing

```bash
# Open multiple tabs and verify:
# - Concept creation syncs across tabs
# - Search state syncs across tabs
# - Leader election works correctly
# - Proper cleanup on tab close
```

### 2. Search Analytics Verification

```bash
# Test search functionality:
# - Search analytics track correctly
# - State restoration works on page reload
# - Session storage handles errors gracefully
# - Performance impact is minimal
```

### 3. Animation Testing

```bash
# Test modal animations:
# - Smooth animation performance
# - Proper animation cleanup
# - Fallback behavior on animation errors
# - Accessibility considerations
```

### 4. Keyboard Shortcuts Testing

```bash
# Test all keyboard shortcuts:
# - Ctrl/Cmd + N creates concept
# - Ctrl/Cmd + F focuses search
# - Escape closes modals
# - F1 shows help
# - Context-aware disabling works
```

## Success Criteria

### Functional Requirements ✅

1. **Cross-Tab Sync**: Full synchronization of concepts and search across tabs
2. **Search Analytics**: Comprehensive search tracking and state restoration
3. **Animation Management**: Smooth animations with proper cleanup
4. **Keyboard Shortcuts**: All shortcuts working with context awareness
5. **Session Persistence**: Reliable state saving and restoration

### Technical Requirements ✅

1. **Base Class Integration**: All features use base class patterns where applicable
2. **Error Handling**: Enhanced error handling and graceful degradation
3. **Performance**: No performance degradation from advanced features
4. **Memory Management**: Proper cleanup prevents memory leaks
5. **Code Quality**: Improved organization and maintainability

### Quality Requirements ✅

1. **Reliability**: Enhanced reliability through base class infrastructure
2. **User Experience**: Improved UX through better error handling and state management
3. **Maintainability**: Cleaner code organization and consistent patterns
4. **Testability**: Comprehensive test coverage for all advanced features
5. **Accessibility**: Improved accessibility through better keyboard handling

## Next Steps

Upon successful completion of CHARCONMIG-06:

1. **CHARCONMIG-07**: Migrate test infrastructure to base class patterns
2. **CHARCONMIG-08**: Final cleanup and optimization

**Completion Time Estimate**: 8 hours with comprehensive testing and validation
