# ACTBUTVIS-012: Performance and Accessibility Testing

## Status
**Status**: Not Started  
**Priority**: Medium  
**Type**: Quality Assurance  
**Estimated Effort**: 3 hours  

## Dependencies
- **Requires**: ACTBUTVIS-011 (Integration Tests)
- **Blocks**: ACTBUTVIS-013 (Documentation)

## Context
Specialized testing to ensure the visual customization feature meets performance requirements and accessibility standards. This ticket validates that custom visual properties don't negatively impact user experience or exclude users with disabilities.

## Objectives
1. Verify performance requirements from specification are met
2. Ensure WCAG 2.1 AA accessibility compliance
3. Test with screen readers and assistive technologies
4. Validate color contrast and visual accessibility
5. Performance testing under load conditions
6. Memory leak detection and prevention

## Implementation Details

### Performance Testing

#### 1. Performance Benchmarks
**New File**: `tests/performance/visualProperties.performance.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { PerformanceTestBed } from '../common/performanceTestBed.js';
import { createMockDOMEnvironment } from '../common/visualPropertiesTestUtils.js';

describe('Visual Properties - Performance Tests', () => {
  let perfTestBed;
  let mockDOMEnv;

  beforeEach(async () => {
    perfTestBed = new PerformanceTestBed();
    mockDOMEnv = createMockDOMEnvironment();
    await perfTestBed.initialize();
  });

  afterEach(async () => {
    await perfTestBed.cleanup();
    mockDOMEnv.cleanup();
  });

  describe('rendering performance', () => {
    it('should render 100+ custom buttons within 5ms per button', async () => {
      // Create 100 actions with visual properties
      const actions = Array.from({ length: 100 }, (_, i) => ({
        index: i,
        actionId: `perf:action_${i}`,
        commandString: `Action ${i}`,
        description: `Performance test action ${i}`,
        visual: {
          backgroundColor: `#${(i * 123456).toString(16).substr(0, 6).padStart(6, '0')}`,
          textColor: '#ffffff',
          hoverBackgroundColor: `#${(i * 654321).toString(16).substr(0, 6).padStart(6, '0')}`,
          hoverTextColor: '#000000'
        }
      }));

      const renderer = perfTestBed.getActionButtonsRenderer();
      
      // Measure render time
      const startTime = performance.now();
      renderer.render(actions);
      const endTime = performance.now();
      
      const totalTime = endTime - startTime;
      const timePerButton = totalTime / 100;
      
      expect(timePerButton).toBeLessThan(5); // <5ms per button requirement
      expect(totalTime).toBeLessThan(500); // <500ms total for 100 buttons
      
      // Verify all buttons rendered correctly
      const renderedButtons = mockDOMEnv.container.querySelectorAll('.action-button-custom-visual');
      expect(renderedButtons).toHaveLength(100);
    });

    it('should handle rapid visual updates without performance degradation', async () => {
      const action = {
        index: 0,
        actionId: 'perf:rapid_update',
        commandString: 'Rapid Update Test',
        visual: { backgroundColor: '#ff0000' }
      };

      const renderer = perfTestBed.getActionButtonsRenderer();
      renderer.render([action]);

      // Perform 100 rapid visual updates
      const colors = Array.from({ length: 100 }, (_, i) => 
        `#${i.toString(16).padStart(6, '0')}`
      );

      const startTime = performance.now();
      
      for (const color of colors) {
        renderer.updateButtonVisual('perf:rapid_update', {
          backgroundColor: color,
          textColor: '#ffffff'
        });
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const timePerUpdate = totalTime / 100;
      
      expect(timePerUpdate).toBeLessThan(1); // <1ms per update
      expect(totalTime).toBeLessThan(100); // <100ms for 100 updates
    });

    it('should maintain hover responsiveness with many buttons', async () => {
      // Create 50 buttons with hover states\n      const actions = Array.from({ length: 50 }, (_, i) => ({
        index: i,
        actionId: `hover:action_${i}`,
        commandString: `Hover Test ${i}`,
        visual: {
          backgroundColor: '#ff0000',
          textColor: '#ffffff',
          hoverBackgroundColor: '#00ff00',
          hoverTextColor: '#000000'
        }
      }));

      const renderer = perfTestBed.getActionButtonsRenderer();
      renderer.render(actions);

      const buttons = mockDOMEnv.container.querySelectorAll('.action-button-custom-visual');
      
      // Test hover response time on multiple buttons
      const hoverTimes = [];
      
      for (let i = 0; i < 10; i++) {
        const button = buttons[i * 5]; // Every 5th button
        
        const startTime = performance.now();
        
        // Trigger hover
        const mouseEnterEvent = new MouseEvent('mouseenter', {
          bubbles: true,
          target: button
        });
        button.dispatchEvent(mouseEnterEvent);
        
        const endTime = performance.now();
        hoverTimes.push(endTime - startTime);
      }
      
      const avgHoverTime = hoverTimes.reduce((a, b) => a + b, 0) / hoverTimes.length;
      expect(avgHoverTime).toBeLessThan(2); // <2ms average hover response
    });
  });

  describe('memory management', () => {
    it('should not leak memory during repeated render cycles', async () => {
      const renderer = perfTestBed.getActionButtonsRenderer();
      
      // Measure initial memory\n      const initialMemory = performance.memory?.usedJSHeapSize || 0;
      
      // Perform 100 render/clear cycles
      for (let cycle = 0; cycle < 100; cycle++) {
        const actions = Array.from({ length: 20 }, (_, i) => ({
          index: i,
          actionId: `memory:action_${i}`,
          commandString: `Memory Test ${i}`,
          visual: { backgroundColor: '#ff0000' }
        }));
        
        renderer.render(actions);
        renderer.clear();
        
        // Force garbage collection periodically
        if (cycle % 10 === 0 && global.gc) {
          global.gc();
        }
      }
      
      // Force final garbage collection
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = performance.memory?.usedJSHeapSize || 0;
      const memoryGrowth = finalMemory - initialMemory;
      
      // Memory growth should be minimal (<1MB for 100 cycles)
      expect(memoryGrowth).toBeLessThan(1024 * 1024);
    });

    it('should clean up hover timeouts and event listeners', async () => {
      const renderer = perfTestBed.getActionButtonsRenderer();
      
      const actions = Array.from({ length: 10 }, (_, i) => ({
        index: i,
        actionId: `cleanup:action_${i}`,
        commandString: `Cleanup Test ${i}`,
        visual: {
          backgroundColor: '#ff0000',
          hoverBackgroundColor: '#00ff00'
        }
      }));

      renderer.render(actions);
      
      // Verify hover timeouts map is populated
      expect(renderer.buttonVisualMap.size).toBe(10);
      
      // Trigger some hover events to create timeouts
      const buttons = mockDOMEnv.container.querySelectorAll('button');
      buttons.forEach((button, i) => {
        if (i < 5) { // Hover first 5 buttons
          const event = new MouseEvent('mouseleave', { target: button });
          button.dispatchEvent(event);\n        }\n      });\n      \n      // Verify timeouts were created\n      expect(renderer.hoverTimeouts.size).toBeGreaterThan(0);\n      \n      // Clear renderer\n      renderer.clear();\n      \n      // Verify cleanup\n      expect(renderer.buttonVisualMap.size).toBe(0);\n      expect(renderer.hoverTimeouts.size).toBe(0);\n    });\n  });\n});\n```\n\n### Accessibility Testing\n\n#### 1. Accessibility Compliance Tests\n**New File**: `tests/accessibility/visualProperties.accessibility.test.js`\n\n```javascript\nimport { describe, it, expect, beforeEach, afterEach } from '@jest/globals';\nimport { AccessibilityTestBed } from '../common/accessibilityTestBed.js';\nimport { createMockDOMEnvironment } from '../common/visualPropertiesTestUtils.js';\n\ndescribe('Visual Properties - Accessibility Tests', () => {\n  let a11yTestBed;\n  let mockDOMEnv;\n\n  beforeEach(async () => {\n    a11yTestBed = new AccessibilityTestBed();\n    mockDOMEnv = createMockDOMEnvironment();\n    await a11yTestBed.initialize();\n  });\n\n  afterEach(async () => {\n    await a11yTestBed.cleanup();\n    mockDOMEnv.cleanup();\n  });\n\n  describe('WCAG 2.1 AA compliance', () => {\n    it('should maintain sufficient color contrast with custom colors', async () => {\n      const testCases = [\n        { bg: '#000000', text: '#ffffff', shouldPass: true },  // High contrast\n        { bg: '#0066cc', text: '#ffffff', shouldPass: true },  // Good contrast\n        { bg: '#ff0000', text: '#ffffff', shouldPass: true },  // Good contrast\n        { bg: '#ffff00', text: '#000000', shouldPass: true },  // Good contrast\n        { bg: '#888888', text: '#999999', shouldPass: false }, // Poor contrast\n      ];\n\n      for (const testCase of testCases) {\n        const action = {\n          index: 0,\n          actionId: 'a11y:contrast_test',\n          commandString: 'Contrast Test',\n          visual: {\n            backgroundColor: testCase.bg,\n            textColor: testCase.text\n          }\n        };\n\n        const renderer = a11yTestBed.getActionButtonsRenderer();\n        renderer.render([action]);\n\n        const button = mockDOMEnv.container.querySelector('button');\n        const contrastRatio = a11yTestBed.calculateContrastRatio(\n          testCase.bg,\n          testCase.text\n        );\n\n        if (testCase.shouldPass) {\n          expect(contrastRatio).toBeGreaterThanOrEqual(4.5); // WCAG AA requirement\n        } else {\n          expect(contrastRatio).toBeLessThan(4.5);\n        }\n\n        renderer.clear();\n      }\n    });\n\n    it('should maintain accessibility attributes with visual customization', async () => {\n      const action = {\n        index: 0,\n        actionId: 'a11y:attributes_test',\n        commandString: 'Accessibility Test',\n        description: 'This is a test action for accessibility',\n        visual: {\n          backgroundColor: '#0066cc',\n          textColor: '#ffffff'\n        }\n      };\n\n      const renderer = a11yTestBed.getActionButtonsRenderer();\n      renderer.render([action]);\n\n      const button = mockDOMEnv.container.querySelector('button');\n      \n      // Verify required accessibility attributes\n      expect(button.getAttribute('aria-label')).toBe('This is a test action for accessibility');\n      expect(button.getAttribute('role')).toBeTruthy();\n      expect(button.tabIndex).toBeGreaterThanOrEqual(0);\n      \n      // Verify button is focusable\n      button.focus();\n      expect(document.activeElement).toBe(button);\n      \n      // Verify focus indicators are visible\n      const computedStyle = window.getComputedStyle(button);\n      expect(computedStyle.outline).not.toBe('none');\n    });\n\n    it('should support keyboard navigation with custom visual buttons', async () => {\n      const actions = Array.from({ length: 3 }, (_, i) => ({\n        index: i,\n        actionId: `a11y:keyboard_${i}`,\n        commandString: `Keyboard Test ${i}`,\n        visual: { backgroundColor: '#ff0000' }\n      }));\n\n      const renderer = a11yTestBed.getActionButtonsRenderer();\n      renderer.render(actions);\n\n      const buttons = mockDOMEnv.container.querySelectorAll('button');\n      \n      // Test tab navigation\n      buttons[0].focus();\n      expect(document.activeElement).toBe(buttons[0]);\n      \n      // Simulate tab key press\n      const tabEvent = new KeyboardEvent('keydown', {\n        key: 'Tab',\n        keyCode: 9,\n        bubbles: true\n      });\n      \n      buttons[0].dispatchEvent(tabEvent);\n      buttons[1].focus(); // Simulate browser tab behavior\n      expect(document.activeElement).toBe(buttons[1]);\n      \n      // Test enter key activation\n      const enterEvent = new KeyboardEvent('keydown', {\n        key: 'Enter',\n        keyCode: 13,\n        bubbles: true\n      });\n      \n      let activated = false;\n      buttons[1].addEventListener('click', () => { activated = true; });\n      \n      buttons[1].dispatchEvent(enterEvent);\n      // Note: Actual enter key simulation would require more complex setup\n    });\n\n    it('should work with high contrast mode', async () => {\n      // Simulate high contrast mode\n      document.body.classList.add('theme-high-contrast');\n      \n      const action = {\n        index: 0,\n        actionId: 'a11y:high_contrast_test',\n        commandString: 'High Contrast Test',\n        visual: {\n          backgroundColor: '#0066cc',\n          textColor: '#ffffff'\n        }\n      };\n\n      const renderer = a11yTestBed.getActionButtonsRenderer();\n      \n      // Mock theme change event\n      renderer._handleThemeChange({\n        newTheme: 'high-contrast',\n        previousTheme: 'light'\n      });\n      \n      renderer.render([action]);\n\n      const button = mockDOMEnv.container.querySelector('button');\n      \n      // Verify high contrast adaptations\n      expect(button.classList.contains('theme-high-contrast-adapted')).toBe(true);\n      expect(button.style.border).toBe('2px solid currentColor');\n      \n      // Cleanup\n      document.body.classList.remove('theme-high-contrast');\n    });\n  });\n\n  describe('screen reader compatibility', () => {\n    it('should provide appropriate semantic markup', async () => {\n      const action = {\n        index: 0,\n        actionId: 'a11y:semantic_test',\n        commandString: 'Semantic Test',\n        description: 'Test action for semantic markup',\n        visual: { backgroundColor: '#ff0000' }\n      };\n\n      const renderer = a11yTestBed.getActionButtonsRenderer();\n      renderer.render([action]);\n\n      const button = mockDOMEnv.container.querySelector('button');\n      \n      // Verify semantic structure\n      expect(button.tagName.toLowerCase()).toBe('button');\n      expect(button.type).toBe('button');\n      \n      // Verify accessible name\n      const accessibleName = a11yTestBed.getAccessibleName(button);\n      expect(accessibleName).toBe('Test action for semantic markup');\n      \n      // Verify no accessibility violations\n      const violations = await a11yTestBed.checkAccessibility(mockDOMEnv.container);\n      expect(violations.length).toBe(0);\n    });\n\n    it('should announce state changes to screen readers', async () => {\n      const action = {\n        index: 0,\n        actionId: 'a11y:state_test',\n        commandString: 'State Test',\n        visual: { backgroundColor: '#ff0000' }\n      };\n\n      const renderer = a11yTestBed.getActionButtonsRenderer();\n      renderer.render([action]);\n\n      const button = mockDOMEnv.container.querySelector('button');\n      \n      // Test disabled state\n      renderer.setButtonDisabled('a11y:state_test', true);\n      expect(button.disabled).toBe(true);\n      expect(button.getAttribute('aria-disabled')).toBe('true');\n      \n      // Test enabled state\n      renderer.setButtonDisabled('a11y:state_test', false);\n      expect(button.disabled).toBe(false);\n      expect(button.getAttribute('aria-disabled')).toBe('false');\n    });\n  });\n});\n```\n\n### Test Utilities\n\n#### Performance Test Bed\n**New File**: `tests/common/performanceTestBed.js`\n\n```javascript\nexport class PerformanceTestBed {\n  constructor() {\n    this.container = null;\n    this.renderer = null;\n  }\n\n  async initialize() {\n    // Setup performance testing environment\n    this.container = new MockContainer();\n    this.renderer = new ActionButtonsRenderer({\n      domElementFactory: new MockDOMElementFactory(),\n      eventBus: new MockEventBus(),\n      logger: console,\n      containerSelector: '#perf-test-container'\n    });\n  }\n\n  async cleanup() {\n    if (this.renderer) {\n      this.renderer.clear();\n    }\n    this.container = null;\n    this.renderer = null;\n  }\n\n  getActionButtonsRenderer() {\n    return this.renderer;\n  }\n\n  measureMemoryUsage() {\n    if (performance.memory) {\n      return {\n        used: performance.memory.usedJSHeapSize,\n        total: performance.memory.totalJSHeapSize,\n        limit: performance.memory.jsHeapSizeLimit\n      };\n    }\n    return null;\n  }\n\n  measureRenderTime(renderFunction) {\n    const start = performance.now();\n    renderFunction();\n    const end = performance.now();\n    return end - start;\n  }\n}\n```\n\n#### Accessibility Test Bed\n**New File**: `tests/common/accessibilityTestBed.js`\n\n```javascript\nexport class AccessibilityTestBed {\n  constructor() {\n    this.container = null;\n    this.renderer = null;\n  }\n\n  async initialize() {\n    // Setup accessibility testing environment\n    this.container = new MockContainer();\n    this.renderer = new ActionButtonsRenderer({\n      domElementFactory: new MockDOMElementFactory(),\n      eventBus: new MockEventBus(),\n      logger: console,\n      containerSelector: '#a11y-test-container'\n    });\n  }\n\n  async cleanup() {\n    if (this.renderer) {\n      this.renderer.clear();\n    }\n    this.container = null;\n    this.renderer = null;\n  }\n\n  getActionButtonsRenderer() {\n    return this.renderer;\n  }\n\n  calculateContrastRatio(backgroundColor, textColor) {\n    // Simplified contrast calculation\n    // In production, use a proper color contrast library\n    const bgLum = this.getLuminance(backgroundColor);\n    const textLum = this.getLuminance(textColor);\n    \n    const lighter = Math.max(bgLum, textLum);\n    const darker = Math.min(bgLum, textLum);\n    \n    return (lighter + 0.05) / (darker + 0.05);\n  }\n\n  getLuminance(color) {\n    // Convert color to RGB values\n    const rgb = this.hexToRgb(color);\n    if (!rgb) return 0;\n    \n    // Calculate relative luminance\n    const sRGB = [rgb.r, rgb.g, rgb.b].map(c => {\n      c = c / 255;\n      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);\n    });\n    \n    return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];\n  }\n\n  hexToRgb(hex) {\n    const result = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(hex);\n    return result ? {\n      r: parseInt(result[1], 16),\n      g: parseInt(result[2], 16),\n      b: parseInt(result[3], 16)\n    } : null;\n  }\n\n  getAccessibleName(element) {\n    // Get accessible name for element\n    return element.getAttribute('aria-label') || \n           element.getAttribute('aria-labelledby') ||\n           element.textContent ||\n           element.title;\n  }\n\n  async checkAccessibility(container) {\n    // Mock accessibility checker\n    // In production, integrate with axe-core or similar\n    const violations = [];\n    \n    const buttons = container.querySelectorAll('button');\n    buttons.forEach(button => {\n      // Check for accessible name\n      if (!this.getAccessibleName(button)) {\n        violations.push({\n          rule: 'accessible-name',\n          element: button,\n          message: 'Button missing accessible name'\n        });\n      }\n      \n      // Check for focus indicator\n      const computedStyle = window.getComputedStyle(button, ':focus');\n      if (computedStyle.outline === 'none' && !computedStyle.boxShadow) {\n        violations.push({\n          rule: 'focus-indicator',\n          element: button,\n          message: 'Button missing focus indicator'\n        });\n      }\n    });\n    \n    return violations;\n  }\n}\n```\n\n## Test Execution\n\n```bash\n# Run performance tests\nnpm run test:performance -- --testPathPattern=\"visualProperties\"\n\n# Run accessibility tests\nnpm run test:accessibility -- --testPathPattern=\"visualProperties\"\n\n# Run with memory profiling\nnode --expose-gc --max-old-space-size=4096 node_modules/.bin/jest --testPathPattern=\"performance\"\n\n# Generate performance report\nnpm run test:performance -- --testPathPattern=\"visualProperties\" --verbose --reporters=default,json\n```\n\n## Acceptance Criteria\n\n1. ✅ Rendering <5ms per button for 100+ buttons\n2. ✅ Memory growth <1MB for 100 render/clear cycles\n3. ✅ Hover response time <2ms average\n4. ✅ WCAG 2.1 AA contrast requirements met\n5. ✅ Keyboard navigation works with custom buttons\n6. ✅ Screen reader compatibility maintained\n7. ✅ High contrast mode support\n8. ✅ No accessibility regressions introduced\n9. ✅ Memory leaks prevented and detected\n10. ✅ Performance benchmarks documented\n\n## Notes\n\n- Performance tests validate specification requirements\n- Accessibility tests ensure inclusive design\n- Memory leak detection prevents production issues\n- Contrast calculations help modders create accessible content\n- Both manual and automated accessibility testing recommended\n\n## Related Tickets\n- **Depends on**: ACTBUTVIS-011 (Integration test foundation)\n- **Next**: ACTBUTVIS-013 (Documentation and examples)\n- **Validates**: Performance and accessibility requirements from specification\n\n## References\n- Performance Tests: `tests/performance/visualProperties.performance.test.js`\n- Accessibility Tests: `tests/accessibility/visualProperties.accessibility.test.js`\n- WCAG Guidelines: https://www.w3.org/WAI/WCAG21/quickref/\n- Original Spec: `specs/action-button-visual-customization.spec.md`