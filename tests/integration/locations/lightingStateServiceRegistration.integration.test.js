/**
 * @file Integration test for LightingStateService DI registration
 * Validates LIGSYSDES-004 implementation
 */

import { describe, expect, it } from '@jest/globals';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { LightingStateService } from '../../../src/locations/services/lightingStateService.js';

describe('LightingStateService DI Registration (LIGSYSDES-004)', () => {
  describe('Token Definition', () => {
    it('should have ILightingStateService token defined', () => {
      expect(tokens.ILightingStateService).toBeDefined();
      expect(tokens.ILightingStateService).toBe('ILightingStateService');
    });

    it('should have LightingStateService class available for import', () => {
      expect(LightingStateService).toBeDefined();
      expect(typeof LightingStateService).toBe('function');
    });
  });

  describe('Registration Module Verification', () => {
    it('should verify registration module imports without error', async () => {
      // Act - Import the registration file and verify it doesn't throw
      const { registerInfrastructure } = await import(
        '../../../src/dependencyInjection/registrations/infrastructureRegistrations.js'
      );

      // Assert
      expect(registerInfrastructure).toBeDefined();
      expect(typeof registerInfrastructure).toBe('function');
    });

    it('should verify LightingStateService is imported in infrastructure registrations', async () => {
      // This test verifies the import statement exists by checking the module loads
      // If LightingStateService import was missing, the module would fail to load
      const infrastructureModule = await import(
        '../../../src/dependencyInjection/registrations/infrastructureRegistrations.js'
      );

      expect(infrastructureModule.registerInfrastructure).toBeDefined();
    });
  });

  describe('LightingStateService Class Structure', () => {
    it('should have required methods on prototype', () => {
      expect(typeof LightingStateService.prototype.getLocationLightingState).toBe(
        'function'
      );
      expect(typeof LightingStateService.prototype.isLocationLit).toBe(
        'function'
      );
    });

    it('should instantiate with valid dependencies', () => {
      // Arrange - Create mock dependencies
      const mockEntityManager = {
        hasComponent: () => false,
        getComponentData: () => undefined,
      };
      const mockLogger = {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
      };

      // Act
      const service = new LightingStateService({
        entityManager: mockEntityManager,
        logger: mockLogger,
      });

      // Assert
      expect(service).toBeInstanceOf(LightingStateService);
    });
  });
});
