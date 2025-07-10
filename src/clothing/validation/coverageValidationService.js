/**
 * @file CoverageValidationService - Validates clothing coverage against entity anatomy
 *
 * Provides gender-flexible validation ensuring clothing items are compatible
 * with entity anatomy while handling missing or optional body parts gracefully.
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { InvalidArgumentError } from '../../errors/invalidArgumentError.js';

/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

/**
 * Service for validating clothing coverage against entity anatomy
 *
 * Implements gender-flexible validation that gracefully handles diverse
 * anatomical configurations and missing body parts.
 */
export class CoverageValidationService {
  /** @type {IEntityManager} */
  #entityManager;
  /** @type {ILogger} */
  #logger;
  /** @type {ISafeEventDispatcher} */
  #eventDispatcher;

  /**
   * Size compatibility matrix
   *
   * @readonly
   */
  static SIZE_COMPATIBILITY = {
    xs: ['xs', 's'],
    s: ['xs', 's', 'm'],
    m: ['s', 'm', 'l'],
    l: ['m', 'l', 'xl'],
    xl: ['l', 'xl', 'xxl'],
    xxl: ['xl', 'xxl'],
  };

  /**
   * Default body part mappings for clothing slots
   *
   * @readonly
   */
  static SLOT_BODY_PART_MAPPING = {
    torso_clothing: [
      'left_chest',
      'right_chest',
      'left_shoulder',
      'right_shoulder',
    ],
    lower_torso_clothing: ['left_hip', 'right_hip', 'pubic_hair'],
    left_arm_clothing: ['left_shoulder', 'left_arm'],
    right_arm_clothing: ['right_shoulder', 'right_arm'],
    left_leg_clothing: ['left_hip', 'left_leg'],
    right_leg_clothing: ['right_hip', 'right_leg'],
    feet_clothing: ['left_foot', 'right_foot'],
    head_clothing: ['head', 'neck'],
  };

  /**
   * Creates an instance of CoverageValidationService
   *
   * @param {object} deps - Constructor dependencies
   * @param {IEntityManager} deps.entityManager - Entity manager for entity operations
   * @param {ILogger} deps.logger - Logger instance
   * @param {ISafeEventDispatcher} deps.eventDispatcher - Event dispatcher for validation events
   */
  constructor({ entityManager, logger, eventDispatcher }) {
    validateDependency(entityManager, 'IEntityManager');
    validateDependency(logger, 'ILogger');
    validateDependency(eventDispatcher, 'ISafeEventDispatcher');

    this.#entityManager = entityManager;
    this.#logger = logger;
    this.#eventDispatcher = eventDispatcher;
  }

  /**
   * Validates if a clothing item can be equipped based on anatomy coverage
   *
   * @param {string} entityId - Entity to validate coverage for
   * @param {string} clothingItemId - Clothing item to validate
   * @param {object} [options] - Validation options
   * @param {boolean} [options.allowPartialCoverage] - Allow partial coverage if some required parts missing
   * @param {boolean} [options.strictExclusions] - Enforce exclusion rules strictly
   * @returns {Promise<{valid: boolean, coverage?: object, errors?: string[], warnings?: string[]}>}
   */
  async validateCoverage(entityId, clothingItemId, options = {}) {
    const { allowPartialCoverage = false, strictExclusions = true } = options;

    try {
      this.#logger.debug(
        `CoverageValidationService: Validating coverage for clothing '${clothingItemId}' on entity '${entityId}'`
      );

      // Get clothing item data
      const clothingData = this.#entityManager.getComponentData(
        clothingItemId,
        'clothing:wearable'
      );
      if (!clothingData) {
        throw new InvalidArgumentError(
          `Item '${clothingItemId}' is not wearable`
        );
      }

      // Get entity anatomy
      const anatomyResult = await this.#getEntityAnatomy(entityId);
      if (!anatomyResult.success) {
        return {
          valid: false,
          errors: anatomyResult.errors,
        };
      }

      const anatomy = anatomyResult.anatomy;
      const errors = [];
      const warnings = [];

      // Validate required coverage
      const requiredValidation = await this.#validateRequiredCoverage(
        anatomy,
        clothingData.coverage.required,
        allowPartialCoverage
      );

      if (!requiredValidation.valid) {
        errors.push(...requiredValidation.errors);
      }
      if (requiredValidation.warnings) {
        warnings.push(...requiredValidation.warnings);
      }

      // Validate exclusions
      if (strictExclusions) {
        const exclusionValidation = await this.#validateExclusions(
          anatomy,
          clothingData.coverage.exclusions || []
        );

        if (!exclusionValidation.valid) {
          errors.push(...exclusionValidation.errors);
        }
      }

      // Validate size compatibility
      const sizeValidation = await this.#validateSizeCompatibility(
        entityId,
        clothingData
      );
      if (!sizeValidation.valid) {
        if (sizeValidation.severity === 'error') {
          errors.push(...sizeValidation.errors);
        } else {
          warnings.push(...sizeValidation.warnings);
        }
      }

      // Calculate coverage details
      const coverageDetails = await this.#calculateCoverageDetails(
        anatomy,
        clothingData.coverage,
        clothingData.equipmentSlots
      );

      const validationResult = {
        valid: errors.length === 0,
        coverage: coverageDetails,
        errors: errors.length > 0 ? errors : undefined,
        warnings: warnings.length > 0 ? warnings : undefined,
      };

      // Dispatch validation event
      await this.#eventDispatcher.dispatch({
        type: 'clothing_coverage_validated',
        payload: {
          entityId,
          clothingItemId,
          validationResult: validationResult.valid ? 'valid' : 'invalid',
          requiredCoverage: clothingData.coverage.required,
          availableParts: anatomy.availableParts,
          missingParts: coverageDetails.missingRequired || [],
          excludedParts: coverageDetails.excludedPresent || [],
          optionalCoverage: clothingData.coverage.optional || [],
          sizeCompatibility: sizeValidation.details,
          validationDetails: {
            errors: errors.length > 0 ? errors : undefined,
            warnings: warnings.length > 0 ? warnings : undefined,
          },
          timestamp: Date.now(),
        },
      });

      return validationResult;
    } catch (error) {
      this.#logger.error(
        `CoverageValidationService: Error validating coverage for '${clothingItemId}' on '${entityId}'`,
        { error }
      );
      return {
        valid: false,
        errors: [error.message],
      };
    }
  }

  /**
   * Validates size compatibility between entity and clothing item
   *
   * @param {string} entityId - Entity to check size for
   * @param {string} clothingItemId - Clothing item to check
   * @returns {Promise<{compatible: boolean, entitySize?: string, itemSize?: string, reason?: string}>}
   */
  async validateSize(entityId, clothingItemId) {
    try {
      // Get clothing item size
      const clothingData = this.#entityManager.getComponentData(
        clothingItemId,
        'clothing:wearable'
      );
      if (!clothingData) {
        return {
          compatible: false,
          reason: 'Item is not wearable',
        };
      }

      // Get entity size (this would integrate with anatomy system)
      const entitySize = await this.#getEntitySize(entityId);

      const compatible = this.#checkSizeCompatibility(
        entitySize,
        clothingData.size
      );

      return {
        compatible,
        entitySize,
        itemSize: clothingData.size,
        reason: compatible
          ? undefined
          : `Size mismatch: entity ${entitySize} vs item ${clothingData.size}`,
      };
    } catch (error) {
      this.#logger.error(
        `CoverageValidationService: Error validating size for '${clothingItemId}' on '${entityId}'`,
        { error }
      );
      return {
        compatible: false,
        reason: error.message,
      };
    }
  }

  /**
   * Gets covered body parts for a specific clothing item
   *
   * @param {string} entityId - Entity to check coverage for
   * @param {string} clothingItemId - Clothing item to analyze
   * @returns {Promise<{success: boolean, coveredParts?: string[], errors?: string[]}>}
   */
  async getCoveredBodyParts(entityId, clothingItemId) {
    try {
      const clothingData = this.#entityManager.getComponentData(
        clothingItemId,
        'clothing:wearable'
      );
      if (!clothingData) {
        return {
          success: false,
          errors: ['Item is not wearable'],
        };
      }

      const anatomyResult = await this.#getEntityAnatomy(entityId);
      if (!anatomyResult.success) {
        return {
          success: false,
          errors: anatomyResult.errors,
        };
      }

      const coveredParts = [];
      const anatomy = anatomyResult.anatomy;

      // Add required parts that exist
      for (const part of clothingData.coverage.required) {
        if (anatomy.availableParts.includes(part)) {
          coveredParts.push(part);
        }
      }

      // Add optional parts that exist
      for (const part of clothingData.coverage.optional || []) {
        if (anatomy.availableParts.includes(part)) {
          coveredParts.push(part);
        }
      }

      return {
        success: true,
        coveredParts: [...new Set(coveredParts)], // Remove duplicates
      };
    } catch (error) {
      this.#logger.error(
        `CoverageValidationService: Error getting covered body parts for '${clothingItemId}' on '${entityId}'`,
        { error }
      );
      return {
        success: false,
        errors: [error.message],
      };
    }
  }

  /**
   * Checks if clothing provides adequate coverage for modesty/social requirements
   *
   * @param {string} entityId - Entity to check
   * @param {string[]} equippedClothingIds - Currently equipped clothing items
   * @returns {Promise<{adequate: boolean, uncoveredCriticalParts?: string[], suggestions?: string[]}>}
   */
  async checkModestyCoverage(entityId, equippedClothingIds) {
    try {
      // Define critical parts that typically require coverage
      const criticalParts = [
        'penis',
        'vagina',
        'left_chest',
        'right_chest',
        'left_testicle',
        'right_testicle',
      ];

      const anatomyResult = await this.#getEntityAnatomy(entityId);
      if (!anatomyResult.success) {
        return {
          adequate: true, // If we can't determine anatomy, assume adequate
        };
      }

      const anatomy = anatomyResult.anatomy;
      const uncoveredCritical = [];
      const suggestions = [];

      // Check which critical parts exist on this entity
      const existingCriticalParts = criticalParts.filter((part) =>
        anatomy.availableParts.includes(part)
      );

      // Calculate total coverage from all equipped items
      const totalCoverage = new Set();
      for (const clothingId of equippedClothingIds) {
        const coverageResult = await this.getCoveredBodyParts(
          entityId,
          clothingId
        );
        if (coverageResult.success) {
          coverageResult.coveredParts.forEach((part) =>
            totalCoverage.add(part)
          );
        }
      }

      // Check for uncovered critical parts
      for (const criticalPart of existingCriticalParts) {
        if (!totalCoverage.has(criticalPart)) {
          uncoveredCritical.push(criticalPart);

          // Provide suggestions based on uncovered part
          if (
            ['penis', 'vagina', 'left_testicle', 'right_testicle'].includes(
              criticalPart
            )
          ) {
            suggestions.push(
              'Consider equipping underwear or lower body clothing'
            );
          } else if (['left_chest', 'right_chest'].includes(criticalPart)) {
            suggestions.push(
              'Consider equipping a bra, shirt, or upper body clothing'
            );
          }
        }
      }

      return {
        adequate: uncoveredCritical.length === 0,
        uncoveredCriticalParts:
          uncoveredCritical.length > 0 ? uncoveredCritical : undefined,
        suggestions:
          suggestions.length > 0 ? [...new Set(suggestions)] : undefined,
      };
    } catch (error) {
      this.#logger.error(
        `CoverageValidationService: Error checking modesty coverage for entity '${entityId}'`,
        { error }
      );
      return {
        adequate: true, // Default to adequate on error
      };
    }
  }

  /**
   * Gets entity anatomy information
   *
   * @param entityId
   * @private
   */
  async #getEntityAnatomy(entityId) {
    try {
      // Get anatomy body component
      const bodyComponent = this.#entityManager.getComponentData(
        entityId,
        'anatomy:body'
      );
      if (!bodyComponent?.body) {
        return {
          success: false,
          errors: ['Entity has no anatomy data'],
        };
      }

      // Get all body parts (this would integrate with BodyGraphService)
      const availableParts = [];

      // In a real implementation, this would use the BodyGraphService
      // to traverse the anatomy graph and collect all available body parts
      // For now, we'll simulate based on common anatomy patterns

      // This is a simplified approach - in reality we'd traverse the anatomy graph
      const mockAnatomy = this.#getMockAnatomyParts(entityId);
      availableParts.push(...mockAnatomy);

      return {
        success: true,
        anatomy: {
          availableParts,
          rootId: bodyComponent.body.root,
        },
      };
    } catch (error) {
      return {
        success: false,
        errors: [error.message],
      };
    }
  }

  /**
   * Validates required coverage against available anatomy
   *
   * @param anatomy
   * @param requiredParts
   * @param allowPartial
   * @private
   */
  async #validateRequiredCoverage(anatomy, requiredParts, allowPartial) {
    const errors = [];
    const warnings = [];
    const missingRequired = [];

    for (const requiredPart of requiredParts) {
      if (!anatomy.availableParts.includes(requiredPart)) {
        missingRequired.push(requiredPart);

        if (allowPartial) {
          warnings.push(`Optional required part '${requiredPart}' is missing`);
        } else {
          errors.push(`Required body part '${requiredPart}' is not available`);
        }
      }
    }

    return {
      valid: allowPartial || errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined,
      missingRequired,
    };
  }

  /**
   * Validates exclusions against available anatomy
   *
   * @param anatomy
   * @param exclusions
   * @private
   */
  async #validateExclusions(anatomy, exclusions) {
    const errors = [];
    const excludedPresent = [];

    for (const excludedPart of exclusions) {
      if (anatomy.availableParts.includes(excludedPart)) {
        excludedPresent.push(excludedPart);
        errors.push(`Clothing cannot be worn with '${excludedPart}' present`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      excludedPresent,
    };
  }

  /**
   * Validates size compatibility
   *
   * @param entityId
   * @param clothingData
   * @private
   */
  async #validateSizeCompatibility(entityId, clothingData) {
    const entitySize = await this.#getEntitySize(entityId);
    const compatible = this.#checkSizeCompatibility(
      entitySize,
      clothingData.size
    );

    return {
      valid: compatible,
      severity: compatible ? 'none' : 'warning', // Size mismatches are warnings, not hard errors
      errors: compatible
        ? []
        : [
            `Size incompatibility: entity ${entitySize} vs clothing ${clothingData.size}`,
          ],
      warnings: compatible
        ? []
        : [`Size mismatch may affect fit and appearance`],
      details: {
        entitySize,
        itemSize: clothingData.size,
        compatible,
      },
    };
  }

  /**
   * Calculates detailed coverage information
   *
   * @param anatomy
   * @param coverage
   * @param equipmentSlots
   * @private
   */
  async #calculateCoverageDetails(anatomy, coverage, equipmentSlots) {
    const details = {
      requiredCovered: [],
      optionalCovered: [],
      missingRequired: [],
      excludedPresent: [],
      totalCoverage: 0,
    };

    // Check required coverage
    for (const part of coverage.required) {
      if (anatomy.availableParts.includes(part)) {
        details.requiredCovered.push(part);
      } else {
        details.missingRequired.push(part);
      }
    }

    // Check optional coverage
    for (const part of coverage.optional || []) {
      if (anatomy.availableParts.includes(part)) {
        details.optionalCovered.push(part);
      }
    }

    // Check exclusions
    for (const part of coverage.exclusions || []) {
      if (anatomy.availableParts.includes(part)) {
        details.excludedPresent.push(part);
      }
    }

    // Calculate coverage percentage
    const totalPossibleCoverage =
      coverage.required.length + (coverage.optional?.length || 0);
    const actualCoverage =
      details.requiredCovered.length + details.optionalCovered.length;
    details.totalCoverage =
      totalPossibleCoverage > 0
        ? (actualCoverage / totalPossibleCoverage) * 100
        : 100;

    return details;
  }

  /**
   * Gets entity size (simplified implementation)
   *
   * @param entityId
   * @private
   */
  async #getEntitySize(entityId) {
    // In a real implementation, this would determine size based on anatomy
    // For now, return a default size
    return 'm';
  }

  /**
   * Checks if two sizes are compatible
   *
   * @param entitySize
   * @param clothingSize
   * @private
   */
  #checkSizeCompatibility(entitySize, clothingSize) {
    const compatibility =
      CoverageValidationService.SIZE_COMPATIBILITY[entitySize] || [];
    return compatibility.includes(clothingSize);
  }

  /**
   * Gets mock anatomy parts for testing (simplified implementation)
   *
   * @param entityId
   * @private
   */
  #getMockAnatomyParts(entityId) {
    // This is a simplified mock - in reality, this would traverse the anatomy graph
    // to get all available body parts for the entity
    return [
      'left_chest',
      'right_chest',
      'left_shoulder',
      'right_shoulder',
      'left_hip',
      'right_hip',
      'left_arm',
      'right_arm',
      'left_leg',
      'right_leg',
      'left_foot',
      'right_foot',
      'neck',
      'head',
      'penis',
      'left_testicle',
      'right_testicle',
      'pubic_hair',
    ];
  }
}
