/**
 * @file Integration tests for dependency injection issues in core motivations generator
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { CoreMotivationsGeneratorController } from '../../../src/coreMotivationsGenerator/controllers/CoreMotivationsGeneratorController.js';
import { CoreMotivationsGenerator } from '../../../src/characterBuilder/services/CoreMotivationsGenerator.js';
import { CharacterBuilderBootstrap } from '../../../src/characterBuilder/CharacterBuilderBootstrap.js';
import { IntegrationTestBed } from '../../common/integrationTestBed.js';

describe('Core Motivations Generator - Dependency Injection Issues', () => {
  let testBed;

  beforeEach(async () => {
    testBed = new IntegrationTestBed();
    await testBed.initialize();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Generator Function Error', () => {
    it('should reproduce the "generate is not a function" error when class is passed instead of instance', () => {
      // Arrange - Create a mock object that simulates having a class instead of instance
      const mockController = {
        // This simulates the controller having the class constructor as a property
        '#coreMotivationsGenerator': CoreMotivationsGenerator, // Class, not instance

        // This simulates what happens in the actual error
        tryGenerateMotivations: function () {
          try {
            // This is what happens in CoreMotivationsGeneratorController.js:811
            // __privateGet(...) returns the class constructor, not an instance
            const generator = this['#coreMotivationsGenerator'];
            return generator.generate({
              /* params */
            }); // This fails because it's a class, not instance
          } catch (error) {
            return error;
          }
        },
      };

      // Act - Try to call generate on what's actually a class constructor
      const result = mockController.tryGenerateMotivations();

      // Assert - Should fail with "generate is not a function" or similar
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toMatch(
        /generate is not a function|Cannot read.*generate/
      );
    });

    it('should work correctly when instance is passed instead of class', () => {
      // Arrange - Create proper mock with instance
      const mockGeneratorInstance = {
        generate: jest
          .fn()
          .mockReturnValue(Promise.resolve(['motivation1', 'motivation2'])),
      };

      const mockController = {
        // This simulates having a proper instance
        '#coreMotivationsGenerator': mockGeneratorInstance,

        // This simulates what should happen when correctly configured
        tryGenerateMotivations: function () {
          const generator = this['#coreMotivationsGenerator'];
          return generator.generate({
            /* params */
          });
        },
      };

      // Act - Try to call generate on the instance
      const result = mockController.tryGenerateMotivations();

      // Assert - Should work correctly
      expect(result).toBeInstanceOf(Promise);
      expect(mockGeneratorInstance.generate).toHaveBeenCalled();
    });
  });

  describe('Bootstrap Service Resolution', () => {
    it('should reproduce the issue with CharacterBuilderBootstrap service resolution', () => {
      // Arrange - Mock config with services as classes (current issue)
      const config = {
        pageName: 'core-motivations-generator',
        controllerClass: CoreMotivationsGeneratorController,
        services: {
          displayEnhancer: { enhance: jest.fn() }, // Mock instance
          coreMotivationsGenerator: CoreMotivationsGenerator, // Class (problematic)
        },
      };

      const mockContainer = testBed.container;
      const bootstrap = new CharacterBuilderBootstrap();

      // Act - Create controller with current problematic approach
      const dependencies = {
        logger: testBed.logger,
        characterBuilderService: { mock: 'service' },
        eventBus: testBed.eventBus,
        schemaValidator: testBed.container.resolve('ISchemaValidator'),
        clicheGenerator: { generate: jest.fn() },
        ...config.services, // This spreads the class directly
      };

      // Assert - Dependencies should contain the class, not instance
      expect(dependencies.coreMotivationsGenerator).toBe(
        CoreMotivationsGenerator
      );
      expect(typeof dependencies.coreMotivationsGenerator).toBe('function');
      expect(
        dependencies.coreMotivationsGenerator.prototype.generate
      ).toBeDefined();

      // This is the root cause - class is passed where instance is expected
    });
  });
});
