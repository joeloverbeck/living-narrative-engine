/**
 * @file Helper function to build a selectable slot or list item element.
 */

/** @typedef {import('../domElementFactory.js').default} DomElementFactory */

/**
 * Creates an element representing a selectable slot or list item. The returned
 * element has the standard classes and ARIA attributes used throughout the
 * save/load and LLM selection modals.
 *
 * @param {DomElementFactory} domFactory - The DOM element factory.
 * @param {string} tagName - Tag name for the element (e.g., 'div', 'li').
 * @param {string} datasetKey - Name of the dataset property to set.
 * @param {string|number} datasetValue - Value for the dataset property.
 * @param {string} labelText - Text label for the item.
 * @param {boolean} [isEmpty] - Whether the item represents an empty slot.
 * @param {boolean} [isCorrupted] - Whether the item is marked as corrupted.
 * @param {string|string[]} [extraClasses] - Additional CSS classes to apply.
 * @param {(Event) => void} [onClick] - Optional click handler to attach.
 * @returns {HTMLElement | null} The configured element or null if creation fails.
 */
export function createSelectableItem(
  domFactory,
  tagName,
  datasetKey,
  datasetValue,
  labelText,
  isEmpty = false,
  isCorrupted = false,
  extraClasses = undefined,
  onClick
) {
  if (!domFactory) return null;

  const classes = [];
  if (extraClasses) {
    if (Array.isArray(extraClasses)) {
      classes.push(...extraClasses);
    } else {
      classes.push(extraClasses);
    }
  }
  classes.push('save-slot');
  if (isEmpty) classes.push('empty');
  if (isCorrupted) classes.push('corrupted');

  const element = domFactory.create(tagName, {
    cls: classes.join(' '),
    text: tagName === 'li' ? labelText : undefined,
  });
  if (!element) return null;

  if (tagName !== 'li') {
    element.textContent = labelText;
  }

  element.dataset[datasetKey] = String(datasetValue);
  element.setAttribute('role', 'radio');
  element.setAttribute('aria-checked', 'false');

  if (typeof onClick === 'function') {
    element.addEventListener('click', onClick);
  }

  return element;
}
