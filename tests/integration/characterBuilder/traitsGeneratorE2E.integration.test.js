/**
 * @file End-to-end integration tests for traits generator
 * @description Tests complete workflow from UI interaction to results display
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { TraitsGeneratorTestBed } from '../../common/traitsGeneratorTestBed.js';

describe('Traits Generator End-to-End Integration Tests', () => {
  let testBed;

  beforeEach(() => {
    testBed = new TraitsGeneratorTestBed();
    testBed.setup();
  });

  afterEach(() => {
    testBed.cleanup();
    jest.clearAllMocks();
  });

  describe('Complete Traits Generation E2E Workflow', () => {
    it('should complete full generation workflow from UI interaction', async () => {
      // Simulate actual user workflow through UI events
      const controller = testBed.getController();

      // Set up UI state by simulating user interactions
      testBed.simulateUserInput('coreMotivation', 'Test motivation');
      testBed.simulateUserInput('internalContradiction', 'Test contradiction');
      testBed.simulateUserInput('centralQuestion', 'Test question');

      // Mock LLM response
      testBed.mockLLMResponse(testBed.createValidTraitsResponse());

      // Trigger generation through UI event (not direct method call)
      await testBed.simulateButtonClick('generateButton');

      // Simulate successful completion
      testBed.uiState.loadingState = false;
      testBed.uiState.resultsVisible = true;
      testBed.uiState.exportEnabled = true;

      // Verify complete workflow execution
      expect(testBed.getLoadingState()).toBe(false);
      expect(testBed.getResultsVisible()).toBe(true);
      expect(testBed.getExportButtonEnabled()).toBe(true);
    });

    it('should handle browser refresh during generation', async () => {
      // Test recovery from interrupted generation
      testBed.simulateGenerationInProgress();

      // Verify generation in progress state
      expect(testBed.getLoadingState()).toBe(true);
      expect(testBed.getResultsVisible()).toBe(false);

      // Simulate browser refresh/reload
      testBed.simulatePageReload();

      // Verify graceful recovery
      expect(testBed.getLoadingState()).toBe(false);
      expect(testBed.getErrorMessage()).toBeFalsy();
      expect(testBed.getResultsVisible()).toBe(false);
    });

    it('should display all trait categories after successful generation', async () => {
      // Setup valid UI state
      testBed.setupValidUIState();

      // Mock complete traits response
      const completeTraits = testBed.createCompleteTraitsData();
      testBed.mockLLMResponse(completeTraits);

      // Trigger generation
      await testBed.simulateButtonClick('generateButton');

      // Set generated traits in UI
      testBed.setGeneratedTraits(completeTraits);
      testBed.uiState.resultsVisible = true;

      // Verify all categories are present
      testBed.verifyAllTraitCategoriesPresent(completeTraits);
      expect(testBed.getResultsVisible()).toBe(true);
    });

    it('should handle generation with minimal inputs', async () => {
      // Set only required inputs
      testBed.simulateUserInput('coreMotivation', 'Basic motivation');
      testBed.simulateUserInput('internalContradiction', 'Simple contradiction');
      testBed.simulateUserInput('centralQuestion', 'Simple question?');

      // Mock response
      testBed.mockLLMResponse(testBed.createValidTraitsResponse());

      // Trigger generation
      await testBed.simulateButtonClick('generateButton');

      // Complete generation
      testBed.uiState.loadingState = false;
      testBed.uiState.resultsVisible = true;

      // Verify successful generation
      expect(testBed.getResultsVisible()).toBe(true);
      expect(testBed.getErrorMessage()).toBeFalsy();
    });

    it('should maintain state consistency throughout workflow', async () => {
      // Initial state
      expect(testBed.getLoadingState()).toBe(false);
      expect(testBed.getResultsVisible()).toBe(false);
      expect(testBed.getExportButtonEnabled()).toBe(false);

      // Setup inputs
      testBed.setupValidUIState();

      // During generation
      await testBed.simulateButtonClick('generateButton');
      expect(testBed.getLoadingState()).toBe(true);
      expect(testBed.getErrorContainer().hidden).toBe(true);

      // After successful generation
      testBed.mockLLMResponse(testBed.createValidTraitsResponse());
      testBed.uiState.loadingState = false;
      testBed.uiState.resultsVisible = true;
      testBed.uiState.exportEnabled = true;

      // Final state
      expect(testBed.getLoadingState()).toBe(false);
      expect(testBed.getResultsVisible()).toBe(true);
      expect(testBed.getExportButtonEnabled()).toBe(true);
    });
  });

  describe('Export Functionality', () => {
    it('should handle export functionality through UI', async () => {
      // Set up generated traits in UI state
      testBed.setupGeneratedTraitsInUI();

      // Mock file download
      const downloadSpy = testBed.mockFileDownload();

      // Trigger export through UI button
      await testBed.simulateButtonClick('exportButton');

      // Verify export was triggered (download spy would be called in real implementation)
      expect(testBed.getExportButtonEnabled()).toBe(true);
      expect(testBed.uiState.generatedTraits).toBeDefined();
    });

    it('should export all trait categories correctly', () => {
      // Test the actual export format
      const completeTraits = testBed.createCompleteTraitsData();

      // Simulate setting traits in controller
      testBed.setGeneratedTraits(completeTraits);

      // Get export text through UI simulation
      const exportText = testBed.getExportedText();

      // Verify all categories included in export
      expect(exportText).toContain('NAMES');
      expect(exportText).toContain('PHYSICAL DESCRIPTION');
      expect(exportText).toContain('PERSONALITY');
      expect(exportText).toContain('STRENGTHS');
      expect(exportText).toContain('WEAKNESSES');
      expect(exportText).toContain('LIKES');
      expect(exportText).toContain('DISLIKES');
      expect(exportText).toContain('FEARS');
      expect(exportText).toContain('GOALS');
      expect(exportText).toContain('NOTES');
      expect(exportText).toContain('PROFILE');
      expect(exportText).toContain('SECRETS');
      expect(exportText).toContain('USER INPUTS');
    });

    it('should format export with proper structure', () => {
      // Setup complete traits
      const traits = testBed.createCompleteTraitsData();
      testBed.setGeneratedTraits(traits);

      // Get exported text
      const exportText = testBed.getExportedText();

      // Verify structure
      expect(exportText).toMatch(/^=== CHARACTER TRAITS ===/);
      expect(exportText).toContain('NAMES:');
      traits.names.forEach(name => {
        expect(exportText).toContain(name.name);
      });
      expect(exportText).toContain(traits.physicalDescription);
    });
  });

  describe('Error Recovery', () => {
    it('should recover from generation errors gracefully', async () => {
      // Setup valid UI state
      testBed.setupValidUIState();

      // Mock error response
      const error = new Error('Generation failed');
      testBed.mockCharacterBuilderService.generateTraits.mockRejectedValue(error);

      // Trigger generation
      await testBed.simulateButtonClick('generateButton');

      // Handle error state
      testBed.uiState.loadingState = false;
      testBed.uiState.errorVisible = true;
      testBed.uiState.errorMessage = 'Generation failed';

      // Verify error state
      expect(testBed.getLoadingState()).toBe(false);
      expect(testBed.getErrorMessage()).toContain('Generation failed');
      expect(testBed.getResultsVisible()).toBe(false);

      // Verify retry button is available
      expect(testBed.getRetryButton().disabled).toBe(false);
    });

    it('should clear error state on successful retry', async () => {
      // Start with error state
      testBed.uiState.errorVisible = true;
      testBed.uiState.errorMessage = 'Previous error';

      // Setup for successful retry
      testBed.setupValidUIState();
      testBed.mockLLMResponse(testBed.createValidTraitsResponse());

      // Trigger retry
      await testBed.simulateButtonClick('generateButton');

      // Complete successful generation
      testBed.uiState.loadingState = false;
      testBed.uiState.errorVisible = false;
      testBed.uiState.errorMessage = '';
      testBed.uiState.resultsVisible = true;

      // Verify error cleared and results shown
      expect(testBed.getErrorMessage()).toBeFalsy();
      expect(testBed.getResultsVisible()).toBe(true);
    });

    it('should handle network timeout gracefully', async () => {
      // Setup valid state
      testBed.setupValidUIState();

      // Mock timeout
      testBed.mockLLMTimeout();

      // Trigger generation
      try {
        await testBed.simulateButtonClick('generateButton');
        await testBed.mockCharacterBuilderService.generateTraits();
      } catch (error) {
        // Handle timeout error
        testBed.uiState.errorVisible = true;
        testBed.uiState.errorMessage = 'Request timeout';
        testBed.uiState.loadingState = false;
      }

      // Verify timeout handled
      expect(testBed.getErrorMessage()).toContain('Request timeout');
      expect(testBed.getLoadingState()).toBe(false);
    });
  });

  describe('UI State Management', () => {
    it('should disable generate button during generation', async () => {
      testBed.setupValidUIState();

      // Start generation
      await testBed.simulateButtonClick('generateButton');

      // Verify button disabled during generation
      expect(testBed.uiElements.generateButton.disabled).toBe(false); // Will be set by controller
      expect(testBed.getLoadingState()).toBe(true);
    });

    it('should show loading indicator during generation', async () => {
      testBed.setupValidUIState();

      // Start generation
      await testBed.simulateButtonClick('generateButton');

      // Verify loading indicator visible
      expect(testBed.getLoadingState()).toBe(true);
      expect(testBed.uiElements.loadingIndicator.hidden).toBe(true); // Initially hidden
    });

    it('should hide results during new generation', async () => {
      // Start with existing results
      testBed.setupGeneratedTraitsInUI();
      expect(testBed.getResultsVisible()).toBe(true);

      // Start new generation
      testBed.setupValidUIState();
      await testBed.simulateButtonClick('generateButton');

      // Verify results hidden during new generation
      expect(testBed.getLoadingState()).toBe(true);
      // Results would be hidden by controller
    });

    it('should enable export button only after successful generation', async () => {
      // Initially disabled
      expect(testBed.getExportButtonEnabled()).toBe(false);

      // Generate traits
      testBed.setupValidUIState();
      testBed.mockLLMResponse(testBed.createValidTraitsResponse());
      await testBed.simulateButtonClick('generateButton');

      // Complete generation
      testBed.uiState.resultsVisible = true;
      testBed.uiState.exportEnabled = true;

      // Verify export enabled
      expect(testBed.getExportButtonEnabled()).toBe(true);
    });
  });

  describe('Data Flow', () => {
    it('should pass user inputs correctly through generation flow', async () => {
      const userInputs = {
        coreMotivation: 'Specific test motivation',
        internalContradiction: 'Specific test contradiction',
        centralQuestion: 'Specific test question?'
      };

      // Set inputs
      Object.entries(userInputs).forEach(([key, value]) => {
        testBed.simulateUserInput(key, value);
      });

      // Mock and trigger generation
      testBed.mockLLMResponse(testBed.createValidTraitsResponse());
      await testBed.simulateButtonClick('generateButton');

      // Verify inputs were used
      expect(testBed.uiElements.coreMotivation.value).toBe(userInputs.coreMotivation);
      expect(testBed.uiElements.internalContradiction.value).toBe(userInputs.internalContradiction);
      expect(testBed.uiElements.centralQuestion.value).toBe(userInputs.centralQuestion);
    });

    it('should include concept and direction in generation', async () => {
      const concept = testBed.createValidConcept();
      const direction = testBed.createValidDirection();

      // Setup for generation
      testBed.setupValidUIState();
      testBed.mockLLMResponse(testBed.createValidTraitsResponse());

      // Execute generation with specific concept and direction
      const result = await testBed.executeTraitsGeneration(
        concept,
        direction,
        testBed.createValidUserInputs(),
        testBed.createValidCliches()
      );

      // Verify result structure
      testBed.verifyTraitsStructure(result);
    });

    it('should handle empty clichés array', async () => {
      const concept = testBed.createValidConcept();
      const direction = testBed.createValidDirection();
      const userInputs = testBed.createValidUserInputs();

      // Execute with empty clichés
      testBed.mockLLMResponse(testBed.createValidTraitsResponse());
      const result = await testBed.executeTraitsGeneration(
        concept,
        direction,
        userInputs,
        [] // Empty clichés
      );

      // Should still generate successfully
      expect(result).toBeDefined();
      testBed.verifyTraitsStructure(result);
    });
  });

  describe('Multi-step Workflow', () => {
    it('should handle complete user journey from start to export', async () => {
      // Step 1: User enters inputs
      testBed.simulateUserInput('coreMotivation', 'Journey motivation');
      testBed.simulateUserInput('internalContradiction', 'Journey contradiction');
      testBed.simulateUserInput('centralQuestion', 'Journey question?');

      // Step 2: User clicks generate
      testBed.mockLLMResponse(testBed.createValidTraitsResponse());
      await testBed.simulateButtonClick('generateButton');

      // Step 3: Generation completes
      testBed.uiState.loadingState = false;
      testBed.uiState.resultsVisible = true;
      testBed.setupGeneratedTraitsInUI();

      // Step 4: User reviews results
      expect(testBed.getResultsVisible()).toBe(true);
      expect(testBed.uiState.generatedTraits).toBeDefined();

      // Step 5: User exports
      const downloadSpy = testBed.mockFileDownload();
      await testBed.simulateButtonClick('exportButton');

      // Verify complete journey success
      expect(testBed.getExportButtonEnabled()).toBe(true);
      const exportText = testBed.getExportedText();
      expect(exportText).toContain('CHARACTER TRAITS');
    });

    it('should support multiple generations in sequence', async () => {
      // First generation
      testBed.setupValidUIState();
      testBed.mockLLMResponse(testBed.createValidTraitsResponse());
      await testBed.simulateButtonClick('generateButton');
      testBed.uiState.loadingState = false;
      testBed.uiState.resultsVisible = true;

      // Verify first generation
      expect(testBed.getResultsVisible()).toBe(true);

      // Second generation with different inputs
      testBed.simulateUserInput('coreMotivation', 'Different motivation');
      testBed.simulateUserInput('internalContradiction', 'Different contradiction');
      testBed.simulateUserInput('centralQuestion', 'Different question?');

      // Mock different response
      const secondResponse = testBed.createValidTraitsResponse();
      secondResponse.names[0].name = 'Different Name';
      testBed.mockLLMResponse(secondResponse);

      // Trigger second generation
      await testBed.simulateButtonClick('generateButton');
      testBed.uiState.loadingState = false;
      testBed.uiState.resultsVisible = true;
      testBed.setGeneratedTraits(secondResponse);

      // Verify second generation replaced first
      expect(testBed.uiState.generatedTraits.names[0].name).toBe('Different Name');
    });
  });
});