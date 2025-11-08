# ACTPARCONPAN-005: Actor Loading and Rendering Logic

## Ticket Information
- **ID**: ACTPARCONPAN-005
- **Phase**: 2 - Controller
- **Estimated Time**: 3-4 hours
- **Complexity**: Medium
- **Dependencies**: ACTPARCONPAN-004

## Scope
Implement actor loading from the entity manager, dynamic UI rendering, and empty state handling in the `ActorParticipationController`.

## Detailed Tasks

### Game Ready Handler Implementation
- [ ] Replace `#handleGameReady()` placeholder with full implementation
- [ ] Call `#loadActors()` to fetch actor entities
- [ ] Call `#renderActorList()` with loaded actors
- [ ] Add error handling with status message display

### Actor Loading Logic
- [ ] Implement `#loadActors()` private method
- [ ] Query entities using `entityManager.getEntitiesWithComponent(ACTOR_COMPONENT_ID)` (returns Entity array)
- [ ] Extract actor ID from entity.id
- [ ] Get name from `core:name` component using `entity.getComponentData(NAME_COMPONENT_ID)?.text`
- [ ] Query participation component using `entity.getComponentData(PARTICIPATION_COMPONENT_ID)`
- [ ] Build actor data array: `{ id, name, participating }`
- [ ] Default `participating` to `true` if component doesn't exist
- [ ] Sort actors alphabetically by name
- [ ] Return actor data array

**Important Notes:**
- `core:actor` is a marker component with no data
- Actor names come from `core:name` component with structure `{ text: "Name" }`
- Use `getComponentData()` which returns plain data objects (no `.dataSchema` wrapper)
- `getEntitiesWithComponent()` already filters entities (no manual filtering needed)

### Actor List Rendering
- [ ] Implement `#renderActorList(actors)` private method
- [ ] Check if list container exists
- [ ] Clear existing list content (`innerHTML = ''`)
- [ ] If actors array is empty, call `#renderEmpty()`
- [ ] Otherwise, iterate actors and create list items
- [ ] Append all list items to container
- [ ] Log rendering completion

### List Item Creation
- [ ] Implement `#createActorListItem(actor)` private method
- [ ] Create container div with class `actor-participation-item`
- [ ] Create checkbox input with:
  - `type="checkbox"`
  - `id="actor-participation-{actorId}"`
  - `checked` attribute based on `actor.participating`
  - `data-actor-id` attribute with actor ID
- [ ] Create label element with:
  - `for="actor-participation-{actorId}"`
  - Text content: actor name
- [ ] Append checkbox and label to container
- [ ] Return container element

### Empty State Rendering
- [ ] Implement `#renderEmpty()` private method
- [ ] Create paragraph element with class `empty-list-message`
- [ ] Set text content: "No actors found"
- [ ] Append to list container
- [ ] Log empty state

### Defensive Loading
- [ ] Add `#loadActors()` call in constructor (after event subscription)
- [ ] Wrap in try-catch to handle errors if actors load before ENGINE_READY_UI
- [ ] Log if defensive loading succeeds or fails

### Refresh Method
- [ ] Implement public `refresh()` method
- [ ] Call `#loadActors()` and `#renderActorList()`
- [ ] Expose this method for external updates
- [ ] Add to JSDoc comments

## Files Modified
- `src/domUI/actorParticipationController.js`

## Code Changes Template
```javascript
// Import additional constants
import { ACTOR_COMPONENT_ID, NAME_COMPONENT_ID } from '../constants/componentIds.js';

// Add to class
#actors = [];

// Replace #handleGameReady placeholder
#handleGameReady() {
  try {
    this.#logger.info('Loading actors for participation panel');
    const actors = this.#loadActors();
    this.#renderActorList(actors);
  } catch (err) {
    this.#logger.error('Failed to load actors', err);
    // Note: Add #showStatus() method implementation if status display needed
  }
}

#loadActors() {
  // Use getEntitiesWithComponent - returns Entity[] already filtered
  const actorEntities = this.#entityManager.getEntitiesWithComponent(ACTOR_COMPONENT_ID);

  const actors = actorEntities.map((entity) => {
    // Get name from core:name component (has 'text' property)
    const nameData = entity.getComponentData(NAME_COMPONENT_ID);

    // Get participation from core:participation component (has 'participating' property)
    const participationData = entity.getComponentData(PARTICIPATION_COMPONENT_ID);

    return {
      id: entity.id,
      name: nameData?.text || entity.id, // Fallback to entity ID
      participating: participationData?.participating ?? true,
    };
  });

  // Sort alphabetically by name
  actors.sort((a, b) => a.name.localeCompare(b.name));

  this.#logger.debug(`Loaded ${actors.length} actors`);
  return actors;
}

#renderActorList(actors) {
  if (!this.#actorParticipationList) {
    this.#logger.warn('Cannot render actors: list container not found');
    return;
  }

  // Clear existing content
  this.#actorParticipationList.innerHTML = '';

  if (actors.length === 0) {
    this.#renderEmpty();
    return;
  }

  // Create and append actor items
  actors.forEach((actor) => {
    const listItem = this.#createActorListItem(actor);
    this.#actorParticipationList.appendChild(listItem);
  });

  this.#logger.info(`Rendered ${actors.length} actors in participation panel`);
}

#createActorListItem(actor) {
  // Use 'create' method, not 'createElement'
  const container = this.#documentContext.create('div');
  container.className = 'actor-participation-item';

  const checkbox = this.#documentContext.create('input');
  checkbox.type = 'checkbox';
  checkbox.id = `actor-participation-${actor.id}`;
  checkbox.checked = actor.participating;
  checkbox.dataset.actorId = actor.id;

  const label = this.#documentContext.create('label');
  label.htmlFor = checkbox.id;
  label.textContent = actor.name;

  container.appendChild(checkbox);
  container.appendChild(label);

  return container;
}

#renderEmpty() {
  const emptyMessage = this.#documentContext.create('p');
  emptyMessage.className = 'empty-list-message';
  emptyMessage.textContent = 'No actors found';
  this.#actorParticipationList.appendChild(emptyMessage);
  this.#logger.debug('Rendered empty actor list message');
}

// Add public refresh method
refresh() {
  this.#logger.info('Refreshing actor participation panel');
  const actors = this.#loadActors();
  this.#renderActorList(actors);
}

// Add defensive loading to constructor (after #subscribeToGameEvents())
try {
  const actors = this.#loadActors();
  this.#renderActorList(actors);
  this.#logger.debug('Defensive actor loading succeeded');
} catch (err) {
  this.#logger.debug('Defensive actor loading failed (expected if actors not yet loaded)', err);
}
```

## Acceptance Criteria
- [ ] `#loadActors()` queries entity manager for actors
- [ ] Participation component is queried for each actor
- [ ] Default participation state is `true` if component doesn't exist
- [ ] Actors are sorted alphabetically by name
- [ ] `#renderActorList()` clears previous content
- [ ] Empty state is displayed when no actors exist
- [ ] List items are created with proper structure and attributes
- [ ] Checkboxes reflect current participation state
- [ ] `data-actor-id` attribute is set for event handling
- [ ] `refresh()` method allows manual panel updates
- [ ] Defensive loading handles early initialization gracefully
- [ ] All code follows project conventions
- [ ] No ESLint errors

## Validation Steps
1. Run `npx eslint src/domUI/actorParticipationController.js`
2. Run `npm run typecheck`
3. Test actor loading with mock entity manager in unit test
4. Verify empty state rendering when no actors exist
5. Verify actor list rendering with multiple actors
6. Check that participation state defaults to `true`
7. Verify alphabetical sorting

## Notes
- **EntityManager API**: Use `getEntitiesWithComponent(ACTOR_COMPONENT_ID)` which returns Entity array already filtered
- **Component Access**: Use `entity.getComponentData(componentId)` which returns plain data objects (no `.dataSchema` wrapper)
- **Actor Names**: Come from `core:name` component with structure `{ text: "Name" }`, not from actor component
- **Actor Component**: `core:actor` is a marker component with no data fields
- **Participation Component**: Access `participating` property directly from component data
- **DocumentContext**: Use `create('tagName')` method, not `createElement()`
- Handle missing participation component gracefully (default `true`)
- Use `dataset.actorId` for clean event handling in toggle method
- Defensive loading ensures UI updates even if ENGINE_READY_UI fires late
- The `refresh()` method allows external code to trigger re-renders
