import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { CommonBootstrapper } from '../../../src/bootstrapper/CommonBootstrapper.js';
import { configureContainer } from '../../../src/dependencyInjection/containerConfig.js';
import { configureMinimalContainer } from '../../../src/dependencyInjection/minimalContainerConfig.js';
import { loadModsFromGameConfig } from '../../../src/utils/initialization/modLoadingUtils.js';
import { initializeCoreServices, initializeAuxiliaryServices } from '../../../src/utils/initialization/commonInitialization.js';
import { initializeAnatomyFormattingStage } from '../../../src/bootstrapper/stages/anatomyFormattingStage.js';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';

jest.mock('../../../src/dependencyInjection/appContainer.js');
jest.mock('../../../src/dependencyInjection/containerConfig.js');
jest.mock('../../../src/dependencyInjection/minimalContainerConfig.js');
jest.mock('../../../src/utils/initialization/modLoadingUtils.js');
jest.mock('../../../src/utils/initialization/commonInitialization.js');
jest.mock('../../../src/bootstrapper/stages/anatomyFormattingStage.js');

const mockLogger = () => ({
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

describe('CommonBootstrapper', () => {
  let bootstrapper;
  let mockContainer;
  let mockServices;

  beforeEach(() => {
    jest.clearAllMocks();
    
    bootstrapper = new CommonBootstrapper();
    mockContainer = {};
    AppContainer.mockImplementation(() => mockContainer);
    
    mockServices = {
      logger: mockLogger(),
      modsLoader: { loadMods: jest.fn() },
      registry: {},
      entityManager: {},
      systemInitializer: { initializeAll: jest.fn() },
      eventDispatcher: {},
    };
    
    initializeCoreServices.mockResolvedValue(mockServices);
    initializeAuxiliaryServices.mockResolvedValue();
    loadModsFromGameConfig.mockResolvedValue({
      finalModOrder: ['mod1', 'mod2'],
    });
  });

  describe('bootstrap', () => {
    it('should bootstrap with minimal configuration by default', async () => {
      const result = await bootstrapper.bootstrap();

      expect(AppContainer).toHaveBeenCalled();
      expect(configureMinimalContainer).toHaveBeenCalledWith(mockContainer);
      expect(initializeCoreServices).toHaveBeenCalled();
      expect(loadModsFromGameConfig).toHaveBeenCalledWith(
        mockServices.modsLoader,
        mockServices.logger,
        'default'
      );
      expect(initializeAuxiliaryServices).toHaveBeenCalled();
      expect(result).toEqual({
        container: mockContainer,
        services: mockServices,
        loadReport: { finalModOrder: ['mod1', 'mod2'] },
      });
    });

    it('should bootstrap with full configuration when specified', async () => {
      const uiElements = { outputDiv: {}, inputElement: {} };
      
      await bootstrapper.bootstrap({
        containerConfigType: 'full',
        uiElements,
      });

      expect(configureContainer).toHaveBeenCalledWith(mockContainer, uiElements);
      expect(configureMinimalContainer).not.toHaveBeenCalled();
    });

    it('should throw error when full config requested without UI elements', async () => {
      await expect(bootstrapper.bootstrap({
        containerConfigType: 'full',
      })).rejects.toThrow('UI elements are required for full container configuration');
    });

    it('should use custom world name when provided', async () => {
      await bootstrapper.bootstrap({
        worldName: 'test-world',
      });

      expect(loadModsFromGameConfig).toHaveBeenCalledWith(
        mockServices.modsLoader,
        mockServices.logger,
        'test-world'
      );
    });

    it('should skip mod loading when requested', async () => {
      const result = await bootstrapper.bootstrap({
        skipModLoading: true,
      });

      expect(loadModsFromGameConfig).not.toHaveBeenCalled();
      expect(result.loadReport).toBeUndefined();
      expect(mockServices.logger.info).toHaveBeenCalledWith(
        'CommonBootstrapper: Skipping mod loading as requested'
      );
    });

    it('should initialize anatomy formatting when requested', async () => {
      initializeAnatomyFormattingStage.mockResolvedValue({
        success: true,
      });

      await bootstrapper.bootstrap({
        includeAnatomyFormatting: true,
      });

      expect(initializeAnatomyFormattingStage).toHaveBeenCalledWith(
        mockContainer,
        mockServices.logger,
        expect.any(Object)
      );
    });

    it('should throw error when anatomy formatting fails', async () => {
      initializeAnatomyFormattingStage.mockResolvedValue({
        success: false,
        error: { message: 'Formatting failed' },
      });

      await expect(bootstrapper.bootstrap({
        includeAnatomyFormatting: true,
      })).rejects.toThrow('Anatomy formatting initialization failed: Formatting failed');
    });

    it('should call post-init hook when provided', async () => {
      const postInitHook = jest.fn();
      
      await bootstrapper.bootstrap({
        postInitHook,
      });

      expect(postInitHook).toHaveBeenCalledWith(mockServices, mockContainer);
    });

    it('should handle errors during initialization', async () => {
      const error = new Error('Init failed');
      initializeCoreServices.mockRejectedValue(error);

      await expect(bootstrapper.bootstrap()).rejects.toThrow('Init failed');
    });

    it('should log errors using console.error when logger not available', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const error = new Error('Early failure');
      AppContainer.mockImplementation(() => {
        throw error;
      });

      await expect(bootstrapper.bootstrap()).rejects.toThrow('Early failure');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Fatal error during initialization'),
        error
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('displayFatalStartupError', () => {
    let alertSpy;
    let consoleSpy;
    let getElementByIdSpy;

    beforeEach(() => {
      alertSpy = jest.spyOn(global, 'alert').mockImplementation();
      consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Spy on document.getElementById
      getElementByIdSpy = jest.spyOn(document, 'getElementById');
    });

    afterEach(() => {
      alertSpy.mockRestore();
      consoleSpy.mockRestore();
      getElementByIdSpy.mockRestore();
    });

    it('should display error in error div when available', () => {
      let errorDivTextContent = '';
      let errorDivStyleDisplay = 'none';
      
      const errorDiv = {
        get textContent() { return errorDivTextContent; },
        set textContent(value) { errorDivTextContent = value; },
        style: {
          get display() { return errorDivStyleDisplay; },
          set display(value) { errorDivStyleDisplay = value; }
        }
      };
      getElementByIdSpy.mockReturnValue(errorDiv);

      bootstrapper.displayFatalStartupError('Test error message');

      expect(getElementByIdSpy).toHaveBeenCalledWith('error-output');
      expect(errorDiv.textContent).toBe('Test error message');
      expect(errorDiv.style.display).toBe('block');
      expect(consoleSpy).toHaveBeenCalledWith('Test error message', null);
      expect(alertSpy).toHaveBeenCalledWith('Test error message');
    });

    it('should fallback to console and alert when error div not found', () => {
      getElementByIdSpy.mockReturnValue(null);

      bootstrapper.displayFatalStartupError('Test error', new Error('Details'));

      expect(consoleSpy).toHaveBeenCalledWith('Test error', expect.any(Error));
      expect(alertSpy).toHaveBeenCalledWith('Test error');
    });
  });
});