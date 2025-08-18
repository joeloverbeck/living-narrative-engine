# ACTBUTVIS-011: Integration Tests for End-to-End Flow

## Status

**Status**: Not Started  
**Priority**: High  
**Type**: Integration Testing  
**Estimated Effort**: 3 hours

## Dependencies

- **Requires**: ACTBUTVIS-010 (Unit Tests)
- **Blocks**: ACTBUTVIS-012 (Performance Testing)

## Context

Integration tests to verify that visual properties flow correctly through the entire application pipeline, from action JSON files through to rendered DOM elements. These tests ensure all components work together properly and catch integration issues that unit tests might miss.

## Objectives

1. Test complete pipeline from JSON to DOM rendering
2. Verify visual properties persist through action processing stages
3. Test theme switching with custom visual properties
4. Validate hover state interactions work end-to-end
5. Ensure error handling works across component boundaries

## Implementation Details

### Integration Test Structure

#### 1. End-to-End Action Processing Test

**New File**: `tests/integration/actions/visualPropertiesFlow.integration.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { IntegrationTestBed } from '../../common/integrationTestBed.js';
import { createMockDOMEnvironment } from '../../common/visualPropertiesTestUtils.js';

describe('Visual Properties - End-to-End Integration', () => {
  let testBed;
  let mockDOMEnv;

  beforeEach(async () => {
    testBed = new IntegrationTestBed();
    mockDOMEnv = createMockDOMEnvironment();
    await testBed.initialize();
  });

  afterEach(async () => {
    await testBed.cleanup();
    mockDOMEnv.cleanup();
  });

  describe('complete pipeline flow', () => {
    it('should process action with visual properties from JSON to DOM', async () => {
      // 1. Create action with visual properties
      const actionData = {
        id: 'test_visual_action',
        name: 'Visual Test Action',
        template: 'perform visual test on {target}',
        visual: {
          backgroundColor: '#ff6b35',
          textColor: '#ffffff',
          hoverBackgroundColor: '#e55a2b',
          hoverTextColor: '#f0f0f0',
        },
        conditions: [],
        effects: [],
      };

      // 2. Load action through the system
      await testBed.loadAction(actionData, 'test_mod');

      // 3. Verify action is in registry with visual properties
      const loadedAction = testBed.dataRegistry.get(
        'actions.test_mod:test_visual_action'
      );
      expect(loadedAction).toBeDefined();
      expect(loadedAction.visual).toEqual(actionData.visual);

      // 4. Process action through pipeline
      const turnContext = testBed.createTurnContext({
        actor: 'player',
        availableActions: ['test_mod:test_visual_action'],
      });

      const processedActions = await testBed.processTurnActions(turnContext);

      // 5. Verify visual properties survive pipeline processing
      const processedAction = processedActions.find(
        (a) => a.actionId === 'test_mod:test_visual_action'
      );
      expect(processedAction.visual).toEqual(actionData.visual);

      // 6. Render actions to DOM
      const renderer = testBed.getActionButtonsRenderer();
      renderer.render(processedActions);

      // 7. Verify DOM elements have correct visual styles
      const button = mockDOMEnv.container.querySelector(
        '[data-action-id="test_mod:test_visual_action"]'
      );
      expect(button).toBeTruthy();
      expect(button.style.backgroundColor).toContain('255, 107, 53'); // RGB of #ff6b35
      expect(button.style.color).toContain('255, 255, 255'); // RGB of #ffffff
      expect(button.dataset.hoverBg).toBe('#e55a2b');
      expect(button.dataset.hoverText).toBe('#f0f0f0');
    });

    it('should handle action without visual properties in mixed batch', async () => {
      const actionsData = [
        {
          id: 'action_with_visual',
          name: 'Visual Action',
          template: 'visual action',
          visual: { backgroundColor: '#ff0000' },
        },
        {
          id: 'action_without_visual',
          name: 'Normal Action',
          template: 'normal action',
          // No visual property
        },
      ];

      // Load both actions
      for (const actionData of actionsData) {
        await testBed.loadAction(actionData, 'test_mod');
      }

      // Process both actions
      const turnContext = testBed.createTurnContext({
        actor: 'player',
        availableActions: [
          'test_mod:action_with_visual',
          'test_mod:action_without_visual',
        ],
      });

      const processedActions = await testBed.processTurnActions(turnContext);

      // Render both actions
      const renderer = testBed.getActionButtonsRenderer();
      renderer.render(processedActions);

      // Verify visual action has styles
      const visualButton = mockDOMEnv.container.querySelector(
        '[data-action-id="test_mod:action_with_visual"]'
      );
      expect(visualButton.style.backgroundColor).toContain('255, 0, 0');
      expect(
        visualButton.classList.contains('action-button-custom-visual')
      ).toBe(true);

      // Verify normal action has no custom styles
      const normalButton = mockDOMEnv.container.querySelector(
        '[data-action-id="test_mod:action_without_visual"]'
      );
      expect(normalButton.style.backgroundColor).toBe('');
      expect(
        normalButton.classList.contains('action-button-custom-visual')
      ).toBe(false);
    });
  });

  describe('error handling integration', () => {
    it('should gracefully handle invalid visual properties in pipeline', async () => {
      const actionData = {
        id: 'invalid_visual_action',
        name: 'Invalid Visual Action',
        template: 'test action',
        visual: {
          backgroundColor: 'invalid-color',
          textColor: '#ffffff',
        },
      };

      // Should not throw during loading
      await expect(
        testBed.loadAction(actionData, 'test_mod')
      ).resolves.not.toThrow();

      // Verify action loads but visual properties are cleaned up
      const loadedAction = testBed.dataRegistry.get(
        'actions.test_mod:invalid_visual_action'
      );
      expect(loadedAction).toBeDefined();
      expect(loadedAction.visual).toBeNull(); // Invalid properties removed

      // Should still render normally
      const turnContext = testBed.createTurnContext({
        actor: 'player',
        availableActions: ['test_mod:invalid_visual_action'],
      });

      const processedActions = await testBed.processTurnActions(turnContext);
      const renderer = testBed.getActionButtonsRenderer();

      expect(() => renderer.render(processedActions)).not.toThrow();
    });

    it('should handle visual properties validation errors in formatting stage', async () => {
      // Mock a scenario where visual properties become invalid during processing
      const actionData = {
        id: 'test_action',
        name: 'Test Action',
        template: 'test',
        visual: { backgroundColor: '#ff0000' },
      };

      await testBed.loadAction(actionData, 'test_mod');

      // Spy on formatting stage to inject invalid visual data
      const formattingStage = testBed.getActionFormattingStage();
      const originalExecute = formattingStage.execute.bind(formattingStage);

      formattingStage.execute = jest.fn((context) => {
        // Corrupt visual data during processing
        if (context.actionData?.visual) {
          context.actionData.visual.backgroundColor = 'corrupted-color';
        }
        return originalExecute(context);
      });

      const turnContext = testBed.createTurnContext({
        actor: 'player',
        availableActions: ['test_mod:test_action'],
      });

      // Should handle the error gracefully
      const processedActions = await testBed.processTurnActions(turnContext);
      expect(processedActions).toHaveLength(1);

      // Visual properties should be null due to validation failure
      expect(processedActions[0].visual).toBeNull();
    });
  });

  describe('theme integration', () => {
    it('should update visual buttons when theme changes', async () => {
      const actionData = {
        id: 'theme_test_action',
        name: 'Theme Test',
        template: 'test',
        visual: {
          backgroundColor: '#ff0000',
          textColor: '#ffffff',
        },
      };

      await testBed.loadAction(actionData, 'test_mod');

      const turnContext = testBed.createTurnContext({
        actor: 'player',
        availableActions: ['test_mod:theme_test_action'],
      });

      const processedActions = await testBed.processTurnActions(turnContext);
      const renderer = testBed.getActionButtonsRenderer();
      renderer.render(processedActions);

      const button = mockDOMEnv.container.querySelector(
        '[data-action-id="test_mod:theme_test_action"]'
      );

      // Initial theme (light)
      expect(button.style.getPropertyValue('--selection-color')).toBe('');

      // Trigger theme change to dark
      testBed.eventBus.emit('THEME_CHANGED', {
        newTheme: 'dark',
        previousTheme: 'light',
      });

      // Wait for theme change processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify theme-specific adaptations
      expect(button.classList.contains('theme-dark-adapted')).toBe(true);
      expect(button.style.getPropertyValue('--selection-color')).toBe(
        '#4CAF50'
      );
    });
  });

  describe('hover state integration', () => {
    it('should apply hover states to rendered buttons', async () => {
      const actionData = {
        id: 'hover_test_action',
        name: 'Hover Test',
        template: 'test',
        visual: {
          backgroundColor: '#ff0000',
          textColor: '#ffffff',
          hoverBackgroundColor: '#00ff00',
          hoverTextColor: '#000000',
        },
      };

      await testBed.loadAction(actionData, 'test_mod');

      const turnContext = testBed.createTurnContext({
        actor: 'player',
        availableActions: ['test_mod:hover_test_action'],
      });

      const processedActions = await testBed.processTurnActions(turnContext);
      const renderer = testBed.getActionButtonsRenderer();
      renderer.render(processedActions);

      const button = mockDOMEnv.container.querySelector(
        '[data-action-id="test_mod:hover_test_action"]'
      );

      // Verify hover listeners are attached
      expect(button.dataset.hasCustomHover).toBe('true');

      // Simulate hover
      const mouseEnterEvent = new MouseEvent('mouseenter', {
        bubbles: true,
        cancelable: true,
      });

      button.dispatchEvent(mouseEnterEvent);

      // Verify hover styles are applied
      expect(button.style.backgroundColor).toBe('#00ff00');
      expect(button.style.color).toBe('#000000');
      expect(button.classList.contains('action-button-hovering')).toBe(true);

      // Simulate mouse leave
      const mouseLeaveEvent = new MouseEvent('mouseleave', {
        bubbles: true,
        cancelable: true,
      });

      button.dispatchEvent(mouseLeaveEvent);

      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 60));

      // Verify original styles are restored
      expect(button.style.backgroundColor).toBe('#ff0000');
      expect(button.style.color).toBe('#ffffff');
      expect(button.classList.contains('action-button-hovering')).toBe(false);
    });
  });

  describe('performance integration', () => {
    it('should handle large batches of visual actions efficiently', async () => {
      // Create 50 actions with visual properties
      const actions = [];
      for (let i = 0; i < 50; i++) {
        actions.push({
          id: `perf_action_${i}`,
          name: `Performance Action ${i}`,
          template: `action ${i}`,
          visual: {
            backgroundColor: `#${i.toString(16).padStart(6, '0')}`,
            textColor: '#ffffff',
          },
        });
      }

      // Load all actions
      const loadStart = performance.now();
      for (const actionData of actions) {
        await testBed.loadAction(actionData, 'test_mod');
      }
      const loadEnd = performance.now();

      expect(loadEnd - loadStart).toBeLessThan(200); // <200ms to load 50 actions

      // Process all actions
      const turnContext = testBed.createTurnContext({
        actor: 'player',
        availableActions: actions.map((a) => `test_mod:${a.id}`),
      });

      const processStart = performance.now();
      const processedActions = await testBed.processTurnActions(turnContext);
      const processEnd = performance.now();

      expect(processEnd - processStart).toBeLessThan(100); // <100ms to process 50 actions

      // Render all actions
      const renderer = testBed.getActionButtonsRenderer();
      const renderStart = performance.now();
      renderer.render(processedActions);
      const renderEnd = performance.now();

      expect(renderEnd - renderStart).toBeLessThan(150); // <150ms to render 50 buttons

      // Verify all buttons rendered correctly
      const buttons = mockDOMEnv.container.querySelectorAll(
        '.action-button-custom-visual'
      );
      expect(buttons).toHaveLength(50);
    });
  });
});
```

### Integration Test Configuration

#### Test Environment Setup

**Update**: `tests/common/integrationTestBed.js`

```javascript
class IntegrationTestBed {
  // Existing methods...

  /**
   * Load action through the complete pipeline
   */
  async loadAction(actionData, modId) {
    const actionLoader = this.container.get('IActionLoader');
    return await actionLoader.loadItem(actionData, modId);
  }

  /**
   * Process turn actions through formatting pipeline
   */
  async processTurnActions(turnContext) {
    const actionPipelineOrchestrator = this.container.get(
      'IActionPipelineOrchestrator'
    );
    const turnActionFactory = this.container.get('ITurnActionFactory');

    // Create turn actions
    const turnActions = turnActionFactory.createTurnActions(
      turnContext.availableActions,
      turnContext
    );

    // Process through pipeline
    const processedActions = [];
    for (const turnAction of turnActions) {
      const result = await actionPipelineOrchestrator.process(
        turnAction,
        turnContext
      );
      if (result.success) {
        processedActions.push(result.actionComposite);
      }
    }

    return processedActions;
  }

  /**
   * Get action buttons renderer
   */
  getActionButtonsRenderer() {
    return this.container.get('IActionButtonsRenderer');
  }

  /**
   * Get action formatting stage
   */
  getActionFormattingStage() {
    return this.container.get('IActionFormattingStage');
  }

  /**
   * Create turn context for testing
   */
  createTurnContext({ actor, target, availableActions = [] }) {
    return {
      actor,
      target,
      availableActions,
      turnNumber: 1,
      timestamp: Date.now(),
    };
  }
}
```

## Test Execution

```bash
# Run integration tests
npm run test:integration -- --testPathPattern="visualProperties"

# Run with verbose output
npm run test:integration -- --testPathPattern="visualProperties" --verbose

# Run performance integration tests
npm run test:integration -- --testNamePattern="performance integration"
```

## Acceptance Criteria

1. ✅ Complete pipeline flow tested from JSON to DOM
2. ✅ Visual properties survive all processing stages
3. ✅ Mixed batches (with and without visual props) work correctly
4. ✅ Error handling works across component boundaries
5. ✅ Theme changes update visual buttons correctly
6. ✅ Hover states work end-to-end
7. ✅ Performance requirements met for large batches
8. ✅ Memory management verified across components
9. ✅ Integration test bed supports visual properties testing
10. ✅ All integration tests pass consistently

## Notes

- Integration tests catch issues unit tests miss
- Performance tests ensure scalability
- Error handling tests verify graceful degradation
- Theme integration tests ensure compatibility
- Test bed extensions support comprehensive testing

## Related Tickets

- **Depends on**: ACTBUTVIS-010 (Unit tests foundation)
- **Next**: ACTBUTVIS-012 (Performance testing)
- **Validates**: All ACTBUTVIS-001 through ACTBUTVIS-009 implementations

## References

- Integration Test: `tests/integration/actions/visualPropertiesFlow.integration.test.js`
- Test Bed: `tests/common/integrationTestBed.js`
- Test Utils: `tests/common/visualPropertiesTestUtils.js`
- Original Spec: `specs/action-button-visual-customization.spec.md`
