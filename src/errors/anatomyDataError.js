/**
 * @file Error class for anatomy data processing issues
 * @see src/errors/anatomyVisualizationError.js
 */

import { AnatomyVisualizationError } from './anatomyVisualizationError.js';

/**
 * Error thrown when anatomy data cannot be processed or is invalid.
 * Used for issues with anatomy component data, entity relationships,
 * or data structure validation.
 *
 * @class
 * @augments {AnatomyVisualizationError}
 */
export class AnatomyDataError extends AnatomyVisualizationError {
  /**
   * Create a new AnatomyDataError instance.
   *
   * @param {string} message - The error message
   * @param {object} options - Error options
   * @param {string} options.entityId - Entity ID that failed processing
   * @param {string} options.dataType - Type of data that failed (e.g., 'anatomy:body', 'anatomy:part')
   * @param {object} options.invalidData - The invalid data that caused the error
   * @param {string} options.validationError - Specific validation error details
   * @param {...*} options.rest - Additional options passed to parent class
   */
  constructor(message, options = {}) {
    const {
      entityId,
      dataType,
      invalidData,
      validationError,
      ...parentOptions
    } = options;

    super(message, {
      code: 'ANATOMY_DATA_ERROR',
      severity: 'HIGH',
      context: `Anatomy data processing for entity: ${entityId || 'unknown'}`,
      userMessage: AnatomyDataError._getUserMessage(dataType, entityId),
      suggestions: AnatomyDataError._getSuggestions(dataType, validationError),
      ...parentOptions,
    });

    this.name = 'AnatomyDataError';
    this.entityId = entityId || null;
    this.dataType = dataType || null;
    this.invalidData = invalidData || null;
    this.validationError = validationError || null;
  }

  /**
   * Create an error for missing anatomy data
   *
   * @param {string} entityId - Entity ID missing anatomy data
   * @param {string} componentType - Expected component type
   * @returns {AnatomyDataError} Configured error instance
   */
  static missingAnatomyData(entityId, componentType = 'anatomy:body') {
    return new AnatomyDataError(
      `No ${componentType} component found for entity: ${entityId}`,
      {
        code: 'MISSING_ANATOMY_DATA',
        entityId,
        dataType: componentType,
        severity: 'HIGH',
        recoverable: true,
        userMessage: `No anatomy information found for the selected entity.`,
        suggestions: [
          'Try selecting a different entity',
          'Ensure the entity has anatomy components defined',
          'Check if the entity definition includes anatomy data',
        ],
      }
    );
  }

  /**
   * Create an error for invalid anatomy structure
   *
   * @param {string} entityId - Entity ID with invalid structure
   * @param {object} invalidData - The invalid anatomy data
   * @param {string} validationError - Specific validation failure
   * @returns {AnatomyDataError} Configured error instance
   */
  static invalidAnatomyStructure(entityId, invalidData, validationError) {
    return new AnatomyDataError(
      `Invalid anatomy structure for entity ${entityId}: ${validationError}`,
      {
        code: 'INVALID_ANATOMY_STRUCTURE',
        entityId,
        dataType: 'anatomy:body',
        invalidData,
        validationError,
        severity: 'HIGH',
        recoverable: false,
        userMessage:
          'The anatomy data for this entity is corrupted or incomplete.',
        suggestions: [
          'Try selecting a different entity',
          'Contact support if this entity should have valid anatomy data',
          'Check the entity definition for proper anatomy component structure',
        ],
      }
    );
  }

  /**
   * Create an error for missing anatomy parts
   *
   * @param {string} entityId - Entity ID missing parts
   * @param {Array<string>} missingPartIds - IDs of missing parts
   * @returns {AnatomyDataError} Configured error instance
   */
  static missingAnatomyParts(entityId, missingPartIds) {
    return new AnatomyDataError(
      `Missing anatomy parts for entity ${entityId}: ${missingPartIds.join(', ')}`,
      {
        code: 'MISSING_ANATOMY_PARTS',
        entityId,
        dataType: 'anatomy:part',
        metadata: { missingPartIds },
        severity: 'MEDIUM',
        recoverable: true,
        userMessage: 'Some anatomy parts are missing and cannot be displayed.',
        suggestions: [
          'The visualization will show available parts only',
          'Try refreshing to reload anatomy data',
          'Some parts may be loading in the background',
        ],
      }
    );
  }

  /**
   * Create an error for circular anatomy references
   *
   * @param {string} entityId - Entity ID with circular references
   * @param {Array<string>} cyclePath - Path showing the circular reference
   * @returns {AnatomyDataError} Configured error instance
   */
  static circularAnatomyReference(entityId, cyclePath) {
    return new AnatomyDataError(
      `Circular reference detected in anatomy data for entity ${entityId}: ${cyclePath.join(' -> ')}`,
      {
        code: 'CIRCULAR_ANATOMY_REFERENCE',
        entityId,
        dataType: 'anatomy:body',
        metadata: { cyclePath },
        severity: 'HIGH',
        recoverable: false,
        userMessage:
          'The anatomy data has a circular reference that prevents visualization.',
        suggestions: [
          'Try selecting a different entity',
          "This entity's anatomy data needs to be corrected",
          'Contact support to report this data issue',
        ],
      }
    );
  }

  /**
   * Get user-friendly message based on data type and entity
   *
   * @private
   * @param {string} dataType - Type of data that failed
   * @param {string} entityId - Entity ID that failed
   * @returns {string} User-friendly message
   */
  static _getUserMessage(dataType, entityId) {
    if (!dataType) {
      return `Could not process anatomy data${entityId ? ` for ${entityId}` : ''}.`;
    }

    switch (dataType) {
      case 'anatomy:body':
        return 'Could not load the main anatomy structure for this entity.';
      case 'anatomy:part':
        return 'Some anatomy parts could not be loaded properly.';
      case 'anatomy:joint':
        return 'Anatomy joint connections could not be processed.';
      default:
        return `Could not process ${dataType} data for anatomy visualization.`;
    }
  }

  /**
   * Get suggestions based on data type and validation error
   *
   * @private
   * @param {string} dataType - Type of data that failed
   * @param {string} validationError - Specific validation error
   * @returns {Array<string>} Recovery suggestions
   */
  static _getSuggestions(dataType, validationError) {
    const suggestions = [];

    if (validationError && validationError.includes('required')) {
      suggestions.push('Check that all required anatomy fields are present');
    }

    if (validationError && validationError.includes('format')) {
      suggestions.push('Verify anatomy data follows the correct format');
    }

    switch (dataType) {
      case 'anatomy:body':
        suggestions.push(
          'Ensure the entity has a valid anatomy:body component'
        );
        suggestions.push('Check that the root anatomy part is defined');
        break;
      case 'anatomy:part':
        suggestions.push('Verify all anatomy parts are properly defined');
        suggestions.push('Check for missing part references');
        break;
      case 'anatomy:joint':
        suggestions.push('Ensure joint connections are valid');
        suggestions.push('Verify joint references point to existing parts');
        break;
    }

    if (suggestions.length === 0) {
      suggestions.push('Try selecting a different entity');
      suggestions.push('Wait a moment and try again');
    }

    return suggestions;
  }
}
