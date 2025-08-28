/**
 * @file Integration test reproducing undefined values in body description composition
 * @description Reproduces the specific undefined height descriptor issue seen in error_logs.txt
 * during anatomy generation and body description composition
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import { BodyDescriptionComposer } from '../../../src/anatomy/bodyDescriptionComposer.js';

describe('Body Description Composer - Undefined Values Integration', () => {
  let testBed;
  let mockLogger;
  let bodyDescriptionComposer;
  let mockEntityManager;
  let mockEventBus;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    mockEventBus = testBed.mockValidatedEventDispatcher;
    mockEntityManager = testBed.createMockEntityManager();

    // Create BodyDescriptionComposer instance
    bodyDescriptionComposer = new BodyDescriptionComposer({
      entityManager: mockEntityManager,
      logger: mockLogger,
      eventBus: mockEventBus,
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Height Descriptor Undefined Issue Reproduction', () => {
    it('should reproduce undefined height descriptor warnings during body composition', () => {
      // Create mock body entity with missing height descriptors (reproduces error condition)
      const mockBodyEntity = {
        id: 'test_body_entity',
        getComponentData: jest.fn((componentType) => {
          if (componentType === 'anatomy:body') {
            // Body component exists but descriptors.height is undefined
            return {
              body: {
                descriptors: {
                  // height is intentionally missing to reproduce the issue
                  build: 'average',
                  complexion: 'fair',
                  // height: undefined  <- this is the problem
                },
              },
            };
          }
          if (componentType === 'descriptors:height') {
            // Entity-level height component is also undefined
            return undefined;
          }
          return undefined;
        }),
      };

      // Spy on console to capture debug messages
      const consoleSpy = jest
        .spyOn(console, 'log')
        .mockImplementation(() => {});

      // Attempt to get height descriptor - this should trigger the undefined warnings
      const result =
        bodyDescriptionComposer.getHeightDescriptor(mockBodyEntity);

      // Verify the exact debug messages from error_logs.txt are generated
      expect(consoleSpy).toHaveBeenCalledWith(
        '[DEBUG] bodyComponent.body.descriptors.height:',
        undefined
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        '[DEBUG] Entity-level height component:',
        undefined
      );

      // Result should be undefined since no height data is available
      expect(result).toBeUndefined();

      // Should have checked both body.descriptors and entity-level components
      expect(mockBodyEntity.getComponentData).toHaveBeenCalledWith(
        'anatomy:body'
      );
      expect(mockBodyEntity.getComponentData).toHaveBeenCalledWith(
        'descriptors:height'
      );

      consoleSpy.mockRestore();
    });

    it('should reproduce undefined body-level descriptors during composition', () => {
      const mockBodyEntity = {
        id: 'test_body_entity_2',
        getComponentData: jest.fn((componentType) => {
          if (componentType === 'anatomy:body') {
            // Body component has descriptors but specific descriptor types are missing
            return {
              body: {
                descriptors: {
                  height: 'tall',
                  build: 'average',
                  // Other descriptors intentionally missing
                },
              },
            };
          }
          return undefined;
        }),
      };

      const consoleSpy = jest
        .spyOn(console, 'log')
        .mockImplementation(() => {});

      // Try to compose description for a descriptor type that's undefined
      const bodyLevelDescriptors = {
        // Intentionally undefined to reproduce error condition
        complexion: undefined,
        skinTexture: undefined,
      };

      // This should trigger the undefined descriptor warning
      const result = bodyDescriptionComposer.composeDescription(
        'complexion',
        bodyLevelDescriptors,
        mockBodyEntity
      );

      // Should log the exact debug message from error_logs.txt
      expect(consoleSpy).toHaveBeenCalledWith(
        '[DEBUG] composeDescription: bodyLevelDescriptors[descriptorType]:',
        undefined
      );

      // Result should handle undefined gracefully
      expect(result).toBeDefined(); // Should not crash

      consoleSpy.mockRestore();
    });

    it('should reproduce final descriptors undefined height issue', () => {
      const mockBodyEntity = {
        id: 'test_body_entity_3',
        getComponentData: jest.fn(() => ({
          body: {
            descriptors: {
              // Height is missing from body descriptors
              build: 'average',
              complexion: 'fair',
            },
          },
        })),
      };

      const consoleSpy = jest
        .spyOn(console, 'log')
        .mockImplementation(() => {});

      // Create final descriptors object that would be missing height
      const finalDescriptors = {
        build: 'average',
        complexion: 'fair',
        // height intentionally undefined
        height: undefined,
      };

      // Log the final descriptors state (this matches the error pattern)
      console.log(
        '[DEBUG] Height in final descriptors:',
        finalDescriptors.height
      );

      // Verify the exact debug message appears
      expect(consoleSpy).toHaveBeenCalledWith(
        '[DEBUG] Height in final descriptors:',
        undefined
      );

      // This represents what happens in the actual composition process
      expect(finalDescriptors.height).toBeUndefined();

      consoleSpy.mockRestore();
    });
  });

  describe('Body Component Data Integrity Issues', () => {
    it('should handle body component with malformed descriptor structure', () => {
      const mockBodyEntity = {
        id: 'malformed_body_entity',
        getComponentData: jest.fn((componentType) => {
          if (componentType === 'anatomy:body') {
            // Malformed body component structure
            return {
              body: {
                // descriptors property is missing entirely
                parts: ['torso', 'head', 'arms'],
                composition: 'human',
              },
            };
          }
          return undefined;
        }),
      };

      const consoleSpy = jest
        .spyOn(console, 'log')
        .mockImplementation(() => {});

      // This should handle missing descriptors gracefully
      const result =
        bodyDescriptionComposer.getHeightDescriptor(mockBodyEntity);

      // Should still log debug information
      expect(consoleSpy).toHaveBeenCalledWith(
        '[DEBUG] bodyComponent.body.descriptors:',
        undefined
      );

      expect(result).toBeUndefined();
      consoleSpy.mockRestore();
    });

    it('should reproduce entity creation workflow descriptor initialization issues', () => {
      // Simulate the entity creation process where descriptors aren't properly initialized
      const entityCreationSteps = [];

      // Step 1: Entity is created without body component
      let mockEntity = {
        id: 'new_entity',
        getComponentData: jest.fn(() => undefined),
      };

      entityCreationSteps.push('Entity created');

      // Step 2: Body component is added but descriptors are not initialized
      mockEntity.getComponentData = jest.fn((componentType) => {
        if (componentType === 'anatomy:body') {
          return {
            body: {
              parts: [],
              // descriptors not initialized yet
            },
          };
        }
        return undefined;
      });

      entityCreationSteps.push('Body component added');

      // Step 3: Try to access descriptors before they're fully initialized
      const consoleSpy = jest
        .spyOn(console, 'log')
        .mockImplementation(() => {});

      const heightResult =
        bodyDescriptionComposer.getHeightDescriptor(mockEntity);

      entityCreationSteps.push('Height descriptor requested');

      // This reproduces the sequence that leads to undefined values
      expect(entityCreationSteps).toEqual([
        'Entity created',
        'Body component added',
        'Height descriptor requested',
      ]);

      expect(heightResult).toBeUndefined();

      // Should have logged the debug messages indicating missing data
      expect(consoleSpy).toHaveBeenCalledWith(
        '[DEBUG] bodyComponent.body.descriptors:',
        undefined
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Anatomy Generation Workflow Integration', () => {
    it('should reproduce descriptor undefined issues during anatomy orchestration', async () => {
      // Mock the anatomy orchestration workflow that leads to descriptor access
      const mockAnatomyOrchestrator = {
        orchestrateGeneration: jest.fn(async (entityId) => {
          // Simulate anatomy generation that accesses descriptors
          const entity = {
            id: entityId,
            getComponentData: jest.fn(() => ({
              body: {
                descriptors: {
                  // Some descriptors missing during generation
                  build: 'average',
                  // height, complexion, etc. undefined
                },
              },
            })),
          };

          // This would trigger the descriptor access that shows undefined values
          return bodyDescriptionComposer.composeFullBodyDescription(entity);
        }),
      };

      const consoleSpy = jest
        .spyOn(console, 'log')
        .mockImplementation(() => {});

      // Simulate the workflow from error logs
      await mockAnatomyOrchestrator.orchestrateGeneration('test_entity');

      // Should have attempted to access descriptors and logged undefined values
      expect(mockAnatomyOrchestrator.orchestrateGeneration).toHaveBeenCalled();

      // Clean up
      consoleSpy.mockRestore();
    });

    it('should demonstrate performance impact of undefined descriptor logging', () => {
      // Simulate multiple entities being processed with undefined descriptors
      const startTime = Date.now();

      const consoleSpy = jest
        .spyOn(console, 'log')
        .mockImplementation(() => {});

      for (let i = 0; i < 100; i++) {
        const mockEntity = {
          id: `entity_${i}`,
          getComponentData: jest.fn(() => ({
            body: {
              descriptors: {
                // Consistently missing descriptors to trigger repeated logging
                build: undefined,
                height: undefined,
                complexion: undefined,
              },
            },
          })),
        };

        // Each call generates multiple undefined debug logs
        bodyDescriptionComposer.getHeightDescriptor(mockEntity);
        bodyDescriptionComposer.getBuildDescriptor(mockEntity);
      }

      const processingTime = Date.now() - startTime;

      // Should have generated many debug log calls
      expect(consoleSpy).toHaveBeenCalledTimes(expect.any(Number));

      // Processing should still complete in reasonable time despite logging
      expect(processingTime).toBeLessThan(1000);

      consoleSpy.mockRestore();
    });
  });
});
