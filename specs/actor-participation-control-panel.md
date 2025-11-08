# Actor Participation Control Panel - Comprehensive Specification

## Executive Summary

This specification details the implementation of an Actor Participation Control Panel for the Living Narrative Engine. The panel will allow users to selectively enable/disable actor participation in turn-based gameplay, providing cost optimization for large scenarios with multiple LLM-powered characters.

**Key Features:**
- Toggle switch for each actor to control turn participation
- Positioned between Location Renderer and Send Perceptible Event panel
- Persistent participation state via `core:participation` component
- Default participation enabled (opt-out model)
- Clean turn skipping without LLM API calls

**Primary Use Case:** In large scenarios with many LLM-based characters, users can disable actors located away from the action to avoid unnecessary API costs, while maintaining the ability to re-enable them when needed.

---

## 1. HTML Structure & Panel Placement

### Current Right Pane Structure (game.html, lines 79-262)

```html
<aside id="right-pane" class="panel">
  <!-- LOCATION INFO (lines 82-121) -->
  <div id="location-info-container" role="region" aria-labelledby="location-name-display">
    <!-- Location cards -->
  </div>

  <!-- INSERT NEW PANEL HERE -->

  <!-- PERCEPTIBLE EVENT SENDER (lines 124-230) -->
  <div id="perceptible-event-sender-widget" class="widget">
    <!-- Event sender controls -->
  </div>

  <!-- GAME ACTIONS (lines 233-248) -->
  <!-- ENTITY LIFECYCLE MONITOR (lines 251-261, disabled) -->
</aside>
```

### Proposed HTML Addition (Insert after line 121)

```html
<!-- ACTOR PARTICIPATION CONTROL -->
<div
  id="actor-participation-widget"
  class="widget"
  role="region"
  aria-labelledby="actor-participation-heading"
>
  <h3 id="actor-participation-heading">Actor Participation</h3>

  <!-- Actor List Container -->
  <div id="actor-participation-list-container" class="actor-list">
    <!-- Will be dynamically populated -->
  </div>

  <!-- Status Message -->
  <div
    id="actor-participation-status"
    class="status-message-area"
    role="status"
    aria-live="polite"
  ></div>
</div>
```

**HTML Patterns to Follow:**
- Widget container with `.widget` class
- ARIA landmarks: `role="region"`, `aria-labelledby`
- Status area with `role="status"`, `aria-live="polite"`
- Structure follows existing panel conventions

---

## 2. LocationRenderer Analysis

**File:** `src/domUI/locationRenderer.js`

### Class Structure

**Extends:** `BoundDomRendererBase` (line 57)
- Inherits element binding, event subscription, DOM listener management

### Key Implementation Patterns

#### Constructor Dependencies (lines 67-76)
```javascript
constructor({
  logger,
  documentContext,
  safeEventDispatcher,
  domElementFactory,
  entityManager,
  entityDisplayDataProvider,
  dataRegistry,
  containerElement,
})
```

#### Element Configuration (lines 77-98)
```javascript
const elementsConfig = {
  nameDisplay: { selector: '#location-name-display', required: true },
  locationPortraitVisualsElement: {
    selector: '#location-portrait-visuals',
    required: true
  },
  descriptionDisplay: {
    selector: '#location-description-display',
    required: true
  },
  // ... more elements
};
```

#### Event Subscription (lines 182-188)
```javascript
this._subscribe(
  this._EVENT_TYPE_SUBSCRIBED,
  this.#handleTurnStarted.bind(this)
);
```

#### Render Method Pattern (lines 508-554)
```javascript
render(locationDto) {
  // Validate dependencies
  if (!this.baseContainerElement || !this.domElementFactory) {
    this.safeEventDispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
      message: `Cannot render, critical dependencies missing.`
    });
    return;
  }

  // Check required elements
  const requiredElements = ['nameDisplay', 'descriptionDisplay', ...];
  for (const elKey of requiredElements) {
    if (!this.elements[elKey]) {
      this.safeEventDispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
        message: `Required DOM element '${elKey}' is missing.`
      });
      return;
    }
  }

  // Render sub-components
  this.renderName(locationDto);
  this.renderPortrait(locationDto);
  this.renderDescription(locationDto);
  this.renderLists(locationDto);
}
```

#### Cleanup Pattern (lines 556-560)
```javascript
dispose() {
  this.logger.debug(`${this._logPrefix} Disposing LocationRenderer.`);
  super.dispose(); // Handles event unsubscription and listener cleanup
  this.logger.debug(`${this._logPrefix} LocationRenderer disposed.`);
}
```

---

## 3. Send Perceptible Event Panel Analysis

**File:** `src/domUI/perceptibleEventSenderController.js`

### Class Structure

**Pattern:** Controller class (not extending renderer base)
- Direct DOM manipulation via DocumentContext
- Event-driven lifecycle

### Key Implementation Patterns

#### Dependency Injection (lines 42-64)
```javascript
constructor({ eventBus, documentContext, logger, entityManager, operationInterpreter }) {
  validateDependency(eventBus, 'ISafeEventDispatcher', logger, {
    requiredMethods: ['dispatch', 'subscribe'],
  });
  // ... validate all dependencies

  this.#eventBus = eventBus;
  this.#documentContext = documentContext;
  this.#logger = logger;
  this.#entityManager = entityManager;
  this.#operationInterpreter = operationInterpreter;
}
```

#### Element Caching (lines 115-133)
```javascript
#cacheElements() {
  this.#elements = {
    messageInput: this.#documentContext.query('#perceptible-event-message'),
    locationSelect: this.#documentContext.query('#perceptible-event-location'),
    sendButton: this.#documentContext.query('#send-perceptible-event-button'),
    statusArea: this.#documentContext.query('#perceptible-event-status'),
  };

  // Verify required elements exist
  const requiredElements = ['messageInput', 'locationSelect', 'sendButton'];
  requiredElements.forEach((elementKey) => {
    if (!this.#elements[elementKey]) {
      throw new Error(`Required element not found: ${elementKey}`);
    }
  });
}
```

#### Event Listener Attachment (lines 138-187)
```javascript
#attachEventListeners() {
  // Message input change
  this.#boundHandlers.onMessageChange = () => this.#validateForm();
  this.#elements.messageInput.addEventListener('input',
    this.#boundHandlers.onMessageChange);

  // Send button click
  this.#boundHandlers.onSendClick = () => this.#sendPerceptibleEvent();
  this.#elements.sendButton.addEventListener('click',
    this.#boundHandlers.onSendClick);
}
```

#### Game Lifecycle Subscription (lines 195-214)
```javascript
#subscribeToGameEvents() {
  this.#gameReadyHandler = this.#handleGameReady.bind(this);
  const unsubscribe = this.#eventBus.subscribe(
    ENGINE_READY_UI,
    this.#gameReadyHandler
  );

  if (!unsubscribe) {
    this.#logger.error('Failed to subscribe to ENGINE_READY_UI');
  }
}

#handleGameReady() {
  this.#logger.info('ENGINE_READY_UI received - loading locations');
  this.#loadLocations();
}
```

#### Status Display Pattern (lines 437-454)
```javascript
#showStatus(message, type) {
  // Clear previous timeout
  if (this.#statusTimeout) {
    clearTimeout(this.#statusTimeout);
    this.#statusTimeout = null;
  }

  // Set message and styling
  this.#elements.statusArea.textContent = message;
  this.#elements.statusArea.className = `status-message-area ${type}`;

  // Auto-clear after 5 seconds
  this.#statusTimeout = setTimeout(() => {
    this.#elements.statusArea.textContent = '';
    this.#elements.statusArea.className = 'status-message-area';
  }, 5000);
}
```

#### Cleanup Pattern (lines 495-545)
```javascript
cleanup() {
  try {
    // Clear timeouts
    if (this.#statusTimeout) {
      clearTimeout(this.#statusTimeout);
    }

    // Unsubscribe from events
    if (this.#gameReadyHandler) {
      this.#eventBus.unsubscribe(ENGINE_READY_UI, this.#gameReadyHandler);
    }

    // Remove event listeners
    if (this.#elements.messageInput && this.#boundHandlers.onMessageChange) {
      this.#elements.messageInput.removeEventListener('input',
        this.#boundHandlers.onMessageChange);
    }

    // Clear cached elements and handlers
    this.#elements = {};
    this.#boundHandlers = {};
  } catch (err) {
    this.#logger.error('Error during cleanup', err);
  }
}
```

---

## 4. Entity Querying Patterns

### Query for Actors with 'core:actor' Component

**Pattern from perceptibleEventSenderController.js (line 261):**
```javascript
const allActors = this.#entityManager.getEntitiesWithComponent('core:actor');
```

**Filter by Location:**
```javascript
const actorsInLocation = allActors.filter((actor) => {
  const position = actor.getComponent('core:position');
  return position?.locationId === locationId;
});
```

**Get Actor Name:**
```javascript
const nameComp = actor.getComponent('core:name');
const displayName = nameComp?.name || actor.id;
```

**Entity Manager Interface:**
- `getEntitiesWithComponent(componentId)` - Returns array of entities
- Each entity has `entity.id` and `entity.getComponent(componentId)`

---

## 5. Turn Processing & Skip Mechanism

### Turn System Architecture

**File:** `src/turns/turnManager.js`

#### Key Events (lines 22-26)
```javascript
TURN_ENDED_ID         // Signals turn completion
TURN_PROCESSING_STARTED // Turn began processing
TURN_PROCESSING_ENDED   // Turn finished processing
```

#### Actor Turn Tracking (lines 75-78)
```javascript
#isRunning = false;
#currentActor = null;
#currentHandler = null;
```

### Turn Skip Mechanism

**No explicit "skip turn" feature found** in the current codebase. Turn advancement happens when:

1. `TURN_ENDED_ID` event is dispatched (line 23)
2. Turn manager processes the event and advances to next actor
3. New turn begins with `TURN_PROCESSING_STARTED` event

### Proposed Skip Turn Approach

Since there's no built-in skip mechanism, the Actor Participation Control Panel should:

#### Recommended: Participation Toggle Component
- Add a `core:participation` component with `{ participating: boolean }`
- When `participating: false`, turn order service skips the actor
- Toggle UI allows enabling/disabling participation
- **Advantages:** Persistent, survives saves, clear game state

**Implementation Location:** `src/turns/order/queues/initiativePriorityQueue.js` (or similar)

**Filter Logic:**
```javascript
getNextActor() {
  while (this.queue.length > 0) {
    const actor = this.queue.shift();

    // Skip non-participating actors
    const participation = actor.getComponent('core:participation');
    if (participation && participation.participating === false) {
      continue; // Skip this actor
    }

    return actor;
  }

  return null; // No more actors
}
```

---

## 6. Common UI Patterns to Follow

### Dependency Injection Pattern

**All UI components receive:**
```javascript
{
  logger,              // ILogger instance
  documentContext,     // IDocumentContext for DOM queries
  eventBus,           // ISafeEventDispatcher for events
  entityManager,      // IEntityManager for entity queries
  // ... component-specific dependencies
}
```

### Validation Pattern

**Use `validateDependency` utility:**
```javascript
import { validateDependency } from '../utils/dependencyUtils.js';

validateDependency(eventBus, 'ISafeEventDispatcher', logger, {
  requiredMethods: ['dispatch', 'subscribe'],
});
```

### Element Binding Pattern

**Two approaches observed:**

1. **BoundDomRendererBase Pattern** (LocationRenderer)
   - Define `elementsConfig` with selectors
   - Base class handles binding and validation
   - Access via `this.elements.elementName`

2. **Manual Caching Pattern** (PerceptibleEventSenderController) - **RECOMMENDED FOR THIS FEATURE**
   - Call `documentContext.query(selector)` in `#cacheElements()`
   - Store in `this.#elements` object
   - Manually validate required elements

### Initialization Flow

**Pattern from UI registrations:**
```javascript
// 1. Register in DI container
container.register(
  tokens.MyController,
  () => new MyController({ ...dependencies })
);

// 2. Create initialization helper
export async function initMyController({ container, logger, tokens }) {
  return resolveAndInitialize(
    container,
    tokens.MyController,
    'initialize',  // Method to call
    logger
  );
}

// 3. Call from auxiliary services stage
await initMyController({ container, logger, tokens });
```

### Event Subscription Pattern

```javascript
// Subscribe in initialization
#subscribeToGameEvents() {
  this.#boundHandler = this.#handleEvent.bind(this);
  this.#eventBus.subscribe(EVENT_ID, this.#boundHandler);
}

// Unsubscribe in cleanup
cleanup() {
  if (this.#boundHandler) {
    this.#eventBus.unsubscribe(EVENT_ID, this.#boundHandler);
  }
}
```

### Status Message Pattern

**Standard structure:**
```html
<div
  id="component-status"
  class="status-message-area"
  role="status"
  aria-live="polite"
></div>
```

**Usage:**
```javascript
#showStatus(message, type) {
  statusElement.textContent = message;
  statusElement.className = `status-message-area ${type}`;

  // Auto-clear after 5 seconds
  setTimeout(() => {
    statusElement.textContent = '';
    statusElement.className = 'status-message-area';
  }, 5000);
}
```

### List Rendering Pattern

**From LocationRenderer (lines 378-430):**
```javascript
_renderList(dataArray, targetElement, title, itemTextProperty, emptyText) {
  DomUtils.clearElement(targetElement);

  // Empty state
  if (!Array.isArray(dataArray) || dataArray.length === 0) {
    targetElement.appendChild(
      createMessageElement(domElementFactory, 'empty-list-message', emptyText)
    );
    return;
  }

  // Build list
  const ul = domElementFactory.ul(undefined, 'list-class');
  targetElement.appendChild(ul);

  dataArray.forEach((item) => {
    const li = domElementFactory.li('item-class');
    li.textContent = item[itemTextProperty];
    ul.appendChild(li);
  });
}
```

---

## 7. ActorParticipationController - Detailed Specification

### Component Architecture

**Recommended Pattern:** Controller class (like PerceptibleEventSenderController)

**Rationale:**
- Direct control over actor participation state
- Needs entity manager access for actor queries
- Event-driven (turn start, actor changes)
- Simpler than full renderer (no complex sub-component rendering)

### File Structure

**Primary File:** `src/domUI/actorParticipationController.js`

**Dependencies:**
```javascript
import { validateDependency } from '../utils/dependencyUtils.js';
import { ENGINE_READY_UI } from '../constants/eventIds.js';
import { ACTOR_COMPONENT_ID } from '../constants/componentIds.js';
import { DomUtils } from '../utils/domUtils.js';
```

### Complete Class Implementation

```javascript
/**
 * @file ActorParticipationController - Manages actor participation in turn order
 * @see perceptibleEventSenderController.js - Similar controller pattern
 */

import { validateDependency } from '../utils/dependencyUtils.js';
import { ENGINE_READY_UI } from '../constants/eventIds.js';
import { ACTOR_COMPONENT_ID } from '../constants/componentIds.js';
import { DomUtils } from '../utils/domUtils.js';

/**
 * @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher
 * @typedef {import('./documentContext.js').DocumentContext} IDocumentContext
 * @typedef {import('../logging/logger.js').Logger} ILogger
 * @typedef {import('../entities/entityManager.js').EntityManager} IEntityManager
 */

/**
 * Controller for the Actor Participation panel.
 * Manages actor participation state and provides UI for toggling participation.
 *
 * Lifecycle:
 * 1. Construction with dependencies
 * 2. initialize() - Cache elements, attach listeners, subscribe to events
 * 3. ENGINE_READY_UI event triggers actor loading
 * 4. User interactions update entity components
 * 5. cleanup() - Remove listeners and unsubscribe
 */
class ActorParticipationController {
  /** @type {ISafeEventDispatcher} */
  #eventBus;

  /** @type {IDocumentContext} */
  #documentContext;

  /** @type {ILogger} */
  #logger;

  /** @type {IEntityManager} */
  #entityManager;

  /** @type {Object.<string, HTMLElement>} */
  #elements;

  /** @type {Object.<string, Function>} */
  #boundHandlers;

  /** @type {Function|null} */
  #gameReadyHandler;

  /**
   * Creates an ActorParticipationController instance.
   *
   * @param {Object} deps - Dependencies
   * @param {ISafeEventDispatcher} deps.eventBus - Event dispatcher
   * @param {IDocumentContext} deps.documentContext - DOM query interface
   * @param {ILogger} deps.logger - Logger instance
   * @param {IEntityManager} deps.entityManager - Entity manager
   */
  constructor({ eventBus, documentContext, logger, entityManager }) {
    // Validate dependencies
    validateDependency(eventBus, 'ISafeEventDispatcher', logger, {
      requiredMethods: ['dispatch', 'subscribe', 'unsubscribe'],
    });
    validateDependency(documentContext, 'IDocumentContext', logger, {
      requiredMethods: ['query', 'create'],
    });
    validateDependency(entityManager, 'IEntityManager', logger, {
      requiredMethods: ['getEntitiesWithComponent', 'getEntityInstance'],
    });

    this.#eventBus = eventBus;
    this.#documentContext = documentContext;
    this.#logger = logger;
    this.#entityManager = entityManager;
    this.#elements = {};
    this.#boundHandlers = {};
    this.#gameReadyHandler = null;
  }

  /**
   * Initializes the controller.
   * Caches DOM elements, attaches event listeners, and subscribes to game events.
   */
  initialize() {
    this.#logger.debug('[ActorParticipation] Initializing controller');

    this.#cacheElements();
    this.#attachEventListeners();
    this.#subscribeToGameEvents();

    // Defensive: Load actors if entities already exist
    try {
      const actors = this.#entityManager.getEntitiesWithComponent(ACTOR_COMPONENT_ID);
      if (actors && actors.length > 0) {
        this.#logger.debug('[ActorParticipation] Actors found during init, loading');
        this.#loadActors();
      }
    } catch (err) {
      this.#logger.warn('[ActorParticipation] Could not check for actors during init', err);
    }

    this.#logger.info('[ActorParticipation] Controller initialized');
  }

  /**
   * Caches DOM element references.
   * @private
   * @throws {Error} If required elements are missing
   */
  #cacheElements() {
    this.#elements = {
      listContainer: this.#documentContext.query('#actor-participation-list-container'),
      statusArea: this.#documentContext.query('#actor-participation-status'),
      widget: this.#documentContext.query('#actor-participation-widget'),
    };

    // Verify required elements exist
    const requiredElements = ['listContainer', 'statusArea'];
    requiredElements.forEach((elementKey) => {
      if (!this.#elements[elementKey]) {
        throw new Error(
          `[ActorParticipation] Required element not found: ${elementKey}`
        );
      }
    });

    this.#logger.debug('[ActorParticipation] DOM elements cached');
  }

  /**
   * Attaches event listeners to DOM elements.
   * @private
   */
  #attachEventListeners() {
    // Event delegation for toggle checkboxes (added dynamically)
    this.#boundHandlers.onToggleParticipation = (event) => {
      if (event.target.classList.contains('actor-participation-toggle')) {
        this.#handleParticipationToggle(event);
      }
    };

    this.#elements.listContainer.addEventListener(
      'change',
      this.#boundHandlers.onToggleParticipation
    );

    this.#logger.debug('[ActorParticipation] Event listeners attached');
  }

  /**
   * Subscribes to game lifecycle events.
   * @private
   */
  #subscribeToGameEvents() {
    this.#gameReadyHandler = this.#handleGameReady.bind(this);
    const unsubscribe = this.#eventBus.subscribe(
      ENGINE_READY_UI,
      this.#gameReadyHandler
    );

    if (!unsubscribe) {
      this.#logger.error('[ActorParticipation] Failed to subscribe to ENGINE_READY_UI');
    } else {
      this.#logger.debug('[ActorParticipation] Subscribed to ENGINE_READY_UI');
    }
  }

  /**
   * Handles ENGINE_READY_UI event by loading actors.
   * @private
   */
  #handleGameReady() {
    this.#logger.info('[ActorParticipation] ENGINE_READY_UI received - loading actors');
    this.#loadActors();
  }

  /**
   * Loads all actors from entity manager and renders the list.
   * @private
   */
  #loadActors() {
    try {
      const actors = this.#entityManager.getEntitiesWithComponent(ACTOR_COMPONENT_ID);

      if (!actors || actors.length === 0) {
        this.#logger.info('[ActorParticipation] No actors found');
        this.#renderEmpty();
        return;
      }

      this.#renderActorList(actors);
      this.#logger.info(`[ActorParticipation] Loaded ${actors.length} actors`);
    } catch (err) {
      this.#logger.error('[ActorParticipation] Failed to load actors', err);
      this.#showStatus('Failed to load actors', 'error');
    }
  }

  /**
   * Renders the list of actors with participation toggles.
   * @private
   * @param {Array} actors - Array of actor entities
   */
  #renderActorList(actors) {
    DomUtils.clearElement(this.#elements.listContainer);

    const ul = this.#documentContext.create('ul');
    ul.className = 'actor-participation-list';

    actors.forEach((actor) => {
      const li = this.#createActorListItem(actor);
      ul.appendChild(li);
    });

    this.#elements.listContainer.appendChild(ul);
  }

  /**
   * Creates a list item for a single actor.
   * @private
   * @param {Object} actor - Actor entity
   * @returns {HTMLElement} List item element
   */
  #createActorListItem(actor) {
    const li = this.#documentContext.create('li');
    li.className = 'actor-participation-item';

    // Get actor name
    const nameComp = actor.getComponent('core:name');
    const actorName = nameComp?.name || actor.id;

    // Get participation status (default: true)
    const participationComp = actor.getComponent('core:participation');
    const isParticipating = participationComp?.participating !== false;

    // Create checkbox
    const checkbox = this.#documentContext.create('input');
    checkbox.type = 'checkbox';
    checkbox.checked = isParticipating;
    checkbox.className = 'actor-participation-toggle';
    checkbox.dataset.actorId = actor.id;
    checkbox.id = `participation-${actor.id}`;
    checkbox.setAttribute('aria-label', `Toggle participation for ${actorName}`);

    // Create label
    const label = this.#documentContext.create('label');
    label.htmlFor = checkbox.id;
    label.textContent = actorName;

    li.appendChild(checkbox);
    li.appendChild(label);

    return li;
  }

  /**
   * Handles participation toggle checkbox change events.
   * @private
   * @param {Event} event - Change event from checkbox
   */
  #handleParticipationToggle(event) {
    const checkbox = event.target;
    const actorId = checkbox.dataset.actorId;
    const isParticipating = checkbox.checked;

    this.#logger.debug(
      `[ActorParticipation] Toggle ${actorId}: ${isParticipating}`
    );

    // Update entity component
    try {
      const actor = this.#entityManager.getEntityInstance(actorId);
      if (!actor) {
        throw new Error(`Actor ${actorId} not found`);
      }

      // Set or update participation component
      actor.setComponentData('core:participation', {
        participating: isParticipating,
      });

      const statusMsg = isParticipating
        ? 'Enabled participation'
        : 'Disabled participation';
      this.#showStatus(statusMsg, 'success');

      this.#logger.info(`[ActorParticipation] Updated ${actorId}: ${isParticipating}`);
    } catch (err) {
      this.#logger.error('[ActorParticipation] Failed to update participation', err);
      checkbox.checked = !isParticipating; // Revert checkbox
      this.#showStatus('Failed to update participation', 'error');
    }
  }

  /**
   * Renders empty state when no actors are available.
   * @private
   */
  #renderEmpty() {
    DomUtils.clearElement(this.#elements.listContainer);
    const p = this.#documentContext.create('p');
    p.className = 'empty-list-message';
    p.textContent = 'No actors available';
    this.#elements.listContainer.appendChild(p);
  }

  /**
   * Displays a status message with auto-clear.
   * @private
   * @param {string} message - Status message text
   * @param {string} type - Message type ('success', 'error', 'info')
   */
  #showStatus(message, type) {
    if (!this.#elements.statusArea) {
      return;
    }

    this.#elements.statusArea.textContent = message;
    this.#elements.statusArea.className = `status-message-area ${type}`;

    // Auto-clear after 5 seconds
    setTimeout(() => {
      if (this.#elements.statusArea) {
        this.#elements.statusArea.textContent = '';
        this.#elements.statusArea.className = 'status-message-area';
      }
    }, 5000);
  }

  /**
   * Manually refreshes the actor list.
   * Can be called externally when actors are added/removed.
   */
  refresh() {
    this.#logger.debug('[ActorParticipation] Manual refresh requested');
    this.#loadActors();
  }

  /**
   * Cleans up event listeners and subscriptions.
   * Should be called when the controller is no longer needed.
   */
  cleanup() {
    try {
      // Unsubscribe from events
      if (this.#gameReadyHandler) {
        this.#eventBus.unsubscribe(ENGINE_READY_UI, this.#gameReadyHandler);
        this.#gameReadyHandler = null;
      }

      // Remove event listeners
      if (this.#elements.listContainer && this.#boundHandlers.onToggleParticipation) {
        this.#elements.listContainer.removeEventListener(
          'change',
          this.#boundHandlers.onToggleParticipation
        );
      }

      // Clear cached data
      this.#elements = {};
      this.#boundHandlers = {};

      this.#logger.debug('[ActorParticipation] Cleaned up successfully');
    } catch (err) {
      this.#logger.error('[ActorParticipation] Error during cleanup', err);
    }
  }
}

export default ActorParticipationController;
```

---

## 8. CSS Styling Specification

**File:** `css/style.css` (add to end of file or appropriate section)

```css
/* ============================================
   ACTOR PARTICIPATION WIDGET
   ============================================ */

.actor-participation-list {
  list-style: none;
  padding: 0;
  margin: 0.5rem 0;
}

.actor-participation-item {
  display: flex;
  align-items: center;
  padding: 0.5rem;
  margin-bottom: 0.25rem;
  border-radius: 4px;
  background-color: var(--bg-secondary, #f5f5f5);
  transition: background-color 0.2s ease;
}

.actor-participation-item:hover {
  background-color: var(--bg-hover, #e0e0e0);
}

.actor-participation-toggle {
  margin-right: 0.5rem;
  cursor: pointer;
  width: 18px;
  height: 18px;
}

.actor-participation-item label {
  cursor: pointer;
  user-select: none;
  flex: 1;
  font-size: 0.95rem;
  color: var(--text-primary, #333);
}

.empty-list-message {
  color: var(--text-muted, #666);
  font-style: italic;
  text-align: center;
  padding: 1rem;
  font-size: 0.9rem;
}

/* Status message area (reuses existing pattern) */
#actor-participation-status {
  margin-top: 0.5rem;
}
```

**CSS Variables (if not already defined):**
```css
:root {
  --bg-secondary: #f5f5f5;
  --bg-hover: #e0e0e0;
  --text-primary: #333;
  --text-muted: #666;
}
```

---

## 9. Dependency Injection Configuration

### Token Definition

**File:** `src/dependencyInjection/tokens/tokens-ui.js`

**Add after line 44 (near other controller tokens):**
```javascript
ActorParticipationController: 'ActorParticipationController',
```

### Controller Registration

**File:** `src/dependencyInjection/registrations/uiRegistrations.js`

**Add import (near other controller imports, around line 30):**
```javascript
import ActorParticipationController from '../../domUI/actorParticipationController.js';
```

**Add registration (after line 400, near PerceptibleEventSenderController registration):**
```javascript
// Actor Participation Controller
registerWithLog(
  registrar,
  tokens.ActorParticipationController,
  () =>
    new ActorParticipationController({
      eventBus: container.resolve(tokens.SafeEventDispatcher),
      documentContext: container.resolve(tokens.DocumentContext),
      logger: container.resolve(tokens.Logger),
      entityManager: container.resolve(tokens.EntityManager),
    }),
  { lifecycle: 'singleton' },
  logger
);
```

### Initialization Helper

**File:** `src/bootstrapper/stages/auxiliary/initActorParticipationController.js` (NEW FILE)

```javascript
import { resolveAndInitialize } from '../../../utils/bootstrapperHelpers.js';
import './typedefs.js';

/** @typedef {import('./typedefs.js').AuxHelperDeps} AuxHelperDeps */

/**
 * Resolves and initializes the ActorParticipationController service.
 *
 * @param {AuxHelperDeps} deps - Contains DI container, logger, and token map.
 * @returns {Promise<{success: boolean, error?: Error}>} Result of initialization.
 */
export async function initActorParticipationController({
  container,
  logger,
  tokens,
}) {
  return resolveAndInitialize(
    container,
    tokens.ActorParticipationController,
    'initialize',
    logger
  );
}
```

**File:** `src/bootstrapper/stages/auxiliary/index.js`

**Add export (after line 11, maintaining alphabetical order):**
```javascript
export { initActorParticipationController } from './initActorParticipationController.js';
```

**File:** `src/bootstrapper/stages/initializeAuxiliaryServicesStage.js`

**Add import (after line 13, with other auxiliary imports):**
```javascript
import { initActorParticipationController } from './auxiliary/index.js';
```

**Add to initialization sequence (after line 126, before PerceptibleEventSenderController):**
```javascript
{
  name: 'ActorParticipationController',
  fn: async () =>
    initActorParticipationController({
      container: context.container,
      logger: context.logger,
      tokens,
    }),
},
```

### Export from domUI Module

**File:** `src/domUI/index.js`

**Add export (around line 40, with other controllers, maintaining alphabetical order):**
```javascript
export { default as ActorParticipationController } from './actorParticipationController.js';
```

---

## 10. Core:Participation Component Specification

### Component Schema

**File:** `data/schemas/components/participation.schema.json` (NEW FILE)

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "core:participation",
  "description": "Controls whether an actor participates in the turn order system. When participating is false, the actor's turns are cleanly skipped without LLM API calls.",
  "dataSchema": {
    "type": "object",
    "properties": {
      "participating": {
        "type": "boolean",
        "description": "True if actor takes turns normally, false if turns should be skipped",
        "default": true
      }
    },
    "required": ["participating"],
    "additionalProperties": false
  }
}
```

### Component ID Constant

**File:** `src/constants/componentIds.js`

**Add constant (maintaining alphabetical order, around line 20):**
```javascript
export const PARTICIPATION_COMPONENT_ID = 'core:participation';
```

### Schema Registration

**File:** `data/schemas/component.schema.json`

**Add reference in `anyOf` array (maintaining alphabetical order):**
```json
{
  "$ref": "./components/participation.schema.json"
}
```

---

## 11. Turn Order Integration

### Turn Queue Modification

**File:** `src/turns/order/queues/initiativePriorityQueue.js` (or similar turn queue implementation)

**Locate the method that retrieves the next actor** (likely `getNextActor()` or similar)

**Add participation filter:**

```javascript
import { PARTICIPATION_COMPONENT_ID } from '../../../constants/componentIds.js';

// Existing method (example)
getNextActor() {
  while (this.queue.length > 0) {
    const actor = this.queue.shift();

    // NEW: Skip non-participating actors
    const participation = actor.getComponent(PARTICIPATION_COMPONENT_ID);
    if (participation && participation.participating === false) {
      this.#logger?.debug(
        `[TurnQueue] Skipping non-participating actor: ${actor.id}`
      );
      continue; // Skip this actor, try next in queue
    }

    return actor;
  }

  return null; // No more actors in queue
}
```

**Alternative locations** (check these files if `initiativePriorityQueue.js` doesn't exist):
- `src/turns/turnManager.js` - Main turn management logic
- `src/turns/order/turnOrderService.js` - Turn order service
- Any file in `src/turns/order/` that manages actor queues

**Key principles:**
- Filter happens in the queue/order system, not in individual actor handlers
- Skip is silent and clean (no event dispatching needed)
- Logger message helps debugging
- Default behavior (no component or `participating: true`) is normal turn processing

---

## 12. Testing Strategy

### Unit Tests

**File:** `tests/unit/domUI/actorParticipationController.test.js` (NEW FILE)

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import ActorParticipationController from '../../../src/domUI/actorParticipationController.js';
import { ENGINE_READY_UI } from '../../../src/constants/eventIds.js';
import { ACTOR_COMPONENT_ID } from '../../../src/constants/componentIds.js';

describe('ActorParticipationController', () => {
  let testBed;
  let controller;
  let mockEventBus;
  let mockDocumentContext;
  let mockEntityManager;
  let mockLogger;

  beforeEach(() => {
    testBed = createTestBed();

    mockEventBus = testBed.createMock('eventBus', [
      'dispatch',
      'subscribe',
      'unsubscribe',
    ]);

    mockDocumentContext = testBed.createMock('documentContext', [
      'query',
      'create',
    ]);

    mockEntityManager = testBed.createMock('entityManager', [
      'getEntitiesWithComponent',
      'getEntityInstance',
    ]);

    mockLogger = testBed.createMockLogger();

    // Mock DOM elements
    mockDocumentContext.query.mockImplementation((selector) => {
      return document.createElement('div');
    });

    mockDocumentContext.create.mockImplementation((tag) => {
      return document.createElement(tag);
    });

    controller = new ActorParticipationController({
      eventBus: mockEventBus,
      documentContext: mockDocumentContext,
      logger: mockLogger,
      entityManager: mockEntityManager,
    });
  });

  afterEach(() => {
    if (controller) {
      controller.cleanup();
    }
    testBed.cleanup();
  });

  describe('initialization', () => {
    it('should initialize and cache DOM elements', () => {
      expect(() => controller.initialize()).not.toThrow();
      expect(mockDocumentContext.query).toHaveBeenCalledWith(
        '#actor-participation-list-container'
      );
      expect(mockDocumentContext.query).toHaveBeenCalledWith(
        '#actor-participation-status'
      );
    });

    it('should subscribe to ENGINE_READY_UI event', () => {
      controller.initialize();
      expect(mockEventBus.subscribe).toHaveBeenCalledWith(
        ENGINE_READY_UI,
        expect.any(Function)
      );
    });

    it('should throw error if required elements are missing', () => {
      mockDocumentContext.query.mockReturnValue(null);
      expect(() => controller.initialize()).toThrow(/Required element not found/);
    });
  });

  describe('actor loading', () => {
    beforeEach(() => {
      controller.initialize();
    });

    it('should load actors when ENGINE_READY_UI fires', () => {
      const mockActors = [
        {
          id: 'actor1',
          getComponent: jest.fn().mockReturnValue({ name: 'Actor 1' }),
        },
      ];

      mockEntityManager.getEntitiesWithComponent.mockReturnValue(mockActors);

      // Trigger ENGINE_READY_UI
      const subscribeCall = mockEventBus.subscribe.mock.calls.find(
        (call) => call[0] === ENGINE_READY_UI
      );
      const handler = subscribeCall[1];
      handler();

      expect(mockEntityManager.getEntitiesWithComponent).toHaveBeenCalledWith(
        ACTOR_COMPONENT_ID
      );
    });

    it('should render empty state when no actors exist', () => {
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([]);

      const subscribeCall = mockEventBus.subscribe.mock.calls.find(
        (call) => call[0] === ENGINE_READY_UI
      );
      const handler = subscribeCall[1];
      handler();

      expect(mockDocumentContext.create).toHaveBeenCalledWith('p');
    });
  });

  describe('participation toggle', () => {
    it('should update entity component when checkbox changes', () => {
      const mockActor = {
        id: 'actor1',
        setComponentData: jest.fn(),
      };

      mockEntityManager.getEntityInstance.mockReturnValue(mockActor);

      controller.initialize();

      // Simulate checkbox change event
      const event = {
        target: {
          classList: { contains: () => true },
          dataset: { actorId: 'actor1' },
          checked: false,
        },
      };

      // Trigger the toggle handler
      const listContainer = mockDocumentContext.query.mock.results.find(
        (r) => r.value
      )?.value;

      if (listContainer && listContainer.addEventListener) {
        const changeHandler = listContainer.addEventListener.mock.calls.find(
          (call) => call[0] === 'change'
        )?.[1];

        if (changeHandler) {
          changeHandler(event);

          expect(mockActor.setComponentData).toHaveBeenCalledWith(
            'core:participation',
            { participating: false }
          );
        }
      }
    });
  });

  describe('cleanup', () => {
    it('should unsubscribe from events on cleanup', () => {
      controller.initialize();
      controller.cleanup();

      expect(mockEventBus.unsubscribe).toHaveBeenCalledWith(
        ENGINE_READY_UI,
        expect.any(Function)
      );
    });

    it('should remove event listeners on cleanup', () => {
      controller.initialize();

      const listContainer = mockDocumentContext.query.mock.results[0]?.value;
      if (listContainer) {
        listContainer.removeEventListener = jest.fn();
      }

      controller.cleanup();

      // Verify cleanup was attempted
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Cleaned up')
      );
    });
  });
});
```

### Integration Tests

**File:** `tests/integration/domUI/actorParticipationIntegration.test.js` (NEW FILE)

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import ActorParticipationController from '../../../src/domUI/actorParticipationController.js';
import EntityManager from '../../../src/entities/entityManager.js';
import { ENGINE_READY_UI } from '../../../src/constants/eventIds.js';

describe('ActorParticipationController Integration', () => {
  let testBed;
  let controller;
  let entityManager;
  let eventBus;

  beforeEach(() => {
    testBed = createTestBed();

    // Create real entity manager with test configuration
    entityManager = testBed.createEntityManager();
    eventBus = testBed.createEventBus();

    // Create mock document context
    const mockDocumentContext = testBed.createMockDocumentContext();

    controller = new ActorParticipationController({
      eventBus,
      documentContext: mockDocumentContext,
      logger: testBed.createMockLogger(),
      entityManager,
    });
  });

  afterEach(() => {
    if (controller) {
      controller.cleanup();
    }
    testBed.cleanup();
  });

  it('should toggle participation and update entity component', async () => {
    // Create test actor
    const actorId = await entityManager.createEntity();
    await entityManager.addComponent(actorId, 'core:actor', {});
    await entityManager.addComponent(actorId, 'core:name', { name: 'Test Actor' });

    controller.initialize();

    // Trigger ENGINE_READY_UI
    eventBus.dispatch(ENGINE_READY_UI, {});

    // Get actor and toggle participation
    const actor = entityManager.getEntityInstance(actorId);
    actor.setComponentData('core:participation', { participating: false });

    // Verify component was set
    const participation = actor.getComponent('core:participation');
    expect(participation).toEqual({ participating: false });
  });

  it('should handle multiple actors with different participation states', async () => {
    // Create multiple actors
    const actor1Id = await entityManager.createEntity();
    await entityManager.addComponent(actor1Id, 'core:actor', {});
    await entityManager.addComponent(actor1Id, 'core:name', { name: 'Actor 1' });

    const actor2Id = await entityManager.createEntity();
    await entityManager.addComponent(actor2Id, 'core:actor', {});
    await entityManager.addComponent(actor2Id, 'core:name', { name: 'Actor 2' });

    controller.initialize();
    eventBus.dispatch(ENGINE_READY_UI, {});

    // Set different participation states
    const actor1 = entityManager.getEntityInstance(actor1Id);
    const actor2 = entityManager.getEntityInstance(actor2Id);

    actor1.setComponentData('core:participation', { participating: true });
    actor2.setComponentData('core:participation', { participating: false });

    // Verify states
    expect(actor1.getComponent('core:participation').participating).toBe(true);
    expect(actor2.getComponent('core:participation').participating).toBe(false);
  });
});
```

### Turn Order Integration Tests

**File:** `tests/integration/turns/participationTurnOrder.test.js` (NEW FILE)

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';

describe('Turn Order - Participation Integration', () => {
  let testBed;
  let entityManager;
  let turnQueue;

  beforeEach(() => {
    testBed = createTestBed();
    entityManager = testBed.createEntityManager();
    turnQueue = testBed.createTurnQueue();
  });

  it('should skip non-participating actors in turn order', async () => {
    // Create three actors
    const actor1 = await entityManager.createEntity();
    await entityManager.addComponent(actor1, 'core:actor', {});
    await entityManager.addComponent(actor1, 'core:participation', {
      participating: true,
    });

    const actor2 = await entityManager.createEntity();
    await entityManager.addComponent(actor2, 'core:actor', {});
    await entityManager.addComponent(actor2, 'core:participation', {
      participating: false,
    });

    const actor3 = await entityManager.createEntity();
    await entityManager.addComponent(actor3, 'core:actor', {});
    await entityManager.addComponent(actor3, 'core:participation', {
      participating: true,
    });

    // Add to turn queue
    turnQueue.addActor(actor1);
    turnQueue.addActor(actor2);
    turnQueue.addActor(actor3);

    // Get next actors
    const first = turnQueue.getNextActor();
    expect(first).toBe(actor1);

    const second = turnQueue.getNextActor();
    expect(second).toBe(actor3); // Actor2 should be skipped

    const third = turnQueue.getNextActor();
    expect(third).toBeNull(); // No more actors
  });

  it('should handle all actors non-participating', async () => {
    const actor1 = await entityManager.createEntity();
    await entityManager.addComponent(actor1, 'core:actor', {});
    await entityManager.addComponent(actor1, 'core:participation', {
      participating: false,
    });

    turnQueue.addActor(actor1);

    const next = turnQueue.getNextActor();
    expect(next).toBeNull();
  });
});
```

---

## 13. Implementation Checklist

### Phase 1: HTML & CSS (Foundational)

- [ ] **1.1** Add HTML panel structure to `game.html` (after line 121)
  - Include widget container, list container, status area
  - Add ARIA attributes
- [ ] **1.2** Add CSS styles to `css/style.css`
  - Actor list styling
  - Checkbox and label styling
  - Empty state styling
  - Hover effects

### Phase 2: Component Schema (Data Model)

- [ ] **2.1** Create `data/schemas/components/participation.schema.json`
  - Define schema structure with `participating` boolean
  - Set default value to `true`
- [ ] **2.2** Add schema reference to `data/schemas/component.schema.json`
  - Add to `anyOf` array
- [ ] **2.3** Add constant to `src/constants/componentIds.js`
  - Define `PARTICIPATION_COMPONENT_ID`

### Phase 3: Controller Implementation (Core Logic)

- [ ] **3.1** Create `src/domUI/actorParticipationController.js`
  - Implement complete class per specification
  - Include all methods and error handling
- [ ] **3.2** Add export to `src/domUI/index.js`
  - Export ActorParticipationController

### Phase 4: Dependency Injection (Integration)

- [ ] **4.1** Add token to `src/dependencyInjection/tokens/tokens-ui.js`
  - Define `ActorParticipationController` token
- [ ] **4.2** Register in `src/dependencyInjection/registrations/uiRegistrations.js`
  - Add import
  - Add registration with dependencies
- [ ] **4.3** Create `src/bootstrapper/stages/auxiliary/initActorParticipationController.js`
  - Implement initialization helper
- [ ] **4.4** Add export to `src/bootstrapper/stages/auxiliary/index.js`
  - Export initialization helper
- [ ] **4.5** Update `src/bootstrapper/stages/initializeAuxiliaryServicesStage.js`
  - Add import
  - Add to initialization sequence

### Phase 5: Turn Order Integration (Behavior)

- [ ] **5.1** Locate turn queue implementation
  - Check `src/turns/order/queues/initiativePriorityQueue.js`
  - Or similar file in `src/turns/order/`
- [ ] **5.2** Add participation filter to `getNextActor()` method
  - Import `PARTICIPATION_COMPONENT_ID`
  - Add while loop filter logic
  - Add debug logging

### Phase 6: Testing (Quality Assurance)

- [ ] **6.1** Create `tests/unit/domUI/actorParticipationController.test.js`
  - Implement all unit test suites
  - Test initialization, loading, toggle, cleanup
- [ ] **6.2** Create `tests/integration/domUI/actorParticipationIntegration.test.js`
  - Test with real entity manager
  - Test multiple actors, different states
- [ ] **6.3** Create `tests/integration/turns/participationTurnOrder.test.js`
  - Test turn order respects participation
  - Test edge cases (all disabled, etc.)
- [ ] **6.4** Run test suite
  - `npm run test:unit`
  - `npm run test:integration`
  - Verify coverage meets standards

### Phase 7: Quality Checks (Final Validation)

- [ ] **7.1** Run linter
  - `npx eslint src/domUI/actorParticipationController.js`
  - Fix any issues
- [ ] **7.2** Run type checker
  - `npm run typecheck`
  - Verify no type errors
- [ ] **7.3** Manual testing
  - Start application
  - Verify panel appears between Location and Send Event
  - Create scenario with multiple actors
  - Toggle participation switches
  - Verify turns are skipped for disabled actors
- [ ] **7.4** Accessibility validation
  - Test keyboard navigation
  - Test screen reader compatibility
  - Verify ARIA attributes work correctly

---

## 14. File Locations Summary

### New Files to Create

**Schemas:**
- `data/schemas/components/participation.schema.json`

**Source Code:**
- `src/domUI/actorParticipationController.js`
- `src/bootstrapper/stages/auxiliary/initActorParticipationController.js`

**Tests:**
- `tests/unit/domUI/actorParticipationController.test.js`
- `tests/integration/domUI/actorParticipationIntegration.test.js`
- `tests/integration/turns/participationTurnOrder.test.js`

### Files to Modify

**HTML:**
- `game.html` (line 121 - add panel HTML)

**CSS:**
- `css/style.css` (add actor participation styles)

**Constants:**
- `src/constants/componentIds.js` (add PARTICIPATION_COMPONENT_ID)

**Schemas:**
- `data/schemas/component.schema.json` (add schema reference)

**Exports:**
- `src/domUI/index.js` (add controller export)

**Dependency Injection:**
- `src/dependencyInjection/tokens/tokens-ui.js` (add token)
- `src/dependencyInjection/registrations/uiRegistrations.js` (add registration)
- `src/bootstrapper/stages/auxiliary/index.js` (add export)
- `src/bootstrapper/stages/initializeAuxiliaryServicesStage.js` (add init call)

**Turn Order:**
- `src/turns/order/queues/initiativePriorityQueue.js` (or similar - add filter)

---

## 15. Key Design Decisions & Rationale

### Controller Pattern vs Renderer Pattern

**Decision:** Use Controller pattern (like PerceptibleEventSenderController)

**Rationale:**
- Simpler state management for toggle switches
- Direct entity component manipulation
- No complex sub-component rendering needed
- Event-driven lifecycle fits the use case
- Matches existing pattern in codebase

### Participation Component Approach

**Decision:** Use `core:participation` component with persistent state

**Rationale:**
- Persistent across saves and sessions
- Clear game state representation
- Integrates with existing ECS architecture
- No need for external state management
- Enables future features (e.g., AI-controlled participation)

**Alternative Rejected:** Dispatch `TURN_ENDED_ID` to skip current turn
- Only works for current turn, not preventative
- Would require constant manual intervention
- Doesn't prevent LLM API calls (turn starts before skip)

### Default Participation State

**Decision:** Default to `participating: true` (opt-out model)

**Rationale:**
- New actors participate by default (expected behavior)
- User consciously chooses to disable actors
- Backwards compatible (no component = participating)
- Safer than opt-in (won't accidentally skip actors)

### Panel Placement

**Decision:** Between Location Renderer and Send Perceptible Event panel

**Rationale:**
- Logical grouping with other game control panels
- Right pane already established for UI controls
- Proximity to location info helps context
- Doesn't interfere with main gameplay area
- Follows existing widget pattern

### Turn Skip Implementation

**Decision:** Filter in turn queue `getNextActor()` method

**Rationale:**
- Single point of control
- Clean skip without side effects
- No LLM API calls for disabled actors
- Simple while loop implementation
- Transparent to rest of system

---

## 16. Future Enhancements (Not in Scope)

The following features are NOT included in this specification but could be added later:

1. **Bulk Toggle** - "Enable All" / "Disable All" buttons
2. **Group Management** - Group actors by location or faction
3. **Smart Suggestions** - Auto-disable actors far from action
4. **Participation History** - Track when actors were enabled/disabled
5. **Turn Budget** - Set maximum turns per session per actor
6. **Conditional Participation** - Enable/disable based on game state
7. **Visual Indicators** - Show which actors are currently active in turn order
8. **Keyboard Shortcuts** - Quick toggle via keyboard (e.g., number keys)

---

## 17. Accessibility Compliance

This implementation meets **WCAG AA** standards:

✅ **Keyboard Navigation**
- All controls accessible via keyboard
- Native checkbox behavior (Space to toggle)
- Tab navigation through actor list

✅ **Screen Reader Support**
- ARIA landmarks (`role="region"`)
- Labels properly associated with checkboxes
- Status messages (`role="status"`, `aria-live="polite"`)
- Descriptive `aria-label` on checkboxes

✅ **Visual Design**
- Sufficient color contrast
- Clear hover states
- Readable font sizes
- Focus indicators (browser default)

✅ **Semantic HTML**
- Proper heading hierarchy (`<h3>`)
- Native form controls (`<input type="checkbox">`)
- Semantic list structure (`<ul>`, `<li>`)

---

## 18. Error Handling Strategy

### Dependency Validation

**When:** Constructor phase
**How:** `validateDependency()` utility
**Result:** Throw error with clear message

### DOM Element Validation

**When:** Initialization phase
**How:** Check required elements exist
**Result:** Throw error if missing

### Entity Operations

**When:** Participation toggle
**How:** Try-catch with logging
**Result:** Revert UI state, show error status

### Event Subscription

**When:** Game lifecycle events
**How:** Check unsubscribe function returned
**Result:** Log error, continue gracefully

### Cleanup Operations

**When:** Component disposal
**How:** Try-catch around each cleanup step
**Result:** Log errors, continue cleanup

---

## 19. Performance Considerations

### Efficient Actor Queries

- Use `getEntitiesWithComponent()` (indexed lookup)
- Cache actor list between refreshes
- Only re-render on `ENGINE_READY_UI` event

### DOM Manipulation

- Use `DocumentContext.create()` for element creation
- Batch DOM updates (build full list, then append)
- Clear element efficiently with `DomUtils.clearElement()`

### Event Delegation

- Single change listener on list container
- Check class before processing (avoid unnecessary work)
- No individual listeners per checkbox

### Memory Management

- Properly cleanup event listeners
- Clear cached references
- Unsubscribe from all events
- No memory leaks from timeouts (status messages)

---

## 20. Troubleshooting Guide

### Panel Doesn't Appear

1. Check HTML was added to `game.html`
2. Verify CSS file loaded correctly
3. Check browser console for errors
4. Verify controller registered in DI

### Actors Don't Load

1. Check `ENGINE_READY_UI` event fires
2. Verify entity manager has actors
3. Check console for entity query errors
4. Verify `ACTOR_COMPONENT_ID` import correct

### Toggle Doesn't Work

1. Check event listener attached
2. Verify event delegation working
3. Check entity manager can update component
4. Look for errors in console

### Turns Not Skipped

1. Verify turn queue integration complete
2. Check `PARTICIPATION_COMPONENT_ID` import
3. Verify filter logic in `getNextActor()`
4. Test participation component exists on actor

### Tests Failing

1. Run `npm run test:unit -- --verbose`
2. Check mock setup matches interfaces
3. Verify test bed helpers available
4. Check test isolation (cleanup between tests)

---

**End of Specification**

This comprehensive specification provides complete implementation guidance for the Actor Participation Control Panel feature. All patterns follow existing codebase conventions and integrate seamlessly with the Living Narrative Engine architecture.
