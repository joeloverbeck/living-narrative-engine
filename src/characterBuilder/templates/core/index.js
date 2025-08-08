/**
 * @file Core template exports
 * @module characterBuilder/templates/core
 */

// Page template container
export { createCharacterBuilderPage } from './pageTemplate.js';

// Header template and utilities (HTMLTEMP-003)
export {
  createHeader,
  createBreadcrumb,
  createHeaderSearch,
} from './headerTemplate.js';

// NOTE: These exports reference files that will be created in subsequent tickets
export { createMain } from './mainTemplate.js';
export { createFooter } from './footerTemplate.js';
export { createModal } from './modalTemplate.js';
