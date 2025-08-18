# ACTBUTVIS-004: Implement Visual Properties Validation

## Status
**Status**: Not Started  
**Priority**: High  
**Type**: Validation Layer  
**Estimated Effort**: 3 hours  

## Dependencies
- **Requires**: ACTBUTVIS-001 (Schema), ACTBUTVIS-002 (DTO validation)
- **Blocks**: ACTBUTVIS-005 (Action Loader)

## Context
While basic validation exists in the DTO and schema, we need a centralized validation utility for visual properties that can be reused across the application. This ensures consistent validation logic and provides helpful error messages for modders.

## Objectives
1. Create a centralized visual properties validation utility
2. Implement comprehensive color format validation
3. Provide clear error messages for invalid configurations
4. Support all CSS color formats (hex, rgb, rgba, named colors)
5. Create reusable validation functions for different contexts

## Implementation Details

### File Creation

#### 1. Create Visual Properties Validator
**New File**: `src/validation/visualPropertiesValidator.js`

```javascript
/**
 * @file Visual properties validation utilities for action button customization
 * @module visualPropertiesValidator
 */

import { ValidationError } from '../errors/validationError.js';

/**
 * CSS color validation patterns
 */
const COLOR_PATTERNS = {
  // Hex colors: #RGB or #RRGGBB
  hex: /^#([0-9A-Fa-f]{3}){1,2}$/,
  
  // RGB: rgb(r, g, b) where r,g,b are 0-255
  rgb: /^rgb\(\s*([0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])\s*,\s*([0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])\s*,\s*([0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])\s*\)$/,
  
  // RGBA: rgba(r, g, b, a) where a is 0-1
  rgba: /^rgba\(\s*([0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])\s*,\s*([0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])\s*,\s*([0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])\s*,\s*(0|0?\.[0-9]+|1(\.0)?)\s*\)$/,
  
  // Combined pattern for any valid format
  combined: /^(#([0-9A-Fa-f]{3}){1,2}|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)|rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)|[a-zA-Z]+)$/
};

/**
 * Standard CSS color names (subset of most common)
 * Full list would include all 140+ CSS color names
 */
const CSS_COLOR_NAMES = new Set([
  // Basic colors
  'black', 'white', 'red', 'green', 'blue', 'yellow', 'cyan', 'magenta',
  'gray', 'grey', 'silver', 'maroon', 'olive', 'lime', 'aqua', 'teal',
  'navy', 'fuchsia', 'purple', 'orange', 'brown', 'pink',
  
  // Extended colors (sample)
  'aliceblue', 'antiquewhite', 'aquamarine', 'azure', 'beige', 'bisque',
  'blanchedalmond', 'blueviolet', 'burlywood', 'cadetblue', 'chartreuse',
  'chocolate', 'coral', 'cornflowerblue', 'cornsilk', 'crimson', 'darkblue',
  'darkcyan', 'darkgoldenrod', 'darkgray', 'darkgrey', 'darkgreen',
  'darkkhaki', 'darkmagenta', 'darkolivegreen', 'darkorange', 'darkorchid',
  'darkred', 'darksalmon', 'darkseagreen', 'darkslateblue', 'darkslategray',
  'darkslategrey', 'darkturquoise', 'darkviolet', 'deeppink', 'deepskyblue',
  'dimgray', 'dimgrey', 'dodgerblue', 'firebrick', 'floralwhite',
  'forestgreen', 'gainsboro', 'ghostwhite', 'gold', 'goldenrod',
  'greenyellow', 'honeydew', 'hotpink', 'indianred', 'indigo', 'ivory',
  'khaki', 'lavender', 'lavenderblush', 'lawngreen', 'lemonchiffon',
  'lightblue', 'lightcoral', 'lightcyan', 'lightgoldenrodyellow', 'lightgray',
  'lightgrey', 'lightgreen', 'lightpink', 'lightsalmon', 'lightseagreen',
  'lightskyblue', 'lightslategray', 'lightslategrey', 'lightsteelblue',
  'lightyellow', 'limegreen', 'linen', 'mediumaquamarine', 'mediumblue',
  'mediumorchid', 'mediumpurple', 'mediumseagreen', 'mediumslateblue',
  'mediumspringgreen', 'mediumturquoise', 'mediumvioletred', 'midnightblue',
  'mintcream', 'mistyrose', 'moccasin', 'navajowhite', 'oldlace',
  'olivedrab', 'orangered', 'orchid', 'palegoldenrod', 'palegreen',
  'paleturquoise', 'palevioletred', 'papayawhip', 'peachpuff', 'peru',
  'plum', 'powderblue', 'rosybrown', 'royalblue', 'saddlebrown', 'salmon',
  'sandybrown', 'seagreen', 'seashell', 'sienna', 'skyblue', 'slateblue',
  'slategray', 'slategrey', 'snow', 'springgreen', 'steelblue', 'tan',
  'thistle', 'tomato', 'turquoise', 'violet', 'wheat', 'whitesmoke',
  'yellowgreen',
  
  // Special values
  'transparent', 'inherit', 'initial', 'unset'
]);

/**
 * Validates a CSS color value
 * @param {string} color - The color value to validate
 * @param {string} propertyName - Name of the property being validated (for error messages)
 * @returns {boolean} True if valid
 * @throws {ValidationError} If color is invalid
 */
export function validateCSSColor(color, propertyName = 'color') {
  if (typeof color !== 'string') {
    throw new ValidationError(
      `${propertyName} must be a string, received ${typeof color}`
    );
  }

  // Trim whitespace
  const trimmedColor = color.trim();
  
  if (!trimmedColor) {
    throw new ValidationError(`${propertyName} cannot be empty`);
  }

  // Check hex format
  if (trimmedColor.startsWith('#')) {
    if (!COLOR_PATTERNS.hex.test(trimmedColor)) {
      throw new ValidationError(
        `Invalid hex color for ${propertyName}: "${color}". ` +
        `Hex colors must be #RGB or #RRGGBB format.`
      );
    }
    return true;
  }

  // Check rgb format
  if (trimmedColor.startsWith('rgb(')) {
    if (!COLOR_PATTERNS.rgb.test(trimmedColor)) {
      throw new ValidationError(
        `Invalid RGB color for ${propertyName}: "${color}". ` +
        `RGB colors must be rgb(r, g, b) where r, g, b are 0-255.`
      );
    }
    return true;
  }

  // Check rgba format
  if (trimmedColor.startsWith('rgba(')) {
    if (!COLOR_PATTERNS.rgba.test(trimmedColor)) {
      throw new ValidationError(
        `Invalid RGBA color for ${propertyName}: "${color}". ` +
        `RGBA colors must be rgba(r, g, b, a) where r, g, b are 0-255 and a is 0-1.`
      );
    }
    return true;
  }

  // Check named colors
  if (CSS_COLOR_NAMES.has(trimmedColor.toLowerCase())) {
    return true;
  }

  // If none match, it's invalid
  throw new ValidationError(
    `Invalid color value for ${propertyName}: "${color}". ` +
    `Must be a hex color (#RGB or #RRGGBB), RGB/RGBA function, or valid CSS color name.`
  );
}

/**
 * Validates a complete visual properties object
 * @param {Object} visual - The visual properties object
 * @param {string} actionId - The action ID (for error context)
 * @returns {Object} Validated visual object
 * @throws {ValidationError} If any property is invalid
 */
export function validateVisualProperties(visual, actionId = 'unknown') {
  if (!visual) {
    return null;
  }

  if (typeof visual !== 'object' || Array.isArray(visual)) {
    throw new ValidationError(
      `Visual properties for action "${actionId}" must be an object`
    );
  }

  const validated = {};
  const allowedProperties = [
    'backgroundColor',
    'textColor',
    'hoverBackgroundColor',
    'hoverTextColor'
  ];

  // Validate each color property if present
  for (const prop of allowedProperties) {
    if (visual[prop] !== undefined) {
      validateCSSColor(visual[prop], `${prop} in action "${actionId}"`);
      validated[prop] = visual[prop];
    }
  }

  // Warn about unknown properties
  const unknownProps = Object.keys(visual).filter(
    prop => !allowedProperties.includes(prop)
  );
  
  if (unknownProps.length > 0) {
    console.warn(
      `Unknown visual properties in action "${actionId}" will be ignored: ` +
      unknownProps.join(', ')
    );
  }

  return validated;
}

/**
 * Checks if a visual properties object is valid without throwing
 * @param {Object} visual - The visual properties object
 * @returns {Object} Result object with { valid: boolean, errors: string[] }
 */
export function checkVisualProperties(visual) {
  const errors = [];
  
  if (!visual) {
    return { valid: true, errors };
  }

  if (typeof visual !== 'object' || Array.isArray(visual)) {
    errors.push('Visual properties must be an object');
    return { valid: false, errors };
  }

  const colorProps = [
    'backgroundColor',
    'textColor',
    'hoverBackgroundColor',
    'hoverTextColor'
  ];

  for (const prop of colorProps) {
    if (visual[prop] !== undefined) {
      try {
        validateCSSColor(visual[prop], prop);
      } catch (error) {
        errors.push(error.message);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Sanitizes visual properties by removing invalid values
 * @param {Object} visual - The visual properties object
 * @returns {Object|null} Sanitized visual object or null if all properties invalid
 */
export function sanitizeVisualProperties(visual) {
  if (!visual || typeof visual !== 'object') {
    return null;
  }

  const sanitized = {};
  const colorProps = [
    'backgroundColor',
    'textColor',
    'hoverBackgroundColor',
    'hoverTextColor'
  ];

  for (const prop of colorProps) {
    if (visual[prop] !== undefined) {
      try {
        validateCSSColor(visual[prop], prop);
        sanitized[prop] = visual[prop];
      } catch (error) {
        console.warn(`Removing invalid ${prop}: ${error.message}`);
      }
    }
  }

  return Object.keys(sanitized).length > 0 ? sanitized : null;
}

/**
 * Creates a CSS style string from visual properties
 * @param {Object} visual - The visual properties object
 * @returns {string} CSS style string
 */
export function visualPropertiesToCSS(visual) {
  if (!visual) {
    return '';
  }

  const styles = [];
  
  if (visual.backgroundColor) {
    styles.push(`background-color: ${visual.backgroundColor}`);
  }
  
  if (visual.textColor) {
    styles.push(`color: ${visual.textColor}`);
  }
  
  return styles.join('; ');
}

/**
 * Extracts hover styles from visual properties
 * @param {Object} visual - The visual properties object
 * @returns {Object} Object with hover CSS properties
 */
export function extractHoverStyles(visual) {
  if (!visual) {
    return null;
  }

  const hover = {};
  
  if (visual.hoverBackgroundColor) {
    hover.backgroundColor = visual.hoverBackgroundColor;
  }
  
  if (visual.hoverTextColor) {
    hover.color = visual.hoverTextColor;
  }
  
  return Object.keys(hover).length > 0 ? hover : null;
}

// Export patterns for testing
export { COLOR_PATTERNS, CSS_COLOR_NAMES };
```

#### 2. Create Validation Error Class (if not exists)
**File**: `src/errors/validationError.js` (update or create)

```javascript
/**
 * Error thrown when validation fails
 */
export class ValidationError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}
```

### Testing Requirements

#### Unit Tests
**New File**: `tests/unit/validation/visualPropertiesValidator.test.js`

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  validateCSSColor,
  validateVisualProperties,
  checkVisualProperties,
  sanitizeVisualProperties,
  visualPropertiesToCSS,
  extractHoverStyles
} from '../../../src/validation/visualPropertiesValidator.js';

describe('Visual Properties Validator', () => {
  describe('validateCSSColor', () => {
    it('should accept valid hex colors', () => {
      expect(() => validateCSSColor('#fff')).not.toThrow();
      expect(() => validateCSSColor('#ffffff')).not.toThrow();
      expect(() => validateCSSColor('#FF0000')).not.toThrow();
    });

    it('should accept valid rgb colors', () => {
      expect(() => validateCSSColor('rgb(255, 0, 0)')).not.toThrow();
      expect(() => validateCSSColor('rgb(0,0,0)')).not.toThrow();
      expect(() => validateCSSColor('rgb( 128 , 128 , 128 )')).not.toThrow();
    });

    it('should accept valid rgba colors', () => {
      expect(() => validateCSSColor('rgba(255, 0, 0, 0.5)')).not.toThrow();
      expect(() => validateCSSColor('rgba(0, 0, 0, 1)')).not.toThrow();
      expect(() => validateCSSColor('rgba(128, 128, 128, 0)')).not.toThrow();
    });

    it('should accept valid named colors', () => {
      expect(() => validateCSSColor('red')).not.toThrow();
      expect(() => validateCSSColor('darkblue')).not.toThrow();
      expect(() => validateCSSColor('mediumseagreen')).not.toThrow();
    });

    it('should reject invalid colors', () => {
      expect(() => validateCSSColor('#gg0000')).toThrow('Invalid hex color');
      expect(() => validateCSSColor('rgb(256, 0, 0)')).toThrow('Invalid RGB color');
      expect(() => validateCSSColor('notacolor')).toThrow('Invalid color value');
      expect(() => validateCSSColor('')).toThrow('cannot be empty');
    });
  });

  describe('validateVisualProperties', () => {
    it('should validate complete visual properties', () => {
      const visual = {
        backgroundColor: '#ff0000',
        textColor: 'white',
        hoverBackgroundColor: 'rgb(0, 255, 0)',
        hoverTextColor: 'rgba(0, 0, 0, 0.8)'
      };

      const result = validateVisualProperties(visual, 'test:action');
      expect(result).toEqual(visual);
    });

    it('should validate partial visual properties', () => {
      const visual = {
        backgroundColor: '#ff0000'
      };

      const result = validateVisualProperties(visual, 'test:action');
      expect(result).toEqual(visual);
    });

    it('should handle null visual properties', () => {
      const result = validateVisualProperties(null);
      expect(result).toBeNull();
    });

    it('should throw for invalid visual structure', () => {
      expect(() => validateVisualProperties('not-an-object')).toThrow('must be an object');
      expect(() => validateVisualProperties(['array'])).toThrow('must be an object');
    });
  });

  describe('checkVisualProperties', () => {
    it('should return valid for correct properties', () => {
      const result = checkVisualProperties({
        backgroundColor: '#ff0000',
        textColor: 'white'
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should collect all errors without throwing', () => {
      const result = checkVisualProperties({
        backgroundColor: 'invalid',
        textColor: '#gg0000'
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
    });
  });

  describe('sanitizeVisualProperties', () => {
    it('should remove invalid properties', () => {
      const visual = {
        backgroundColor: '#ff0000',
        textColor: 'invalid-color',
        hoverBackgroundColor: 'blue'
      };

      const result = sanitizeVisualProperties(visual);
      
      expect(result.backgroundColor).toBe('#ff0000');
      expect(result.textColor).toBeUndefined();
      expect(result.hoverBackgroundColor).toBe('blue');
    });

    it('should return null if all properties invalid', () => {
      const visual = {
        backgroundColor: 'invalid',
        textColor: '#gg0000'
      };

      const result = sanitizeVisualProperties(visual);
      expect(result).toBeNull();
    });
  });

  describe('visualPropertiesToCSS', () => {
    it('should generate CSS string', () => {
      const visual = {
        backgroundColor: '#ff0000',
        textColor: 'white'
      };

      const css = visualPropertiesToCSS(visual);
      expect(css).toBe('background-color: #ff0000; color: white');
    });

    it('should handle partial properties', () => {
      const visual = { backgroundColor: '#ff0000' };
      const css = visualPropertiesToCSS(visual);
      expect(css).toBe('background-color: #ff0000');
    });

    it('should return empty string for null', () => {
      const css = visualPropertiesToCSS(null);
      expect(css).toBe('');
    });
  });

  describe('extractHoverStyles', () => {
    it('should extract hover styles', () => {
      const visual = {
        backgroundColor: '#ff0000',
        hoverBackgroundColor: '#00ff00',
        hoverTextColor: 'black'
      };

      const hover = extractHoverStyles(visual);
      
      expect(hover.backgroundColor).toBe('#00ff00');
      expect(hover.color).toBe('black');
    });

    it('should return null if no hover styles', () => {
      const visual = {
        backgroundColor: '#ff0000',
        textColor: 'white'
      };

      const hover = extractHoverStyles(visual);
      expect(hover).toBeNull();
    });
  });
});
```

## Acceptance Criteria

1. ✅ Comprehensive CSS color validation (hex, rgb, rgba, named)
2. ✅ Clear, helpful error messages for invalid colors
3. ✅ Support for partial visual properties
4. ✅ Non-throwing validation option (checkVisualProperties)
5. ✅ Sanitization utility to clean invalid properties
6. ✅ CSS string generation helper
7. ✅ Hover style extraction utility
8. ✅ Full unit test coverage (>90%)
9. ✅ Exported constants for testing
10. ✅ JSDoc documentation for all functions

## Notes

- The validator is designed to be reusable across different parts of the application
- Error messages are descriptive to help modders fix issues
- The sanitize function allows graceful degradation
- CSS helper functions prepare for UI implementation
- Consider adding color contrast checking in future enhancement

## Related Tickets
- **Depends on**: ACTBUTVIS-001 (Schema definition)
- **Used by**: ACTBUTVIS-002 (DTO), ACTBUTVIS-005 (Loader), ACTBUTVIS-007 (UI)
- **Testing**: ACTBUTVIS-010 (Unit tests)

## References
- Validation Utils: `src/utils/validationUtils.js`
- Error Classes: `src/errors/`
- CSS Color Spec: https://www.w3.org/TR/css-color-3/
- Original Spec: `specs/action-button-visual-customization.spec.md`