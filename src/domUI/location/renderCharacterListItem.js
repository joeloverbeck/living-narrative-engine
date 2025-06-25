/**
 * @module domUI/location/renderCharacterListItem
 * @description Helper to render a character list item with optional portrait and tooltip.
 */

/** @typedef {import('../domElementFactory.js').default} DomElementFactory */
/** @typedef {import('../../interfaces/IDocumentContext.js').IDocumentContext} IDocumentContext */
/** @typedef {import('../../entities/entityDisplayDataProvider.js').CharacterDisplayInfo} CharacterDisplayData */

/**
 * Creates the tooltip span used for character descriptions.
 *
 * @param {string} text - Tooltip text.
 * @param {DomElementFactory} domFactory - Factory for element creation.
 * @param {IDocumentContext} documentContext - Document utilities.
 * @returns {HTMLElement} Tooltip span element.
 */
function createCharacterTooltip(text, domFactory, documentContext) {
  const span =
    domFactory.span?.('character-tooltip', text) ??
    documentContext.document.createElement('span');
  if (!span.textContent) span.textContent = text;
  span.classList.add('character-tooltip');
  return span;
}

/**
 * Renders a character list item and appends it to the provided list element.
 *
 * @param {CharacterDisplayData|object} item - Character info to render.
 * @param {HTMLElement} listElement - The UL element to append to.
 * @param {DomElementFactory} domFactory - Factory for element creation.
 * @param {IDocumentContext} documentContext - Document utilities.
 * @param {(el: HTMLElement, ev: string, cb: (e: Event) => void) => void} [addListener] -
 *        Optional event binding helper.
 * @returns {void}
 */
export function renderCharacterListItem(
  item,
  listElement,
  domFactory,
  documentContext,
  addListener
) {
  const text = item && item.name ? String(item.name) : '(Invalid name)';
  const li =
    domFactory.li?.('list-item') ??
    documentContext.document.createElement('li');
  listElement.appendChild(li);

  if (item && item.portraitPath) {
    const img =
      domFactory.img?.(
        item.portraitPath,
        `Portrait of ${text}`,
        'character-portrait'
      ) ?? documentContext.document.createElement('img');
    if (!img.src) {
      img.src = item.portraitPath;
      img.alt = `Portrait of ${text}`;
      img.className = 'character-portrait';
    }
    li.appendChild(img);
  }

  const nameSpan =
    domFactory.span?.('character-name', text) ??
    documentContext.document.createTextNode(text);
  li.appendChild(nameSpan);

  if (item && item.description && item.description.trim()) {
    const tooltip = createCharacterTooltip(
      item.description,
      domFactory,
      documentContext
    );
    li.appendChild(tooltip);
    const handler = () => li.classList.toggle('tooltip-open');
    if (addListener) {
      addListener(li, 'click', handler);
    } else {
      li.addEventListener('click', handler);
    }
  }
}

export default renderCharacterListItem;
