# Perceptible Event Sender UI Component - Design Specification

## Overview

Create a new UI panel in the right sidebar between the "Characters" panel and "Game Menu" panel that allows users to send custom perceptible events to actors in specific locations.

## Current System Analysis

### Game UI Structure (game.html)

The right sidebar (`#right-pane`) currently contains:
1. **Location Info Container** (lines 81-121): Displays location summary, exits, and characters
2. **Characters Panel** (lines 117-120): `<details id="location-characters-card">` - collapsible actor list
3. **Game Menu** (lines 124-139): `<div id="game-actions-widget">` - save/load/LLM selection
4. **Entity Lifecycle Monitor** (lines 142-152): Disabled debug panel

**Insertion Point:** After line 121 (after characters panel, before game menu)

### Perceptible Event System Architecture

#### Event Flow
1. User triggers `DISPATCH_PERCEPTIBLE_EVENT` operation
2. Handler: `dispatchPerceptibleEventHandler.js` processes parameters
3. Dispatches `core:perceptible_event` via event bus
4. Event added to actors' perception logs via `addPerceptionLogEntryHandler.js`

#### Operation Handler

**File:** `src/logic/operationHandlers/dispatchPerceptibleEventHandler.js`

**Key Parameters:**
- `location_id` (string, required): Target location ID
- `description_text` (string, required): Message text to be perceived
- `perception_type` (string, required): Event classification (e.g., 'custom_event', 'gm_event')
- `actor_id` (string, required): Originating actor ID (use 'gm' for system)
- `target_id` (string, optional): Primary target entity
- `involved_entities` (array, optional): Additional involved entities
- `contextualData` (object, optional):
  - `recipientIds` (array): Specific actor IDs to receive event
  - `excludedActorIds` (array): Actor IDs to exclude from event
  - **Note:** `recipientIds` and `excludedActorIds` are mutually exclusive
  - **Implementation Note:** Handler internally normalizes to `contextual_data` (underscore) for processing
- `log_entry` (boolean, optional): Whether to log in perception log (default: false)

#### Handler Validation
- Validates location_id, description_text, perception_type, actor_id are non-empty strings
- Ensures recipientIds and excludedActorIds are not both populated
- Dispatches error events for validation failures
- Normalizes contextualData with default empty arrays

#### Example Usage from Mods

**From `handle_pick_up_item.rule.json`:**
```json
{
  "type": "DISPATCH_PERCEPTIBLE_EVENT",
  "parameters": {
    "location_id": "{context.actorPosition.locationId}",
    "description_text": "{context.actorName} picks up {context.itemName}.",
    "perception_type": "item_picked_up",
    "actor_id": "{event.payload.actorId}",
    "involved_entities": ["{event.payload.targetId}"]
  }
}
```

**From `logSuccessAndEndTurn.macro.json`:**
```json
{
  "type": "DISPATCH_EVENT",
  "parameters": {
    "eventType": "core:perceptible_event",
    "payload": {
      "eventName": "core:perceptible_event",
      "locationId": "{context.locationId}",
      "descriptionText": "{context.logMessage}",
      "timestamp": "{context.nowIso}",
      "perceptionType": "{context.perceptionType}",
      "actorId": "{event.payload.actorId}",
      "targetId": "{context.targetId}",
      "involvedEntities": []
    }
  }
}
```

### DOM UI Architecture

**Location:** `src/domUI/`

**Key Components:**
- `engineUIManager.js`: Central UI coordinator
- `actionButtonsRenderer.js`: Action button management
- `saveGameUI.js`, `loadGameUI.js`: Modal screens
- `llmSelectionModal.js`: LLM configuration modal
- `perceptionLogRenderer.js`: Perception log display

**Pattern:** Most UI components follow dependency injection with:
- Event bus for communication
- Document context for DOM access
- Logger for debugging

## Implementation Plan

### 1. HTML Structure Addition

**File:** `game.html`
**Location:** After line 121 (after `location-characters-card`, before `game-actions-widget`)

```html
<!-- PERCEPTIBLE EVENT SENDER -->
<div
  id="perceptible-event-sender-widget"
  class="widget"
  role="region"
  aria-labelledby="perceptible-event-heading"
>
  <h3 id="perceptible-event-heading">Send Perceptible Event</h3>

  <!-- Message Input -->
  <div class="form-group">
    <label for="perceptible-event-message">Event Message</label>
    <textarea
      id="perceptible-event-message"
      class="perceptible-event-textarea"
      placeholder="Enter event description (e.g., 'A loud crash echoes from nearby')"
      rows="3"
      aria-describedby="message-help"
    ></textarea>
    <span id="message-help" class="help-text">
      Describe what actors in the location perceive
    </span>
  </div>

  <!-- Location Selector -->
  <div class="form-group">
    <label for="perceptible-event-location">Target Location</label>
    <select
      id="perceptible-event-location"
      class="perceptible-event-select"
      aria-describedby="location-help"
    >
      <option value="">-- Select Location --</option>
    </select>
    <span id="location-help" class="help-text">
      Location where event will be perceived
    </span>
  </div>

  <!-- Recipient Filter (Optional) -->
  <details class="filter-section">
    <summary>Advanced Filters (Optional)</summary>

    <div class="filter-group">
      <label>
        <input
          type="radio"
          name="filter-mode"
          value="all"
          checked
          aria-describedby="filter-mode-help"
        />
        All actors in location
      </label>

      <label>
        <input
          type="radio"
          name="filter-mode"
          value="specific"
        />
        Specific actors only
      </label>

      <label>
        <input
          type="radio"
          name="filter-mode"
          value="exclude"
        />
        Exclude specific actors
      </label>
    </div>

    <div id="actor-filter-container" style="display: none;">
      <select
        id="perceptible-event-actors"
        class="perceptible-event-select"
        multiple
        size="4"
        aria-label="Select actors"
      >
      </select>
    </div>

    <span id="filter-mode-help" class="help-text">
      Choose who perceives the event
    </span>
  </details>

  <!-- Send Button -->
  <button
    type="button"
    id="send-perceptible-event-button"
    class="button-primary"
    disabled
  >
    Send Event
  </button>

  <!-- Status Message -->
  <div
    id="perceptible-event-status"
    class="status-message-area"
    role="status"
    aria-live="polite"
  ></div>
</div>
```

### 2. JavaScript Controller Component

**New File:** `src/domUI/perceptibleEventSenderController.js`

**Class Structure:**

```javascript
/**
 * @file perceptibleEventSenderController.js
 * @description Controller for sending custom perceptible events to actors in locations
 */

/** @typedef {import('../interfaces/ISafeEventDispatcher.js').default} ISafeEventDispatcher */
/** @typedef {import('./documentContext.js').default} IDocumentContext */
/** @typedef {import('../logging/logger.js').default} ILogger */

class PerceptibleEventSenderController {
  #eventBus;
  #documentContext;
  #logger;
  #elements;
  #boundHandlers;
  #currentLocationId;
  #actorsInLocation;

  constructor({ eventBus, documentContext, logger }) {
    // Validate dependencies
    // Initialize properties
  }

  initialize() {
    // Cache DOM elements
    // Set up event listeners
    // Subscribe to event bus events
    // Initial state setup
  }

  #cacheElements() {
    // Cache all DOM element references
  }

  #attachEventListeners() {
    // Message input change
    // Location select change
    // Filter mode radio changes
    // Send button click
  }

  #subscribeToEvents() {
    // core:world_initialized - load locations
    // core:location_changed - update current location
  }

  loadLocations() {
    // Query all locations from entity system
    // Populate location dropdown
  }

  onLocationChange(locationId) {
    // Update current location
    // Load actors for location
    // Refresh validation
  }

  #loadActorsForLocation(locationId) {
    // Query entities with core:position.locationId === locationId
    // Filter for actors (entities with core:actor component)
    // Populate actor selector
  }

  onFilterModeChange(mode) {
    // Show/hide actor selector based on mode
    // Clear actor selections if switching modes
    // Refresh validation
  }

  validateForm() {
    // Check message not empty
    // Check location selected
    // Check actor selections valid for filter mode
    // Enable/disable send button
  }

  async sendPerceptibleEvent() {
    // Gather form data
    // Construct operation parameters
    // Dispatch via event bus
    // Show success/error status
    // Clear form on success
  }

  #constructEventPayload() {
    // Build DISPATCH_PERCEPTIBLE_EVENT parameters
    // Handle filter mode (all/specific/exclude)
    // Return operation object
  }

  showStatus(message, type) {
    // Display status message (success/error/info)
    // Auto-clear after timeout
  }

  #clearForm() {
    // Reset all form inputs
    // Clear selections
    // Disable send button
  }

  cleanup() {
    // Remove event listeners
    // Unsubscribe from event bus
    // Clear state
  }
}

export default PerceptibleEventSenderController;
```

**Key Implementation Details:**

#### A. Location Loading
```javascript
async loadLocations() {
  try {
    // Recommended: Use EntityManager's built-in query method
    const locations = await this.#entityManager.getEntitiesWithComponent('core:location');

    // Alternative: Via Scope DSL (if available)
    // const locations = await this.#queryLocations();

    this.#populateLocationDropdown(locations);
  } catch (err) {
    this.#logger.error('Failed to load locations', err);
    this.showStatus('Failed to load locations', 'error');
  }
}
```

#### B. Actor Loading
```javascript
async #loadActorsForLocation(locationId) {
  try {
    // Query entities with matching position component
    const actors = await this.#queryActorsInLocation(locationId);

    this.#actorsInLocation = actors;
    this.#populateActorDropdown(actors);
  } catch (err) {
    this.#logger.error('Failed to load actors', err);
    this.#actorsInLocation = [];
  }
}
```

#### C. Event Payload Construction
```javascript
#constructEventPayload() {
  const message = this.#elements.messageInput.value.trim();
  const locationId = this.#elements.locationSelect.value;
  const filterMode = this.#getSelectedFilterMode();
  const selectedActorIds = this.#getSelectedActorIds();

  const contextualData = {};

  if (filterMode === 'specific') {
    contextualData.recipientIds = selectedActorIds;
  } else if (filterMode === 'exclude') {
    contextualData.excludedActorIds = selectedActorIds;
  }
  // 'all' mode: leave both arrays empty

  return {
    type: 'DISPATCH_PERCEPTIBLE_EVENT',
    parameters: {
      location_id: locationId,
      description_text: message,
      perception_type: 'gm_custom_event',
      actor_id: 'gm', // System actor
      contextualData,
      log_entry: true // Always log for perception tracking
    }
  };
}
```

### 3. Integration Points

#### A. Event Bus Integration

**Events to Listen:**
- `core:world_initialized` → Load locations initially
- `core:location_changed` → Update UI when player changes location
- `core:entities_updated` → Refresh actor lists if entities change
- **Note:** Some event type strings may not be exported as constants in `eventIds.js`. Verify actual event names used in the system before implementation.

**Events to Dispatch:**
- `core:attempt_action` (constant: `ATTEMPT_ACTION_ID` in `src/constants/eventIds.js:17`) with payload containing DISPATCH_PERCEPTIBLE_EVENT operation

```javascript
async sendPerceptibleEvent() {
  const payload = this.#constructEventPayload();

  this.#eventBus.dispatch('core:attempt_action', {
    actionId: 'gm:send_perceptible_event',
    actorId: 'gm',
    operations: [payload]
  });

  this.showStatus('Event sent successfully', 'success');
  this.#clearForm();
}
```

#### B. Entity System Integration

**Required Queries:**

1. **Get All Locations:**
```javascript
// Recommended: Use EntityManager's optimized query method (uses internal indexing)
const locations = entityManager.getEntitiesWithComponent('core:location');

// Alternative: Via Scope DSL (if available)
// const locationScope = 'entities[{"has": ["core:location"]}]';

// Less optimal: Manual filtering (bypasses entity indexing)
// const locations = entities.filter(e => e.components.has('core:location'));
```

2. **Get Actors in Location:**
```javascript
// Query entities with position component matching location
const actorsInLocation = entities.filter(e => {
  const position = e.components.get('core:position');
  return position?.locationId === targetLocationId &&
         e.components.has('core:actor');
});
```

#### C. UI Manager Registration

**File:** `src/domUI/engineUIManager.js`

```javascript
import PerceptibleEventSenderController from './perceptibleEventSenderController.js';

// In EngineUIManager constructor or initialization
this.#perceptibleEventSender = new PerceptibleEventSenderController({
  eventBus: this.#eventBus,
  documentContext: this.#documentContext,
  logger: this.#logger
});

// In initialization method
await this.#perceptibleEventSender.initialize();

// In cleanup method
this.#perceptibleEventSender.cleanup();
```

#### D. Styling

**File:** `css/style.css` (or new `css/widgets/perceptible-event-sender.css`)

```css
/* Perceptible Event Sender Widget */
#perceptible-event-sender-widget {
  margin-top: 1rem;
  padding: 1rem;
  background: var(--panel-bg-color);
  border-radius: var(--border-radius-standard);
}

#perceptible-event-sender-widget .form-group {
  margin-bottom: 1rem;
}

#perceptible-event-sender-widget label {
  display: block;
  font-weight: 600;
  margin-bottom: 0.25rem;
  color: var(--primary-text-color);
}

.perceptible-event-textarea {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-sm);
  font-family: inherit;
  font-size: 0.9rem;
  resize: vertical;
}

.perceptible-event-select {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-sm);
}

.help-text {
  display: block;
  font-size: 0.85rem;
  color: var(--secondary-text-color);
  margin-top: 0.25rem;
}

.filter-section {
  margin-bottom: 1rem;
  padding: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-sm);
}

.filter-section summary {
  cursor: pointer;
  font-weight: 600;
  padding: 0.25rem;
}

.filter-group {
  margin-top: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.filter-group label {
  font-weight: normal;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

#actor-filter-container {
  margin-top: 0.5rem;
}

#send-perceptible-event-button {
  width: 100%;
  margin-bottom: 0.5rem;
}

#perceptible-event-status {
  min-height: 1.5rem;
  padding: 0.5rem;
  border-radius: var(--border-radius-sm);
  font-size: 0.9rem;
}

#perceptible-event-status:empty {
  display: none;
}

#perceptible-event-status.success {
  background: var(--success-background);
  color: var(--success-text);
  border: 1px solid var(--success-border);
}

#perceptible-event-status.error {
  background: var(--error-background);
  color: var(--error-text);
  border: 1px solid var(--error-border);
}
```

### 4. Testing Strategy

#### A. Unit Tests

**File:** `tests/unit/domUI/perceptibleEventSenderController.test.js`

**Test Suites:**

1. **Constructor & Initialization**
   - ✅ Should validate required dependencies
   - ✅ Should initialize with correct properties
   - ✅ Should cache DOM elements on initialize()
   - ✅ Should attach event listeners on initialize()
   - ✅ Should subscribe to event bus events

2. **Location Management**
   - ✅ Should load locations on world_initialized
   - ✅ Should populate location dropdown
   - ✅ Should handle empty location list
   - ✅ Should handle location loading errors

3. **Actor Management**
   - ✅ Should load actors when location selected
   - ✅ Should populate actor dropdown
   - ✅ Should filter for actors only (not items/furniture)
   - ✅ Should handle location with no actors
   - ✅ Should handle actor loading errors

4. **Filter Mode Logic**
   - ✅ Should show actor selector for 'specific' mode
   - ✅ Should show actor selector for 'exclude' mode
   - ✅ Should hide actor selector for 'all' mode
   - ✅ Should clear selections when changing modes

5. **Form Validation**
   - ✅ Should disable send button when message empty
   - ✅ Should disable send button when no location selected
   - ✅ Should disable send button when specific mode but no actors selected
   - ✅ Should enable send button when form valid
   - ✅ Should validate on message input change
   - ✅ Should validate on location change
   - ✅ Should validate on filter mode change

6. **Event Construction**
   - ✅ Should construct correct payload for 'all' mode
   - ✅ Should construct correct payload for 'specific' mode with recipientIds
   - ✅ Should construct correct payload for 'exclude' mode with excludedActorIds
   - ✅ Should set perception_type to 'gm_custom_event'
   - ✅ Should set actor_id to 'gm'
   - ✅ Should set log_entry to true

7. **Event Dispatching**
   - ✅ Should dispatch core:attempt_action event
   - ✅ Should include correct operation structure
   - ✅ Should show success status after dispatch
   - ✅ Should clear form after successful dispatch
   - ✅ Should handle dispatch errors

8. **Status Display**
   - ✅ Should show success status with correct styling
   - ✅ Should show error status with correct styling
   - ✅ Should auto-clear status after timeout
   - ✅ Should clear status on new action

9. **Cleanup**
   - ✅ Should remove event listeners
   - ✅ Should unsubscribe from event bus
   - ✅ Should clear cached state

#### B. Integration Tests

**File:** `tests/integration/domUI/perceptibleEventSender.integration.test.js`

**Test Scenarios:**

1. **Full Workflow - All Actors**
   - Setup: Create location with 3 actors
   - Action: Select location, enter message, send (all mode)
   - Assert: All 3 actors receive perceptible event in logs

2. **Full Workflow - Specific Actors**
   - Setup: Create location with 3 actors
   - Action: Select location, enter message, select 2 specific actors, send
   - Assert: Only 2 selected actors receive event
   - Assert: 1 unselected actor does not receive event

3. **Full Workflow - Exclude Actors**
   - Setup: Create location with 3 actors
   - Action: Select location, enter message, exclude 1 actor, send
   - Assert: 2 non-excluded actors receive event
   - Assert: 1 excluded actor does not receive event

4. **Location Synchronization**
   - Setup: Initialize with 2 locations
   - Action: Change player location via game action
   - Assert: Location dropdown updates
   - Assert: Actor list refreshes for new location

5. **Multiple Events**
   - Action: Send event to location A
   - Assert: Event delivered
   - Action: Send different event to location B
   - Assert: Event delivered to location B only

6. **Error Recovery**
   - Setup: Inject error in entity query
   - Action: Attempt to send event
   - Assert: Error status displayed
   - Assert: Form remains valid for retry

7. **Event Bus Integration**
   - Setup: Mock event bus
   - Action: Send event
   - Assert: core:attempt_action dispatched with correct payload
   - Assert: Operation parameters match expected structure

#### C. E2E Tests

**File:** `tests/e2e/perceptibleEventSender.e2e.test.js`

**Test Scenarios:**

1. **DOM Interaction Flow**
   - Navigate to game
   - Verify panel visible in right sidebar
   - Type message in textarea
   - Select location from dropdown
   - Click send button
   - Verify success message

2. **Perception Log Updates**
   - Send perceptible event
   - Navigate to actor's perception log
   - Verify event appears in log with correct text

3. **Accessibility Compliance**
   - Verify ARIA labels present
   - Verify keyboard navigation (Tab through controls)
   - Verify Enter key sends when valid
   - Verify focus management
   - Verify screen reader compatibility

4. **Error Handling**
   - Attempt send with empty message
   - Verify button disabled
   - Verify error message
   - Correct error and retry
   - Verify success

### 5. Accessibility Requirements

#### WCAG AA Compliance Checklist

**Perceivable:**
- ✅ All form inputs have associated `<label>` elements
- ✅ Help text linked via `aria-describedby`
- ✅ Status messages use `aria-live="polite"`
- ✅ Color contrast meets 4.5:1 minimum
- ✅ Form validation errors clearly described

**Operable:**
- ✅ All functionality keyboard accessible (no mouse required)
- ✅ Logical tab order through form controls
- ✅ Focus visible on all interactive elements
- ✅ No keyboard traps
- ✅ Enter key submits when valid

**Understandable:**
- ✅ Clear labels and instructions
- ✅ Consistent UI patterns with existing panels
- ✅ Error messages are specific and helpful
- ✅ Filter modes clearly described

**Robust:**
- ✅ Valid HTML5 structure
- ✅ Semantic HTML elements used
- ✅ ARIA roles and properties correct
- ✅ Works with screen readers (NVDA, JAWS, VoiceOver)

#### Keyboard Shortcuts
- **Tab:** Navigate through form controls
- **Shift+Tab:** Navigate backwards
- **Enter:** Send event (when form valid and focus on button)
- **Escape:** Clear form (optional enhancement)
- **Arrow keys:** Navigate dropdown and multi-select

### 6. Error Handling

#### Validation Errors

**Empty Message:**
```javascript
if (!message.trim()) {
  this.showStatus('Event message is required', 'error');
  return false;
}
```

**No Location Selected:**
```javascript
if (!locationId) {
  this.showStatus('Please select a target location', 'error');
  return false;
}
```

**Invalid Actor Selection:**
```javascript
if (filterMode !== 'all' && selectedActorIds.length === 0) {
  this.showStatus('Please select at least one actor', 'error');
  return false;
}
```

#### Operation Errors

**Event Dispatch Failure:**
```javascript
try {
  await this.#eventBus.dispatch('core:attempt_action', payload);
} catch (err) {
  this.#logger.error('Failed to dispatch perceptible event', err);
  this.showStatus('Failed to send event. Please try again.', 'error');
}
```

**Missing Dependencies:**
```javascript
if (!this.#eventBus || !this.#documentContext) {
  throw new Error('PerceptibleEventSenderController requires eventBus and documentContext');
}
```

**Invalid Location/Actor IDs:**
```javascript
if (!this.#actorsInLocation.some(a => a.id === actorId)) {
  this.#logger.warn('Selected actor not in location', { actorId, locationId });
  // Silently filter invalid selections
}
```

### 7. Success Criteria

#### Functional Requirements
- ✅ UI panel renders between characters and game menu
- ✅ Location dropdown populates from game state
- ✅ Message textarea accepts and validates event text
- ✅ Filter modes work correctly:
  - All actors (default)
  - Specific actors only (with multi-select)
  - Exclude specific actors (with multi-select)
- ✅ Send button:
  - Disabled when form invalid
  - Enabled when form valid
  - Triggers event dispatch
- ✅ Events dispatch to correct operation handler
- ✅ Status messages display success/errors clearly
- ✅ Perception logs update for correct recipients
- ✅ Form clears after successful send

#### Quality Requirements
- ✅ All tests pass with >80% coverage (branches)
- ✅ >90% coverage for functions and lines
- ✅ Accessibility compliance verified (WCAG AA)
- ✅ No regressions in existing UI functionality
- ✅ No console errors or warnings
- ✅ Performance: UI operations <100ms

#### Documentation Requirements
- ✅ JSDoc comments on all public methods
- ✅ Inline comments for complex logic
- ✅ Test descriptions clear and comprehensive
- ✅ Specification document complete (this file)

## Implementation Dependencies

### Required Services

1. **Event Bus** (`ISafeEventDispatcher`)
   - Methods: `dispatch(eventName, payload, options)`, `subscribe(eventName, listener)`
   - Usage: Dispatch perceptible events, listen to game state changes
   - Note: `dispatch()` accepts optional `options` parameter for advanced event configuration

2. **Document Context** (`IDocumentContext`)
   - Methods: `query(selector)`, `create(tagName)`
   - Usage: Access DOM elements safely (wraps native `querySelector` and `createElement`)
   - Note: Use `query()` not `querySelector()` for consistency with the interface

3. **Logger** (`ILogger`)
   - Methods: `debug(message, context)`, `error(message, error)`, `warn(message, context)`
   - Usage: Debug logging and error tracking

4. **Entity Manager/Repository** (via Event Bus or direct injection)
   - Methods: Query entities with component filters
   - Usage: Get locations and actors

### Required Queries

**Get All Locations:**
```javascript
// Recommended: Use EntityManager's optimized method
const locations = entityManager.getEntitiesWithComponent('core:location');

// Alternative: Scope DSL
// const locationScope = 'entities[{"has": ["core:location"]}]';

// Less optimal: Manual filter (bypasses indexing)
// const locations = allEntities.filter(e => e.components.has('core:location'));

// Result format needed:
[
  { id: 'location:tavern', name: 'The Prancing Pony' },
  { id: 'location:market', name: 'Market Square' }
]
```

**Get Actors in Location:**
```javascript
// Query entities with matching position component
const actors = allEntities.filter(e => {
  const position = e.components.get('core:position');
  const isActor = e.components.has('core:actor');
  return isActor && position?.locationId === targetLocationId;
});

// Result format needed:
[
  { id: 'actor:frodo', name: 'Frodo Baggins' },
  { id: 'actor:sam', name: 'Samwise Gamgee' }
]
```

### New Dependencies

**None** - Uses existing infrastructure:
- Event bus (already available)
- Entity system (already available)
- DOM utilities (already available)

## Risk Assessment

### Technical Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|-----------|
| Entity query performance slow | Medium | Low | Cache results, debounce queries |
| Event bus dispatch failure | High | Low | Try-catch with user feedback |
| Actor list very large (>100) | Medium | Low | Implement virtual scrolling or search |
| Concurrent events conflict | Low | Low | Event bus handles ordering |

### UX Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|-----------|
| Users confused by filter modes | Medium | Medium | Clear labels, help text, examples |
| Form clutters right sidebar | Low | Low | Collapsible sections, compact design |
| Too many clicks to send event | Low | Medium | Default to 'all' mode, minimize steps |

### Accessibility Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|-----------|
| Screen reader support inadequate | High | Low | Test with NVDA/JAWS, proper ARIA |
| Keyboard navigation broken | High | Low | Test all interactions keyboard-only |
| Color contrast insufficient | Medium | Low | Use CSS variables, test with tools |

## Future Enhancements

### Phase 2 Features (Post-MVP)

1. **Event Templates**
   - Save commonly used event messages
   - Quick select from template dropdown
   - User-customizable template library

2. **Event History**
   - Show recently sent events
   - Repeat previous event with one click
   - Edit and resend past events

3. **Rich Text Formatting**
   - Bold, italic, color for emphasis
   - Markdown support for complex descriptions
   - Preview formatted output

4. **Batch Events**
   - Send same event to multiple locations
   - Queue multiple events for sequential delivery
   - Delayed/scheduled events

5. **Event Validation**
   - Spell check for messages
   - Suggest appropriate perception_type based on content
   - Warn about potentially confusing messages

6. **Advanced Filters**
   - Filter by actor attributes (faction, role, etc.)
   - Filter by distance from event source
   - Conditional delivery based on actor state

## Appendix

### A. Related Files Reference

**Core Files:**
- `game.html:117-139` - Current right sidebar structure
- `src/logic/operationHandlers/dispatchPerceptibleEventHandler.js:35-206` - Handler implementation
- `src/logic/operationHandlers/addPerceptionLogEntryHandler.js` - Perception log handler
- `data/mods/core/macros/logSuccessAndEndTurn.macro.json` - Example event dispatch

**Example Usage:**
- `data/mods/affection/rules/handle_tickle_target_playfully.rule.json` - Simple perceptible event
- `data/mods/items/rules/handle_pick_up_item.rule.json` - Complex perceptible event with conditions
- `data/mods/movement/rules/go.rule.json` - Location-based perceptible event

**UI Patterns:**
- `src/domUI/saveGameUI.js` - Modal pattern reference
- `src/domUI/actionButtonsRenderer.js` - Button management pattern
- `src/domUI/perceptionLogRenderer.js` - Perception log rendering

### B. Glossary

**Perceptible Event:** An in-game occurrence that actors can perceive, logged in their perception memory

**Perception Type:** Classification of event (e.g., action_target_general, item_picked_up, gm_custom_event)

**Recipient IDs:** Specific actor entity IDs that should receive the event

**Excluded Actor IDs:** Actor entity IDs that should NOT receive the event (mutually exclusive with recipient IDs)

**Location ID:** Entity ID of a location (e.g., 'location:tavern')

**Actor ID:** Entity ID of an actor/character (e.g., 'actor:frodo')

**GM:** Game Master - system-level actor ID used for user-initiated events

### C. Design Decisions Log

| Decision | Rationale | Alternatives Considered |
|----------|-----------|------------------------|
| Textarea for message input | Multi-line support for complex descriptions | Input field (too limited) |
| Radio buttons for filter modes | Mutually exclusive options clear | Checkbox (allows invalid combinations) |
| Multi-select for actor list | Standard pattern, keyboard accessible | Checkboxes (less compact) |
| actor_id: 'gm' | Distinguishes user events from NPC actions | Special system ID, null value |
| perception_type: 'gm_custom_event' | Clear event source classification | 'custom', 'user_event' |
| Always set log_entry: true | Users expect events to appear in logs | Make configurable (added complexity) |
| Inline in right sidebar | Proximity to character list, context | Separate modal (too much friction) |

---

**Document Version:** 1.0
**Created:** 2025-11-02
**Status:** Complete - Ready for Implementation
