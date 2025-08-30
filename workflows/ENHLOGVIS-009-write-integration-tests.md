# ENHLOGVIS-009: Write Integration Tests for Visual Notifications

## Ticket Overview

**Type**: Testing  
**Component**: Testing/Integration  
**Priority**: High  
**Phase**: 2 - Visual Notifications  
**Estimated Effort**: 3-4 hours

## Objective

Create comprehensive integration tests that verify the end-to-end flow from logging a warning/error to the visual notification appearing and functioning correctly, including user interactions and configuration changes.

## Current State

- Unit tests exist for individual components (ENHLOGVIS-004)
- No integration tests for the complete flow
- No tests for UI interactions
- No tests for configuration runtime updates

## Technical Implementation

### Files to Create

- `tests/integration/logging/criticalLogNotification.integration.test.js`
- `tests/integration/logging/notifierUIInteraction.integration.test.js`
- `tests/integration/logging/configurationUpdate.integration.test.js`
- `tests/common/helpers/notifierTestHelpers.js`

### Test Implementation

1. **End-to-End Flow Tests** (`criticalLogNotification.integration.test.js`):

   ```javascript
   import {
     describe,
     it,
     expect,
     beforeEach,
     afterEach,
     jest,
   } from '@jest/globals';
   import { JSDOM } from 'jsdom';
   import HybridLogger from '../../../src/logging/hybridLogger.js';
   import CriticalLogNotifier from '../../../src/logging/criticalLogNotifier.js';
   import LoggerFactory from '../../../src/logging/loggerFactory.js';
   import { createMockEventBus } from '../../common/mocks/mockEventBus.js';
   import {
     waitForNotification,
     getNotificationElements,
   } from '../../common/helpers/notifierTestHelpers.js';

   describe('Critical Log Notification Integration', () => {
     let dom;
     let document;
     let logger;
     let config;

     beforeEach(() => {
       // Set up DOM environment
       dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
         url: 'http://localhost',
         pretendToBeVisual: true,
       });

       document = dom.window.document;
       global.document = document;
       global.window = dom.window;
       global.localStorage = {
         getItem: jest.fn(),
         setItem: jest.fn(),
         removeItem: jest.fn(),
       };

       // Create logger with notifier enabled
       config = {
         criticalLogging: {
           alwaysShowInConsole: true,
           enableVisualNotifications: true,
           bufferSize: 50,
           notificationPosition: 'top-right',
           autoDismissAfter: null,
         },
         remoteLogging: {
           enabled: false,
         },
       };

       logger = LoggerFactory.createLogger(config, {
         eventBus: createMockEventBus(),
       });
     });

     afterEach(() => {
       // Clean up
       if (logger) {
         logger.destroy();
       }
       dom.window.close();
       delete global.document;
       delete global.window;
       delete global.localStorage;
     });

     describe('Warning Notifications', () => {
       it('should show notification badge when warning is logged', async () => {
         logger.warn('Test warning message');

         await waitForNotification();

         const elements = getNotificationElements(document);
         expect(elements.container).toBeDefined();
         expect(elements.warningBadge.textContent).toBe('1');
         expect(elements.warningBadge.hidden).toBe(false);
       });

       it('should increment warning count for multiple warnings', async () => {
         logger.warn('Warning 1');
         logger.warn('Warning 2');
         logger.warn('Warning 3');

         await waitForNotification();

         const elements = getNotificationElements(document);
         expect(elements.warningBadge.textContent).toBe('3');
       });

       it('should add warnings to critical buffer', () => {
         logger.warn('Buffered warning');

         const criticalLogs = logger.getCriticalLogs();
         expect(criticalLogs).toHaveLength(1);
         expect(criticalLogs[0].level).toBe('warn');
         expect(criticalLogs[0].message).toBe('Buffered warning');
       });
     });

     describe('Error Notifications', () => {
       it('should show notification badge when error is logged', async () => {
         const error = new Error('Test error');
         logger.error('Error occurred', error);

         await waitForNotification();

         const elements = getNotificationElements(document);
         expect(elements.errorBadge.textContent).toBe('1');
         expect(elements.errorBadge.hidden).toBe(false);
       });

       it('should show both warning and error badges', async () => {
         logger.warn('Warning message');
         logger.error('Error message');

         await waitForNotification();

         const elements = getNotificationElements(document);
         expect(elements.warningBadge.textContent).toBe('1');
         expect(elements.errorBadge.textContent).toBe('1');
         expect(elements.warningBadge.hidden).toBe(false);
         expect(elements.errorBadge.hidden).toBe(false);
       });
     });

     describe('Console Output', () => {
       let consoleWarnSpy;
       let consoleErrorSpy;

       beforeEach(() => {
         consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
         consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
       });

       afterEach(() => {
         consoleWarnSpy.mockRestore();
         consoleErrorSpy.mockRestore();
       });

       it('should output warnings to console when enabled', () => {
         logger.warn('Console warning');

         expect(consoleWarnSpy).toHaveBeenCalledWith(
           expect.stringContaining('Console warning'),
           expect.any(Object)
         );
       });

       it('should output errors to console when enabled', () => {
         logger.error('Console error');

         expect(consoleErrorSpy).toHaveBeenCalledWith(
           expect.stringContaining('Console error'),
           expect.any(Object)
         );
       });
     });

     describe('Configuration Integration', () => {
       it('should not show notifications when disabled in config', async () => {
         const disabledConfig = {
           ...config,
           criticalLogging: {
             ...config.criticalLogging,
             enableVisualNotifications: false,
           },
         };

         const disabledLogger = LoggerFactory.createLogger(disabledConfig, {
           eventBus: createMockEventBus(),
         });

         disabledLogger.warn('Should not show');

         await waitForNotification(100); // Short wait

         const container = document.querySelector('.lne-critical-log-notifier');
         expect(container).toBeNull();

         disabledLogger.destroy();
       });

       it('should respect buffer size configuration', () => {
         const smallBufferConfig = {
           ...config,
           criticalLogging: {
             ...config.criticalLogging,
             bufferSize: 3,
           },
         };

         const smallBufferLogger = LoggerFactory.createLogger(
           smallBufferConfig,
           {
             eventBus: createMockEventBus(),
           }
         );

         // Log more than buffer size
         for (let i = 0; i < 5; i++) {
           smallBufferLogger.warn(`Warning ${i}`);
         }

         const logs = smallBufferLogger.getCriticalLogs();
         expect(logs).toHaveLength(3);
         expect(logs[0].message).toBe('Warning 2'); // Oldest should be removed

         smallBufferLogger.destroy();
       });
     });
   });
   ```

2. **UI Interaction Tests** (`notifierUIInteraction.integration.test.js`):

   ```javascript
   describe('Notifier UI Interactions', () => {
     describe('Panel Expansion', () => {
       it('should expand panel when badge is clicked', async () => {
         logger.warn('Test warning');
         await waitForNotification();

         const elements = getNotificationElements(document);
         const panel = elements.panel;

         // Initially hidden
         expect(panel.hidden).toBe(true);

         // Click badge
         elements.badgeContainer.click();

         // Panel should be visible
         expect(panel.hidden).toBe(false);

         // Should show log entries
         const logEntries = panel.querySelectorAll('.lne-log-entry');
         expect(logEntries.length).toBe(1);
         expect(logEntries[0].textContent).toContain('Test warning');
       });

       it('should collapse panel when close button clicked', async () => {
         logger.warn('Test');
         await waitForNotification();

         const elements = getNotificationElements(document);

         // Expand panel
         elements.badgeContainer.click();
         expect(elements.panel.hidden).toBe(false);

         // Click close button
         const closeBtn = elements.panel.querySelector('.lne-close-btn');
         closeBtn.click();

         // Panel should be hidden
         expect(elements.panel.hidden).toBe(true);
       });

       it('should clear notifications when clear button clicked', async () => {
         logger.warn('Warning 1');
         logger.error('Error 1');
         await waitForNotification();

         const elements = getNotificationElements(document);

         // Expand panel
         elements.badgeContainer.click();

         // Click clear button
         const clearBtn = elements.panel.querySelector('.lne-clear-btn');
         clearBtn.click();

         // Badges should reset
         expect(elements.warningBadge.hidden).toBe(true);
         expect(elements.errorBadge.hidden).toBe(true);

         // Log list should be empty
         const logEntries = elements.panel.querySelectorAll('.lne-log-entry');
         expect(logEntries.length).toBe(0);
       });
     });

     describe('Keyboard Shortcuts', () => {
       it('should collapse panel on Escape key', async () => {
         logger.warn('Test');
         await waitForNotification();

         const elements = getNotificationElements(document);

         // Expand panel
         elements.badgeContainer.click();
         expect(elements.panel.hidden).toBe(false);

         // Press Escape
         const escapeEvent = new dom.window.KeyboardEvent('keydown', {
           key: 'Escape',
           bubbles: true,
         });
         document.dispatchEvent(escapeEvent);

         // Panel should collapse
         expect(elements.panel.hidden).toBe(true);
       });

       it('should toggle panel on Ctrl+Shift+L', async () => {
         logger.warn('Test');
         await waitForNotification();

         const elements = getNotificationElements(document);

         // Initially hidden
         expect(elements.panel.hidden).toBe(true);

         // Press Ctrl+Shift+L
         const toggleEvent = new dom.window.KeyboardEvent('keydown', {
           key: 'L',
           ctrlKey: true,
           shiftKey: true,
           bubbles: true,
         });
         document.dispatchEvent(toggleEvent);

         // Should expand
         expect(elements.panel.hidden).toBe(false);

         // Press again
         document.dispatchEvent(toggleEvent);

         // Should collapse
         expect(elements.panel.hidden).toBe(true);
       });
     });

     describe('Dismissal', () => {
       it('should dismiss notifications on right-click', async () => {
         logger.warn('Test');
         await waitForNotification();

         const elements = getNotificationElements(document);

         // Right-click badge
         const contextMenuEvent = new dom.window.MouseEvent('contextmenu', {
           button: 2,
           bubbles: true,
         });
         elements.badgeContainer.dispatchEvent(contextMenuEvent);

         // Should hide container
         expect(elements.container.hidden).toBe(true);
       });
     });
   });
   ```

3. **Test Helper Functions** (`tests/common/helpers/notifierTestHelpers.js`):

   ```javascript
   /**
    * Wait for notification to appear in DOM
    */
   export async function waitForNotification(timeout = 1000) {
     return new Promise((resolve) => {
       const checkInterval = 50;
       let elapsed = 0;

       const check = () => {
         const container = document.querySelector('.lne-critical-log-notifier');
         if (container || elapsed >= timeout) {
           resolve(container);
         } else {
           elapsed += checkInterval;
           setTimeout(check, checkInterval);
         }
       };

       check();
     });
   }

   /**
    * Get all notification elements
    */
   export function getNotificationElements(document) {
     const container = document.querySelector('.lne-critical-log-notifier');
     if (!container) return null;

     return {
       container,
       badgeContainer: container.querySelector('.lne-badge-container'),
       warningBadge: container.querySelector('.lne-warning-badge'),
       errorBadge: container.querySelector('.lne-error-badge'),
       panel: container.querySelector('.lne-log-panel'),
       clearBtn: container.querySelector('.lne-clear-btn'),
       closeBtn: container.querySelector('.lne-close-btn'),
       logList: container.querySelector('.lne-log-list'),
     };
   }

   /**
    * Simulate user interaction
    */
   export function simulateClick(element) {
     const event = new MouseEvent('click', {
       bubbles: true,
       cancelable: true,
     });
     element.dispatchEvent(event);
   }
   ```

## Dependencies

- **Tests**: All previous implementation tickets (ENHLOGVIS-001 through ENHLOGVIS-008)
- **Uses**: Jest, JSDOM for DOM testing

## Acceptance Criteria

- [ ] Integration tests cover end-to-end flow
- [ ] UI interaction tests verify all user actions
- [ ] Configuration update tests verify runtime changes
- [ ] Keyboard shortcut tests pass
- [ ] Position persistence tests work
- [ ] All tests are independent and repeatable
- [ ] Test coverage > 80% for integration paths
- [ ] Tests run in CI pipeline

## Testing Requirements

### Test Execution

```bash
# Run integration tests
npm run test:integration tests/integration/logging/

# Run with coverage
npm run test:integration -- --coverage

# Run specific test file
npm run test:integration tests/integration/logging/criticalLogNotification.integration.test.js
```

### CI Integration

- Tests should run in GitHub Actions
- Tests should not require real browser
- Tests should complete within 30 seconds
- Tests should be included in PR checks

## Code Review Checklist

- [ ] Tests cover all critical paths
- [ ] No test interdependencies
- [ ] Proper cleanup in afterEach
- [ ] Mock DOM properly set up
- [ ] Async operations handled correctly
- [ ] Error cases tested

## Notes

- JSDOM provides sufficient DOM API for testing
- Consider adding E2E tests with Playwright in future
- Integration tests should not test implementation details
- Focus on user-visible behavior

## Related Tickets

- **Depends On**: ENHLOGVIS-001 through ENHLOGVIS-008
- **Next**: ENHLOGVIS-010 (Enhanced features)
- **Validates**: Entire Phase 1 and 2 implementation
