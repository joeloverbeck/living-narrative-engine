/**
 * @file Resolves clothing layer with clear precedence rules
 * Implements Recipe > Entity > Blueprint hierarchy
 */

import { BaseService } from '../../utils/serviceBase.js';
import {
  assertPresent,
} from '../../utils/dependencyUtils.js';
import { ValidationError } from '../../errors/validationError.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

/**
 * Resolves clothing layer with clear precedence rules
 * Implements Recipe > Entity > Blueprint hierarchy
 */
export class LayerResolutionService extends BaseService {
  /** @type {ILogger} */
  #logger;

  /**
   * Creates an instance of LayerResolutionService
   *
   * @param {object} deps - Constructor dependencies
   * @param {ILogger} deps.logger - Logger instance
   */
  constructor({ logger }) {
    super();

    this.#logger = this._init('LayerResolutionService', logger, {});
  }

  /**
   * Resolves final layer for clothing item using precedence hierarchy
   *
   * @param {string} [recipeLayerOverride] - Recipe override (highest precedence)
   * @param {string} [entityLayer] - Entity definition layer (medium precedence)
   * @param {string} [blueprintDefaultLayer] - Blueprint default layer (lowest precedence)
   * @returns {string} The resolved layer
   */
  resolveLayer(recipeLayerOverride, entityLayer, blueprintDefaultLayer) {
    // Recipe override has highest priority
    if (recipeLayerOverride && typeof recipeLayerOverride === 'string') {
      this.#logger.debug(
        `Using recipe layer override: '${recipeLayerOverride}'`
      );
      return recipeLayerOverride;
    }
    
    // Entity definition has medium priority  
    if (entityLayer && typeof entityLayer === 'string') {
      this.#logger.debug(
        `Using entity layer: '${entityLayer}'`
      );
      return entityLayer;
    }
    
    // Blueprint default has lowest priority
    const finalLayer = blueprintDefaultLayer || 'base';
    this.#logger.debug(
      `Using blueprint default layer: '${finalLayer}'`
    );
    return finalLayer;
  }

  /**
   * Validates that a layer is allowed by blueprint configuration
   *
   * @param {string} layer - The layer to validate
   * @param {string[]} allowedLayers - Array of allowed layers from blueprint
   * @returns {boolean} True if layer is allowed, false otherwise
   */
  validateLayerAllowed(layer, allowedLayers) {
    assertPresent(
      layer,
      'Layer is required for validation',
      ValidationError,
      this.#logger
    );

    if (!allowedLayers || !Array.isArray(allowedLayers)) {
      this.#logger.warn(
        'No allowed layers specified, allowing any layer'
      );
      return true;
    }

    const isAllowed = allowedLayers.includes(layer);
    
    if (!isAllowed) {
      this.#logger.debug(
        `Layer '${layer}' is not in allowed layers: [${allowedLayers.join(', ')}]`
      );
    }

    return isAllowed;
  }

  /**
   * Resolves layer and validates it against blueprint constraints
   *
   * @param {string} [recipeLayerOverride] - Recipe override (highest precedence)
   * @param {string} [entityLayer] - Entity definition layer (medium precedence)  
   * @param {string} [blueprintDefaultLayer] - Blueprint default layer (lowest precedence)
   * @param {string[]} [allowedLayers] - Array of allowed layers from blueprint
   * @returns {{layer: string, isValid: boolean, error?: string}} Resolution result
   */
  resolveAndValidateLayer(
    recipeLayerOverride,
    entityLayer,
    blueprintDefaultLayer,
    allowedLayers
  ) {
    try {
      // First resolve the layer using precedence hierarchy
      const resolvedLayer = this.resolveLayer(
        recipeLayerOverride,
        entityLayer,
        blueprintDefaultLayer
      );

      // Then validate against blueprint constraints
      const isValid = this.validateLayerAllowed(resolvedLayer, allowedLayers);

      if (!isValid) {
        return {
          layer: resolvedLayer,
          isValid: false,
          error: `Layer '${resolvedLayer}' is not allowed. Allowed layers: [${(allowedLayers || []).join(', ')}]`,
        };
      }

      return {
        layer: resolvedLayer,
        isValid: true,
      };
    } catch (error) {
      this.#logger.error(
        'Failed to resolve and validate layer',
        error
      );
      return {
        layer: 'base',
        isValid: false,
        error: error.message,
      };
    }
  }

  /**
   * Gets the precedence explanation for documentation/debugging
   *
   * @returns {string[]} Array of precedence levels from highest to lowest
   */
  getPrecedenceOrder() {
    return [
      'Recipe override (highest precedence)',
      'Entity default (medium precedence)',
      'Blueprint default (lowest precedence)',
    ];
  }
}

export default LayerResolutionService;