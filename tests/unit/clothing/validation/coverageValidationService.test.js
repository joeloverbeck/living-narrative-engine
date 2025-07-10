import { beforeEach, describe, it, expect, jest } from '@jest/globals';
import { CoverageValidationService } from '../../../../src/clothing/validation/coverageValidationService.js';
import { InvalidArgumentError } from '../../../../src/errors/invalidArgumentError.js';

/** Helper to create minimal mocks for dependencies */
function createMocks() {
  return {
    entityManager: {
      getComponentData: jest.fn(),
      getEntityInstance: jest.fn(),
    },
    logger: {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
    eventDispatcher: {
      dispatch: jest.fn(),
    },
  };
}

describe('CoverageValidationService', () => {
  let entityManager;
  let logger;
  let eventDispatcher;
  let service;

  beforeEach(() => {
    ({ entityManager, logger, eventDispatcher } = createMocks());
    service = new CoverageValidationService({
      entityManager,
      logger,
      eventDispatcher,
    });
  });

  describe('constructor', () => {
    it('should create service with valid dependencies', () => {
      expect(service).toBeInstanceOf(CoverageValidationService);
    });

    it('should throw error when entityManager is missing', () => {
      expect(
        () =>
          new CoverageValidationService({
            logger,
            eventDispatcher,
          })
      ).toThrow(InvalidArgumentError);
    });

    it('should throw error when logger is missing', () => {
      expect(
        () =>
          new CoverageValidationService({
            entityManager,
            eventDispatcher,
          })
      ).toThrow(InvalidArgumentError);
    });

    it('should throw error when eventDispatcher is missing', () => {
      expect(
        () =>
          new CoverageValidationService({
            entityManager,
            logger,
          })
      ).toThrow(InvalidArgumentError);
    });
  });

  describe('validateCoverage', () => {
    beforeEach(() => {
      // Mock anatomy body component
      entityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'anatomy:body') {
            return {
              body: {
                root: 'torso1',
                parts: { torso: 'torso1' },
              },
            };
          }
          if (componentId === 'clothing:wearable') {
            return {
              wearableType: 'shirt',
              layer: 'base',
              coverage: {
                required: ['left_chest', 'right_chest'],
                optional: ['left_shoulder', 'right_shoulder'],
                exclusions: [],
              },
              size: 'm',
              material: 'cotton',
              equipmentSlots: {
                primary: 'torso_clothing',
              },
            };
          }
          return null;
        }
      );
    });

    it('should validate coverage successfully when all requirements met', async () => {
      const result = await service.validateCoverage('entity1', 'clothing1');

      expect(result.valid).toBe(true);
      expect(result.coverage).toBeDefined();
      expect(result.coverage.requiredCovered).toContain('left_chest');
      expect(result.coverage.requiredCovered).toContain('right_chest');
    });

    it('should handle missing required body parts', async () => {
      // Mock clothing item that requires parts not available
      entityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'anatomy:body') {
            return {
              body: {
                root: 'torso1',
                parts: { torso: 'torso1' },
              },
            };
          }
          if (componentId === 'clothing:wearable') {
            return {
              wearableType: 'wings',
              layer: 'accessories',
              coverage: {
                required: ['left_wing', 'right_wing'], // Parts that don't exist
                optional: [],
                exclusions: [],
              },
              size: 'm',
              equipmentSlots: {
                primary: 'back_clothing',
              },
            };
          }
          return null;
        }
      );

      const result = await service.validateCoverage('entity1', 'clothing1');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "Required body part 'left_wing' is not available"
      );
      expect(result.errors).toContain(
        "Required body part 'right_wing' is not available"
      );
    });

    it('should handle exclusions properly', async () => {
      // Mock clothing item that excludes existing parts
      entityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'anatomy:body') {
            return {
              body: {
                root: 'torso1',
                parts: { torso: 'torso1' },
              },
            };
          }
          if (componentId === 'clothing:wearable') {
            return {
              wearableType: 'tight_shirt',
              layer: 'base',
              coverage: {
                required: ['left_chest', 'right_chest'],
                optional: [],
                exclusions: ['left_chest'], // Conflicts with required
              },
              size: 'm',
              equipmentSlots: {
                primary: 'torso_clothing',
              },
            };
          }
          return null;
        }
      );

      const result = await service.validateCoverage('entity1', 'clothing1');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "Clothing cannot be worn with 'left_chest' present"
      );
    });

    it('should allow partial coverage when option enabled', async () => {
      // Mock clothing item that requires parts not available
      entityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'anatomy:body') {
            return {
              body: {
                root: 'torso1',
                parts: { torso: 'torso1' },
              },
            };
          }
          if (componentId === 'clothing:wearable') {
            return {
              wearableType: 'partial_shirt',
              layer: 'base',
              coverage: {
                required: ['left_chest', 'missing_part'],
                optional: [],
                exclusions: [],
              },
              size: 'm',
              equipmentSlots: {
                primary: 'torso_clothing',
              },
            };
          }
          return null;
        }
      );

      const result = await service.validateCoverage('entity1', 'clothing1', {
        allowPartialCoverage: true,
      });

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain(
        "Optional required part 'missing_part' is missing"
      );
    });

    it('should handle non-wearable items', async () => {
      entityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'clothing:wearable') {
            return null; // Not wearable
          }
          return null;
        }
      );

      const result = await service.validateCoverage('entity1', 'non_wearable');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Item 'non_wearable' is not wearable");
    });

    it('should handle entity with no anatomy', async () => {
      entityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'anatomy:body') {
            return null; // No anatomy
          }
          if (componentId === 'clothing:wearable') {
            return {
              coverage: { required: [], optional: [], exclusions: [] },
              size: 'm',
              equipmentSlots: { primary: 'torso_clothing' },
            };
          }
          return null;
        }
      );

      const result = await service.validateCoverage('entity1', 'clothing1');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Entity has no anatomy data');
    });

    it('should dispatch validation event', async () => {
      await service.validateCoverage('entity1', 'clothing1');

      expect(eventDispatcher.dispatch).toHaveBeenCalledWith({
        type: 'clothing_coverage_validated',
        payload: expect.objectContaining({
          entityId: 'entity1',
          clothingItemId: 'clothing1',
          validationResult: 'valid',
          timestamp: expect.any(Number),
        }),
      });
    });
  });

  describe('validateSize', () => {
    beforeEach(() => {
      entityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'clothing:wearable') {
            return {
              size: 'l',
              wearableType: 'shirt',
            };
          }
          return null;
        }
      );
    });

    it('should validate compatible sizes', async () => {
      const result = await service.validateSize('entity1', 'clothing1');

      expect(result.compatible).toBe(true);
      expect(result.entitySize).toBe('m'); // Default mock size
      expect(result.itemSize).toBe('l');
    });

    it('should detect size incompatibility', async () => {
      entityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'clothing:wearable') {
            return {
              size: 'xs', // Too small for default 'm' entity
              wearableType: 'shirt',
            };
          }
          return null;
        }
      );

      const result = await service.validateSize('entity1', 'clothing1');

      expect(result.compatible).toBe(false);
      expect(result.reason).toBe('Size mismatch: entity m vs item xs');
    });

    it('should handle non-wearable items', async () => {
      entityManager.getComponentData.mockReturnValue(null);

      const result = await service.validateSize('entity1', 'non_wearable');

      expect(result.compatible).toBe(false);
      expect(result.reason).toBe('Item is not wearable');
    });
  });

  describe('getCoveredBodyParts', () => {
    beforeEach(() => {
      entityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'anatomy:body') {
            return {
              body: {
                root: 'torso1',
                parts: { torso: 'torso1' },
              },
            };
          }
          if (componentId === 'clothing:wearable') {
            return {
              coverage: {
                required: ['left_chest', 'right_chest'],
                optional: ['left_shoulder', 'right_shoulder'],
                exclusions: [],
              },
            };
          }
          return null;
        }
      );
    });

    it('should return covered body parts', async () => {
      const result = await service.getCoveredBodyParts('entity1', 'clothing1');

      expect(result.success).toBe(true);
      expect(result.coveredParts).toContain('left_chest');
      expect(result.coveredParts).toContain('right_chest');
      expect(result.coveredParts).toContain('left_shoulder');
      expect(result.coveredParts).toContain('right_shoulder');
    });

    it('should only include parts that exist on entity', async () => {
      entityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'anatomy:body') {
            return {
              body: {
                root: 'torso1',
                parts: { torso: 'torso1' },
              },
            };
          }
          if (componentId === 'clothing:wearable') {
            return {
              coverage: {
                required: ['left_chest', 'missing_part'],
                optional: ['right_shoulder', 'another_missing_part'],
                exclusions: [],
              },
            };
          }
          return null;
        }
      );

      const result = await service.getCoveredBodyParts('entity1', 'clothing1');

      expect(result.success).toBe(true);
      expect(result.coveredParts).toContain('left_chest');
      expect(result.coveredParts).toContain('right_shoulder');
      expect(result.coveredParts).not.toContain('missing_part');
      expect(result.coveredParts).not.toContain('another_missing_part');
    });

    it('should handle non-wearable items', async () => {
      entityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'clothing:wearable') {
            return null;
          }
          return null;
        }
      );

      const result = await service.getCoveredBodyParts(
        'entity1',
        'non_wearable'
      );

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Item is not wearable');
    });
  });

  describe('checkModestyCoverage', () => {
    beforeEach(() => {
      entityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'anatomy:body') {
            return {
              body: {
                root: 'torso1',
                parts: { torso: 'torso1' },
              },
            };
          }
          if (componentId === 'clothing:wearable') {
            if (entityId === 'shirt1') {
              return {
                coverage: {
                  required: ['left_chest', 'right_chest'],
                  optional: [],
                  exclusions: [],
                },
              };
            }
            if (entityId === 'pants1') {
              return {
                coverage: {
                  required: ['penis', 'left_testicle', 'right_testicle'],
                  optional: [],
                  exclusions: [],
                },
              };
            }
          }
          return null;
        }
      );
    });

    it('should report adequate coverage when critical parts covered', async () => {
      const result = await service.checkModestyCoverage('entity1', [
        'shirt1',
        'pants1',
      ]);

      expect(result.adequate).toBe(true);
      expect(result.uncoveredCriticalParts).toBeUndefined();
    });

    it('should detect uncovered critical parts', async () => {
      const result = await service.checkModestyCoverage('entity1', ['shirt1']); // No pants

      expect(result.adequate).toBe(false);
      expect(result.uncoveredCriticalParts).toContain('penis');
      expect(result.uncoveredCriticalParts).toContain('left_testicle');
      expect(result.uncoveredCriticalParts).toContain('right_testicle');
      expect(result.suggestions).toContain(
        'Consider equipping underwear or lower body clothing'
      );
    });

    it('should provide appropriate suggestions', async () => {
      const result = await service.checkModestyCoverage('entity1', []); // No clothing

      expect(result.adequate).toBe(false);
      expect(result.suggestions).toContain(
        'Consider equipping a bra, shirt, or upper body clothing'
      );
      expect(result.suggestions).toContain(
        'Consider equipping underwear or lower body clothing'
      );
    });

    it('should handle entity with no anatomy gracefully', async () => {
      entityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'anatomy:body') {
            return null;
          }
          return null;
        }
      );

      const result = await service.checkModestyCoverage('entity1', []);

      expect(result.adequate).toBe(true); // Default to adequate when anatomy can't be determined
    });
  });

  describe('size compatibility matrix', () => {
    it('should have correct size compatibility mappings', () => {
      const compatibility = CoverageValidationService.SIZE_COMPATIBILITY;

      expect(compatibility.xs).toEqual(['xs', 's']);
      expect(compatibility.s).toEqual(['xs', 's', 'm']);
      expect(compatibility.m).toEqual(['s', 'm', 'l']);
      expect(compatibility.l).toEqual(['m', 'l', 'xl']);
      expect(compatibility.xl).toEqual(['l', 'xl', 'xxl']);
      expect(compatibility.xxl).toEqual(['xl', 'xxl']);
    });
  });

  describe('slot body part mapping', () => {
    it('should have correct slot to body part mappings', () => {
      const mapping = CoverageValidationService.SLOT_BODY_PART_MAPPING;

      expect(mapping.torso_clothing).toContain('left_chest');
      expect(mapping.torso_clothing).toContain('right_chest');
      expect(mapping.lower_torso_clothing).toContain('left_hip');
      expect(mapping.lower_torso_clothing).toContain('right_hip');
      expect(mapping.feet_clothing).toContain('left_foot');
      expect(mapping.feet_clothing).toContain('right_foot');
    });
  });
});
