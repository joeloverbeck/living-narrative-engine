# Clickable Portrait Modal Feature Specification

## Specification Validation Notes

**Last Validated**: 2025-08-30

### Verified Existing Components
1. **Modal Base Class**: `BaseModalRenderer` exists at `src/domUI/baseModalRenderer.js` and provides common modal behaviors
2. **Parent Classes**: `BoundDomRendererBase` and `RendererBase` exist with `_addDomListener` method for event management
3. **Speech Bubble System**: `SpeechBubbleRenderer` exists with `#addPortrait` method (lines 266-303)
4. **Component IDs**: `PLAYER_TYPE_COMPONENT_ID` and `PLAYER_COMPONENT_ID` exist in `src/constants/componentIds.js`
5. **Modal CSS Infrastructure**: Basic modal styles exist in `css/components/_modals.css`
6. **Speech Bubble CSS**: Portrait styles exist in `css/components/_speech-bubbles.css`

### Components That Need To Be Created
1. **PortraitModalRenderer Class**: Does not exist, needs to be created at `src/domUI/portraitModalRenderer.js`
2. **Portrait Modal CSS**: File `css/components/_portrait-modal.css` does not exist, needs to be created
3. **Modal HTML Structure**: The portrait modal HTML structure needs to be added to the main HTML file

### Critical Corrections
1. **EntityId Parameter**: The `#addPortrait` method currently does NOT receive `entityId` as a parameter. It only receives `(container, portraitPath, speakerName)`. The method needs to be modified to also receive `entityId` OR the player detection logic needs to be moved to the calling context.
2. **WCAG Compliance**: The existing modal infrastructure has only basic accessibility support (aria-hidden attributes). Full WCAG 2.1 AA compliance needs to be implemented from scratch.
3. **Test Structure**: Correctly uses `@jest/globals` and `createTestBed` pattern.

## Overview

This specification defines the implementation of clickable AI character portraits within the Living Narrative Engine's chat system. When users click on AI character portraits displayed alongside speech bubbles, a modal will appear showing the portrait in high resolution, providing a better viewing experience for character artwork.

### Implementation Requirements Summary

**Files That Need to Be Created:**
- `src/domUI/portraitModalRenderer.js` - New modal renderer class
- `css/components/_portrait-modal.css` - New CSS file for portrait modal styles
- Modal HTML structure needs to be added to the main HTML file

**Files That Need to Be Modified:**
- `src/domUI/speechBubbleRenderer.js` - Modify `#addPortrait` method signature and add click handlers
- The main HTML file - Add portrait modal DOM structure
- CSS imports - Include the new `_portrait-modal.css` file

**Existing Infrastructure to Leverage:**
- `BaseModalRenderer` class for modal behaviors
- `BoundDomRendererBase` and `RendererBase` for event management
- Modal CSS patterns in `_modals.css`
- Component ID constants for player detection
- Test infrastructure with `createTestBed`

**Status**: Specification  
**Priority**: Medium  
**Complexity**: Low-Medium  
**Target Version**: Next Release

## Current State Analysis

### Existing Speech Bubble System

**Location**: `src/domUI/speechBubbleRenderer.js`
- **Portrait Integration**: Line 266-303 (`#addPortrait` method)
- **Portrait Creation**: Uses `domElementFactory.img()` with class `speech-portrait`
- **Current Behavior**: Static display only, no interaction
- **Portrait Data Source**: `entityDisplayDataProvider.getEntityPortraitPath(entityId)`
- **Extends**: `BoundDomRendererBase` class which provides `_addDomListener` method for event management

**CSS Styling**: `css/components/_speech-bubbles.css`
```css
.speech-entry .speech-portrait {
  width: var(--portrait-size-large, 100px);
  height: auto;
  border-radius: var(--border-radius-lg, 12px);
  margin-right: var(--spacing-md);
  object-fit: contain;
  border: 1px solid var(--border-color-subtle);
  flex-shrink: 0;
  background-color: var(--secondary-bg-color);
  display: block;
}
```

**Modal Infrastructure**: `css/components/_modals.css`
- Existing modal system with backdrop, transitions, and responsive design
- `.modal-overlay` and `.modal-content` classes available for reuse
- Basic accessibility support with `aria-hidden` attributes
- **Note**: Full WCAG 2.1 AA compliance will need to be implemented as part of this feature

**Existing Modal Base Class**: `src/domUI/baseModalRenderer.js`
- Abstract class that extends `BoundDomRendererBase`
- Provides common modal behaviors: visibility management, focus handling, escape key support
- Includes status message functionality and lifecycle hooks
- Used by other modals like `LlmSelectionModal`, `SaveGameUI`, `LoadGameUI`

## Requirements

### Functional Requirements

1. **Portrait Clickability**
   - Only AI character portraits with valid image paths should be clickable
   - Human player portraits remain non-interactive
   - Portraits without images should not trigger modal

2. **Modal Display**
   - Modal appears with semi-transparent backdrop shadowing the rest of the page
   - Portrait displays in high resolution based on original image dimensions
   - Modal centers on screen and maintains aspect ratio
   - Smooth fade-in animation on open

3. **User Interaction**
   - Click on portrait opens corresponding modal
   - Click outside modal (on backdrop) closes modal
   - ESC key closes modal
   - Multiple portraits can be clicked sequentially

4. **Visual Design**
   - Modal follows existing design system patterns
   - Portrait scales appropriately to viewport while preserving aspect ratio
   - Loading state displayed while portrait loads
   - Error state for failed image loads

### Technical Requirements

1. **Integration**
   - Seamless integration with existing `SpeechBubbleRenderer`
   - No breaking changes to current speech bubble API
   - Preserve all existing portrait functionality

2. **Performance**
   - Lazy loading of high-resolution portraits only when modal opens
   - Image caching for repeated views
   - Smooth animations with hardware acceleration

3. **Accessibility**
   - WCAG 2.1 AA compliance
   - Proper ARIA labels and roles
   - Keyboard navigation support
   - Screen reader compatibility

4. **Browser Compatibility**
   - Support for all modern browsers
   - Graceful degradation for older browsers
   - Responsive design for mobile devices

## Technical Architecture

### Component Structure

```
SpeechBubbleRenderer (existing)
├── #addPortrait() (modified)
│   ├── Create portrait img element
│   ├── Add click event listener (new)
│   └── Store portrait metadata (new)
└── PortraitModalRenderer (new)
    ├── showModal(portraitPath, speakerName)
    ├── hideModal()
    ├── handleBackdropClick()
    └── handleKeyboardEvents()
```

### New Classes and Methods

#### PortraitModalRenderer Class

**Location**: `src/domUI/portraitModalRenderer.js` (THIS FILE DOES NOT EXIST - NEEDS TO BE CREATED)

```javascript
import { BaseModalRenderer } from './baseModalRenderer.js';

export class PortraitModalRenderer extends BaseModalRenderer {
  constructor({ documentContext, domElementFactory, logger, validatedEventDispatcher }) {
    // Configure elements for BaseModalRenderer
    const elementsConfig = {
      modalElement: '.portrait-modal-overlay',
      closeButton: '.portrait-modal-close',
      statusMessageElement: '.portrait-error-message',
      modalImage: '.portrait-modal-image',
      loadingSpinner: '.portrait-loading-spinner',
      modalTitle: '#portrait-modal-title'
    };
    
    super({ logger, documentContext, validatedEventDispatcher, elementsConfig });
    
    this.domElementFactory = domElementFactory;
    // Additional initialization
  }

  showModal(portraitPath, speakerName, originalElement) {
    // Store original element for focus return
    // Update modal title with speaker name
    // Show loading state
    // Load high-resolution image
    // Call parent's show() method
  }

  // Override BaseModalRenderer methods
  _onShow() {
    // Custom logic when modal is shown
  }

  _onHide() {
    // Custom logic when modal is hidden
  }

  _getInitialFocusElement() {
    // Return close button for initial focus
    return this.elements.closeButton;
  }

  #handleImageLoad(img, portraitPath) {
    // Handle successful image loading
    // Update modal sizing
    // Hide loading indicator
  }

  #handleImageError(img) {
    // Use BaseModalRenderer's _displayStatusMessage for error
    this._displayStatusMessage('Failed to load portrait', 'error');
  }
}
```

#### SpeechBubbleRenderer Modifications

**Method**: `#addPortrait()` (line 266-303)

**IMPORTANT**: Currently this method signature is:
```javascript
#addPortrait(container, portraitPath, speakerName) {
```

It needs to be modified to include `entityId`:
```javascript
#addPortrait(container, portraitPath, speakerName, entityId) {
  // ... existing code ...
  
  if (portraitPath) {
    const portraitImg = this.domElementFactory.img(/*...existing params...*/);
    if (portraitImg) {
      // Existing functionality preserved
      hasPortrait = true;
      
      // NEW: Add clickable functionality for AI portraits
      // Determine if entity is AI (not a human player)
      const speakerEntity = this.#entityManager.getEntityInstance(entityId);
      let isAICharacter = true; // Default to AI character
      
      if (speakerEntity) {
        if (speakerEntity.hasComponent(PLAYER_TYPE_COMPONENT_ID)) {
          const playerTypeData = speakerEntity.getComponentData(PLAYER_TYPE_COMPONENT_ID);
          isAICharacter = playerTypeData?.type !== 'human';
        } else if (speakerEntity.hasComponent(PLAYER_COMPONENT_ID)) {
          isAICharacter = false; // Has player component, so it's a human player
        }
      }
      
      if (isAICharacter) {
        portraitImg.classList.add('clickable');
        portraitImg.style.cursor = 'pointer';
        portraitImg.setAttribute('aria-label', `Click to view larger portrait of ${speakerName}`);
        portraitImg.setAttribute('role', 'button');
        portraitImg.setAttribute('tabindex', '0');
        
        this._addDomListener(portraitImg, 'click', () => {
          this.#portraitModalRenderer.showModal(portraitPath, speakerName, portraitImg);
        });
        
        this._addDomListener(portraitImg, 'keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            this.#portraitModalRenderer.showModal(portraitPath, speakerName, portraitImg);
          }
        });
      }
      
      // ... rest of existing code ...
    }
  }
}
```

**CRITICAL IMPLEMENTATION NOTE**: The `entityId` parameter is NOT currently passed to `#addPortrait`. The calling code in the `renderSpeech()` method (around line 356) needs to be modified from:
```javascript
const hasPortrait = this.#addPortrait(
  speechEntryDiv,
  portraitPath,
  speakerName
);
```

To:
```javascript
const hasPortrait = this.#addPortrait(
  speechEntryDiv,
  portraitPath,
  speakerName,
  entityId  // This needs to be added
);
```

Alternatively, the `isPlayer` detection logic could be moved from `#createSpeechElements` to be stored as a class property or passed differently.

### HTML Structure

#### Modal DOM Structure (NEEDS TO BE ADDED TO THE MAIN HTML FILE)
```html
<div class="portrait-modal-overlay modal-overlay" role="dialog" aria-modal="true" aria-labelledby="portrait-modal-title">
  <div class="portrait-modal-content modal-content">
    <div class="portrait-modal-header">
      <h2 id="portrait-modal-title" class="portrait-modal-title">Character Portrait</h2>
      <button class="portrait-modal-close" aria-label="Close portrait modal">&times;</button>
    </div>
    <div class="portrait-modal-body">
      <div class="portrait-image-container">
        <div class="portrait-loading-spinner" aria-hidden="true">Loading...</div>
        <img class="portrait-modal-image" alt="" />
        <div class="portrait-error-message" role="alert" style="display: none;">
          Failed to load portrait
        </div>
      </div>
    </div>
  </div>
</div>
```

## CSS Specifications

### New Styles Required

**File**: `css/components/_portrait-modal.css` (THIS FILE DOES NOT EXIST - NEEDS TO BE CREATED)

```css
/* Portrait Modal Specific Styles */
.portrait-modal-overlay {
  /* Extends .modal-overlay */
  background-color: rgba(0, 0, 0, 0.8); /* Darker backdrop for image viewing */
}

.portrait-modal-content {
  /* Extends .modal-content */
  max-width: 90vw;
  max-height: 90vh;
  padding: var(--spacing-md);
  background-color: var(--panel-bg-color);
}

.portrait-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);
  padding-bottom: var(--spacing-sm);
  border-bottom: var(--border-width) solid var(--border-color-subtle);
}

.portrait-modal-title {
  margin: 0;
  font-size: var(--font-size-h3);
  color: var(--primary-text-color);
}

.portrait-modal-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  padding: var(--spacing-xs);
  color: var(--secondary-text-color);
  border-radius: var(--border-radius-sm);
  transition: background-color 0.2s ease-in-out, color 0.2s ease-in-out;
}

.portrait-modal-close:hover,
.portrait-modal-close:focus-visible {
  background-color: var(--accent-color-focus-ring);
  color: var(--primary-text-color);
}

.portrait-image-container {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
}

.portrait-modal-image {
  max-width: 100%;
  max-height: 70vh;
  height: auto;
  border-radius: var(--border-radius-md);
  box-shadow: var(--shadow-lg);
  object-fit: contain;
  opacity: 0;
  transition: opacity 0.3s ease-in-out;
}

.portrait-modal-image.loaded {
  opacity: 1;
}

.portrait-loading-spinner {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: var(--secondary-text-color);
  font-style: italic;
}

.portrait-error-message {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: var(--error-text-color);
  text-align: center;
  padding: var(--spacing-md);
  background-color: var(--error-bg-color);
  border: 1px solid var(--error-text-color);
  border-radius: var(--border-radius-md);
}

/* Clickable Portrait Styles */
.speech-portrait.clickable {
  transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
  cursor: pointer;
}

.speech-portrait.clickable:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.speech-portrait.clickable:focus-visible {
  outline: 2px solid var(--accent-color-primary);
  outline-offset: 2px;
}

/* Responsive Design */
@media (max-width: 768px) {
  .portrait-modal-content {
    margin: var(--spacing-sm);
    padding: var(--spacing-sm);
  }
  
  .portrait-modal-image {
    max-height: 60vh;
  }
}

@media (max-width: 480px) {
  .portrait-modal-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-sm);
  }
  
  .portrait-modal-close {
    align-self: flex-end;
  }
}

/* Animation Keyframes */
@keyframes portraitFadeIn {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes portraitFadeOut {
  from {
    opacity: 1;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(0.9);
  }
}

/* Reduce motion for accessibility */
@media (prefers-reduced-motion: reduce) {
  .portrait-modal-image,
  .portrait-modal-overlay,
  .portrait-modal-content,
  .speech-portrait.clickable {
    transition: none;
  }
  
  .portrait-modal-overlay.visible,
  .portrait-modal-overlay:not(.visible) {
    animation: none;
  }
}
```

## User Experience Flow

### Interaction Sequence

1. **Initial State**
   - AI character speech bubbles display with portraits (if available)
   - Only AI character portraits show hover effects indicating clickability
   - Human player portraits remain static

2. **Portrait Click**
   - User clicks or presses Enter/Space on AI portrait
   - Modal appears with fade-in animation
   - Page content behind modal is shadowed
   - Focus moves to modal close button
   - Loading spinner shows while high-res image loads

3. **Modal Display**
   - Portrait displays at optimal size for viewing
   - Modal title shows character name
   - Close button (×) visible in top-right corner
   - ESC key and backdrop click handlers active

4. **Modal Close**
   - User clicks backdrop, close button, or presses ESC
   - Modal fades out with animation
   - Focus returns to original portrait element
   - Modal DOM elements cleaned up

### Visual States

#### Portrait States
- **Default**: Standard speech bubble portrait appearance
- **Hover** (AI portraits only): Subtle scale and shadow effect
- **Focus**: Outline indicating keyboard focus
- **Active**: Brief press effect on click

#### Modal States
- **Loading**: Spinner centered in modal while image loads
- **Loaded**: Full portrait displayed with smooth fade-in
- **Error**: Error message with option to retry or close

## Accessibility Requirements

### WCAG 2.1 AA Compliance

1. **Keyboard Navigation**
   - Tab navigation to clickable portraits
   - Enter/Space activation
   - ESC key to close modal
   - Proper focus management

2. **Screen Reader Support**
   - Appropriate ARIA labels and roles
   - Alt text for portrait images
   - Modal announced when opened
   - Loading/error states communicated

3. **Visual Accessibility**
   - Sufficient color contrast for all text
   - Focus indicators clearly visible
   - Respects user's motion preferences
   - Scalable text and interface elements

### Implementation Details

```javascript
// ARIA attributes for clickable portraits
portraitImg.setAttribute('role', 'button');
portraitImg.setAttribute('aria-label', `Click to view larger portrait of ${speakerName}`);
portraitImg.setAttribute('tabindex', '0');

// Modal accessibility
modalOverlay.setAttribute('role', 'dialog');
modalOverlay.setAttribute('aria-modal', 'true');
modalOverlay.setAttribute('aria-labelledby', 'portrait-modal-title');

// Focus management
const previousFocus = document.activeElement;
closeButton.focus();
// On modal close: previousFocus.focus();

// Screen reader announcements
const announcement = document.createElement('div');
announcement.setAttribute('aria-live', 'polite');
announcement.textContent = `Opened portrait of ${speakerName}`;
```

## Testing Strategy

### Unit Tests

**File**: `tests/unit/domUI/portraitModalRenderer.test.js`

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';

describe('PortraitModalRenderer', () => {
  let testBed;
  
  beforeEach(() => {
    testBed = createTestBed();
  });
  
  describe('Modal Display', () => {
    it('should extend BaseModalRenderer properly');
    it('should create modal with correct ARIA attributes');
    it('should load high-resolution image when modal opens');
    it('should handle image loading errors gracefully');
    it('should manage focus correctly when opening modal');
  });
  
  describe('User Interactions', () => {
    it('should close modal on backdrop click');
    it('should close modal on ESC key press');
    it('should close modal on close button click');
    it('should return focus to original element on close');
  });
  
  describe('Accessibility', () => {
    it('should meet WCAG 2.1 AA contrast requirements');
    it('should support keyboard navigation');
    it('should announce modal state to screen readers');
    it('should respect reduced motion preferences');
  });
});
```

### Integration Tests

**File**: `tests/integration/domUI/speechBubblePortraitModal.integration.test.js`

```javascript
describe('Speech Bubble Portrait Modal Integration', () => {
  it('should make only AI portraits clickable');
  it('should preserve existing speech bubble functionality');
  it('should handle multiple portraits in same conversation');
  it('should work correctly with portrait loading states');
  it('should integrate properly with existing modal system');
});
```

### Manual Testing Checklist

- [ ] AI portraits are clickable, human portraits are not
- [ ] Modal displays correct high-resolution image
- [ ] Smooth animations on modal open/close
- [ ] Backdrop click closes modal
- [ ] ESC key closes modal
- [ ] Close button works correctly
- [ ] Proper focus management throughout interaction
- [ ] Responsive design on mobile devices
- [ ] Screen reader compatibility
- [ ] Image loading error handling
- [ ] Multiple portrait interactions work correctly

## Implementation Phases

### Phase 1: Core Functionality (2-3 days)
- [ ] Create `PortraitModalRenderer` class extending `BaseModalRenderer`
- [ ] Modify `SpeechBubbleRenderer#addPortrait` to accept `entityId` parameter
- [ ] Update `renderSpeech` method to pass `entityId` to `#addPortrait`
- [ ] Add click handlers for AI portraits only (using existing player detection logic)
- [ ] Implement basic modal show/hide functionality
- [ ] Add keyboard event handling (ESC key)

### Phase 2: UI/UX Polish (1-2 days)
- [ ] Create new CSS file `css/components/_portrait-modal.css`
- [ ] Add portrait modal HTML structure to main HTML file
- [ ] Import new CSS file in the main CSS bundle
- [ ] Add loading and error states
- [ ] Implement smooth animations
- [ ] Add hover effects for clickable portraits

### Phase 3: Accessibility & Testing (1-2 days)
- [ ] Implement full WCAG 2.1 AA compliance (currently only basic support exists)
- [ ] Add proper ARIA attributes and focus management
- [ ] Add keyboard navigation support (Tab, Enter, Space, ESC)
- [ ] Create unit tests using `createTestBed` pattern
- [ ] Create integration tests following existing patterns
- [ ] Perform accessibility testing

### Phase 4: Integration & Refinement (1 day)
- [ ] Integration testing with existing speech bubble system
- [ ] Ensure compatibility with existing modal infrastructure
- [ ] Performance optimization for image loading
- [ ] Cross-browser compatibility testing
- [ ] Update CLAUDE.md with new feature documentation

## Configuration and Maintenance

### CSS Variables Integration

The modal will use existing CSS custom properties for consistency:

```css
/* Used from existing theme */
--panel-bg-color
--border-color-subtle
--primary-text-color
--secondary-text-color
--accent-color-primary
--shadow-lg
--border-radius-md
--spacing-md
```

### Error Handling

1. **Image Load Failures**
   - Display user-friendly error message
   - Provide retry mechanism
   - Log errors for debugging

2. **Modal Creation Failures**
   - Graceful degradation to static portraits
   - Error logging for diagnosis

3. **Focus Management Failures**
   - Fallback focus to document body
   - Error logging for accessibility compliance

## Future Enhancements

### Potential Future Features

1. **Image Zoom/Pan**
   - Mouse wheel zoom within modal
   - Click and drag panning for large images
   - Zoom controls for touch devices

2. **Portrait Gallery**
   - Previous/Next navigation between character portraits
   - Thumbnail strip for quick character selection

3. **Portrait Information**
   - Character name and description overlay
   - Portrait metadata (artist, creation date, etc.)

4. **Customization Options**
   - User preference for modal background opacity
   - Option to disable portrait modal feature
   - Alternative portrait viewing modes

### Performance Optimizations

1. **Image Preloading**
   - Preload high-res images based on conversation participants
   - Implement intelligent caching strategy

2. **Virtual Scrolling**
   - For conversations with many portraits
   - Memory optimization for long chat sessions

## Conclusion

This specification provides a comprehensive plan for implementing clickable AI character portraits with modal display functionality. The implementation preserves all existing functionality while adding an enhanced viewing experience for character artwork. The design follows established patterns in the codebase and maintains WCAG 2.1 AA accessibility standards.

The modular approach allows for future enhancements while keeping the initial implementation focused and maintainable. The testing strategy ensures reliability and accessibility compliance throughout the development process.