// @jest-environment node

import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import path from 'path';
import { promises as fs } from 'fs';
import * as componentIds from '../../../src/constants/componentIds.js';
import * as eventIds from '../../../src/constants/eventIds.js';
import { findSimilar } from '../../../src/utils/suggestionUtils.js';
import { registerLoaders } from '../../../src/dependencyInjection/registrations/loadersRegistrations.js';
import { registerInterpreters } from '../../../src/dependencyInjection/registrations/interpreterRegistrations.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';

const EXCLUDED_EVENT_IDS = new Set([
  'core:action_execution_started',
  'core:action_execution_completed',
  'core:action_execution_failed',
  'core:action_validation_failed',
  'core:ai_decision_requested',
  'core:ai_decision_received',
  'core:ai_decision_failed',
  'core:ui_operation_failed',
  'core:ui_show_llm_prompt_preview',
  'core:portrait_clicked',
  'initialization:initialization_service:failed',
  'ui:show_fatal_error',
  'worldinit:entity_instantiation_failed',
]);

/**
 * Fetch a local JSON file and return a minimal Response-like object.
 *
 * @param {string} identifier Path to the file to fetch.
 * @returns {Promise<object>} An object mimicking the Response interface.
 */
function nodeFileFetch(identifier) {
  return (async () => {
    try {
      let absolutePath = path.resolve(process.cwd(), identifier);
      let content;
      try {
        content = await fs.readFile(absolutePath, 'utf8');
      } catch (err) {
        if (absolutePath.endsWith('mod-manifest.json')) {
          absolutePath = absolutePath.replace(
            'mod-manifest.json',
            'mod.manifest.json'
          );
          content = await fs.readFile(absolutePath, 'utf8');
        } else {
          throw err;
        }
      }
      return {
        ok: true,
        json: async () => JSON.parse(content),
        text: async () => content,
        status: 200,
        statusText: 'OK',
      };
    } catch {
      return {
        ok: false,
        status: 404,
        statusText: 'Not Found',
      };
    }
  })();
}

function formatMissingMessage(label, missingIds, availableIds) {
  const lines = [`Missing ${label} IDs:`];
  for (const missingId of missingIds) {
    const suggestions = findSimilar(missingId, availableIds, {
      maxDistance: 4,
      maxSuggestions: 3,
      caseInsensitive: true,
    });
    if (suggestions.length > 0) {
      lines.push(
        `- ${missingId} (suggestions: ${suggestions.join(', ')})`
      );
    } else {
      lines.push(`- ${missingId}`);
    }
  }
  return lines.join('\n');
}

function assertIdsPresent({ label, ids, registryIds }) {
  const missing = ids.filter((id) => !registryIds.has(id));
  if (missing.length > 0) {
    throw new Error(formatMissingMessage(label, missing, [...registryIds]));
  }
}

async function listModDirectories() {
  const modsDir = path.join(process.cwd(), 'data', 'mods');
  const entries = await fs.readdir(modsDir, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
}

function collectModIds(values, availableMods) {
  const modIds = new Set();
  for (const value of values) {
    const [modId] = value.split(':');
    if (availableMods.has(modId)) {
      modIds.add(modId);
    }
  }
  return Array.from(modIds);
}

describe('Handler Component Contracts', () => {
  let originalGameJson;
  let originalFetch;
  let componentRegistryIds;
  let eventRegistryIds;
  let loadDiagnostics;

  beforeAll(async () => {
    jest.setTimeout(60000);

    const gameJsonPath = path.join(process.cwd(), 'data', 'game.json');
    try {
      originalGameJson = await fs.readFile(gameJsonPath, 'utf8');
    } catch {
      originalGameJson = null;
    }

    originalFetch = globalThis.fetch;
    globalThis.fetch = nodeFileFetch;
    if (typeof globalThis.window !== 'undefined') {
      globalThis.window.fetch = nodeFileFetch;
    }

    const availableMods = new Set(await listModDirectories());
    const componentValues = Object.values(componentIds).filter(
      (value) => typeof value === 'string'
    );
    const eventValues = Object.values(eventIds).filter(
      (value) => typeof value === 'string' && !EXCLUDED_EVENT_IDS.has(value)
    );
    const modsToLoad = [
      ...collectModIds(componentValues, availableMods),
      ...collectModIds(eventValues, availableMods),
    ];
    const uniqueMods = Array.from(new Set(modsToLoad)).sort();

    await fs.writeFile(
      gameJsonPath,
      JSON.stringify({ mods: uniqueMods }, null, 2)
    );

    const container = new AppContainer();
    loadDiagnostics = { errors: [], warnings: [] };
    const simpleLogger = {
      debug: () => {},
      info: () => {},
      warn: (message, ...details) => {
        loadDiagnostics.warnings.push({ message, details });
      },
      error: (message, ...details) => {
        loadDiagnostics.errors.push({ message, details });
      },
    };
    container.register(tokens.ILogger, simpleLogger);

    const validatedEventDispatcherStub = { dispatch: () => Promise.resolve() };
    container.register(
      tokens.IValidatedEventDispatcher,
      validatedEventDispatcherStub
    );

    const safeEventDispatcherStub = { dispatch: jest.fn() };
    container.register(tokens.ISafeEventDispatcher, safeEventDispatcherStub);

    registerInterpreters(container);
    await registerLoaders(container);

    const modsLoader = container.resolve(tokens.ModsLoader);
    const loadReport = await modsLoader.loadMods(
      'handler-component-contracts'
    );

    const registry = container.resolve(tokens.IDataRegistry);
    componentRegistryIds = new Set(
      registry
        .getAll('components')
        .map((definition) => definition?._fullId || definition?.id)
        .filter(Boolean)
    );
    eventRegistryIds = new Set(
      registry
        .getAll('events')
        .map((definition) => definition?._fullId || definition?.id)
        .filter(Boolean)
    );

    const expectedComponentValues = Object.values(componentIds).filter(
      (value) => typeof value === 'string'
    );
    const expectedEventValues = Object.values(eventIds).filter(
      (value) => typeof value === 'string' && !EXCLUDED_EVENT_IDS.has(value)
    );
    const componentOverlap = expectedComponentValues.some((id) =>
      componentRegistryIds.has(id)
    );
    const eventOverlap = expectedEventValues.some((id) =>
      eventRegistryIds.has(id)
    );
    if (
      componentRegistryIds.size === 0 ||
      eventRegistryIds.size === 0 ||
      !componentOverlap ||
      !eventOverlap
    ) {
      const componentSample = Array.from(componentRegistryIds).slice(0, 10);
      const eventSample = Array.from(eventRegistryIds).slice(0, 10);
      const diagnosticMessage = [
        'ModsLoader completed without loading component/event definitions.',
        `finalModOrder: ${JSON.stringify(loadReport.finalModOrder)}`,
        `componentSample: ${JSON.stringify(componentSample)}`,
        `eventSample: ${JSON.stringify(eventSample)}`,
        `errors: ${JSON.stringify(loadDiagnostics.errors)}`,
        `warnings: ${JSON.stringify(loadDiagnostics.warnings)}`,
      ].join('\n');
      throw new Error(diagnosticMessage);
    }
  });

  afterAll(async () => {
    const gameJsonPath = path.join(process.cwd(), 'data', 'game.json');
    if (originalGameJson !== null) {
      await fs.writeFile(gameJsonPath, originalGameJson);
    }
    globalThis.fetch = originalFetch;
    if (typeof globalThis.window !== 'undefined') {
      globalThis.window.fetch = originalFetch;
    }
  });

  describe('Component ID Contracts', () => {
    it('all component IDs in componentIds.js exist in loaded mods', () => {
      const componentValues = Object.values(componentIds).filter(
        (value) => typeof value === 'string'
      );

      assertIdsPresent({
        label: 'component',
        ids: componentValues,
        registryIds: componentRegistryIds,
      });
    });

    it('reports missing component IDs with helpful error messages', () => {
      const availableIds = [...componentRegistryIds];
      const missingId = `${availableIds[0] || 'core:description'}`.replace(
        'description',
        'descrption'
      );
      const message = formatMissingMessage('component', [missingId], availableIds);

      expect(message).toContain(missingId);
      if (availableIds.length > 0) {
        const suggestions = findSimilar(missingId, availableIds, {
          maxDistance: 4,
          maxSuggestions: 3,
          caseInsensitive: true,
        });
        if (suggestions.length > 0) {
          expect(message).toContain(suggestions[0]);
        }
      }
    });
  });

  describe('Event ID Contracts', () => {
    it('all mod-defined event IDs in eventIds.js exist in loaded mods', () => {
      const eventValues = Object.values(eventIds).filter(
        (value) => typeof value === 'string' && !EXCLUDED_EVENT_IDS.has(value)
      );

      assertIdsPresent({
        label: 'event',
        ids: eventValues,
        registryIds: eventRegistryIds,
      });
    });
  });
});
