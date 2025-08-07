# ACTTRA-014: ActionFormattingStage Integration

## Executive Summary

Enhance the ActionFormattingStage to capture comprehensive action formatting and template processing data when action tracing is enabled. This integration captures template selection, parameter substitution, formatting decisions, and output generation details while maintaining zero performance impact when action tracing is disabled.

## Technical Requirements

### Core Objectives
- Integrate action tracing into ActionFormattingStage without breaking existing functionality
- Capture template selection decisions and criteria
- Record parameter substitution and template processing steps
- Track formatting transformations and output generation
- Support both legacy and multi-target action formatting
- Maintain backward compatibility with existing formatting pipeline
- Ensure zero overhead when action tracing is disabled

### Performance Requirements
- No measurable performance impact when action tracing disabled
- Minimal overhead when tracing enabled (<5ms per action)
- Memory efficient trace data collection
- Thread-safe trace data capture

### Compatibility Requirements
- Maintain existing ActionFormattingStage interface
- Preserve current formatting behavior for non-traced actions
- Support all existing template types and formats
- Work with legacy and modern action definitions

## Architecture Design

### Class Enhancement Strategy

The ActionFormattingStage will be enhanced to detect action-aware traces and capture formatting-specific data:

```javascript
class ActionFormattingStage extends BasePipelineStage {
  constructor({ templateService, logger, eventBus }) {
    super({ logger, eventBus });
    this.templateService = templateService;
  }

  async executeInternal(context) {
    const { trace } = context;
    
    // Check if this is an action-aware trace
    const isActionTrace = trace instanceof ActionAwareStructuredTrace;
    
    if (isActionTrace) {
      return this.executeWithTracing(context);
    }
    
    // Standard execution path (unchanged)
    return this.executeStandard(context);
  }
}
```

### Trace Data Structure

The formatting stage will capture:

```javascript
const formattingData = {
  stage: 'formatting',
  timestamp: new Date().toISOString(),
  templateData: {
    selectedTemplate: templateId,
    selectionCriteria: criteria,
    availableTemplates: templateOptions,
    templateType: type
  },
  parameterData: {
    originalParameters: parameters,
    processedParameters: processed,
    substitutions: substitutionMap,
    transformations: transformationLog
  },
  outputData: {
    formattedOutput: output,
    outputType: type,
    formatting: formattingRules
  },
  performance: {
    templateSelectionTime: selectionMs,
    processingTime: processingMs,
    totalTime: totalMs
  }
};
```

## Implementation Steps

### Step 1: Enhance ActionFormattingStage Class

**File**: `src/actions/pipeline/stages/actionFormattingStage.js`

```javascript
/**
 * @file ActionFormattingStage with action tracing integration
 */

import { BasePipelineStage } from '../basePipelineStage.js';
import { ActionAwareStructuredTrace } from '../../tracing/actionAwareStructuredTrace.js';

class ActionFormattingStage extends BasePipelineStage {
  constructor({ templateService, logger, eventBus }) {
    super({ logger, eventBus });
    this.templateService = templateService;
  }

  async executeInternal(context) {
    const { trace } = context;
    
    // Check if this is an action-aware trace
    if (trace instanceof ActionAwareStructuredTrace) {
      return this.executeWithTracing(context);
    }
    
    // Standard execution path (unchanged for backward compatibility)
    return this.executeStandard(context);
  }

  async executeWithTracing(context) {
    const startTime = performance.now();
    const { trace, actions, targets } = context;
    
    try {
      // Capture initial state
      const initialData = {
        inputActions: actions?.length || 0,
        inputTargets: targets?.length || 0,
        tracingEnabled: true
      };
      
      trace.captureActionData('formatting', 'stage_start', initialData);
      
      // Execute formatting with detailed tracing
      const result = await this.formatActionsWithTracing(context, trace);
      
      // Capture final performance metrics
      const endTime = performance.now();
      const performanceData = {
        totalTime: endTime - startTime,
        actionsProcessed: result.formattedActions?.length || 0,
        success: true
      };
      
      trace.captureActionData('formatting', 'stage_complete', performanceData);
      
      return result;
      
    } catch (error) {
      const errorData = {
        error: error.message,
        stack: error.stack,
        context: 'formatting_stage',
        totalTime: performance.now() - startTime
      };
      
      trace.captureActionData('formatting', 'stage_error', errorData);
      throw error;
    }
  }

  async executeStandard(context) {
    // Existing implementation unchanged
    const { actions } = context;
    
    if (!actions || actions.length === 0) {
      return { formattedActions: [] };
    }
    
    const formattedActions = [];
    
    for (const action of actions) {
      try {
        const formatted = await this.formatSingleAction(action);
        formattedActions.push(formatted);
      } catch (error) {
        this.logger.error(`Error formatting action ${action.id}:`, error);
        // Continue with other actions
      }
    }
    
    return { formattedActions };
  }

  async formatActionsWithTracing(context, trace) {
    const { actions } = context;
    
    if (!actions || actions.length === 0) {
      trace.captureActionData('formatting', 'no_actions', {
        reason: 'empty_input',
        timestamp: new Date().toISOString()
      });
      return { formattedActions: [] };
    }
    
    const formattedActions = [];
    const processingStats = {
      total: actions.length,
      successful: 0,
      failed: 0,
      templateUsage: {}
    };
    
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      const actionStartTime = performance.now();
      
      try {
        // Capture action-level formatting start
        trace.captureActionData('formatting', 'action_start', {
          actionIndex: i,
          actionId: action.id,
          actionType: action.type || 'unknown',
          hasTemplate: !!action.template,
          timestamp: new Date().toISOString()
        });
        
        const formatted = await this.formatSingleActionWithTracing(action, trace, i);
        formattedActions.push(formatted);
        processingStats.successful++;
        
        // Update template usage statistics
        const templateId = formatted.templateUsed || 'default';
        processingStats.templateUsage[templateId] = (processingStats.templateUsage[templateId] || 0) + 1;
        
        // Capture successful action formatting
        const actionEndTime = performance.now();
        trace.captureActionData('formatting', 'action_complete', {
          actionIndex: i,
          actionId: action.id,
          templateUsed: templateId,
          processingTime: actionEndTime - actionStartTime,
          outputLength: formatted.formattedText?.length || 0,
          success: true
        });
        
      } catch (error) {
        processingStats.failed++;
        
        // Capture action formatting error
        trace.captureActionData('formatting', 'action_error', {
          actionIndex: i,
          actionId: action.id,
          error: error.message,
          processingTime: performance.now() - actionStartTime,
          success: false
        });
        
        this.logger.error(`Error formatting action ${action.id}:`, error);
        // Continue with other actions
      }
    }
    
    // Capture overall processing statistics
    trace.captureActionData('formatting', 'processing_summary', {
      statistics: processingStats,
      timestamp: new Date().toISOString()
    });
    
    return { formattedActions };
  }

  async formatSingleActionWithTracing(action, trace, actionIndex) {
    const formatStartTime = performance.now();
    
    // Capture template selection process
    const templateSelectionStart = performance.now();
    const selectedTemplate = await this.selectTemplateWithTracing(action, trace, actionIndex);
    const templateSelectionTime = performance.now() - templateSelectionStart;
    
    // Capture parameter processing
    const parameterProcessingStart = performance.now();
    const processedParameters = await this.processParametersWithTracing(action, trace, actionIndex);
    const parameterProcessingTime = performance.now() - parameterProcessingStart;
    
    // Capture output generation
    const outputGenerationStart = performance.now();
    const formattedOutput = await this.generateOutputWithTracing(
      selectedTemplate, 
      processedParameters, 
      action, 
      trace, 
      actionIndex
    );
    const outputGenerationTime = performance.now() - outputGenerationStart;
    
    // Capture comprehensive formatting data
    const totalFormatTime = performance.now() - formatStartTime;
    const formattingData = {
      actionId: action.id,
      actionIndex: actionIndex,
      templateData: {
        selectedTemplate: selectedTemplate.id,
        templateType: selectedTemplate.type,
        selectionReason: selectedTemplate.selectionReason
      },
      parameterData: {
        originalCount: Object.keys(action.parameters || {}).length,
        processedCount: Object.keys(processedParameters).length,
        transformations: processedParameters.transformationLog
      },
      outputData: {
        outputLength: formattedOutput.length,
        outputType: selectedTemplate.outputType
      },
      performance: {
        templateSelectionTime: templateSelectionTime,
        parameterProcessingTime: parameterProcessingTime,
        outputGenerationTime: outputGenerationTime,
        totalTime: totalFormatTime
      },
      timestamp: new Date().toISOString()
    };
    
    trace.captureActionData('formatting', 'detailed_formatting', formattingData);
    
    return {
      ...action,
      formattedText: formattedOutput,
      templateUsed: selectedTemplate.id,
      formatting: {
        templateId: selectedTemplate.id,
        processingTime: totalFormatTime,
        success: true
      }
    };
  }

  async selectTemplateWithTracing(action, trace, actionIndex) {
    const selectionCriteria = {
      actionType: action.type,
      hasCustomTemplate: !!action.template,
      context: action.context || 'default'
    };
    
    // Get available templates
    const availableTemplates = await this.templateService.getAvailableTemplates(action.type);
    
    // Perform template selection
    let selectedTemplate;
    let selectionReason;
    
    if (action.template) {
      // Custom template specified
      selectedTemplate = await this.templateService.getTemplate(action.template);
      selectionReason = 'custom_specified';
    } else {
      // Default template selection
      selectedTemplate = await this.templateService.getDefaultTemplate(action.type);
      selectionReason = 'default_for_type';
    }
    
    // Capture template selection data
    const templateSelectionData = {
      actionId: action.id,
      actionIndex: actionIndex,
      selectionCriteria: selectionCriteria,
      availableTemplates: availableTemplates.map(t => ({
        id: t.id,
        type: t.type,
        priority: t.priority
      })),
      selectedTemplate: {
        id: selectedTemplate.id,
        type: selectedTemplate.type,
        reason: selectionReason
      },
      timestamp: new Date().toISOString()
    };
    
    trace.captureActionData('formatting', 'template_selection', templateSelectionData);
    
    return {
      ...selectedTemplate,
      selectionReason: selectionReason
    };
  }

  async processParametersWithTracing(action, trace, actionIndex) {
    const originalParameters = action.parameters || {};
    const transformationLog = [];
    const processedParameters = { ...originalParameters };
    
    // Process each parameter with transformation tracking
    for (const [key, value] of Object.entries(originalParameters)) {
      const originalValue = value;
      let processedValue = value;
      
      // Apply parameter transformations
      if (typeof value === 'string') {
        // String processing transformations
        if (value.includes('${')) {
          processedValue = await this.processTemplateVariables(value, action);
          transformationLog.push({
            parameter: key,
            transformation: 'template_variable_substitution',
            original: originalValue,
            processed: processedValue
          });
        }
        
        if (value.toLowerCase() !== value && this.shouldNormalize(action.type)) {
          processedValue = processedValue.toLowerCase();
          transformationLog.push({
            parameter: key,
            transformation: 'case_normalization',
            original: originalValue,
            processed: processedValue
          });
        }
      }
      
      processedParameters[key] = processedValue;
    }
    
    // Add transformation log to processed parameters
    processedParameters.transformationLog = transformationLog;
    
    // Capture parameter processing data
    const parameterData = {
      actionId: action.id,
      actionIndex: actionIndex,
      originalParameters: originalParameters,
      processedParameters: processedParameters,
      transformations: transformationLog,
      transformationCount: transformationLog.length,
      timestamp: new Date().toISOString()
    };
    
    trace.captureActionData('formatting', 'parameter_processing', parameterData);
    
    return processedParameters;
  }

  async generateOutputWithTracing(template, parameters, action, trace, actionIndex) {
    const generationStartTime = performance.now();
    
    // Generate formatted output
    const formattedOutput = await this.templateService.renderTemplate(
      template.id,
      parameters,
      action.context
    );
    
    const generationTime = performance.now() - generationStartTime;
    
    // Capture output generation data
    const outputData = {
      actionId: action.id,
      actionIndex: actionIndex,
      templateId: template.id,
      parameterCount: Object.keys(parameters).length,
      output: {
        length: formattedOutput.length,
        type: template.outputType || 'text',
        preview: formattedOutput.substring(0, 100) + (formattedOutput.length > 100 ? '...' : '')
      },
      performance: {
        generationTime: generationTime,
        charactersPerMs: formattedOutput.length / generationTime
      },
      timestamp: new Date().toISOString()
    };
    
    trace.captureActionData('formatting', 'output_generation', outputData);
    
    return formattedOutput;
  }

  async formatSingleAction(action) {
    // Existing implementation for non-traced formatting
    const template = action.template 
      ? await this.templateService.getTemplate(action.template)
      : await this.templateService.getDefaultTemplate(action.type);
    
    const parameters = action.parameters || {};
    
    const formattedText = await this.templateService.renderTemplate(
      template.id,
      parameters,
      action.context
    );
    
    return {
      ...action,
      formattedText: formattedText,
      templateUsed: template.id
    };
  }

  async processTemplateVariables(value, action) {
    // Template variable processing implementation
    return value.replace(/\$\{([^}]+)\}/g, (match, variable) => {
      return action.context?.[variable] || match;
    });
  }

  shouldNormalize(actionType) {
    // Determine if case normalization should be applied
    return ['dialogue', 'narrative'].includes(actionType);
  }
}

export default ActionFormattingStage;
```

### Step 2: Update ActionFormattingStage Tests

**File**: `tests/unit/actions/pipeline/stages/actionFormattingStage.test.js`

```javascript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ActionFormattingStage from '../../../../../src/actions/pipeline/stages/actionFormattingStage.js';
import { ActionAwareStructuredTrace } from '../../../../../src/actions/tracing/actionAwareStructuredTrace.js';
import { StructuredTrace } from '../../../../../src/tracing/structuredTrace.js';

describe('ActionFormattingStage - Action Tracing', () => {
  let stage;
  let mockTemplateService;
  let mockLogger;
  let mockEventBus;

  beforeEach(() => {
    mockTemplateService = {
      getAvailableTemplates: jest.fn(),
      getTemplate: jest.fn(),
      getDefaultTemplate: jest.fn(),
      renderTemplate: jest.fn()
    };
    
    mockLogger = {
      error: jest.fn(),
      info: jest.fn(),
      debug: jest.fn()
    };
    
    mockEventBus = {
      dispatch: jest.fn()
    };

    stage = new ActionFormattingStage({
      templateService: mockTemplateService,
      logger: mockLogger,
      eventBus: mockEventBus
    });
  });

  describe('Action-Aware Trace Integration', () => {
    it('should detect action-aware traces and use tracing execution path', async () => {
      const trace = new ActionAwareStructuredTrace({ 
        traceId: 'test-trace',
        verbosity: 'detailed' 
      });
      const context = {
        trace,
        actions: [{
          id: 'test-action',
          type: 'dialogue',
          parameters: { text: 'Hello world' }
        }]
      };

      mockTemplateService.getDefaultTemplate.mockResolvedValue({
        id: 'dialogue-default',
        type: 'dialogue',
        outputType: 'text'
      });
      
      mockTemplateService.renderTemplate.mockResolvedValue('Formatted: Hello world');

      const result = await stage.executeInternal(context);

      expect(result.formattedActions).toHaveLength(1);
      expect(result.formattedActions[0].formattedText).toBe('Formatted: Hello world');
      expect(trace.getActionData().formatting).toBeDefined();
    });

    it('should use standard execution for regular traces', async () => {
      const trace = new StructuredTrace({ traceId: 'regular-trace' });
      const context = {
        trace,
        actions: [{
          id: 'test-action',
          type: 'dialogue',
          parameters: { text: 'Hello world' }
        }]
      };

      mockTemplateService.getDefaultTemplate.mockResolvedValue({
        id: 'dialogue-default',
        type: 'dialogue'
      });
      
      mockTemplateService.renderTemplate.mockResolvedValue('Formatted: Hello world');

      const result = await stage.executeInternal(context);

      expect(result.formattedActions).toHaveLength(1);
      expect(result.formattedActions[0].formattedText).toBe('Formatted: Hello world');
    });

    it('should capture comprehensive template selection data', async () => {
      const trace = new ActionAwareStructuredTrace({ 
        traceId: 'test-trace',
        verbosity: 'detailed' 
      });
      const context = {
        trace,
        actions: [{
          id: 'test-action',
          type: 'dialogue',
          template: 'custom-template',
          parameters: { text: 'Hello world' }
        }]
      };

      mockTemplateService.getAvailableTemplates.mockResolvedValue([
        { id: 'dialogue-default', type: 'dialogue', priority: 1 },
        { id: 'custom-template', type: 'dialogue', priority: 2 }
      ]);
      
      mockTemplateService.getTemplate.mockResolvedValue({
        id: 'custom-template',
        type: 'dialogue',
        outputType: 'text'
      });
      
      mockTemplateService.renderTemplate.mockResolvedValue('Custom: Hello world');

      await stage.executeInternal(context);

      const actionData = trace.getActionData();
      const templateSelection = actionData.formatting.template_selection[0];
      
      expect(templateSelection.selectedTemplate.id).toBe('custom-template');
      expect(templateSelection.selectedTemplate.reason).toBe('custom_specified');
      expect(templateSelection.availableTemplates).toHaveLength(2);
    });

    it('should capture parameter processing transformations', async () => {
      const trace = new ActionAwareStructuredTrace({ 
        traceId: 'test-trace',
        verbosity: 'detailed' 
      });
      const context = {
        trace,
        actions: [{
          id: 'test-action',
          type: 'dialogue',
          parameters: { 
            text: 'HELLO WORLD',
            template_var: '${character_name}'
          },
          context: { character_name: 'Alice' }
        }]
      };

      mockTemplateService.getDefaultTemplate.mockResolvedValue({
        id: 'dialogue-default',
        type: 'dialogue',
        outputType: 'text'
      });
      
      mockTemplateService.renderTemplate.mockResolvedValue('Processed text');

      await stage.executeInternal(context);

      const actionData = trace.getActionData();
      const parameterProcessing = actionData.formatting.parameter_processing[0];
      
      expect(parameterProcessing.transformations).toHaveLength(2);
      expect(parameterProcessing.transformations[0].transformation).toBe('template_variable_substitution');
      expect(parameterProcessing.transformations[1].transformation).toBe('case_normalization');
    });

    it('should capture output generation metrics', async () => {
      const trace = new ActionAwareStructuredTrace({ 
        traceId: 'test-trace',
        verbosity: 'detailed' 
      });
      const context = {
        trace,
        actions: [{
          id: 'test-action',
          type: 'dialogue',
          parameters: { text: 'Hello world' }
        }]
      };

      const outputText = 'This is a longer formatted output text for testing metrics';
      
      mockTemplateService.getDefaultTemplate.mockResolvedValue({
        id: 'dialogue-default',
        type: 'dialogue',
        outputType: 'text'
      });
      
      mockTemplateService.renderTemplate.mockResolvedValue(outputText);

      await stage.executeInternal(context);

      const actionData = trace.getActionData();
      const outputGeneration = actionData.formatting.output_generation[0];
      
      expect(outputGeneration.output.length).toBe(outputText.length);
      expect(outputGeneration.output.type).toBe('text');
      expect(outputGeneration.performance.charactersPerMs).toBeGreaterThan(0);
    });

    it('should capture error details when formatting fails', async () => {
      const trace = new ActionAwareStructuredTrace({ 
        traceId: 'test-trace',
        verbosity: 'detailed' 
      });
      const context = {
        trace,
        actions: [{
          id: 'test-action',
          type: 'dialogue',
          parameters: { text: 'Hello world' }
        }]
      };

      mockTemplateService.getDefaultTemplate.mockRejectedValue(
        new Error('Template not found')
      );

      await stage.executeInternal(context);

      const actionData = trace.getActionData();
      const actionError = actionData.formatting.action_error[0];
      
      expect(actionError.error).toBe('Template not found');
      expect(actionError.success).toBe(false);
      expect(actionError.actionId).toBe('test-action');
    });

    it('should maintain processing statistics across multiple actions', async () => {
      const trace = new ActionAwareStructuredTrace({ 
        traceId: 'test-trace',
        verbosity: 'detailed' 
      });
      const context = {
        trace,
        actions: [
          { id: 'action-1', type: 'dialogue', parameters: { text: 'Hello' } },
          { id: 'action-2', type: 'narrative', parameters: { text: 'World' } },
          { id: 'action-3', type: 'dialogue', parameters: { text: 'Again' } }
        ]
      };

      mockTemplateService.getDefaultTemplate.mockImplementation((type) => {
        return Promise.resolve({
          id: `${type}-default`,
          type: type,
          outputType: 'text'
        });
      });
      
      mockTemplateService.renderTemplate.mockImplementation((templateId) => {
        return Promise.resolve(`Formatted with ${templateId}`);
      });

      await stage.executeInternal(context);

      const actionData = trace.getActionData();
      const processingSummary = actionData.formatting.processing_summary[0];
      
      expect(processingSummary.statistics.total).toBe(3);
      expect(processingSummary.statistics.successful).toBe(3);
      expect(processingSummary.statistics.failed).toBe(0);
      expect(processingSummary.statistics.templateUsage['dialogue-default']).toBe(2);
      expect(processingSummary.statistics.templateUsage['narrative-default']).toBe(1);
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain existing behavior for non-traced execution', async () => {
      const trace = new StructuredTrace({ traceId: 'regular-trace' });
      const context = {
        trace,
        actions: [{
          id: 'test-action',
          type: 'dialogue',
          parameters: { text: 'Hello world' }
        }]
      };

      mockTemplateService.getDefaultTemplate.mockResolvedValue({
        id: 'dialogue-default',
        type: 'dialogue'
      });
      
      mockTemplateService.renderTemplate.mockResolvedValue('Hello world');

      const result = await stage.executeInternal(context);

      expect(result.formattedActions).toHaveLength(1);
      expect(result.formattedActions[0]).toEqual({
        id: 'test-action',
        type: 'dialogue',
        parameters: { text: 'Hello world' },
        formattedText: 'Hello world',
        templateUsed: 'dialogue-default'
      });
    });

    it('should handle empty action arrays gracefully', async () => {
      const trace = new ActionAwareStructuredTrace({ 
        traceId: 'test-trace',
        verbosity: 'detailed' 
      });
      const context = { trace, actions: [] };

      const result = await stage.executeInternal(context);

      expect(result.formattedActions).toEqual([]);
      
      const actionData = trace.getActionData();
      expect(actionData.formatting.no_actions).toBeDefined();
      expect(actionData.formatting.no_actions[0].reason).toBe('empty_input');
    });
  });

  describe('Performance Impact', () => {
    it('should have no performance impact when tracing is disabled', async () => {
      const trace = new StructuredTrace({ traceId: 'regular-trace' });
      const context = {
        trace,
        actions: Array(100).fill().map((_, i) => ({
          id: `action-${i}`,
          type: 'dialogue',
          parameters: { text: `Text ${i}` }
        }))
      };

      mockTemplateService.getDefaultTemplate.mockResolvedValue({
        id: 'dialogue-default',
        type: 'dialogue'
      });
      
      mockTemplateService.renderTemplate.mockImplementation((_, params) => 
        Promise.resolve(`Formatted: ${params.text}`)
      );

      const startTime = performance.now();
      await stage.executeInternal(context);
      const endTime = performance.now();
      const executionTime = endTime - startTime;

      expect(executionTime).toBeLessThan(1000); // Should complete within 1 second
      expect(mockTemplateService.getDefaultTemplate).toHaveBeenCalledTimes(100);
    });
  });
});
```

### Step 3: Integration Testing

**File**: `tests/integration/actions/pipeline/actionFormattingStageIntegration.test.js`

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { TestBed } from '../../../common/testbed.js';
import ActionFormattingStage from '../../../../src/actions/pipeline/stages/actionFormattingStage.js';
import { ActionAwareStructuredTrace } from '../../../../src/actions/tracing/actionAwareStructuredTrace.js';

describe('ActionFormattingStage - Integration', () => {
  let testBed;
  let formattingStage;

  beforeEach(() => {
    testBed = new TestBed();
    testBed.setupActionSystem();
    
    formattingStage = testBed.container.resolve('IActionFormattingStage');
  });

  it('should integrate action tracing into complete formatting workflow', async () => {
    const trace = new ActionAwareStructuredTrace({
      traceId: 'integration-test',
      verbosity: 'detailed'
    });

    const context = {
      trace,
      actions: [
        {
          id: 'dialogue-action',
          type: 'dialogue',
          parameters: {
            character: 'Alice',
            text: 'Hello, ${target_name}!',
            emotion: 'friendly'
          },
          context: {
            target_name: 'Bob'
          }
        },
        {
          id: 'narrative-action',
          type: 'narrative',
          parameters: {
            scene: 'forest',
            description: 'The trees rustle in the wind'
          }
        }
      ]
    };

    const result = await formattingStage.executeInternal(context);

    expect(result.formattedActions).toHaveLength(2);
    
    // Verify trace data was captured
    const traceData = trace.getActionData();
    expect(traceData.formatting).toBeDefined();
    expect(traceData.formatting.stage_start).toBeDefined();
    expect(traceData.formatting.template_selection).toHaveLength(2);
    expect(traceData.formatting.parameter_processing).toHaveLength(2);
    expect(traceData.formatting.output_generation).toHaveLength(2);
    expect(traceData.formatting.processing_summary).toBeDefined();
    expect(traceData.formatting.stage_complete).toBeDefined();
  });
});
```

## Testing Requirements

### Unit Tests Required
- [ ] ActionFormattingStage trace detection logic
- [ ] Template selection with tracing
- [ ] Parameter processing with transformation logging
- [ ] Output generation with metrics capture
- [ ] Error handling and trace capture
- [ ] Processing statistics aggregation
- [ ] Backward compatibility with regular traces
- [ ] Performance impact validation

### Integration Tests Required
- [ ] End-to-end formatting pipeline with action tracing
- [ ] Template service integration with trace capture
- [ ] Multiple action formatting with comprehensive data
- [ ] Error scenarios with trace preservation
- [ ] Performance benchmarking with/without tracing

### Performance Tests Required
- [ ] Baseline performance measurement without tracing
- [ ] Performance impact assessment with tracing enabled
- [ ] Memory usage analysis for trace data collection
- [ ] Scalability testing with large action sets

## Acceptance Criteria

### Functional Requirements
- [ ] ActionFormattingStage detects ActionAwareStructuredTrace instances
- [ ] Template selection process is fully traced with criteria and options
- [ ] Parameter processing captures all transformations and substitutions
- [ ] Output generation metrics are recorded with timing data
- [ ] Processing statistics are maintained across all actions
- [ ] Error scenarios are captured with full context
- [ ] Backward compatibility maintained for regular traces

### Performance Requirements
- [ ] Zero measurable performance impact when tracing disabled
- [ ] <5ms overhead per action when tracing enabled
- [ ] Memory efficient trace data collection
- [ ] Thread-safe trace operations

### Quality Requirements
- [ ] 80% test coverage for new functionality
- [ ] All existing tests continue to pass
- [ ] No breaking changes to existing formatting pipeline
- [ ] Comprehensive error handling and logging

### Documentation Requirements
- [ ] JSDoc comments for all new methods
- [ ] Integration examples in test files
- [ ] Performance impact documentation

## Dependencies

### Prerequisite Tickets
- ACTTRA-009: ActionAwareStructuredTrace class (Foundation)
- ACTTRA-010: ActionDiscoveryService enhancement (Service Integration)
- ACTTRA-011: ComponentFilteringStage integration (Pipeline Precedent)

### Related Systems
- Template Service integration for template data capture
- Event bus for error event dispatching
- Logger for diagnostic information
- Action pipeline for context flow

### External Dependencies
- ActionAwareStructuredTrace implementation
- BasePipelineStage framework
- Template service interfaces

## Effort Estimation

**Total Effort: 16 hours**

- Implementation: 8 hours
- Unit Tests: 4 hours  
- Integration Tests: 2 hours
- Performance Testing: 1 hour
- Documentation: 1 hour

## Implementation Notes

### Performance Considerations
- Trace data collection optimized for minimal overhead
- Template selection tracing reuses existing service calls
- Parameter processing transformations logged incrementally
- Output generation metrics calculated using high-resolution timing

### Error Handling Strategy
- All formatting errors captured in trace data
- Graceful degradation when template service fails
- Comprehensive error context preservation
- Event-driven error reporting for monitoring

### Backward Compatibility
- Regular StructuredTrace instances bypass tracing logic
- Existing formatting behavior unchanged
- No modifications to public interfaces
- Template service integration remains transparent

This ticket provides comprehensive integration of action tracing into the ActionFormattingStage, capturing detailed template selection, parameter processing, and output generation data while maintaining full backward compatibility and performance standards.