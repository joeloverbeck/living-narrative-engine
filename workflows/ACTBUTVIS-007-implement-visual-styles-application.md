# ACTBUTVIS-007: Implement Visual Styles Application in ActionButtonsRenderer

## Status

**Status**: Not Started  
**Priority**: High  
**Type**: UI Implementation  
**Estimated Effort**: 4 hours

## Dependencies

- **Requires**: ACTBUTVIS-003 (Pipeline), ACTBUTVIS-006 (Factory)
- **Blocks**: ACTBUTVIS-008 (Hover States), ACTBUTVIS-009 (Theme Compatibility)

## Context

The ActionButtonsRenderer is responsible for rendering action buttons in the UI. This is the critical UI implementation ticket where visual properties are actually applied to the DOM elements. This ticket implements the core visual customization functionality.

## Objectives

1. Apply visual properties to action buttons via inline styles
2. Maintain existing button functionality
3. Ensure efficient DOM manipulation
4. Preserve theme system integration
5. Set up foundation for hover state management

## Implementation Details

### File Modifications

#### 1. Update ActionButtonsRenderer

**File**: `src/domUI/actionButtonsRenderer.js`

**Current Structure Analysis**:

- Renders action buttons in a list container
- Uses domElementFactory to create DOM elements
- Handles button click events
- Manages selected state

**Changes Required**:

```javascript
import { visualPropertiesToCSS } from '../validation/visualPropertiesValidator.js';

class ActionButtonsRenderer extends BoundDomRendererBase {
  constructor({ domElementFactory, eventBus, logger, containerSelector }) {
    super({ domElementFactory, eventBus, logger, containerSelector });

    // Store references for hover handling (prep for ACTBUTVIS-008)
    this.buttonVisualMap = new Map();
  }

  /**
   * Render action buttons from action composites
   * @param {Array} actionComposites - Array of action composite objects
   */
  render(actionComposites) {
    try {
      // Clear existing buttons
      this.clear();

      // Create container if needed
      const container = this.getOrCreateContainer();

      // Render each action as a button
      actionComposites.forEach((actionComposite, index) => {
        this._renderActionButton(actionComposite, container, index);
      });

      this.logger.debug(`Rendered ${actionComposites.length} action buttons`);

      // Report visual customization statistics
      const visualCount = actionComposites.filter((a) => a.visual).length;
      if (visualCount > 0) {
        this.logger.debug(`${visualCount} buttons have visual customization`);
      }
    } catch (error) {
      this.logger.error('Failed to render action buttons:', error);
      this.handleRenderError(error);
    }
  }

  /**
   * Render a single action button
   * @private
   * @param {Object} actionComposite - Action composite object
   * @param {HTMLElement} container - Container element
   * @param {number} index - Button index
   */
  _renderActionButton(actionComposite, container, index) {
    // Create list item wrapper
    const listItem = this.domElementFactory.createElement('li', {
      className: 'action-item',
      attributes: {
        'data-action-index': index,
        'data-action-id': actionComposite.actionId,
      },
    });

    // Create button element
    const button = this._createActionButton(actionComposite, index);

    // NEW: Apply visual styles if present
    if (actionComposite.visual) {
      this._applyVisualStyles(
        button,
        actionComposite.visual,
        actionComposite.actionId
      );
    }

    // Attach event listeners
    this._attachButtonListeners(button, actionComposite, index);

    // Append to container
    listItem.appendChild(button);
    container.appendChild(listItem);
  }

  /**
   * Create an action button element
   * @private
   * @param {Object} actionComposite - Action composite object
   * @param {number} index - Button index
   * @returns {HTMLButtonElement} Button element
   */
  _createActionButton(actionComposite, index) {
    // Format button text
    const buttonText = this._formatButtonText(actionComposite);

    // Create button
    const button = this.domElementFactory.button(buttonText, 'action-button');

    // Add data attributes
    button.dataset.actionIndex = index;
    button.dataset.actionId = actionComposite.actionId;

    // Add accessibility attributes
    button.setAttribute(
      'aria-label',
      actionComposite.description || buttonText
    );

    return button;
  }

  /**
   * Apply visual styles to a button
   * @private
   * @param {HTMLButtonElement} button - Button element
   * @param {Object} visual - Visual properties object
   * @param {string} actionId - Action ID for tracking
   */
  _applyVisualStyles(button, visual, actionId) {
    if (!visual || !button) {
      return;
    }

    try {
      // Apply base colors via inline styles
      if (visual.backgroundColor) {
        button.style.backgroundColor = visual.backgroundColor;
        // Store original for theme switching
        button.dataset.customBg = visual.backgroundColor;
      }

      if (visual.textColor) {
        button.style.color = visual.textColor;
        // Store original for theme switching
        button.dataset.customText = visual.textColor;
      }

      // Store hover colors in dataset for hover handling (ACTBUTVIS-008)
      if (visual.hoverBackgroundColor || visual.hoverTextColor) {
        // Store original colors for restoration
        button.dataset.originalBg = visual.backgroundColor || '';
        button.dataset.originalText = visual.textColor || '';

        // Store hover colors
        button.dataset.hoverBg = visual.hoverBackgroundColor || '';
        button.dataset.hoverText = visual.hoverTextColor || '';

        // Flag button as having custom hover
        button.dataset.hasCustomHover = 'true';
      }

      // Store visual mapping for efficient updates
      this.buttonVisualMap.set(actionId, {
        button: button,
        visual: visual,
      });

      // Add custom visual class for CSS hooks
      button.classList.add('action-button-custom-visual');

      this.logger.debug(
        `Applied visual styles to button for action: ${actionId}`
      );
    } catch (error) {
      this.logger.warn(
        `Failed to apply visual styles for action ${actionId}:`,
        error
      );
      // Continue without visual customization
    }
  }

  /**
   * Update visual styles for a specific button
   * @param {string} actionId - Action ID
   * @param {Object} newVisual - New visual properties
   */
  updateButtonVisual(actionId, newVisual) {
    const mapping = this.buttonVisualMap.get(actionId);

    if (!mapping) {
      this.logger.warn(`No button found for action: ${actionId}`);
      return;
    }

    const { button } = mapping;

    // Clear existing inline styles
    button.style.backgroundColor = '';
    button.style.color = '';

    // Apply new visual styles
    if (newVisual) {
      this._applyVisualStyles(button, newVisual, actionId);
    } else {
      // Remove custom visual class
      button.classList.remove('action-button-custom-visual');
      // Clear dataset
      delete button.dataset.customBg;
      delete button.dataset.customText;
      delete button.dataset.hasCustomHover;

      // Remove from map
      this.buttonVisualMap.delete(actionId);
    }
  }

  /**
   * Handle button click events
   * @private
   * @param {HTMLButtonElement} button - Button element
   * @param {Object} actionComposite - Action composite
   * @param {number} index - Button index
   */
  _attachButtonListeners(button, actionComposite, index) {
    // Click handler
    button.addEventListener('click', (event) => {
      event.preventDefault();
      this._handleButtonClick(actionComposite, index);
    });

    // Prepare for hover handlers (ACTBUTVIS-008)
    if (button.dataset.hasCustomHover === 'true') {
      // Hover handlers will be added in ACTBUTVIS-008
      button.dataset.pendingHoverHandlers = 'true';
    }
  }

  /**
   * Handle selected state visual changes
   * @private
   * @param {HTMLButtonElement} button - Button element
   * @param {boolean} isSelected - Whether button is selected
   */
  _updateSelectedState(button, isSelected) {
    if (isSelected) {
      button.classList.add('selected');

      // Preserve custom colors in selected state
      if (button.dataset.customBg) {
        // Apply a selected overlay while preserving custom color
        const originalBg = button.dataset.customBg;
        button.style.backgroundColor = this._blendWithSelected(originalBg);
      }
    } else {
      button.classList.remove('selected');

      // Restore original custom color
      if (button.dataset.customBg) {
        button.style.backgroundColor = button.dataset.customBg;
      }
    }
  }

  /**
   * Blend a color with selected state overlay
   * @private
   * @param {string} color - Original color
   * @returns {string} Blended color
   */
  _blendWithSelected(color) {
    // Simple approach: add transparency overlay
    // In production, could use a proper color blending algorithm
    if (color.startsWith('#')) {
      // For hex, darken slightly
      return color + 'dd'; // ~87% opacity
    }

    if (color.startsWith('rgb(')) {
      // Convert to rgba with slight transparency
      return color.replace('rgb(', 'rgba(').replace(')', ', 0.87)');
    }

    // Return as-is for other formats
    return color;
  }

  /**
   * Clear all rendered buttons
   */
  clear() {
    super.clear();

    // Clear visual mappings
    this.buttonVisualMap.clear();
  }

  /**
   * Handle render errors gracefully
   * @private
   * @param {Error} error - Render error
   */
  handleRenderError(error) {
    // Log error
    this.logger.error('Action button render error:', error);

    // Emit error event
    this.eventBus.emit('UI_RENDER_ERROR', {
      component: 'ActionButtonsRenderer',
      error: error.message,
    });

    // Attempt to render fallback UI
    this.renderFallback();
  }

  /**
   * Render fallback UI when visual customization fails
   * @private
   */
  renderFallback() {
    try {
      const container = this.getOrCreateContainer();
      container.innerHTML =
        '<div class="error-message">Failed to render actions</div>';
    } catch (fallbackError) {
      this.logger.error('Fallback render also failed:', fallbackError);
    }
  }
}

export default ActionButtonsRenderer;
```

### CSS Considerations

#### Add CSS class for custom visual buttons

**File**: `css/components/_game-actions.css`

```css
/* Custom visual action buttons */
.action-button-custom-visual {
  /* Ensure inline styles take precedence */
  transition:
    background-color 0.2s,
    color 0.2s;
}

/* Preserve theme animations with custom colors */
.action-button-custom-visual:not(:disabled) {
  cursor: pointer;
}

/* Selected state with custom visual */
.action-button-custom-visual.selected {
  /* Use box-shadow for selection indicator instead of background */
  box-shadow: inset 0 0 0 2px var(--selection-color, #0066cc);
}
```

### Testing Requirements

#### Unit Tests

**File**: `tests/unit/domUI/actionButtonsRenderer.test.js`

```javascript
describe('ActionButtonsRenderer - Visual Styles', () => {
  let renderer;
  let mockDomElementFactory;
  let mockEventBus;
  let mockContainer;

  beforeEach(() => {
    mockContainer = document.createElement('div');

    mockDomElementFactory = {
      createElement: jest.fn((tag, options) => {
        const element = document.createElement(tag);
        if (options?.className) element.className = options.className;
        return element;
      }),
      button: jest.fn((text, className) => {
        const button = document.createElement('button');
        button.textContent = text;
        button.className = className;
        return button;
      }),
    };

    mockEventBus = {
      emit: jest.fn(),
    };

    renderer = new ActionButtonsRenderer({
      domElementFactory: mockDomElementFactory,
      eventBus: mockEventBus,
      logger: console,
      containerSelector: '#test-container',
    });

    renderer.getOrCreateContainer = jest.fn(() => mockContainer);
  });

  describe('visual styles application', () => {
    it('should apply backgroundColor and textColor', () => {
      const actionComposite = {
        actionId: 'test:action',
        commandString: 'Test Action',
        visual: {
          backgroundColor: '#ff0000',
          textColor: '#ffffff',
        },
      };

      renderer.render([actionComposite]);

      const button = mockContainer.querySelector('button');
      expect(button.style.backgroundColor).toBe('rgb(255, 0, 0)'); // Browsers normalize
      expect(button.style.color).toBe('rgb(255, 255, 255)');
      expect(button.dataset.customBg).toBe('#ff0000');
      expect(button.dataset.customText).toBe('#ffffff');
    });

    it('should add custom visual class', () => {
      const actionComposite = {
        actionId: 'test:action',
        commandString: 'Test Action',
        visual: { backgroundColor: '#ff0000' },
      };

      renderer.render([actionComposite]);

      const button = mockContainer.querySelector('button');
      expect(button.classList.contains('action-button-custom-visual')).toBe(
        true
      );
    });

    it('should store hover colors in dataset', () => {
      const actionComposite = {
        actionId: 'test:action',
        commandString: 'Test Action',
        visual: {
          backgroundColor: '#ff0000',
          hoverBackgroundColor: '#00ff00',
          hoverTextColor: '#000000',
        },
      };

      renderer.render([actionComposite]);

      const button = mockContainer.querySelector('button');
      expect(button.dataset.hoverBg).toBe('#00ff00');
      expect(button.dataset.hoverText).toBe('#000000');
      expect(button.dataset.hasCustomHover).toBe('true');
    });

    it('should handle missing visual properties', () => {
      const actionComposite = {
        actionId: 'test:action',
        commandString: 'Test Action',
        // No visual property
      };

      expect(() => renderer.render([actionComposite])).not.toThrow();

      const button = mockContainer.querySelector('button');
      expect(button.style.backgroundColor).toBe('');
      expect(button.classList.contains('action-button-custom-visual')).toBe(
        false
      );
    });
  });

  describe('updateButtonVisual', () => {
    it('should update existing button visual', () => {
      const actionComposite = {
        actionId: 'test:action',
        commandString: 'Test',
        visual: { backgroundColor: '#ff0000' },
      };

      renderer.render([actionComposite]);

      const newVisual = { backgroundColor: '#00ff00' };
      renderer.updateButtonVisual('test:action', newVisual);

      const button = mockContainer.querySelector('button');
      expect(button.style.backgroundColor).toBe('rgb(0, 255, 0)');
    });

    it('should remove visual styles when passed null', () => {
      const actionComposite = {
        actionId: 'test:action',
        commandString: 'Test',
        visual: { backgroundColor: '#ff0000' },
      };

      renderer.render([actionComposite]);
      renderer.updateButtonVisual('test:action', null);

      const button = mockContainer.querySelector('button');
      expect(button.style.backgroundColor).toBe('');
      expect(button.classList.contains('action-button-custom-visual')).toBe(
        false
      );
    });
  });
});
```

## Acceptance Criteria

1. ✅ Visual properties are applied as inline styles to buttons
2. ✅ Background color and text color are correctly applied
3. ✅ Hover color data is stored in dataset attributes
4. ✅ Custom visual class is added for CSS hooks
5. ✅ Visual mapping is maintained for updates
6. ✅ Selected state preserves custom colors
7. ✅ Buttons without visual properties render normally
8. ✅ Error handling doesn't break rendering
9. ✅ Performance is acceptable with 100+ custom buttons
10. ✅ Unit tests verify all visual application scenarios

## Notes

- Inline styles ensure visual properties override theme styles
- Dataset attributes prepare for hover implementation (ACTBUTVIS-008)
- The visual map enables efficient updates without re-rendering
- Consider using CSS variables for frequently used colors in future optimization

## Related Tickets

- **Depends on**: ACTBUTVIS-003 (Pipeline), ACTBUTVIS-006 (Factory)
- **Next**: ACTBUTVIS-008 (Hover states), ACTBUTVIS-009 (Theme compatibility)
- **Testing**: ACTBUTVIS-010 (Unit tests), ACTBUTVIS-011 (Integration tests)

## References

- Renderer Location: `src/domUI/actionButtonsRenderer.js`
- Base Class: `src/domUI/boundDomRendererBase.js`
- Visual Validator: `src/validation/visualPropertiesValidator.js`
- CSS Files: `css/components/_game-actions.css`
- Original Spec: `specs/action-button-visual-customization.spec.md`
