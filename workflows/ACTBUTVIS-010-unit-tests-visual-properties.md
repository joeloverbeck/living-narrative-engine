# ACTBUTVIS-010: Unit Tests for Visual Properties

## Status

**Status**: Not Started  
**Priority**: High  
**Type**: Testing Implementation  
**Estimated Effort**: 4 hours

## Dependencies

- **Requires**: All ACTBUTVIS-001 through ACTBUTVIS-009 (Complete implementation)
- **Blocks**: ACTBUTVIS-011 (Integration Tests)

## Context

Comprehensive unit testing for all visual properties functionality. This ticket consolidates and completes unit tests across all components that were started in previous tickets, ensuring complete test coverage for the visual customization feature.

## Objectives

1. Achieve >90% test coverage for visual properties code
2. Test all edge cases and error conditions
3. Validate color format handling
4. Test theme compatibility
5. Ensure performance requirements are met in tests
6. Create comprehensive test utilities

## Test Implementation

### Test Utilities

**New File**: `tests/common/visualPropertiesTestUtils.js`

```javascript
/**
 * Test utilities for visual properties testing
 */

export const VALID_COLORS = {
  hex3: '#f00',
  hex6: '#ff0000',
  hexUpper: '#FF0000',
  rgb: 'rgb(255, 0, 0)',
  rgbSpaces: 'rgb( 255 , 0 , 0 )',
  rgba: 'rgba(255, 0, 0, 0.5)',
  named: 'red',
  namedExtended: 'darkslateblue',
};

export const INVALID_COLORS = {
  hexInvalid: '#gg0000',
  hexWrongLength: '#12345',
  rgbOutOfRange: 'rgb(256, 0, 0)',
  rgbaMalformed: 'rgba(255, 0, 0)',
  notAColor: 'notacolor',
  incomplete: '#',
  empty: '',
};

export const createMockActionComposite = (overrides = {}) => ({
  index: 0,
  actionId: 'test:action',
  commandString: 'Test Action',
  params: {},
  description: 'Test action description',
  visual: null,
  ...overrides,
});

export const createMockButton = (visual = null) => {
  const button = document.createElement('button');
  button.className = 'action-button';

  if (visual) {
    button.classList.add('action-button-custom-visual');
    if (visual.backgroundColor) {
      button.style.backgroundColor = visual.backgroundColor;
      button.dataset.customBg = visual.backgroundColor;
    }
    if (visual.textColor) {
      button.style.color = visual.textColor;
      button.dataset.customText = visual.textColor;
    }
    if (visual.hoverBackgroundColor || visual.hoverTextColor) {
      button.dataset.hasCustomHover = 'true';
      button.dataset.hoverBg = visual.hoverBackgroundColor || '';
      button.dataset.hoverText = visual.hoverTextColor || '';
      button.dataset.originalBg = visual.backgroundColor || '';
      button.dataset.originalText = visual.textColor || '';
    }
  }

  return button;
};

export const assertButtonHasVisualStyles = (button, expectedVisual) => {
  if (expectedVisual.backgroundColor) {
    expect(button.style.backgroundColor).toContain(
      expectedVisual.backgroundColor.replace('#', '')
    );
  }

  if (expectedVisual.textColor) {
    expect(button.style.color).toContain(
      expectedVisual.textColor.replace('#', '')
    );
  }

  if (expectedVisual.hoverBackgroundColor || expectedVisual.hoverTextColor) {
    expect(button.dataset.hasCustomHover).toBe('true');
  }
};

export const createMockDOMEnvironment = () => {
  const container = document.createElement('div');
  container.id = 'test-container';
  document.body.appendChild(container);

  return {
    container,
    cleanup: () => {
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
    },
  };
};

export const waitForAsyncOperations = () => {
  return new Promise((resolve) => setTimeout(resolve, 0));
};
```

### Complete Test Suites

#### 1. Visual Properties Validator Tests

**File**: `tests/unit/validation/visualPropertiesValidator.test.js`
Already created in ACTBUTVIS-004, but ensure coverage includes:

```javascript
describe('Visual Properties Validator - Complete Coverage', () => {
  // Tests from ACTBUTVIS-004 plus additional coverage tests

  describe('edge cases', () => {
    it('should handle null and undefined inputs', () => {
      expect(validateVisualProperties(null)).toBeNull();
      expect(validateVisualProperties(undefined)).toBeNull();
    });

    it('should handle empty objects', () => {
      const result = validateVisualProperties({});
      expect(result).toEqual({});
    });

    it('should warn about unknown properties', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      validateVisualProperties({
        backgroundColor: '#ff0000',
        unknownProp: 'value',
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown visual properties')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('performance tests', () => {
    it('should validate 1000 colors quickly', () => {
      const start = performance.now();

      for (let i = 0; i < 1000; i++) {
        validateCSSColor('#ff0000');
      }

      const end = performance.now();
      expect(end - start).toBeLessThan(100); // <100ms for 1000 validations
    });
  });
});
```

#### 2. ActionComposite DTO Tests

**File**: `tests/unit/turns/dtos/actionComposite.test.js`

```javascript
describe('ActionComposite - Complete Visual Properties Coverage', () => {
  // Include tests from ACTBUTVIS-002 plus:

  describe('immutability tests', () => {
    it('should deeply freeze visual properties', () => {
      const composite = createActionComposite({
        index: 0,
        actionId: 'test:action',
        commandString: 'test',
        visual: {
          backgroundColor: '#ff0000',
          nested: { prop: 'value' },
        },
      });

      expect(Object.isFrozen(composite.visual)).toBe(true);
      expect(Object.isFrozen(composite.visual.nested)).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should provide clear error messages for validation failures', () => {
      expect(() =>
        createActionComposite({
          index: 0,
          actionId: 'test:action',
          commandString: 'test',
          visual: { backgroundColor: 'invalid' },
        })
      ).toThrow(/Invalid backgroundColor/);
    });
  });
});
```

#### 3. ActionButtonsRenderer Tests

**File**: `tests/unit/domUI/actionButtonsRenderer.test.js`

```javascript
describe('ActionButtonsRenderer - Complete Coverage', () => {
  let renderer;
  let mockDOMEnv;

  beforeEach(() => {
    mockDOMEnv = createMockDOMEnvironment();

    renderer = new ActionButtonsRenderer({
      domElementFactory: mockDOMElementFactory,
      eventBus: mockEventBus,
      logger: mockLogger,
      containerSelector: '#test-container',
    });
  });

  afterEach(() => {
    mockDOMEnv.cleanup();
  });

  describe('performance tests', () => {
    it('should render 100 custom buttons quickly', () => {
      const actions = Array.from({ length: 100 }, (_, i) =>
        createMockActionComposite({
          actionId: `test:action${i}`,
          visual: { backgroundColor: '#ff0000' },
        })
      );

      const start = performance.now();
      renderer.render(actions);
      const end = performance.now();

      expect(end - start).toBeLessThan(100); // <100ms for 100 buttons
    });

    it('should handle rapid visual updates efficiently', () => {
      const composite = createMockActionComposite({
        visual: { backgroundColor: '#ff0000' },
      });

      renderer.render([composite]);

      const start = performance.now();
      for (let i = 0; i < 50; i++) {
        renderer.updateButtonVisual('test:action', {
          backgroundColor: `#${i.toString(16).padStart(6, '0')}`,
        });
      }
      const end = performance.now();

      expect(end - start).toBeLessThan(50); // <50ms for 50 updates
    });
  });

  describe('memory management', () => {
    it('should clean up visual mappings on clear', () => {
      const composite = createMockActionComposite({
        visual: { backgroundColor: '#ff0000' },
      });

      renderer.render([composite]);
      expect(renderer.buttonVisualMap.size).toBe(1);

      renderer.clear();
      expect(renderer.buttonVisualMap.size).toBe(0);
    });

    it('should clean up hover timeouts on clear', () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

      renderer.hoverTimeouts.set('button1', 123);
      renderer.hoverTimeouts.set('button2', 456);

      renderer.clear();

      expect(clearTimeoutSpy).toHaveBeenCalledWith(123);
      expect(clearTimeoutSpy).toHaveBeenCalledWith(456);
    });
  });

  describe('error recovery', () => {
    it('should handle DOM manipulation errors gracefully', () => {
      // Mock DOM error
      const mockContainer = {
        appendChild: jest.fn(() => {
          throw new Error('DOM Error');
        }),
      };

      renderer.getOrCreateContainer = jest.fn(() => mockContainer);

      expect(() => {
        renderer.render([createMockActionComposite()]);
      }).not.toThrow();

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('should maintain aria-label with visual customization', () => {
      const composite = createMockActionComposite({
        description: 'Test Description',
        visual: { backgroundColor: '#ff0000' },
      });

      renderer.render([composite]);

      const button = mockDOMEnv.container.querySelector('button');
      expect(button.getAttribute('aria-label')).toBe('Test Description');
    });

    it('should ensure focus styles work with custom colors', () => {
      const composite = createMockActionComposite({
        visual: { backgroundColor: '#ff0000', textColor: '#ffffff' },
      });

      renderer.render([composite]);

      const button = mockDOMEnv.container.querySelector('button');
      button.focus();

      const computedStyle = window.getComputedStyle(button);
      expect(computedStyle.outline).toBeTruthy();
    });
  });
});
```

### Test Configuration

#### Jest Configuration for Visual Properties

**Update**: `jest.config.unit.js`

```javascript
module.exports = {
  // Existing configuration...

  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/*.spec.js',
  ],

  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },

    // Specific thresholds for visual properties code
    'src/validation/visualPropertiesValidator.js': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },

    'src/turns/dtos/actionComposite.js': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },

    'src/domUI/actionButtonsRenderer.js': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
  },
};
```

## Test Execution Commands

```bash
# Run all visual properties tests
npm run test:unit -- --testPathPattern="visual"

# Run tests with coverage
npm run test:unit -- --coverage --testPathPattern="visual"

# Run performance tests
npm run test:unit -- --testNamePattern="performance"

# Run accessibility tests
npm run test:unit -- --testNamePattern="accessibility"
```

## Acceptance Criteria

1. ✅ >90% code coverage for all visual properties components
2. ✅ All color validation edge cases are tested
3. ✅ Performance requirements are verified in tests
4. ✅ Memory management is tested (no leaks)
5. ✅ Error handling and recovery scenarios are covered
6. ✅ Accessibility features are tested
7. ✅ Theme compatibility is tested
8. ✅ Hover state management is fully tested
9. ✅ Test utilities enable easy test creation
10. ✅ All tests pass consistently

## Notes

- Focus on edge cases and error conditions
- Performance tests ensure feature scales properly
- Accessibility tests ensure inclusive design
- Memory management tests prevent leaks
- Test utilities make maintenance easier

## Related Tickets

- **Consolidates**: Testing requirements from ACTBUTVIS-001 through ACTBUTVIS-009
- **Next**: ACTBUTVIS-011 (Integration tests)

## References

- Test Utilities: `tests/common/visualPropertiesTestUtils.js`
- All component test files updated with visual properties coverage
- Original Spec: `specs/action-button-visual-customization.spec.md`
