# CLIPORMOD-006: Implement Full Accessibility Features

## Status
🔴 NOT STARTED

## Priority
HIGH - Required for WCAG 2.1 AA compliance

## Dependencies
- CLIPORMOD-001 (PortraitModalRenderer exists)
- CLIPORMOD-003 (HTML structure with ARIA attributes)
- CLIPORMOD-004 (Portrait click handlers)

## Description
Implement comprehensive accessibility features to ensure the portrait modal meets WCAG 2.1 AA standards. The existing modal infrastructure has only basic accessibility support, so this ticket focuses on implementing full compliance including focus management, keyboard navigation, screen reader support, and reduced motion preferences.

## Current State
According to the spec validation:
- BaseModalRenderer has basic `aria-hidden` attributes
- No comprehensive WCAG 2.1 AA compliance
- Limited keyboard navigation support
- No focus trap implementation
- No screen reader announcements

## Accessibility Requirements

### 1. Focus Management

#### Focus Trap Implementation
**File**: `src/domUI/portraitModalRenderer.js`

```javascript
class PortraitModalRenderer extends BaseModalRenderer {
  #focusableElements = [];
  #firstFocusableElement = null;
  #lastFocusableElement = null;
  
  #setupFocusTrap() {
    // Find all focusable elements within modal
    const focusableSelectors = [
      'button',
      '[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ];
    
    const modal = this.elements.modalElement;
    this.#focusableElements = modal.querySelectorAll(focusableSelectors.join(','));
    
    if (this.#focusableElements.length > 0) {
      this.#firstFocusableElement = this.#focusableElements[0];
      this.#lastFocusableElement = this.#focusableElements[this.#focusableElements.length - 1];
    }
  }
  
  #handleTabKey(event) {
    if (!this.#focusableElements.length) return;
    
    if (event.shiftKey) {
      // Shift + Tab
      if (document.activeElement === this.#firstFocusableElement) {
        event.preventDefault();
        this.#lastFocusableElement.focus();
      }
    } else {
      // Tab
      if (document.activeElement === this.#lastFocusableElement) {
        event.preventDefault();
        this.#firstFocusableElement.focus();
      }
    }
  }
}
```

#### Focus Return Implementation
```javascript
#storeFocusAndShow(originalElement) {
  // Store the element that triggered the modal
  this.#originalFocusElement = originalElement || document.activeElement;
  
  // Show modal (inherited from BaseModalRenderer)
  this.show();
  
  // Set initial focus
  this.#setInitialFocus();
}

#returnFocusAndHide() {
  // Hide modal (inherited from BaseModalRenderer)
  this.hide();
  
  // Return focus to original element
  if (this.#originalFocusElement && this.#originalFocusElement.focus) {
    // Use setTimeout to ensure modal is fully hidden
    setTimeout(() => {
      this.#originalFocusElement.focus();
      
      // Announce to screen reader
      this.#announceToScreenReader('Portrait modal closed');
    }, 100);
  }
}

#setInitialFocus() {
  // Focus on close button initially
  const closeButton = this.elements.closeButton;
  if (closeButton) {
    // Small delay to ensure modal is visible
    setTimeout(() => {
      closeButton.focus();
    }, 100);
  }
}
```

### 2. Keyboard Navigation

#### Complete Keyboard Handler
```javascript
#setupKeyboardHandlers() {
  // ESC key handler (might be inherited from BaseModalRenderer)
  this._addDomListener(document, 'keydown', (event) => {
    if (!this.isVisible()) return;
    
    switch(event.key) {
      case 'Escape':
        event.preventDefault();
        this.#returnFocusAndHide();
        break;
        
      case 'Tab':
        this.#handleTabKey(event);
        break;
        
      case 'Home':
        // Jump to first focusable element
        if (this.#firstFocusableElement) {
          event.preventDefault();
          this.#firstFocusableElement.focus();
        }
        break;
        
      case 'End':
        // Jump to last focusable element
        if (this.#lastFocusableElement) {
          event.preventDefault();
          this.#lastFocusableElement.focus();
        }
        break;
    }
  });
}
```

### 3. Screen Reader Support

#### Live Region Announcements
```javascript
#createLiveRegion() {
  // Create a live region for screen reader announcements
  const liveRegion = document.createElement('div');
  liveRegion.setAttribute('role', 'status');
  liveRegion.setAttribute('aria-live', 'polite');
  liveRegion.setAttribute('aria-atomic', 'true');
  liveRegion.className = 'sr-only portrait-modal-announcer';
  document.body.appendChild(liveRegion);
  
  this.#liveRegion = liveRegion;
}

#announceToScreenReader(message) {
  if (!this.#liveRegion) {
    this.#createLiveRegion();
  }
  
  // Clear previous announcement
  this.#liveRegion.textContent = '';
  
  // Set new announcement (with small delay for screen reader to detect change)
  setTimeout(() => {
    this.#liveRegion.textContent = message;
  }, 100);
  
  // Clear after announcement
  setTimeout(() => {
    this.#liveRegion.textContent = '';
  }, 1000);
}
```

#### Modal State Announcements
```javascript
_onShow() {
  super._onShow();
  
  // Announce modal opening
  const speakerName = this.#currentSpeakerName || 'Character';
  this.#announceToScreenReader(`Opened portrait modal for ${speakerName}`);
  
  // Update ARIA attributes
  this.elements.modalElement.setAttribute('aria-hidden', 'false');
  
  // Hide background content from screen readers
  this.#hideBackgroundFromScreenReaders();
}

_onHide() {
  super._onHide();
  
  // Update ARIA attributes
  this.elements.modalElement.setAttribute('aria-hidden', 'true');
  
  // Restore background content to screen readers
  this.#showBackgroundToScreenReaders();
}

#hideBackgroundFromScreenReaders() {
  // Find main content containers
  const mainContent = document.querySelector('main, #main-content, .game-container');
  if (mainContent) {
    mainContent.setAttribute('aria-hidden', 'true');
    this.#hiddenElements.push(mainContent);
  }
}

#showBackgroundToScreenReaders() {
  // Restore all hidden elements
  this.#hiddenElements.forEach(element => {
    element.removeAttribute('aria-hidden');
  });
  this.#hiddenElements = [];
}
```

### 4. Loading and Error State Accessibility

#### Loading State
```javascript
#showLoadingState() {
  const spinner = this.elements.loadingSpinner;
  if (spinner) {
    spinner.style.display = 'block';
    spinner.setAttribute('aria-hidden', 'false');
    
    // Announce loading to screen reader
    this.#announceToScreenReader('Loading portrait image');
  }
}

#hideLoadingState() {
  const spinner = this.elements.loadingSpinner;
  if (spinner) {
    spinner.style.display = 'none';
    spinner.setAttribute('aria-hidden', 'true');
  }
}
```

#### Error State
```javascript
#showErrorState(errorMessage) {
  const errorElement = this.elements.statusMessageElement;
  if (errorElement) {
    errorElement.style.display = 'block';
    errorElement.textContent = errorMessage || 'Failed to load portrait';
    
    // Announce error to screen reader (assertive for errors)
    const errorAnnouncement = document.createElement('div');
    errorAnnouncement.setAttribute('role', 'alert');
    errorAnnouncement.setAttribute('aria-live', 'assertive');
    errorAnnouncement.className = 'sr-only';
    errorAnnouncement.textContent = errorMessage;
    
    document.body.appendChild(errorAnnouncement);
    
    // Remove after announcement
    setTimeout(() => {
      errorAnnouncement.remove();
    }, 3000);
  }
}
```

### 5. Reduced Motion Support

#### Check User Preference
```javascript
#respectsReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

#applyAnimations() {
  if (this.#respectsReducedMotion()) {
    // Disable animations
    this.elements.modalElement.style.transition = 'none';
    this.elements.modalContent.style.transition = 'none';
    this.elements.modalImage.style.transition = 'none';
  } else {
    // Apply normal animations
    this.elements.modalElement.style.transition = 'opacity 0.3s ease-in-out';
    this.elements.modalContent.style.transition = 'transform 0.3s ease-in-out';
    this.elements.modalImage.style.transition = 'opacity 0.3s ease-in-out';
  }
}
```

### 6. High Contrast Mode Support

#### Detect High Contrast
```javascript
#detectHighContrast() {
  const mediaQuery = window.matchMedia('(prefers-contrast: high)');
  
  if (mediaQuery.matches) {
    this.elements.modalContent.classList.add('high-contrast');
  }
  
  // Listen for changes
  mediaQuery.addEventListener('change', (e) => {
    if (e.matches) {
      this.elements.modalContent.classList.add('high-contrast');
    } else {
      this.elements.modalContent.classList.remove('high-contrast');
    }
  });
}
```

### 7. Touch Device Support

#### Touch-Friendly Interactions
```javascript
#setupTouchHandlers() {
  let touchStartX = 0;
  let touchStartY = 0;
  
  this._addDomListener(this.elements.modalImage, 'touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  });
  
  this._addDomListener(this.elements.modalImage, 'touchend', (e) => {
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    
    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;
    
    // Swipe down to close
    if (Math.abs(deltaY) > Math.abs(deltaX) && deltaY > 50) {
      this.#returnFocusAndHide();
    }
  });
}
```

## Testing Accessibility

### Automated Testing Tools
- axe DevTools
- WAVE (WebAIM)
- Lighthouse (Chrome DevTools)
- Pa11y command line tool

### Manual Testing Checklist
- [ ] Tab navigation cycles through modal elements
- [ ] ESC key closes modal
- [ ] Focus returns to trigger element on close
- [ ] Screen reader announces modal open/close
- [ ] Loading states are announced
- [ ] Error states are announced
- [ ] Images have appropriate alt text
- [ ] Reduced motion preference is respected
- [ ] High contrast mode is supported
- [ ] Touch gestures work on mobile

### Screen Reader Testing
Test with multiple screen readers:
- NVDA (Windows)
- JAWS (Windows)
- VoiceOver (macOS/iOS)
- TalkBack (Android)

### Keyboard Navigation Test Cases
1. Tab through all elements
2. Shift+Tab backwards through elements
3. ESC closes modal
4. Enter/Space activate buttons
5. Home/End jump to first/last element
6. Focus trap prevents tabbing outside modal

## Color Contrast Requirements
Ensure all text meets WCAG 2.1 AA standards:
- Normal text: 4.5:1 contrast ratio
- Large text (18pt+): 3:1 contrast ratio
- Interactive elements: 3:1 contrast ratio

## Success Criteria
- [ ] Focus trap implemented and working
- [ ] Focus returns to trigger element on close
- [ ] All keyboard shortcuts functional
- [ ] Screen reader announcements working
- [ ] Loading/error states accessible
- [ ] Reduced motion preference respected
- [ ] High contrast mode supported
- [ ] Touch gestures implemented
- [ ] WCAG 2.1 AA validation passes
- [ ] All automated accessibility tests pass
- [ ] Manual testing with screen readers passes

## Notes
- BaseModalRenderer may already handle some of these features
- Test with real users who use assistive technology if possible
- Consider adding a preference to disable the modal feature entirely
- Document all keyboard shortcuts for users