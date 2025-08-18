# ACTBUTVIS-009: Ensure Theme Compatibility

## Status

**Status**: Not Started  
**Priority**: Medium  
**Type**: Theme Integration  
**Estimated Effort**: 2 hours

## Dependencies

- **Requires**: ACTBUTVIS-007 (Visual Styles), ACTBUTVIS-008 (Hover States)
- **Blocks**: ACTBUTVIS-012 (Performance Testing)

## Context

The application likely has a theme system that allows users to switch between different visual themes. Custom action button colors should work seamlessly with theme changes, preserving the custom visual properties while adapting to theme-specific elements like selection indicators and focus styles.

## Objectives

1. Ensure custom visual properties work with all existing themes
2. Preserve custom colors during theme switches
3. Adapt theme-specific elements (selection, focus) to work with custom colors
4. Maintain accessibility standards across themes
5. Provide fallback behavior for unsupported themes

## Implementation Details

### Theme Integration Strategy

#### 1. Theme Switch Event Handling

**File**: `src/domUI/actionButtonsRenderer.js`

```javascript
class ActionButtonsRenderer extends BoundDomRendererBase {
  constructor({ domElementFactory, eventBus, logger, containerSelector }) {
    super({ domElementFactory, eventBus, logger, containerSelector });

    // Existing properties...
    this.currentTheme = null;

    // Listen for theme change events
    this.eventBus.on('THEME_CHANGED', this._handleThemeChange.bind(this));
  }

  /**
   * Handle theme change events
   * @private
   * @param {Object} themeEvent - Theme change event
   */
  _handleThemeChange(themeEvent) {
    const { newTheme, previousTheme } = themeEvent;

    this.logger.debug(`Theme changed from ${previousTheme} to ${newTheme}`);
    this.currentTheme = newTheme;

    // Update all buttons with custom visual properties
    this._updateButtonsForTheme(newTheme);
  }

  /**
   * Update all custom visual buttons for new theme
   * @private
   * @param {string} themeName - New theme name
   */
  _updateButtonsForTheme(themeName) {
    for (const [actionId, mapping] of this.buttonVisualMap) {
      const { button, visual } = mapping;

      // Reapply custom visual styles
      this._applyVisualStyles(button, visual, actionId);

      // Update theme-specific adaptations
      this._adaptButtonForTheme(button, visual, themeName);
    }
  }

  /**
   * Adapt button styling for specific theme
   * @private
   * @param {HTMLButtonElement} button - Button element
   * @param {Object} visual - Visual properties
   * @param {string} themeName - Theme name
   */
  _adaptButtonForTheme(button, visual, themeName) {
    // Remove previous theme adaptations
    button.classList.remove(
      'theme-dark-adapted',
      'theme-light-adapted',
      'theme-high-contrast-adapted'
    );

    switch (themeName) {
      case 'dark':
        this._adaptForDarkTheme(button, visual);
        button.classList.add('theme-dark-adapted');
        break;

      case 'light':
        this._adaptForLightTheme(button, visual);
        button.classList.add('theme-light-adapted');
        break;

      case 'high-contrast':
        this._adaptForHighContrastTheme(button, visual);
        button.classList.add('theme-high-contrast-adapted');
        break;

      default:
        // No specific adaptation needed
        break;
    }
  }

  /**
   * Adapt button for dark theme
   * @private
   */
  _adaptForDarkTheme(button, visual) {
    // Dark theme typically needs lighter selection indicators
    button.style.setProperty('--selection-color', '#4CAF50');
    button.style.setProperty('--focus-color', '#2196F3');

    // Ensure sufficient contrast for custom colors in dark theme
    if (
      visual.textColor &&
      this._isColorTooSimilar(visual.textColor, '#000000')
    ) {
      console.warn(
        `Text color ${visual.textColor} may have poor contrast in dark theme`
      );
    }
  }

  /**
   * Adapt button for light theme
   * @private
   */
  _adaptForLightTheme(button, visual) {
    // Light theme typically needs darker selection indicators
    button.style.setProperty('--selection-color', '#1976D2');
    button.style.setProperty('--focus-color', '#0D47A1');

    // Ensure sufficient contrast for custom colors in light theme
    if (
      visual.textColor &&
      this._isColorTooSimilar(visual.textColor, '#FFFFFF')
    ) {
      console.warn(
        `Text color ${visual.textColor} may have poor contrast in light theme`
      );
    }
  }

  /**
   * Adapt button for high contrast theme
   * @private
   */
  _adaptForHighContrastTheme(button, visual) {
    // High contrast theme needs very distinct colors
    button.style.setProperty('--selection-color', '#FFFF00');
    button.style.setProperty('--focus-color', '#00FFFF');

    // Add high contrast border
    button.style.border = '2px solid currentColor';

    // Warn about potential accessibility issues
    if (
      !this._meetsContrastRequirement(visual.backgroundColor, visual.textColor)
    ) {
      console.warn(
        `Custom colors for ${button.dataset.actionId} may not meet ` +
          `high contrast accessibility requirements`
      );
    }
  }

  /**
   * Check if two colors are too similar
   * @private
   * @param {string} color1 - First color
   * @param {string} color2 - Second color
   * @returns {boolean} True if colors are too similar
   */
  _isColorTooSimilar(color1, color2) {
    // Simplified color similarity check
    // In production, would use proper color space calculations
    const rgb1 = this._parseColor(color1);
    const rgb2 = this._parseColor(color2);

    if (!rgb1 || !rgb2) return false;

    const distance = Math.sqrt(
      Math.pow(rgb1.r - rgb2.r, 2) +
        Math.pow(rgb1.g - rgb2.g, 2) +
        Math.pow(rgb1.b - rgb2.b, 2)
    );

    return distance < 50; // Threshold for "too similar"
  }

  /**
   * Parse CSS color to RGB values
   * @private
   * @param {string} color - CSS color string
   * @returns {Object|null} RGB object or null if parsing fails
   */
  _parseColor(color) {
    // Create a temporary element to parse color
    const div = document.createElement('div');
    div.style.color = color;
    document.body.appendChild(div);

    const computed = window.getComputedStyle(div).color;
    document.body.removeChild(div);

    // Parse rgb(r, g, b) format
    const match = computed.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
      return {
        r: parseInt(match[1], 10),
        g: parseInt(match[2], 10),
        b: parseInt(match[3], 10),
      };
    }

    return null;
  }

  /**
   * Check if color combination meets contrast requirements
   * @private
   * @param {string} bgColor - Background color
   * @param {string} textColor - Text color
   * @returns {boolean} True if contrast is sufficient
   */
  _meetsContrastRequirement(bgColor, textColor) {
    // Simplified contrast check
    // In production, would use WCAG contrast ratio calculations
    if (!bgColor || !textColor) return true;

    const bg = this._parseColor(bgColor);
    const text = this._parseColor(textColor);

    if (!bg || !text) return true;

    // Calculate relative luminance (simplified)
    const bgLuminance = (0.299 * bg.r + 0.587 * bg.g + 0.114 * bg.b) / 255;
    const textLuminance =
      (0.299 * text.r + 0.587 * text.g + 0.114 * text.b) / 255;

    // Calculate contrast ratio
    const contrast = Math.abs(bgLuminance - textLuminance);

    return contrast > 0.5; // Simplified threshold
  }
}
```

### CSS Theme Integration

#### 1. Theme-aware CSS Variables

**File**: `css/components/_game-actions.css`

```css
/* Theme-aware custom action buttons */
.action-button-custom-visual {
  /* Use CSS custom properties for theme integration */
  --selection-color: var(--theme-selection-color, #0066cc);
  --focus-color: var(--theme-focus-color, #0066cc);
  --disabled-opacity: var(--theme-disabled-opacity, 0.5);

  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}

/* Theme-specific adaptations */
.theme-dark .action-button-custom-visual {
  --selection-color: #4caf50;
  --focus-color: #2196f3;
  /* Add subtle glow for better visibility in dark theme */
  filter: drop-shadow(0 0 2px rgba(255, 255, 255, 0.1));
}

.theme-light .action-button-custom-visual {
  --selection-color: #1976d2;
  --focus-color: #0d47a1;
  /* Add subtle shadow for depth in light theme */
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));
}

.theme-high-contrast .action-button-custom-visual {
  --selection-color: #ffff00;
  --focus-color: #00ffff;
  /* Force high contrast borders */
  border: 2px solid currentColor !important;
  font-weight: bold;
}

/* Selected state with custom colors - theme aware */
.action-button-custom-visual.selected {
  box-shadow:
    inset 0 0 0 2px var(--selection-color),
    0 0 4px var(--selection-color);
}

/* Focus state - theme aware */
.action-button-custom-visual:focus {
  outline: 2px solid var(--focus-color);
  outline-offset: 2px;
}

/* High contrast theme specific */
.theme-high-contrast .action-button-custom-visual:focus {
  outline: 3px solid var(--focus-color);
  outline-offset: 3px;
}

/* Ensure hover states work with themes */
.theme-dark .action-button-hovering {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(255, 255, 255, 0.1);
}

.theme-light .action-button-hovering {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.theme-high-contrast .action-button-hovering {
  transform: scale(1.05);
  box-shadow: 0 0 0 3px var(--focus-color);
}
```

### Testing Requirements

#### Unit Tests

**File**: `tests/unit/domUI/actionButtonsRenderer.test.js`

```javascript
describe('ActionButtonsRenderer - Theme Compatibility', () => {
  let renderer;
  let mockEventBus;

  beforeEach(() => {
    mockEventBus = {
      on: jest.fn(),
      emit: jest.fn(),
    };

    renderer = new ActionButtonsRenderer({
      eventBus: mockEventBus,
      // other dependencies...
    });
  });

  describe('theme change handling', () => {
    it('should listen for theme change events', () => {
      expect(mockEventBus.on).toHaveBeenCalledWith(
        'THEME_CHANGED',
        expect.any(Function)
      );
    });

    it('should update all custom buttons on theme change', () => {
      const testButton = document.createElement('button');
      testButton.dataset.actionId = 'test:action';

      renderer.buttonVisualMap.set('test:action', {
        button: testButton,
        visual: { backgroundColor: '#ff0000' },
      });

      const adaptSpy = jest.spyOn(renderer, '_adaptButtonForTheme');

      renderer._handleThemeChange({
        newTheme: 'dark',
        previousTheme: 'light',
      });

      expect(adaptSpy).toHaveBeenCalledWith(
        testButton,
        { backgroundColor: '#ff0000' },
        'dark'
      );
    });
  });

  describe('theme-specific adaptations', () => {
    it('should adapt button for dark theme', () => {
      const testButton = document.createElement('button');
      const visual = { backgroundColor: '#ff0000', textColor: '#ffffff' };

      renderer._adaptForDarkTheme(testButton, visual);

      expect(testButton.classList.contains('theme-dark-adapted')).toBe(true);
      expect(testButton.style.getPropertyValue('--selection-color')).toBe(
        '#4CAF50'
      );
    });

    it('should adapt button for high contrast theme', () => {
      const testButton = document.createElement('button');
      const visual = { backgroundColor: '#ff0000', textColor: '#ffffff' };

      renderer._adaptForHighContrastTheme(testButton, visual);

      expect(testButton.style.border).toBe('2px solid currentColor');
    });
  });

  describe('color similarity detection', () => {
    it('should detect similar colors', () => {
      const result = renderer._isColorTooSimilar('#000000', '#111111');
      expect(result).toBe(true);
    });

    it('should detect different colors', () => {
      const result = renderer._isColorTooSimilar('#000000', '#ffffff');
      expect(result).toBe(false);
    });
  });

  describe('contrast requirements', () => {
    it('should check contrast requirements', () => {
      const goodContrast = renderer._meetsContrastRequirement(
        '#000000',
        '#ffffff'
      );
      expect(goodContrast).toBe(true);

      const poorContrast = renderer._meetsContrastRequirement(
        '#333333',
        '#444444'
      );
      expect(poorContrast).toBe(false);
    });
  });
});
```

## Acceptance Criteria

1. ✅ Custom visual properties are preserved during theme switches
2. ✅ Theme-specific adaptations work correctly (dark, light, high-contrast)
3. ✅ Selection indicators adapt to theme colors
4. ✅ Focus styles work with each theme
5. ✅ Hover states are theme-aware
6. ✅ Contrast warnings are logged for accessibility issues
7. ✅ CSS custom properties enable theme integration
8. ✅ High contrast theme receives special treatment
9. ✅ Theme change events are handled properly
10. ✅ Unit tests verify theme compatibility

## Notes

- Theme compatibility should not break existing theme functionality
- Consider using CSS custom properties for better theme integration
- Accessibility warnings help modders create inclusive experiences
- Theme-specific adaptations should be minimal and focused
- Performance impact should be minimal during theme switches

## Related Tickets

- **Depends on**: ACTBUTVIS-007 (Visual styles), ACTBUTVIS-008 (Hover states)
- **Next**: ACTBUTVIS-012 (Performance testing)
- **Testing**: ACTBUTVIS-010 (Unit tests), ACTBUTVIS-011 (Integration tests)

## References

- Theme System: Look for theme-related files in `css/themes/` or `src/theming/`
- CSS Variables: `css/components/_game-actions.css`
- Event System: `src/events/eventBus.js`
- Original Spec: `specs/action-button-visual-customization.spec.md`
