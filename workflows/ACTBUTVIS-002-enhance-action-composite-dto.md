# ACTBUTVIS-002: Enhance ActionComposite DTO

## Status
**Status**: Not Started  
**Priority**: High  
**Type**: Data Model Enhancement  
**Estimated Effort**: 3 hours  

## Dependencies
- **Requires**: ACTBUTVIS-001 (Action Schema Update)
- **Blocks**: ACTBUTVIS-003, ACTBUTVIS-007, ACTBUTVIS-010

## Context
The ActionComposite DTO is the data transfer object that carries action information through the application. It currently doesn't support visual properties. This ticket extends the DTO to carry visual customization data from the action definitions through to the UI rendering layer.

## Objectives
1. Extend the ActionComposite DTO to include visual properties
2. Add validation for visual properties within the DTO
3. Ensure immutability of visual data
4. Maintain backward compatibility for actions without visual properties

## Implementation Details

### File Modifications

#### 1. Update ActionComposite DTO
**File**: `src/turns/dtos/actionComposite.js`

**Current Structure Analysis**:
- The file likely uses a factory function pattern (`createActionComposite`)
- It includes validation using utility functions like `assertNonBlankString` and `assertPresent`
- The DTO is frozen for immutability

**Changes Required**:

```javascript
// Add to imports if not present
import { assertNonBlankString, assertPresent } from '../../utils/validationUtils.js';

// Update the createActionComposite function
export function createActionComposite({
  index,
  actionId,
  commandString,
  params = {},
  description = '',
  visual = null, // NEW: Optional visual properties parameter
}) {
  // Existing validation
  assertNonBlankString(actionId, 'ActionComposite requires actionId');
  assertPresent(commandString, 'ActionComposite requires commandString');

  // NEW: Validate visual properties if provided
  if (visual) {
    validateVisualProperties(visual);
  }

  // Return immutable object with visual property
  return Object.freeze({
    index,
    actionId,
    commandString,
    params: Object.freeze(params),
    description,
    visual: visual ? Object.freeze(visual) : null, // NEW: Frozen visual object
  });
}

// NEW: Visual properties validation helper
function validateVisualProperties(visual) {
  // Define the valid CSS color pattern
  const validColorPattern =
    /^(#([0-9A-Fa-f]{3}){1,2}|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)|rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)|[a-zA-Z]+)$/;

  // Validate backgroundColor if present
  if (visual.backgroundColor) {
    if (!validColorPattern.test(visual.backgroundColor)) {
      throw new Error(
        `Invalid backgroundColor in visual properties: ${visual.backgroundColor}. ` +
        `Must be a valid CSS color (hex, rgb, rgba, or named color).`
      );
    }
  }

  // Validate textColor if present
  if (visual.textColor) {
    if (!validColorPattern.test(visual.textColor)) {
      throw new Error(
        `Invalid textColor in visual properties: ${visual.textColor}. ` +
        `Must be a valid CSS color (hex, rgb, rgba, or named color).`
      );
    }
  }

  // Validate hoverBackgroundColor if present
  if (visual.hoverBackgroundColor) {
    if (!validColorPattern.test(visual.hoverBackgroundColor)) {
      throw new Error(
        `Invalid hoverBackgroundColor in visual properties: ${visual.hoverBackgroundColor}. ` +
        `Must be a valid CSS color (hex, rgb, rgba, or named color).`
      );
    }
  }

  // Validate hoverTextColor if present
  if (visual.hoverTextColor) {
    if (!validColorPattern.test(visual.hoverTextColor)) {
      throw new Error(
        `Invalid hoverTextColor in visual properties: ${visual.hoverTextColor}. ` +
        `Must be a valid CSS color (hex, rgb, rgba, or named color).`
      );
    }
  }

  // Warn about unknown properties (future-proofing)
  const knownProperties = ['backgroundColor', 'textColor', 'hoverBackgroundColor', 'hoverTextColor'];
  const providedProperties = Object.keys(visual);
  const unknownProperties = providedProperties.filter(prop => !knownProperties.includes(prop));
  
  if (unknownProperties.length > 0) {
    console.warn(
      `Unknown visual properties will be ignored: ${unknownProperties.join(', ')}`
    );
  }
}

// Export the validation function for testing purposes
export { validateVisualProperties };
```

### Additional Considerations

#### 1. Type Definitions (JSDoc)
Add JSDoc type definitions for better IDE support:

```javascript
/**
 * @typedef {Object} VisualProperties
 * @property {string} [backgroundColor] - CSS color for button background
 * @property {string} [textColor] - CSS color for button text
 * @property {string} [hoverBackgroundColor] - CSS color for hover background
 * @property {string} [hoverTextColor] - CSS color for hover text
 */

/**
 * Creates an immutable ActionComposite object
 * @param {Object} config
 * @param {number} config.index - Action index
 * @param {string} config.actionId - Unique action identifier
 * @param {string} config.commandString - Formatted command string
 * @param {Object} [config.params] - Action parameters
 * @param {string} [config.description] - Action description
 * @param {VisualProperties} [config.visual] - Visual customization properties
 * @returns {Object} Frozen ActionComposite object
 */
```

#### 2. Backward Compatibility
Ensure the DTO handles:
- Actions without any visual property (visual = null)
- Actions with partial visual properties (only backgroundColor, for example)
- Legacy code that doesn't pass the visual parameter

#### 3. Performance Considerations
- Color validation regex is compiled once (not in the validation function)
- Object.freeze is used consistently for immutability
- Validation is performed only when visual properties are present

### Testing Requirements

#### Unit Tests
**File**: `tests/unit/turns/dtos/actionComposite.test.js`

```javascript
describe('ActionComposite - Visual Properties', () => {
  describe('creation with visual properties', () => {
    it('should create composite with valid visual properties', () => {
      const composite = createActionComposite({
        index: 0,
        actionId: 'test:action',
        commandString: 'test command',
        visual: {
          backgroundColor: '#ff0000',
          textColor: '#ffffff'
        }
      });
      
      expect(composite.visual).toBeDefined();
      expect(composite.visual.backgroundColor).toBe('#ff0000');
      expect(composite.visual.textColor).toBe('#ffffff');
    });

    it('should create composite without visual properties', () => {
      const composite = createActionComposite({
        index: 0,
        actionId: 'test:action',
        commandString: 'test command'
      });
      
      expect(composite.visual).toBeNull();
    });

    it('should freeze visual properties object', () => {
      const composite = createActionComposite({
        index: 0,
        actionId: 'test:action',
        commandString: 'test command',
        visual: { backgroundColor: '#ff0000' }
      });
      
      expect(Object.isFrozen(composite.visual)).toBe(true);
    });
  });

  describe('visual properties validation', () => {
    it('should accept valid hex colors', () => {
      expect(() => validateVisualProperties({
        backgroundColor: '#ff0000',
        textColor: '#fff'
      })).not.toThrow();
    });

    it('should accept valid rgb colors', () => {
      expect(() => validateVisualProperties({
        backgroundColor: 'rgb(255, 0, 0)',
        textColor: 'rgba(255, 255, 255, 0.5)'
      })).not.toThrow();
    });

    it('should accept valid named colors', () => {
      expect(() => validateVisualProperties({
        backgroundColor: 'red',
        textColor: 'darkblue'
      })).not.toThrow();
    });

    it('should reject invalid color formats', () => {
      expect(() => validateVisualProperties({
        backgroundColor: '#gg0000'
      })).toThrow('Invalid backgroundColor');

      expect(() => validateVisualProperties({
        textColor: 'notacolor'
      })).toThrow('Invalid textColor');
    });
  });
});
```

## Acceptance Criteria

1. ✅ ActionComposite DTO accepts optional visual property parameter
2. ✅ Visual properties are validated when provided
3. ✅ Visual properties object is immutable (frozen)
4. ✅ DTO remains backward compatible (works without visual parameter)
5. ✅ Invalid color formats throw descriptive errors
6. ✅ All four color properties are supported (backgroundColor, textColor, hoverBackgroundColor, hoverTextColor)
7. ✅ Unit tests cover all validation scenarios
8. ✅ JSDoc type definitions are added for IDE support

## Notes

- The validation function is exported for unit testing purposes
- Consider extracting the color validation regex to a shared utility if used elsewhere
- The validation provides clear error messages for debugging
- Warning for unknown properties helps with future compatibility

## Related Tickets
- **Depends on**: ACTBUTVIS-001 (Schema definition)
- **Next**: ACTBUTVIS-003 (Pipeline integration)
- **Testing**: ACTBUTVIS-010 (Unit tests)

## References
- DTO Location: `src/turns/dtos/actionComposite.js`
- Validation Utils: `src/utils/validationUtils.js`
- Original Spec: `specs/action-button-visual-customization.spec.md`