/**
 * @file Template utility exports
 * @module characterBuilder/templates/utilities
 */

// Template Composition Engine (HTMLTEMP-007)
export { TemplateComposer } from './templateComposer.js';
export { SlotContentProvider } from './slotContentProvider.js';
export { ComponentAssembler } from './componentAssembler.js';
export { CompositionCache } from './compositionCache.js';

// Template Inheritance Functions (HTMLTEMP-007)
export {
  createBaseTemplate,
  extendTemplate,
  createTemplateChain,
  createMultiInheritanceTemplate,
  applyMixins,
} from './templateInheritance.js';

// Composition Error Classes (HTMLTEMP-007)
export {
  CompositionError,
  SlotNotFoundError,
  RecursionLimitError,
  TemplateNotFoundError,
  TemplateValidationError,
  TemplateSyntaxError,
  InheritanceError,
  AssemblyError,
  CacheError,
  ContextError,
  createCompositionError,
} from './compositionErrors.js';

// NOTE: These exports reference files that will be created in subsequent tickets (Phase 3)
// They are included here to establish the expected API surface
// export { TemplateRenderer } from './templateRenderer.js';
// export { TemplateInjector } from './templateInjector.js';
// export { TemplateValidator } from './templateValidator.js';
// export { TemplateCache } from './templateCache.js';
