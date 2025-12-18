/**
 * @file Integration tests for Mod Manager navigation controls
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ModManagerBootstrap } from '../../../src/modManager/ModManagerBootstrap.js';

// Minimal controller mock to prevent network calls during bootstrap
const mockControllerState = {
  availableMods: [],
  resolvedMods: [],
  availableWorlds: [],
  selectedWorld: null,
  hasUnsavedChanges: false,
  isLoading: false,
  isSaving: false,
  error: null,
};

const mockControllerInstance = {
  initialize: jest.fn().mockResolvedValue(undefined),
  subscribe: jest.fn((callback) => {
    callback(mockControllerState);
    return () => {};
  }),
  getModDisplayInfo: jest.fn(() => ({
    status: 'inactive',
    isExplicit: false,
    isDependency: false,
    isActive: false,
    isLocked: false,
  })),
  getModName: jest.fn((modId) => modId),
  toggleMod: jest.fn(),
  selectWorld: jest.fn(),
  saveConfiguration: jest.fn(),
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

const HTML_TEMPLATE = `
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
`;

describe('Mod Manager navigation', () => {
  let bootstrap;
  let navigationHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = HTML_TEMPLATE;
    navigationHandler = jest.fn();
  });

  afterEach(() => {
    if (bootstrap?.destroy) {
      bootstrap.destroy();
    }
    document.body.innerHTML = '';
    bootstrap = null;
  });

  it('navigates back to index.html when the back button is clicked', async () => {
    bootstrap = new ModManagerBootstrap({ navigationHandler });
    await bootstrap.initialize();

    const backButton = document.getElementById('back-button');
    expect(backButton).not.toBeNull();

    backButton.click();

    expect(navigationHandler).toHaveBeenCalledWith('index.html');
  });
});
