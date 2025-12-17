/**
 * @file Unit tests for ModDiscoveryService
 * @see src/modManager/services/ModDiscoveryService.js
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  ModDiscoveryService,
  ModDiscoveryError,
} from '../../../../src/modManager/services/ModDiscoveryService.js';

describe('ModDiscoveryService', () => {
  /** @type {jest.Mocked<{debug: Function, info: Function, warn: Function, error: Function}>} */
  let mockLogger;
  /** @type {ModDiscoveryService} */
  let service;
  /** @type {Function} */
  let originalFetch;

  const mockModsResponse = {
    success: true,
    mods: [
      {
        id: 'core',
        name: 'Core',
        version: '1.0.0',
        description: 'Core mod',
        author: 'System',
        dependencies: [],
        conflicts: [],
        hasWorlds: true,
      },
      {
        id: 'test-mod',
        name: 'Test Mod',
        version: '1.0.0',
        description: 'A test mod',
        author: 'Tester',
        dependencies: [{ id: 'core', version: '>=1.0.0' }],
        conflicts: [],
        hasWorlds: false,
      },
      {
        id: 'world-mod',
        name: 'World Mod',
        version: '2.0.0',
        description: 'A mod with worlds',
        author: 'Creator',
        dependencies: [],
        conflicts: ['conflicting-mod'],
        hasWorlds: true,
      },
    ],
    count: 3,
    scannedAt: '2025-12-17T10:00:00.000Z',
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
  });

  afterEach(() => {
    // Restore original fetch
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should throw error when logger is not provided', () => {
      expect(() => new ModDiscoveryService({})).toThrow(
        'ModDiscoveryService: logger is required'
      );
    });

    it('should create instance with default settings', () => {
      const service = new ModDiscoveryService({ logger: mockLogger });
      expect(service).toBeInstanceOf(ModDiscoveryService);
    });

    it('should accept custom apiBaseUrl', () => {
      const service = new ModDiscoveryService({
        logger: mockLogger,
        apiBaseUrl: 'http://custom:9999',
      });
      expect(service).toBeInstanceOf(ModDiscoveryService);
    });

    it('should accept custom cacheDuration', () => {
      const service = new ModDiscoveryService({
        logger: mockLogger,
        cacheDuration: 120000,
      });
      expect(service).toBeInstanceOf(ModDiscoveryService);
    });
  });

  describe('discoverMods', () => {
    beforeEach(() => {
      service = new ModDiscoveryService({
        logger: mockLogger,
        apiBaseUrl: 'http://localhost:3001',
      });
    });

    it('should return array of mod metadata on success', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockModsResponse,
      });

      const result = await service.discoverMods();

      expect(result).toEqual(mockModsResponse.mods);
      expect(result).toHaveLength(3);
      expect(global.fetch).toHaveBeenCalledWith('http://localhost:3001/api/mods');
      expect(mockLogger.info).toHaveBeenCalledWith('Fetching mods from API...');
      expect(mockLogger.info).toHaveBeenCalledWith('Discovered 3 mods');
    });

    it('should throw ModDiscoveryError on network failure', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      await expect(service.discoverMods()).rejects.toThrow(ModDiscoveryError);
      await expect(service.discoverMods()).rejects.toThrow(
        'Failed to fetch mods: Network error'
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to discover mods',
        expect.any(Error)
      );
    });

    it('should throw ModDiscoveryError on API error response (non-2xx status)', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(service.discoverMods()).rejects.toThrow(ModDiscoveryError);
      await expect(service.discoverMods()).rejects.toThrow(
        'Failed to fetch mods: API error: 500 Internal Server Error'
      );
    });

    it('should throw ModDiscoveryError when API returns success: false', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: false,
          message: 'Mods directory not found',
        }),
      });

      await expect(service.discoverMods()).rejects.toThrow(ModDiscoveryError);
      await expect(service.discoverMods()).rejects.toThrow(
        'Failed to fetch mods: Mods directory not found'
      );
    });

    it('should throw ModDiscoveryError with default message when API returns success: false without message', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: false }),
      });

      await expect(service.discoverMods()).rejects.toThrow(
        'Failed to fetch mods: API returned unsuccessful response'
      );
    });

    it('should use cache when available and valid', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockModsResponse,
      });

      // First call - should fetch
      await service.discoverMods();
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const result = await service.discoverMods();
      expect(global.fetch).toHaveBeenCalledTimes(1); // Still 1, not 2
      expect(result).toEqual(mockModsResponse.mods);
      expect(mockLogger.debug).toHaveBeenCalledWith('Returning cached mods');
    });

    it('should bypass cache when bypassCache is true', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockModsResponse,
      });

      // First call - should fetch
      await service.discoverMods();
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Second call with bypass - should fetch again
      await service.discoverMods({ bypassCache: true });
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should refetch when cache expires', async () => {
      const shortCacheService = new ModDiscoveryService({
        logger: mockLogger,
        apiBaseUrl: 'http://localhost:3001',
        cacheDuration: 10, // 10ms cache
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockModsResponse,
      });

      // First call
      await shortCacheService.discoverMods();
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Wait for cache to expire
      await new Promise((resolve) => setTimeout(resolve, 20));

      // Second call after cache expiry
      await shortCacheService.discoverMods();
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('getModById', () => {
    beforeEach(() => {
      service = new ModDiscoveryService({
        logger: mockLogger,
        apiBaseUrl: 'http://localhost:3001',
      });
    });

    it('should return mod when found', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockModsResponse,
      });

      const result = await service.getModById('test-mod');

      expect(result).toEqual(mockModsResponse.mods[1]);
      expect(result.id).toBe('test-mod');
    });

    it('should return null when not found', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockModsResponse,
      });

      const result = await service.getModById('non-existent-mod');

      expect(result).toBeNull();
    });
  });

  describe('getModsWithWorlds', () => {
    beforeEach(() => {
      service = new ModDiscoveryService({
        logger: mockLogger,
        apiBaseUrl: 'http://localhost:3001',
      });
    });

    it('should filter to mods with hasWorlds true', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockModsResponse,
      });

      const result = await service.getModsWithWorlds();

      expect(result).toHaveLength(2);
      expect(result.every((mod) => mod.hasWorlds)).toBe(true);
      expect(result.map((mod) => mod.id)).toEqual(['core', 'world-mod']);
    });

    it('should return empty array when no mods have worlds', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          mods: [{ ...mockModsResponse.mods[1], hasWorlds: false }],
          count: 1,
          scannedAt: '2025-12-17T10:00:00.000Z',
        }),
      });

      const result = await service.getModsWithWorlds();

      expect(result).toHaveLength(0);
    });
  });

  describe('clearCache', () => {
    beforeEach(() => {
      service = new ModDiscoveryService({
        logger: mockLogger,
        apiBaseUrl: 'http://localhost:3001',
      });
    });

    it('should invalidate the cache', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockModsResponse,
      });

      // First call - populate cache
      await service.discoverMods();
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Clear cache
      service.clearCache();
      expect(mockLogger.debug).toHaveBeenCalledWith('Cache cleared');

      // Next call should fetch again
      await service.discoverMods();
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('ModDiscoveryError', () => {
    it('should have correct name and message', () => {
      const error = new ModDiscoveryError('Test error');
      expect(error.name).toBe('ModDiscoveryError');
      expect(error.message).toBe('Test error');
      expect(error).toBeInstanceOf(Error);
    });

    it('should preserve cause error', () => {
      const cause = new Error('Original error');
      const error = new ModDiscoveryError('Wrapper error', cause);
      expect(error.cause).toBe(cause);
    });
  });
});
