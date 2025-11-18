/**
 * @file Test utility functions for event-based waiting and DOM state verification
 * @description Provides efficient alternatives to setTimeout-based waiting in tests
 */

/**
 * Flushes all pending promises and DOM updates
 *
 * @returns {Promise<void>}
 */
export async function flushPromises() {
  return new Promise((resolve) => {
    setImmediate(() => {
      setImmediate(resolve);
    });
  });
}

/**
 * Waits for a DOM element to have a specific style property value
 *
 * @param {HTMLElement} element - Element to observe
 * @param {string} property - CSS property to check
 * @param {string} expectedValue - Expected value
 * @param {number} timeout - Maximum wait time in ms (default: 1000)
 * @returns {Promise<void>}
 */
export function waitForElementStyle(
  element,
  property,
  expectedValue,
  timeout = 1000
) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const checkStyle = () => {
      const currentValue =
        element.style[property] || getComputedStyle(element)[property];

      if (currentValue === expectedValue) {
        resolve();
        return;
      }

      if (Date.now() - startTime > timeout) {
        reject(
          new Error(
            `Timeout waiting for ${property} to be ${expectedValue}. Current: ${currentValue}`
          )
        );
        return;
      }

      // Use requestAnimationFrame for DOM-related checks
      requestAnimationFrame(checkStyle);
    };

    checkStyle();
  });
}

/**
 * Waits for a modal to be displayed (display: flex or block)
 *
 * @param {HTMLElement} modal - Modal element
 * @param {number} timeout - Maximum wait time in ms (default: 500)
 * @returns {Promise<void>}
 */
export function waitForModalOpen(modal, timeout = 500) {
  return waitForElementStyle(modal, 'display', 'flex', timeout);
}

/**
 * Waits for a modal to be hidden (display: none)
 *
 * @param {HTMLElement} modal - Modal element
 * @param {number} timeout - Maximum wait time in ms (default: 500)
 * @returns {Promise<void>}
 */
export function waitForModalClose(modal, timeout = 500) {
  return waitForElementStyle(modal, 'display', 'none', timeout);
}

/**
 * Waits for an element to have a specific attribute value
 *
 * @param {HTMLElement} element - Element to observe
 * @param {string} attribute - Attribute name
 * @param {string|boolean} expectedValue - Expected value
 * @param {number} timeout - Maximum wait time in ms (default: 500)
 * @returns {Promise<void>}
 */
export function waitForElementAttribute(
  element,
  attribute,
  expectedValue,
  timeout = 500
) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const checkAttribute = () => {
      let currentValue;

      if (attribute === 'disabled') {
        currentValue = element.disabled;
      } else {
        currentValue = element.getAttribute(attribute);
      }

      if (currentValue === expectedValue) {
        resolve();
        return;
      }

      if (Date.now() - startTime > timeout) {
        reject(
          new Error(
            `Timeout waiting for ${attribute} to be ${expectedValue}. Current: ${currentValue}`
          )
        );
        return;
      }

      requestAnimationFrame(checkAttribute);
    };

    checkAttribute();
  });
}

/**
 * Waits for form validation to complete by monitoring button disabled state
 *
 * @param {HTMLElement} submitButton - Submit button element
 * @param {boolean} expectedDisabledState - Expected disabled state
 * @param {number} timeout - Maximum wait time in ms (default: 500)
 * @returns {Promise<void>}
 */
export function waitForValidation(
  submitButton,
  expectedDisabledState,
  timeout = 500
) {
  return waitForElementAttribute(
    submitButton,
    'disabled',
    expectedDisabledState,
    timeout
  );
}

/**
 * Waits for an event to be dispatched on an element or object
 *
 * @param {EventTarget} target - Event target
 * @param {string} eventType - Event type to wait for
 * @param {number} timeout - Maximum wait time in ms (default: 1000)
 * @returns {Promise<Event>}
 */
export function waitForEvent(target, eventType, timeout = 1000) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      target.removeEventListener(eventType, handleEvent);
      reject(new Error(`Timeout waiting for ${eventType} event`));
    }, timeout);

    const handleEvent = (event) => {
      clearTimeout(timeoutId);
      target.removeEventListener(eventType, handleEvent);
      resolve(event);
    };

    target.addEventListener(eventType, handleEvent);
  });
}

/**
 * Waits for multiple events to be captured in an array
 *
 * @param {Array} eventArray - Array where events are captured
 * @param {function} filterFn - Filter function to find specific events
 * @param {number} expectedCount - Expected number of matching events
 * @param {number} timeout - Maximum wait time in ms (default: 1000)
 * @returns {Promise<Array>}
 */
export function waitForCapturedEvents(
  eventArray,
  filterFn,
  expectedCount = 1,
  timeout = 1000
) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const checkEvents = () => {
      const matchingEvents = eventArray.filter(filterFn);

      if (matchingEvents.length >= expectedCount) {
        resolve(matchingEvents);
        return;
      }

      if (Date.now() - startTime > timeout) {
        reject(
          new Error(
            `Timeout waiting for ${expectedCount} events. Found: ${matchingEvents.length}`
          )
        );
        return;
      }

      // Check again after a short delay
      setTimeout(checkEvents, 10);
    };

    checkEvents();
  });
}

/**
 * Waits for IndexedDB operations to complete by flushing microtasks
 *
 * @returns {Promise<void>}
 */
export async function waitForIndexedDB() {
  // Flush microtasks and allow IndexedDB callbacks to execute
  await flushPromises();
  await flushPromises(); // Double flush for IndexedDB event loop
}

/**
 * Waits for a form input to be populated with a specific value
 *
 * @param {HTMLInputElement|HTMLTextAreaElement} input - Input element
 * @param {string} expectedValue - Expected value
 * @param {number} timeout - Maximum wait time in ms (default: 500)
 * @returns {Promise<void>}
 */
export function waitForInputValue(input, expectedValue, timeout = 500) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const checkValue = () => {
      if (input.value === expectedValue) {
        resolve();
        return;
      }

      if (Date.now() - startTime > timeout) {
        reject(
          new Error(
            `Timeout waiting for input value to be "${expectedValue}". Current: "${input.value}"`
          )
        );
        return;
      }

      requestAnimationFrame(checkValue);
    };

    checkValue();
  });
}
