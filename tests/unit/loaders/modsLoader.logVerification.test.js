// Filename: src/tests/loaders/modsLoader.logVerification.test.js

import { beforeEach, describe, expect, it } from '@jest/globals';

// --- The new Test Setup Factory ---
import { createTestEnvironment } from '../../common/loaders/modsLoader.test-setup.js';
import {
  setupManifests,
  getSummaryText,
} from '../../common/loaders/modsLoader.test-utils.js';

// --- Dependencies to Mock ---
import { CORE_MOD_ID } from '../../../src/constants/core.js';

// --- Type‑only JSDoc imports for Mocks ---
/** @typedef {import('../../common/loaders/modsLoader.test-setup.js').TestEnvironment} TestEnvironment */
/** @typedef {import('../../../src/interfaces/manifestItems.js').ModManifest} ModManifest */

describe('ModsLoader Integration Test Suite - Log Verification (Refactored)', () => {
  /** @type {TestEnvironment} */
  let env;

  // --- Mock Data ---
  /** @type {ModManifest} */
  let coreManifest;
  /** @type {ModManifest} */
  let overrideManifest;
  /** @type {ModManifest} */
  let modAManifest;
  /** @type {ModManifest} */
  let modBManifest;
  const overrideModId = 'overrideMod';
  const modAId = 'modA';
  const modBId = 'modB';
  const worldName = 'testWorldLogVerify';

  // Helper function for mocks that should return 0
  const defaultReturnZero = async () => ({ count: 0, overrides: 0, errors: 0 });

  beforeEach(() => {
    // Get the standard environment from the factory. jest.clearAllMocks() is called inside.
    env = createTestEnvironment();

    // --- Define Base Mock Data (can be overridden in tests) ---
    coreManifest = {
      id: CORE_MOD_ID,
      version: '1.0.0',
      name: 'Core',
      gameVersion: '1.0.0',
      content: {},
    };
    overrideManifest = {
      id: overrideModId,
      version: '1.0.0',
      name: 'Override',
      gameVersion: '1.0.0',
      content: {},
    };
    modAManifest = {
      id: modAId,
      version: '1.0.0',
      name: 'Mod A',
      gameVersion: '1.0.0',
      content: {},
    };
    modBManifest = {
      id: modBId,
      version: '1.0.0',
      name: 'Mod B',
      gameVersion: '1.0.0',
      content: {},
    };
  });

  // ── Test Case: Basic 'Core' Load Summary (like 7.1) ────────────────────
  it('should log the correct summary for a basic CORE_MOD_ID mod load', async () => {
    // Arrange
    const coreActionCount = 2;
    const coreComponentCount = 1;
    const coreRuleCount = 3;
    coreManifest.content = {
      actions: Array(coreActionCount).fill('dummy.json'),
      components: Array(coreComponentCount).fill('dummy.json'),
      rules: Array(coreRuleCount).fill('dummy.json'),
    };
    const mockManifestMap = new Map([
      [CORE_MOD_ID.toLowerCase(), coreManifest],
    ]);

    setupManifests(env, mockManifestMap, [CORE_MOD_ID]);

    env.mockActionLoader.loadItemsForMod.mockResolvedValue({
      count: coreActionCount,
      overrides: 0,
      errors: 0,
    });
    env.mockComponentLoader.loadItemsForMod.mockResolvedValue({
      count: coreComponentCount,
      overrides: 0,
      errors: 0,
    });
    env.mockRuleLoader.loadItemsForMod.mockResolvedValue({
      count: coreRuleCount,
      overrides: 0,
      errors: 0,
    });
    env.mockEventLoader.loadItemsForMod.mockImplementation(defaultReturnZero);
    env.mockEntityLoader.loadItemsForMod.mockImplementation(defaultReturnZero);
    env.mockConditionLoader.loadItemsForMod.mockImplementation(
      defaultReturnZero
    );

    // Action
    await env.modsLoader.loadWorld(worldName);

    // Assertions
    const summaryText = getSummaryText(env.mockLogger);
    const summaryLines = summaryText.split('\n');
    const summaryStart = summaryLines.findIndex((line) =>
      line.includes(`ModsLoader Load Summary (World: '${worldName}')`)
    );
    expect(summaryStart).toBeGreaterThan(-1);
    const summaryBlock = summaryLines.slice(summaryStart).join('\n');

    expect(summaryBlock).toMatch(/actions\s+: C:2, O:0, E:0/);
    expect(summaryBlock).toMatch(/components\s+: C:1, O:0, E:0/);
    expect(summaryBlock).toMatch(/rules\s+: C:3, O:0, E:0/);
    expect(summaryBlock).toMatch(/TOTAL\s+: C:6, O:0, E:0/);

    const countLines = summaryLines.filter((line) =>
      line.trim().startsWith('- ')
    );
    expect(countLines[0]).toContain('actions');
    expect(countLines[1]).toContain('components');
    expect(countLines[2]).toContain('rules');
  });

  it('should log the correct summary reflecting overrides and multiple mods', async () => {
    // Arrange
    const coreActionCount = 1;
    const overrideActionCount = 2; // This mod adds 2 actions
    const overrideComponentCount = 1;
    coreManifest.content = { actions: ['core_action.json'] };
    overrideManifest.content = {
      actions: ['override_action1.json', 'override_action2.json'],
      components: ['override_comp.json'],
    };
    const mockManifestMap = new Map([
      [CORE_MOD_ID.toLowerCase(), coreManifest],
      [overrideModId.toLowerCase(), overrideManifest],
    ]);
    const finalOrder = [CORE_MOD_ID, overrideModId];

    setupManifests(env, mockManifestMap, finalOrder);

    // Simulate loader returns for each mod
    env.mockActionLoader.loadItemsForMod.mockImplementation(
      async (modId) =>
        modId === CORE_MOD_ID
          ? { count: coreActionCount, overrides: 0, errors: 0 }
          : { count: overrideActionCount, overrides: 1, errors: 0 } // Assume one override
    );
    env.mockComponentLoader.loadItemsForMod.mockImplementation(async (modId) =>
      modId === overrideModId
        ? { count: overrideComponentCount, overrides: 0, errors: 0 }
        : { count: 0, overrides: 0, errors: 0 }
    );

    // Action
    await env.modsLoader.loadWorld(worldName);

    // Assertions
    const summaryText = getSummaryText(env.mockLogger);
    const expectedTotalActions = coreActionCount + overrideActionCount; // 1 + 2 = 3

    // *** FIX IS HERE ***
    // The regex needs a single backslash `\s+` not a double `\\s+` in a template literal.
    expect(summaryText).toMatch(
      new RegExp(`actions\\s+: C:${expectedTotalActions}, O:1, E:0`)
    );
    expect(summaryText).toMatch(
      new RegExp(`components\\s+: C:${overrideComponentCount}, O:0, E:0`)
    );
    expect(summaryText).toMatch(new RegExp(`TOTAL\\s+: C:4, O:1, E:0`));
  });

  it('should log the correct summary when some content types are empty or missing', async () => {
    // Arrange
    coreManifest.content = { components: ['core_comp.json'] };
    modAManifest.content = { actions: ['modA_action.json'], events: [] }; // events is empty
    modBManifest.content = { rules: ['modB_rule.json'] }; // no events key
    const mockManifestMap = new Map([
      [CORE_MOD_ID.toLowerCase(), coreManifest],
      [modAId.toLowerCase(), modAManifest],
      [modBId.toLowerCase(), modBManifest],
    ]);
    const finalOrder = [CORE_MOD_ID, modAId, modBId];

    setupManifests(env, mockManifestMap, finalOrder);

    env.mockComponentLoader.loadItemsForMod.mockResolvedValue({
      count: 1,
      overrides: 0,
      errors: 0,
    });
    env.mockActionLoader.loadItemsForMod.mockResolvedValue({
      count: 1,
      overrides: 0,
      errors: 0,
    });
    env.mockRuleLoader.loadItemsForMod.mockResolvedValue({
      count: 1,
      overrides: 0,
      errors: 0,
    });

    // Action
    await env.modsLoader.loadWorld(worldName);

    // Assertions
    const summaryText = getSummaryText(env.mockLogger);
    expect(summaryText).toMatch(/actions\s+: C:1, O:0, E:0/);
    expect(summaryText).toMatch(/components\s+: C:1, O:0, E:0/);
    expect(summaryText).toMatch(/rules\s+: C:1, O:0, E:0/);
    expect(summaryText).not.toMatch(/events\s+:/);
    expect(summaryText).toMatch(/TOTAL\s+: C:3, O:0, E:0/);

    // Check that event loader was correctly skipped
    expect(env.mockEventLoader.loadItemsForMod).not.toHaveBeenCalled();
    expect(env.mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(`Skipping content type 'events'`)
    );
  });
});
