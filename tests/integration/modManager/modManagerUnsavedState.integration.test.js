/**
 * @file Regression tests for Mod Manager unsaved state on initial load
 */

import fs from 'fs';
import path from 'path';
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

/**
 * Mirror the real mod-manager.html structure the bootstrap expects
 */
const HTML_TEMPLATE = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Mod Manager Regression</title>
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

/**
 * Build a realistic mod discovery payload from the repository's mod data
 */
function loadModMetadataFromDisk() {
  const modsDir = path.join(process.cwd(), 'data', 'mods');
  const entries = fs.readdirSync(modsDir, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const manifestPath = path.join(modsDir, entry.name, 'mod-manifest.json');
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const hasWorlds = fs.existsSync(path.join(modsDir, entry.name, 'worlds'));

      return {
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        description: manifest.description || '',
        author: manifest.author || 'Unknown',
        dependencies: manifest.dependencies || [],
        conflicts: manifest.conflicts || [],
        hasWorlds,
      };
    });
}

describe('Mod Manager unsaved indicator regression', () => {
  let originalFetch;
  let bootstrap;
  let originalBody;

  beforeEach(() => {
    originalFetch = global.fetch;
    originalBody = document.body.innerHTML;

    // Hydrate DOM with the mod manager shell
    const bodyMatch = HTML_TEMPLATE.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    if (bodyMatch) {
      document.body.innerHTML = bodyMatch[1];
    }

    const mods = loadModMetadataFromDisk();
    const gameConfig = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'data', 'game.json'), 'utf8')
    );

    const modResponse = {
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          mods,
          count: mods.length,
          scannedAt: new Date().toISOString(),
        }),
    };

    const configResponse = {
      ok: true,
      json: () => Promise.resolve({ success: true, config: gameConfig }),
    };

    const saveResponse = {
      ok: true,
      json: () =>
        Promise.resolve({ success: true, message: 'Configuration saved', config: gameConfig }),
    };

    global.fetch = jest.fn((url, options) => {
      if (url.includes('/api/mods')) return Promise.resolve(modResponse);
      if (url.includes('/api/game-config/current')) return Promise.resolve(configResponse);
      if (url.includes('/api/game-config') && options?.method === 'POST')
        return Promise.resolve(saveResponse);
      return Promise.reject(new Error(`Unhandled fetch URL: ${url}`));
    });
  });

  afterEach(() => {
    if (bootstrap?.destroy) {
      bootstrap.destroy();
    }
    global.fetch = originalFetch;
    document.body.innerHTML = originalBody;
    jest.restoreAllMocks();
    bootstrap = null;
  });

  it('should not show unsaved changes immediately after loading real data', async () => {
    const { ModManagerBootstrap } = await import(
      '../../../src/modManager/ModManagerBootstrap.js'
    );

    bootstrap = new ModManagerBootstrap();
    await bootstrap.initialize();

    // Allow any microtasks to settle
    await new Promise((resolve) => setTimeout(resolve, 20));

    const unsavedIndicator = document.querySelector('.summary-panel__unsaved');
    const saveButton = document.querySelector('.summary-panel__save-button');

    expect(unsavedIndicator).toBeTruthy();
    // This currently fails in the browser: the indicator is visible right after load
    expect(unsavedIndicator.hidden).toBe(true);
    expect(saveButton?.disabled).toBe(true);
  });
});
