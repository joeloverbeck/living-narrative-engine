/**
 * @jest-environment node
 * @file Integration tests for items:disinfectant_liquids_in_inventory scope
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { readFileSync } from 'fs';
import { SimpleEntityManager } from '../../../common/entities/index.js';
import ScopeEngine from '../../../../src/scopeDsl/engine.js';
import ScopeRegistry from '../../../../src/scopeDsl/scopeRegistry.js';
import { parseDslExpression } from '../../../../src/scopeDsl/parser/parser.js';
import ConsoleLogger from '../../../../src/logging/consoleLogger.js';
import JsonLogicEvaluationService from '../../../../src/logic/jsonLogicEvaluationService.js';

describe('items:disinfectant_liquids_in_inventory scope', () => {
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
        '../../../../data/mods/items/scopes/disinfectant_liquids_in_inventory.scope',
        import.meta.url
      ),
      'utf8'
    ).trim();

    const expr = scopeDefinition.split(':=')[1].trim();

    const parsedScopes = {
      'items:disinfectant_liquids_in_inventory': {
        expr,
        definition: scopeDefinition,
        modId: 'items',
        ast: parseDslExpression(expr),
      },
    };

    scopeRegistry.initialize(parsedScopes);

    scopeEngine = new ScopeEngine({
      scopeRegistry,
      logger,
    });

    scopeAst = parsedScopes['items:disinfectant_liquids_in_inventory'].ast;
  });

  it('returns tagged liquid containers with volume remaining', () => {
    entityManager = new SimpleEntityManager([
      {
        id: 'actor-1',
        components: {
          'core:actor': { name: 'Medic' },
          'items:inventory': {
            items: [
              'items:antiseptic_bottle',
              'items:saline_vial',
              'items:empty_disinfectant',
            ],
            capacity: { maxWeight: 50, maxItems: 10 },
          },
        },
      },
      {
        id: 'items:antiseptic_bottle',
        components: {
          'items:item': {},
          'items:liquid_container': buildLiquidContainer({
            currentVolumeMilliliters: 25,
            tags: ['disinfectant'],
          }),
        },
      },
      {
        id: 'items:saline_vial',
        components: {
          'items:item': {},
          'items:liquid_container': buildLiquidContainer({
            tags: ['saline'],
          }),
        },
      },
      {
        id: 'items:empty_disinfectant',
        components: {
          'items:item': {},
          'items:liquid_container': buildLiquidContainer({
            currentVolumeMilliliters: 0,
            tags: ['disinfectant'],
          }),
        },
      },
      {
        id: 'items:off_inventory_disinfectant',
        components: {
          'items:item': {},
          'items:liquid_container': buildLiquidContainer({
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

    expect(normalized).toContain('items:antiseptic_bottle');
    expect(normalized).not.toContain('items:saline_vial');
    expect(normalized).not.toContain('items:empty_disinfectant');
    expect(normalized).not.toContain('items:off_inventory_disinfectant');
    expect(normalized).toHaveLength(1);
  });

  it('returns empty when inventory has no qualifying disinfectant liquids', () => {
    entityManager = new SimpleEntityManager([
      {
        id: 'actor-2',
        components: {
          'core:actor': { name: 'Helper' },
          'items:inventory': {
            items: ['items:plain_water', 'items:empty_jar'],
            capacity: { maxWeight: 50, maxItems: 10 },
          },
        },
      },
      {
        id: 'items:plain_water',
        components: {
          'items:item': {},
          'items:liquid_container': buildLiquidContainer({
            tags: ['water'],
            currentVolumeMilliliters: 40,
          }),
        },
      },
      {
        id: 'items:empty_jar',
        components: {
          'items:item': {},
          'items:liquid_container': buildLiquidContainer({
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
