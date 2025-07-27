# Ticket 10: Event Handling and UI Updates

## Overview

Implement comprehensive event handling for CharacterBuilderService events (CONCEPT_CREATED, UPDATED, DELETED, DIRECTIONS_GENERATED) and ensure UI consistency across browser tabs.

## Dependencies

- Ticket 03: Controller Setup (completed)
- Ticket 05: Display Concepts (completed)
- Previous tickets for basic functionality

## Implementation Details

### 1. Complete Event Handler Implementations

In `CharacterConceptsManagerController`, implement all event handlers:

```javascript
/**
 * Handle concept created event
 * @param {CustomEvent} event
 */
#handleConceptCreated(event) {
    this.#logger.info('Concept created event received', event.detail);

    const { concept } = event.detail;

    // Check if concept already exists (duplicate event prevention)
    const exists = this.#conceptsData.some(
        ({ concept: c }) => c.id === concept.id
    );

    if (exists) {
        this.#logger.warn('Concept already exists, ignoring duplicate event', {
            conceptId: concept.id
        });
        return;
    }

    // Add to local cache immediately
    const newConceptData = {
        concept,
        directionCount: 0 // New concepts have no directions
    };

    this.#conceptsData.push(newConceptData);

    // Sort by creation date (newest first)
    this.#sortConceptsData();

    // Update display
    this.#refreshDisplay();

    // Show success feedback
    this.#showConceptCreatedFeedback(concept);

    // Update statistics
    this.#updateStatistics();

    // Check for milestones
    this.#checkMilestones('created');
}

/**
 * Handle concept updated event
 * @param {CustomEvent} event
 */
#handleConceptUpdated(event) {
    this.#logger.info('Concept updated event received', event.detail);

    const { concept: updatedConcept } = event.detail;

    // Find and update in local cache
    const index = this.#conceptsData.findIndex(
        ({ concept }) => concept.id === updatedConcept.id
    );

    if (index === -1) {
        this.#logger.warn('Updated concept not found in cache', {
            conceptId: updatedConcept.id
        });
        // Reload data to sync
        this.#loadConceptsData();
        return;
    }

    // Preserve direction count
    const directionCount = this.#conceptsData[index].directionCount;

    // Update concept
    this.#conceptsData[index] = {
        concept: updatedConcept,
        directionCount
    };

    // Update specific card if visible
    if (this.#isConceptVisible(updatedConcept.id)) {
        this.#updateConceptCard(updatedConcept, directionCount);
    }

    // Update statistics in case text length affected categories
    this.#updateStatistics();
}

/**
 * Handle concept deleted event
 * @param {CustomEvent} event
 */
#handleConceptDeleted(event) {
    this.#logger.info('Concept deleted event received', event.detail);

    const { conceptId, cascadedDirections = 0 } = event.detail;

    // Remove from local cache
    const removedIndex = this.#conceptsData.findIndex(
        ({ concept }) => concept.id === conceptId
    );

    if (removedIndex !== -1) {
        const removed = this.#conceptsData.splice(removedIndex, 1)[0];

        // Log cascade deletion info
        if (cascadedDirections > 0) {
            this.#logger.info('Cascade deleted directions', {
                conceptId,
                count: cascadedDirections
            });
        }
    }

    // Remove card from UI with animation
    this.#removeConceptCard(conceptId);

    // Update display state
    if (this.#conceptsData.length === 0) {
        this.#uiStateManager.setState('empty');
    }

    // Update statistics
    this.#updateStatistics();

    // Show deletion feedback
    this.#showConceptDeletedFeedback(cascadedDirections);
}

/**
 * Handle directions generated event
 * @param {CustomEvent} event
 */
#handleDirectionsGenerated(event) {
    this.#logger.info('Directions generated event received', event.detail);

    const { conceptId, directions, count } = event.detail;

    // Update direction count in cache
    const conceptData = this.#conceptsData.find(
        ({ concept }) => concept.id === conceptId
    );

    if (!conceptData) {
        this.#logger.warn('Concept not found for directions update', { conceptId });
        return;
    }

    // Update count
    const oldCount = conceptData.directionCount;
    conceptData.directionCount = count || directions?.length || 0;

    // Update card if visible
    if (this.#isConceptVisible(conceptId)) {
        this.#updateConceptCard(conceptData.concept, conceptData.directionCount);

        // Add generation animation
        this.#animateDirectionsGenerated(conceptId, oldCount, conceptData.directionCount);
    }

    // Update statistics
    this.#updateStatistics();

    // Check for completion milestone
    if (oldCount === 0 && conceptData.directionCount > 0) {
        this.#checkMilestones('directions-added');
    }
}
```

### 2. Implement Cross-Tab Synchronization

Add BroadcastChannel support for multi-tab sync:

```javascript
// Add to class properties
#broadcastChannel = null;
#isLeaderTab = false;
#tabId = `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

/**
 * Initialize cross-tab communication
 */
#initializeCrossTabSync() {
    try {
        // Create broadcast channel
        this.#broadcastChannel = new BroadcastChannel('character-concepts-manager');

        // Listen for messages from other tabs
        this.#broadcastChannel.addEventListener('message', (event) => {
            this.#handleCrossTabMessage(event.data);
        });

        // Announce this tab
        this.#broadcastMessage({
            type: 'tab-opened',
            tabId: this.#tabId,
            timestamp: Date.now()
        });

        // Set up leader election
        this.#performLeaderElection();

        this.#logger.info('Cross-tab sync initialized', { tabId: this.#tabId });

    } catch (error) {
        // BroadcastChannel not supported
        this.#logger.warn('BroadcastChannel not supported, cross-tab sync disabled');
    }
}

/**
 * Handle messages from other tabs
 * @param {Object} message
 */
#handleCrossTabMessage(message) {
    this.#logger.debug('Cross-tab message received', message);

    switch (message.type) {
        case 'tab-opened':
            // Another tab opened, re-elect leader
            this.#performLeaderElection();
            break;

        case 'tab-closed':
            // A tab closed, might need new leader
            if (message.wasLeader) {
                this.#performLeaderElection();
            }
            break;

        case 'data-changed':
            // Data changed in another tab
            if (message.tabId !== this.#tabId) {
                this.#handleRemoteDataChange(message.changeType, message.data);
            }
            break;

        case 'leader-elected':
            // New leader elected
            this.#isLeaderTab = message.tabId === this.#tabId;
            break;
    }
}

/**
 * Broadcast message to other tabs
 * @param {Object} message
 */
#broadcastMessage(message) {
    if (this.#broadcastChannel) {
        try {
            this.#broadcastChannel.postMessage({
                ...message,
                tabId: this.#tabId,
                timestamp: Date.now()
            });
        } catch (error) {
            this.#logger.error('Failed to broadcast message', error);
        }
    }
}

/**
 * Handle data changes from other tabs
 * @param {string} changeType
 * @param {Object} data
 */
#handleRemoteDataChange(changeType, data) {
    this.#logger.info('Remote data change detected', { changeType });

    // Debounce rapid changes
    if (this.#remoteChangeTimeout) {
        clearTimeout(this.#remoteChangeTimeout);
    }

    this.#remoteChangeTimeout = setTimeout(() => {
        // Reload data to sync with other tabs
        this.#loadConceptsData();
    }, 500);
}

/**
 * Perform leader election for cross-tab coordination
 */
#performLeaderElection() {
    // Simple leader election: lowest tab ID wins
    this.#broadcastMessage({
        type: 'leader-election',
        tabId: this.#tabId
    });

    // Wait for other tabs to respond
    setTimeout(() => {
        // If no other tabs claimed leadership, this tab is leader
        this.#isLeaderTab = true;
        this.#broadcastMessage({
            type: 'leader-elected',
            tabId: this.#tabId
        });
    }, 100);
}

// Update initialize method to include cross-tab sync
async initialize() {
    // ... existing initialization ...

    // Initialize cross-tab sync
    this.#initializeCrossTabSync();

    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
        this.#cleanup();
    });
}

/**
 * Cleanup before page unload
 */
#cleanup() {
    // Notify other tabs
    if (this.#broadcastChannel) {
        this.#broadcastMessage({
            type: 'tab-closed',
            wasLeader: this.#isLeaderTab
        });

        this.#broadcastChannel.close();
    }

    // Clean up animations
    this.#cleanupAnimations();
}
```

### 3. Implement UI Feedback Methods

Add visual feedback for events:

```javascript
/**
 * Show feedback when concept is created
 * @param {Object} concept
 */
#showConceptCreatedFeedback(concept) {
    // Flash the new card
    setTimeout(() => {
        const card = this.#elements.conceptsResults.querySelector(
            `[data-concept-id="${concept.id}"]`
        );
        if (card) {
            card.classList.add('concept-new');
            card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

            setTimeout(() => {
                card.classList.remove('concept-new');
            }, 2000);
        }
    }, 100);

    // Show notification
    this.#showNotification('✅ Character concept created successfully', 'success');
}

/**
 * Show feedback when concept is deleted
 * @param {number} cascadedDirections
 */
#showConceptDeletedFeedback(cascadedDirections) {
    let message = '🗑️ Character concept deleted';
    if (cascadedDirections > 0) {
        message += ` (${cascadedDirections} direction${cascadedDirections === 1 ? '' : 's'} also removed)`;
    }

    this.#showNotification(message, 'info');
}

/**
 * Animate directions generation
 * @param {string} conceptId
 * @param {number} oldCount
 * @param {number} newCount
 */
#animateDirectionsGenerated(conceptId, oldCount, newCount) {
    const card = this.#elements.conceptsResults.querySelector(
        `[data-concept-id="${conceptId}"]`
    );

    if (!card) return;

    // Add generation animation
    card.classList.add('directions-generated');

    // Update count with animation
    const countElement = card.querySelector('.direction-count strong');
    if (countElement) {
        // Animate number change
        this.#animateNumberChange(countElement, oldCount, newCount);
    }

    // Update status if first directions
    if (oldCount === 0 && newCount > 0) {
        const statusElement = card.querySelector('.concept-status');
        if (statusElement) {
            statusElement.classList.remove('draft');
            statusElement.classList.add('completed');
            statusElement.textContent = 'Has Directions';
        }
    }

    // Remove animation class
    setTimeout(() => {
        card.classList.remove('directions-generated');
    }, 1000);
}

/**
 * Show notification
 * @param {string} message
 * @param {string} type - 'success', 'info', 'warning', 'error'
 */
#showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <span class="notification-message">${message}</span>
        <button class="notification-close" aria-label="Close">×</button>
    `;

    // Add to notification container or create one
    let container = document.querySelector('.notification-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'notification-container';
        document.body.appendChild(container);
    }

    container.appendChild(notification);

    // Close handler
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
        notification.classList.add('notification-closing');
        setTimeout(() => notification.remove(), 300);
    });

    // Auto-close after delay
    setTimeout(() => {
        if (notification.parentElement) {
            notification.classList.add('notification-closing');
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);

    // Animate in
    setTimeout(() => {
        notification.classList.add('notification-show');
    }, 10);
}
```

### 4. Implement Helper Methods

Add utility methods for event handling:

```javascript
/**
 * Check if concept is currently visible
 * @param {string} conceptId
 * @returns {boolean}
 */
#isConceptVisible(conceptId) {
    const card = this.#elements.conceptsResults.querySelector(
        `[data-concept-id="${conceptId}"]`
    );
    return !!card;
}

/**
 * Remove concept card with animation
 * @param {string} conceptId
 */
#removeConceptCard(conceptId) {
    const card = this.#elements.conceptsResults.querySelector(
        `[data-concept-id="${conceptId}"]`
    );

    if (card) {
        card.classList.add('concept-removing');

        setTimeout(() => {
            card.remove();

            // Check if empty
            if (this.#elements.conceptsResults.children.length === 0 &&
                this.#conceptsData.length === 0) {
                this.#uiStateManager.setState('empty');
            }
        }, 300);
    }
}

/**
 * Sort concepts data by creation date
 */
#sortConceptsData() {
    this.#conceptsData.sort((a, b) => {
        const dateA = new Date(a.concept.createdAt);
        const dateB = new Date(b.concept.createdAt);
        return dateB - dateA; // Newest first
    });
}

/**
 * Refresh the display maintaining current state
 */
#refreshDisplay() {
    const currentFilter = this.#searchFilter;
    const filteredConcepts = this.#filterConcepts(this.#conceptsData);

    // Maintain scroll position
    const scrollTop = this.#elements.conceptsResults.scrollTop;

    // Update display
    this.#displayConcepts(filteredConcepts);

    // Restore scroll
    this.#elements.conceptsResults.scrollTop = scrollTop;

    // Update search state if active
    if (currentFilter) {
        this.#updateSearchState(currentFilter, filteredConcepts.length);
    }
}

/**
 * Check for milestones
 * @param {string} action - 'created', 'deleted', 'directions-added'
 */
#checkMilestones(action) {
    const stats = this.#calculateStatistics();

    switch (action) {
        case 'created':
            if (stats.totalConcepts === 1) {
                this.#showMilestone('🎉 First Concept Created!');
            } else if (stats.totalConcepts % 10 === 0) {
                this.#showMilestone(`🎊 ${stats.totalConcepts} Concepts Created!`);
            }
            break;

        case 'directions-added':
            if (stats.completionRate === 100 && stats.totalConcepts > 1) {
                this.#showMilestone('⭐ All Concepts Have Directions!');
            } else if (stats.conceptsWithDirections === 1) {
                this.#showMilestone('🌟 First Concept Completed!');
            }
            break;
    }
}

/**
 * Animate number change
 * @param {HTMLElement} element
 * @param {number} from
 * @param {number} to
 */
#animateNumberChange(element, from, to) {
    const duration = 500;
    const steps = 20;
    const increment = (to - from) / steps;
    const stepDuration = duration / steps;

    let current = from;
    let step = 0;

    const animation = setInterval(() => {
        step++;
        current = from + (increment * step);

        if (step >= steps) {
            element.textContent = to;
            clearInterval(animation);
        } else {
            element.textContent = Math.round(current);
        }
    }, stepDuration);
}

/**
 * Clean up animations
 */
#cleanupAnimations() {
    // Clear any running animations
    const elements = document.querySelectorAll('[data-animation]');
    elements.forEach(el => {
        if (el.animationInterval) {
            clearInterval(el.animationInterval);
        }
    });
}
```

### 5. Add Event CSS Animations

Add these styles to character-concepts-manager.css:

```css
/* Event animations */
.concept-card.concept-new {
  animation: conceptCreated 1s ease-out;
  border-color: #2ecc71;
  box-shadow: 0 0 20px rgba(46, 204, 113, 0.3);
}

@keyframes conceptCreated {
  0% {
    opacity: 0;
    transform: scale(0.8) translateY(20px);
  }
  50% {
    transform: scale(1.05);
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.concept-card.directions-generated {
  animation: directionsAdded 0.6s ease-out;
}

@keyframes directionsAdded {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.02);
    box-shadow: 0 0 20px rgba(139, 92, 246, 0.4);
  }
}

.concept-card.concept-removing {
  animation: conceptRemoved 0.3s ease-out forwards;
}

@keyframes conceptRemoved {
  0% {
    opacity: 1;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(0.9);
  }
}

/* Notifications */
.notification-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 10px;
  pointer-events: none;
}

.notification {
  background: white;
  border-radius: 8px;
  padding: 1rem 2rem 1rem 1rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  display: flex;
  align-items: center;
  gap: 1rem;
  transform: translateX(400px);
  transition: transform 0.3s ease-out;
  pointer-events: auto;
  position: relative;
  min-width: 300px;
}

.notification.notification-show {
  transform: translateX(0);
}

.notification.notification-closing {
  transform: translateX(400px);
  opacity: 0;
}

.notification-success {
  border-left: 4px solid #2ecc71;
}

.notification-info {
  border-left: 4px solid #3498db;
}

.notification-warning {
  border-left: 4px solid #f39c12;
}

.notification-error {
  border-left: 4px solid #e74c3c;
}

.notification-close {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  background: transparent;
  border: none;
  font-size: 1.25rem;
  cursor: pointer;
  color: var(--text-secondary);
  padding: 0.25rem;
  line-height: 1;
}

.notification-close:hover {
  color: var(--text-primary);
}

/* Milestone notifications */
.milestone-notification {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) scale(0);
  background: linear-gradient(
    135deg,
    var(--narrative-purple),
    var(--narrative-purple-dark)
  );
  color: white;
  padding: 2rem 3rem;
  border-radius: 16px;
  font-size: 1.25rem;
  font-weight: 600;
  box-shadow: 0 10px 40px rgba(139, 92, 246, 0.4);
  z-index: 1001;
  opacity: 0;
  transition: all 0.5s ease-out;
}

.milestone-notification.show {
  transform: translate(-50%, -50%) scale(1);
  opacity: 1;
}
```

### 6. Add Event Cleanup

Ensure proper cleanup of event listeners:

```javascript
/**
 * Cleanup method for component destruction
 */
destroy() {
    this.#logger.info('Destroying CharacterConceptsManagerController');

    // Remove event listeners
    if (this.#eventBus) {
        import('../characterBuilder/characterBuilderEvents.js').then(({ CHARACTER_BUILDER_EVENTS }) => {
            this.#eventBus.off(CHARACTER_BUILDER_EVENTS.CONCEPT_CREATED,
                this.#handleConceptCreated.bind(this));
            this.#eventBus.off(CHARACTER_BUILDER_EVENTS.CONCEPT_UPDATED,
                this.#handleConceptUpdated.bind(this));
            this.#eventBus.off(CHARACTER_BUILDER_EVENTS.CONCEPT_DELETED,
                this.#handleConceptDeleted.bind(this));
            this.#eventBus.off(CHARACTER_BUILDER_EVENTS.DIRECTIONS_GENERATED,
                this.#handleDirectionsGenerated.bind(this));
        });
    }

    // Close broadcast channel
    if (this.#broadcastChannel) {
        this.#broadcastChannel.close();
    }

    // Clean up animations
    this.#cleanupAnimations();

    // Clear timeouts
    if (this.#remoteChangeTimeout) {
        clearTimeout(this.#remoteChangeTimeout);
    }

    // Remove window listeners
    window.removeEventListener('beforeunload', this.#cleanup);
}
```

## Acceptance Criteria

1. ✅ All service events are properly handled
2. ✅ UI updates immediately on events
3. ✅ Cross-tab synchronization works
4. ✅ Visual feedback for all operations
5. ✅ Notifications appear for important events
6. ✅ Milestones are celebrated
7. ✅ Direction count updates animate
8. ✅ Duplicate events are prevented
9. ✅ Remote changes sync properly
10. ✅ All event listeners are cleaned up

## Testing Requirements

1. Test each event type individually
2. Test rapid event sequences
3. Test cross-tab synchronization
4. Test with multiple tabs open
5. Test event handling during search
6. Test milestone triggers
7. Test notification display and auto-close
8. Test cleanup on page unload

## Notes

- Consider implementing event debouncing for rapid updates
- Test cross-tab sync with different browsers
- Ensure animations don't cause performance issues
- Make notifications accessible to screen readers
- Consider implementing event replay for offline scenarios
