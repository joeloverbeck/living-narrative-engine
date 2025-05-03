// src/domUI/index.js (Create or update this barrel file)
/**
 * @fileoverview Barrel file for the domUI module.
 * Exports key classes and interfaces for easy consumption.
 */

// Interfaces / Types
export IDocumentContext from './IDocumentContext.js'; // Assuming it exports {} or similar

// Core Utilities / Base Classes
export {default as DocumentContext} from './documentContext.js';
export {default as DomElementFactory} from './domElementFactory.js';
export {default as RendererBase} from './RendererBase.js'; // Export the new base class

// Concrete Renderers (Add these as they are created)
// export { default as UiMessageRenderer } from './UiMessageRenderer.js';
// export { default as TitleRenderer } from './TitleRenderer.js';
// ... etc.

// Facade (Add when created)
// export { default as DomUiFacade } from './DomUiFacade.js';