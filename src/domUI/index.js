// src/domUI/index.js

// Export interfaces and base classes
export * from './IDocumentContext.js';
export * from './rendererBase.js'; // Ensure RendererBase export is correct

// Export concrete classes and utilities
export {default as DocumentContext} from './documentContext.js';
export {default as DomElementFactory} from './domElementFactory.js';
export * from './uiMessageRenderer.js';
export * from './titleRenderer.js';
export * from './inputStateController.js';
export * from './locationRenderer.js';
export * from './inventoryPanel.js';
export * from './actionButtonsRenderer.js';
export * from './perceptionLogRenderer.js';

// *** ADDED: Export the new facade *** (Already present, but ensure it's correct)
export {DomUiFacade} from './domUiFacade.js'; // Use named export