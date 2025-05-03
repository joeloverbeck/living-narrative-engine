// src/dom-ui/index.js (Updated Barrel File)
/**
 * @fileoverview Barrel file for the dom-ui module.
 * Exports key classes and interfaces for easy consumption.
 */

// Interfaces / Types
export * from './IDocumentContext.js'; // Export the typedef if needed (JSDoc only)

// Core Utilities / Base Classes
export {default as DocumentContext} from './documentContext.js';
export {default as DomElementFactory} from './domElementFactory.js';
export {default as RendererBase} from './RendererBase.js'; // Export the base class

// Concrete Renderers (Add these as they are created)
export {default as UiMessageRenderer} from './UiMessageRenderer.js'; // <-- ADDED EXPORT
// export { default as TitleRenderer } from './TitleRenderer.js';
// ... etc.

// Facade (Add when created)
// export { default as DomUiFacade } from './DomUiFacade.js';