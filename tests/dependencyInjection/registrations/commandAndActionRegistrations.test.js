/* eslint-env node */
/**
 * @file Test suite to cover command and action registrations.
 * @see src/dependencyInjection/registrations/commandAndActionRegistrations.js
 */

// --- Test Framework & Mocker Imports ---
import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { mock, mockDeep } from 'jest-mock-extended';

// --- DI & System Under Test (SUT) Imports ---
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { registerCommandAndAction } from '../../../src/dependencyInjection/registrations/commandAndActionRegistrations.js';
import { INITIALIZABLE } from '../../../src/dependencyInjection/tags.js';

// --- Concrete Class Imports for `instanceof` checks ---
import { ActionDiscoveryService } from '../../../src/actions/actionDiscoveryService.js';
import { TargetResolutionService } from '../../../src/actions/targeting/targetResolutionService.js';
import { ActionValidationContextBuilder } from '../../../src/actions/validation/actionValidationContextBuilder.js';
import { PrerequisiteEvaluationService } from '../../../src/actions/validation/prerequisiteEvaluationService.js';
import { DomainContextCompatibilityChecker } from '../../../src/validation/domainContextCompatibilityChecker.js';
import { ActionValidationService } from '../../../src/actions/validation/actionValidationService.js';
import CommandParser from '../../../src/commands/commandParser.js';
import CommandProcessor from '../../../src/commands/commandProcessor.js';
import LeaderListSyncService from '../../../src/actions/services/leaderListSyncService.js';
import FollowValidationService from '../../../src/actions/services/followValidationService.js';

describe('registerCommandAndAction', () => {
  /** @type {AppContainer} */
  let container;
  let registerSpy;

  // --- Mock External Dependencies ---
  const mockLogger = mock();
  const mockGameDataRepository = mockDeep();
  const mockEntityManager = mockDeep();
  const mockJsonLogicEvaluationService = mockDeep();
  const mockWorldContext = mockDeep();
  const mockValidatedEventDispatcher = mockDeep();
  const mockSafeEventDispatcher = mockDeep();

  beforeEach(() => {
    container = new AppContainer();

    // Spy on the container's register method to check options later
    registerSpy = jest.spyOn(container, 'register');

    // Register all necessary mock dependencies that the SUT's factories will resolve.
    // These are dependencies external to the group of services being registered.
    container.register(tokens.ILogger, () => mockLogger);
    container.register(
      tokens.IGameDataRepository,
      () => mockGameDataRepository
    );
    container.register(tokens.IEntityManager, () => mockEntityManager);
    container.register(
      tokens.JsonLogicEvaluationService,
      () => mockJsonLogicEvaluationService
    );
    container.register(tokens.IWorldContext, () => mockWorldContext);
    container.register(
      tokens.IValidatedEventDispatcher,
      () => mockValidatedEventDispatcher
    );
    container.register(
      tokens.ISafeEventDispatcher,
      () => mockSafeEventDispatcher
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should log start, intermediate, and end messages in order', () => {
    registerCommandAndAction(container);

    const logCalls = mockLogger.debug.mock.calls.map((call) => call[0]);

    expect(logCalls[0]).toBe('Command and Action Registration: Starting...');
    expect(logCalls).toContain(
      `Command and Action Registration: Registered ${String(
        tokens.IActionDiscoveryService
      )}.`
    );
    expect(logCalls).toContain(
      'Command and Action Registration: Registered Action Validation services.'
    );
    expect(logCalls).toContain(
      `Command and Action Registration: Registered ${String(
        tokens.TargetResolutionService
      )}.`
    );
    expect(logCalls).toContain(
      `Command and Action Registration: Registered ${String(
        tokens.LeaderListSyncService
      )}.`
    );
    expect(logCalls).toContain(
      `Command and Action Registration: Registered ${String(
        tokens.FollowValidationService
      )}.`
    );
    expect(logCalls).toContain(
      `Command and Action Registration: Registered ${String(tokens.ICommandParser)}.`
    );
    expect(logCalls).toContain(
      `Command and Action Registration: Registered ${String(
        tokens.ICommandProcessor
      )}.`
    );
    expect(logCalls[logCalls.length - 1]).toBe(
      'Command and Action Registration: Completed.'
    );
  });

  describe('Service Registrations', () => {
    const registrations = [
      {
        token: tokens.IActionDiscoveryService,
        Class: ActionDiscoveryService,
        lifecycle: 'singletonFactory',
        // --- FINAL FIX IS HERE ---
        // The constant INITIALIZABLE is already an array: ['initializableSystem'].
        // Wrapping it in another array `[INITIALIZABLE]` created a nested array `[['...']]`
        // which does not match the flattened array produced by the Registrar.
        // We provide the constant directly.
        tags: INITIALIZABLE,
      },
      {
        token: tokens.ActionValidationContextBuilder,
        Class: ActionValidationContextBuilder,
        lifecycle: 'singleton',
        tags: undefined,
      },
      {
        token: tokens.PrerequisiteEvaluationService,
        Class: PrerequisiteEvaluationService,
        lifecycle: 'singleton',
        tags: undefined,
      },
      {
        token: tokens.DomainContextCompatibilityChecker,
        Class: DomainContextCompatibilityChecker,
        lifecycle: 'singleton',
        tags: undefined,
      },
      {
        token: tokens.ActionValidationService,
        Class: ActionValidationService,
        lifecycle: 'singleton',
        tags: undefined,
      },
      {
        token: tokens.TargetResolutionService,
        Class: TargetResolutionService,
        lifecycle: 'singletonFactory',
        tags: undefined,
      },
      {
        token: tokens.LeaderListSyncService,
        Class: LeaderListSyncService,
        lifecycle: 'singletonFactory',
        tags: undefined,
      },
      {
        token: tokens.FollowValidationService,
        Class: FollowValidationService,
        lifecycle: 'singletonFactory',
        tags: undefined,
      },
      {
        token: tokens.ICommandParser,
        Class: CommandParser,
        lifecycle: 'singletonFactory',
        tags: undefined,
      },
      {
        token: tokens.ICommandProcessor,
        Class: CommandProcessor,
        lifecycle: 'singletonFactory',
        tags: undefined,
      },
    ];

    test.each(registrations)(
      'should register $token correctly as a $lifecycle',
      ({ token, Class, lifecycle, tags }) => {
        // --- Act ---
        registerCommandAndAction(container);

        // --- Assert ---

        // 1. Check if the service can be resolved and is of the correct concrete type
        const instance = container.resolve(token);
        expect(instance).toBeInstanceOf(Class);

        // 2. Check for singleton behavior (all are singletons or singleton factories)
        expect(container.resolve(token)).toBe(instance);

        // 3. Find the call to container.register for the specific token using the spy
        const registrationCall = registerSpy.mock.calls.find(
          (call) => call[0] === token
        );
        expect(registrationCall).toBeDefined();

        // 4. Verify the registration options (lifecycle and tags)
        const options = registrationCall[2] || {};
        expect(options.lifecycle).toBe(lifecycle);

        if (tags) {
          expect(options.tags).toEqual(tags);
        } else {
          // Ensure no unexpected tags are present if none are expected
          expect(options.tags).toBeUndefined();
        }
      }
    );
  });
});
