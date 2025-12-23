/**
 * @file Integration tests for Mod Manager UI rendering
 * @description Verifies that the mod manager correctly renders mod cards,
 *              summary panel, and world list after initialization.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Sample mod data for testing
const mockMods = [
  {
    id: 'core',
    name: 'Core',
    version: '1.0.0',
    description: 'Core game functionality',
    dependencies: [],
    hasWorlds: false,
  },
  {
    id: 'positioning',
    name: 'Positioning',
    version: '1.0.0',
    description: 'Position and movement system',
    dependencies: [{ id: 'core', version: '1.0.0' }],
    hasWorlds: false,
  },
  {
    id: 'dredgers',
    name: 'Dredgers',
    version: '1.0.0',
    description: 'Dredgers world mod',
    dependencies: [{ id: 'core', version: '1.0.0' }],
    hasWorlds: true,
  },
];

const mockConfig = {
  mods: ['core', 'positioning', 'dredgers'],
  startWorld: 'dredgers:dredgers',
};

const mockWorlds = [
  {
    id: 'dredgers:dredgers',
    name: 'Dredgers',
    description: 'The world of Dredgers',
    modId: 'dredgers',
  },
];

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
  discoverMods: jest.fn().mockResolvedValue(mockMods),
  getModById: jest.fn((id) => mockMods.find((m) => m.id === id)),
  clearCache: jest.fn(),
};

const mockModGraphService = {
  buildGraph: jest.fn(),
  setExplicitMods: jest.fn(),
  getLoadOrder: jest.fn().mockReturnValue(['core', 'positioning', 'dredgers']),
  getModStatus: jest.fn((modId) => {
    if (modId === 'core') return { status: 'core', isExplicit: false, isDependency: false };
    if (modId === 'positioning') return { status: 'explicit', isExplicit: true, isDependency: false };
    if (modId === 'dredgers') return { status: 'explicit', isExplicit: true, isDependency: false };
    return { status: 'inactive', isExplicit: false, isDependency: false };
  }),
  getAllNodes: jest.fn().mockReturnValue(new Map()),
};

const mockModStatisticsService = {
  invalidateCache: jest.fn(),
  getGraphService: jest.fn().mockReturnValue(mockModGraphService),
  isCacheValid: jest.fn().mockReturnValue(false),
  getDependencyHotspots: jest.fn().mockReturnValue([
    { modId: 'core', dependentCount: 2 },
    { modId: 'positioning', dependentCount: 1 },
  ]),
  getHealthStatus: jest.fn().mockReturnValue({
    hasCircularDeps: false,
    missingDeps: [],
    loadOrderValid: true,
    warnings: [],
    errors: [],
  }),
  getDependencyDepthAnalysis: jest.fn().mockReturnValue({
    maxDepth: 1,
    deepestChain: ['core', 'positioning'],
    averageDepth: 0.7,
  }),
  getTransitiveDependencyFootprints: jest.fn().mockReturnValue({
    footprints: [
      { modId: 'dredgers', dependencies: ['core'], count: 1 },
      { modId: 'positioning', dependencies: ['core'], count: 1 },
    ],
    totalUniqueDeps: 1,
    sharedDepsCount: 1,
    overlapPercentage: 100,
  }),
  getCoreOptionalRatio: jest.fn().mockReturnValue({
    foundationCount: 1,
    optionalCount: 2,
    totalActive: 3,
    foundationPercentage: 33,
    optionalPercentage: 67,
    foundationMods: ['core'],
    profile: 'content-heavy',
  }),
  getSingleParentDependencies: jest.fn().mockReturnValue({
    atRiskMods: [],
    totalAtRisk: 0,
    percentageOfDeps: 0,
  }),
};

const mockWorldDiscoveryService = {
  discoverWorlds: jest.fn().mockResolvedValue(mockWorlds),
};

const mockConfigPersistenceService = {
  loadConfig: jest.fn().mockResolvedValue(mockConfig),
  saveConfig: jest.fn().mockResolvedValue(undefined),
  hasChanges: jest.fn().mockReturnValue(false),
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

// Mock controller with proper state management
const mockControllerState = {
  availableMods: mockMods,
  activeMods: ['core', 'positioning', 'dredgers'],
  resolvedMods: ['core', 'positioning', 'dredgers'],
  selectedWorld: 'dredgers:dredgers',
  availableWorlds: mockWorlds,
  hasUnsavedChanges: false,
  isLoading: false,
  isSaving: false,
  error: null,
  searchQuery: '',
  filterCategory: 'all',
};

const mockControllerInstance = {
  initialize: jest.fn().mockResolvedValue(undefined),
  subscribe: jest.fn((callback) => {
    // Immediately call callback with current state
    callback(mockControllerState);
    return () => {};
  }),
  getState: jest.fn(() => mockControllerState),
  getModDisplayInfo: jest.fn((modId) => {
    const status = mockModGraphService.getModStatus(modId);
    return {
      isActive: status.status !== 'inactive',
      isLocked: status.status === 'core',
      isExplicit: status.isExplicit,
      isDependency: status.isDependency,
      status: status.status,
    };
  }),
  getModName: jest.fn((modId) => {
    const mod = mockMods.find((m) => m.id === modId);
    return mod?.name || modId;
  }),
  toggleMod: jest.fn(),
  selectWorld: jest.fn(),
  saveConfig: jest.fn(),
  destroy: jest.fn(),
};

jest.mock('../../../src/modManager/controllers/ModManagerController.js', () => {
  const mock = jest.fn(() => mockControllerInstance);
  return {
    __esModule: true,
    ModManagerController: mock,
    default: mock,
  };
});

// HTML template matching mod-manager.html structure
const HTML_TEMPLATE = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Mod Manager Test</title>
  </head>
  <body>
    <div id="mod-manager-root" class="mod-manager-container">
      <header class="mod-manager-header">
        <h1>Mod Manager</h1>
        <button type="button" id="back-button" class="menu-button">Back to Menu</button>
        <button type="button" id="save-config-btn" class="save-button" disabled>
          Save Configuration
        </button>
      </header>

      <main class="mod-manager-main">
        <section class="mod-list-panel" aria-labelledby="mods-heading">
          <div class="panel-header">
            <h2 id="mods-heading">Available Mods</h2>
            <div class="search-container">
              <input
                type="search"
                id="mod-search"
                placeholder="Search mods..."
                aria-label="Search mods"
              />
            </div>
          </div>
          <div id="mod-list" class="mod-list" role="list" aria-live="polite">
            <div class="loading-indicator" aria-busy="true">Loading mods...</div>
          </div>
        </section>

        <aside class="side-panel">
          <section class="world-panel" aria-labelledby="worlds-heading">
            <h2 id="worlds-heading">Available Worlds</h2>
            <div
              id="world-list"
              class="world-list"
              role="listbox"
              aria-live="polite"
            >
              <div class="loading-indicator" aria-busy="true">
                Loading worlds...
              </div>
            </div>
          </section>

          <section class="summary-panel" aria-labelledby="summary-heading">
            <h2 id="summary-heading">Load Summary</h2>
            <dl id="summary-content" class="summary-content">
              <dt>Active Mods:</dt>
              <dd id="active-mod-count">0</dd>
              <dt>Explicit:</dt>
              <dd id="explicit-mod-count">0</dd>
              <dt>Dependencies:</dt>
              <dd id="dependency-mod-count">0</dd>
              <dt>Conflicts:</dt>
              <dd id="conflict-count">0</dd>
              <dt>Selected World:</dt>
              <dd id="selected-world">None</dd>
            </dl>
          </section>
        </aside>
      </main>

      <footer class="mod-manager-footer">
        <div id="status-message" class="status-message" aria-live="polite"></div>
      </footer>
    </div>
  </body>
</html>
`;

describe('Mod Manager UI Rendering Integration', () => {
  let bootstrap;
  let originalBodyContent;

  beforeEach(() => {
    jest.clearAllMocks();

    // Save original body content to restore later
    originalBodyContent = document.body.innerHTML;

    // Replace the body with our HTML template content
    // Extract just the body content from HTML_TEMPLATE
    const bodyMatch = HTML_TEMPLATE.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    if (bodyMatch) {
      document.body.innerHTML = bodyMatch[1];
    }
  });

  afterEach(async () => {
    if (bootstrap?.destroy) {
      bootstrap.destroy();
    }
    jest.resetModules();

    // Restore original body content
    document.body.innerHTML = originalBodyContent;

    bootstrap = null;
  });

  describe('Mod List Rendering', () => {
    it('should render mod cards in the mod list after initialization', async () => {
      // Import after mocks are set up
      const { ModManagerBootstrap } = await import(
        '../../../src/modManager/ModManagerBootstrap.js'
      );

      bootstrap = new ModManagerBootstrap();
      await bootstrap.initialize();

      // Wait for DOM updates
      await new Promise((resolve) => setTimeout(resolve, 50));

      const modList = document.getElementById('mod-list');
      expect(modList).not.toBeNull();
      const modCards = modList.querySelectorAll('[data-mod-id]');

      expect(modCards.length).toBeGreaterThan(0);
      expect(modCards.length).toBe(mockMods.length);
    });

    it('should display mod names in the mod cards', async () => {
      const { ModManagerBootstrap } = await import(
        '../../../src/modManager/ModManagerBootstrap.js'
      );

      bootstrap = new ModManagerBootstrap();
      await bootstrap.initialize();

      await new Promise((resolve) => setTimeout(resolve, 50));

      const modList = document.getElementById('mod-list');
      expect(modList).not.toBeNull();
      const coreCard = modList.querySelector('[data-mod-id="core"]');

      expect(coreCard).not.toBeNull();
      expect(coreCard.textContent).toContain('Core');
    });

    it('should mark core mod as locked', async () => {
      const { ModManagerBootstrap } = await import(
        '../../../src/modManager/ModManagerBootstrap.js'
      );

      bootstrap = new ModManagerBootstrap();
      await bootstrap.initialize();

      await new Promise((resolve) => setTimeout(resolve, 50));

      const modList = document.getElementById('mod-list');
      expect(modList).not.toBeNull();
      const coreCard = modList.querySelector('[data-mod-id="core"]');

      expect(coreCard).not.toBeNull();
      expect(coreCard.classList.contains('mod-card--locked')).toBe(true);
    });
  });

  describe('Summary Panel Rendering', () => {
    it('should display correct active mod count', async () => {
      const { ModManagerBootstrap } = await import(
        '../../../src/modManager/ModManagerBootstrap.js'
      );

      bootstrap = new ModManagerBootstrap();
      await bootstrap.initialize();

      await new Promise((resolve) => setTimeout(resolve, 50));

      // The summary panel creates its own structure, look for the stat value
      const summaryPanel = document.querySelector('.summary-panel');
      const statValue = summaryPanel.querySelector('.summary-panel__stat-value');

      // Active count should reflect the load order (3 mods)
      expect(statValue).not.toBeNull();
      expect(statValue.textContent).toBe('3');
    });

    it('should display load order with correct mods', async () => {
      const { ModManagerBootstrap } = await import(
        '../../../src/modManager/ModManagerBootstrap.js'
      );

      bootstrap = new ModManagerBootstrap();
      await bootstrap.initialize();

      await new Promise((resolve) => setTimeout(resolve, 50));

      const summaryPanel = document.querySelector('.summary-panel');
      const loadOrderList = summaryPanel.querySelector('.summary-panel__load-order-list');

      expect(loadOrderList).not.toBeNull();
      expect(loadOrderList.children.length).toBe(3);
      expect(loadOrderList.textContent).toContain('core');
      expect(loadOrderList.textContent).toContain('positioning');
      expect(loadOrderList.textContent).toContain('dredgers');
    });
  });

  describe('World List Rendering', () => {
    it('should render available worlds', async () => {
      const { ModManagerBootstrap } = await import(
        '../../../src/modManager/ModManagerBootstrap.js'
      );

      bootstrap = new ModManagerBootstrap();
      await bootstrap.initialize();

      await new Promise((resolve) => setTimeout(resolve, 50));

      const worldList = document.getElementById('world-list');
      const worldOptions = worldList.querySelectorAll('.world-option');

      expect(worldOptions.length).toBeGreaterThan(0);
    });

    it('should select the configured world', async () => {
      const { ModManagerBootstrap } = await import(
        '../../../src/modManager/ModManagerBootstrap.js'
      );

      bootstrap = new ModManagerBootstrap();
      await bootstrap.initialize();

      await new Promise((resolve) => setTimeout(resolve, 50));

      const worldList = document.getElementById('world-list');
      const selectedRadio = worldList.querySelector('input[type="radio"]:checked');

      expect(selectedRadio).not.toBeNull();
      expect(selectedRadio.value).toBe('dredgers:dredgers');
    });

    it('should display world details for selected world', async () => {
      const { ModManagerBootstrap } = await import(
        '../../../src/modManager/ModManagerBootstrap.js'
      );

      bootstrap = new ModManagerBootstrap();
      await bootstrap.initialize();

      await new Promise((resolve) => setTimeout(resolve, 50));

      const worldList = document.getElementById('world-list');
      const detailsPanel = worldList.querySelector('.world-details');

      expect(detailsPanel).not.toBeNull();
      expect(detailsPanel.textContent).toContain('Dredgers');
    });
  });

  describe('Loading State', () => {
    it('should show mod cards instead of loading indicator after initialization', async () => {
      const { ModManagerBootstrap } = await import(
        '../../../src/modManager/ModManagerBootstrap.js'
      );

      bootstrap = new ModManagerBootstrap();
      await bootstrap.initialize();

      await new Promise((resolve) => setTimeout(resolve, 50));

      // After views render, the original loading-indicator is replaced by view structure
      const modList = document.getElementById('mod-list');
      expect(modList).not.toBeNull();

      // ModListView creates .mod-list__loading which should be hidden when not loading
      const viewLoadingElement = modList.querySelector('.mod-list__loading');
      // The loading element is hidden after data loads
      expect(viewLoadingElement?.hidden ?? true).toBe(true);

      // Instead we should have mod cards rendered
      const modCards = modList.querySelectorAll('[data-mod-id]');
      expect(modCards.length).toBe(mockMods.length);
    });
  });

  describe('User Interactions', () => {
    it('should have save button initially disabled when no changes', async () => {
      const { ModManagerBootstrap } = await import(
        '../../../src/modManager/ModManagerBootstrap.js'
      );

      bootstrap = new ModManagerBootstrap();
      await bootstrap.initialize();

      await new Promise((resolve) => setTimeout(resolve, 50));

      const summaryPanel = document.querySelector('.summary-panel');
      const saveButton = summaryPanel.querySelector('.summary-panel__save-button');

      expect(saveButton).not.toBeNull();
      expect(saveButton.disabled).toBe(true);
    });
  });
});
