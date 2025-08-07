# ACTTRA-015: Legacy Action Support

## Executive Summary

Implement comprehensive legacy action support within the action tracing system, ensuring that older action definitions, legacy pipeline stages, and backward compatibility scenarios are fully supported with appropriate trace data collection. This ticket addresses the seamless integration of legacy action patterns while maintaining modern tracing capabilities.

## Technical Requirements

### Core Objectives
- Support legacy action definition formats in tracing system
- Maintain backward compatibility for deprecated action properties
- Handle legacy pipeline stage interactions with modern tracing
- Provide meaningful trace data for legacy action workflows
- Ensure seamless migration path from legacy to modern actions
- Maintain performance standards for legacy action processing

### Performance Requirements
- Zero performance degradation for legacy action processing
- Efficient trace data collection for legacy formats
- Optimal memory usage for legacy action data structures
- Thread-safe legacy action trace operations

### Compatibility Requirements
- Support all legacy action definition schemas
- Maintain compatibility with deprecated action properties
- Work with legacy pipeline stages and modern tracing
- Preserve existing legacy action behavior

## Architecture Design

### Legacy Action Support Strategy

The legacy action support will be implemented through specialized handlers and adapters:

```javascript
class LegacyActionTraceAdapter {
  constructor({ schemaValidator, logger }) {
    this.schemaValidator = schemaValidator;
    this.logger = logger;
    this.legacyPatterns = new Map();
    this.initializeLegacyPatterns();
  }

  adaptLegacyAction(action, trace) {
    const legacyType = this.detectLegacyType(action);
    const adapter = this.legacyPatterns.get(legacyType);
    
    if (adapter) {
      return adapter.adapt(action, trace);
    }
    
    return this.defaultLegacyAdapter(action, trace);
  }
}
```

### Legacy Action Types

The system will support the following legacy action patterns:

```javascript
const LEGACY_ACTION_TYPES = {
  // Pre-v2.0 action format
  SIMPLE_ACTION: {
    pattern: { id: 'string', text: 'string' },
    modernEquivalent: 'narrative',
    traceAdapter: 'SimpleActionAdapter'
  },
  
  // Pre-v3.0 dialogue format
  LEGACY_DIALOGUE: {
    pattern: { speaker: 'string', message: 'string', target: 'string' },
    modernEquivalent: 'dialogue',
    traceAdapter: 'LegacyDialogueAdapter'
  },
  
  // Deprecated choice format
  OLD_CHOICE: {
    pattern: { options: 'array', prompt: 'string' },
    modernEquivalent: 'choice',
    traceAdapter: 'OldChoiceAdapter'
  },
  
  // Legacy parameter format
  PARAM_ACTION: {
    pattern: { params: 'object' },
    modernEquivalent: 'parameterized',
    traceAdapter: 'ParamActionAdapter'
  }
};
```

## Implementation Steps

### Step 1: Create Legacy Action Detection System

**File**: `src/actions/tracing/legacy/legacyActionDetector.js`

```javascript
/**
 * @file Legacy action pattern detection and classification
 */

import { validateDependency } from '../../../utils/validationUtils.js';

class LegacyActionDetector {
  constructor({ schemaValidator, logger }) {
    validateDependency(schemaValidator, 'ISchemaValidator');
    validateDependency(logger, 'ILogger');
    
    this.schemaValidator = schemaValidator;
    this.logger = logger;
    this.legacyPatterns = this.initializeLegacyPatterns();
  }

  initializeLegacyPatterns() {
    return new Map([
      // Pre-v2.0 simple action format
      ['simple_action', {
        detect: (action) => {
          return action.text && !action.type && !action.parameters && !action.components;
        },
        schema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            text: { type: 'string' }
          },
          required: ['id', 'text'],
          additionalProperties: false
        },
        modernEquivalent: 'narrative',
        priority: 10
      }],

      // Pre-v3.0 dialogue format
      ['legacy_dialogue', {
        detect: (action) => {
          return action.speaker && action.message && !action.parameters?.character;
        },
        schema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            speaker: { type: 'string' },
            message: { type: 'string' },
            target: { type: 'string' }
          },
          required: ['id', 'speaker', 'message']
        },
        modernEquivalent: 'dialogue',
        priority: 20
      }],

      // Deprecated choice format
      ['old_choice', {
        detect: (action) => {
          return action.options && Array.isArray(action.options) && !action.type;
        },
        schema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            prompt: { type: 'string' },
            options: {
              type: 'array',
              items: { type: 'string' }
            }
          },
          required: ['id', 'options']
        },
        modernEquivalent: 'choice',
        priority: 15
      }],

      // Legacy parameter format (params instead of parameters)
      ['param_action', {
        detect: (action) => {
          return action.params && typeof action.params === 'object' && !action.parameters;
        },
        schema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            type: { type: 'string' },
            params: { type: 'object' }
          },
          required: ['id', 'type', 'params']
        },
        modernEquivalent: null, // Dynamic based on type
        priority: 5
      }],

      // Legacy component format
      ['component_action', {
        detect: (action) => {
          return action.component && !action.components;
        },
        schema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            component: { type: 'string' },
            data: { type: 'object' }
          },
          required: ['id', 'component']
        },
        modernEquivalent: 'component',
        priority: 8
      }]
    ]);
  }

  detectLegacyType(action) {
    if (!action || typeof action !== 'object') {
      return null;
    }

    // Check for modern action first
    if (this.isModernAction(action)) {
      return null;
    }

    // Find matching legacy pattern
    let bestMatch = null;
    let highestPriority = -1;

    for (const [type, pattern] of this.legacyPatterns.entries()) {
      if (pattern.detect(action) && pattern.priority > highestPriority) {
        bestMatch = type;
        highestPriority = pattern.priority;
      }
    }

    return bestMatch;
  }

  isModernAction(action) {
    // Modern actions have explicit type and use 'parameters' not 'params'
    return action.type && 
           (action.parameters || !action.params) &&
           (action.components || !action.component);
  }

  validateLegacyAction(action, legacyType) {
    const pattern = this.legacyPatterns.get(legacyType);
    if (!pattern) {
      throw new Error(`Unknown legacy action type: ${legacyType}`);
    }

    const isValid = this.schemaValidator.validate(pattern.schema, action);
    
    if (!isValid) {
      const errors = this.schemaValidator.getErrors();
      this.logger.warn(`Legacy action validation failed for type ${legacyType}:`, {
        action: action,
        errors: errors
      });
      return false;
    }

    return true;
  }

  getLegacyPattern(legacyType) {
    return this.legacyPatterns.get(legacyType);
  }

  getAllLegacyPatterns() {
    return Array.from(this.legacyPatterns.entries()).map(([type, pattern]) => ({
      type,
      modernEquivalent: pattern.modernEquivalent,
      priority: pattern.priority
    }));
  }
}

export default LegacyActionDetector;
```

### Step 2: Create Legacy Action Adapters

**File**: `src/actions/tracing/legacy/legacyActionAdapters.js`

```javascript
/**
 * @file Legacy action adapters for trace data conversion
 */

import { validateDependency } from '../../../utils/validationUtils.js';

class BaseLegacyAdapter {
  constructor({ logger }) {
    validateDependency(logger, 'ILogger');
    this.logger = logger;
  }

  adapt(action, trace) {
    throw new Error('Subclasses must implement adapt method');
  }

  createLegacyTraceData(action, legacyType, modernEquivalent, adaptationDetails) {
    return {
      legacyType: legacyType,
      modernEquivalent: modernEquivalent,
      originalAction: this.sanitizeActionForTrace(action),
      adaptationDetails: adaptationDetails,
      timestamp: new Date().toISOString()
    };
  }

  sanitizeActionForTrace(action) {
    // Remove potentially sensitive or large data for trace
    const sanitized = { ...action };
    
    // Limit string lengths for trace data
    Object.keys(sanitized).forEach(key => {
      if (typeof sanitized[key] === 'string' && sanitized[key].length > 1000) {
        sanitized[key] = sanitized[key].substring(0, 997) + '...';
      }
    });
    
    return sanitized;
  }
}

class SimpleActionAdapter extends BaseLegacyAdapter {
  adapt(action, trace) {
    const adaptationDetails = {
      originalFormat: 'simple_action',
      conversions: [
        {
          field: 'text',
          conversion: 'text → parameters.text',
          originalValue: action.text
        }
      ],
      modernAction: {
        id: action.id,
        type: 'narrative',
        parameters: {
          text: action.text
        }
      }
    };

    const traceData = this.createLegacyTraceData(
      action, 
      'simple_action', 
      'narrative', 
      adaptationDetails
    );

    trace.captureActionData('legacy', 'simple_action_adaptation', traceData);

    return adaptationDetails.modernAction;
  }
}

class LegacyDialogueAdapter extends BaseLegacyAdapter {
  adapt(action, trace) {
    const adaptationDetails = {
      originalFormat: 'legacy_dialogue',
      conversions: [
        {
          field: 'speaker',
          conversion: 'speaker → parameters.character',
          originalValue: action.speaker
        },
        {
          field: 'message',
          conversion: 'message → parameters.text',
          originalValue: action.message
        }
      ],
      modernAction: {
        id: action.id,
        type: 'dialogue',
        parameters: {
          character: action.speaker,
          text: action.message,
          target: action.target || undefined
        }
      }
    };

    // Add target if present
    if (action.target) {
      adaptationDetails.conversions.push({
        field: 'target',
        conversion: 'target → parameters.target',
        originalValue: action.target
      });
    }

    const traceData = this.createLegacyTraceData(
      action, 
      'legacy_dialogue', 
      'dialogue', 
      adaptationDetails
    );

    trace.captureActionData('legacy', 'legacy_dialogue_adaptation', traceData);

    return adaptationDetails.modernAction;
  }
}

class OldChoiceAdapter extends BaseLegacyAdapter {
  adapt(action, trace) {
    const adaptationDetails = {
      originalFormat: 'old_choice',
      conversions: [
        {
          field: 'options',
          conversion: 'options → parameters.choices',
          originalValue: action.options,
          transformation: 'array of strings → array of choice objects'
        }
      ],
      modernAction: {
        id: action.id,
        type: 'choice',
        parameters: {
          prompt: action.prompt || 'Choose an option:',
          choices: action.options.map((option, index) => ({
            id: `choice_${index}`,
            text: option,
            value: option
          }))
        }
      }
    };

    if (action.prompt) {
      adaptationDetails.conversions.push({
        field: 'prompt',
        conversion: 'prompt → parameters.prompt',
        originalValue: action.prompt
      });
    }

    const traceData = this.createLegacyTraceData(
      action, 
      'old_choice', 
      'choice', 
      adaptationDetails
    );

    trace.captureActionData('legacy', 'old_choice_adaptation', traceData);

    return adaptationDetails.modernAction;
  }
}

class ParamActionAdapter extends BaseLegacyAdapter {
  adapt(action, trace) {
    const adaptationDetails = {
      originalFormat: 'param_action',
      conversions: [
        {
          field: 'params',
          conversion: 'params → parameters',
          originalValue: action.params,
          transformation: 'renamed parameter object'
        }
      ],
      modernAction: {
        id: action.id,
        type: action.type,
        parameters: { ...action.params }
      }
    };

    const traceData = this.createLegacyTraceData(
      action, 
      'param_action', 
      action.type, 
      adaptationDetails
    );

    trace.captureActionData('legacy', 'param_action_adaptation', traceData);

    return adaptationDetails.modernAction;
  }
}

class ComponentActionAdapter extends BaseLegacyAdapter {
  adapt(action, trace) {
    const adaptationDetails = {
      originalFormat: 'component_action',
      conversions: [
        {
          field: 'component',
          conversion: 'component → components[0]',
          originalValue: action.component
        }
      ],
      modernAction: {
        id: action.id,
        type: 'component',
        components: [action.component],
        parameters: action.data || {}
      }
    };

    if (action.data) {
      adaptationDetails.conversions.push({
        field: 'data',
        conversion: 'data → parameters',
        originalValue: action.data
      });
    }

    const traceData = this.createLegacyTraceData(
      action, 
      'component_action', 
      'component', 
      adaptationDetails
    );

    trace.captureActionData('legacy', 'component_action_adaptation', traceData);

    return adaptationDetails.modernAction;
  }
}

class LegacyAdapterFactory {
  constructor({ logger }) {
    validateDependency(logger, 'ILogger');
    this.logger = logger;
    this.adapters = this.createAdapters();
  }

  createAdapters() {
    const adapterOptions = { logger: this.logger };
    
    return new Map([
      ['simple_action', new SimpleActionAdapter(adapterOptions)],
      ['legacy_dialogue', new LegacyDialogueAdapter(adapterOptions)],
      ['old_choice', new OldChoiceAdapter(adapterOptions)],
      ['param_action', new ParamActionAdapter(adapterOptions)],
      ['component_action', new ComponentActionAdapter(adapterOptions)]
    ]);
  }

  getAdapter(legacyType) {
    return this.adapters.get(legacyType);
  }

  hasAdapter(legacyType) {
    return this.adapters.has(legacyType);
  }

  getAllAdapterTypes() {
    return Array.from(this.adapters.keys());
  }
}

export {
  BaseLegacyAdapter,
  SimpleActionAdapter,
  LegacyDialogueAdapter,
  OldChoiceAdapter,
  ParamActionAdapter,
  ComponentActionAdapter,
  LegacyAdapterFactory
};
```

### Step 3: Integrate Legacy Support into ActionAwareStructuredTrace

**File**: `src/actions/tracing/actionAwareStructuredTrace.js` (Enhancement)

```javascript
/**
 * Enhanced ActionAwareStructuredTrace with legacy action support
 */

import { StructuredTrace } from '../../tracing/structuredTrace.js';
import { validateDependency, assertNonBlankString } from '../../utils/validationUtils.js';
import LegacyActionDetector from './legacy/legacyActionDetector.js';
import { LegacyAdapterFactory } from './legacy/legacyActionAdapters.js';

class ActionAwareStructuredTrace extends StructuredTrace {
  constructor({ 
    traceId, 
    verbosity = 'basic',
    schemaValidator,
    logger 
  }) {
    super({ traceId });
    
    assertNonBlankString(verbosity, 'Verbosity level');
    validateDependency(schemaValidator, 'ISchemaValidator');
    validateDependency(logger, 'ILogger');
    
    this.verbosity = verbosity;
    this.actionData = {};
    
    // Initialize legacy support
    this.legacyDetector = new LegacyActionDetector({ schemaValidator, logger });
    this.legacyAdapterFactory = new LegacyAdapterFactory({ logger });
    
    this.logger = logger;
  }

  processActionForTracing(action) {
    // Detect if this is a legacy action
    const legacyType = this.legacyDetector.detectLegacyType(action);
    
    if (legacyType) {
      return this.processLegacyAction(action, legacyType);
    }
    
    // Process as modern action
    return this.processModernAction(action);
  }

  processLegacyAction(action, legacyType) {
    // Validate legacy action format
    const isValid = this.legacyDetector.validateLegacyAction(action, legacyType);
    
    if (!isValid) {
      this.captureActionData('legacy', 'validation_failed', {
        legacyType: legacyType,
        action: action,
        timestamp: new Date().toISOString()
      });
      
      // Return action as-is for processing
      return action;
    }

    // Get appropriate adapter
    const adapter = this.legacyAdapterFactory.getAdapter(legacyType);
    
    if (!adapter) {
      this.captureActionData('legacy', 'no_adapter', {
        legacyType: legacyType,
        action: action,
        timestamp: new Date().toISOString()
      });
      
      return action;
    }

    // Adapt legacy action to modern format
    const modernAction = adapter.adapt(action, this);
    
    // Capture conversion success
    this.captureActionData('legacy', 'conversion_success', {
      legacyType: legacyType,
      originalActionId: action.id,
      modernActionId: modernAction.id,
      modernType: modernAction.type,
      timestamp: new Date().toISOString()
    });

    return modernAction;
  }

  processModernAction(action) {
    // Standard modern action processing
    this.captureActionData('processing', 'modern_action', {
      actionId: action.id,
      actionType: action.type,
      hasParameters: !!action.parameters,
      hasComponents: !!action.components,
      timestamp: new Date().toISOString()
    });

    return action;
  }

  getLegacyActionData() {
    return this.actionData.legacy || {};
  }

  getLegacyConversionSummary() {
    const legacyData = this.getLegacyActionData();
    
    const conversions = {};
    const failures = {};
    
    Object.keys(legacyData).forEach(category => {
      if (category.endsWith('_adaptation')) {
        const legacyType = category.replace('_adaptation', '');
        conversions[legacyType] = legacyData[category].length;
      } else if (category === 'validation_failed') {
        legacyData[category].forEach(failure => {
          const legacyType = failure.legacyType;
          failures[legacyType] = (failures[legacyType] || 0) + 1;
        });
      }
    });

    return {
      conversions: conversions,
      failures: failures,
      totalConversions: Object.values(conversions).reduce((sum, count) => sum + count, 0),
      totalFailures: Object.values(failures).reduce((sum, count) => sum + count, 0)
    };
  }

  // Legacy-specific helper methods
  captureLegacyPerformanceMetrics(legacyType, metrics) {
    this.captureActionData('legacy', 'performance_metrics', {
      legacyType: legacyType,
      metrics: metrics,
      timestamp: new Date().toISOString()
    });
  }

  captureLegacyCompatibilityInfo(legacyType, compatibilityData) {
    this.captureActionData('legacy', 'compatibility_info', {
      legacyType: legacyType,
      compatibility: compatibilityData,
      timestamp: new Date().toISOString()
    });
  }

  // Override captureActionData to handle legacy-specific verbosity
  captureActionData(category, type, data) {
    // Apply legacy-specific verbosity filtering
    if (category === 'legacy' && !this.shouldCaptureLegacyData(type)) {
      return;
    }

    super.captureActionData(category, type, data);
  }

  shouldCaptureLegacyData(type) {
    switch (this.verbosity) {
      case 'minimal':
        return ['conversion_success', 'validation_failed'].includes(type);
      case 'basic':
        return [
          'conversion_success', 
          'validation_failed', 
          'simple_action_adaptation',
          'legacy_dialogue_adaptation'
        ].includes(type);
      case 'detailed':
        return true; // Capture all legacy data
      default:
        return true;
    }
  }
}

export { ActionAwareStructuredTrace };
```

### Step 4: Enhanced Legacy Action Tests

**File**: `tests/unit/actions/tracing/legacy/legacyActionDetector.test.js`

```javascript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import LegacyActionDetector from '../../../../../src/actions/tracing/legacy/legacyActionDetector.js';

describe('LegacyActionDetector', () => {
  let detector;
  let mockSchemaValidator;
  let mockLogger;

  beforeEach(() => {
    mockSchemaValidator = {
      validate: jest.fn(),
      getErrors: jest.fn()
    };
    
    mockLogger = {
      warn: jest.fn(),
      info: jest.fn(),
      error: jest.fn()
    };

    detector = new LegacyActionDetector({
      schemaValidator: mockSchemaValidator,
      logger: mockLogger
    });
  });

  describe('Legacy Action Detection', () => {
    it('should detect simple action format', () => {
      const action = {
        id: 'simple-1',
        text: 'This is a simple action'
      };

      const legacyType = detector.detectLegacyType(action);
      
      expect(legacyType).toBe('simple_action');
    });

    it('should detect legacy dialogue format', () => {
      const action = {
        id: 'dialogue-1',
        speaker: 'Alice',
        message: 'Hello there!',
        target: 'Bob'
      };

      const legacyType = detector.detectLegacyType(action);
      
      expect(legacyType).toBe('legacy_dialogue');
    });

    it('should detect old choice format', () => {
      const action = {
        id: 'choice-1',
        prompt: 'What do you want to do?',
        options: ['Option A', 'Option B', 'Option C']
      };

      const legacyType = detector.detectLegacyType(action);
      
      expect(legacyType).toBe('old_choice');
    });

    it('should detect param action format', () => {
      const action = {
        id: 'param-1',
        type: 'custom',
        params: {
          value1: 'test',
          value2: 42
        }
      };

      const legacyType = detector.detectLegacyType(action);
      
      expect(legacyType).toBe('param_action');
    });

    it('should detect component action format', () => {
      const action = {
        id: 'comp-1',
        component: 'custom-component',
        data: {
          prop1: 'value1',
          prop2: 'value2'
        }
      };

      const legacyType = detector.detectLegacyType(action);
      
      expect(legacyType).toBe('component_action');
    });

    it('should return null for modern actions', () => {
      const modernAction = {
        id: 'modern-1',
        type: 'dialogue',
        parameters: {
          character: 'Alice',
          text: 'Hello!'
        },
        components: ['dialogue-component']
      };

      const legacyType = detector.detectLegacyType(modernAction);
      
      expect(legacyType).toBeNull();
    });

    it('should prioritize higher priority patterns', () => {
      // This action could match both legacy_dialogue and simple_action patterns
      const ambiguousAction = {
        id: 'ambiguous-1',
        text: 'Some text',
        speaker: 'Alice',
        message: 'Hello!'
      };

      const legacyType = detector.detectLegacyType(ambiguousAction);
      
      // legacy_dialogue has higher priority (20) than simple_action (10)
      expect(legacyType).toBe('legacy_dialogue');
    });
  });

  describe('Legacy Action Validation', () => {
    it('should validate simple actions correctly', () => {
      const action = {
        id: 'simple-1',
        text: 'This is a simple action'
      };

      mockSchemaValidator.validate.mockReturnValue(true);

      const isValid = detector.validateLegacyAction(action, 'simple_action');
      
      expect(isValid).toBe(true);
      expect(mockSchemaValidator.validate).toHaveBeenCalled();
    });

    it('should handle validation failures', () => {
      const invalidAction = {
        id: 'invalid-1'
        // Missing required 'text' field
      };

      mockSchemaValidator.validate.mockReturnValue(false);
      mockSchemaValidator.getErrors.mockReturnValue(['Missing required field: text']);

      const isValid = detector.validateLegacyAction(invalidAction, 'simple_action');
      
      expect(isValid).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should throw error for unknown legacy type', () => {
      const action = { id: 'test' };

      expect(() => {
        detector.validateLegacyAction(action, 'unknown_type');
      }).toThrow('Unknown legacy action type: unknown_type');
    });
  });

  describe('Pattern Management', () => {
    it('should return pattern information', () => {
      const pattern = detector.getLegacyPattern('simple_action');
      
      expect(pattern).toBeDefined();
      expect(pattern.modernEquivalent).toBe('narrative');
      expect(pattern.priority).toBe(10);
    });

    it('should return all legacy patterns', () => {
      const patterns = detector.getAllLegacyPatterns();
      
      expect(patterns).toBeInstanceOf(Array);
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0]).toHaveProperty('type');
      expect(patterns[0]).toHaveProperty('modernEquivalent');
      expect(patterns[0]).toHaveProperty('priority');
    });
  });
});
```

**File**: `tests/unit/actions/tracing/legacy/legacyActionAdapters.test.js`

```javascript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { 
  SimpleActionAdapter,
  LegacyDialogueAdapter,
  OldChoiceAdapter,
  ParamActionAdapter,
  ComponentActionAdapter,
  LegacyAdapterFactory
} from '../../../../../src/actions/tracing/legacy/legacyActionAdapters.js';

describe('Legacy Action Adapters', () => {
  let mockLogger;
  let mockTrace;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    mockTrace = {
      captureActionData: jest.fn()
    };
  });

  describe('SimpleActionAdapter', () => {
    it('should adapt simple action to narrative format', () => {
      const adapter = new SimpleActionAdapter({ logger: mockLogger });
      const legacyAction = {
        id: 'simple-1',
        text: 'A simple narrative action'
      };

      const modernAction = adapter.adapt(legacyAction, mockTrace);

      expect(modernAction).toEqual({
        id: 'simple-1',
        type: 'narrative',
        parameters: {
          text: 'A simple narrative action'
        }
      });

      expect(mockTrace.captureActionData).toHaveBeenCalledWith(
        'legacy',
        'simple_action_adaptation',
        expect.objectContaining({
          legacyType: 'simple_action',
          modernEquivalent: 'narrative'
        })
      );
    });
  });

  describe('LegacyDialogueAdapter', () => {
    it('should adapt legacy dialogue to modern format', () => {
      const adapter = new LegacyDialogueAdapter({ logger: mockLogger });
      const legacyAction = {
        id: 'dialogue-1',
        speaker: 'Alice',
        message: 'Hello there!',
        target: 'Bob'
      };

      const modernAction = adapter.adapt(legacyAction, mockTrace);

      expect(modernAction).toEqual({
        id: 'dialogue-1',
        type: 'dialogue',
        parameters: {
          character: 'Alice',
          text: 'Hello there!',
          target: 'Bob'
        }
      });

      expect(mockTrace.captureActionData).toHaveBeenCalledWith(
        'legacy',
        'legacy_dialogue_adaptation',
        expect.objectContaining({
          legacyType: 'legacy_dialogue',
          modernEquivalent: 'dialogue'
        })
      );
    });

    it('should handle dialogue without target', () => {
      const adapter = new LegacyDialogueAdapter({ logger: mockLogger });
      const legacyAction = {
        id: 'dialogue-2',
        speaker: 'Bob',
        message: 'Hi everyone!'
      };

      const modernAction = adapter.adapt(legacyAction, mockTrace);

      expect(modernAction.parameters.target).toBeUndefined();
    });
  });

  describe('OldChoiceAdapter', () => {
    it('should adapt old choice format to modern format', () => {
      const adapter = new OldChoiceAdapter({ logger: mockLogger });
      const legacyAction = {
        id: 'choice-1',
        prompt: 'What would you like to do?',
        options: ['Go north', 'Go south', 'Rest']
      };

      const modernAction = adapter.adapt(legacyAction, mockTrace);

      expect(modernAction).toEqual({
        id: 'choice-1',
        type: 'choice',
        parameters: {
          prompt: 'What would you like to do?',
          choices: [
            { id: 'choice_0', text: 'Go north', value: 'Go north' },
            { id: 'choice_1', text: 'Go south', value: 'Go south' },
            { id: 'choice_2', text: 'Rest', value: 'Rest' }
          ]
        }
      });
    });

    it('should provide default prompt when missing', () => {
      const adapter = new OldChoiceAdapter({ logger: mockLogger });
      const legacyAction = {
        id: 'choice-2',
        options: ['Option A', 'Option B']
      };

      const modernAction = adapter.adapt(legacyAction, mockTrace);

      expect(modernAction.parameters.prompt).toBe('Choose an option:');
    });
  });

  describe('ParamActionAdapter', () => {
    it('should adapt param action format', () => {
      const adapter = new ParamActionAdapter({ logger: mockLogger });
      const legacyAction = {
        id: 'param-1',
        type: 'custom-action',
        params: {
          value1: 'test',
          value2: 42,
          nested: {
            prop: 'value'
          }
        }
      };

      const modernAction = adapter.adapt(legacyAction, mockTrace);

      expect(modernAction).toEqual({
        id: 'param-1',
        type: 'custom-action',
        parameters: {
          value1: 'test',
          value2: 42,
          nested: {
            prop: 'value'
          }
        }
      });
    });
  });

  describe('ComponentActionAdapter', () => {
    it('should adapt component action format', () => {
      const adapter = new ComponentActionAdapter({ logger: mockLogger });
      const legacyAction = {
        id: 'comp-1',
        component: 'inventory-display',
        data: {
          items: ['sword', 'shield'],
          gold: 100
        }
      };

      const modernAction = adapter.adapt(legacyAction, mockTrace);

      expect(modernAction).toEqual({
        id: 'comp-1',
        type: 'component',
        components: ['inventory-display'],
        parameters: {
          items: ['sword', 'shield'],
          gold: 100
        }
      });
    });

    it('should handle component action without data', () => {
      const adapter = new ComponentActionAdapter({ logger: mockLogger });
      const legacyAction = {
        id: 'comp-2',
        component: 'simple-display'
      };

      const modernAction = adapter.adapt(legacyAction, mockTrace);

      expect(modernAction.parameters).toEqual({});
    });
  });

  describe('LegacyAdapterFactory', () => {
    it('should create all required adapters', () => {
      const factory = new LegacyAdapterFactory({ logger: mockLogger });

      expect(factory.hasAdapter('simple_action')).toBe(true);
      expect(factory.hasAdapter('legacy_dialogue')).toBe(true);
      expect(factory.hasAdapter('old_choice')).toBe(true);
      expect(factory.hasAdapter('param_action')).toBe(true);
      expect(factory.hasAdapter('component_action')).toBe(true);
    });

    it('should return appropriate adapters', () => {
      const factory = new LegacyAdapterFactory({ logger: mockLogger });

      const simpleAdapter = factory.getAdapter('simple_action');
      expect(simpleAdapter).toBeInstanceOf(SimpleActionAdapter);

      const dialogueAdapter = factory.getAdapter('legacy_dialogue');
      expect(dialogueAdapter).toBeInstanceOf(LegacyDialogueAdapter);
    });

    it('should return all adapter types', () => {
      const factory = new LegacyAdapterFactory({ logger: mockLogger });
      const types = factory.getAllAdapterTypes();

      expect(types).toContain('simple_action');
      expect(types).toContain('legacy_dialogue');
      expect(types).toContain('old_choice');
      expect(types).toContain('param_action');
      expect(types).toContain('component_action');
    });
  });
});
```

## Testing Requirements

### Unit Tests Required
- [ ] LegacyActionDetector pattern detection
- [ ] Individual adapter functionality
- [ ] Adapter factory creation and management
- [ ] ActionAwareStructuredTrace legacy integration
- [ ] Legacy action validation
- [ ] Performance metrics capture
- [ ] Error handling for invalid legacy actions

### Integration Tests Required
- [ ] End-to-end legacy action processing
- [ ] Pipeline integration with legacy actions
- [ ] Mixed legacy and modern action workflows
- [ ] Legacy action performance benchmarking

### Compatibility Tests Required
- [ ] Backward compatibility verification
- [ ] Legacy schema validation
- [ ] Migration path testing
- [ ] Performance impact assessment

## Acceptance Criteria

### Functional Requirements
- [ ] All legacy action types are correctly detected
- [ ] Legacy actions are properly adapted to modern format
- [ ] Trace data captures legacy conversion details
- [ ] Backward compatibility maintained for all legacy formats
- [ ] Error handling preserves legacy action processing
- [ ] Performance metrics captured for legacy actions

### Performance Requirements
- [ ] Zero performance degradation for legacy action processing
- [ ] Efficient memory usage for legacy action adaptation
- [ ] Minimal overhead for legacy detection (<1ms per action)

### Quality Requirements
- [ ] 85% test coverage for legacy support functionality
- [ ] All existing legacy actions continue to work
- [ ] Comprehensive error handling and logging
- [ ] Performance benchmarks documented

## Dependencies

### Prerequisite Tickets
- ACTTRA-009: ActionAwareStructuredTrace class (Foundation)
- ACTTRA-010: ActionDiscoveryService enhancement (Service Integration)

### Related Systems
- Schema validation system for legacy format validation
- Action pipeline for processing legacy actions
- Event bus for legacy action events
- Logger for diagnostic information

### External Dependencies
- AJV for schema validation
- ActionAwareStructuredTrace for trace capture
- Pipeline stage framework

## Effort Estimation

**Total Effort: 21 hours**

- Legacy detection implementation: 6 hours
- Adapter system implementation: 8 hours  
- ActionAwareStructuredTrace integration: 3 hours
- Unit tests: 3 hours
- Integration tests: 1 hour

## Implementation Notes

### Compatibility Considerations
- All legacy action formats supported indefinitely
- No breaking changes to existing legacy action processing
- Graceful degradation when legacy detection fails
- Performance optimization for legacy action workflows

### Migration Strategy
- Legacy actions transparently converted to modern format
- Trace data provides migration guidance
- No mandatory migration requirements
- Tools provided for optional legacy action modernization

This ticket ensures comprehensive legacy action support within the action tracing system while maintaining full backward compatibility and providing clear migration paths for legacy content.