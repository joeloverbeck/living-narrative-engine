import { beforeEach, describe, it, expect } from '@jest/globals';
import AppContainer from '../../src/dependencyInjection/appContainer.js';
import { tokens } from '../../src/dependencyInjection/tokens.js';
import { configureMinimalContainer } from '../../src/dependencyInjection/minimalContainerConfig.js';
import { registerWorldAndEntity } from '../../src/dependencyInjection/registrations/worldAndEntityRegistrations.js';
import { CommonBootstrapper } from '../../src/bootstrapper/CommonBootstrapper.js';

/**
 * @file Focused test suite to ensure anatomy visualizer initialization works correctly
 * @see anatomy-visualizer.js
 */

describe('Anatomy Visualizer Initialization', () => {
  let container;

  beforeEach(() => {
    container = new AppContainer();
  });

  describe('LayerCompatibilityService Registration', () => {
    it('should correctly register LayerCompatibilityService with entityManager dependency', () => {
      // Configure container with minimal setup
      configureMinimalContainer(container);
      
      // Resolve LayerCompatibilityService
      const layerCompatibilityService = container.resolve(tokens.LayerCompatibilityService);
      
      // Should not throw and should be defined
      expect(layerCompatibilityService).toBeDefined();
    });

    it('should resolve IEntityManager before LayerCompatibilityService', () => {
      configureMinimalContainer(container);
      
      // First ensure IEntityManager can be resolved
      const entityManager = container.resolve(tokens.IEntityManager);
      expect(entityManager).toBeDefined();
      
      // Then ensure LayerCompatibilityService can be resolved
      const layerCompatibilityService = container.resolve(tokens.LayerCompatibilityService);
      expect(layerCompatibilityService).toBeDefined();
    });
  });

  describe('Anatomy Service Dependency Chain', () => {
    it('should resolve EquipmentOrchestrator which depends on LayerCompatibilityService', () => {
      configureMinimalContainer(container);
      
      const equipmentOrchestrator = container.resolve(tokens.EquipmentOrchestrator);
      expect(equipmentOrchestrator).toBeDefined();
    });

    it('should resolve ClothingInstantiationService which depends on EquipmentOrchestrator', () => {
      configureMinimalContainer(container);
      
      const clothingInstantiationService = container.resolve(tokens.ClothingInstantiationService);
      expect(clothingInstantiationService).toBeDefined();
    });

    it('should resolve AnatomyGenerationService which depends on ClothingInstantiationService', () => {
      configureMinimalContainer(container);
      
      const anatomyGenerationService = container.resolve(tokens.AnatomyGenerationService);
      expect(anatomyGenerationService).toBeDefined();
    });

    it('should resolve AnatomyInitializationService which depends on AnatomyGenerationService', () => {
      configureMinimalContainer(container);
      
      // This was the service that failed in the error logs
      const anatomyInitializationService = container.resolve(tokens.AnatomyInitializationService);
      expect(anatomyInitializationService).toBeDefined();
    });
  });

  describe('CommonBootstrapper with minimal configuration', () => {
    it('should bootstrap successfully with minimal configuration', async () => {
      const bootstrapper = new CommonBootstrapper();
      
      // Bootstrap with minimal configuration as used by anatomy visualizer
      const result = await bootstrapper.bootstrap({
        containerConfigType: 'minimal',
        worldName: 'default',
        includeAnatomyFormatting: true,
        skipModLoading: true, // Skip for testing
      });
      
      expect(result.container).toBeDefined();
      expect(result.services).toBeDefined();
      expect(result.services.entityManager).toBeDefined();
    });

    it('should initialize auxiliary services without errors', async () => {
      const bootstrapper = new CommonBootstrapper();
      
      const result = await bootstrapper.bootstrap({
        containerConfigType: 'minimal',
        worldName: 'default',
        includeAnatomyFormatting: true,
        skipModLoading: true,
      });
      
      // Verify that key services used by anatomy visualizer are available
      const anatomyDescriptionService = result.container.resolve(
        tokens.AnatomyDescriptionService
      );
      expect(anatomyDescriptionService).toBeDefined();
      
      const anatomyFormattingService = result.container.resolve(
        tokens.AnatomyFormattingService
      );
      expect(anatomyFormattingService).toBeDefined();
    });
  });

  describe('SystemInitializer', () => {
    it('should initialize all systems tagged with initializableSystem', async () => {
      configureMinimalContainer(container);
      
      const systemInitializer = container.resolve(tokens.SystemInitializer);
      expect(systemInitializer).toBeDefined();
      
      // This should not throw - it was failing before the fix
      await expect(systemInitializer.initializeAll()).resolves.not.toThrow();
    });
  });
});