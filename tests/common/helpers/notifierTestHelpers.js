/**
 * @file Test helpers for critical log notification testing
 * @see criticalLogNotifier.js
 */

/**
 * Wait for notification to appear in DOM
 *
 * @param {number} timeout - Maximum time to wait in milliseconds
 * @returns {Promise<HTMLElement|null>} The notification container or null if timeout
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
 * Get all notification elements for testing
 *
 * @param {Document} document - Document instance
 * @returns {object|null} Object containing all notification elements or null if not found
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
 * Simulate user click interaction
 *
 * @param {HTMLElement} element - Element to click
 * @returns {void}
 */
export function simulateClick(element) {
  const event = element.ownerDocument.createEvent('MouseEvents');
  event.initEvent('click', true, true);
  element.dispatchEvent(event);
}

/**
 * Simulate keyboard event
 *
 * @param {Document} document - Document instance
 * @param {string} key - Key name
 * @param {object} options - Event options
 * @returns {void}
 */
export function simulateKeyboard(document, key, options = {}) {
  // Use the modern KeyboardEvent constructor for better compatibility
  const event = new (document.defaultView || window).KeyboardEvent('keydown', {
    key: key,
    code: key,
    keyCode: key === 'Escape' ? 27 : key === 'L' ? 76 : 0,
    which: key === 'Escape' ? 27 : key === 'L' ? 76 : 0,
    ctrlKey: options.ctrlKey || false,
    altKey: options.altKey || false,
    shiftKey: options.shiftKey || false,
    metaKey: options.metaKey || false,
    bubbles: true,
    cancelable: true,
  });

  document.dispatchEvent(event);
}

/**
 * Simulate right-click context menu
 *
 * @param {HTMLElement} element - Element to right-click
 * @returns {void}
 */
export function simulateRightClick(element) {
  const event = element.ownerDocument.createEvent('MouseEvents');
  event.initEvent('contextmenu', true, true);
  // Set button property for right-click
  Object.defineProperty(event, 'button', { value: 2 });
  element.dispatchEvent(event);
}

/**
 * Wait for DOM element to become visible or hidden
 *
 * @param {HTMLElement} element - Element to watch
 * @param {boolean} shouldBeVisible - Whether element should be visible
 * @param {number} timeout - Maximum wait time in milliseconds
 * @returns {Promise<boolean>} Whether the visibility condition was met
 */
export async function waitForVisibility(
  element,
  shouldBeVisible,
  timeout = 1000
) {
  return new Promise((resolve) => {
    const checkInterval = 50;
    let elapsed = 0;

    const check = () => {
      const isVisible = !element.hidden && element.style.display !== 'none';
      if (isVisible === shouldBeVisible || elapsed >= timeout) {
        resolve(isVisible === shouldBeVisible);
      } else {
        elapsed += checkInterval;
        setTimeout(check, checkInterval);
      }
    };

    check();
  });
}

/**
 * Get notification badge counts
 *
 * @param {object} elements - Notification elements from getNotificationElements
 * @returns {object} Object with warning and error counts
 */
export function getBadgeCounts(elements) {
  return {
    warnings: parseInt(elements.warningBadge?.textContent || '0', 10),
    errors: parseInt(elements.errorBadge?.textContent || '0', 10),
  };
}

/**
 * Get log entries from panel
 *
 * @param {object} elements - Notification elements from getNotificationElements
 * @returns {Array<HTMLElement>} Array of log entry elements
 */
export function getLogEntries(elements) {
  if (!elements.logList) return [];
  return Array.from(elements.logList.querySelectorAll('.lne-log-entry'));
}
