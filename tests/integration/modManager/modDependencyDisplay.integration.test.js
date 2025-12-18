/**
 * @file Integration tests for mod dependency display behavior
 * @description Verifies that the mod manager correctly displays dependency status
 *              and checkbox disabled state for various mod relationships.
 *
 * Test Cases:
 * 1. Pure dependency (auto-activated) -> shows DEPENDENCY badge, checkbox disabled
 * 2. Explicit mod with explicit dependents -> shows REQUIRED badge, checkbox disabled
 * 3. Explicit mod with no dependents -> no badge, checkbox enabled
 * 4. Core mod -> shows CORE badge, checkbox disabled
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Sample mod data reflecting real dependency relationships:
// - core: always active
// - positioning: explicit mod (in game.json)
// - anatomy: explicit mod (in game.json)
// - kissing: explicit mod with dependents (affection/caressing depend on it)
// - affection: explicit mod, depends on kissing
// - caressing: explicit mod, depends on kissing
// - locations: pure dependency (dredgers depends on it, but locations is NOT in game.json explicitly)
// - dredgers: explicit mod, depends on locations
// - locks: explicit mod with no dependents
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
    id: 'anatomy',
    name: 'Anatomy',
    version: '1.0.0',
    description: 'Character anatomy system',
    dependencies: [{ id: 'core', version: '1.0.0' }],
    hasWorlds: false,
  },
  {
    id: 'kissing',
    name: 'Kissing',
    version: '1.0.0',
    description: 'Kissing actions',
    dependencies: [
      { id: 'core', version: '1.0.0' },
      { id: 'anatomy', version: '1.0.0' },
      { id: 'positioning', version: '1.0.0' },
    ],
    hasWorlds: false,
  },
  {
    id: 'affection',
    name: 'Affection',
    version: '1.0.0',
    description: 'Affection actions',
    dependencies: [
      { id: 'core', version: '1.0.0' },
      { id: 'kissing', version: '1.0.0' },
    ],
    hasWorlds: false,
  },
  {
    id: 'caressing',
    name: 'Caressing',
    version: '1.0.0',
    description: 'Caressing actions',
    dependencies: [
      { id: 'core', version: '1.0.0' },
      { id: 'kissing', version: '1.0.0' },
    ],
    hasWorlds: false,
  },
  {
    id: 'locations',
    name: 'Locations',
    version: '1.0.0',
    description: 'Location system',
    dependencies: [{ id: 'core', version: '1.0.0' }],
    hasWorlds: false,
  },
  {
    id: 'dredgers',
    name: 'Dredgers',
    version: '1.0.0',
    description: 'Dredgers world mod',
    dependencies: [
      { id: 'core', version: '1.0.0' },
      { id: 'locations', version: '1.0.0' },
    ],
    hasWorlds: true,
  },
  {
    id: 'locks',
    name: 'Locks',
    version: '1.0.0',
    description: 'Lock and key system',
    dependencies: [{ id: 'core', version: '1.0.0' }],
    hasWorlds: false,
  },
];

// Simulated game.json - explicit mods (NOT including locations - it's a dependency)
// This represents the real issue: kissing is explicit, but has explicit dependents
const mockConfig = {
  mods: [
    'core',
    'positioning',
    'anatomy',
    'kissing',
    'affection',
    'caressing',
    'dredgers',
    'locks',
  ],
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

// Mock all services EXCEPT ModGraphService which we want to test for real behavior
const mockModDiscoveryService = {
  discoverMods: jest.fn().mockResolvedValue(mockMods),
  getModById: jest.fn((id) => mockMods.find((m) => m.id === id)),
  clearCache: jest.fn(),
};

const mockWorldDiscoveryService = {
  discoverWorlds: jest.fn().mockResolvedValue(mockWorlds),
};

const mockConfigPersistenceService = {
  loadConfig: jest.fn().mockResolvedValue(mockConfig),
  saveConfig: jest.fn().mockResolvedValue({ success: true }),
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

describe('Mod Dependency Display Integration', () => {
  let bootstrap;
  let originalBodyContent;

  beforeEach(() => {
    jest.clearAllMocks();

    // Save original body content to restore later
    originalBodyContent = document.body.innerHTML;

    // Replace the body with our HTML template content
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

  /**
   * Helper to get mod card element by mod ID
   * @param {string} modId
   * @returns {HTMLElement|null}
   */
  function getModCard(modId) {
    const modList = document.getElementById('mod-list');
    return modList?.querySelector(`[data-mod-id="${modId}"]`);
  }

  /**
   * Helper to get checkbox element from mod card
   * @param {string} modId
   * @returns {HTMLInputElement|null}
   */
  function getModCheckbox(modId) {
    const card = getModCard(modId);
    return card?.querySelector('.mod-card__checkbox');
  }

  /**
   * Helper to get badge text from mod card
   * @param {string} modId
   * @returns {string|null}
   */
  function getModBadge(modId) {
    const card = getModCard(modId);
    const badge = card?.querySelector('.mod-badge:not([aria-label="Contains worlds"])');
    return badge?.textContent || null;
  }

  describe('Pure Dependency Display (locations mod)', () => {
    it('should show DEPENDENCY badge for auto-activated dependency', async () => {
      // Import after mocks are set up
      const { ModManagerBootstrap } = await import(
        '../../../src/modManager/ModManagerBootstrap.js'
      );

      bootstrap = new ModManagerBootstrap();
      await bootstrap.initialize();

      // Wait for DOM updates
      await new Promise((resolve) => setTimeout(resolve, 100));

      // locations is NOT in game.json explicitly, but is pulled in as dependency of dredgers
      // It should show "Dependency" badge
      const badge = getModBadge('locations');
      expect(badge).toBe('Dependency');
    });

    it('should have disabled checkbox for pure dependency', async () => {
      const { ModManagerBootstrap } = await import(
        '../../../src/modManager/ModManagerBootstrap.js'
      );

      bootstrap = new ModManagerBootstrap();
      await bootstrap.initialize();

      await new Promise((resolve) => setTimeout(resolve, 100));

      const checkbox = getModCheckbox('locations');
      expect(checkbox).not.toBeNull();
      expect(checkbox.disabled).toBe(true);
    });
  });

  describe('Explicit Mod with Explicit Dependents Display (kissing mod)', () => {
    it('should show REQUIRED badge for explicit mod with explicit dependents', async () => {
      const { ModManagerBootstrap } = await import(
        '../../../src/modManager/ModManagerBootstrap.js'
      );

      bootstrap = new ModManagerBootstrap();
      await bootstrap.initialize();

      await new Promise((resolve) => setTimeout(resolve, 100));

      // kissing IS in game.json explicitly, but affection and caressing also depend on it
      // It should show "Required" badge (new feature)
      const badge = getModBadge('kissing');
      expect(badge).toBe('Required');
    });

    it('should have disabled checkbox for explicit mod with explicit dependents', async () => {
      const { ModManagerBootstrap } = await import(
        '../../../src/modManager/ModManagerBootstrap.js'
      );

      bootstrap = new ModManagerBootstrap();
      await bootstrap.initialize();

      await new Promise((resolve) => setTimeout(resolve, 100));

      // kissing checkbox should be disabled because other explicit mods depend on it
      const checkbox = getModCheckbox('kissing');
      expect(checkbox).not.toBeNull();
      expect(checkbox.disabled).toBe(true);
    });
  });

  describe('Explicit Mod with No Dependents Display (locks mod)', () => {
    it('should NOT show any status badge for explicit mod with no dependents', async () => {
      const { ModManagerBootstrap } = await import(
        '../../../src/modManager/ModManagerBootstrap.js'
      );

      bootstrap = new ModManagerBootstrap();
      await bootstrap.initialize();

      await new Promise((resolve) => setTimeout(resolve, 100));

      // locks IS in game.json explicitly and nothing depends on it
      // It should have NO badge (just "active")
      const badge = getModBadge('locks');
      expect(badge).toBeNull();
    });

    it('should have ENABLED checkbox for explicit mod with no dependents', async () => {
      const { ModManagerBootstrap } = await import(
        '../../../src/modManager/ModManagerBootstrap.js'
      );

      bootstrap = new ModManagerBootstrap();
      await bootstrap.initialize();

      await new Promise((resolve) => setTimeout(resolve, 100));

      // locks checkbox should be enabled - user can deactivate it
      const checkbox = getModCheckbox('locks');
      expect(checkbox).not.toBeNull();
      expect(checkbox.disabled).toBe(false);
    });
  });

  describe('Core Mod Display', () => {
    it('should show CORE badge for core mod', async () => {
      const { ModManagerBootstrap } = await import(
        '../../../src/modManager/ModManagerBootstrap.js'
      );

      bootstrap = new ModManagerBootstrap();
      await bootstrap.initialize();

      await new Promise((resolve) => setTimeout(resolve, 100));

      const badge = getModBadge('core');
      expect(badge).toBe('Core');
    });

    it('should have disabled checkbox for core mod', async () => {
      const { ModManagerBootstrap } = await import(
        '../../../src/modManager/ModManagerBootstrap.js'
      );

      bootstrap = new ModManagerBootstrap();
      await bootstrap.initialize();

      await new Promise((resolve) => setTimeout(resolve, 100));

      const checkbox = getModCheckbox('core');
      expect(checkbox).not.toBeNull();
      expect(checkbox.disabled).toBe(true);
    });
  });

  describe('Dependency Name Display', () => {
    /**
     * Helper to get dependencies element from mod card
     * @param {string} modId
     * @returns {HTMLElement|null}
     */
    function getDependenciesElement(modId) {
      const card = getModCard(modId);
      return card?.querySelector('.mod-card-dependencies');
    }

    it('should display dependency names on mod cards with dependencies', async () => {
      const { ModManagerBootstrap } = await import(
        '../../../src/modManager/ModManagerBootstrap.js'
      );

      bootstrap = new ModManagerBootstrap();
      await bootstrap.initialize();

      await new Promise((resolve) => setTimeout(resolve, 100));

      // kissing has 3 dependencies: core, anatomy, positioning
      const depsElement = getDependenciesElement('kissing');
      expect(depsElement).not.toBeNull();
      expect(depsElement.textContent).toContain('3 dependencies');
      expect(depsElement.textContent).toContain('Core');
      expect(depsElement.textContent).toContain('Anatomy');
      expect(depsElement.textContent).toContain('Positioning');
    });

    it('should display singular "dependency" for single dependency', async () => {
      const { ModManagerBootstrap } = await import(
        '../../../src/modManager/ModManagerBootstrap.js'
      );

      bootstrap = new ModManagerBootstrap();
      await bootstrap.initialize();

      await new Promise((resolve) => setTimeout(resolve, 100));

      // positioning has 1 dependency: core
      const depsElement = getDependenciesElement('positioning');
      expect(depsElement).not.toBeNull();
      expect(depsElement.textContent).toContain('1 dependency');
      expect(depsElement.textContent).toContain('Core');
      // Should not contain 'dependencies' (plural)
      expect(depsElement.textContent).not.toMatch(/1 dependencies/);
    });

    it('should show tooltip with names and IDs', async () => {
      const { ModManagerBootstrap } = await import(
        '../../../src/modManager/ModManagerBootstrap.js'
      );

      bootstrap = new ModManagerBootstrap();
      await bootstrap.initialize();

      await new Promise((resolve) => setTimeout(resolve, 100));

      // affection depends on core and kissing
      const depsElement = getDependenciesElement('affection');
      expect(depsElement).not.toBeNull();

      const tooltip = depsElement.getAttribute('title');
      expect(tooltip).toContain('Dependencies:');
      // For mods where name differs from ID, show "Name (id)"
      expect(tooltip).toContain('Kissing (kissing)');
      // Core has name === id, so should just show 'core'
      expect(tooltip).toContain('core');
    });

    it('should display all dependency names without truncation', async () => {
      const { ModManagerBootstrap } = await import(
        '../../../src/modManager/ModManagerBootstrap.js'
      );

      bootstrap = new ModManagerBootstrap();
      await bootstrap.initialize();

      await new Promise((resolve) => setTimeout(resolve, 100));

      // kissing has 3 dependencies - all should be visible
      const depsElement = getDependenciesElement('kissing');
      expect(depsElement).not.toBeNull();

      const text = depsElement.textContent;
      // All three dependency names should appear
      expect(text).toContain('Core');
      expect(text).toContain('Anatomy');
      expect(text).toContain('Positioning');
    });

    it('should not show dependencies element for mods without dependencies', async () => {
      const { ModManagerBootstrap } = await import(
        '../../../src/modManager/ModManagerBootstrap.js'
      );

      bootstrap = new ModManagerBootstrap();
      await bootstrap.initialize();

      await new Promise((resolve) => setTimeout(resolve, 100));

      // core has no dependencies
      const depsElement = getDependenciesElement('core');
      expect(depsElement).toBeNull();
    });

    it('should include screen reader accessible text with dependency names', async () => {
      const { ModManagerBootstrap } = await import(
        '../../../src/modManager/ModManagerBootstrap.js'
      );

      bootstrap = new ModManagerBootstrap();
      await bootstrap.initialize();

      await new Promise((resolve) => setTimeout(resolve, 100));

      const depsElement = getDependenciesElement('affection');
      expect(depsElement).not.toBeNull();

      // Check for visually-hidden screen reader text
      const srText = depsElement.querySelector('.visually-hidden');
      expect(srText).not.toBeNull();
      expect(srText.textContent).toContain('Depends on:');
      expect(srText.textContent).toContain('Kissing');
    });

    it('should display dependency names in comma-separated format', async () => {
      const { ModManagerBootstrap } = await import(
        '../../../src/modManager/ModManagerBootstrap.js'
      );

      bootstrap = new ModManagerBootstrap();
      await bootstrap.initialize();

      await new Promise((resolve) => setTimeout(resolve, 100));

      // affection has 2 dependencies
      const depsElement = getDependenciesElement('affection');
      expect(depsElement).not.toBeNull();

      const text = depsElement.textContent;
      // Should have format: "2 dependencies - Core, Kissing"
      expect(text).toMatch(/2 dependencies - .+, .+/);
    });
  });

  describe('Visual Styling Consistency', () => {
    it('should apply active-dependency class to pure dependencies', async () => {
      const { ModManagerBootstrap } = await import(
        '../../../src/modManager/ModManagerBootstrap.js'
      );

      bootstrap = new ModManagerBootstrap();
      await bootstrap.initialize();

      await new Promise((resolve) => setTimeout(resolve, 100));

      const locationsCard = getModCard('locations');
      expect(locationsCard).not.toBeNull();
      expect(locationsCard.classList.contains('active-dependency')).toBe(true);
    });

    it('should apply active-explicit class to explicit mod with dependents', async () => {
      const { ModManagerBootstrap } = await import(
        '../../../src/modManager/ModManagerBootstrap.js'
      );

      bootstrap = new ModManagerBootstrap();
      await bootstrap.initialize();

      await new Promise((resolve) => setTimeout(resolve, 100));

      // kissing is explicit (even though it has explicit dependents)
      const kissingCard = getModCard('kissing');
      expect(kissingCard).not.toBeNull();
      // It should still be marked as explicit (its status is 'explicit')
      expect(kissingCard.classList.contains('active-explicit')).toBe(true);
    });
  });
});
