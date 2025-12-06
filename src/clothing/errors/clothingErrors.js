/**
 * @file Clothing-specific error classes for enhanced error handling
 * @see src/errors/clothingSlotErrors.js for pattern reference
 */

import BaseError from '../../errors/baseError.js';

/**
 * Base class for all clothing-related errors
 * Following the existing pattern from src/errors/clothingSlotErrors.js
 */
export class ClothingError extends BaseError {
  constructor(message, context = {}) {
    super(message, 'CLOTHING_ERROR', context);
    // timestamp is already handled by BaseError

    // Maintains proper stack trace for where our error was thrown (only V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ClothingError);
    }
  }

  getSeverity() {
    return 'warning';
  }
  isRecoverable() {
    return true;
  }
}

/**
 * Errors related to clothing accessibility and coverage
 */
export class ClothingAccessibilityError extends BaseError {
  constructor(message, entityId, itemId, context = {}) {
    super(message, 'CLOTHING_ACCESSIBILITY_ERROR', {
      entityId,
      itemId,
      ...context,
    });
    // Store for backward compatibility
    this.entityId = entityId;
    this.itemId = itemId;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ClothingAccessibilityError);
    }
  }

  getSeverity() {
    return 'warning';
  }
  isRecoverable() {
    return true;
  }
}

/**
 * Errors related to coverage blocking analysis
 */
export class CoverageAnalysisError extends BaseError {
  constructor(message, equipmentState, context = {}) {
    super(message, 'COVERAGE_ANALYSIS_ERROR', {
      equipmentState,
      ...context,
    });
    // Store for backward compatibility
    this.equipmentState = equipmentState;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CoverageAnalysisError);
    }
  }

  getSeverity() {
    return 'warning';
  }
  isRecoverable() {
    return true;
  }
}

/**
 * Errors related to priority calculations
 */
export class PriorityCalculationError extends BaseError {
  constructor(message, layer, context, modifiers) {
    super(message, 'PRIORITY_CALCULATION_ERROR', {
      layer,
      modifiers,
      ...context,
    });
    // Store for backward compatibility
    this.layer = layer;
    this.modifiers = modifiers;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PriorityCalculationError);
    }
  }

  getSeverity() {
    return 'warning';
  }
  isRecoverable() {
    return true;
  }
}

/**
 * Errors related to service integration
 */
export class ClothingServiceError extends BaseError {
  constructor(message, serviceName, operation, context = {}) {
    super(message, 'CLOTHING_SERVICE_ERROR', {
      serviceName,
      operation,
      ...context,
    });
    // Store for backward compatibility
    this.serviceName = serviceName;
    this.operation = operation;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ClothingServiceError);
    }
  }

  getSeverity() {
    return 'error';
  }
  isRecoverable() {
    return true;
  }
}

/**
 * Errors related to data validation
 */
export class ClothingValidationError extends BaseError {
  constructor(message, field, value, expectedType, context = {}) {
    super(message, 'CLOTHING_VALIDATION_ERROR', {
      field,
      value,
      expectedType,
      ...context,
    });
    // Store for backward compatibility
    this.field = field;
    this.value = value;
    this.expectedType = expectedType;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ClothingValidationError);
    }
  }

  getSeverity() {
    return 'warning';
  }
  isRecoverable() {
    return true;
  }
}
