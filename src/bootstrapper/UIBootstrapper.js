// src/bootstrapper/UIBootstrapper.js

import DocumentContext from '../domUI/documentContext.js'; // Adjusted path based on typical structure

/**
 * @typedef {object} EssentialUIElements
 * @property {HTMLElement | null} outputDiv - The main output area element.
 * @property {HTMLElement | null} errorDiv - The element for displaying errors.
 * @property {HTMLInputElement | null} inputElement - The user command input element.
 * @property {HTMLElement | null} titleElement - The title display element.
 * @property {Document} document - The global document object.
 */

export class UIBootstrapper {
  /**
   * Queries for essential UI elements required for the application to start.
   * It uses DocumentContext for DOM querying.
   *
   * @param {Document} doc - The global document object.
   * @returns {EssentialUIElements} An object containing references to the found elements and the document.
   * @throws {Error} If any critical elements are missing, with a message listing them.
   */
  gatherEssentialElements(doc) {
    if (!doc) {
      throw new Error(
        'Fatal Error: Document object was not provided to UIBootstrapper.'
      );
    }

    const docContext = new DocumentContext(doc);

    const elementsToQuery = [
      {
        key: 'outputDiv',
        selector: '#outputDiv',
        name: 'outputDiv (ID: outputDiv)',
      },
      {
        key: 'errorDiv',
        selector: '#error-output',
        name: 'errorDiv (ID: error-output)',
      },
      {
        key: 'inputElement',
        selector: '#speech-input',
        name: 'inputElement (ID: speech-input)',
      },
      {
        key: 'titleElement',
        selector: 'h1',
        name: 'titleElement (Selector: h1)',
      },
    ];

    /** @type {Partial<EssentialUIElements>} */
    const foundElements = { document: doc }; // Start with the document object
    const missingElementNames = [];

    elementsToQuery.forEach((item) => {
      try {
        const element = docContext.query(item.selector);
        if (element) {
          foundElements[item.key] = element;
        } else {
          console.warn(`[UIBootstrapper] Missing: ${item.name}`);
          missingElementNames.push(item.name);
        }
      } catch (e) {
        console.error(
          `[UIBootstrapper] Error querying for ${item.name} using selector "${item.selector}":`,
          e
        );
        missingElementNames.push(`${item.name} (query failed)`);
      }
    });

    if (missingElementNames.length > 0) {
      const errorMsg = `Fatal Error: Cannot find required HTML elements: ${missingElementNames.join(', ')}. Application cannot start.`;
      console.error('[UIBootstrapper]', errorMsg);
      throw new Error(errorMsg);
    }

    console.log(
      '[UIBootstrapper] All essential UI elements found successfully.'
    );
    return /** @type {EssentialUIElements} */ (foundElements);
  }
}
