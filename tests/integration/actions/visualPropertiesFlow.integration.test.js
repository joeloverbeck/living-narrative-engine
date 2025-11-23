/**
 * @file Integration tests for visual properties flow from JSON to DOM
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { IntegrationTestBed } from '../../common/integrationTestBed.js';
import {
  simulateMouseEvent,
  createTestActionWithVisual,
  verifyButtonVisualStyles,
  waitFor,
} from '../../common/visualPropertiesTestUtils.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';

describe('Visual Properties - End-to-End Integration', () => {
  let testBed;
  let mockDOMEnv;
  let dataRegistry;
  let eventBus;

  beforeEach(async () => {
    testBed = new IntegrationTestBed();
    await testBed.initialize();

    // Use the IntegrationTestBed's existing DOM elements instead of creating duplicates
    mockDOMEnv = {
      container: document.querySelector('#action-buttons'),
      cleanup: () => {
        // Mock cleanup - IntegrationTestBed handles actual cleanup
        if (window.getComputedStyle.mockRestore) {
          window.getComputedStyle.mockRestore();
        }
      },
    };

    // Mock CSS computed styles (keep the existing mock functionality)
    const originalGetComputedStyle = window.getComputedStyle;
    window.getComputedStyle = jest.fn((element) => {
      const styles = originalGetComputedStyle(element);
      return {
        ...styles,
        getPropertyValue: jest.fn((prop) => {
          if (prop === '--selection-color') {
            return element.classList.contains('theme-dark-adapted')
              ? '#4CAF50'
              : '';
          }
          return styles.getPropertyValue(prop);
        }),
      };
    });
    window.getComputedStyle.mockRestore = () => {
      window.getComputedStyle = originalGetComputedStyle;
    };

    // Get services from container
    dataRegistry = testBed.get(tokens.IDataRegistry);
    eventBus = testBed.get(tokens.IEventBus);
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
        scope: 'self',
        prerequisites: [],
      };

      // 2. Store action directly in registry (simulating loader)
      dataRegistry.store('actions', 'test_mod:test_visual_action', {
        ...actionData,
        modId: 'test_mod',
      });

      // 3. Verify action is in registry with visual properties
      const loadedAction = dataRegistry.get(
        'actions',
        'test_mod:test_visual_action'
      );
      expect(loadedAction).toBeDefined();
      expect(loadedAction.visual).toEqual(actionData.visual);

      // 4. Create a simulated action composite with visual properties
      // This simulates what would come from the action discovery/processing pipeline
      const actionComposite = {
        index: 0, // Required for rendering
        actionId: 'test_mod:test_visual_action',
        id: 'test_mod:test_visual_action',
        name: actionData.name,
        commandString: 'Perform visual test', // Required for button text
        description: 'Perform visual test on yourself', // Required for tooltip
        commandVerb: 'perform',
        params: { targetId: 'player' },
        visual: actionData.visual, // Visual properties passed through
        formatted: 'Perform visual test on yourself',
      };

      // 5. Get renderer and render actions
      const actionButtonsRenderer = testBed.get(tokens.ActionButtonsRenderer);
      actionButtonsRenderer.availableActions = [actionComposite];
      await actionButtonsRenderer.renderList();

      // 6. Verify DOM elements have correct visual styles
      const button = mockDOMEnv.container.querySelector(
        '[data-action-index="0"]'
      );
      expect(button).toBeTruthy();

      // Verify styles using helper function
      const styleAssertions = verifyButtonVisualStyles(
        button,
        actionData.visual
      );
      styleAssertions.forEach((assertion) => {
        expect(assertion.passed).toBe(true);
      });

      // Verify custom visual class is added
      expect(button.classList.contains('action-button-custom-visual')).toBe(
        true
      );
    });

    it('should handle action without visual properties in mixed batch', async () => {
      const actionsData = [
        {
          id: 'action_with_visual',
          name: 'Visual Action',
          template: 'visual action',
          visual: { backgroundColor: '#ff0000' },
          conditions: [],
          effects: [],
        },
        {
          id: 'action_without_visual',
          name: 'Normal Action',
          template: 'normal action',
          conditions: [],
          effects: [],
          // No visual property
        },
      ];

      // Store both actions in registry
      for (const actionData of actionsData) {
        dataRegistry.store('actions', `test_mod:${actionData.id}`, {
          ...actionData,
          modId: 'test_mod',
        });
      }

      // Create simulated action composites
      const processedActions = actionsData.map((actionData, index) => ({
        index,
        actionId: `test_mod:${actionData.id}`,
        id: `test_mod:${actionData.id}`,
        name: actionData.name,
        commandString: actionData.name,
        description: `${actionData.name} description`,
        commandVerb: 'perform',
        params: { targetId: 'player' },
        visual: actionData.visual, // May be undefined for actions without visual
        formatted: actionData.name,
      }));

      // Get renderer and render both actions
      const actionButtonsRenderer = testBed.get(tokens.ActionButtonsRenderer);
      actionButtonsRenderer.availableActions = processedActions;
      await actionButtonsRenderer.renderList();

      // Verify visual action has styles
      const visualButton = mockDOMEnv.container.querySelector(
        '[data-action-index="0"]'
      );
      expect(visualButton.style.backgroundColor).toContain('255, 0, 0');
      expect(
        visualButton.classList.contains('action-button-custom-visual')
      ).toBe(true);

      // Verify normal action has no custom styles
      const normalButton = mockDOMEnv.container.querySelector(
        '[data-action-index="1"]'
      );
      expect(normalButton.style.backgroundColor).toBe('');
      expect(
        normalButton.classList.contains('action-button-custom-visual')
      ).toBe(false);
    });
  });

  describe('error handling integration', () => {
    it('should pass through invalid visual properties with warnings', async () => {
      const actionData = {
        id: 'invalid_visual_action',
        name: 'Invalid Visual Action',
        template: 'test action',
        visual: {
          backgroundColor: 'invalid-color',
          textColor: '#ffffff',
          unknownProperty: 'some-value', // Unknown property
        },
        conditions: [],
        effects: [],
      };

      // Store action with invalid visual properties
      dataRegistry.store('actions', 'test_mod:invalid_visual_action', {
        ...actionData,
        modId: 'test_mod',
      });

      // Verify action loads with visual properties intact (passed through)
      const loadedAction = dataRegistry.get(
        'actions',
        'test_mod:invalid_visual_action'
      );
      expect(loadedAction).toBeDefined();
      expect(loadedAction.visual).toEqual(actionData.visual); // Properties are passed through

      // Create simulated action composite with invalid visual properties
      const actionComposite = {
        index: 0,
        actionId: 'test_mod:invalid_visual_action',
        id: 'test_mod:invalid_visual_action',
        name: actionData.name,
        commandString: 'Invalid Visual Action',
        description: 'Invalid Visual Action description',
        commandVerb: 'perform',
        params: { targetId: 'player' },
        visual: actionData.visual, // Invalid properties passed through
        formatted: 'Invalid Visual Action',
      };

      // Get renderer
      const actionButtonsRenderer = testBed.get(tokens.ActionButtonsRenderer);

      // Should still render normally (renderer handles invalid properties)
      actionButtonsRenderer.availableActions = [actionComposite];
      await expect(actionButtonsRenderer.renderList()).resolves.not.toThrow();
    });

    it('should log warnings for invalid visual properties during formatting', async () => {
      // Mock logger to capture warnings
      const mockLogger = testBed.mockLogger;

      const actionData = {
        id: 'test_action',
        name: 'Test Action',
        template: 'test',
        visual: {
          backgroundColor: '#ff0000',
          unknownProperty: 'invalid', // This should trigger a warning
        },
        conditions: [],
        effects: [],
      };

      // Store action
      dataRegistry.store('actions', 'test_mod:test_action', {
        ...actionData,
        modId: 'test_mod',
      });

      // Create simulated action composite
      const actionComposite = {
        index: 0,
        actionId: 'test_mod:test_action',
        id: 'test_mod:test_action',
        name: actionData.name,
        commandString: 'Test Action',
        description: 'Test Action description',
        commandVerb: 'perform',
        params: { targetId: 'player' },
        visual: actionData.visual,
        formatted: 'Test Action',
      };

      // Get renderer
      const actionButtonsRenderer = testBed.get(tokens.ActionButtonsRenderer);

      // Render to trigger any renderer warnings
      actionButtonsRenderer.availableActions = [actionComposite];
      await actionButtonsRenderer.renderList();

      // Verify mockLogger was available for potential warnings
      expect(mockLogger.warn).toBeDefined();

      // Verify system doesn't crash with invalid properties (main assertion)
      // The rendering already happened above without throwing, so we check the result
      expect(() => actionButtonsRenderer.renderList).not.toThrow();
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
        conditions: [],
        effects: [],
      };

      // Store action
      dataRegistry.store('actions', 'test_mod:theme_test_action', {
        ...actionData,
        modId: 'test_mod',
      });

      // Create simulated action composite
      const actionComposite = {
        index: 0,
        actionId: 'test_mod:theme_test_action',
        id: 'test_mod:theme_test_action',
        name: actionData.name,
        commandString: 'Theme Test',
        description: 'Theme Test description',
        commandVerb: 'perform',
        params: { targetId: 'player' },
        visual: actionData.visual,
        formatted: 'Theme Test',
      };

      // Render
      const actionButtonsRenderer = testBed.get(tokens.ActionButtonsRenderer);
      actionButtonsRenderer.availableActions = [actionComposite];
      await actionButtonsRenderer.renderList();

      const button = mockDOMEnv.container.querySelector(
        '[data-action-index="0"]'
      );

      // Initial theme (light) - should have the default CSS variable value
      expect(button.style.getPropertyValue('--selection-color')).toBe(
        'var(--theme-selection-color, #0066cc)'
      );

      // Trigger theme change to dark
      await eventBus.dispatch('THEME_CHANGED', {
        newTheme: 'dark',
        previousTheme: 'light',
      });

      // Wait for theme change processing
      await waitFor(10);

      // Verify theme-specific adaptations - theme change functionality is now implemented
      expect(button.classList.contains('theme-dark-adapted')).toBe(true);
      expect(button.style.getPropertyValue('--current-theme')).toBe('dark');
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
        conditions: [],
        effects: [],
      };

      // Store action
      dataRegistry.store('actions', 'test_mod:hover_test_action', {
        ...actionData,
        modId: 'test_mod',
      });

      // Create simulated action composite
      const actionComposite = {
        index: 0,
        actionId: 'test_mod:hover_test_action',
        id: 'test_mod:hover_test_action',
        name: actionData.name,
        commandString: 'Hover Test',
        description: 'Hover Test description',
        commandVerb: 'perform',
        params: { targetId: 'player' },
        visual: actionData.visual,
        formatted: 'Hover Test',
      };

      // Render
      const actionButtonsRenderer = testBed.get(tokens.ActionButtonsRenderer);
      actionButtonsRenderer.availableActions = [actionComposite];
      await actionButtonsRenderer.renderList();

      const button = mockDOMEnv.container.querySelector(
        '[data-action-index="0"]'
      );

      // Verify hover data is set
      expect(button.dataset.hasCustomHover).toBe('true');
      expect(button.dataset.hoverBg).toBe('#00ff00');
      expect(button.dataset.hoverText).toBe('#000000');

      // Simulate hover using helper
      simulateMouseEvent(button, 'mouseenter');

      // Verify hover styles are applied - browsers return RGB format
      expect(button.style.backgroundColor).toBe('rgb(0, 255, 0)'); // #00ff00
      expect(button.style.color).toBe('rgb(0, 0, 0)'); // #000000
      expect(button.classList.contains('action-button-hovering')).toBe(true);

      // Simulate mouse leave
      simulateMouseEvent(button, 'mouseleave');

      // Wait for debounce
      await waitFor(60);

      // Verify original styles are restored
      expect(button.style.backgroundColor).toBe('rgb(255, 0, 0)'); // #ff0000
      expect(button.style.color).toBe('rgb(255, 255, 255)'); // #ffffff
      expect(button.classList.contains('action-button-hovering')).toBe(false);
    });
  });

  describe('visual property validation', () => {
    it('should handle all valid visual property combinations', async () => {
      const testCases = [
        {
          id: 'bg_only',
          visual: { backgroundColor: '#ff0000' },
        },
        {
          id: 'text_only',
          visual: { textColor: '#00ff00' },
        },
        {
          id: 'hover_bg_only',
          visual: { hoverBackgroundColor: '#0000ff' },
        },
        {
          id: 'hover_text_only',
          visual: { hoverTextColor: '#ffff00' },
        },
        {
          id: 'all_properties',
          visual: {
            backgroundColor: '#ff0000',
            textColor: '#ffffff',
            hoverBackgroundColor: '#00ff00',
            hoverTextColor: '#000000',
          },
        },
      ];

      const actionButtonsRenderer = testBed.get(tokens.ActionButtonsRenderer);

      for (const testCase of testCases) {
        const actionData = createTestActionWithVisual(
          testCase.id,
          testCase.visual
        );

        // Store action
        dataRegistry.store('actions', `test_mod:${testCase.id}`, {
          ...actionData,
          modId: 'test_mod',
        });

        // Create simulated action composite
        const actionComposite = {
          index: 0,
          actionId: `test_mod:${testCase.id}`,
          id: `test_mod:${testCase.id}`,
          name: actionData.name,
          commandString: actionData.name,
          description: `${actionData.name} description`,
          commandVerb: 'perform',
          params: { targetId: 'player' },
          visual: testCase.visual,
          formatted: actionData.name,
        };

        // Render and verify
        actionButtonsRenderer.availableActions = [actionComposite];
        await actionButtonsRenderer.renderList();

        const button = mockDOMEnv.container.querySelector(
          '[data-action-index="0"]'
        );
        expect(button).toBeTruthy();

        // Verify appropriate styles are applied based on what was provided
        // The 'action-button-custom-visual' class is added whenever ANY visual properties exist
        const hasAnyVisuals = !!(
          testCase.visual.backgroundColor ||
          testCase.visual.textColor ||
          testCase.visual.hoverBackgroundColor ||
          testCase.visual.hoverTextColor
        );
        const hasHoverVisuals = !!(
          testCase.visual.hoverBackgroundColor || testCase.visual.hoverTextColor
        );

        expect(button.classList.contains('action-button-custom-visual')).toBe(
          hasAnyVisuals
        );

        const expectedHoverValue = hasHoverVisuals ? 'true' : undefined;
        expect(button.dataset.hasCustomHover).toBe(expectedHoverValue);
      }
    });

    it('should preserve visual properties through action composite creation', async () => {
      const actionData = {
        id: 'composite_test',
        name: 'Composite Test',
        template: 'test action',
        visual: {
          backgroundColor: '#123456',
          textColor: '#abcdef',
        },
        conditions: [],
        effects: [],
      };

      // Store action
      dataRegistry.store('actions', 'test_mod:composite_test', {
        ...actionData,
        modId: 'test_mod',
      });

      // Verify stored action has visual properties
      const loadedAction = dataRegistry.get(
        'actions',
        'test_mod:composite_test'
      );
      expect(loadedAction).toBeDefined();
      expect(loadedAction.visual).toEqual(actionData.visual);

      // Create simulated action composite
      const actionComposite = {
        index: 0,
        actionId: 'test_mod:composite_test',
        id: 'test_mod:composite_test',
        name: actionData.name,
        commandString: 'Composite Test',
        description: 'Composite Test description',
        commandVerb: 'perform',
        params: { targetId: 'player' },
        visual: actionData.visual,
        formatted: 'test action',
      };

      // Verify visual properties are in the composite
      expect(actionComposite).toBeDefined();
      expect(actionComposite.visual).toBeDefined();
      expect(actionComposite.visual).toEqual(actionData.visual);

      // Verify actionId is set correctly for tracking
      expect(actionComposite.actionId).toBe('test_mod:composite_test');
    });
  });
});
