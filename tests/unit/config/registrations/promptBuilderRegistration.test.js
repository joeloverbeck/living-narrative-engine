// src/tests/dependencyInjection/registrations/promptBuilderRegistration.test.js
// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../../services/llmConfigService.js').LLMConfigService} LLMConfigService_Concrete */
/** @typedef {import('../../../../utils/placeholderResolverUtils.js').PlaceholderResolver} PlaceholderResolver_Concrete */
/** @typedef {import('../../../../services/promptElementAssemblers/standardElementAssembler.js').StandardElementAssembler} StandardElementAssembler_Concrete */
/** @typedef {import('../../../../services/promptElementAssemblers/perceptionLogAssembler.js').PerceptionLogAssembler} PerceptionLogAssembler_Concrete */
/** @typedef {import('../../../../services/promptElementAssemblers/thoughtsSectionAssembler.js').default} ThoughtsSectionAssembler_Concrete */
/** @typedef {import('../../../../services/promptElementAssemblers/notesSectionAssembler.js').default} NotesSectionAssembler_Concrete */
/** @typedef {import('../../../../services/promptBuilder.js').PromptBuilder} PromptBuilder_Concrete */

// --- Jest Imports ---
import { describe, beforeEach, it, expect, jest } from '@jest/globals';

// --- Dependencies for Registration ---
import { tokens } from '../../../../src/dependencyInjection/tokens.js';
import { Registrar } from '../../../../src/dependencyInjection/registrarHelpers.js';
import { createMockContainerWithRegistration } from '../../../common/mockFactories/index.js';

// --- Classes to be Mocked ---
// Mock concrete implementations that will be instantiated by factories or resolved.
const mockLLMConfigServiceInstance = { getConfig: jest.fn() };
const mockPlaceholderResolverInstance = { resolve: jest.fn() };
const mockStandardElementAssemblerInstance = { assemble: jest.fn() };
const mockPerceptionLogAssemblerInstance = { assemble: jest.fn() };
const mockThoughtsSectionAssemblerInstance = { assemble: jest.fn() };
const mockNotesSectionAssemblerInstance = { assemble: jest.fn() };
const mockPromptBuilderInstance = { build: jest.fn() };

// Mock the modules themselves
jest.mock('../../../../src/llms/llmConfigService.js', () => ({
  LLMConfigService: jest
    .fn()
    .mockImplementation(() => mockLLMConfigServiceInstance),
}));
jest.mock('../../../../src/utils/placeholderResolverUtils.js', () => ({
  PlaceholderResolver: jest
    .fn()
    .mockImplementation(() => mockPlaceholderResolverInstance),
}));
jest.mock(
  '../../../../src/prompting/assembling/standardElementAssembler.js',
  () => ({
    StandardElementAssembler: jest
      .fn()
      .mockImplementation(() => mockStandardElementAssemblerInstance),
  })
);
jest.mock(
  '../../../../src/prompting/assembling/perceptionLogAssembler.js',
  () => ({
    PerceptionLogAssembler: jest
      .fn()
      .mockImplementation(() => mockPerceptionLogAssemblerInstance),
  })
);
jest.mock(
  '../../../../src/prompting/assembling/thoughtsSectionAssembler.js',
  () => ({
    __esModule: true,
    default: jest
      .fn()
      .mockImplementation(() => mockThoughtsSectionAssemblerInstance),
  })
);
jest.mock(
  '../../../../src/prompting/assembling/notesSectionAssembler.js',
  () => ({
    __esModule: true,
    default: jest
      .fn()
      .mockImplementation(() => mockNotesSectionAssemblerInstance),
  })
);
jest.mock('../../../../src/prompting/promptBuilder.js', () => ({
  PromptBuilder: jest.fn().mockImplementation(() => mockPromptBuilderInstance),
}));

// --- Import classes after mocking ---
import { LLMConfigService } from '../../../../src/llms/llmConfigService.js';
import { PlaceholderResolver } from '../../../../src/utils/placeholderResolverUtils.js';
import { StandardElementAssembler } from '../../../../src/prompting/assembling/standardElementAssembler.js';
import { PerceptionLogAssembler } from '../../../../src/prompting/assembling/perceptionLogAssembler.js';
import ThoughtsSectionAssembler from '../../../../src/prompting/assembling/thoughtsSectionAssembler.js';
import NotesSectionAssembler from '../../../../src/prompting/assembling/notesSectionAssembler.js';
import { PromptBuilder } from '../../../../src/prompting/promptBuilder.js';

// --- Mock Logger ---
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

describe('IPromptBuilder Registration and Resolution', () => {
  let mockContainer;
  let registrar;

  // This is the factory function for IPromptBuilder, extracted from domainServicesRegistrations.js
  // We use the actual 'log' from the file (which is mockLogger here)
  const promptBuilderFactory = (c) => {
    const logger = /** @type {ILogger} */ (c.resolve(tokens.ILogger));
    const llmConfigService = /** @type {LLMConfigService_Concrete} */ (
      c.resolve(tokens.LLMConfigService)
    );
    const placeholderResolver = /** @type {PlaceholderResolver_Concrete} */ (
      c.resolve(tokens.PlaceholderResolver)
    );
    const standardElementAssembler =
      /** @type {StandardElementAssembler_Concrete} */ (
        c.resolve(tokens.StandardElementAssembler)
      );
    const perceptionLogAssembler =
      /** @type {PerceptionLogAssembler_Concrete} */ (
        c.resolve(tokens.PerceptionLogAssembler)
      );
    const thoughtsSectionAssembler =
      /** @type {ThoughtsSectionAssembler_Concrete} */ (
        c.resolve(tokens.ThoughtsSectionAssembler)
      );
    const notesSectionAssembler =
      /** @type {NotesSectionAssembler_Concrete} */ (
        c.resolve(tokens.NotesSectionAssembler)
      );

    // Use the global mockLogger for this test, as 'log.info' would be from the registration file's scope
    mockLogger.debug(
      `${String(tokens.IPromptBuilder)} factory: Creating PromptBuilder with new dependencies.`
    );
    return new PromptBuilder({
      // PromptBuilder constructor is mocked
      logger,
      llmConfigService,
      placeholderResolver,
      standardElementAssembler,
      perceptionLogAssembler,
      thoughtsSectionAssembler,
      notesSectionAssembler,
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockContainer = createMockContainerWithRegistration();
    registrar = new Registrar(mockContainer);

    // Pre-register the mocked dependencies that IPromptBuilder's factory will resolve
    // The factory functions for these will return the mocked instances directly.
    mockContainer.register(tokens.ILogger, mockLogger); // Direct registration of mock
    mockContainer.register(
      tokens.LLMConfigService,
      () => mockLLMConfigServiceInstance
    );
    mockContainer.register(
      tokens.PlaceholderResolver,
      () => mockPlaceholderResolverInstance
    );
    mockContainer.register(
      tokens.StandardElementAssembler,
      () => mockStandardElementAssemblerInstance
    );
    mockContainer.register(
      tokens.PerceptionLogAssembler,
      () => mockPerceptionLogAssemblerInstance
    );
    mockContainer.register(
      tokens.ThoughtsSectionAssembler,
      () => mockThoughtsSectionAssemblerInstance
    );
    mockContainer.register(
      tokens.NotesSectionAssembler,
      () => mockNotesSectionAssemblerInstance
    ); // Key dependency
  });

  it('should correctly resolve IPromptBuilder with all its assembler dependencies, including NotesSectionAssembler', () => {
    // Register IPromptBuilder using its factory
    registrar.singletonFactory(tokens.IPromptBuilder, promptBuilderFactory);

    // Attempt to resolve IPromptBuilder
    const resolvedPromptBuilder = mockContainer.resolve(tokens.IPromptBuilder);

    // Verify that the PromptBuilder constructor was called once
    expect(PromptBuilder).toHaveBeenCalledTimes(1);

    // Verify that the PromptBuilder constructor was called with the correct (mocked) dependencies
    expect(PromptBuilder).toHaveBeenCalledWith({
      logger: mockLogger,
      llmConfigService: mockLLMConfigServiceInstance,
      placeholderResolver: mockPlaceholderResolverInstance,
      standardElementAssembler: mockStandardElementAssemblerInstance,
      perceptionLogAssembler: mockPerceptionLogAssemblerInstance,
      thoughtsSectionAssembler: mockThoughtsSectionAssemblerInstance,
      notesSectionAssembler: mockNotesSectionAssemblerInstance, // Ensure this is correctly passed
    });

    // Verify the resolved instance is the one returned by the mocked PromptBuilder constructor
    expect(resolvedPromptBuilder).toBe(mockPromptBuilderInstance);

    // Verify that the factory logged its message (optional, but good for completeness)
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `${String(tokens.IPromptBuilder)} factory: Creating PromptBuilder with new dependencies.`
    );
  });

  it('factory for NotesSectionAssembler should register it correctly (conceptual check)', () => {
    // This test conceptually verifies how NotesSectionAssembler would be registered
    // using its own factory, similar to what's in domainServicesRegistrations.js
    const notesFactory = (c) => {
      const logger = c.resolve(tokens.ILogger);
      return new NotesSectionAssembler({ logger }); // NotesSectionAssembler constructor is mocked
    };
    registrar.singletonFactory(tokens.NotesSectionAssembler, notesFactory);

    mockContainer.resolve(tokens.NotesSectionAssembler);
    expect(NotesSectionAssembler).toHaveBeenCalledWith({ logger: mockLogger });
  });
});

// --- FILE END ---
