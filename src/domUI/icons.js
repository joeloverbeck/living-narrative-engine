/**
 * @file Contains inline SVG icon definitions for the UI and helper functions
 * to override them at runtime.
 * Using inline SVGs avoids extra network requests and allows for easy styling
 * with CSS (e.g., 'currentColor').
 */

/** @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry */

/**
 * @class IconRegistry
 * @description Manages retrieval of SVG icons from a provided data registry.
 */
export class IconRegistry {
  /** @private */
  registry = null;

  /**
   * Sets the data registry used to look up icon markup.
   *
   * @param {import('../interfaces/coreServices.js').IDataRegistry|null} registry -
   * The registry instance that stores UI icon definitions under the `ui-icons` type.
   * @returns {void}
   */
  setRegistry(registry) {
    this.registry = registry;
  }

  /**
   * Retrieves SVG markup for a named icon.
   *
   * The function first attempts to obtain the icon from the configured
   * {@link IDataRegistry} instance. If the lookup fails or no registry has been
   * set, a built-in fallback icon is returned.
   *
   * @param {string} name - The icon name to retrieve.
   * @returns {string} The SVG markup for the icon. Returns an empty string if no
   * icon is found.
   */
  getIcon(name) {
    if (this.registry && typeof this.registry.get === 'function') {
      const custom = this.registry.get('ui-icons', name);
      if (typeof custom === 'string') {
        return custom;
      }
      if (
        custom &&
        typeof custom === 'object' &&
        typeof custom.markup === 'string'
      ) {
        return custom.markup;
      }
    }

    return DEFAULT_ICONS[name] || '';
  }
}

/**
 * A default singleton instance used by helper functions.
 *
 * @type {IconRegistry}
 */
export const defaultIconRegistry = new IconRegistry();

/**
 * Retrieves SVG markup for a named icon.
 *
 * The function first attempts to obtain the icon from the provided
 * {@link IDataRegistry} instance. If the lookup fails or no registry has been
 * set, a built-in fallback icon is returned.
 *
 * @param {string} name - The icon name to retrieve.
 * @returns {string} The SVG markup for the icon. Returns an empty string if no
 * icon is found.
 */

export const THOUGHT_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M16.417 10.333c0-2.347-1.9-4.25-4.25-4.25h-.354a.354.354 0 0 1-.353-.354c0-1.76-1.433-3.196-3.196-3.196S5.07 4.023 5.07 5.783c0 .162.013.32.036.477a.354.354 0 0 1-.29.388C2.96 7.02.833 8.942.833 11.283c0 2.457 1.993 4.45 4.45 4.45.24 0 .474-.014.704-.042a.354.354 0 0 1 .343.23c.44 1.133 1.512 1.946 2.793 1.946h.14c1.556 0 2.82-1.263 2.82-2.82v-.526a.354.354 0 0 1 .354-.354h2.147c1.045 0 1.92-.764 2.07-1.767.1-.64-.103-1.27-.52-1.763z"/></svg>';
export const NOTES_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 2a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8.828a2 2 0 0 0-.586-1.414l-4.414-4.414A2 2 0 0 0 11.172 2H4zm5.5 2.5a.5.5 0 0 0-.5-.5H5a.5.5 0 0 0-.5.5v11a.5.5 0 0 0 .5.5h10a.5.5 0 0 0 .5-.5V9.5a.5.5 0 0 0-.5-.5h-4a.5.5 0 0 0-.5.5V11H6V9h3.5V6.5zM11 5H6V4h5v1z" clip-rule="evenodd"/></svg>`;

const DEFAULT_ICONS = {
  thoughts: THOUGHT_SVG,
  notes: NOTES_SVG,
};

/**
 * Delegates to {@link defaultIconRegistry} for icon retrieval.
 *
 * @param {string} name - Icon identifier.
 * @returns {string} SVG markup for the icon.
 */
export function getIcon(name) {
  return defaultIconRegistry.getIcon(name);
}

/**
 * Delegates to {@link defaultIconRegistry} to set the registry.
 *
 * @param {import('../interfaces/coreServices.js').IDataRegistry|null} registry - Registry storing icons.
 * @returns {void}
 */
export function setIconRegistry(registry) {
  defaultIconRegistry.setRegistry(registry);
}
