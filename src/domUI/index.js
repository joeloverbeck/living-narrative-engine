// src/domUI/index.js

// Export interfaces and base classes
export * from './IDocumentContext.js';
export * from './rendererBase.js'; // Ensure RendererBase export is correct

// Export concrete classes and utilities
// Ensure concrete DocumentContext is exported if needed directly
// export * from './documentContext.js'; // Uncomment if direct import needed elsewhere
// Using named export for DocumentContext from its file:
export {default as DocumentContext} from './documentContext.js';
export {default as DomElementFactory} from './domElementFactory.js';
export * from './uiMessageRenderer.js';
export * from './TitleRenderer.js'; // <-- ADDED Export for TitleRenderer

// Export other renderers as they are created
// export * from './inputStateController.js';
// ...etc