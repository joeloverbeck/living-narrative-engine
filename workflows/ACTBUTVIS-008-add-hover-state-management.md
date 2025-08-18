# ACTBUTVIS-008: Add Hover State Management

## Status
**Status**: Not Started  
**Priority**: Medium  
**Type**: UI Enhancement  
**Estimated Effort**: 3 hours  

## Dependencies
- **Requires**: ACTBUTVIS-007 (Visual Styles Application)
- **Blocks**: ACTBUTVIS-009 (Theme Compatibility)

## Context
This ticket implements hover state functionality for action buttons with custom visual properties. The foundation was laid in ACTBUTVIS-007 with dataset attributes storing hover colors. Now we need to implement the actual hover behavior and ensure it works seamlessly with the theme system.

## Objectives
1. Implement hover event listeners for buttons with custom hover colors
2. Apply hover state visual changes dynamically
3. Ensure smooth transitions between states
4. Maintain performance with many buttons
5. Handle edge cases (disabled buttons, rapid hover changes)

## Implementation Details

### File Modifications

#### 1. Extend ActionButtonsRenderer
**File**: `src/domUI/actionButtonsRenderer.js`

**Changes to existing methods**:

```javascript
class ActionButtonsRenderer extends BoundDomRendererBase {
  constructor({ domElementFactory, eventBus, logger, containerSelector }) {
    super({ domElementFactory, eventBus, logger, containerSelector });
    
    // Store references for hover handling
    this.buttonVisualMap = new Map();
    
    // NEW: Hover state management
    this.hoverTimeouts = new Map(); // For debouncing rapid hover changes
    this.boundHoverHandlers = {
      enter: this._handleHoverEnter.bind(this),
      leave: this._handleHoverLeave.bind(this)
    };
  }

  /**
   * Attach event listeners to button (UPDATE from ACTBUTVIS-007)
   * @private
   */
  _attachButtonListeners(button, actionComposite, index) {
    // Click handler (existing)
    button.addEventListener('click', (event) => {
      event.preventDefault();
      this._handleButtonClick(actionComposite, index);
    });

    // NEW: Add hover handlers if custom hover colors are defined
    if (button.dataset.hasCustomHover === 'true') {
      this._addHoverListeners(button);
    }
  }

  /**
   * Add hover event listeners to a button
   * @private
   * @param {HTMLButtonElement} button - Button element
   */
  _addHoverListeners(button) {
    // Use bound handlers to avoid memory leaks
    button.addEventListener('mouseenter', this.boundHoverHandlers.enter);
    button.addEventListener('mouseleave', this.boundHoverHandlers.leave);
    
    // Handle focus states for accessibility
    button.addEventListener('focus', this.boundHoverHandlers.enter);
    button.addEventListener('blur', this.boundHoverHandlers.leave);
    
    // Mark as having listeners for cleanup
    button.dataset.hasHoverListeners = 'true';
  }

  /**
   * Remove hover event listeners from a button
   * @private
   * @param {HTMLButtonElement} button - Button element
   */
  _removeHoverListeners(button) {
    if (button.dataset.hasHoverListeners === 'true') {
      button.removeEventListener('mouseenter', this.boundHoverHandlers.enter);
      button.removeEventListener('mouseleave', this.boundHoverHandlers.leave);
      button.removeEventListener('focus', this.boundHoverHandlers.enter);
      button.removeEventListener('blur', this.boundHoverHandlers.leave);
      
      delete button.dataset.hasHoverListeners;
    }
  }

  /**
   * Handle mouse enter / focus events
   * @private
   * @param {Event} event - Mouse/focus event
   */
  _handleHoverEnter(event) {
    const button = event.target;
    
    // Ignore if button is disabled
    if (button.disabled) {
      return;
    }

    // Clear any pending hover leave timeout
    const timeoutId = this.hoverTimeouts.get(button);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.hoverTimeouts.delete(button);
    }

    try {
      this._applyHoverState(button, true);
    } catch (error) {
      this.logger.warn('Error applying hover state:', error);
    }
  }

  /**
   * Handle mouse leave / blur events
   * @private
   * @param {Event} event - Mouse/blur event
   */
  _handleHoverLeave(event) {
    const button = event.target;
    
    // Debounce rapid hover changes to prevent flicker
    const timeoutId = setTimeout(() => {
      try {
        this._applyHoverState(button, false);
      } catch (error) {
        this.logger.warn('Error removing hover state:', error);
      }
      
      this.hoverTimeouts.delete(button);
    }, 50); // 50ms debounce
    
    this.hoverTimeouts.set(button, timeoutId);
  }

  /**
   * Apply or remove hover state styling
   * @private
   * @param {HTMLButtonElement} button - Button element
   * @param {boolean} isHovering - Whether to apply hover state
   */
  _applyHoverState(button, isHovering) {
    if (isHovering) {
      // Apply hover colors
      if (button.dataset.hoverBg) {
        button.style.backgroundColor = button.dataset.hoverBg;
      }
      
      if (button.dataset.hoverText) {
        button.style.color = button.dataset.hoverText;
      }
      
      // Add hover class for CSS hooks
      button.classList.add('action-button-hovering');
    } else {
      // Restore original colors
      if (button.dataset.originalBg !== undefined) {
        button.style.backgroundColor = button.dataset.originalBg;
      }
      
      if (button.dataset.originalText !== undefined) {
        button.style.color = button.dataset.originalText;
      }
      
      // Remove hover class
      button.classList.remove('action-button-hovering');
      
      // Handle selected state restoration
      if (button.classList.contains('selected')) {
        this._updateSelectedState(button, true);
      }
    }
  }

  /**
   * Handle disabled state changes
   * @param {string} actionId - Action ID
   * @param {boolean} isDisabled - Whether action is disabled
   */
  setButtonDisabled(actionId, isDisabled) {
    const mapping = this.buttonVisualMap.get(actionId);
    
    if (!mapping) {
      return;
    }

    const { button } = mapping;
    button.disabled = isDisabled;
    
    if (isDisabled) {
      // Clear hover state for disabled buttons
      this._applyHoverState(button, false);
      button.classList.add('action-button-disabled');
      
      // Apply disabled visual styling
      if (button.dataset.customBg || button.dataset.customText) {
        this._applyDisabledVisualState(button);
      }
    } else {
      button.classList.remove('action-button-disabled');
      
      // Restore original visual state
      if (button.dataset.customBg) {
        button.style.backgroundColor = button.dataset.customBg;
      }
      if (button.dataset.customText) {
        button.style.color = button.dataset.customText;
      }
    }
  }

  /**
   * Apply visual styling for disabled state
   * @private
   * @param {HTMLButtonElement} button - Button element
   */
  _applyDisabledVisualState(button) {
    // Reduce opacity for disabled state while preserving custom colors
    button.style.opacity = '0.5';
    button.style.cursor = 'not-allowed';
  }

  /**
   * Clear all rendered buttons (UPDATE from ACTBUTVIS-007)
   */
  clear() {
    // Clear hover timeouts
    for (const timeoutId of this.hoverTimeouts.values()) {
      clearTimeout(timeoutId);
    }
    this.hoverTimeouts.clear();
    
    // Remove hover listeners from buttons
    const buttons = this.container?.querySelectorAll('button[data-has-hover-listeners="true"]');
    if (buttons) {
      buttons.forEach(button => this._removeHoverListeners(button));
    }
    
    // Call parent clear
    super.clear();
    
    // Clear visual mappings
    this.buttonVisualMap.clear();
  }

  /**
   * Update visual styles for a specific button (UPDATE from ACTBUTVIS-007)
   */
  updateButtonVisual(actionId, newVisual) {
    const mapping = this.buttonVisualMap.get(actionId);
    
    if (!mapping) {
      this.logger.warn(`No button found for action: ${actionId}`);
      return;
    }

    const { button } = mapping;
    
    // Remove existing hover listeners
    this._removeHoverListeners(button);
    
    // Clear existing inline styles
    button.style.backgroundColor = '';
    button.style.color = '';
    button.style.opacity = '';
    
    // Apply new visual styles
    if (newVisual) {
      this._applyVisualStyles(button, newVisual, actionId);
      
      // Add new hover listeners if needed
      if (button.dataset.hasCustomHover === 'true') {
        this._addHoverListeners(button);
      }
    } else {
      // Remove custom visual class
      button.classList.remove('action-button-custom-visual');
      
      // Clear all custom datasets
      delete button.dataset.customBg;
      delete button.dataset.customText;
      delete button.dataset.hasCustomHover;
      delete button.dataset.hoverBg;
      delete button.dataset.hoverText;
      delete button.dataset.originalBg;
      delete button.dataset.originalText;
      
      // Remove from map
      this.buttonVisualMap.delete(actionId);
    }
  }
}
```

### CSS Enhancements

#### Update CSS for hover states
**File**: `css/components/_game-actions.css`

```css
/* Custom visual action buttons (existing) */
.action-button-custom-visual {
  transition: background-color 0.15s ease, color 0.15s ease;
}

/* Hovering state */
.action-button-hovering {
  /* Additional hover effects can be added here */
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

/* Disabled state with custom visual */
.action-button-disabled.action-button-custom-visual {
  cursor: not-allowed !important;
  pointer-events: none;
}

/* Ensure smooth transitions even with inline styles */
.action-button[style*="background-color"] {
  transition: background-color 0.15s ease, color 0.15s ease, opacity 0.2s ease;
}

/* Focus styles for accessibility */
.action-button-custom-visual:focus {
  outline: 2px solid var(--focus-color, #0066cc);
  outline-offset: 2px;
}
```

### Testing Requirements

#### Unit Tests
**File**: `tests/unit/domUI/actionButtonsRenderer.test.js`

```javascript
describe('ActionButtonsRenderer - Hover State Management', () => {
  let renderer;
  let mockContainer;
  let testButton;

  beforeEach(() => {
    // Setup from previous tests...
    
    // Create a test button with hover properties
    testButton = document.createElement('button');
    testButton.dataset.hasCustomHover = 'true';
    testButton.dataset.hoverBg = '#00ff00';
    testButton.dataset.hoverText = '#000000';
    testButton.dataset.originalBg = '#ff0000';
    testButton.dataset.originalText = '#ffffff';
    mockContainer.appendChild(testButton);
  });

  describe('hover event listeners', () => {
    it('should add hover listeners for buttons with custom hover', () => {
      const addListenersSpy = jest.spyOn(testButton, 'addEventListener');
      
      renderer._addHoverListeners(testButton);
      
      expect(addListenersSpy).toHaveBeenCalledWith('mouseenter', expect.any(Function));
      expect(addListenersSpy).toHaveBeenCalledWith('mouseleave', expect.any(Function));
      expect(addListenersSpy).toHaveBeenCalledWith('focus', expect.any(Function));
      expect(addListenersSpy).toHaveBeenCalledWith('blur', expect.any(Function));
    });

    it('should remove hover listeners on cleanup', () => {
      renderer._addHoverListeners(testButton);
      const removeListenersSpy = jest.spyOn(testButton, 'removeEventListener');
      
      renderer._removeHoverListeners(testButton);
      
      expect(removeListenersSpy).toHaveBeenCalledWith('mouseenter', expect.any(Function));
      expect(removeListenersSpy).toHaveBeenCalledWith('mouseleave', expect.any(Function));
    });
  });

  describe('hover state application', () => {
    it('should apply hover colors on hover enter', () => {
      renderer._applyHoverState(testButton, true);
      
      expect(testButton.style.backgroundColor).toBe('#00ff00');
      expect(testButton.style.color).toBe('#000000');
      expect(testButton.classList.contains('action-button-hovering')).toBe(true);
    });

    it('should restore original colors on hover leave', () => {
      // First apply hover
      renderer._applyHoverState(testButton, true);
      
      // Then remove hover
      renderer._applyHoverState(testButton, false);
      
      expect(testButton.style.backgroundColor).toBe('#ff0000');
      expect(testButton.style.color).toBe('#ffffff');
      expect(testButton.classList.contains('action-button-hovering')).toBe(false);
    });

    it('should handle missing hover colors gracefully', () => {
      delete testButton.dataset.hoverBg;
      delete testButton.dataset.hoverText;
      
      expect(() => {
        renderer._applyHoverState(testButton, true);
      }).not.toThrow();
    });
  });

  describe('disabled state handling', () => {
    it('should clear hover state when button is disabled', () => {
      const actionId = 'test:action';
      renderer.buttonVisualMap.set(actionId, {
        button: testButton,
        visual: { backgroundColor: '#ff0000' }
      });
      
      // Apply hover first
      renderer._applyHoverState(testButton, true);
      
      // Then disable
      renderer.setButtonDisabled(actionId, true);
      
      expect(testButton.disabled).toBe(true);
      expect(testButton.classList.contains('action-button-hovering')).toBe(false);
      expect(testButton.style.opacity).toBe('0.5');
    });

    it('should restore visual state when button is enabled', () => {
      const actionId = 'test:action';
      testButton.dataset.customBg = '#ff0000';
      renderer.buttonVisualMap.set(actionId, {
        button: testButton,
        visual: { backgroundColor: '#ff0000' }
      });
      
      // Disable then enable
      renderer.setButtonDisabled(actionId, true);
      renderer.setButtonDisabled(actionId, false);
      
      expect(testButton.disabled).toBe(false);
      expect(testButton.style.backgroundColor).toBe('#ff0000');
      expect(testButton.style.opacity).toBe('');
    });
  });

  describe('event handling', () => {
    it('should handle mouseenter events', () => {
      renderer._addHoverListeners(testButton);
      const applyHoverSpy = jest.spyOn(renderer, '_applyHoverState');
      
      const event = new MouseEvent('mouseenter', { target: testButton });
      testButton.dispatchEvent(event);
      
      expect(applyHoverSpy).toHaveBeenCalledWith(testButton, true);
    });

    it('should handle mouseleave events with debounce', (done) => {
      renderer._addHoverListeners(testButton);
      const applyHoverSpy = jest.spyOn(renderer, '_applyHoverState');
      
      const event = new MouseEvent('mouseleave', { target: testButton });
      testButton.dispatchEvent(event);
      
      // Should be debounced
      expect(applyHoverSpy).not.toHaveBeenCalledWith(testButton, false);
      
      // Check after debounce period
      setTimeout(() => {
        expect(applyHoverSpy).toHaveBeenCalledWith(testButton, false);
        done();
      }, 60);
    });

    it('should ignore hover on disabled buttons', () => {
      testButton.disabled = true;
      const applyHoverSpy = jest.spyOn(renderer, '_applyHoverState');
      
      renderer._handleHoverEnter({ target: testButton });
      
      expect(applyHoverSpy).not.toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should clear all hover timeouts on cleanup', () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      
      // Set up some timeouts
      renderer.hoverTimeouts.set(testButton, 123);
      renderer.hoverTimeouts.set(document.createElement('button'), 456);
      
      renderer.clear();
      
      expect(clearTimeoutSpy).toHaveBeenCalledWith(123);
      expect(clearTimeoutSpy).toHaveBeenCalledWith(456);
      expect(renderer.hoverTimeouts.size).toBe(0);
    });
  });
});
```

## Acceptance Criteria

1. ✅ Hover event listeners are added to buttons with custom hover colors
2. ✅ Hover state applies custom background and text colors
3. ✅ Original colors are restored when hover ends
4. ✅ Smooth transitions between states (CSS transitions)
5. ✅ Debounced hover events prevent flickering
6. ✅ Focus events work for keyboard accessibility
7. ✅ Disabled buttons don't respond to hover
8. ✅ Event listeners are properly cleaned up
9. ✅ Performance is acceptable with 100+ buttons
10. ✅ Unit tests verify all hover behavior

## Notes

- 50ms debounce prevents flicker from rapid mouse movements
- Focus/blur events ensure keyboard accessibility
- Disabled state handling prevents confusing user interactions
- Proper cleanup prevents memory leaks
- CSS transitions provide smooth visual feedback

## Related Tickets
- **Depends on**: ACTBUTVIS-007 (Visual styles foundation)
- **Next**: ACTBUTVIS-009 (Theme compatibility)
- **Testing**: ACTBUTVIS-010 (Unit tests), ACTBUTVIS-011 (Integration tests)

## References
- Renderer Location: `src/domUI/actionButtonsRenderer.js`
- CSS Location: `css/components/_game-actions.css`
- Original Spec: `specs/action-button-visual-customization.spec.md`