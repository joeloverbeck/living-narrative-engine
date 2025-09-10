/**
 * @file Unit tests for KeyboardShortcutsManager component
 * @see keyboardShortcutsManager.js
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import KeyboardShortcutsManager from '../../../src/logging/keyboardShortcutsManager.js';
import { createTestBed } from '../../common/testBed.js';

describe('KeyboardShortcutsManager - Core Functionality', () => {
  let testBed;
  let keyboardManager;
  let mockLogger;
  let mockCallback;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    mockCallback = jest.fn();

    // Mock document event listeners before creating the manager
    document.addEventListener = jest.fn();
    document.removeEventListener = jest.fn();

    keyboardManager = new KeyboardShortcutsManager({
      logger: mockLogger,
    });

    keyboardManager.setActionCallback(mockCallback);
  });

  afterEach(() => {
    testBed.cleanup();
    keyboardManager.destroy();
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with valid logger', () => {
      expect(() => {
        new KeyboardShortcutsManager({ logger: mockLogger });
      }).not.toThrow();
    });

    it('should throw error with invalid logger', () => {
      expect(() => {
        new KeyboardShortcutsManager({ logger: null });
      }).toThrow('Missing required dependency: ILogger');
    });

    it('should register default shortcuts on initialization', () => {
      const helpText = keyboardManager.getHelpText();

      expect(helpText).toContain('Escape');
      expect(helpText).toContain('Ctrl+Shift+L');
      expect(helpText).toContain('Ctrl+Shift+C');
      expect(helpText).toContain('Ctrl+Shift+E');
      expect(helpText).toContain('ArrowUp');
    });

    it('should not be enabled by default', () => {
      // Clear any calls from setup
      document.addEventListener.mockClear();

      // Create fresh instance to test default state
      const freshManager = new KeyboardShortcutsManager({
        logger: mockLogger,
      });

      expect(document.addEventListener).not.toHaveBeenCalled();
    });
  });

  describe('Shortcut Registration', () => {
    it('should register new shortcuts', () => {
      keyboardManager.register('Ctrl+K', {
        description: 'Test shortcut',
        action: 'test-action',
      });

      const helpText = keyboardManager.getHelpText();
      expect(helpText).toContain('Ctrl+K');
      expect(helpText).toContain('Test shortcut');
    });

    it('should normalize key combinations', () => {
      keyboardManager.register('shift+ctrl+k', {
        description: 'Normalized shortcut',
        action: 'normalized',
      });

      keyboardManager.register('Ctrl+Shift+K', {
        description: 'Same normalized shortcut',
        action: 'same-normalized',
      });

      const helpText = keyboardManager.getHelpText();
      // Should only appear once due to normalization
      const matches = (helpText.match(/Same normalized shortcut/g) || [])
        .length;
      expect(matches).toBe(1);
    });

    it('should override existing shortcuts', () => {
      keyboardManager.register('Escape', {
        description: 'Custom escape',
        action: 'custom-escape',
      });

      const helpText = keyboardManager.getHelpText();
      expect(helpText).toContain('Custom escape');
      expect(helpText).not.toContain('Close panel');
    });
  });

  describe('Enable/Disable Functionality', () => {
    it('should enable keyboard shortcuts', () => {
      document.addEventListener.mockClear();

      keyboardManager.enable();

      expect(document.addEventListener).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function)
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Keyboard shortcuts enabled'
      );
    });

    it('should disable keyboard shortcuts', () => {
      keyboardManager.enable();
      keyboardManager.disable();

      expect(document.removeEventListener).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function)
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Keyboard shortcuts disabled'
      );
    });

    it('should not enable if already enabled', () => {
      keyboardManager.enable();
      jest.clearAllMocks();

      keyboardManager.enable();
      expect(document.addEventListener).not.toHaveBeenCalled();
    });

    it('should not disable if already disabled', () => {
      // Ensure manager is disabled (which it should be by default)
      expect(keyboardManager.getHelpText()).toContain('Keyboard Shortcuts:');

      // Clear any previous calls from setup
      document.removeEventListener.mockClear();

      // Try to disable when already disabled
      keyboardManager.disable();
      expect(document.removeEventListener).not.toHaveBeenCalled();
    });
  });

  describe('Action Callback Management', () => {
    it('should set action callback', () => {
      const newCallback = jest.fn();
      keyboardManager.setActionCallback(newCallback);

      // Test by simulating a keydown event
      keyboardManager.enable();
      const mockEvent = {
        ctrlKey: true,
        shiftKey: true,
        key: 'L',
        target: { tagName: 'BODY', isContentEditable: false },
        preventDefault: jest.fn(),
      };

      // Get the event handler and call it directly
      const eventHandler = document.addEventListener.mock.calls.find(
        (call) => call[0] === 'keydown'
      );

      expect(eventHandler).toBeTruthy();
      expect(eventHandler).toBeDefined();
      eventHandler[1](mockEvent);

      expect(newCallback).toHaveBeenCalledWith('toggle-panel', mockEvent);
    });

    it('should handle missing action callback', () => {
      keyboardManager.setActionCallback(null);
      keyboardManager.enable();

      const mockEvent = {
        key: 'Escape',
        target: { tagName: 'BODY', isContentEditable: false },
        preventDefault: jest.fn(),
      };

      const eventHandlerCall = document.addEventListener.mock.calls.find(
        (call) => call[0] === 'keydown'
      );

      expect(eventHandlerCall).toBeTruthy();
      const eventHandler = eventHandlerCall[1];
      expect(() => eventHandler(mockEvent)).not.toThrow();
    });
  });

  describe('Key Event Processing', () => {
    beforeEach(() => {
      keyboardManager.enable();
    });

    const getEventHandler = () => {
      const eventHandlerCall = document.addEventListener.mock.calls.find(
        (call) => call[0] === 'keydown'
      );
      expect(eventHandlerCall).toBeTruthy();
      return eventHandlerCall[1];
    };

    it('should handle simple key events', () => {
      const mockEvent = {
        key: 'Escape',
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        metaKey: false,
        target: { tagName: 'BODY', isContentEditable: false },
        preventDefault: jest.fn(),
      };

      const eventHandler = getEventHandler();
      eventHandler(mockEvent);

      expect(mockCallback).toHaveBeenCalledWith('close-panel', mockEvent);
    });

    it('should handle complex key combinations', () => {
      const mockEvent = {
        key: 'L',
        ctrlKey: true,
        altKey: false,
        shiftKey: true,
        metaKey: false,
        target: { tagName: 'BODY', isContentEditable: false },
        preventDefault: jest.fn(),
      };

      const eventHandler = getEventHandler();
      eventHandler(mockEvent);

      expect(mockCallback).toHaveBeenCalledWith('toggle-panel', mockEvent);
      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    it('should ignore events in input fields', () => {
      const mockEvent = {
        key: 'Escape',
        target: { tagName: 'INPUT', isContentEditable: false },
        preventDefault: jest.fn(),
      };

      const eventHandler = getEventHandler();
      eventHandler(mockEvent);

      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should ignore events in textarea fields', () => {
      const mockEvent = {
        key: 'Escape',
        target: { tagName: 'TEXTAREA', isContentEditable: false },
        preventDefault: jest.fn(),
      };

      const eventHandler = getEventHandler();
      eventHandler(mockEvent);

      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should ignore events in select fields', () => {
      const mockEvent = {
        key: 'Escape',
        target: { tagName: 'SELECT', isContentEditable: false },
        preventDefault: jest.fn(),
      };

      const eventHandler = getEventHandler();
      eventHandler(mockEvent);

      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should ignore events in contenteditable elements', () => {
      const mockEvent = {
        key: 'Escape',
        target: { tagName: 'DIV', isContentEditable: true },
        preventDefault: jest.fn(),
      };

      const eventHandler = getEventHandler();
      eventHandler(mockEvent);

      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should ignore modifier-only key events', () => {
      const mockEvent = {
        key: 'Control',
        ctrlKey: true,
        target: { tagName: 'BODY', isContentEditable: false },
        preventDefault: jest.fn(),
      };

      const eventHandler = getEventHandler();
      eventHandler(mockEvent);

      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should ignore unregistered shortcuts', () => {
      const mockEvent = {
        key: 'Z',
        ctrlKey: true,
        target: { tagName: 'BODY', isContentEditable: false },
        preventDefault: jest.fn(),
      };

      const eventHandler = getEventHandler();
      eventHandler(mockEvent);

      expect(mockCallback).not.toHaveBeenCalled();
    });
  });

  describe('Panel-Required Shortcuts', () => {
    beforeEach(() => {
      keyboardManager.enable();

      // Mock document.querySelector for panel detection
      document.querySelector = jest.fn();
    });

    const getEventHandler = () => {
      const eventHandlerCall = document.addEventListener.mock.calls.find(
        (call) => call[0] === 'keydown'
      );
      expect(eventHandlerCall).toBeTruthy();
      return eventHandlerCall[1];
    };

    it('should execute panel-required shortcuts when panel is visible', () => {
      // Mock panel as visible
      document.querySelector.mockReturnValue({ hidden: false });

      const mockEvent = {
        key: 'ArrowUp',
        target: { tagName: 'BODY', isContentEditable: false },
        preventDefault: jest.fn(),
      };

      const eventHandler = getEventHandler();
      eventHandler(mockEvent);

      expect(mockCallback).toHaveBeenCalledWith('prev-log', mockEvent);
    });

    it('should not execute panel-required shortcuts when panel is hidden', () => {
      // Mock panel as hidden
      document.querySelector.mockReturnValue({ hidden: true });

      const mockEvent = {
        key: 'ArrowUp',
        target: { tagName: 'BODY', isContentEditable: false },
        preventDefault: jest.fn(),
      };

      const eventHandler = getEventHandler();
      eventHandler(mockEvent);

      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should not execute panel-required shortcuts when panel does not exist', () => {
      // Mock no panel found
      document.querySelector.mockReturnValue(null);

      const mockEvent = {
        key: 'ArrowDown',
        target: { tagName: 'BODY', isContentEditable: false },
        preventDefault: jest.fn(),
      };

      const eventHandler = getEventHandler();
      eventHandler(mockEvent);

      expect(mockCallback).not.toHaveBeenCalled();
    });
  });

  describe('Default Shortcuts Coverage', () => {
    beforeEach(() => {
      keyboardManager.enable();
    });

    const getEventHandler = () => {
      const eventHandlerCall = document.addEventListener.mock.calls.find(
        (call) => call[0] === 'keydown'
      );
      expect(eventHandlerCall).toBeTruthy();
      return eventHandlerCall[1];
    };

    const testShortcut = (keyConfig, expectedAction) => {
      const mockEvent = {
        ...keyConfig,
        target: { tagName: 'BODY', isContentEditable: false },
        preventDefault: jest.fn(),
      };

      const eventHandler = getEventHandler();
      eventHandler(mockEvent);

      expect(mockCallback).toHaveBeenCalledWith(expectedAction, mockEvent);
    };

    it('should handle all filter management shortcuts', () => {
      testShortcut({ key: 'C', ctrlKey: true, shiftKey: true }, 'clear-all');
      testShortcut({ key: 'D', ctrlKey: true, shiftKey: true }, 'dismiss');
      testShortcut({ key: 'E', ctrlKey: true, shiftKey: true }, 'export');
      testShortcut({ key: 'F', ctrlKey: true, shiftKey: true }, 'focus-search');

      // Verify all shortcuts were called
      expect(mockCallback).toHaveBeenCalledTimes(4);
    });

    it('should handle all filtering shortcuts', () => {
      testShortcut(
        { key: 'W', ctrlKey: true, shiftKey: true },
        'filter-warnings'
      );
      testShortcut(
        { key: 'R', ctrlKey: true, shiftKey: true },
        'filter-errors'
      );
      testShortcut({ key: 'A', ctrlKey: true, shiftKey: true }, 'filter-all');

      // Verify all filtering shortcuts were called
      expect(mockCallback).toHaveBeenCalledTimes(3);
    });

    it('should handle navigation shortcuts with panel requirement', () => {
      // Mock panel as visible
      document.querySelector = jest.fn().mockReturnValue({ hidden: false });

      testShortcut({ key: 'ArrowUp' }, 'prev-log');
      testShortcut({ key: 'ArrowDown' }, 'next-log');
      testShortcut({ key: 'Home' }, 'first-log');
      testShortcut({ key: 'End' }, 'last-log');

      // Verify all navigation shortcuts were called
      expect(mockCallback).toHaveBeenCalledTimes(4);
    });
  });

  describe('Help Text Generation', () => {
    it('should generate comprehensive help text', () => {
      const helpText = keyboardManager.getHelpText();

      expect(helpText).toContain('Keyboard Shortcuts:');
      expect(helpText).toContain('Escape');
      expect(helpText).toContain('Close panel');
      expect(helpText).toContain('Ctrl+Shift+L');
      expect(helpText).toContain('Toggle panel');
    });

    it('should format shortcuts consistently', () => {
      keyboardManager.register('Ctrl+Alt+Test', {
        description: 'Test shortcut with long name',
        action: 'test',
      });

      const helpText = keyboardManager.getHelpText();
      const lines = helpText.split('\n');

      // Find the test line
      const testLine = lines.find((line) =>
        line.includes('Test shortcut with long name')
      );
      expect(testLine).toBeTruthy();

      // Should have consistent padding
      expect(testLine).toMatch(/^\s+\S+.*-\s+Test shortcut with long name$/);
    });
  });

  describe('Cleanup and Destruction', () => {
    it('should clean up properly on destroy', () => {
      keyboardManager.enable();
      keyboardManager.setActionCallback(mockCallback);

      keyboardManager.destroy();

      expect(document.removeEventListener).toHaveBeenCalled();

      // Verify internal state is cleaned - shortcuts should be cleared
      const helpText = keyboardManager.getHelpText();
      expect(helpText).toBe('Keyboard Shortcuts:');
    });

    it('should handle destroy when not enabled', () => {
      expect(() => keyboardManager.destroy()).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      keyboardManager.enable();
    });

    it('should handle events with missing properties gracefully', () => {
      const mockEvent = {
        key: 'Escape',
        target: {},
        preventDefault: jest.fn(),
      };

      const eventHandlerCall = document.addEventListener.mock.calls.find(
        (call) => call[0] === 'keydown'
      );
      expect(eventHandlerCall).toBeTruthy();
      const eventHandler = eventHandlerCall[1];

      expect(() => eventHandler(mockEvent)).not.toThrow();
      expect(mockCallback).toHaveBeenCalledWith('close-panel', mockEvent);
    });

    it('should handle events with null target', () => {
      const mockEvent = {
        key: 'Escape',
        target: null,
        preventDefault: jest.fn(),
      };

      const eventHandlerCall = document.addEventListener.mock.calls.find(
        (call) => call[0] === 'keydown'
      );
      expect(eventHandlerCall).toBeTruthy();
      const eventHandler = eventHandlerCall[1];

      expect(() => eventHandler(mockEvent)).not.toThrow();
      // Should not call callback due to null target
      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should handle preventDefault missing', () => {
      const mockEvent = {
        key: 'L',
        ctrlKey: true,
        shiftKey: true,
        target: { tagName: 'BODY', isContentEditable: false },
      };

      const eventHandlerCall = document.addEventListener.mock.calls.find(
        (call) => call[0] === 'keydown'
      );
      expect(eventHandlerCall).toBeTruthy();
      const eventHandler = eventHandlerCall[1];

      expect(() => eventHandler(mockEvent)).not.toThrow();
      expect(mockCallback).toHaveBeenCalledWith('toggle-panel', mockEvent);
      // Should not throw error when preventDefault is missing
      expect(mockEvent.preventDefault).toBeUndefined();
    });
  });
});
