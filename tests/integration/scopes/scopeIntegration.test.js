/**
 * @file Integration tests for scope resolution using actual scope files and actions.
 * @description Tests that each scope file properly resolves entities for actual actions.
 */

import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import { SimpleEntityManager } from '../../common/entities/index.js';
import { ActionDiscoveryService } from '../../../src/actions/actionDiscoveryService.js';
import { ActionValidationService } from '../../../src/actions/validation/actionValidationService.js';
import { formatActionCommand } from '../../../src/actions/actionFormatter.js';
import { GameDataRepository } from '../../../src/data/gameDataRepository.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import ScopeRegistry from '../../../src/scopeDsl/scopeRegistry.js';
import ScopeEngine from '../../../src/scopeDsl/engine.js';
import { parseScopeDefinitions } from '../../../src/scopeDsl/scopeDefinitionParser.js';
import {
  LEADING_COMPONENT_ID,
  POSITION_COMPONENT_ID,
  NAME_COMPONENT_ID,
  EXITS_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';
import fs from 'fs';
import path from 'path';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';

jest.unmock('../../../src/scopeDsl/scopeRegistry.js');

// Import actual scope file CONTENTS
const followersScopeContent = fs.readFileSync(
  path.resolve(__dirname, '../../../data/mods/core/scopes/followers.scope'),
  'utf8'
);
const environmentScopeContent = fs.readFileSync(
  path.resolve(__dirname, '../../../data/mods/core/scopes/environment.scope'),
  'utf8'
);
const directionsScopeContent = fs.readFileSync(
  path.resolve(__dirname, '../../../data/mods/core/scopes/directions.scope'),
  'utf8'
);

// Import actual action files
import dismissAction from '../../../data/mods/core/actions/dismiss.action.json';
import followAction from '../../../data/mods/core/actions/follow.action.json';
import goAction from '../../../data/mods/core/actions/go.action.json';
import waitAction from '../../../data/mods/core/actions/wait.action.json';

describe('Scope Integration Tests', () => {
  let entityManager;
  let logger;
  let scopeRegistry;
  let scopeEngine;
  let jsonLogicEval;
  let actionDiscoveryService;
  let gameDataRepository;
  let actionValidationService;
  let safeEventDispatcher;

  beforeEach(() => {
    logger = console; // Using console for visibility during testing
    entityManager = new SimpleEntityManager([]);

    // Use the real singleton and clear all scopes
    scopeRegistry = new ScopeRegistry({ logger });
    scopeRegistry.clear();

    // FIX: Use the parseScopeDefinitions utility to correctly extract expressions
    const followerDefs = parseScopeDefinitions(
      followersScopeContent,
      'followers.scope'
    );
    const environmentDefs = parseScopeDefinitions(
      environmentScopeContent,
      'environment.scope'
    );
    const directionDefs = parseScopeDefinitions(
      directionsScopeContent,
      'directions.scope'
    );

    // FIX: Initialize the registry with the *actual* expressions, not the file content,
    // and map the name from the file ('environments') to the name the action expects ('environment').
    scopeRegistry.initialize({
      followers: { expr: followerDefs.get('followers') },
      environment: { expr: environmentDefs.get('environments') },
      directions: { expr: directionDefs.get('directions') },
    });

    // Create a real scope engine
    scopeEngine = new ScopeEngine();

    // Add a real jsonLogicEval to the context for filter support
    jsonLogicEval = new JsonLogicEvaluationService({ logger });

    // Create a fresh in-memory registry and load action definitions
    const registry = new InMemoryDataRegistry();
    registry.store('actions', dismissAction.id, dismissAction);
    registry.store('actions', followAction.id, followAction);
    registry.store('actions', goAction.id, goAction);
    registry.store('actions', waitAction.id, waitAction);

    // Minimal stub for domainContextCompatibilityChecker
    const domainContextCompatibilityChecker = { check: () => true };
    // Minimal stub for prerequisiteEvaluationService
    const prerequisiteEvaluationService = { evaluate: (a, b, c, d) => true };

    // Minimal stub for validatedEventDispatcher
    const validatedEventDispatcher = {
      dispatch: () => {},
      subscribe: () => {},
      unsubscribe: () => {},
    };

    // Create production dependencies for ActionDiscoveryService
    gameDataRepository = new GameDataRepository(registry, logger);
    actionValidationService = new ActionValidationService({
      entityManager,
      logger,
      domainContextCompatibilityChecker,
      prerequisiteEvaluationService,
    });
    safeEventDispatcher = new SafeEventDispatcher({
      validatedEventDispatcher,
      logger,
    });

    // Create the ActionDiscoveryService with real dependencies
    actionDiscoveryService = new ActionDiscoveryService({
      gameDataRepository,
      entityManager,
      actionValidationService,
      logger,
      formatActionCommandFn: formatActionCommand,
      safeEventDispatcher,
      scopeRegistry,
      scopeEngine,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('followers scope', () => {
    it('should resolve followers for dismiss action', async () => {
      // Create entities with proper components
      const actorId = 'actor1';
      const follower1Id = 'follower1';
      const follower2Id = 'follower2';
      const room1Id = 'room1';

      const entities = [
        {
          id: actorId,
          components: {
            [NAME_COMPONENT_ID]: { text: 'Actor' },
            [POSITION_COMPONENT_ID]: { locationId: room1Id },
            [LEADING_COMPONENT_ID]: { followers: [follower1Id, follower2Id] },
          },
        },
        {
          id: follower1Id,
          components: {
            [NAME_COMPONENT_ID]: { text: 'Follower 1' },
            [POSITION_COMPONENT_ID]: { locationId: room1Id },
          },
        },
        {
          id: follower2Id,
          components: {
            [NAME_COMPONENT_ID]: { text: 'Follower 2' },
            [POSITION_COMPONENT_ID]: { locationId: room1Id },
          },
        },
        {
          id: room1Id,
          components: {
            [NAME_COMPONENT_ID]: { text: 'Room 1' },
          },
        },
      ];

      entityManager = new SimpleEntityManager(entities);

      // Update services with the new entityManager
      actionValidationService = new ActionValidationService({
        entityManager,
        logger,
        domainContextCompatibilityChecker: { check: () => true },
        prerequisiteEvaluationService: { evaluate: (a, b, c, d) => true },
      });
      actionDiscoveryService = new ActionDiscoveryService({
        gameDataRepository,
        entityManager,
        actionValidationService,
        logger,
        formatActionCommandFn: formatActionCommand,
        safeEventDispatcher,
        scopeRegistry,
        scopeEngine,
      });

      const actorEntity = entityManager.getEntityInstance(actorId);
      const context = {
        entityManager,
        jsonLogicEval,
        actingEntity: actorEntity,
      };

      const result = await actionDiscoveryService.getValidActions(
        actorEntity,
        context
      );

      // Find the dismiss action and check its targets
      const dismissActions = result.actions.filter(
        (action) => action.id === 'core:dismiss'
      );
      expect(dismissActions.length).toBeGreaterThan(0);

      // Extract target IDs from the discovered actions
      const targetIds = dismissActions
        .map((action) => action.params?.targetId)
        .filter(Boolean);
      expect(targetIds).toContain(follower1Id);
      expect(targetIds).toContain(follower2Id);
    });

    it('should return empty set when actor has no followers', async () => {
      const actorId = 'actor1';

      entityManager = new SimpleEntityManager([
        {
          id: actorId,
          components: {
            [NAME_COMPONENT_ID]: { text: 'Actor' },
            [POSITION_COMPONENT_ID]: { locationId: 'room1' },
            [LEADING_COMPONENT_ID]: { followers: [] },
          },
        },
      ]);

      // Update services with the new entityManager
      actionValidationService = new ActionValidationService({
        entityManager,
        logger,
        domainContextCompatibilityChecker: { check: () => true },
        prerequisiteEvaluationService: { evaluate: (a, b, c, d) => true },
      });
      actionDiscoveryService = new ActionDiscoveryService({
        gameDataRepository,
        entityManager,
        actionValidationService,
        logger,
        formatActionCommandFn: formatActionCommand,
        safeEventDispatcher,
        scopeRegistry,
        scopeEngine,
      });

      const actorEntity = entityManager.getEntityInstance(actorId);
      const context = {
        entityManager,
        jsonLogicEval,
        actingEntity: actorEntity,
      };

      const result = await actionDiscoveryService.getValidActions(
        actorEntity,
        context
      );

      // Find the dismiss action and check it has no targets
      const dismissActions = result.actions.filter(
        (action) => action.id === 'core:dismiss'
      );
      expect(dismissActions.length).toBe(0);
    });
  });

  describe('directions scope', () => {
    it('should resolve location exits for go action', async () => {
      const actorId = 'actor1';
      const room1Id = 'room1';
      const room2Id = 'room2';

      const entities = [
        {
          id: actorId,
          components: {
            [NAME_COMPONENT_ID]: { text: 'Actor' },
            [POSITION_COMPONENT_ID]: { locationId: room1Id },
            [LEADING_COMPONENT_ID]: { followers: [] },
          },
        },
        {
          id: room1Id,
          components: {
            [NAME_COMPONENT_ID]: { text: 'Room 1' },
            [EXITS_COMPONENT_ID]: [
              { direction: 'north', target: room2Id },
              { direction: 'east', target: 'room3' },
            ],
          },
        },
        {
          id: room2Id,
          components: {
            [NAME_COMPONENT_ID]: { text: 'Room 2' },
          },
        },
        {
          id: 'room3',
          components: {
            [NAME_COMPONENT_ID]: { text: 'Room 3' },
          },
        },
      ];

      entityManager = new SimpleEntityManager(entities);

      actionValidationService = new ActionValidationService({
        entityManager,
        logger,
        domainContextCompatibilityChecker: { check: () => true },
        prerequisiteEvaluationService: { evaluate: (a, b, c, d) => true },
      });
      actionDiscoveryService = new ActionDiscoveryService({
        gameDataRepository,
        entityManager,
        actionValidationService,
        logger,
        formatActionCommandFn: formatActionCommand,
        safeEventDispatcher,
        scopeRegistry,
        scopeEngine,
      });

      const actorEntity = entityManager.getEntityInstance(actorId);
      const context = {
        entityManager,
        jsonLogicEval,
        location: entityManager.getEntityInstance(room1Id),
        actingEntity: actorEntity,
      };

      const result = await actionDiscoveryService.getValidActions(
        actorEntity,
        context
      );

      // Find the go action - it should have direction-based targets
      const goActions = result.actions.filter(
        (action) => action.id === 'core:go'
      );
      expect(goActions.length).toBeGreaterThan(0);

      // Check that the actions have target information (room IDs)
      const targetIds = goActions
        .map((action) => action.params?.targetId)
        .filter(Boolean);
      expect(targetIds).toContain(room2Id);
      expect(targetIds).toContain('room3');
    });

    it('should return empty set when location has no exits', async () => {
      const actorId = 'actor1';
      const roomId = 'room1';

      entityManager = new SimpleEntityManager([
        {
          id: actorId,
          components: {
            [NAME_COMPONENT_ID]: { text: 'Actor' },
            [POSITION_COMPONENT_ID]: { locationId: roomId },
            [LEADING_COMPONENT_ID]: { followers: [] },
          },
        },
        {
          id: roomId,
          components: {
            [NAME_COMPONENT_ID]: { text: 'Room 1' },
            [EXITS_COMPONENT_ID]: [],
          },
        },
      ]);

      actionValidationService = new ActionValidationService({
        entityManager,
        logger,
        domainContextCompatibilityChecker: { check: () => true },
        prerequisiteEvaluationService: { evaluate: (a, b, c, d) => true },
      });
      actionDiscoveryService = new ActionDiscoveryService({
        gameDataRepository,
        entityManager,
        actionValidationService,
        logger,
        formatActionCommandFn: formatActionCommand,
        safeEventDispatcher,
        scopeRegistry,
        scopeEngine,
      });

      const actorEntity = entityManager.getEntityInstance(actorId);
      const context = {
        entityManager,
        location: entityManager.getEntityInstance(roomId),
        jsonLogicEval,
        actingEntity: actorEntity,
      };

      const result = await actionDiscoveryService.getValidActions(
        actorEntity,
        context
      );

      // Find the go action and check it has no targets
      const goActions = result.actions.filter(
        (action) => action.id === 'core:go'
      );
      expect(goActions.length).toBe(0);
    });
  });

  describe('special scopes', () => {
    it('should handle "none" scope for wait action', async () => {
      const actorId = 'actor1';
      const room1Id = 'room1';

      const entities = [
        {
          id: actorId,
          components: {
            [NAME_COMPONENT_ID]: { text: 'Actor' },
            [POSITION_COMPONENT_ID]: { locationId: room1Id },
            [LEADING_COMPONENT_ID]: { followers: [] },
          },
        },
        {
          id: room1Id,
          components: {
            [NAME_COMPONENT_ID]: { text: 'Room 1' },
          },
        },
      ];

      entityManager = new SimpleEntityManager(entities);

      actionValidationService = new ActionValidationService({
        entityManager,
        logger,
        domainContextCompatibilityChecker: { check: () => true },
        prerequisiteEvaluationService: { evaluate: (a, b, c, d) => true },
      });
      actionDiscoveryService = new ActionDiscoveryService({
        gameDataRepository,
        entityManager,
        actionValidationService,
        logger,
        formatActionCommandFn: formatActionCommand,
        safeEventDispatcher,
        scopeRegistry,
        scopeEngine,
      });

      const actorEntity = entityManager.getEntityInstance(actorId);
      const context = {
        entityManager,
        jsonLogicEval,
        location: entityManager.getEntityInstance(room1Id),
        actingEntity: actorEntity,
      };
      const result = await actionDiscoveryService.getValidActions(
        actorEntity,
        context
      );

      // Find the wait action - it should be available without targets
      const waitActions = result.actions.filter(
        (action) => action.id === 'core:wait'
      );
      expect(waitActions.length).toBe(1);
      expect(waitActions[0].params?.targetId).toBeUndefined();
    });

    it('should handle "direction" scope (not entity IDs)', async () => {
      const actorId = 'actor1';
      const room1Id = 'room1';
      const room2Id = 'room2';

      const entities = [
        {
          id: actorId,
          components: {
            [NAME_COMPONENT_ID]: { text: 'Actor' },
            [POSITION_COMPONENT_ID]: { locationId: room1Id },
            [LEADING_COMPONENT_ID]: { followers: [] },
          },
        },
        {
          id: room1Id,
          components: {
            [NAME_COMPONENT_ID]: { text: 'Room 1' },
            [EXITS_COMPONENT_ID]: [
              { direction: 'north', target: room2Id },
              { direction: 'east', target: 'room3' },
            ],
          },
        },
        {
          id: room2Id,
          components: {
            [NAME_COMPONENT_ID]: { text: 'Room 2' },
          },
        },
        {
          id: 'room3',
          components: {
            [NAME_COMPONENT_ID]: { text: 'Room 3' },
          },
        },
      ];

      entityManager = new SimpleEntityManager(entities);

      actionValidationService = new ActionValidationService({
        entityManager,
        logger,
        domainContextCompatibilityChecker: { check: () => true },
        prerequisiteEvaluationService: { evaluate: (a, b, c, d) => true },
      });
      actionDiscoveryService = new ActionDiscoveryService({
        gameDataRepository,
        entityManager,
        actionValidationService,
        logger,
        formatActionCommandFn: formatActionCommand,
        safeEventDispatcher,
        scopeRegistry,
        scopeEngine,
      });

      const actorEntity = entityManager.getEntityInstance(actorId);
      const context = {
        entityManager,
        jsonLogicEval,
        location: entityManager.getEntityInstance(room1Id),
        actingEntity: actorEntity,
      };
      const result = await actionDiscoveryService.getValidActions(
        actorEntity,
        context
      );

      // Find the go action - it should have direction-based targets
      const goActions = result.actions.filter(
        (action) => action.id === 'core:go'
      );
      expect(goActions.length).toBeGreaterThan(0);

      // Check that the actions have target information (room IDs)
      const targetIds = goActions
        .map((action) => action.params?.targetId)
        .filter(Boolean);
      expect(targetIds).toContain(room2Id);
      expect(targetIds).toContain('room3');
    });
  });

  describe('error handling', () => {
    it('should handle missing scope gracefully', async () => {
      const actorId = 'actor1';

      entityManager = new SimpleEntityManager([
        {
          id: actorId,
          components: {
            [NAME_COMPONENT_ID]: { text: 'Actor' },
            [POSITION_COMPONENT_ID]: { locationId: 'room1' },
            [LEADING_COMPONENT_ID]: { followers: [] },
          },
        },
      ]);

      actionValidationService = new ActionValidationService({
        entityManager,
        logger,
        domainContextCompatibilityChecker: { check: () => true },
        prerequisiteEvaluationService: { evaluate: (a, b, c, d) => true },
      });
      actionDiscoveryService = new ActionDiscoveryService({
        gameDataRepository,
        entityManager,
        actionValidationService,
        logger,
        formatActionCommandFn: formatActionCommand,
        safeEventDispatcher,
        scopeRegistry,
        scopeEngine,
      });

      const actorEntity = entityManager.getEntityInstance(actorId);
      const context = {
        entityManager,
        jsonLogicEval,
        actingEntity: actorEntity,
      };

      const result = await actionDiscoveryService.getValidActions(
        actorEntity,
        context
      );

      // Should not crash, but may have errors for invalid scopes
      expect(result.actions).toBeDefined();
      expect(Array.isArray(result.actions)).toBe(true);
    });

    it('should handle missing actingEntity gracefully', async () => {
      const actorId = 'actor1';
      const room1Id = 'room1';

      const entities = [
        {
          id: actorId,
          components: {
            [NAME_COMPONENT_ID]: { text: 'Actor' },
            [POSITION_COMPONENT_ID]: { locationId: room1Id },
            [LEADING_COMPONENT_ID]: { followers: [] },
          },
        },
        {
          id: room1Id,
          components: {
            [NAME_COMPONENT_ID]: { text: 'Room 1' },
          },
        },
      ];

      entityManager = new SimpleEntityManager(entities);

      actionValidationService = new ActionValidationService({
        entityManager,
        logger,
        domainContextCompatibilityChecker: { check: () => true },
        prerequisiteEvaluationService: { evaluate: (a, b, c, d) => true },
      });
      actionDiscoveryService = new ActionDiscoveryService({
        gameDataRepository,
        entityManager,
        actionValidationService,
        logger,
        formatActionCommandFn: formatActionCommand,
        safeEventDispatcher,
        scopeRegistry,
        scopeEngine,
      });

      const context = {
        entityManager,
        jsonLogicEval,
        location: entityManager.getEntityInstance(room1Id),
      };
      // Don't set actingEntity - this should be handled gracefully
      const result = await actionDiscoveryService.getValidActions(
        null,
        context
      );

      // Should return empty result without throwing
      expect(result.actions).toEqual([]);
    });

    it('should handle missing entityManager gracefully', async () => {
      const actorId = 'actor1';

      entityManager = new SimpleEntityManager([
        {
          id: actorId,
          components: {
            [NAME_COMPONENT_ID]: { text: 'Actor' },
            [POSITION_COMPONENT_ID]: { locationId: 'room1' },
            [LEADING_COMPONENT_ID]: { followers: [] },
          },
        },
      ]);

      actionValidationService = new ActionValidationService({
        entityManager,
        logger,
        domainContextCompatibilityChecker: { check: () => true },
        prerequisiteEvaluationService: { evaluate: (a, b, c, d) => true },
      });
      actionDiscoveryService = new ActionDiscoveryService({
        gameDataRepository,
        entityManager,
        actionValidationService,
        logger,
        formatActionCommandFn: formatActionCommand,
        safeEventDispatcher,
        scopeRegistry,
        scopeEngine,
      });

      const actorEntity = entityManager.getEntityInstance(actorId);
      const context = {
        // Missing entityManager
        jsonLogicEval,
        actingEntity: actorEntity,
      };

      const result = await actionDiscoveryService.getValidActions(
        actorEntity,
        context
      );

      // Should handle gracefully
      expect(result.actions).toBeDefined();
      expect(Array.isArray(result.actions)).toBe(true);
    });
  });
});
