/**
 * @file Additional validation coverage for SpeechPatternsResponseProcessor
 */
import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';

let mockShouldThrowOnValidatorConstruct = false;
let mockValidateAndSanitizeResponse = jest.fn();
const mockValidateAgainstSchema = jest.fn();

jest.mock(
  '../../../../src/characterBuilder/validators/SpeechPatternsSchemaValidator.js',
  () => ({
    __esModule: true,
    default: class MockSpeechPatternsSchemaValidator {
      constructor() {
        if (mockShouldThrowOnValidatorConstruct) {
          throw new Error('validator initialization failed');
        }
        this.validateAndSanitizeResponse = (...args) =>
          mockValidateAndSanitizeResponse(...args);
      }
    },
  })
);

jest.mock('../../../../src/utils/schemaValidationUtils.js', () => ({
  __esModule: true,
  validateAgainstSchema: (...args) => mockValidateAgainstSchema(...args),
}));

let SpeechPatternsResponseProcessor;
let speechPatternsPrompts;

beforeAll(async () => {
  ({
    default: SpeechPatternsResponseProcessor,
  } = await import(
    '../../../../src/characterBuilder/services/SpeechPatternsResponseProcessor.js'
  ));
  speechPatternsPrompts = await import(
    '../../../../src/characterBuilder/prompts/speechPatternsPrompts.js'
  );
});

describe('SpeechPatternsResponseProcessor - enhanced validation coverage', () => {
  let testBed;
  let mockLogger;
  let mockLlmJsonService;
  let mockSchemaValidator;

  const rawResponse = JSON.stringify({
    speechPatterns: [
      {
        pattern: 'Pattern one detail',
        example: 'Example one',
        circumstances: 'when excited',
      },
      {
        pattern: 'Pattern two detail',
        example: 'Example two',
        circumstances: 'when sad',
      },
      {
        pattern: 'Pattern three detail',
        example: 'Example three',
        circumstances: 'when calm',
      },
    ],
    characterName: 'Tester',
  });

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    mockLlmJsonService = testBed.createMock('LlmJsonService', [
      'clean',
      'parseAndRepair',
    ]);

    mockLlmJsonService.clean.mockImplementation((value) => value);
    mockLlmJsonService.parseAndRepair.mockImplementation(async (value) =>
      JSON.parse(value)
    );

    mockSchemaValidator = {
      validateAgainstSchema: jest.fn(),
      isSchemaLoaded: jest.fn().mockReturnValue(true),
      validate: jest.fn().mockReturnValue({
        isValid: true,
        errors: [],
        warnings: [],
      }),
    };

    mockValidateAgainstSchema.mockReset();
    mockValidateAndSanitizeResponse = jest.fn();
    mockShouldThrowOnValidatorConstruct = false;

    jest
      .spyOn(
        speechPatternsPrompts,
        'validateSpeechPatternsGenerationResponse'
      )
      .mockImplementation(() => ({ isValid: true, errors: [] }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const createProcessor = () =>
    new SpeechPatternsResponseProcessor({
      logger: mockLogger,
      llmJsonService: mockLlmJsonService,
      schemaValidator: mockSchemaValidator,
    });

  it('uses sanitized response from enhanced validator when validation passes', async () => {
    const sanitizedResponse = {
      speechPatterns: [
        {
          pattern: 'Sanitized pattern',
          example: 'Sanitized example',
          circumstances: 'when focused',
        },
        {
          pattern: 'Second sanitized',
          example: 'Another clean example',
          circumstances: 'when relaxed',
        },
        {
          pattern: 'Third sanitized',
          example: 'Final sanitized example',
          circumstances: 'when amused',
        },
      ],
      characterName: 'Sanitized Character',
      generatedAt: '2024-03-01T00:00:00.000Z',
    };

    mockValidateAndSanitizeResponse.mockResolvedValue({
      isValid: true,
      errors: [],
      sanitizedResponse,
    });

    const processor = createProcessor();

    const result = await processor.processResponse(rawResponse, {
      characterName: 'Original Name',
    });

    expect(mockValidateAndSanitizeResponse).toHaveBeenCalledWith(
      expect.objectContaining({ characterName: 'Tester' })
    );
    expect(result.characterName).toBe('Sanitized Character');
    expect(result.metadata.patternCount).toBe(3);
    expect(result.generatedAt).toBe('2024-03-01T00:00:00.000Z');
    expect(mockValidateAgainstSchema).not.toHaveBeenCalled();
  });

  it('throws when enhanced validator reports invalid data', async () => {
    mockValidateAndSanitizeResponse.mockResolvedValue({
      isValid: false,
      errors: ['invalid data'],
      sanitizedResponse: null,
    });

    const processor = createProcessor();

    await expect(processor.processResponse(rawResponse)).rejects.toThrow(
      'Response processing failed: Enhanced validation failed: invalid data'
    );
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Enhanced schema validation failed',
      {
        errors: ['invalid data'],
      }
    );
  });

  it('propagates errors thrown by enhanced validator', async () => {
    mockValidateAndSanitizeResponse.mockImplementation(() => {
      throw new Error('validator crashed');
    });

    const processor = createProcessor();

    await expect(processor.processResponse(rawResponse)).rejects.toThrow(
      'Response processing failed: validator crashed'
    );
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Enhanced schema validation error',
      expect.any(Error)
    );
  });

  it('throws when prompt-level validation fails before enhanced validation', async () => {
    speechPatternsPrompts.validateSpeechPatternsGenerationResponse.mockImplementation(
      () => ({
        isValid: false,
        errors: ['base validation failure'],
      })
    );

    const processor = createProcessor();

    await expect(processor.processResponse(rawResponse)).rejects.toThrow(
      'Response processing failed: Invalid response structure: base validation failure'
    );
    expect(mockValidateAndSanitizeResponse).not.toHaveBeenCalled();
  });

  it('falls back to legacy schema validation when enhanced validator is unavailable', async () => {
    mockShouldThrowOnValidatorConstruct = true;
    mockValidateAgainstSchema.mockImplementation(() => undefined);

    const processor = createProcessor();

    const result = await processor.processResponse(rawResponse);

    expect(mockValidateAgainstSchema).toHaveBeenCalledTimes(1);
    const [validator, schemaId] = mockValidateAgainstSchema.mock.calls[0];
    expect(validator).toBe(mockSchemaValidator);
    expect(schemaId).toBe('speech-patterns-response.schema.json');
    expect(result.speechPatterns).toHaveLength(3);
  });

  it('logs fallback message when legacy schema validation throws', async () => {
    mockShouldThrowOnValidatorConstruct = true;
    mockValidateAgainstSchema.mockImplementation(() => {
      throw new Error('utility missing');
    });

    const processor = createProcessor();

    const result = await processor.processResponse(rawResponse);

    const debugMessages = mockLogger.debug.mock.calls.map((call) => call[0]);
    expect(debugMessages).toContain(
      'Schema validation utility not available, using prompt validation only'
    );
    expect(result.speechPatterns).toHaveLength(3);
  });
});
