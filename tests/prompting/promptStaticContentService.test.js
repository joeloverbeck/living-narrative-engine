import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import { PromptStaticContentService } from '../../src/prompting/promptStaticContentService.js';

const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

const promptData = {
  coreTaskDescriptionText: 'Core text',
  characterPortrayalGuidelinesTemplate: 'Guidelines for {{name}}',
  nc21ContentPolicyText: 'Policy',
  finalLlmInstructionText: 'Final',
};

describe('PromptStaticContentService', () => {
  let service;
  let mockLoader;

  beforeEach(async () => {
    mockLogger.debug.mockClear();
    mockLoader = { loadPromptText: jest.fn().mockResolvedValue(promptData) };
    service = new PromptStaticContentService({
      logger: mockLogger,
      promptTextLoader: mockLoader,
    });
    await service.initialize();
  });

  it('uses the loader to load prompt text once', () => {
    expect(mockLoader.loadPromptText).toHaveBeenCalledTimes(1);
  });

  it('provides text from the loaded data', () => {
    expect(service.getCoreTaskDescriptionText()).toBe(
      promptData.coreTaskDescriptionText
    );
    expect(service.getNc21ContentPolicyText()).toBe(
      promptData.nc21ContentPolicyText
    );
    expect(service.getFinalLlmInstructionText()).toBe(
      promptData.finalLlmInstructionText
    );
  });

  it('substitutes the character name in portrayal guidelines', () => {
    const text = service.getCharacterPortrayalGuidelines('Alice');
    expect(text).toBe('Guidelines for Alice');
  });

  it('throws if accessed before initialization', () => {
    const uninitService = new PromptStaticContentService({
      logger: mockLogger,
      promptTextLoader: mockLoader,
    });
    expect(() => uninitService.getCoreTaskDescriptionText()).toThrow(
      'PromptStaticContentService: Service not initialized.'
    );
  });
});
