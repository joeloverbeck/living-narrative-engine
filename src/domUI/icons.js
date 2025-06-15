/**
 * @file Contains inline SVG icon definitions for the UI and helper functions
 * to override them at runtime.
 * Using inline SVGs avoids extra network requests and allows for easy styling
 * with CSS (e.g., 'currentColor').
 */

/** @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry */


/**
 * Sets the data registry used by {@link getIcon} to look up icon markup.
 *
 * @param {import('../interfaces/coreServices.js').IDataRegistry} registry - The
 * registry instance that stores UI icon definitions under the `ui-icons` type.
 */
export function setIconRegistry(registry) {
  iconRegistry = registry;
}

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

export const NOTES_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 2a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8.828a2 2 0 0 0-.586-1.414l-4.414-4.414A2 2 0 0 0 11.172 2H4zm5.5 2.5a.5.5 0 0 0-.5-.5H5a.5.5 0 0 0-.5.5v11a.5.5 0 0 0 .5.5h10a.5.5 0 0 0 .5-.5V9.5a.5.5 0 0 0-.5-.5h-4a.5.5 0 0 0-.5.5V11H6V9h3.5V6.5zM11 5H6V4h5v1z" clip-rule="evenodd"/></svg>`;

const DEFAULT_ICONS = {
  thoughts: THOUGHT_SVG,
  notes: NOTES_SVG,
};

let iconRegistry = null;

/**
 * @description Registers an IDataRegistry providing custom icons.
 * @param {IDataRegistry|null} registry - Registry containing 'ui-icons' entries or null to clear.
 */
export function setIconRegistry(registry) {
  iconRegistry = registry;
}

/**
 * @description Retrieves an icon by name, falling back to defaults.
 * @param {string} name - Icon identifier.
 * @returns {string} SVG markup for the icon.
 */
export function getIcon(name) {
  if (iconRegistry && typeof iconRegistry.get === 'function') {
    const custom = iconRegistry.get('ui-icons', name);
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
