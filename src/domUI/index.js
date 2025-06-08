// src/domUI/index.js
// --- FILE START ---
// Export interfaces and base classes
export * from '../interfaces/IDocumentContext.js'; // Assuming this file exists and exports IDocumentContext
export { RendererBase } from './rendererBase.js'; // Ensure RendererBase export is correct
export { BoundDomRendererBase } from './boundDomRendererBase.js'; // Added BoundDomRendererBase
export * from './chatAlertRenderer.js';
export { BaseListDisplayComponent } from './baseListDisplayComponent.js'; // Added BaseListDisplayComponent
export { BaseModalRenderer } from './baseModalRenderer.js'; // Added BaseModalRenderer

// Export concrete classes and utilities
export { default as DocumentContext } from './documentContext.js';
export { default as DomElementFactory } from './domElementFactory.js';
export * from '../utils/domUtils.js'; // Assuming DomUtils are exported like this

export * from './titleRenderer.js';
export * from './inputStateController.js';
export * from './locationRenderer.js';
export * from './actionButtonsRenderer.js';
export * from './perceptionLogRenderer.js';
export { SpeechBubbleRenderer } from './speechBubbleRenderer.js';
export { CurrentTurnActorRenderer } from './currentTurnActorRenderer.js';
export { ActionResultRenderer } from './actionResultRenderer.js';

// Modals & UI Components
export { default as SaveGameUI } from './saveGameUI.js';
export { default as LoadGameUI } from './loadGameUI.js';
export { LlmSelectionModal } from './llmSelectionModal.js';

// Engine UI Management
export * from './engineUIManager.js'; // Assuming this file exists and exports relevant items

// *** ADDED: Export the new ProcessingIndicatorController ***
export { ProcessingIndicatorController } from './processingIndicatorController.js';

// Facade
export { DomUiFacade } from './domUiFacade.js';
// --- FILE END ---
