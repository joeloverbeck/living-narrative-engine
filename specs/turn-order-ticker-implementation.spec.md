# Turn Order Ticker Implementation Specification

## Overview

Replace the underutilized world name banner (H1) with an interactive RPG-style turn order ticker that displays the queue of actor turns for the current round. The ticker will show actor portraits/names in order, animate their entrance at round start, remove them as turns complete, and visually indicate disabled (non-participating) actors.

## Problem Statement

The current game.html page has a banner displaying the world's name at the top (line 19), which provides minimal value during gameplay. The user typically scrolls past this to interact with the game. Meanwhile, important game state information—the order of actor turns in the current round—is processed internally but never displayed to the user. This creates a lack of transparency about turn progression and makes it harder to anticipate upcoming actions.

## Goals

1. **Replace unused space** - Repurpose the H1 banner area for actionable information
2. **Display turn order** - Show all actors in the current round's turn queue
3. **Animate round transitions** - Smoothly animate portraits/names entering the ticker when a round starts
4. **Track turn progress** - Remove actors from the ticker as they complete their turns
5. **Indicate participation status** - Visually distinguish non-participating actors (grayed out)
6. **Handle missing portraits** - Gracefully fallback to actor names when no portrait exists
7. **Responsive design** - Handle various portrait aspect ratios (tall, wide, square)

## Current System Analysis

### Turn Management Architecture

**Key Files:**
- `src/turns/turnManager.js` - Orchestrates turn lifecycle, dispatches `core:turn_started` and `core:turn_ended`
- `src/turns/roundManager.js` - Manages round initialization, tracks `#inProgress` and `#hadSuccess`
- `src/turns/order/turnOrderService.js` - Maintains turn queue, provides `getCurrentOrder()` method
- `src/turns/turnCycle.js` - Filters participating actors, wraps turn order service

**Turn Flow:**
1. `RoundManager.startRound()` - Collects all actors with `core:actor` component, initializes queue
2. `TurnOrderService.getCurrentOrder()` - Returns `ReadonlyArray<Entity>` of remaining turns
3. `TurnManager.advanceTurn()` - Dispatches `core:turn_started` with `{ entityId, entityType }`
4. `TurnCycle.nextActor()` - Retrieves next actor, skips if `participating: false`
5. `TurnManager#handleTurnEndedEvent()` - Processes `core:turn_ended`, advances to next actor
6. When queue empties, `RoundManager.startRound()` is called again

### Actor Participation System

**Key Files:**
- `src/domUI/actorParticipationController.js` - UI controller for toggling participation
- `src/constants/componentIds.js` - Defines `PARTICIPATION_COMPONENT_ID = 'core:participation'`

**Participation Component:**
```javascript
{
  "participating": boolean  // default: true
}
```

**Integration Points:**
- `actorParticipationController.js:220-240` - Updates `core:participation` component via `entityManager.addComponent()`
- `turnCycle.js:66-80` - Reads participation status, skips non-participating actors
- UI displays checkboxes in right pane (game.html:123-143)

### Current Banner Implementation

**Key Files:**
- `src/domUI/titleRenderer.js` - Manages H1 element content
- `game.html:19` - `<h1 id="title-element">Adventure Game</h1>`

**Current Behavior:**
- Shows "Loading..." during initialization
- Shows world name after `initialization:initialization_service:completed`
- Shows error messages during initialization failures
- Subscribes to initialization events via `core:set_title`

### Actor Display Data

**Components:**
- `core:portrait` - Contains `{ path: string }` to portrait image
- `core:name` - Contains `{ text: string }` for actor name
- `core:actor` - Marker component for actors

**Portrait Characteristics:**
- Different aspect ratios: tall (portrait), wide (landscape), square
- Not all actors have portraits (modder-dependent)
- Paths stored in mod structure (e.g., `data/mods/core/portraits/...`)

## Design Specification

### Visual Layout

#### Banner Structure
```
┌─────────────────────────────────────────────────────────┐
│ ROUND 1 │ [Portrait] [Portrait] [Portrait] [Portrait]  │
│         │  Alice      Bob       Charlie    Diana       │
│         │  ← current  next      →                      │
└─────────────────────────────────────────────────────────┘
```

#### Portrait Display Rules
1. **With Portrait:** Show portrait image with name below
2. **Without Portrait:** Show name badge styled as portrait placeholder
3. **Non-Participating:** Apply grayscale filter or reduced opacity (0.4)
4. **Current Actor:** Highlight with border/glow effect
5. **Aspect Ratio Handling:**
   - Fixed height: 60px
   - Width: auto (preserve aspect ratio)
   - Max width: 80px
   - Overflow: hidden with object-fit: cover

### Component Architecture

#### 1. TurnOrderTickerRenderer

**Location:** `src/domUI/turnOrderTickerRenderer.js`

**Responsibilities:**
- Manage DOM elements for turn order display
- Subscribe to turn/round lifecycle events
- Render actor queue with portraits/names
- Apply participation visual states
- Handle animations (entrance, exit, transitions)

**Dependencies:**
```javascript
{
  logger: ILogger,
  documentContext: IDocumentContext,
  validatedEventDispatcher: IValidatedEventDispatcher,
  domElementFactory: DomElementFactory,
  entityManager: IEntityManager,
  entityDisplayDataProvider: EntityDisplayDataProvider,
  tickerContainerElement: HTMLElement  // #turn-order-ticker
}
```

**Event Subscriptions:**
```javascript
'initialization:initialization_service:completed' // Initial render
'core:round_started' // (NEW) Animate in full queue
'core:turn_started' // Highlight current actor
'core:turn_ended' // Remove completed actor
'core:component_added' // Detect participation changes (PARTICIPATION_COMPONENT_ID)
'core:component_updated' // Detect participation changes (PARTICIPATION_COMPONENT_ID)
```

**Public Methods:**
```javascript
render(actors: Entity[]): void
  // Render full turn order (called on round start)

updateCurrentActor(entityId: string): void
  // Highlight current actor in queue

removeActor(entityId: string): void
  // Animate actor removal after turn completion

updateActorParticipation(entityId: string, participating: boolean): void
  // Update visual state for participation change

dispose(): void
  // Cleanup subscriptions and listeners
```

**Private Methods:**
```javascript
#createActorElement(entity: Entity): HTMLElement
  // Create portrait/name element for actor

#applyParticipationState(element: HTMLElement, participating: boolean): void
  // Apply grayscale/opacity for non-participating actors

#animateActorEntry(element: HTMLElement, index: number): void
  // Slide-in animation from left with stagger delay

#animateActorExit(element: HTMLElement): Promise<void>
  // Fade-out and slide-left animation

#getActorDisplayData(entityId: string): { name: string, portraitPath?: string }
  // Extract name and portrait from entity

#handleRoundStarted(event: any): void
  // Fetch turn order and render with animations

#handleTurnStarted(event: { payload: { entityId } }): void
  // Highlight current actor

#handleTurnEnded(event: { payload: { entityId } }): void
  // Remove actor from ticker

#handleParticipationChanged(event: any): void
  // Update actor visual state
```

#### 2. Round Tracking Enhancement

**Modify:** `src/turns/roundManager.js`

**Changes:**
- Dispatch `core:round_started` event when `startRound()` completes
- Include round number and actor list in payload

**New Event Payload:**
```javascript
{
  type: 'core:round_started',
  payload: {
    roundNumber: number,
    actors: string[],  // Array of entity IDs in turn order
    strategy: 'round-robin' | 'initiative'
  }
}
```

**Implementation:**
```javascript
// In RoundManager.startRound() after line 126
this.#dispatcher.dispatch('core:round_started', {
  roundNumber: this.#roundNumber,
  actors: actorIds,
  strategy: strategy
});
```

#### 3. Participation Event Enhancement

**Status:** No changes needed - component events already dispatched

**Existing Events:**
- `core:component_added` - Dispatched when participation component added
- `core:component_updated` - Dispatched when participation value changes

These events are already triggered by `entityManager.addComponent()` in `actorParticipationController.js:223`

### HTML Structure

**Modify:** `game.html`

**Before (Line 19):**
```html
<h1 id="title-element">Adventure Game</h1>
```

**After:**
```html
<div id="turn-order-ticker" role="region" aria-label="Turn order" aria-live="polite">
  <div class="ticker-round-label">
    <span id="ticker-round-number">ROUND 1</span>
  </div>
  <div id="ticker-actor-queue" class="ticker-actor-queue">
    <!-- Actor elements dynamically inserted here -->
  </div>
</div>
```

**Actor Element Structure:**
```html
<div class="ticker-actor" data-entity-id="actor-1" data-participating="true">
  <!-- WITH PORTRAIT -->
  <img
    class="ticker-actor-portrait"
    src="/path/to/portrait.jpg"
    alt="Alice"
    loading="lazy"
  />
  <span class="ticker-actor-name">Alice</span>

  <!-- WITHOUT PORTRAIT (alternative) -->
  <div class="ticker-actor-name-badge">
    <span class="ticker-actor-name">Bob</span>
  </div>
</div>
```

### CSS Styling

**Create:** `css/turn-order-ticker.css`

```css
/* Ticker Container */
#turn-order-ticker {
  position: sticky;
  top: 0;
  z-index: 100;
  background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
  border-bottom: 2px solid #3498db;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  padding: 0.75rem 1rem;
  display: flex;
  align-items: center;
  gap: 1.5rem;
  overflow-x: auto;
  overflow-y: hidden;
  min-height: 90px;
}

/* Round Label */
.ticker-round-label {
  flex-shrink: 0;
  font-weight: 700;
  font-size: 1.1rem;
  color: #ecf0f1;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-right: 2px solid #3498db;
  padding-right: 1rem;
  min-width: 100px;
}

/* Actor Queue */
.ticker-actor-queue {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex: 1;
  overflow-x: auto;
  padding: 0.25rem 0;
}

/* Individual Actor */
.ticker-actor {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
  position: relative;
  transition: transform 0.3s ease, opacity 0.3s ease;
}

/* Current Actor Highlight */
.ticker-actor.current {
  transform: scale(1.15);
}

.ticker-actor.current::before {
  content: '';
  position: absolute;
  top: -4px;
  left: -4px;
  right: -4px;
  bottom: -4px;
  border: 3px solid #3498db;
  border-radius: 8px;
  box-shadow: 0 0 15px rgba(52, 152, 219, 0.6);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(1.05); }
}

/* Portrait Display */
.ticker-actor-portrait {
  width: auto;
  height: 60px;
  max-width: 80px;
  object-fit: cover;
  border-radius: 6px;
  border: 2px solid #7f8c8d;
  background: #34495e;
  transition: filter 0.3s ease, opacity 0.3s ease;
}

/* Name Badge (No Portrait) */
.ticker-actor-name-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 60px;
  max-width: 80px;
  height: 60px;
  padding: 0.5rem;
  background: linear-gradient(135deg, #34495e 0%, #2c3e50 100%);
  border: 2px solid #7f8c8d;
  border-radius: 6px;
  transition: filter 0.3s ease, opacity 0.3s ease;
}

.ticker-actor-name-badge .ticker-actor-name {
  font-size: 0.85rem;
  font-weight: 600;
  text-align: center;
  word-break: break-word;
  line-height: 1.2;
}

/* Actor Name Label */
.ticker-actor-name {
  font-size: 0.75rem;
  color: #ecf0f1;
  text-align: center;
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Non-Participating State */
.ticker-actor[data-participating="false"] .ticker-actor-portrait,
.ticker-actor[data-participating="false"] .ticker-actor-name-badge {
  filter: grayscale(100%);
  opacity: 0.4;
}

.ticker-actor[data-participating="false"] .ticker-actor-name {
  color: #95a5a6;
  opacity: 0.6;
}

/* Entry Animation */
@keyframes slideInFromLeft {
  from {
    transform: translateX(-100px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.ticker-actor.entering {
  animation: slideInFromLeft 0.5s ease-out forwards;
}

/* Exit Animation */
@keyframes slideOutLeft {
  to {
    transform: translateX(-100px);
    opacity: 0;
  }
}

.ticker-actor.exiting {
  animation: slideOutLeft 0.4s ease-in forwards;
}

/* Responsive Design */
@media (max-width: 768px) {
  #turn-order-ticker {
    padding: 0.5rem;
    gap: 1rem;
  }

  .ticker-round-label {
    font-size: 0.9rem;
    min-width: 80px;
  }

  .ticker-actor-portrait,
  .ticker-actor-name-badge {
    height: 50px;
    max-width: 60px;
  }

  .ticker-actor-name {
    font-size: 0.65rem;
    max-width: 60px;
  }
}

/* Accessibility */
.ticker-actor:focus-within {
  outline: 2px solid #3498db;
  outline-offset: 2px;
}

/* Scrollbar Styling */
.ticker-actor-queue::-webkit-scrollbar {
  height: 6px;
}

.ticker-actor-queue::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 3px;
}

.ticker-actor-queue::-webkit-scrollbar-thumb {
  background: #3498db;
  border-radius: 3px;
}

.ticker-actor-queue::-webkit-scrollbar-thumb:hover {
  background: #2980b9;
}
```

### Event Constants

**Modify:** `src/constants/eventIds.js`

**Add:**
```javascript
export const ROUND_STARTED_ID = 'core:round_started';
```

### Implementation Sequence

#### Phase 1: Core Infrastructure
1. Add `ROUND_STARTED_ID` to `eventIds.js`
2. Modify `RoundManager` to dispatch round started event
3. Create ticker HTML structure in `game.html`
4. Create CSS file `turn-order-ticker.css`
5. Import CSS in `style.css`

#### Phase 2: Ticker Renderer
1. Create `TurnOrderTickerRenderer` class
2. Implement constructor with dependency validation
3. Implement event subscription methods
4. Implement `#getActorDisplayData()` helper
5. Implement `#createActorElement()` for DOM generation

#### Phase 3: Rendering Logic
1. Implement `render()` method for full queue display
2. Implement `updateCurrentActor()` for highlighting
3. Implement `removeActor()` for turn completion
4. Implement `updateActorParticipation()` for state changes

#### Phase 4: Animations
1. Implement `#animateActorEntry()` with stagger delays
2. Implement `#animateActorExit()` with promise
3. Add CSS transition classes
4. Test animation performance

#### Phase 5: Integration
1. Register `TurnOrderTickerRenderer` in DI container
2. Initialize in `engineUIManager.js` or `domUiFacade.js`
3. Update `TitleRenderer` to coexist or replace
4. Test with participation controller integration

#### Phase 6: Testing & Polish
1. Unit tests for `TurnOrderTickerRenderer`
2. Integration tests for round transitions
3. Test with varying portrait aspect ratios
4. Test with actors without portraits
5. Test participation toggling during rounds
6. Accessibility audit (screen readers, keyboard nav)
7. Performance testing with 10+ actors

## Edge Cases & Error Handling

### 1. Missing Portrait Data
**Scenario:** Actor has no `core:portrait` component or empty path
**Solution:** Fallback to name badge (`.ticker-actor-name-badge`)

### 2. Missing Name Data
**Scenario:** Actor has no `core:name` component
**Solution:** Fallback to entity ID as display name

### 3. Round Starts with No Actors
**Scenario:** All actors have `participating: false`
**Solution:** Show empty ticker with message "No participating actors"

### 4. Rapid Participation Toggling
**Scenario:** User rapidly toggles participation during a round
**Solution:** Debounce visual updates (300ms), queue state changes

### 5. Portrait Load Failures
**Scenario:** Portrait path invalid or image fails to load
**Solution:**
- Use `onerror` handler on `<img>`
- Replace with name badge on error
- Log warning to logger

### 6. Very Long Actor Names
**Scenario:** Actor name exceeds display width
**Solution:**
- Use `text-overflow: ellipsis`
- Show full name in `title` attribute (tooltip)

### 7. Mid-Round Participation Change
**Scenario:** User disables participation for current actor
**Solution:**
- Update visual state immediately (grayscale)
- Current turn completes normally
- Actor skipped in next cycle

### 8. Queue Exhaustion During Round
**Scenario:** All remaining actors disabled mid-round
**Solution:**
- `TurnCycle.nextActor()` returns null
- `TurnManager` starts new round (existing behavior)

### 9. Animation Conflicts
**Scenario:** Turn ends before entry animation completes
**Solution:**
- Track animation state in data attribute
- Cancel ongoing animations before starting new ones
- Use `requestAnimationFrame` for smooth transitions

### 10. Horizontal Overflow
**Scenario:** More than 10 actors in queue
**Solution:**
- Enable horizontal scrolling in `.ticker-actor-queue`
- Auto-scroll to current actor on turn start
- Add visual indicators for overflow (fade gradients)

## Testing Strategy

### Unit Tests
**File:** `tests/unit/domUI/turnOrderTickerRenderer.test.js`

**Test Cases:**
```javascript
describe('TurnOrderTickerRenderer - Constructor', () => {
  it('should validate all required dependencies')
  it('should throw error if logger missing')
  it('should throw error if entityManager missing')
  it('should bind ticker container element')
  it('should subscribe to turn lifecycle events')
})

describe('TurnOrderTickerRenderer - Rendering', () => {
  it('should render actors with portraits')
  it('should render actors without portraits as name badges')
  it('should apply current actor highlight')
  it('should display round number')
  it('should handle empty actor queue')
})

describe('TurnOrderTickerRenderer - Participation', () => {
  it('should apply grayscale to non-participating actors')
  it('should update visual state on participation change')
  it('should preserve actor order when participation changes')
})

describe('TurnOrderTickerRenderer - Animations', () => {
  it('should stagger entry animations by 100ms per actor')
  it('should animate actor removal on turn end')
  it('should cancel animations on dispose')
})

describe('TurnOrderTickerRenderer - Event Handling', () => {
  it('should render on round started event')
  it('should highlight on turn started event')
  it('should remove on turn ended event')
  it('should update on participation component changed')
})
```

### Integration Tests
**File:** `tests/integration/domUI/turnOrderTicker.integration.test.js`

**Test Cases:**
```javascript
describe('Turn Order Ticker Integration', () => {
  it('should display full queue when round starts')
  it('should remove actors as turns complete')
  it('should start new round when queue exhausts')
  it('should sync with actorParticipationController changes')
  it('should handle actor without portrait gracefully')
  it('should handle rapid turn progression')
})
```

### E2E Tests
**File:** `tests/e2e/turnOrderTicker.e2e.test.js`

**Test Cases:**
```javascript
describe('Turn Order Ticker E2E', () => {
  it('should display ticker on game load')
  it('should animate actors on first round')
  it('should update when user toggles participation')
  it('should highlight current actor during turn')
  it('should remove actor on turn completion')
  it('should refresh on new round')
})
```

## Performance Considerations

1. **Lazy Loading Portraits:** Use `loading="lazy"` attribute
2. **Animation Throttling:** Use `requestAnimationFrame` for smooth 60fps
3. **DOM Reuse:** Update existing elements instead of recreating
4. **Event Debouncing:** Debounce rapid participation changes (300ms)
5. **Memory Management:** Cleanup event listeners in `dispose()`
6. **Horizontal Scrolling:** Use CSS `scroll-behavior: smooth`

## Accessibility Requirements

1. **ARIA Labels:**
   - `role="region"` on ticker container
   - `aria-label="Turn order"` for context
   - `aria-live="polite"` for updates

2. **Screen Reader Announcements:**
   - Announce round start: "Round 1 started with 4 actors"
   - Announce turn start: "Alice's turn"
   - Announce participation change: "Bob disabled from participation"

3. **Keyboard Navigation:**
   - Ticker actors focusable with `tabindex="0"`
   - Focus indicator via `outline`

4. **High Contrast Mode:**
   - Test with Windows High Contrast
   - Ensure borders/highlights visible

5. **Reduced Motion:**
   ```css
   @media (prefers-reduced-motion: reduce) {
     .ticker-actor.entering,
     .ticker-actor.exiting {
       animation: none;
       transition: opacity 0.1s;
     }
   }
   ```

## Migration from Current System

### Step 1: Update TitleRenderer
**Option A (Coexistence):** Keep `TitleRenderer` for error messages, hide during gameplay
**Option B (Replacement):** Remove `TitleRenderer`, move error handling to separate component

**Recommendation:** Option A for safer rollout

**Implementation:**
```javascript
// In TitleRenderer constructor or initialization
if (this.#gameplayActive) {
  this.#titleElement.style.display = 'none';
}
```

### Step 2: Update CSS Imports
**File:** `css/style.css`
```css
@import 'turn-order-ticker.css';
```

### Step 3: Register in DI Container
**File:** `src/dependencyInjection/registrations/uiRegistrations.js`
```javascript
import { TurnOrderTickerRenderer } from '../../domUI/turnOrderTickerRenderer.js';

container.register(tokens.ITurnOrderTickerRenderer, TurnOrderTickerRenderer, {
  dependencies: [
    tokens.ILogger,
    tokens.IDocumentContext,
    tokens.IValidatedEventDispatcher,
    tokens.IDomElementFactory,
    tokens.IEntityManager,
    tokens.IEntityDisplayDataProvider,
    'tickerContainerElement' // Resolved separately
  ]
});
```

### Step 4: Initialize in UI Manager
**File:** `src/domUI/engineUIManager.js` or `domUiFacade.js`
```javascript
// After other UI components initialized
const tickerContainer = documentContext.query('#turn-order-ticker');
const tickerRenderer = new TurnOrderTickerRenderer({
  logger,
  documentContext,
  validatedEventDispatcher,
  domElementFactory,
  entityManager,
  entityDisplayDataProvider,
  tickerContainerElement: tickerContainer
});
```

## Future Enhancements

1. **Initiative Scores:** Display initiative values in initiative-based rounds
2. **Turn Timer:** Show countdown for timed turns
3. **Draggable Reordering:** Allow manual turn order adjustment (GM mode)
4. **Actor Status Icons:** Show conditions (stunned, inspired, etc.)
5. **Tooltip Details:** Hover to see full actor info
6. **Collapse/Expand:** Toggle ticker visibility for more screen space
7. **Round History:** Click round number to see past rounds
8. **Export Turn Log:** Save turn order history to file

## Documentation Updates

### Files to Update
1. `README.md` - Add turn order ticker feature
2. `docs/ui-components.md` - Document `TurnOrderTickerRenderer`
3. `docs/events.md` - Document `core:round_started` event
4. `CLAUDE.md` - Add ticker to UI component list

### User Guide Section
```markdown
## Turn Order Ticker

The turn order ticker displays at the top of the game screen, showing:
- Current round number
- All actors in turn order (left to right)
- Current actor with blue highlight
- Non-participating actors in grayscale

### Reading the Ticker
- **Leftmost actor:** Next to take their turn
- **Highlighted actor:** Currently taking their turn
- **Grayed out:** Actor not participating this round

### Interaction
Toggle actor participation in the Actor Participation Control panel (right sidebar).
Changes take effect in the next turn cycle.
```

## Acceptance Criteria

### Must Have
- ✅ Ticker displays all actors in current round
- ✅ Actors shown with portraits OR names
- ✅ Current actor highlighted with visual effect
- ✅ Actors removed when turn completes
- ✅ Non-participating actors shown in grayscale
- ✅ Ticker refreshes on new round
- ✅ Smooth animations for entry/exit
- ✅ Responsive to different screen sizes
- ✅ Accessible (ARIA, keyboard nav)

### Should Have
- ✅ Horizontal scroll for many actors
- ✅ Auto-scroll to current actor
- ✅ Tooltips for long names
- ✅ Error handling for missing data
- ✅ Portrait aspect ratio handling

### Could Have
- Initiative scores display
- Turn timer
- Collapse/expand toggle
- Round history navigation

### Won't Have (This Phase)
- Draggable reordering
- Status effect icons
- Actor stat tooltips
- Turn log export

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Portrait load failures | Medium | Medium | Graceful fallback to name badges |
| Animation performance | Medium | Low | Use CSS transforms, requestAnimationFrame |
| Participation sync issues | High | Low | Subscribe to component events directly |
| Horizontal overflow | Low | High | CSS scrolling with overflow indicators |
| Event dispatch failures | High | Low | Robust error handling, fallback renders |
| TitleRenderer conflicts | Medium | Low | Conditional display logic |

## Dependencies

### Internal
- `src/turns/turnManager.js` - Turn lifecycle events
- `src/turns/roundManager.js` - Round started event (NEW)
- `src/domUI/actorParticipationController.js` - Participation changes
- `src/entities/entityManager.js` - Component data access
- `src/entities/entityDisplayDataProvider.js` - Actor display data

### External
- None (pure DOM manipulation)

## Rollout Plan

### Phase 1: Development (Week 1)
- Implement core ticker renderer
- Add round started event
- Create HTML/CSS structure

### Phase 2: Integration (Week 1-2)
- Wire up event subscriptions
- Integrate with participation controller
- Add animations

### Phase 3: Testing (Week 2)
- Unit tests
- Integration tests
- Manual testing with various scenarios

### Phase 4: Polish (Week 2-3)
- Accessibility improvements
- Performance optimization
- Documentation

### Phase 5: Deployment (Week 3)
- Merge to main branch
- Update user documentation
- Monitor for issues

## Success Metrics

1. **Visibility:** 100% of testers notice and understand the ticker
2. **Accuracy:** Turn order matches internal queue 100% of time
3. **Performance:** Animations maintain 60fps on target hardware
4. **Accessibility:** Passes WCAG 2.1 AA compliance
5. **Usability:** Users report improved turn awareness (survey)

## Conclusion

The turn order ticker addresses a significant UX gap by making the turn queue visible and interactive. By repurposing underutilized screen space, it improves gameplay transparency without disrupting existing layouts. The design accounts for edge cases (missing portraits, participation changes) and maintains accessibility standards. The phased implementation reduces risk while delivering immediate value.

---

**Specification Version:** 1.0
**Created:** 2025-11-12
**Author:** Claude (AI Assistant)
**Status:** Ready for Implementation
