/**
 * @file Unit tests for ConfigPersistenceService
 * @see src/modManager/services/ConfigPersistenceService.js
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import {
  ConfigPersistenceService,
  ConfigPersistenceError,
} from '../../../../src/modManager/services/ConfigPersistenceService.js';

describe('ConfigPersistenceService', () => {
  /** @type {jest.Mocked<{debug: Function, info: Function, warn: Function, error: Function}>} */
  let mockLogger;
  /** @type {ConfigPersistenceService} */
  let service;
  /** @type {Function} */
  let originalFetch;

  const mockConfigResponse = {
    success: true,
    config: {
      mods: ['core', 'test-mod', 'world-mod'],
      startWorld: 'core:default_world',
    },
  };

  const mockSaveResponse = {
    success: true,
    message: 'Configuration saved successfully',
    config: {
      mods: ['core', 'test-mod'],
      startWorld: 'core:default_world',
    },
  };

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Store original fetch to restore later
    originalFetch = global.fetch;

    service = new ConfigPersistenceService({
      logger: mockLogger,
      apiBaseUrl: 'http://localhost:3001',
    });
  });

  afterEach(() => {
    // Restore original fetch
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should throw error when logger is not provided', () => {
      expect(() => new ConfigPersistenceService({})).toThrow(
        'ConfigPersistenceService: logger is required'
      );
    });

    it('should create instance with default settings', () => {
      const svc = new ConfigPersistenceService({ logger: mockLogger });
      expect(svc).toBeInstanceOf(ConfigPersistenceService);
    });

    it('should accept custom apiBaseUrl', () => {
      const svc = new ConfigPersistenceService({
        logger: mockLogger,
        apiBaseUrl: 'http://custom:9999',
      });
      expect(svc).toBeInstanceOf(ConfigPersistenceService);
    });
  });

  describe('loadConfig', () => {
    it('should return configuration on success', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockConfigResponse,
      });

      const result = await service.loadConfig();

      expect(result).toEqual(mockConfigResponse.config);
      expect(result.mods).toHaveLength(3);
      expect(result.startWorld).toBe('core:default_world');
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/game-config/current'
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Loading current game configuration...'
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Loaded config: 3 mods, world: core:default_world'
      );
    });

    it('should throw ConfigPersistenceError on network failure', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      await expect(service.loadConfig()).rejects.toThrow(
        ConfigPersistenceError
      );
      await expect(service.loadConfig()).rejects.toThrow(
        'Failed to load config: Network error'
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to load configuration',
        expect.any(Error)
      );
    });

    it('should throw ConfigPersistenceError on API error response (non-2xx)', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(service.loadConfig()).rejects.toThrow(
        ConfigPersistenceError
      );
      await expect(service.loadConfig()).rejects.toThrow(
        'Failed to load config: API error: 500 Internal Server Error'
      );
    });

    it('should throw ConfigPersistenceError when API returns success: false', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: false,
          message: 'Config file not found',
        }),
      });

      await expect(service.loadConfig()).rejects.toThrow(
        ConfigPersistenceError
      );
      await expect(service.loadConfig()).rejects.toThrow(
        'Failed to load config: Config file not found'
      );
    });

    it('should throw ConfigPersistenceError with default message when success: false without message', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: false }),
      });

      await expect(service.loadConfig()).rejects.toThrow(
        'Failed to load config: Failed to load configuration'
      );
    });
  });

  describe('saveConfig', () => {
    it('should return success result on valid config', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockSaveResponse,
      });

      const config = {
        mods: ['core', 'test-mod'],
        startWorld: 'core:default_world',
      };

      const result = await service.saveConfig(config);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Configuration saved successfully');
      expect(result.config).toEqual(mockSaveResponse.config);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/game-config/save',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(config),
          signal: expect.any(AbortSignal),
        }
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Saving game configuration...',
        {
          modCount: 2,
          startWorld: 'core:default_world',
        }
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Configuration saved successfully'
      );
    });

    it('should return error result when config is null', async () => {
      const fetchMock = jest.fn();
      global.fetch = fetchMock;

      const result = await service.saveConfig(null);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Configuration is required');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should return error result when mods is not an array', async () => {
      const result = await service.saveConfig({
        mods: 'not-an-array',
        startWorld: 'core:world',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Mods must be an array');
    });

    it('should return error result when mods array is empty', async () => {
      const result = await service.saveConfig({
        mods: [],
        startWorld: 'core:world',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('At least one mod must be selected');
    });

    it('should return error result when mod ID is empty string', async () => {
      const result = await service.saveConfig({
        mods: ['core', ''],
        startWorld: 'core:world',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('All mod IDs must be non-empty strings');
    });

    it('should return error result when mod ID is not a string', async () => {
      const result = await service.saveConfig({
        mods: ['core', 123],
        startWorld: 'core:world',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('All mod IDs must be non-empty strings');
    });

    it('should return error result when startWorld is missing', async () => {
      const result = await service.saveConfig({
        mods: ['core'],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Start world must be selected');
    });

    it('should return error result when startWorld is not a string', async () => {
      const result = await service.saveConfig({
        mods: ['core'],
        startWorld: 123,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Start world must be selected');
    });

    it('should return error result when startWorld format is invalid', async () => {
      const result = await service.saveConfig({
        mods: ['core'],
        startWorld: 'invalid_world_format',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Start world must be in format modId:worldId');
    });

    it('should return error result when API returns failure', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          success: false,
          message: 'Invalid configuration',
        }),
      });

      const result = await service.saveConfig({
        mods: ['core'],
        startWorld: 'core:world',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid configuration');
      expect(mockLogger.error).toHaveBeenCalledWith('Save failed', {
        error: 'Invalid configuration',
      });
    });

    it('should return error result on network failure', async () => {
      global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network down'));

      const result = await service.saveConfig({
        mods: ['core'],
        startWorld: 'core:world',
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to save: Network down');
      expect(result.error).toBe('Network down');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to save configuration',
        expect.any(Error)
      );
    });

    it('should cancel previous pending save', async () => {
      const abortMock = jest.fn();
      let firstController;

      // First save - mock the AbortController
      global.fetch = jest.fn().mockImplementation((_url, options) => {
        if (!firstController) {
          firstController = { abort: abortMock, signal: options.signal };
        }
        return new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: async () => mockSaveResponse,
              }),
            100
          );
        });
      });

      // Start first save (don't await)
      const firstSavePromise = service.saveConfig({
        mods: ['core'],
        startWorld: 'core:world',
      });

      // Mock cancellation of first controller by the second save
      // The service stores the controller, so we need to spy on abort
      const abortControllerSpy = jest.spyOn(AbortController.prototype, 'abort');

      // Start second save immediately
      const secondSavePromise = service.saveConfig({
        mods: ['core', 'other'],
        startWorld: 'core:world2',
      });

      // The second save should have called abort on the first
      expect(abortControllerSpy).toHaveBeenCalled();

      // Clean up spy
      abortControllerSpy.mockRestore();

      // Clean up promises
      await Promise.allSettled([firstSavePromise, secondSavePromise]);
    });

    it('should return cancelled result when aborted', async () => {
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';

      global.fetch = jest.fn().mockRejectedValueOnce(abortError);

      const result = await service.saveConfig({
        mods: ['core'],
        startWorld: 'core:world',
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Save cancelled');
      expect(result.error).toBe('Save cancelled');
    });
  });

  describe('isSaving', () => {
    it('should return false when no save is in progress', () => {
      expect(service.isSaving()).toBe(false);
    });

    it('should return true during save operation', async () => {
      let resolveRequest;
      global.fetch = jest.fn().mockReturnValue(
        new Promise((resolve) => {
          resolveRequest = () =>
            resolve({
              ok: true,
              json: async () => mockSaveResponse,
            });
        })
      );

      // Start save but don't await
      const savePromise = service.saveConfig({
        mods: ['core'],
        startWorld: 'core:world',
      });

      // Check that isSaving is true during the operation
      expect(service.isSaving()).toBe(true);

      // Resolve the request
      resolveRequest();
      await savePromise;

      // Should be false after completion
      expect(service.isSaving()).toBe(false);
    });
  });

  describe('cancelPendingSave', () => {
    it('should abort pending save', async () => {
      const abortControllerSpy = jest.spyOn(AbortController.prototype, 'abort');

      let resolveRequest;
      global.fetch = jest.fn().mockReturnValue(
        new Promise((resolve) => {
          resolveRequest = () =>
            resolve({
              ok: true,
              json: async () => mockSaveResponse,
            });
        })
      );

      // Start save but don't await
      const savePromise = service.saveConfig({
        mods: ['core'],
        startWorld: 'core:world',
      });

      // Cancel the pending save
      service.cancelPendingSave();

      expect(abortControllerSpy).toHaveBeenCalled();
      expect(service.isSaving()).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith('Pending save cancelled');

      // Clean up
      abortControllerSpy.mockRestore();
      resolveRequest();
      await savePromise.catch(() => {});
    });

    it('should do nothing when no save is pending', () => {
      service.cancelPendingSave();
      // Should not throw and not log
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });
  });

  describe('hasChanges', () => {
    it('should return true when saved is null', () => {
      const current = { mods: ['core'], startWorld: 'core:world' };
      expect(service.hasChanges(current, null)).toBe(true);
    });

    it('should return true when startWorld differs', () => {
      const current = { mods: ['core'], startWorld: 'core:world1' };
      const saved = { mods: ['core'], startWorld: 'core:world2' };
      expect(service.hasChanges(current, saved)).toBe(true);
    });

    it('should return true when mods length differs', () => {
      const current = { mods: ['core', 'extra'], startWorld: 'core:world' };
      const saved = { mods: ['core'], startWorld: 'core:world' };
      expect(service.hasChanges(current, saved)).toBe(true);
    });

    it('should return true when mods differ (even with same length)', () => {
      const current = { mods: ['core', 'mod-a'], startWorld: 'core:world' };
      const saved = { mods: ['core', 'mod-b'], startWorld: 'core:world' };
      expect(service.hasChanges(current, saved)).toBe(true);
    });

    it('should return false when configs are identical', () => {
      const current = { mods: ['core', 'mod-a'], startWorld: 'core:world' };
      const saved = { mods: ['core', 'mod-a'], startWorld: 'core:world' };
      expect(service.hasChanges(current, saved)).toBe(false);
    });

    it('should return false when mods are same but in different order (order-independent)', () => {
      const current = { mods: ['mod-b', 'core', 'mod-a'], startWorld: 'core:world' };
      const saved = { mods: ['core', 'mod-a', 'mod-b'], startWorld: 'core:world' };
      expect(service.hasChanges(current, saved)).toBe(false);
    });
  });

  describe('ConfigPersistenceError', () => {
    it('should have correct name and message', () => {
      const error = new ConfigPersistenceError('Test error');
      expect(error.name).toBe('ConfigPersistenceError');
      expect(error.message).toBe('Test error');
      expect(error).toBeInstanceOf(Error);
    });

    it('should preserve cause error', () => {
      const cause = new Error('Original error');
      const error = new ConfigPersistenceError('Wrapper error', cause);
      expect(error.cause).toBe(cause);
    });
  });
});
