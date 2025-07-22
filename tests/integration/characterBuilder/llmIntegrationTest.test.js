/**
 * @file Integration tests for Character Builder LLM integration
 * @description Tests the interaction with real LLM services (mocked for testing)
 */

import {
  jest,
  describe,
  beforeEach,
  afterEach,
  test,
  expect,
} from '@jest/globals';
import { ThematicDirectionGenerator } from '../../../src/characterBuilder/services/thematicDirectionGenerator.js';
import { LlmJsonService } from '../../../src/llms/llmJsonService.js';

/**
 * Integration tests for LLM service interaction
 * Uses mocked LLM services but tests the actual integration patterns
 */
describe('Character Builder LLM Integration', () => {
  let directionGenerator;
  let mockLogger;
  let mockLlmJsonService;
  let mockLlmStrategyFactory;
  let mockLlmConfigManager;
  let mockStrategy;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockLlmJsonService = {
      clean: jest.fn(),
      parseAndRepair: jest.fn(),
    };

    mockStrategy = {
      execute: jest.fn(),
    };

    mockLlmStrategyFactory = {
      getStrategy: jest.fn(() => mockStrategy),
    };

    mockLlmConfigManager = {
      loadConfiguration: jest.fn(),
    };

    directionGenerator = new ThematicDirectionGenerator({
      logger: mockLogger,
      llmJsonService: mockLlmJsonService,
      llmStrategyFactory: mockLlmStrategyFactory,
      llmConfigManager: mockLlmConfigManager,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('LLM Configuration Integration', () => {
    test('should use base openrouter-claude-sonnet-4 configuration with dynamic schema injection', async () => {
      // Arrange
      const mockLlmConfig = {
        configId: 'openrouter-claude-sonnet-4',
        modelIdentifier: 'anthropic/claude-sonnet-4',
        apiType: 'openrouter',
        jsonOutputStrategy: {
          method: 'openrouter_json_schema',
          jsonSchema: {
            type: 'object',
            properties: {
              thematicDirections: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    description: { type: 'string' },
                    coreTension: { type: 'string' },
                    uniqueTwist: { type: 'string' },
                    narrativePotential: { type: 'string' },
                  },
                },
              },
            },
          },
        },
        defaultParameters: {
          temperature: 0.7,
          max_tokens: 2000,
        },
      };

      const mockLlmResponse = JSON.stringify({
        thematicDirections: [
          {
            title: 'The Reluctant Hero',
            description:
              'A character who must overcome their deep-seated reluctance to embrace their destiny as a hero',
            coreTension:
              'Desire for normalcy versus the overwhelming call to adventure',
            uniqueTwist:
              'Their reluctance is actually a hidden strength that protects them',
            narrativePotential:
              'Stories of personal growth through facing adversity and accepting responsibility',
          },
          {
            title: 'The Skilled Archer',
            description:
              'A character defined by their exceptional marksmanship and uncanny ability to hit impossible targets',
            coreTension:
              'Perfect precision in archery contrasted with complete chaos in personal life',
            uniqueTwist:
              'Their arrows always find their mark, but somehow never hit the intended target',
            narrativePotential:
              'Tales of finding true purpose while dealing with constant misdirection and unintended consequences',
          },
          {
            title: 'The Ditzy Genius',
            description:
              'A character whose apparent clumsiness and social awkwardness cleverly conceals their remarkable intellectual insights',
            coreTension:
              'Extreme social awkwardness contrasted with unparalleled intellectual brilliance',
            uniqueTwist:
              'Their embarrassing mistakes consistently lead to groundbreaking discoveries',
            narrativePotential:
              'Comedic adventures with surprising depth, featuring accidental heroism and serendipitous breakthroughs',
          },
        ],
      });

      mockLlmConfigManager.loadConfiguration.mockResolvedValue(mockLlmConfig);
      mockStrategy.execute.mockResolvedValue(mockLlmResponse);
      mockLlmJsonService.clean.mockReturnValue(mockLlmResponse);
      mockLlmJsonService.parseAndRepair.mockResolvedValue(
        JSON.parse(mockLlmResponse)
      );

      // Act
      const result = await directionGenerator.generateDirections(
        'concept-123',
        'A ditzy archer who loves adventure'
      );

      // Assert
      expect(mockLlmConfigManager.loadConfiguration).toHaveBeenCalledWith(
        'openrouter-claude-sonnet-4'
      );
      // The strategy is called with an enhanced config that includes the JSON schema
      expect(mockLlmStrategyFactory.getStrategy).toHaveBeenCalledWith(
        expect.objectContaining({
          configId: 'openrouter-claude-sonnet-4',
          modelIdentifier: 'anthropic/claude-sonnet-4',
          apiType: 'openrouter',
          jsonOutputStrategy: {
            method: 'openrouter_json_schema',
            jsonSchema: expect.objectContaining({
              type: 'object',
              properties: expect.objectContaining({
                thematicDirections: expect.any(Object),
              }),
            }),
          },
        })
      );
      expect(result).toHaveLength(3);
      expect(result[0].llmMetadata.modelId).toBe('openrouter-claude-sonnet-4');
    });

    test('should use custom LLM configuration when provided', async () => {
      // Arrange
      const customConfigId = 'custom-character-config';
      const mockLlmConfig = {
        configId: customConfigId,
        modelIdentifier: 'custom-model',
        apiType: 'openrouter',
        jsonOutputStrategy: { method: 'openrouter_json_schema' },
      };

      const mockLlmResponse = JSON.stringify({
        thematicDirections: [
          {
            title: 'Custom Direction 1',
            description:
              'The first custom thematic direction explores unique character development paths and narrative possibilities',
            coreTension:
              'The fundamental conflict between personal desires and societal expectations',
            uniqueTwist:
              'An unexpected revelation that completely reframes the character journey',
            narrativePotential:
              'Rich storytelling opportunities exploring themes of identity and transformation',
          },
          {
            title: 'Custom Direction 2',
            description:
              'The second custom thematic direction delves into complex relationships and moral ambiguity',
            coreTension:
              'The struggle between maintaining integrity and achieving ambitious goals',
            uniqueTwist:
              'Their greatest strength becomes their most significant weakness',
            narrativePotential:
              'Opportunities for exploring moral complexity and character growth through difficult choices',
          },
          {
            title: 'Custom Direction 3',
            description:
              'The third custom thematic direction examines legacy, heritage, and the weight of expectations',
            coreTension:
              'Balancing respect for tradition with the need for revolutionary change',
            uniqueTwist:
              'The solution to their problems lies in embracing what they rejected',
            narrativePotential:
              'Stories exploring generational conflict, cultural evolution, and personal reinvention',
          },
        ],
      });

      mockLlmConfigManager.loadConfiguration.mockResolvedValue(mockLlmConfig);
      mockStrategy.execute.mockResolvedValue(mockLlmResponse);
      mockLlmJsonService.clean.mockReturnValue(mockLlmResponse);
      mockLlmJsonService.parseAndRepair.mockResolvedValue(
        JSON.parse(mockLlmResponse)
      );

      // Act
      const result = await directionGenerator.generateDirections(
        'concept-123',
        'A test character',
        { llmConfigId: customConfigId }
      );

      // Assert
      expect(mockLlmConfigManager.loadConfiguration).toHaveBeenCalledWith(
        customConfigId
      );
      expect(result[0].llmMetadata.modelId).toBe(customConfigId);
    });

    test('should handle LLM configuration not found', async () => {
      // Arrange
      mockLlmConfigManager.loadConfiguration.mockResolvedValue(null);

      // Act & Assert
      await expect(
        directionGenerator.generateDirections('concept-123', 'A test character')
      ).rejects.toThrow(
        'LLM configuration not found: openrouter-claude-sonnet-4'
      );
    });
  });

  describe('LLM Request Format Integration', () => {
    test('should format LLM request with correct message structure', async () => {
      // Arrange
      const mockLlmConfig = {
        configId: 'openrouter-claude-sonnet-4',
        apiType: 'openrouter',
        jsonOutputStrategy: { method: 'openrouter_json_schema' },
      };

      const characterConcept =
        'Elara, a mysterious elven archer with ancient knowledge';
      const mockLlmResponse = JSON.stringify({
        thematicDirections: [
          {
            title: 'Test Direction 1',
            description:
              'The first test direction explores foundational character archetypes and narrative structures',
            coreTension:
              'The eternal struggle between order and chaos in character development',
            uniqueTwist:
              'What seems like weakness becomes the source of greatest strength',
            narrativePotential:
              'Stories exploring personal transformation through unexpected challenges and revelations',
          },
          {
            title: 'Test Direction 2',
            description:
              'The second test direction delves into complex interpersonal dynamics and moral choices',
            coreTension:
              'Navigating the conflict between personal ambition and collective responsibility',
            uniqueTwist:
              'The path to victory requires embracing apparent defeat and vulnerability',
            narrativePotential:
              'Narratives examining sacrifice, redemption, and the true meaning of heroism',
          },
          {
            title: 'Test Direction 3',
            description:
              'The third test direction examines themes of legacy, destiny, and self-determination',
            coreTension:
              'Breaking free from predetermined fate while honoring ancestral wisdom',
            uniqueTwist:
              'The prophecy was never about them, but about who they would inspire',
            narrativePotential:
              'Epic tales of forging new paths while respecting traditional values and heritage',
          },
        ],
      });

      mockLlmConfigManager.loadConfiguration.mockResolvedValue(mockLlmConfig);
      mockStrategy.execute.mockResolvedValue(mockLlmResponse);
      mockLlmJsonService.clean.mockReturnValue(mockLlmResponse);
      mockLlmJsonService.parseAndRepair.mockResolvedValue(
        JSON.parse(mockLlmResponse)
      );

      // Act
      await directionGenerator.generateDirections(
        'concept-123',
        characterConcept
      );

      // Assert
      expect(mockStrategy.execute).toHaveBeenCalledWith({
        messages: [
          { role: 'user', content: expect.stringContaining(characterConcept) },
        ],
        temperature: 0.7,
        max_tokens: 2000,
        llmConfig: expect.objectContaining({
          apiType: 'openrouter',
          configId: 'openrouter-claude-sonnet-4',
          jsonOutputStrategy: {
            method: 'openrouter_json_schema',
            jsonSchema: expect.any(Object),
          },
        }),
        environmentContext: { environment: 'client' },
      });

      // Verify the prompt contains the character concept
      const executeCall = mockStrategy.execute.mock.calls[0][0];
      expect(executeCall.messages[0].content).toContain('Elara');
      expect(executeCall.messages[0].content).toContain('elven archer');
      expect(executeCall.messages[0].content).toContain('ancient knowledge');
    });

    test('should include proper prompt structure for thematic directions', async () => {
      // Arrange
      const mockLlmConfig = {
        configId: 'openrouter-claude-sonnet-4',
        apiType: 'openrouter',
        jsonOutputStrategy: { method: 'openrouter_json_schema' },
      };

      const mockLlmResponse = JSON.stringify({
        thematicDirections: [
          {
            title: 'Test Direction 1',
            description:
              'The first test direction explores foundational character archetypes and narrative structures',
            coreTension:
              'The eternal struggle between order and chaos in character development',
            uniqueTwist:
              'What seems like weakness becomes the source of greatest strength',
            narrativePotential:
              'Stories exploring personal transformation through unexpected challenges and revelations',
          },
          {
            title: 'Test Direction 2',
            description:
              'The second test direction delves into complex interpersonal dynamics and moral choices',
            coreTension:
              'Navigating the conflict between personal ambition and collective responsibility',
            uniqueTwist:
              'The path to victory requires embracing apparent defeat and vulnerability',
            narrativePotential:
              'Narratives examining sacrifice, redemption, and the true meaning of heroism',
          },
          {
            title: 'Test Direction 3',
            description:
              'The third test direction examines themes of legacy, destiny, and self-determination',
            coreTension:
              'Breaking free from predetermined fate while honoring ancestral wisdom',
            uniqueTwist:
              'The prophecy was never about them, but about who they would inspire',
            narrativePotential:
              'Epic tales of forging new paths while respecting traditional values and heritage',
          },
        ],
      });

      mockLlmConfigManager.loadConfiguration.mockResolvedValue(mockLlmConfig);
      mockStrategy.execute.mockResolvedValue(mockLlmResponse);
      mockLlmJsonService.clean.mockReturnValue(mockLlmResponse);
      mockLlmJsonService.parseAndRepair.mockResolvedValue(
        JSON.parse(mockLlmResponse)
      );

      // Act
      await directionGenerator.generateDirections(
        'concept-123',
        'A young wizard seeking knowledge'
      );

      // Assert - Verify prompt contains expected structure
      const executeCall = mockStrategy.execute.mock.calls[0][0];
      const promptContent = executeCall.messages[0].content;

      expect(promptContent).toContain('<task_definition>');
      expect(promptContent).toContain('<character_concept>');
      expect(promptContent).toContain('<instructions>');
      expect(promptContent).toContain('<response_format>');
      expect(promptContent).toContain('thematicDirections');
      expect(promptContent).toContain('title');
      expect(promptContent).toContain('description');
      expect(promptContent).toContain('coreTension');
      expect(promptContent).toContain('uniqueTwist');
      expect(promptContent).toContain('narrativePotential');
    });
  });

  describe('LLM Response Processing Integration', () => {
    test('should properly clean and parse LLM response', async () => {
      // Arrange
      const mockLlmConfig = {
        configId: 'openrouter-claude-sonnet-4',
        apiType: 'openrouter',
        jsonOutputStrategy: { method: 'openrouter_json_schema' },
      };

      const rawLlmResponse = `
        Here are the thematic directions:
        
        {
          "thematicDirections": [
            {
              "title": "The Seeker of Lost Wisdom",
              "description": "A character driven by the pursuit of forgotten knowledge",
              "coreTension": "The price of knowledge versus the burden of ignorance",
              "uniqueTwist": "Each spell learned takes away a cherished memory",
              "narrativePotential": "Stories of sacrifice, discovery, and the true cost of power"
            },
            {
              "title": "The Apprentice of Time",
              "description": "A young wizard who manipulates temporal forces",
              "coreTension": "The desire to change the past versus accepting the present",
              "uniqueTwist": "Can see all possible futures but cannot change their own",
              "narrativePotential": "Stories of fate, free will, and temporal paradoxes"
            },
            {
              "title": "The Scholar of Forbidden Arts",
              "description": "A knowledge seeker who delves into dangerous magic",
              "coreTension": "Academic curiosity versus ethical boundaries",
              "uniqueTwist": "Their research accidentally benefits their enemies",
              "narrativePotential": "Stories of unintended consequences and moral dilemmas"
            }
          ]
        }
      `;

      const cleanedResponse = JSON.stringify({
        thematicDirections: [
          {
            title: 'The Seeker of Lost Wisdom',
            description:
              'A character driven by the pursuit of forgotten knowledge',
            coreTension:
              'The price of knowledge versus the burden of ignorance',
            uniqueTwist: 'Each spell learned takes away a cherished memory',
            narrativePotential:
              'Stories of sacrifice, discovery, and the true cost of power',
          },
          {
            title: 'The Apprentice of Time',
            description:
              'A young wizard who manipulates temporal forces with growing but unpredictable powers',
            coreTension:
              'The desire to change the past versus accepting the present',
            uniqueTwist:
              'Can see all possible futures but cannot change their own',
            narrativePotential:
              'Stories of fate, free will, and temporal paradoxes',
          },
          {
            title: 'The Scholar of Forbidden Arts',
            description:
              'A knowledge seeker who delves into dangerous and forbidden magical practices despite warnings',
            coreTension: 'Academic curiosity versus ethical boundaries',
            uniqueTwist: 'Their research accidentally benefits their enemies',
            narrativePotential:
              'Stories of unintended consequences and moral dilemmas',
          },
        ],
      });

      mockLlmConfigManager.loadConfiguration.mockResolvedValue(mockLlmConfig);
      mockStrategy.execute.mockResolvedValue(rawLlmResponse);
      mockLlmJsonService.clean.mockReturnValue(cleanedResponse);
      mockLlmJsonService.parseAndRepair.mockResolvedValue(
        JSON.parse(cleanedResponse)
      );

      // Act
      const result = await directionGenerator.generateDirections(
        'concept-123',
        'A young wizard seeking knowledge'
      );

      // Assert
      expect(mockLlmJsonService.clean).toHaveBeenCalledWith(rawLlmResponse);
      expect(mockLlmJsonService.parseAndRepair).toHaveBeenCalledWith(
        cleanedResponse,
        {
          logger: mockLogger,
        }
      );
      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({
        title: 'The Seeker of Lost Wisdom',
        description: 'A character driven by the pursuit of forgotten knowledge',
        coreTension: 'The price of knowledge versus the burden of ignorance',
        uniqueTwist: 'Each spell learned takes away a cherished memory',
        narrativePotential:
          'Stories of sacrifice, discovery, and the true cost of power',
      });
    });

    test('should handle multiple thematic directions in response', async () => {
      // Arrange
      const mockLlmConfig = {
        configId: 'openrouter-claude-sonnet-4',
        apiType: 'openrouter',
        jsonOutputStrategy: { method: 'openrouter_json_schema' },
      };

      const mockLlmResponse = JSON.stringify({
        thematicDirections: [
          {
            title: 'Direction One',
            description:
              'First thematic direction exploring the complex relationship between personal identity and societal expectations',
            coreTension:
              'The eternal struggle between individual authenticity and social conformity',
            uniqueTwist:
              'Their greatest strength emerges from embracing their perceived weaknesses',
            narrativePotential:
              'Rich narrative opportunities for self-discovery and breaking social boundaries',
          },
          {
            title: 'Direction Two',
            description:
              'Second thematic direction delving into the paradox of power and the responsibility it brings to those who wield it',
            coreTension:
              'The conflict between using power for personal gain versus serving the greater good',
            uniqueTwist:
              'True power comes from knowing when not to use it rather than from its exercise',
            narrativePotential:
              'Stories exploring moral complexity, difficult choices, and the burden of leadership',
          },
          {
            title: 'Direction Three',
            description:
              'Third thematic direction examining the nature of legacy and how our actions echo through generations',
            coreTension:
              'Building for the future while being bound by the past and its expectations',
            uniqueTwist:
              'The legacy they leave is completely different from what they intended to create',
            narrativePotential:
              'Generational sagas exploring unintended consequences and the ripple effects of choices',
          },
        ],
      });

      mockLlmConfigManager.loadConfiguration.mockResolvedValue(mockLlmConfig);
      mockStrategy.execute.mockResolvedValue(mockLlmResponse);
      mockLlmJsonService.clean.mockReturnValue(mockLlmResponse);
      mockLlmJsonService.parseAndRepair.mockResolvedValue(
        JSON.parse(mockLlmResponse)
      );

      // Act
      const result = await directionGenerator.generateDirections(
        'concept-123',
        'A complex character with multiple facets'
      );

      // Assert
      expect(result).toHaveLength(3);
      expect(result[0].title).toBe('Direction One');
      expect(result[1].title).toBe('Direction Two');
      expect(result[2].title).toBe('Direction Three');

      // All directions should have the same conceptId and unique IDs
      expect(result.every((dir) => dir.conceptId === 'concept-123')).toBe(true);
      expect(new Set(result.map((dir) => dir.id)).size).toBe(3); // All IDs are unique
    });

    test('should include LLM metadata in generated directions', async () => {
      // Arrange
      const mockLlmConfig = {
        configId: 'openrouter-claude-sonnet-4',
        apiType: 'openrouter',
        jsonOutputStrategy: { method: 'openrouter_json_schema' },
      };

      const mockLlmResponse = JSON.stringify({
        thematicDirections: [
          {
            title: 'Test Direction 1',
            description:
              'The first test direction explores foundational character archetypes and narrative structures',
            coreTension:
              'The eternal struggle between order and chaos in character development',
            uniqueTwist:
              'What seems like weakness becomes the source of greatest strength',
            narrativePotential:
              'Stories exploring personal transformation through unexpected challenges and revelations',
          },
          {
            title: 'Test Direction 2',
            description:
              'The second test direction delves into complex interpersonal dynamics and moral choices',
            coreTension:
              'Navigating the conflict between personal ambition and collective responsibility',
            uniqueTwist:
              'The path to victory requires embracing apparent defeat and vulnerability',
            narrativePotential:
              'Narratives examining sacrifice, redemption, and the true meaning of heroism',
          },
          {
            title: 'Test Direction 3',
            description:
              'The third test direction examines themes of legacy, destiny, and self-determination',
            coreTension:
              'Breaking free from predetermined fate while honoring ancestral wisdom',
            uniqueTwist:
              'The prophecy was never about them, but about who they would inspire',
            narrativePotential:
              'Epic tales of forging new paths while respecting traditional values and heritage',
          },
        ],
      });

      const characterConcept = 'A character concept for metadata testing';
      const promptLength = characterConcept.length * 4; // Rough token estimate
      const responseLength = mockLlmResponse.length * 4; // Rough token estimate

      mockLlmConfigManager.loadConfiguration.mockResolvedValue(mockLlmConfig);
      // Add a small delay to simulate processing time
      mockStrategy.execute.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve(mockLlmResponse), 10)
          )
      );
      mockLlmJsonService.clean.mockReturnValue(mockLlmResponse);
      mockLlmJsonService.parseAndRepair.mockResolvedValue(
        JSON.parse(mockLlmResponse)
      );

      // Act
      const startTime = Date.now();
      const result = await directionGenerator.generateDirections(
        'concept-123',
        characterConcept
      );
      const endTime = Date.now();

      // Assert
      expect(result[0]).toHaveProperty('llmMetadata');
      expect(result[0].llmMetadata).toMatchObject({
        modelId: 'openrouter-claude-sonnet-4',
        promptTokens: expect.any(Number),
        responseTokens: expect.any(Number),
        processingTime: expect.any(Number),
      });

      // Verify processing time is reasonable
      expect(result[0].llmMetadata.processingTime).toBeGreaterThan(0);
      expect(result[0].llmMetadata.processingTime).toBeLessThan(
        endTime - startTime + 100
      ); // Allow some margin

      // Verify token estimates are reasonable
      expect(result[0].llmMetadata.promptTokens).toBeGreaterThan(0);
      expect(result[0].llmMetadata.responseTokens).toBeGreaterThan(0);
    });
  });

  describe('Error Handling Integration', () => {
    test('should handle LLM strategy execution errors', async () => {
      // Arrange
      const mockLlmConfig = {
        configId: 'openrouter-claude-sonnet-4',
        apiType: 'openrouter',
        jsonOutputStrategy: { method: 'openrouter_json_schema' },
      };

      mockLlmConfigManager.loadConfiguration.mockResolvedValue(mockLlmConfig);
      mockStrategy.execute.mockRejectedValue(new Error('Network timeout'));

      // Act & Assert
      await expect(
        directionGenerator.generateDirections('concept-123', 'A test character')
      ).rejects.toThrow('LLM request failed: Network timeout');

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Generation failed'),
        expect.any(Object)
      );
    });

    test('should handle JSON parsing errors', async () => {
      // Arrange
      const mockLlmConfig = {
        configId: 'openrouter-claude-sonnet-4',
        apiType: 'openrouter',
        jsonOutputStrategy: { method: 'openrouter_json_schema' },
      };

      const invalidJsonResponse = 'This is not valid JSON';

      mockLlmConfigManager.loadConfiguration.mockResolvedValue(mockLlmConfig);
      mockStrategy.execute.mockResolvedValue(invalidJsonResponse);
      mockLlmJsonService.clean.mockReturnValue(invalidJsonResponse);
      mockLlmJsonService.parseAndRepair.mockRejectedValue(
        new Error('Invalid JSON format')
      );

      // Act & Assert
      await expect(
        directionGenerator.generateDirections('concept-123', 'A test character')
      ).rejects.toThrow('Failed to parse LLM response: Invalid JSON format');
    });

    test('should handle response structure validation errors', async () => {
      // Arrange
      const mockLlmConfig = {
        configId: 'openrouter-claude-sonnet-4',
        apiType: 'openrouter',
        jsonOutputStrategy: { method: 'openrouter_json_schema' },
      };

      const invalidStructureResponse = JSON.stringify({
        invalidField: 'This does not match the expected structure',
      });

      mockLlmConfigManager.loadConfiguration.mockResolvedValue(mockLlmConfig);
      mockStrategy.execute.mockResolvedValue(invalidStructureResponse);
      mockLlmJsonService.clean.mockReturnValue(invalidStructureResponse);
      mockLlmJsonService.parseAndRepair.mockResolvedValue(
        JSON.parse(invalidStructureResponse)
      );

      // Act & Assert
      await expect(
        directionGenerator.generateDirections('concept-123', 'A test character')
      ).rejects.toThrow('Invalid response structure');
    });
  });

  describe('Performance and Logging Integration', () => {
    test('should log appropriate debug and info messages', async () => {
      // Arrange
      const mockLlmConfig = {
        configId: 'openrouter-claude-sonnet-4',
        apiType: 'openrouter',
        jsonOutputStrategy: { method: 'openrouter_json_schema' },
      };

      const mockLlmResponse = JSON.stringify({
        thematicDirections: [
          {
            title: 'Test Direction 1',
            description:
              'The first test direction explores foundational character archetypes and narrative structures',
            coreTension:
              'The eternal struggle between order and chaos in character development',
            uniqueTwist:
              'What seems like weakness becomes the source of greatest strength',
            narrativePotential:
              'Stories exploring personal transformation through unexpected challenges and revelations',
          },
          {
            title: 'Test Direction 2',
            description:
              'The second test direction delves into complex interpersonal dynamics and moral choices',
            coreTension:
              'Navigating the conflict between personal ambition and collective responsibility',
            uniqueTwist:
              'The path to victory requires embracing apparent defeat and vulnerability',
            narrativePotential:
              'Narratives examining sacrifice, redemption, and the true meaning of heroism',
          },
          {
            title: 'Test Direction 3',
            description:
              'The third test direction examines themes of legacy, destiny, and self-determination',
            coreTension:
              'Breaking free from predetermined fate while honoring ancestral wisdom',
            uniqueTwist:
              'The prophecy was never about them, but about who they would inspire',
            narrativePotential:
              'Epic tales of forging new paths while respecting traditional values and heritage',
          },
        ],
      });

      const conceptId = 'concept-logging-test';
      const characterConcept = 'A character for testing logging';

      mockLlmConfigManager.loadConfiguration.mockResolvedValue(mockLlmConfig);
      mockStrategy.execute.mockResolvedValue(mockLlmResponse);
      mockLlmJsonService.clean.mockReturnValue(mockLlmResponse);
      mockLlmJsonService.parseAndRepair.mockResolvedValue(
        JSON.parse(mockLlmResponse)
      );

      // Act
      await directionGenerator.generateDirections(conceptId, characterConcept);

      // Assert - Verify logging calls
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Starting generation for concept'),
        expect.objectContaining({
          conceptId,
          conceptLength: characterConcept.length,
        })
      );

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Built prompt'),
        expect.objectContaining({ conceptId })
      );

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Received LLM response'),
        expect.any(Object)
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Successfully generated thematic directions'),
        expect.objectContaining({
          conceptId,
          directionCount: 3,
          processingTime: expect.any(Number),
        })
      );
    });

    test('should measure and report processing time accurately', async () => {
      // Arrange
      const mockLlmConfig = {
        configId: 'openrouter-claude-sonnet-4',
        apiType: 'openrouter',
        jsonOutputStrategy: { method: 'openrouter_json_schema' },
      };

      const mockLlmResponse = JSON.stringify({
        thematicDirections: [
          {
            title: 'Performance Test Direction 1',
            description:
              'The first direction for testing performance measurement explores temporal themes and efficiency paradoxes',
            coreTension:
              'The fundamental conflict between achieving speed and maintaining accuracy',
            uniqueTwist:
              'Time becomes relative when pursuing perfection at any cost',
            narrativePotential:
              'Adventures exploring temporal mechanics, causality loops, and the nature of progress',
          },
          {
            title: 'Performance Test Direction 2',
            description:
              'The second direction for testing performance measurement analyzes efficiency versus completeness dilemmas',
            coreTension:
              'Balancing operational efficiency against the need for comprehensive thoroughness',
            uniqueTwist:
              'Shortcuts paradoxically lead to longer, more complex paths',
            narrativePotential:
              'Stories exploring optimization strategies, unintended consequences, and meaningful trade-offs',
          },
          {
            title: 'Performance Test Direction 3',
            description:
              'The third direction for testing performance measurement examines observation effects and measurement paradoxes',
            coreTension:
              'The conflict between objective measurement and subjective experience',
            uniqueTwist:
              'The very act of measuring fundamentally changes the outcome being measured',
            narrativePotential:
              'Narratives exploring quantum mechanics principles applied to software development and life',
          },
        ],
      });

      // Simulate realistic processing delay
      mockStrategy.execute.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve(mockLlmResponse), 100)
          )
      );

      mockLlmConfigManager.loadConfiguration.mockResolvedValue(mockLlmConfig);
      mockLlmJsonService.clean.mockReturnValue(mockLlmResponse);
      mockLlmJsonService.parseAndRepair.mockResolvedValue(
        JSON.parse(mockLlmResponse)
      );

      // Act
      const startTime = Date.now();
      const result = await directionGenerator.generateDirections(
        'concept-performance',
        'Performance test character'
      );
      const endTime = Date.now();
      const actualProcessingTime = endTime - startTime;

      // Assert - Allow for timing variations in test environments
      // The mock has a 100ms timeout, but we allow ±10ms for system variance
      expect(result[0].llmMetadata.processingTime).toBeGreaterThanOrEqual(90);
      expect(result[0].llmMetadata.processingTime).toBeLessThan(
        actualProcessingTime + 50
      ); // Allow small margin
      expect(result[0].llmMetadata.processingTime).toBeLessThan(200); // Reasonable upper bound
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Successfully generated thematic directions'),
        expect.objectContaining({
          processingTime: expect.any(Number),
        })
      );
    });
  });
});
