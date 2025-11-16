/**
 * @file DOM utilities for controller tests
 */

/**
 * Creates a fully configured DOM element for tests.
 *
 * @param {Object} config - Element configuration
 * @param {string} config.id - Element ID (required)
 * @param {string} [config.tag='div'] - HTML tag name
 * @param {Object} [config.attributes={}] - HTML attributes to set on the element
 * @param {string} [config.className] - CSS class names
 * @param {boolean} [config.attachToDocument=true] - Attach to document.body when true
 * @param {string} [config.textContent] - Optional text content
 * @returns {HTMLElement} Fully configured element
 */
export function createTestElement(config) {
  if (!config?.id) {
    throw new Error('createTestElement requires an id');
  }

  const {
    id,
    tag = 'div',
    attributes = {},
    className,
    attachToDocument = true,
    textContent,
  } = config;

  const element = document.createElement(tag);
  element.id = id;

  if (className) {
    element.className = className;
  }

  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });

  if (typeof textContent === 'string') {
    element.textContent = textContent;
  }

  if (attachToDocument && document?.body) {
    document.body.appendChild(element);
  }

  return element;
}

/**
 * Creates a DOM container with child elements.
 *
 * @param {Object} options - Container configuration
 * @param {string} options.containerId - ID for the container element
 * @param {string} [options.tag='div'] - Container tag name
 * @param {Object} [options.attributes={}] - Attributes to apply to the container
 * @param {string} [options.className] - CSS classes for the container
 * @param {Array<Object>} [options.children=[]] - Child element configs passed to createTestElement
 * @param {boolean} [options.attachToDocument=true] - Attach container to document.body when true
 * @returns {{container: HTMLElement, children: Record<string, HTMLElement>}} Container and child elements
 */
export function createTestContainer(options) {
  const {
    containerId,
    tag = 'div',
    attributes = {},
    className,
    children = [],
    attachToDocument = true,
  } = options;

  if (!containerId) {
    throw new Error('createTestContainer requires a containerId');
  }

  const container = createTestElement({
    id: containerId,
    tag,
    attributes,
    className,
    attachToDocument,
  });

  const childElements = {};
  children.forEach((childConfig) => {
    const child = createTestElement({
      ...childConfig,
      attachToDocument: false,
    });
    childElements[child.id] = child;
    container.appendChild(child);
  });

  return { container, children: childElements };
}

/**
 * Removes test elements from the DOM.
 *
 * @param {Array<string|HTMLElement>} elements - Element IDs or nodes to remove
 */
export function cleanupTestElements(elements) {
  if (!Array.isArray(elements)) {
    return;
  }

  elements.forEach((elementOrId) => {
    const element =
      typeof elementOrId === 'string'
        ? document.getElementById(elementOrId)
        : elementOrId;

    if (element?.parentNode) {
      element.parentNode.removeChild(element);
    }
  });
}
