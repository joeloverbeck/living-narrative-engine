/**
 * @file Unit tests for ModManagerController
 * @see src/modManager/controllers/ModManagerController.js
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { ModManagerController } from '../../../../src/modManager/controllers/ModManagerController.js';

describe('ModManagerController', () => {
  /** @type {jest.Mocked<{debug: jest.Mock, info: jest.Mock, warn: jest.Mock, error: jest.Mock}>} */
  let mockLogger;
  /** @type {jest.Mocked<{discoverMods: jest.Mock}>} */
  let mockModDiscoveryService;
  /** @type {jest.Mocked<{buildGraph: jest.Mock, setExplicitMods: jest.Mock, getLoadOrder: jest.Mock, getModStatus: jest.Mock, hasExplicitDependents: jest.Mock, calculateActivation: jest.Mock, calculateDeactivation: jest.Mock}>} */
  let mockModGraphService;
  /** @type {jest.Mocked<{discoverWorlds: jest.Mock}>} */
  let mockWorldDiscoveryService;
  /** @type {jest.Mocked<{loadConfig: jest.Mock, saveConfig: jest.Mock, hasChanges: jest.Mock, cancelPendingSave: jest.Mock}>} */
  let mockConfigPersistenceService;
  /** @type {ModManagerController} */
  let controller;

  const createMockMods = () => [
    { id: 'core', name: 'Core', description: 'Core mod', dependencies: [] },
    {
      id: 'base-mod',
      name: 'Base Mod',
      description: 'Base mod',
      dependencies: [{ id: 'core' }],
    },
    {
      id: 'feature-mod',
      name: 'Feature Mod',
      description: 'Feature mod',
      dependencies: [{ id: 'base-mod' }],
    },
  ];

  const createMockWorlds = () => [
    { id: 'core:default_world', name: 'Default World', modId: 'core' },
    { id: 'base-mod:test_world', name: 'Test World', modId: 'base-mod' },
  ];

  const createMockConfig = () => ({
    mods: ['core', 'base-mod'],
    startWorld: 'core:default_world',
  });

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockModDiscoveryService = {
      discoverMods: jest.fn().mockResolvedValue(createMockMods()),
    };

    mockModGraphService = {
      buildGraph: jest.fn(),
      setExplicitMods: jest.fn(),
      getLoadOrder: jest.fn().mockReturnValue(['core', 'base-mod']),
      getModStatus: jest.fn().mockReturnValue('inactive'),
      hasExplicitDependents: jest.fn().mockReturnValue(false),
      calculateActivation: jest
        .fn()
        .mockReturnValue({ valid: true, dependencies: [] }),
      calculateDeactivation: jest
        .fn()
        .mockReturnValue({ valid: true, orphaned: [] }),
    };

    mockWorldDiscoveryService = {
      discoverWorlds: jest.fn().mockResolvedValue(createMockWorlds()),
    };

    mockConfigPersistenceService = {
      loadConfig: jest.fn().mockResolvedValue(createMockConfig()),
      saveConfig: jest.fn().mockResolvedValue({ success: true }),
      hasChanges: jest.fn().mockReturnValue(false),
      cancelPendingSave: jest.fn(),
    };

    controller = new ModManagerController({
      logger: mockLogger,
      modDiscoveryService: mockModDiscoveryService,
      modGraphService: mockModGraphService,
      worldDiscoveryService: mockWorldDiscoveryService,
      configPersistenceService: mockConfigPersistenceService,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should throw error when logger is not provided', () => {
      expect(
        () =>
          new ModManagerController({
            modDiscoveryService: mockModDiscoveryService,
            modGraphService: mockModGraphService,
            worldDiscoveryService: mockWorldDiscoveryService,
            configPersistenceService: mockConfigPersistenceService,
          })
      ).toThrow('ModManagerController: logger is required');
    });

    it('should throw error when modDiscoveryService is not provided', () => {
      expect(
        () =>
          new ModManagerController({
            logger: mockLogger,
            modGraphService: mockModGraphService,
            worldDiscoveryService: mockWorldDiscoveryService,
            configPersistenceService: mockConfigPersistenceService,
          })
      ).toThrow('ModManagerController: modDiscoveryService is required');
    });

    it('should throw error when modGraphService is not provided', () => {
      expect(
        () =>
          new ModManagerController({
            logger: mockLogger,
            modDiscoveryService: mockModDiscoveryService,
            worldDiscoveryService: mockWorldDiscoveryService,
            configPersistenceService: mockConfigPersistenceService,
          })
      ).toThrow('ModManagerController: modGraphService is required');
    });

    it('should throw error when worldDiscoveryService is not provided', () => {
      expect(
        () =>
          new ModManagerController({
            logger: mockLogger,
            modDiscoveryService: mockModDiscoveryService,
            modGraphService: mockModGraphService,
            configPersistenceService: mockConfigPersistenceService,
          })
      ).toThrow('ModManagerController: worldDiscoveryService is required');
    });

    it('should throw error when configPersistenceService is not provided', () => {
      expect(
        () =>
          new ModManagerController({
            logger: mockLogger,
            modDiscoveryService: mockModDiscoveryService,
            modGraphService: mockModGraphService,
            worldDiscoveryService: mockWorldDiscoveryService,
          })
      ).toThrow('ModManagerController: configPersistenceService is required');
    });

    it('should create instance with all dependencies', () => {
      expect(controller).toBeInstanceOf(ModManagerController);
    });

    it('should initialize state with correct defaults', () => {
      const state = controller.getState();
      expect(state.availableMods).toEqual([]);
      expect(state.activeMods).toEqual([]);
      expect(state.resolvedMods).toEqual([]);
      expect(state.selectedWorld).toBe('');
      expect(state.availableWorlds).toEqual([]);
      expect(state.hasUnsavedChanges).toBe(false);
      expect(state.isLoading).toBe(true);
      expect(state.isSaving).toBe(false);
      expect(state.error).toBeNull();
      expect(state.searchQuery).toBe('');
      expect(state.filterCategory).toBe('all');
    });
  });

  describe('initialize', () => {
    it('should load mods and config successfully', async () => {
      await controller.initialize();

      expect(mockModDiscoveryService.discoverMods).toHaveBeenCalled();
      expect(mockConfigPersistenceService.loadConfig).toHaveBeenCalled();
      expect(mockModGraphService.buildGraph).toHaveBeenCalledWith(
        createMockMods()
      );
      expect(mockModGraphService.setExplicitMods).toHaveBeenCalledWith([
        'base-mod',
      ]);
      expect(mockModGraphService.getLoadOrder).toHaveBeenCalled();
      expect(mockWorldDiscoveryService.discoverWorlds).toHaveBeenCalledWith([
        'core',
        'base-mod',
      ]);

      const state = controller.getState();
      expect(state.availableMods).toEqual(createMockMods());
      expect(state.activeMods).toEqual(['base-mod']);
      expect(state.resolvedMods).toEqual(['core', 'base-mod']);
      expect(state.selectedWorld).toBe('core:default_world');
      expect(state.availableWorlds).toEqual(createMockWorlds());
      expect(state.isLoading).toBe(false);
      expect(state.hasUnsavedChanges).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      const error = new Error('Failed to discover mods');
      mockModDiscoveryService.discoverMods.mockRejectedValue(error);

      await controller.initialize();

      const state = controller.getState();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe('Failed to load: Failed to discover mods');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to initialize ModManagerController',
        error
      );
    });

    it('should log initialization progress', async () => {
      await controller.initialize();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Initializing ModManagerController...'
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'ModManagerController initialized successfully'
      );
    });
  });

  describe('toggleMod', () => {
    beforeEach(async () => {
      await controller.initialize();
    });

    it('should activate inactive mod', async () => {
      mockModGraphService.getModStatus.mockReturnValue('inactive');
      mockModGraphService.calculateActivation.mockReturnValue({
        valid: true,
        dependencies: ['base-mod'],
      });

      await controller.toggleMod('feature-mod');

      expect(mockModGraphService.calculateActivation).toHaveBeenCalledWith(
        'feature-mod'
      );
      expect(mockModGraphService.setExplicitMods).toHaveBeenCalled();
    });

    it('should deactivate active mod', async () => {
      mockModGraphService.getModStatus.mockReturnValue('explicit');
      mockModGraphService.calculateDeactivation.mockReturnValue({
        valid: true,
        orphaned: [],
      });

      await controller.toggleMod('base-mod');

      expect(mockModGraphService.calculateDeactivation).toHaveBeenCalledWith(
        'base-mod'
      );
    });

    it('should not affect core mod', async () => {
      mockModGraphService.getModStatus.mockReturnValue('core');

      await controller.toggleMod('core');

      expect(mockModGraphService.calculateActivation).not.toHaveBeenCalled();
      expect(mockModGraphService.calculateDeactivation).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith('Cannot toggle core mod');
    });

    it('should activate dependencies automatically', async () => {
      mockModGraphService.getModStatus.mockReturnValue('inactive');
      mockModGraphService.calculateActivation.mockReturnValue({
        valid: true,
        dependencies: ['base-mod', 'core'],
      });

      await controller.toggleMod('feature-mod');

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Activated mod: feature-mod')
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('dependencies: base-mod, core')
      );
    });

    it('should block deactivation when dependents exist', async () => {
      mockModGraphService.getModStatus.mockReturnValue('explicit');
      mockModGraphService.calculateDeactivation.mockReturnValue({
        valid: false,
        error: 'Cannot deactivate: feature-mod depends on this mod',
      });

      await controller.toggleMod('base-mod');

      const state = controller.getState();
      expect(state.error).toBe(
        'Cannot deactivate: feature-mod depends on this mod'
      );
    });

    it('should update hasUnsavedChanges after activation', async () => {
      mockModGraphService.getModStatus.mockReturnValue('inactive');
      mockConfigPersistenceService.hasChanges.mockReturnValue(true);

      await controller.toggleMod('feature-mod');

      const state = controller.getState();
      expect(state.hasUnsavedChanges).toBe(true);
    });

    it('should reset world selection if current world becomes invalid', async () => {
      mockModGraphService.getModStatus.mockReturnValue('explicit');
      mockWorldDiscoveryService.discoverWorlds.mockResolvedValue([
        { id: 'new-world', name: 'New World', modId: 'other' },
      ]);

      await controller.toggleMod('base-mod');

      const state = controller.getState();
      expect(state.selectedWorld).toBe('new-world');
    });
  });

  describe('selectWorld', () => {
    beforeEach(async () => {
      await controller.initialize();
    });

    it('should update selected world', () => {
      controller.selectWorld('base-mod:test_world');

      const state = controller.getState();
      expect(state.selectedWorld).toBe('base-mod:test_world');
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Selected world: base-mod:test_world'
      );
    });

    it('should validate world availability', () => {
      controller.selectWorld('invalid:world');

      const state = controller.getState();
      expect(state.error).toBe('Invalid world: invalid:world');
      expect(state.selectedWorld).toBe('core:default_world'); // unchanged
    });

    it('should clear previous error on valid selection', () => {
      // Set an error first
      controller.selectWorld('invalid:world');
      expect(controller.getState().error).not.toBeNull();

      // Now select a valid world
      controller.selectWorld('base-mod:test_world');
      expect(controller.getState().error).toBeNull();
    });

    it('should update hasUnsavedChanges when world changes', () => {
      mockConfigPersistenceService.hasChanges.mockReturnValue(true);

      controller.selectWorld('base-mod:test_world');

      const state = controller.getState();
      expect(state.hasUnsavedChanges).toBe(true);
    });
  });

  describe('saveConfiguration', () => {
    beforeEach(async () => {
      await controller.initialize();
    });

    it('should persist current state', async () => {
      const result = await controller.saveConfiguration();

      expect(result).toBe(true);
      expect(mockConfigPersistenceService.saveConfig).toHaveBeenCalledWith({
        mods: ['core', 'base-mod'],
        startWorld: 'core:default_world',
      });
    });

    it('should update hasUnsavedChanges to false on success', async () => {
      mockConfigPersistenceService.hasChanges.mockReturnValue(true);

      // Trigger a change first
      mockModGraphService.getModStatus.mockReturnValue('inactive');
      await controller.toggleMod('feature-mod');
      expect(controller.getState().hasUnsavedChanges).toBe(true);

      // Now save
      await controller.saveConfiguration();

      expect(controller.getState().hasUnsavedChanges).toBe(false);
    });

    it('should handle save failure', async () => {
      mockConfigPersistenceService.saveConfig.mockResolvedValue({
        success: false,
        error: 'Server error',
      });

      const result = await controller.saveConfiguration();

      expect(result).toBe(false);
      expect(controller.getState().error).toBe('Server error');
    });

    it('should handle save exception', async () => {
      mockConfigPersistenceService.saveConfig.mockRejectedValue(
        new Error('Network error')
      );

      const result = await controller.saveConfiguration();

      expect(result).toBe(false);
      expect(controller.getState().error).toBe('Save failed: Network error');
    });

    it('should not allow concurrent saves', async () => {
      // Start first save
      const savePromise1 = controller.saveConfiguration();

      // Try to start second save while first is in progress
      const savePromise2 = controller.saveConfiguration();

      await Promise.all([savePromise1, savePromise2]);

      expect(mockConfigPersistenceService.saveConfig).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).toHaveBeenCalledWith('Save already in progress');
    });

    it('should log save success', async () => {
      await controller.saveConfiguration();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Configuration saved successfully'
      );
    });
  });

  describe('setSearchQuery', () => {
    beforeEach(async () => {
      await controller.initialize();
    });

    it('should update search query in state', () => {
      controller.setSearchQuery('feature');

      const state = controller.getState();
      expect(state.searchQuery).toBe('feature');
    });
  });

  describe('setFilterCategory', () => {
    beforeEach(async () => {
      await controller.initialize();
    });

    it('should update filter category in state', () => {
      controller.setFilterCategory('active');

      const state = controller.getState();
      expect(state.filterCategory).toBe('active');
    });
  });

  describe('getFilteredMods', () => {
    beforeEach(async () => {
      await controller.initialize();
    });

    it('should filter mods by name and description with search query', () => {
      controller.setSearchQuery('feature');

      const filtered = controller.getFilteredMods();

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('feature-mod');
    });

    it('should filter mods by activation status - active', () => {
      controller.setFilterCategory('active');

      const filtered = controller.getFilteredMods();

      // Only mods in resolvedMods should be returned
      expect(filtered.every((m) => ['core', 'base-mod'].includes(m.id))).toBe(
        true
      );
    });

    it('should filter mods by activation status - inactive', () => {
      controller.setFilterCategory('inactive');

      const filtered = controller.getFilteredMods();

      // Only mods NOT in resolvedMods should be returned
      expect(filtered.every((m) => !['core', 'base-mod'].includes(m.id))).toBe(
        true
      );
    });

    it('should apply both search and category filters', () => {
      mockModGraphService.getLoadOrder.mockReturnValue([
        'core',
        'base-mod',
        'feature-mod',
      ]);
      // Re-initialize to get updated state
      controller = new ModManagerController({
        logger: mockLogger,
        modDiscoveryService: mockModDiscoveryService,
        modGraphService: mockModGraphService,
        worldDiscoveryService: mockWorldDiscoveryService,
        configPersistenceService: mockConfigPersistenceService,
      });

      // Add feature-mod to resolved list for this test
      mockModGraphService.getLoadOrder.mockReturnValue([
        'core',
        'base-mod',
        'feature-mod',
      ]);
    });

    it('should return all mods when no filters applied', () => {
      controller.setSearchQuery('');
      controller.setFilterCategory('all');

      const filtered = controller.getFilteredMods();

      expect(filtered).toHaveLength(3);
    });

    it('should perform case-insensitive search', () => {
      controller.setSearchQuery('CORE');

      const filtered = controller.getFilteredMods();

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('core');
    });
  });

  describe('getModDisplayInfo', () => {
    beforeEach(async () => {
      await controller.initialize();
    });

    it('should return mod display info with status', () => {
      mockModGraphService.getModStatus.mockReturnValue('explicit');

      const info = controller.getModDisplayInfo('base-mod');

      expect(info.status).toBe('explicit');
      expect(info.isExplicit).toBe(true);
      expect(info.isDependency).toBe(false);
    });

    it('should identify dependency mods correctly', () => {
      mockModGraphService.getModStatus.mockReturnValue('dependency');

      const info = controller.getModDisplayInfo('core');

      expect(info.status).toBe('dependency');
      expect(info.isExplicit).toBe(false);
      expect(info.isDependency).toBe(true);
    });
  });

  describe('subscribe', () => {
    it('should notify listeners on state changes', async () => {
      const listener = jest.fn();
      controller.subscribe(listener);

      await controller.initialize();

      // Listener should be called with initial state + update from initialize
      expect(listener).toHaveBeenCalled();
      expect(listener.mock.calls.length).toBeGreaterThan(1);
    });

    it('should call listener immediately with current state', () => {
      const listener = jest.fn();

      controller.subscribe(listener);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(controller.getState());
    });

    it('should return unsubscribe function', () => {
      const listener = jest.fn();
      const unsubscribe = controller.subscribe(listener);

      // Clear initial call
      listener.mockClear();

      // Unsubscribe
      unsubscribe();

      // Trigger state change
      controller.setSearchQuery('test');

      // Listener should not be called
      expect(listener).not.toHaveBeenCalled();
    });

    it('should handle listener errors gracefully', async () => {
      // First add a good listener that doesn't throw
      const goodListener = jest.fn();
      controller.subscribe(goodListener);
      goodListener.mockClear();

      // Now add an error listener that only throws on subsequent calls (not initial)
      let callCount = 0;
      const errorListener = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount > 1) {
          throw new Error('Listener error');
        }
      });
      controller.subscribe(errorListener);

      // Clear after initial subscription calls
      errorListener.mockClear();
      goodListener.mockClear();

      // Trigger state change - this should call both listeners
      controller.setSearchQuery('test');

      // Both listeners were called, but error was logged
      expect(errorListener).toHaveBeenCalled();
      expect(goodListener).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Listener error',
        expect.any(Error)
      );
    });

    it('should support multiple listeners', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      const listener3 = jest.fn();

      controller.subscribe(listener1);
      controller.subscribe(listener2);
      controller.subscribe(listener3);

      // Clear initial calls
      listener1.mockClear();
      listener2.mockClear();
      listener3.mockClear();

      // Trigger state change
      controller.setSearchQuery('test');

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
      expect(listener3).toHaveBeenCalled();
    });
  });

  describe('getState', () => {
    it('should return immutable state copy', async () => {
      await controller.initialize();

      const state1 = controller.getState();
      const state2 = controller.getState();

      expect(state1).not.toBe(state2); // Different object references
      expect(state1).toEqual(state2); // Same content
    });

    it('should not allow external modification of internal state', async () => {
      await controller.initialize();

      const state = controller.getState();
      state.searchQuery = 'modified';

      expect(controller.getState().searchQuery).toBe(''); // Internal state unchanged
    });
  });

  describe('destroy', () => {
    it('should clear all listeners', async () => {
      const listener = jest.fn();
      controller.subscribe(listener);
      listener.mockClear();

      controller.destroy();

      // Try to trigger state change
      controller.setSearchQuery('test');

      // Listener should not be called
      expect(listener).not.toHaveBeenCalled();
    });

    it('should cancel pending saves', () => {
      controller.destroy();

      expect(
        mockConfigPersistenceService.cancelPendingSave
      ).toHaveBeenCalled();
    });

    it('should log destruction', () => {
      controller.destroy();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ModManagerController destroyed'
      );
    });
  });

  describe('getModName', () => {
    beforeEach(async () => {
      await controller.initialize();
    });

    it('should return mod name for valid mod ID', () => {
      const name = controller.getModName('base-mod');

      expect(name).toBe('Base Mod');
    });

    it('should return mod ID as fallback for unknown mod', () => {
      const name = controller.getModName('nonexistent-mod');

      expect(name).toBe('nonexistent-mod');
    });

    it('should return mod name for core mod', () => {
      const name = controller.getModName('core');

      expect(name).toBe('Core');
    });

    it('should return mod name for any available mod', () => {
      const name = controller.getModName('feature-mod');

      expect(name).toBe('Feature Mod');
    });
  });

  describe('edge cases', () => {
    it('should handle empty worlds list after mod deactivation', async () => {
      await controller.initialize();

      mockModGraphService.getModStatus.mockReturnValue('explicit');
      mockWorldDiscoveryService.discoverWorlds.mockResolvedValue([]);

      await controller.toggleMod('base-mod');

      const state = controller.getState();
      expect(state.selectedWorld).toBe('');
      expect(state.availableWorlds).toEqual([]);
    });

    it('should handle config with only core mod', async () => {
      mockConfigPersistenceService.loadConfig.mockResolvedValue({
        mods: ['core'],
        startWorld: 'core:default_world',
      });

      await controller.initialize();

      const state = controller.getState();
      expect(state.activeMods).toEqual([]);
    });

    it('should handle activation with invalid result', async () => {
      await controller.initialize();

      mockModGraphService.getModStatus.mockReturnValue('inactive');
      mockModGraphService.calculateActivation.mockReturnValue({
        valid: false,
        error: 'Circular dependency detected',
      });

      await controller.toggleMod('feature-mod');

      const state = controller.getState();
      expect(state.error).toBe('Circular dependency detected');
    });
  });

  describe('worldSelectionValidator integration', () => {
    /** @type {jest.Mocked<{validateAfterModChange: jest.Mock, validateWorldSelection: jest.Mock, wouldInvalidateWorld: jest.Mock, getDeactivationWarning: jest.Mock}>} */
    let mockWorldValidator;
    /** @type {ModManagerController} */
    let controllerWithValidator;

    beforeEach(() => {
      mockWorldValidator = {
        validateAfterModChange: jest.fn().mockResolvedValue({
          valid: true,
          selectedWorld: 'core:default_world',
          previousWorld: null,
          action: 'unchanged',
          message: null,
        }),
        validateWorldSelection: jest.fn().mockResolvedValue({
          valid: true,
          error: null,
        }),
        wouldInvalidateWorld: jest.fn().mockReturnValue(false),
        getDeactivationWarning: jest.fn().mockResolvedValue(null),
      };

      controllerWithValidator = new ModManagerController({
        logger: mockLogger,
        modDiscoveryService: mockModDiscoveryService,
        modGraphService: mockModGraphService,
        worldDiscoveryService: mockWorldDiscoveryService,
        configPersistenceService: mockConfigPersistenceService,
        worldSelectionValidator: mockWorldValidator,
      });
    });

    it('should accept optional worldSelectionValidator parameter', () => {
      expect(controllerWithValidator).toBeInstanceOf(ModManagerController);
    });

    it('should use validator during mod activation', async () => {
      await controllerWithValidator.initialize();

      mockModGraphService.getModStatus.mockReturnValue('inactive');
      mockModGraphService.calculateActivation.mockReturnValue({
        valid: true,
        dependencies: [],
      });
      mockWorldValidator.validateAfterModChange.mockResolvedValue({
        valid: true,
        selectedWorld: 'core:default_world',
        previousWorld: null,
        action: 'unchanged',
        message: null,
      });

      await controllerWithValidator.toggleMod('feature-mod');

      expect(mockWorldValidator.validateAfterModChange).toHaveBeenCalledWith(
        'core:default_world',
        expect.any(Array)
      );
    });

    it('should use validator during mod deactivation', async () => {
      await controllerWithValidator.initialize();

      mockModGraphService.getModStatus.mockReturnValue('explicit');
      mockModGraphService.calculateDeactivation.mockReturnValue({
        valid: true,
        orphaned: [],
      });

      await controllerWithValidator.toggleMod('base-mod');

      expect(mockWorldValidator.validateAfterModChange).toHaveBeenCalled();
    });

    it('should use validator selected world when auto-selecting', async () => {
      await controllerWithValidator.initialize();

      mockModGraphService.getModStatus.mockReturnValue('explicit');
      mockModGraphService.calculateDeactivation.mockReturnValue({
        valid: true,
        orphaned: [],
      });
      mockWorldValidator.validateAfterModChange.mockResolvedValue({
        valid: true,
        selectedWorld: 'base-mod:test_world',
        previousWorld: 'core:default_world',
        action: 'auto-selected',
        message: 'World "default_world" is no longer available.',
      });

      await controllerWithValidator.toggleMod('base-mod');

      const state = controllerWithValidator.getState();
      expect(state.selectedWorld).toBe('base-mod:test_world');
    });

    it('should log when world selection changes', async () => {
      await controllerWithValidator.initialize();
      mockLogger.info.mockClear();

      mockModGraphService.getModStatus.mockReturnValue('explicit');
      mockModGraphService.calculateDeactivation.mockReturnValue({
        valid: true,
        orphaned: [],
      });
      mockWorldValidator.validateAfterModChange.mockResolvedValue({
        valid: true,
        selectedWorld: 'base-mod:test_world',
        previousWorld: 'core:default_world',
        action: 'auto-selected',
        message: 'World changed',
      });

      await controllerWithValidator.toggleMod('base-mod');

      expect(mockLogger.info).toHaveBeenCalledWith(
        'World selection changed: auto-selected'
      );
    });

    it('should handle null selectedWorld from validator', async () => {
      await controllerWithValidator.initialize();

      mockModGraphService.getModStatus.mockReturnValue('explicit');
      mockModGraphService.calculateDeactivation.mockReturnValue({
        valid: true,
        orphaned: [],
      });
      mockWorldValidator.validateAfterModChange.mockResolvedValue({
        valid: false,
        selectedWorld: null,
        previousWorld: 'core:default_world',
        action: 'cleared',
        message: 'No worlds available.',
      });

      await controllerWithValidator.toggleMod('base-mod');

      const state = controllerWithValidator.getState();
      expect(state.selectedWorld).toBe('');
    });

    it('should work without validator (backward compatibility)', async () => {
      // Use controller without validator (from main beforeEach)
      await controller.initialize();

      mockModGraphService.getModStatus.mockReturnValue('inactive');
      mockModGraphService.calculateActivation.mockReturnValue({
        valid: true,
        dependencies: [],
      });

      await controller.toggleMod('feature-mod');

      // Should not throw and should still work
      const state = controller.getState();
      expect(state.selectedWorld).toBe('core:default_world');
    });
  });
});
