// src/utils/listNavigationUtils.js

/**
 * @file Utility for handling keyboard navigation within radio-style lists.
 */

/**
 * @description Creates a keydown handler enabling arrow-key navigation for a list of
 * DOM elements acting as radio buttons. The handler cycles focus through the
 * items and invokes a callback when navigation occurs.
 * @param {HTMLElement} container - The container element holding the list items.
 * @param {string} itemSelector - CSS selector matching the navigable items.
 * @param {string} datasetKey - Name of the dataset property containing the item identifier.
 * @param {(item: HTMLElement, value: string|undefined) => void} selectCallback -
 *        Callback invoked with the newly focused item and its dataset value.
 * @returns {(event: KeyboardEvent) => void} Keydown handler to attach to the container.
 */
export function setupRadioListNavigation(
  container,
  itemSelector,
  datasetKey,
  selectCallback
) {
  return function handleNavigation(event) {
    const target = /** @type {HTMLElement} */ (event.target);

    if (
      !container ||
      !target.matches(itemSelector) ||
      target.closest('.disabled-interaction')
    ) {
      return;
    }

    const items = Array.from(container.querySelectorAll(itemSelector));
    if (items.length === 0) return;

    const currentIndex = items.findIndex((el) => el === target);
    let nextIndex = -1;

    switch (event.key) {
      case 'ArrowUp':
      case 'ArrowLeft':
        event.preventDefault();
        nextIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
        break;
      case 'ArrowDown':
      case 'ArrowRight':
        event.preventDefault();
        nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
        break;
      case 'Home':
        event.preventDefault();
        nextIndex = 0;
        break;
      case 'End':
        event.preventDefault();
        nextIndex = items.length - 1;
        break;
      default:
        return;
    }

    if (nextIndex !== -1 && nextIndex !== currentIndex) {
      const nextItem = /** @type {HTMLElement} */ (items[nextIndex]);
      nextItem.focus();
      const value = nextItem.dataset[datasetKey];
      selectCallback(nextItem, value);
    }
  };
}
