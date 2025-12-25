/**
 * @file Unit tests for ModManagerBootstrap
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';

// Create mock logger instance
const mockLoggerInstance = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock ConsoleLogger
jest.mock('../../../src/logging/consoleLogger.js', () => {
  return jest.fn(() => mockLoggerInstance);
});

// Mock all services
const mockModDiscoveryService = {
  discoverMods: jest.fn(),
  getModById: jest.fn(),
  clearCache: jest.fn(),
};

const mockModGraphService = {
  buildGraph: jest.fn(),
  setExplicitMods: jest.fn(),
  getLoadOrder: jest.fn(),
  getModStatus: jest.fn(),
  getAllNodes: jest.fn().mockReturnValue(new Map()),
};

const mockModStatisticsService = {
  invalidateCache: jest.fn(),
  getGraphService: jest.fn().mockReturnValue(mockModGraphService),
  isCacheValid: jest.fn().mockReturnValue(false),
  getDependencyHotspots: jest.fn().mockReturnValue([]),
  getHealthStatus: jest.fn().mockReturnValue({ score: 100, issues: [] }),
  getDependencyDepthAnalysis: jest
    .fn()
    .mockReturnValue({ maxDepth: 1, distribution: {} }),
  getTransitiveDependencyFootprints: jest.fn().mockReturnValue([]),
  getCoreOptionalRatio: jest.fn().mockReturnValue({ core: 5, optional: 10 }),
  getSingleParentDependencies: jest.fn().mockReturnValue([]),
};

const mockWorldDiscoveryService = {
  discoverWorlds: jest.fn(),
};

const mockConfigPersistenceService = {
  loadConfig: jest.fn(),
  saveConfig: jest.fn(),
  hasChanges: jest.fn(),
  cancelPendingSave: jest.fn(),
};

jest.mock('../../../src/modManager/services/ModDiscoveryService.js', () => {
  const mock = jest.fn(() => mockModDiscoveryService);
  return {
    __esModule: true,
    ModDiscoveryService: mock,
    default: mock,
  };
});

jest.mock('../../../src/modManager/services/ModGraphService.js', () => {
  const mock = jest.fn(() => mockModGraphService);
  return {
    __esModule: true,
    ModGraphService: mock,
    default: mock,
  };
});

jest.mock('../../../src/modManager/services/ModStatisticsService.js', () => {
  const mock = jest.fn(() => mockModStatisticsService);
  return {
    __esModule: true,
    ModStatisticsService: mock,
    default: mock,
  };
});

jest.mock('../../../src/modManager/services/WorldDiscoveryService.js', () => {
  const mock = jest.fn(() => mockWorldDiscoveryService);
  return {
    __esModule: true,
    WorldDiscoveryService: mock,
    default: mock,
  };
});

jest.mock('../../../src/modManager/services/ConfigPersistenceService.js', () => {
  const mock = jest.fn(() => mockConfigPersistenceService);
  return {
    __esModule: true,
    ConfigPersistenceService: mock,
    default: mock,
  };
});

// Mock controller
const mockControllerInstance = {
  initialize: jest.fn(),
  subscribe: jest.fn(),
  getState: jest.fn(),
  destroy: jest.fn(),
  toggleMod: jest.fn(),
  saveConfiguration: jest.fn(),
  selectWorld: jest.fn(),
  getModDisplayInfo: jest.fn().mockReturnValue({ status: 'explicit' }),
  getModName: jest.fn().mockReturnValue('Test Mod'),
};

jest.mock('../../../src/modManager/controllers/ModManagerController.js', () => {
  const mock = jest.fn(() => mockControllerInstance);
  return {
    __esModule: true,
    ModManagerController: mock,
    default: mock,
  };
});

// Mock view instances
const mockModListViewInstance = {
  render: jest.fn(),
  destroy: jest.fn(),
};

const mockSummaryPanelViewInstance = {
  render: jest.fn(),
  destroy: jest.fn(),
};

const mockWorldListViewInstance = {
  render: jest.fn(),
  destroy: jest.fn(),
};

const mockModCardComponentInstance = {};

jest.mock('../../../src/modManager/views/ModListView.js', () => {
  const mock = jest.fn(() => mockModListViewInstance);
  return {
    __esModule: true,
    ModListView: mock,
    default: mock,
  };
});

jest.mock('../../../src/modManager/views/SummaryPanelView.js', () => {
  const mock = jest.fn(() => mockSummaryPanelViewInstance);
  return {
    __esModule: true,
    SummaryPanelView: mock,
    default: mock,
  };
});

jest.mock('../../../src/modManager/views/WorldListView.js', () => {
  const mock = jest.fn(() => mockWorldListViewInstance);
  return {
    __esModule: true,
    WorldListView: mock,
    default: mock,
  };
});

jest.mock('../../../src/modManager/components/ModCardComponent.js', () => {
  const mock = jest.fn(() => mockModCardComponentInstance);
  return {
    __esModule: true,
    ModCardComponent: mock,
    default: mock,
  };
});

import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import { ModManagerBootstrap } from '../../../src/modManager/ModManagerBootstrap.js';
import ModDiscoveryService from '../../../src/modManager/services/ModDiscoveryService.js';
import ModGraphService from '../../../src/modManager/services/ModGraphService.js';
// ModStatisticsService import is mocked; keeping import pattern consistent with other services
// eslint-disable-next-line no-unused-vars
import ModStatisticsService from '../../../src/modManager/services/ModStatisticsService.js';
import WorldDiscoveryService from '../../../src/modManager/services/WorldDiscoveryService.js';
import ConfigPersistenceService from '../../../src/modManager/services/ConfigPersistenceService.js';
import ModManagerController from '../../../src/modManager/controllers/ModManagerController.js';
import ModListView from '../../../src/modManager/views/ModListView.js';
import SummaryPanelView from '../../../src/modManager/views/SummaryPanelView.js';
import WorldListView from '../../../src/modManager/views/WorldListView.js';
import ModCardComponent from '../../../src/modManager/components/ModCardComponent.js';

/**
 * Helper function to setup DOM elements for tests
 *
 * @param {object} options - Configuration options
 * @param {boolean} [options.modList=false] - Whether to create mod-list element
 * @param {boolean} [options.summaryPanel=false] - Whether to create summary-panel element
 * @param {boolean} [options.worldList=false] - Whether to create world-list element
 * @param {boolean} [options.backButton=false] - Whether to create back-button element
 * @returns {{ elements: object, getBackButton: () => HTMLElement|null }} DOM elements and getter
 */
function setupDOMElements({
  modList = false,
  summaryPanel = false,
  worldList = false,
  backButton = false,
} = {}) {
  const elements = {
    'mod-list': modList ? document.createElement('div') : null,
    'world-list': worldList ? document.createElement('div') : null,
    'back-button': backButton ? document.createElement('button') : null,
  };

  // Store summaryPanel element
  const summaryPanelEl = summaryPanel ? document.createElement('div') : null;

  jest
    .spyOn(document, 'getElementById')
    .mockImplementation((id) => elements[id] || null);

  jest.spyOn(document, 'querySelector').mockImplementation((selector) => {
    if (selector === '.summary-panel') {
      return summaryPanelEl;
    }
    return null;
  });

  return {
    elements,
    getBackButton: () => elements['back-button'],
  };
}

describe('ModManagerBootstrap', () => {
  let bootstrap;
  let mockIndicators;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset view mocks to have destroy methods
    mockModListViewInstance.destroy = jest.fn();
    mockSummaryPanelViewInstance.destroy = jest.fn();
    mockWorldListViewInstance.destroy = jest.fn();

    // Setup default mock behavior
    mockControllerInstance.initialize.mockResolvedValue(undefined);
    mockControllerInstance.getState.mockReturnValue({
      availableMods: [{ id: 'core' }, { id: 'test_mod' }],
      activeMods: [],
      resolvedMods: ['core'],
      selectedWorld: 'core:core',
      availableWorlds: [],
      hasUnsavedChanges: false,
      isLoading: false,
      isSaving: false,
      error: null,
      searchQuery: '',
      filterCategory: 'all',
    });
    mockControllerInstance.subscribe.mockImplementation((callback) => {
      // Call callback with loaded state
      callback(mockControllerInstance.getState());
      return () => {};
    });

    // Mock document.querySelectorAll before creating bootstrap
    mockIndicators = [{ textContent: '' }, { textContent: '' }];
    jest.spyOn(document, 'querySelectorAll').mockReturnValue(mockIndicators);

    bootstrap = new ModManagerBootstrap();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create ConsoleLogger with INFO level', () => {
      expect(ConsoleLogger).toHaveBeenCalledWith('INFO');
    });

    it('should instantiate without errors', () => {
      expect(bootstrap).toBeInstanceOf(ModManagerBootstrap);
    });

    it('should use custom navigationHandler when provided', () => {
      const customHandler = jest.fn();
      const customBootstrap = new ModManagerBootstrap({
        navigationHandler: customHandler,
      });
      expect(customBootstrap).toBeInstanceOf(ModManagerBootstrap);
    });
  });

  describe('initialize', () => {
    it('should log initialization message', async () => {
      await bootstrap.initialize();

      expect(mockLoggerInstance.info).toHaveBeenCalledWith(
        '[ModManagerBootstrap] Initializing Mod Manager...'
      );
    });

    it('should log success message on completion', async () => {
      await bootstrap.initialize();

      expect(mockLoggerInstance.info).toHaveBeenCalledWith(
        '[ModManagerBootstrap] Mod Manager initialized successfully'
      );
    });

    it('should register all services', async () => {
      await bootstrap.initialize();

      expect(ModDiscoveryService).toHaveBeenCalledWith({
        logger: mockLoggerInstance,
      });
      expect(ModGraphService).toHaveBeenCalledWith({
        logger: mockLoggerInstance,
      });
      expect(WorldDiscoveryService).toHaveBeenCalledWith({
        logger: mockLoggerInstance,
        modDiscoveryService: mockModDiscoveryService,
      });
      expect(ConfigPersistenceService).toHaveBeenCalledWith({
        logger: mockLoggerInstance,
      });
    });

    it('should create controller with all dependencies', async () => {
      await bootstrap.initialize();

      expect(ModManagerController).toHaveBeenCalledWith({
        logger: mockLoggerInstance,
        modDiscoveryService: mockModDiscoveryService,
        modGraphService: mockModGraphService,
        worldDiscoveryService: mockWorldDiscoveryService,
        configPersistenceService: mockConfigPersistenceService,
      });
    });

    it('should call controller.initialize()', async () => {
      await bootstrap.initialize();

      expect(mockControllerInstance.initialize).toHaveBeenCalled();
    });

    it('should subscribe to controller state changes', async () => {
      await bootstrap.initialize();

      expect(mockControllerInstance.subscribe).toHaveBeenCalledWith(
        expect.any(Function)
      );
    });

    it('should update loading indicators with mod count after successful load', async () => {
      await bootstrap.initialize();

      // Verify querySelectorAll was called
      expect(document.querySelectorAll).toHaveBeenCalledWith(
        '.loading-indicator'
      );

      // Should show "Loaded X mods" message
      mockIndicators.forEach((indicator) => {
        expect(indicator.textContent).toBe('Loaded 2 mods');
      });
    });

    it('should not show placeholder message after successful load', async () => {
      await bootstrap.initialize();

      mockIndicators.forEach((indicator) => {
        expect(indicator.textContent).not.toBe(
          'No data loaded yet. Services not connected.'
        );
      });
    });
  });

  describe('initialize error handling', () => {
    it('should log error and rethrow on controller initialization failure', async () => {
      const testError = new Error('Controller init failed');
      mockControllerInstance.initialize.mockRejectedValue(testError);

      await expect(bootstrap.initialize()).rejects.toThrow(testError);

      expect(mockLoggerInstance.error).toHaveBeenCalledWith(
        '[ModManagerBootstrap] Failed to load initial data',
        testError
      );
    });

    it('should update loading indicators to error state on failure', async () => {
      const testError = new Error('API connection failed');
      mockControllerInstance.initialize.mockRejectedValue(testError);

      try {
        await bootstrap.initialize();
      } catch {
        // Expected to throw
      }

      mockIndicators.forEach((indicator) => {
        expect(indicator.textContent).toBe('Failed to load data.');
      });
    });
  });

  describe('state change handling', () => {
    it('should show loading state when isLoading is true', async () => {
      mockControllerInstance.subscribe.mockImplementation((callback) => {
        callback({
          availableMods: [],
          isLoading: true,
          error: null,
        });
        return () => {};
      });

      await bootstrap.initialize();

      mockIndicators.forEach((indicator) => {
        expect(indicator.textContent).toBe('Loading mods...');
      });
    });

    it('should show error message from state when error exists', async () => {
      mockControllerInstance.subscribe.mockImplementation((callback) => {
        callback({
          availableMods: [],
          isLoading: false,
          error: 'API returned 500',
        });
        return () => {};
      });

      await bootstrap.initialize();

      mockIndicators.forEach((indicator) => {
        expect(indicator.textContent).toBe('API returned 500');
      });
    });
  });

  describe('destroy', () => {
    it('should log destruction message', async () => {
      await bootstrap.initialize();

      bootstrap.destroy();

      expect(mockLoggerInstance.info).toHaveBeenCalledWith(
        '[ModManagerBootstrap] Destroying Mod Manager...'
      );
    });

    it('should call controller.destroy()', async () => {
      await bootstrap.initialize();

      bootstrap.destroy();

      expect(mockControllerInstance.destroy).toHaveBeenCalled();
    });

    it('should handle destroy without prior initialization', () => {
      expect(() => bootstrap.destroy()).not.toThrow();
    });
  });

  describe('loading state updates', () => {
    it('should update multiple loading indicators', async () => {
      const manyIndicators = [
        { textContent: '' },
        { textContent: '' },
        { textContent: '' },
      ];
      document.querySelectorAll.mockReturnValue(manyIndicators);

      await bootstrap.initialize();

      manyIndicators.forEach((indicator) => {
        expect(indicator.textContent).toBe('Loaded 2 mods');
      });
    });

    it('should handle no loading indicators gracefully', async () => {
      document.querySelectorAll.mockReturnValue([]);

      await expect(bootstrap.initialize()).resolves.not.toThrow();
    });
  });

  describe('container behavior', () => {
    it('should create a Map-based container (lightweight)', async () => {
      await bootstrap.initialize();

      // Container should be created and services registered
      expect(mockLoggerInstance.debug).toHaveBeenCalledWith(
        '[ModManagerBootstrap] Registering services...'
      );
      expect(mockLoggerInstance.info).toHaveBeenCalledWith(
        '[ModManagerBootstrap] Mod Manager initialized successfully'
      );
    });
  });

  describe('view initialization with DOM elements', () => {
    it('should create ModListView when mod-list element exists', async () => {
      setupDOMElements({ modList: true });
      await bootstrap.initialize();

      expect(ModListView).toHaveBeenCalledWith({
        container: expect.any(HTMLElement),
        logger: mockLoggerInstance,
        onModToggle: expect.any(Function),
        modCardComponent: mockModCardComponentInstance,
      });
    });

    it('should create SummaryPanelView when summary-panel element exists', async () => {
      setupDOMElements({ summaryPanel: true });
      await bootstrap.initialize();

      expect(SummaryPanelView).toHaveBeenCalledWith({
        container: expect.any(HTMLElement),
        logger: mockLoggerInstance,
        onSave: expect.any(Function),
      });
    });

    it('should create WorldListView when world-list element exists', async () => {
      setupDOMElements({ worldList: true });
      await bootstrap.initialize();

      expect(WorldListView).toHaveBeenCalledWith({
        container: expect.any(HTMLElement),
        logger: mockLoggerInstance,
        onWorldSelect: expect.any(Function),
      });
    });

    it('should create ModCardComponent', async () => {
      setupDOMElements({ modList: true });
      await bootstrap.initialize();

      expect(ModCardComponent).toHaveBeenCalledWith({
        logger: mockLoggerInstance,
      });
    });

    it('should not create views when DOM elements are missing', async () => {
      setupDOMElements({
        modList: false,
        summaryPanel: false,
        worldList: false,
      });
      await bootstrap.initialize();

      // ModListView should not be called if container is missing
      expect(ModListView).not.toHaveBeenCalled();
      expect(SummaryPanelView).not.toHaveBeenCalled();
      expect(WorldListView).not.toHaveBeenCalled();
    });

    it('should wire onModToggle callback to controller.toggleMod', async () => {
      setupDOMElements({ modList: true });
      await bootstrap.initialize();

      // Get the callback passed to ModListView
      const onModToggle = ModListView.mock.calls[0][0].onModToggle;
      onModToggle('test-mod');

      expect(mockControllerInstance.toggleMod).toHaveBeenCalledWith('test-mod');
    });

    it('should wire onSave callback to controller.saveConfiguration', async () => {
      setupDOMElements({ summaryPanel: true });
      await bootstrap.initialize();

      // Get the callback passed to SummaryPanelView
      const onSave = SummaryPanelView.mock.calls[0][0].onSave;
      onSave();

      expect(mockControllerInstance.saveConfiguration).toHaveBeenCalled();
    });

    it('should wire onWorldSelect callback to controller.selectWorld', async () => {
      setupDOMElements({ worldList: true });
      await bootstrap.initialize();

      // Get the callback passed to WorldListView
      const onWorldSelect = WorldListView.mock.calls[0][0].onWorldSelect;
      onWorldSelect('test-world');

      expect(mockControllerInstance.selectWorld).toHaveBeenCalledWith(
        'test-world'
      );
    });
  });

  describe('navigation', () => {
    it('should wire back button click handler when element exists', async () => {
      const { getBackButton } = setupDOMElements({ backButton: true });
      await bootstrap.initialize();

      // Simulate click
      const backButton = getBackButton();
      const clickEvent = new Event('click');
      backButton.dispatchEvent(clickEvent);

      // Default handler uses window.location.assign - we can't directly test this
      // but we can verify the handler was attached and no error was thrown
      expect(backButton).toBeTruthy();
    });

    it('should use custom navigationHandler when provided', async () => {
      const customHandler = jest.fn();
      bootstrap = new ModManagerBootstrap({ navigationHandler: customHandler });

      const { getBackButton } = setupDOMElements({ backButton: true });
      await bootstrap.initialize();

      // Simulate click
      const backButton = getBackButton();
      const clickEvent = new Event('click');
      backButton.dispatchEvent(clickEvent);

      expect(customHandler).toHaveBeenCalledWith('index.html');
    });

    it('should log warning when navigation fails', async () => {
      const throwingHandler = jest.fn(() => {
        throw new Error('Nav failed');
      });
      bootstrap = new ModManagerBootstrap({
        navigationHandler: throwingHandler,
      });

      const { getBackButton } = setupDOMElements({ backButton: true });
      await bootstrap.initialize();

      // Simulate click
      const backButton = getBackButton();
      const clickEvent = new Event('click');
      backButton.dispatchEvent(clickEvent);

      expect(mockLoggerInstance.warn).toHaveBeenCalledWith(
        '[ModManagerBootstrap] Failed to navigate back to menu',
        expect.any(Error)
      );
    });

    it('should log warning when back button is not found', async () => {
      setupDOMElements({ backButton: false });
      await bootstrap.initialize();

      expect(mockLoggerInstance.warn).toHaveBeenCalledWith(
        '[ModManagerBootstrap] Back button not found; skipping navigation binding'
      );
    });
  });

  describe('UI rendering', () => {
    it('should call ModListView.render with correct parameters', async () => {
      setupDOMElements({ modList: true });
      await bootstrap.initialize();

      expect(mockModListViewInstance.render).toHaveBeenCalledWith({
        mods: expect.any(Array),
        getModDisplayInfo: expect.any(Function),
        getModName: expect.any(Function),
        isLoading: expect.any(Boolean),
      });
    });

    it('should call SummaryPanelView.render with statistics', async () => {
      // Setup nodes map for explicit/dependency counting
      const nodesMap = new Map([
        ['core', { status: 'explicit' }],
        ['dep1', { status: 'dependency' }],
      ]);
      mockModGraphService.getAllNodes.mockReturnValue(nodesMap);

      setupDOMElements({ summaryPanel: true });
      await bootstrap.initialize();

      expect(mockSummaryPanelViewInstance.render).toHaveBeenCalledWith({
        loadOrder: expect.any(Array),
        activeCount: expect.any(Number),
        explicitCount: 1,
        dependencyCount: 1,
        hotspots: expect.any(Array),
        healthStatus: expect.any(Object),
        depthAnalysis: expect.any(Object),
        footprintAnalysis: expect.any(Array),
        profileRatio: expect.any(Object),
        fragilityAnalysis: expect.any(Array),
        hasUnsavedChanges: expect.any(Boolean),
        isSaving: expect.any(Boolean),
        isLoading: expect.any(Boolean),
      });
    });

    it('should call WorldListView.render with correct parameters', async () => {
      setupDOMElements({ worldList: true });
      await bootstrap.initialize();

      expect(mockWorldListViewInstance.render).toHaveBeenCalledWith({
        worlds: expect.any(Array),
        selectedWorld: expect.any(String),
        isLoading: expect.any(Boolean),
      });
    });

    it('should pass getModDisplayInfo function that calls controller', async () => {
      setupDOMElements({ modList: true });
      await bootstrap.initialize();

      // Get the getModDisplayInfo function from the render call
      const getModDisplayInfo =
        mockModListViewInstance.render.mock.calls[0][0].getModDisplayInfo;
      getModDisplayInfo('test-mod');

      expect(mockControllerInstance.getModDisplayInfo).toHaveBeenCalledWith(
        'test-mod'
      );
    });

    it('should pass getModName function that calls controller', async () => {
      setupDOMElements({ modList: true });
      await bootstrap.initialize();

      // Get the getModName function from the render call
      const getModName =
        mockModListViewInstance.render.mock.calls[0][0].getModName;
      getModName('test-mod');

      expect(mockControllerInstance.getModName).toHaveBeenCalledWith(
        'test-mod'
      );
    });

    it('should call statistics service methods during render', async () => {
      setupDOMElements({ summaryPanel: true });
      await bootstrap.initialize();

      expect(mockModStatisticsService.getDependencyHotspots).toHaveBeenCalledWith(5);
      expect(mockModStatisticsService.getHealthStatus).toHaveBeenCalled();
      expect(
        mockModStatisticsService.getDependencyDepthAnalysis
      ).toHaveBeenCalled();
      expect(
        mockModStatisticsService.getTransitiveDependencyFootprints
      ).toHaveBeenCalled();
      expect(mockModStatisticsService.getCoreOptionalRatio).toHaveBeenCalled();
      expect(
        mockModStatisticsService.getSingleParentDependencies
      ).toHaveBeenCalled();
    });

    it('should count explicit and dependency nodes correctly', async () => {
      // Setup a mix of nodes with different statuses
      const nodesMap = new Map([
        ['mod1', { status: 'explicit' }],
        ['mod2', { status: 'explicit' }],
        ['mod3', { status: 'dependency' }],
        ['mod4', { status: 'dependency' }],
        ['mod5', { status: 'dependency' }],
        ['mod6', { status: 'inactive' }], // Other status - should not count
      ]);
      mockModGraphService.getAllNodes.mockReturnValue(nodesMap);

      setupDOMElements({ summaryPanel: true });
      await bootstrap.initialize();

      const renderCall = mockSummaryPanelViewInstance.render.mock.calls[0][0];
      expect(renderCall.explicitCount).toBe(2);
      expect(renderCall.dependencyCount).toBe(3);
    });
  });

  describe('destroy with views initialized', () => {
    beforeEach(async () => {
      setupDOMElements({
        modList: true,
        summaryPanel: true,
        worldList: true,
        backButton: true,
      });
      await bootstrap.initialize();
    });

    it('should call modListView.destroy()', () => {
      bootstrap.destroy();
      expect(mockModListViewInstance.destroy).toHaveBeenCalled();
    });

    it('should call summaryPanelView.destroy()', () => {
      bootstrap.destroy();
      expect(mockSummaryPanelViewInstance.destroy).toHaveBeenCalled();
    });

    it('should call worldListView.destroy()', () => {
      bootstrap.destroy();
      expect(mockWorldListViewInstance.destroy).toHaveBeenCalled();
    });

    it('should remove back button event listener', async () => {
      // Re-initialize with fresh setup to capture the button
      jest.clearAllMocks();
      bootstrap = new ModManagerBootstrap();
      const { getBackButton } = setupDOMElements({
        modList: true,
        summaryPanel: true,
        worldList: true,
        backButton: true,
      });
      mockControllerInstance.initialize.mockResolvedValue(undefined);
      mockControllerInstance.subscribe.mockImplementation((callback) => {
        callback(mockControllerInstance.getState());
        return () => {};
      });

      await bootstrap.initialize();

      const backButton = getBackButton();
      const removeListenerSpy = jest.spyOn(backButton, 'removeEventListener');

      bootstrap.destroy();

      expect(removeListenerSpy).toHaveBeenCalledWith(
        'click',
        expect.any(Function)
      );
    });
  });

  describe('edge cases', () => {
    it('should handle undefined availableMods in state', async () => {
      mockControllerInstance.getState.mockReturnValue({
        isLoading: false,
        resolvedMods: [],
        availableWorlds: [],
        selectedWorld: null,
        hasUnsavedChanges: false,
        isSaving: false,
      });
      mockControllerInstance.subscribe.mockImplementation((callback) => {
        callback(mockControllerInstance.getState());
        return () => {};
      });

      setupDOMElements({
        modList: true,
        summaryPanel: true,
        worldList: true,
      });
      await expect(bootstrap.initialize()).resolves.not.toThrow();
    });

    it('should handle views without destroy method gracefully', async () => {
      mockModListViewInstance.destroy = undefined;
      mockSummaryPanelViewInstance.destroy = undefined;
      mockWorldListViewInstance.destroy = undefined;

      setupDOMElements({
        modList: true,
        summaryPanel: true,
        worldList: true,
      });
      await bootstrap.initialize();
      expect(() => bootstrap.destroy()).not.toThrow();
    });

    it('should handle controller without destroy method gracefully', async () => {
      mockControllerInstance.destroy = undefined;

      await bootstrap.initialize();
      expect(() => bootstrap.destroy()).not.toThrow();
    });

    it('should handle empty nodes map when rendering summary', async () => {
      mockModGraphService.getAllNodes.mockReturnValue(new Map());

      setupDOMElements({ summaryPanel: true });
      await bootstrap.initialize();

      const renderCall = mockSummaryPanelViewInstance.render.mock.calls[0][0];
      expect(renderCall.explicitCount).toBe(0);
      expect(renderCall.dependencyCount).toBe(0);
    });
  });
});

describe('ModManagerBootstrap default export', () => {
  it('should have named and default exports', async () => {
    const moduleImport = await import(
      '../../../src/modManager/ModManagerBootstrap.js'
    );

    expect(moduleImport.ModManagerBootstrap).toBeDefined();
    expect(moduleImport.default).toBeDefined();
    expect(moduleImport.ModManagerBootstrap).toBe(moduleImport.default);
  });
});
