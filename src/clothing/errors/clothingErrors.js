/**
 * @file Clothing-specific error classes for enhanced error handling
 * @see src/errors/clothingSlotErrors.js for pattern reference
 */

/**
 * Base class for all clothing-related errors
 * Following the existing pattern from src/errors/clothingSlotErrors.js
 */
export class ClothingError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name = 'ClothingError';
    this.context = context;
    this.timestamp = new Date().toISOString();
    
    // Maintains proper stack trace for where our error was thrown (only V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ClothingError);
    }
  }
}

/**
 * Errors related to clothing accessibility and coverage
 */
export class ClothingAccessibilityError extends Error {
  constructor(message, entityId, itemId, context = {}) {
    super(message);
    this.name = 'ClothingAccessibilityError';
    this.entityId = entityId;
    this.itemId = itemId;
    this.context = context;
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ClothingAccessibilityError);
    }
  }
}

/**
 * Errors related to coverage blocking analysis
 */
export class CoverageAnalysisError extends Error {
  constructor(message, equipmentState, context = {}) {
    super(message);
    this.name = 'CoverageAnalysisError';
    this.equipmentState = equipmentState;
    this.context = context;
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CoverageAnalysisError);
    }
  }
}

/**
 * Errors related to priority calculations
 */
export class PriorityCalculationError extends Error {
  constructor(message, layer, context, modifiers) {
    super(message);
    this.name = 'PriorityCalculationError';
    this.layer = layer;
    this.context = context;
    this.modifiers = modifiers;
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PriorityCalculationError);
    }
  }
}

/**
 * Errors related to service integration
 */
export class ClothingServiceError extends Error {
  constructor(message, serviceName, operation, context = {}) {
    super(message);
    this.name = 'ClothingServiceError';
    this.serviceName = serviceName;
    this.operation = operation;
    this.context = context;
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ClothingServiceError);
    }
  }
}

/**
 * Errors related to data validation
 */
export class ClothingValidationError extends Error {
  constructor(message, field, value, expectedType, context = {}) {
    super(message);
    this.name = 'ClothingValidationError';
    this.field = field;
    this.value = value;
    this.expectedType = expectedType;
    this.context = context;
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ClothingValidationError);
    }
  }
}