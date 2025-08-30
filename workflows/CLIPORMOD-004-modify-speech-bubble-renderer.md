# CLIPORMOD-004: Modify Speech Bubble Renderer for Portrait Clicks

## Status
🔴 NOT STARTED

## Priority
HIGH - Core integration point

## Dependencies
- CLIPORMOD-001 (PortraitModalRenderer must exist)
- CLIPORMOD-005 (Dependency injection must be configured)

## Description
Modify the `SpeechBubbleRenderer` class to make AI character portraits clickable and integrate with the new `PortraitModalRenderer`. This involves updating method signatures, adding click handlers, and implementing the logic to distinguish between AI and human player portraits.

## File to Modify
`src/domUI/speechBubbleRenderer.js`

## Critical Changes Required

### 1. Add PortraitModalRenderer Dependency

#### Constructor Modification
```javascript
// Add to constructor parameters
constructor({
  // ... existing parameters ...
  portraitModalRenderer, // NEW PARAMETER
  // ... rest of parameters ...
}) {
  // ... existing validation ...
  
  // NEW: Validate and store portrait modal renderer
  validateDependency(portraitModalRenderer, 'IPortraitModalRenderer', logger, {
    requiredMethods: ['showModal', 'hideModal']
  });
  this.#portraitModalRenderer = portraitModalRenderer;
  
  // ... rest of constructor ...
}
```

#### Add Private Field
```javascript
class SpeechBubbleRenderer extends BoundDomRendererBase {
  // ... existing fields ...
  #portraitModalRenderer; // NEW FIELD
  // ... rest of fields ...
}
```

### 2. Modify #addPortrait Method Signature

**CRITICAL ISSUE**: The current method does NOT receive `entityId` as a parameter.

#### Current Signature (Line ~266)
```javascript
#addPortrait(container, portraitPath, speakerName) {
```

#### New Signature Required
```javascript
#addPortrait(container, portraitPath, speakerName, entityId) {
```

### 3. Update renderSpeech Method Call

#### Find the Call (around line 356)
Current:
```javascript
const hasPortrait = this.#addPortrait(
  speechEntryDiv,
  portraitPath,
  speakerName
);
```

Update to:
```javascript
const hasPortrait = this.#addPortrait(
  speechEntryDiv,
  portraitPath,
  speakerName,
  entityId  // ADD THIS PARAMETER
);
```

### 4. Implement Click Handler Logic in #addPortrait

#### Complete Implementation
```javascript
#addPortrait(container, portraitPath, speakerName, entityId) {
  if (!container) {
    this.#logger.warn('No container element provided for portrait');
    return false;
  }

  let hasPortrait = false;

  if (portraitPath) {
    const portraitImg = this.domElementFactory.img(
      portraitPath,
      `Portrait of ${speakerName}`,
      'speech-portrait'
    );

    if (portraitImg) {
      hasPortrait = true;

      // NEW: Determine if this is an AI character
      const isAICharacter = this.#isAICharacter(entityId);
      
      if (isAICharacter) {
        // Make portrait clickable for AI characters
        this.#makePortraitClickable(portraitImg, portraitPath, speakerName);
      }

      container.appendChild(portraitImg);
    }
  } else {
    // Handle text-only case (existing code)
    const noPortraitDiv = this.domElementFactory.div('', 'no-portrait-placeholder');
    if (noPortraitDiv) {
      noPortraitDiv.textContent = speakerName?.[0] || '?';
      container.appendChild(noPortraitDiv);
    }
  }

  return hasPortrait;
}
```

### 5. Add Helper Methods

#### Method to Determine AI Character
```javascript
#isAICharacter(entityId) {
  if (!entityId) {
    // Default to AI if no entity ID provided
    return true;
  }
  
  try {
    const speakerEntity = this.#entityManager.getEntityInstance(entityId);
    
    if (!speakerEntity) {
      // If entity doesn't exist, assume AI
      return true;
    }
    
    // Check for player type component
    if (speakerEntity.hasComponent(PLAYER_TYPE_COMPONENT_ID)) {
      const playerTypeData = speakerEntity.getComponentData(PLAYER_TYPE_COMPONENT_ID);
      return playerTypeData?.type !== 'human';
    }
    
    // Check for player component (indicates human player)
    if (speakerEntity.hasComponent(PLAYER_COMPONENT_ID)) {
      return false;
    }
    
    // Default to AI character
    return true;
  } catch (error) {
    this.#logger.warn(`Error checking if entity is AI: ${error.message}`);
    return true; // Default to AI on error
  }
}
```

#### Method to Make Portrait Clickable
```javascript
#makePortraitClickable(portraitImg, portraitPath, speakerName) {
  // Add visual indicator
  portraitImg.classList.add('clickable');
  portraitImg.style.cursor = 'pointer';
  
  // Add ARIA attributes for accessibility
  portraitImg.setAttribute('role', 'button');
  portraitImg.setAttribute('tabindex', '0');
  portraitImg.setAttribute('aria-label', `Click to view larger portrait of ${speakerName}`);
  
  // Add click handler
  this._addDomListener(portraitImg, 'click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    this.#handlePortraitClick(portraitPath, speakerName, portraitImg);
  });
  
  // Add keyboard handler for accessibility
  this._addDomListener(portraitImg, 'keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      this.#handlePortraitClick(portraitPath, speakerName, portraitImg);
    }
  });
}
```

#### Method to Handle Portrait Click
```javascript
#handlePortraitClick(portraitPath, speakerName, portraitImg) {
  try {
    // Dispatch event for analytics/tracking if needed
    this.#validatedEventDispatcher.dispatch({
      type: 'PORTRAIT_CLICKED',
      payload: {
        speakerName,
        portraitPath
      }
    });
    
    // Show the modal
    this.#portraitModalRenderer.showModal(portraitPath, speakerName, portraitImg);
  } catch (error) {
    this.#logger.error('Failed to open portrait modal', error);
    // Graceful degradation - portrait remains functional even if modal fails
  }
}
```

### 6. Import Required Constants

Add to imports at top of file:
```javascript
import { PLAYER_TYPE_COMPONENT_ID, PLAYER_COMPONENT_ID } from '../constants/componentIds.js';
```

## Alternative Implementation Option

If modifying the method signature is too risky, an alternative approach is to store the entity ID as a data attribute during speech rendering:

### Alternative: Store Entity ID as Data Attribute
```javascript
// In renderSpeech method, add data attribute to speechEntryDiv
speechEntryDiv.setAttribute('data-entity-id', entityId);

// In #addPortrait, retrieve it
const entityId = container.closest('.speech-entry')?.getAttribute('data-entity-id');
```

## Error Handling

### Graceful Degradation
- If modal renderer is not available, portraits remain static
- If entity detection fails, default to AI character behavior
- If click handler fails, log error but don't break functionality
- If portrait path is invalid, modal shows error state

### Logging Strategy
```javascript
// Use appropriate log levels
this.#logger.debug('Making portrait clickable', { speakerName, entityId });
this.#logger.warn('Could not determine entity type', { entityId });
this.#logger.error('Failed to open portrait modal', error);
```

## Testing Requirements

### Unit Test Coverage
- Test AI vs human player detection logic
- Test click handler attachment
- Test keyboard handler attachment
- Test ARIA attribute addition
- Test error handling paths
- Test graceful degradation

### Integration Points to Test
- Modal opens when AI portrait clicked
- Human portraits remain non-clickable
- Focus management works correctly
- Event dispatching works
- Memory cleanup on component destruction

## Rollback Plan
If issues occur:
1. Remove click handlers from portraits
2. Remove `clickable` class
3. Portraits return to static display
4. No breaking changes to existing functionality

## Success Criteria
- [ ] Constructor accepts portraitModalRenderer dependency
- [ ] #addPortrait method signature updated to include entityId
- [ ] renderSpeech method passes entityId to #addPortrait
- [ ] AI portraits are clickable with visual feedback
- [ ] Human portraits remain non-interactive
- [ ] Click opens portrait modal with correct data
- [ ] Keyboard navigation works (Enter/Space)
- [ ] ARIA attributes properly set
- [ ] Error handling prevents crashes
- [ ] All existing functionality preserved
- [ ] No memory leaks from event listeners

## Notes
- The `_addDomListener` method from parent class handles cleanup automatically
- Consider performance impact if many portraits are on screen
- Monitor for event listener memory leaks in long conversations
- This integration must be tested with both AI and human player entities