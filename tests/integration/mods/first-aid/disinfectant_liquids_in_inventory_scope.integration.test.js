/**
 * @jest-environment node
 * @file Integration tests for first-aid:disinfectant_liquids_in_inventory scope
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { readFileSync } from 'fs';
import { SimpleEntityManager } from '../../../common/entities/index.js';
import ScopeEngine from '../../../../src/scopeDsl/engine.js';
import ScopeRegistry from '../../../../src/scopeDsl/scopeRegistry.js';
import { parseDslExpression } from '../../../../src/scopeDsl/parser/parser.js';
import ConsoleLogger from '../../../../src/logging/consoleLogger.js';
import JsonLogicEvaluationService from '../../../../src/logic/jsonLogicEvaluationService.js';

describe('first-aid:disinfectant_liquids_in_inventory scope', () => {
  let entityManager;
  let scopeEngine;
  let scopeRegistry;
  let logger;
  let jsonLogicEval;
  let scopeAst;

  const normalizeScopeResults = (resultSet) => {
    return Array.from(resultSet)
      .map((entry) => {
        if (typeof entry === 'string') {
          return entry;
        }

        if (entry && typeof entry === 'object') {
          if (typeof entry.id === 'string' && entry.id.trim()) {
            return entry.id.trim();
          }

          if (typeof entry.itemId === 'string' && entry.itemId.trim()) {
            return entry.itemId.trim();
          }
        }

        return null;
      })
      .filter((id) => typeof id === 'string' && id.length > 0);
  };

  const buildLiquidContainer = (overrides = {}) => ({
    currentVolumeMilliliters: 50,
    maxCapacityMilliliters: 100,
    servingSizeMilliliters: 10,
    isRefillable: true,
    flavorText: 'A bottled liquid.',
    tags: ['disinfectant'],
    ...overrides,
  });

  beforeEach(() => {
    logger = new ConsoleLogger('ERROR');

    const mockGameDataRepository = {
      getConditionDefinition: () => null,
    };

    jsonLogicEval = new JsonLogicEvaluationService({
      logger,
      gameDataRepository: mockGameDataRepository,
    });

    scopeRegistry = new ScopeRegistry();

    const scopeDefinition = readFileSync(
      new URL(
        '../../../../data/mods/first-aid/scopes/disinfectant_liquids_in_inventory.scope',
        import.meta.url
      ),
      'utf8'
    ).trim();

    const expr = scopeDefinition.split(':=')[1].trim();

    const parsedScopes = {
      'first-aid:disinfectant_liquids_in_inventory': {
        expr,
        definition: scopeDefinition,
        modId: 'first-aid',
        ast: parseDslExpression(expr),
      },
    };

    scopeRegistry.initialize(parsedScopes);

    scopeEngine = new ScopeEngine({
      scopeRegistry,
      logger,
    });

    scopeAst = parsedScopes['first-aid:disinfectant_liquids_in_inventory'].ast;
  });

  it('returns tagged liquid containers with volume remaining', () => {
    entityManager = new SimpleEntityManager([
      {
        id: 'actor-1',
        components: {
          'core:actor': { name: 'Medic' },
          'inventory:inventory': {
            items: [
              'first-aid:antiseptic_bottle',
              'first-aid:saline_vial',
              'first-aid:empty_disinfectant',
            ],
            capacity: { maxWeight: 50, maxItems: 10 },
          },
        },
      },
      {
        id: 'first-aid:antiseptic_bottle',
        components: {
          'items-core:item': {},
          'containers-core:liquid_container': buildLiquidContainer({
            currentVolumeMilliliters: 25,
            tags: ['disinfectant'],
          }),
        },
      },
      {
        id: 'first-aid:saline_vial',
        components: {
          'items-core:item': {},
          'containers-core:liquid_container': buildLiquidContainer({
            tags: ['saline'],
          }),
        },
      },
      {
        id: 'first-aid:empty_disinfectant',
        components: {
          'items-core:item': {},
          'containers-core:liquid_container': buildLiquidContainer({
            currentVolumeMilliliters: 0,
            tags: ['disinfectant'],
          }),
        },
      },
      {
        id: 'first-aid:off_inventory_disinfectant',
        components: {
          'items-core:item': {},
          'containers-core:liquid_container': buildLiquidContainer({
            currentVolumeMilliliters: 10,
            tags: ['disinfectant'],
          }),
        },
      },
    ]);

    const actor = entityManager.getEntityInstance('actor-1');
    const runtimeCtx = {
      entityManager,
      logger,
      actor,
      jsonLogicEval,
    };

    const result = scopeEngine.resolve(scopeAst, actor, runtimeCtx);
    const normalized = normalizeScopeResults(result);

    expect(normalized).toContain('first-aid:antiseptic_bottle');
    expect(normalized).not.toContain('first-aid:saline_vial');
    expect(normalized).not.toContain('first-aid:empty_disinfectant');
    expect(normalized).not.toContain('first-aid:off_inventory_disinfectant');
    expect(normalized).toHaveLength(1);
  });

  it('returns empty when inventory has no qualifying disinfectant liquids', () => {
    entityManager = new SimpleEntityManager([
      {
        id: 'actor-2',
        components: {
          'core:actor': { name: 'Helper' },
          'inventory:inventory': {
            items: ['first-aid:plain_water', 'first-aid:empty_jar'],
            capacity: { maxWeight: 50, maxItems: 10 },
          },
        },
      },
      {
        id: 'first-aid:plain_water',
        components: {
          'items-core:item': {},
          'containers-core:liquid_container': buildLiquidContainer({
            tags: ['water'],
            currentVolumeMilliliters: 40,
          }),
        },
      },
      {
        id: 'first-aid:empty_jar',
        components: {
          'items-core:item': {},
          'containers-core:liquid_container': buildLiquidContainer({
            tags: ['disinfectant'],
            currentVolumeMilliliters: 0,
          }),
        },
      },
    ]);

    const actor = entityManager.getEntityInstance('actor-2');
    const runtimeCtx = {
      entityManager,
      logger,
      actor,
      jsonLogicEval,
    };

    const result = scopeEngine.resolve(scopeAst, actor, runtimeCtx);
    const normalized = normalizeScopeResults(result);

    expect(normalized).toHaveLength(0);
  });
});
