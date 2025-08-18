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

- Extends SelectableListDisplayComponent (which extends BaseListDisplayComponent → BoundDomRendererBase)
- Uses _renderListItem() method to create individual action buttons
- Supports action grouping and categorization via actionCategorizationService
- Handles button selection and dispatches player turn events
- Already includes visual property validation in ActionComposite DTOs

**Changes Required**:

```javascript
// Visual properties validation is already imported via actionComposite.js
// import { validateVisualProperties } from '../turns/dtos/actionComposite.js'; (already available)

// Note: ActionButtonsRenderer extends SelectableListDisplayComponent
// Constructor signature is already established:
// constructor({
//   logger,
//   documentContext, 
//   validatedEventDispatcher,
//   domElementFactory,
//   actionButtonsContainerSelector,
//   sendButtonSelector,
//   speechInputSelector,
//   actionCategorizationService,
// })

// Add visual mapping for hover handling (prep for ACTBUTVIS-008)
// Add to existing constructor:
  constructor(params) {
    super(params);
    // ... existing constructor code ...
    
    // Store references for hover handling (prep for ACTBUTVIS-008)
    this.buttonVisualMap = new Map();
  }

  /**
   * Override _renderListItem to add visual styles support
   * This method is called by the base class renderList() method
   * @protected
   * @override
   * @param {ActionComposite} actionComposite - The action data to render
   * @returns {HTMLButtonElement | null} The button element or null if invalid
   */
  _renderListItem(actionComposite) {
    // Call parent implementation to create the basic button
    const button = super._renderListItem(actionComposite);
    
    if (!button) {
      return null;
    }

    try {
      // Apply visual styles if present
      if (actionComposite.visual) {
        this._applyVisualStyles(
          button,
          actionComposite.visual,
          actionComposite.actionId
        );
        
        this.logger.debug(
          `${this._logPrefix} Applied visual styles to button for action: ${actionComposite.actionId}`
        );
      }
    } catch (error) {
      this.logger.warn(
        `${this._logPrefix} Failed to apply visual styles for action ${actionComposite.actionId}:`,
        error
      );
      // Continue without visual customization
    }

    return button;
  }

  // Note: Basic button creation is handled by parent class _renderListItem()
  // We only need to add the visual styles application method

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

  // Note: Button click handling is already implemented in the parent class
  // The parent _renderListItem() adds click listeners that call _onItemSelected()
  // We can add hover preparation in _renderListItem() override

  // Note: Selected state handling is managed by the parent SelectableListDisplayComponent
  // Custom visual buttons will use CSS box-shadow for selection indicators
  // to preserve custom background colors as defined in the CSS section above

  // Note: Color blending is handled via CSS box-shadow for selection
  // This preserves the original custom colors while indicating selection

  /**
   * Override dispose to clean up visual mappings
   * @override
   */
  dispose() {
    // Clear visual mappings
    if (this.buttonVisualMap) {
      this.buttonVisualMap.clear();
    }
    
    // Call parent dispose
    super.dispose();
  }

  // Note: Error handling is already implemented in the parent class
  // The base class handles render errors and fallback UI appropriately
}

export default ActionButtonsRenderer;
```

### CSS Considerations

#### Add CSS class for custom visual buttons

**File**: `css/components/_actions-widget.css`

```css
/* Add to existing _actions-widget.css */

/* Custom visual action buttons */
.action-button-custom-visual {
  /* Ensure inline styles take precedence while preserving animations */
  transition:
    background-color 0.2s ease-in-out,
    color 0.2s ease-in-out,
    transform 0.2s ease-in-out,
    opacity 0.2s ease-in-out;
}

/* Preserve theme animations with custom colors */
.action-button-custom-visual:not(:disabled) {
  cursor: pointer;
}

/* Selected state with custom visual - use box-shadow to preserve custom background */
.action-button-custom-visual.selected {
  box-shadow: inset 0 0 0 2px var(--focus-color, #0066cc);
  /* Ensure custom background colors are preserved */
}

/* Ensure custom visual buttons work with existing animations */
.action-button-custom-visual {
  /* Inherit existing animation properties from parent selectors */
}
```

### Testing Requirements

#### Unit Tests

**File**: `tests/unit/domUI/actionButtonsRenderer.test.js`

```javascript
describe('ActionButtonsRenderer - Visual Styles', () => {
  let renderer;
  let mockDomElementFactory;
  let mockValidatedEventDispatcher;
  let mockDocumentContext;
  let mockActionCategorizationService;
  let mockContainer;

  beforeEach(() => {
    mockContainer = document.createElement('div');
    
    mockDocumentContext = {
      create: jest.fn((tag) => document.createElement(tag)),
      document: document,
    };

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

    mockValidatedEventDispatcher = {
      dispatch: jest.fn(),
    };
    
    mockActionCategorizationService = {
      extractNamespace: jest.fn(),
      shouldUseGrouping: jest.fn(() => false),
      groupActionsByNamespace: jest.fn(),
      getSortedNamespaces: jest.fn(),
      formatNamespaceDisplayName: jest.fn(),
    };

    // Mock document methods
    document.querySelector = jest.fn(() => mockContainer);

    renderer = new ActionButtonsRenderer({
      logger: console,
      documentContext: mockDocumentContext,
      validatedEventDispatcher: mockValidatedEventDispatcher,
      domElementFactory: mockDomElementFactory,
      actionButtonsContainerSelector: '#action-buttons',
      actionCategorizationService: mockActionCategorizationService,
    });
  });

  describe('visual styles application', () => {
    it('should apply backgroundColor and textColor', async () => {
      const actionComposite = {
        index: 1,
        actionId: 'test:action',
        commandString: 'Test Action',
        description: 'Test action description',
        params: {},
        visual: {
          backgroundColor: '#ff0000',
          textColor: '#ffffff',
        },
      };

      // Mock the data source
      renderer.availableActions = [actionComposite];
      
      // Trigger render via renderList()
      await renderer.renderList();

      const button = mockContainer.querySelector('button');
      expect(button.style.backgroundColor).toBe('rgb(255, 0, 0)'); // Browsers normalize
      expect(button.style.color).toBe('rgb(255, 255, 255)');
      expect(button.dataset.customBg).toBe('#ff0000');
      expect(button.dataset.customText).toBe('#ffffff');
    });

    it('should add custom visual class', async () => {
      const actionComposite = {
        index: 1,
        actionId: 'test:action',
        commandString: 'Test Action',
        description: 'Test action description',
        params: {},
        visual: { backgroundColor: '#ff0000' },
      };

      renderer.availableActions = [actionComposite];
      await renderer.renderList();

      const button = mockContainer.querySelector('button');
      expect(button.classList.contains('action-button-custom-visual')).toBe(
        true
      );
    });

    it('should store hover colors in dataset', async () => {
      const actionComposite = {
        index: 1,
        actionId: 'test:action',
        commandString: 'Test Action',
        description: 'Test action description',
        params: {},
        visual: {
          backgroundColor: '#ff0000',
          hoverBackgroundColor: '#00ff00',
          hoverTextColor: '#000000',
        },
      };

      renderer.availableActions = [actionComposite];
      await renderer.renderList();

      const button = mockContainer.querySelector('button');
      expect(button.dataset.hoverBg).toBe('#00ff00');
      expect(button.dataset.hoverText).toBe('#000000');
      expect(button.dataset.hasCustomHover).toBe('true');
    });

    it('should handle missing visual properties', async () => {
      const actionComposite = {
        index: 1,
        actionId: 'test:action',
        commandString: 'Test Action',
        description: 'Test action description',
        params: {},
        // No visual property
      };

      renderer.availableActions = [actionComposite];
      
      await expect(renderer.renderList()).resolves.not.toThrow();

      const button = mockContainer.querySelector('button');
      expect(button.style.backgroundColor).toBe('');
      expect(button.classList.contains('action-button-custom-visual')).toBe(
        false
      );
    });
  });

  describe('updateButtonVisual', () => {
    it('should update existing button visual', async () => {
      const actionComposite = {
        index: 1,
        actionId: 'test:action',
        commandString: 'Test',
        description: 'Test action description',
        params: {},
        visual: { backgroundColor: '#ff0000' },
      };

      renderer.availableActions = [actionComposite];
      await renderer.renderList();

      const newVisual = { backgroundColor: '#00ff00' };
      renderer.updateButtonVisual('test:action', newVisual);

      const button = mockContainer.querySelector('button');
      expect(button.style.backgroundColor).toBe('rgb(0, 255, 0)');
    });

    it('should remove visual styles when passed null', async () => {
      const actionComposite = {
        index: 1,
        actionId: 'test:action',
        commandString: 'Test',
        description: 'Test action description', 
        params: {},
        visual: { backgroundColor: '#ff0000' },
      };

      renderer.availableActions = [actionComposite];
      await renderer.renderList();
      
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

- Implementation extends existing `_renderListItem()` method instead of creating new render system
- Inline styles ensure visual properties override theme styles while preserving animations
- Dataset attributes prepare for hover implementation (ACTBUTVIS-008)
- The visual map enables efficient updates without full re-rendering
- CSS uses box-shadow for selection indicators to preserve custom background colors
- Works with existing grouping and animation systems
- Visual properties validation is already implemented in ActionComposite DTOs

## Related Tickets

- **Depends on**: ACTBUTVIS-003 (Pipeline), ACTBUTVIS-006 (Factory)
- **Next**: ACTBUTVIS-008 (Hover states), ACTBUTVIS-009 (Theme compatibility)
- **Testing**: ACTBUTVIS-010 (Unit tests), ACTBUTVIS-011 (Integration tests)

## References

- Renderer Location: `src/domUI/actionButtonsRenderer.js`
- Parent Class: `src/domUI/selectableListDisplayComponent.js`
- Base Classes: `src/domUI/baseListDisplayComponent.js` → `src/domUI/boundDomRendererBase.js`
- Visual Validation: `src/turns/dtos/actionComposite.js` (validateVisualProperties function)
- CSS Files: `css/components/_actions-widget.css`
- Original Spec: `specs/action-button-visual-customization.spec.md`
