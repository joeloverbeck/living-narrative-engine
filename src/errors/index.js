// Base error class (foundation for all custom errors)
export { default as BaseError } from './baseError.js';

export * from './modsLoaderPhaseError.js';
export * from './serializedEntityError.js';
export * from './invalidInstanceIdError.js';
// ... add other exports as needed
export * from './invalidEntityIdError.js';
export * from './InitializationError.js';
export * from './invalidActionDefinitionError.js';
export * from './invalidActorEntityError.js';
export * from './duplicateContentError.js';
export * from './unknownAstNodeError.js';
export * from './repositoryConsistencyError.js';
export * from './componentOverrideNotFoundError.js';
export * from './locationNotFoundError.js';
export * from './missingEntityInstanceError.js';
export * from './missingInstanceIdError.js';
export * from './validationError.js';
export * from './fetchError.js';
export * from './invalidEnvironmentContextError.js';

// Anatomy visualization error classes
export * from './anatomyVisualizationError.js';
export * from './anatomyDataError.js';
export * from './anatomyRenderError.js';
export * from './anatomyStateError.js';

// Clothing slot resolution error classes
export * from './clothingSlotErrors.js';

// Mod validation error classes
export * from './modValidationError.js';
export * from './modSecurityError.js';
export * from './modCorruptionError.js';
export * from './modAccessError.js';

// Action validation error classes
export * from './actionIndexValidationError.js';
