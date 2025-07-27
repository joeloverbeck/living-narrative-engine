# Ticket 15: Create Comprehensive Documentation

## Overview

Create comprehensive documentation for the multi-target action system, including developer guides, API documentation, migration instructions, and examples. This documentation will serve as the definitive resource for understanding, implementing, and maintaining the multi-target action system.

## Dependencies

- Ticket 14: Comprehensive Integration Testing (must be completed)
- All previous tickets (1-14) must be completed

## Blocks

- Ticket 16: Create Migration Utilities and Scripts
- Ticket 17: Performance Optimization and Monitoring

## Priority: High

## Estimated Time: 10-12 hours

## Background

With the complete multi-target action system implemented and tested, comprehensive documentation is needed to enable developers to understand, use, and maintain the system. This documentation must cover all aspects from high-level architecture to implementation details.

## Implementation Details

### 1. Create System Architecture Documentation

**File**: `docs/multi-target-actions/system-architecture.md`

```markdown
# Multi-Target Action System Architecture

## Overview

The Multi-Target Action System enhances the Living Narrative Engine to support actions that operate on multiple targets simultaneously while maintaining complete backward compatibility with existing single-target actions.

## System Components

### 1. Enhanced Event Schema

The system extends the core event schema to support multiple targets:

```json
{
  "eventName": "core:attempt_action",
  "actorId": "actor_123",
  "actionId": "combat:throw",
  "targets": {
    "item": "knife_456",
    "target": "goblin_789"
  },
  "targetId": "knife_456",
  "originalInput": "throw knife at goblin",
  "timestamp": 1641024000000
}
```

**Key Features:**
- `targets` object contains multiple named targets
- `targetId` preserved for backward compatibility
- Enhanced payload while maintaining legacy format support

### 2. Command Processor Enhancement

The CommandProcessor has been enhanced to extract and process multi-target data:

**Enhanced Capabilities:**
- Multi-target data extraction from formatting stage
- Enhanced event payload creation with builder pattern
- Backward compatibility layer ensuring legacy actions work unchanged
- Performance monitoring and metrics collection

**Processing Pipeline:**
1. Action formatting produces multi-target data
2. CommandProcessor extracts target information
3. Enhanced payload builder creates appropriate event format
4. Compatibility validation ensures proper formatting
5. Event dispatched to rules system

### 3. Rules System Integration

Rules can now access multi-target data while maintaining compatibility:

**Enhanced Access Patterns:**
```json
{
  "condition": {
    "if": [
      {"var": "event.targets.item"},
      {"var": "event.targets.item"},
      {"var": "event.targetId"}
    ]
  }
}
```

**Backward Compatible Patterns:**
- Legacy rules continue working without modification
- Enhanced rules can access both legacy and multi-target formats
- Conditional logic provides graceful fallbacks

## Data Flow Architecture

```
Action Input → Formatting Stage → Command Processor → Rules Engine
     ↓              ↓                    ↓              ↓
User Command → Multi-Target Data → Enhanced Payload → Rule Execution
     ↓              ↓                    ↓              ↓
"throw knife  → {item: "knife",    → {targets: {...}, → Multi-target
 at goblin"      target: "goblin"}    targetId: "..."}   rule logic
```

## Backward Compatibility

### Legacy Action Support

All existing single-target actions continue working without modification:

```json
{
  "eventName": "core:attempt_action",
  "actorId": "actor_123",
  "actionId": "core:follow",
  "targetId": "target_456",
  "originalInput": "follow Alice",
  "timestamp": 1641024000000
}
```

### Migration Strategy

- **Phase 1**: Enhanced system deployed alongside legacy support
- **Phase 2**: New actions can utilize multi-target capabilities
- **Phase 3**: Existing actions can be gradually enhanced
- **Phase 4**: Full multi-target adoption with legacy fallbacks

## Performance Characteristics

### Performance Targets

- **Payload Creation**: < 10ms for typical multi-target scenarios
- **Rule Execution**: < 5ms for enhanced rule processing
- **Memory Usage**: < 5KB additional per multi-target action
- **Backward Compatibility**: Zero performance regression for legacy actions

### Monitoring Metrics

- Payload creation statistics (legacy vs. enhanced)
- Rule execution performance
- Memory usage tracking
- Error rates and failure patterns

## Error Handling

### Graceful Degradation

The system includes comprehensive error handling:

1. **Invalid Multi-Target Data**: Falls back to legacy format
2. **Extraction Failures**: Creates fallback payload
3. **Rule Processing Errors**: Maintains system stability
4. **Memory Pressure**: Graceful resource management

### Validation Layers

- Schema validation for event payloads
- Target data validation and sanitization
- Rule compatibility validation
- Performance threshold monitoring

## Security Considerations

### Data Validation

- All target data validated against schemas
- Input sanitization prevents injection attacks
- Resource limits prevent denial of service
- Access control maintained for all operations

### Backward Compatibility Security

- Legacy format validation prevents exploitation
- Enhanced format includes additional security checks
- Migration utilities include security validation
- Performance monitoring detects anomalies

## Extensibility

### Adding New Target Types

The system supports arbitrary target types:

```json
{
  "targets": {
    "custom_type": "custom_value",
    "another_type": "another_value"
  }
}
```

### Rule Enhancement Patterns

Rules can be enhanced using standard patterns:

```json
{
  "data": {
    "target": {
      "if": [
        {"var": "event.targets.custom_type"},
        {"var": "event.targets.custom_type"},
        {"var": "event.targetId"}
      ]
    }
  }
}
```

## Future Considerations

### Planned Enhancements

- Advanced target relationship modeling
- Performance optimizations for large target sets
- Enhanced rule authoring tools
- Real-time target validation

### Compatibility Roadmap

- Long-term support for legacy format
- Gradual migration utilities
- Enhanced debugging and monitoring tools
- Performance optimization opportunities
```

### 2. Create Developer Implementation Guide

**File**: `docs/multi-target-actions/developer-guide.md`

```markdown
# Multi-Target Actions Developer Guide

## Getting Started

This guide provides developers with practical instructions for implementing and using the multi-target action system.

## Basic Implementation

### Creating Multi-Target Actions

To create an action that supports multiple targets, ensure the action formatting stage produces the following structure:

```javascript
{
  actionDefinitionId: 'combat:throw',
  commandString: 'throw knife at goblin',
  resolvedParameters: {
    isMultiTarget: true,
    targetIds: {
      item: ['knife_123'],
      target: ['goblin_456']
    }
  }
}
```

### Key Requirements

1. **isMultiTarget Flag**: Must be `true` for multi-target processing
2. **targetIds Object**: Contains named target categories
3. **Array Values**: Each target category contains an array of target IDs
4. **Consistent Naming**: Use descriptive target category names

## Writing Multi-Target Rules

### Enhanced Rule Pattern

```json
{
  "id": "example:multi_target_rule",
  "conditions": [
    {
      "type": "json_logic",
      "logic": {
        "and": [
          {"==": [{"var": "event.eventName"}, "core:attempt_action"]},
          {"==": [{"var": "event.actionId"}, "combat:throw"]},
          {"var": "event.targets"}
        ]
      }
    }
  ],
  "operations": [
    {
      "type": "execute_throw",
      "data": {
        "thrower": {"var": "event.actorId"},
        "item": {"var": "event.targets.item"},
        "target": {"var": "event.targets.target"}
      }
    }
  ]
}
```

### Backward Compatible Rule Pattern

```json
{
  "id": "example:compatible_rule",
  "conditions": [
    {
      "type": "json_logic",
      "logic": {
        "and": [
          {"==": [{"var": "event.eventName"}, "core:attempt_action"]},
          {"==": [{"var": "event.actionId"}, "core:follow"]}
        ]
      }
    }
  ],
  "operations": [
    {
      "type": "execute_follow",
      "data": {
        "follower": {"var": "event.actorId"},
        "target": {
          "if": [
            {"var": "event.targets.target"},
            {"var": "event.targets.target"},
            {"var": "event.targetId"}
          ]
        }
      }
    }
  ]
}
```

## Common Patterns

### Target Access Patterns

#### Get Primary Target
```json
{
  "primaryTarget": {
    "if": [
      {"var": "event.targetId"},
      {"var": "event.targetId"},
      {"var": "event.targets | values | first"}
    ]
  }
}
```

#### Check for Specific Target Type
```json
{
  "hasItem": {
    "and": [
      {"var": "event.targets"},
      {"var": "event.targets.item"}
    ]
  }
}
```

#### Iterate Over All Targets
```json
{
  "type": "foreach_target",
  "items": {"var": "event.targets | entries"},
  "operations": [
    {
      "type": "process_target",
      "data": {
        "targetType": {"var": "current.0"},
        "targetId": {"var": "current.1"}
      }
    }
  ]
}
```

#### Count Targets
```json
{
  "targetCount": {
    "if": [
      {"var": "event.targets"},
      {"var": "event.targets | keys | length"},
      {
        "if": [
          {"var": "event.targetId"},
          1,
          0
        ]
      }
    ]
  }
}
```

### Validation Patterns

#### Required Target Types
```json
{
  "condition": {
    "and": [
      {"var": "event.targets.item"},
      {"var": "event.targets.target"},
      {"!=": [{"var": "event.targets.item"}, ""]},
      {"!=": [{"var": "event.targets.target"}, ""]}
    ]
  }
}
```

#### Optional Target Types
```json
{
  "weaponId": {
    "if": [
      {"var": "event.targets.weapon"},
      {"var": "event.targets.weapon"},
      {"var": "entities[event.actorId].components['core:equipment'].mainHand"}
    ]
  }
}
```

## Testing Multi-Target Rules

### Unit Testing

Use the rules testing framework for comprehensive validation:

```javascript
import RulesTestingFramework from '../frameworks/rulesTestingFramework.js';

const framework = new RulesTestingFramework({ logger, rulesEngine, eventBus });

const testEvent = {
  eventName: 'core:attempt_action',
  actorId: 'test_actor',
  actionId: 'combat:throw',
  targets: {
    item: 'test_knife',
    target: 'test_goblin'
  },
  targetId: 'test_knife',
  originalInput: 'throw knife at goblin',
  timestamp: Date.now()
};

const result = await framework.testRuleWithEvents(rule, [testEvent]);
expect(result.passed).toBe(1);
```

### Integration Testing

Test complete action workflows:

```javascript
const turnAction = {
  actionDefinitionId: 'combat:throw',
  commandString: 'throw knife at goblin',
  resolvedParameters: {
    isMultiTarget: true,
    targetIds: {
      item: ['knife_123'],
      target: ['goblin_456']
    }
  }
};

const payload = await commandProcessor.createAttemptActionPayload(actor, turnAction);
expect(payload.targets).toEqual({
  item: 'knife_123',
  target: 'goblin_456'
});
```

## Performance Considerations

### Optimization Guidelines

1. **Minimize Target Objects**: Only include necessary targets
2. **Efficient Rule Logic**: Use simple conditions when possible
3. **Batch Operations**: Group related operations together
4. **Memory Management**: Avoid creating large temporary objects

### Performance Monitoring

Monitor key metrics:

```javascript
const stats = commandProcessor.getPayloadCreationStatistics();
console.log(`Average creation time: ${stats.averageCreationTime}ms`);
console.log(`Multi-target rate: ${stats.multiTargetPayloads / stats.totalPayloadsCreated * 100}%`);
```

## Debugging

### Common Issues

#### Missing Targets Object
**Symptom**: Rules expecting targets object receive undefined
**Solution**: Verify `isMultiTarget: true` in resolved parameters

#### Targets Object Empty
**Symptom**: Targets object exists but has no properties
**Solution**: Check target extraction logic in formatting stage

#### Backward Compatibility Issues
**Symptom**: Legacy actions fail after enhancement
**Solution**: Ensure conditional logic provides fallback to `targetId`

### Debugging Tools

#### Payload Inspection
```javascript
console.log('Payload structure:', JSON.stringify(payload, null, 2));
console.log('Has targets:', !!payload.targets);
console.log('Target count:', payload.targets ? Object.keys(payload.targets).length : 0);
```

#### Rule Execution Tracing
```javascript
eventBus.on('rule_executed', (execution) => {
  console.log(`Rule ${execution.ruleId}: ${execution.success ? 'SUCCESS' : 'FAILED'}`);
  if (!execution.success) {
    console.log('Errors:', execution.errors);
  }
});
```

## Migration Guidelines

### Enhancing Existing Rules

1. **Identify Enhancement Opportunities**: Look for rules that could benefit from multiple targets
2. **Add Conditional Logic**: Use fallback patterns for compatibility
3. **Test Thoroughly**: Validate both legacy and enhanced formats
4. **Monitor Performance**: Ensure no regression in rule execution

### Migration Utilities

Use the provided migration helper:

```javascript
import RuleMigrationHelper from '../utils/ruleMigrationHelper.js';

const helper = new RuleMigrationHelper({ logger });
const analysis = helper.analyzeRuleForMigration(originalRule);
const enhancedRule = helper.generateEnhancedRule(originalRule);
const validation = helper.validateBackwardCompatibility(originalRule, enhancedRule);
```

## Best Practices

### Rule Design

1. **Start Simple**: Begin with basic multi-target access
2. **Add Gradually**: Enhance complexity as needed
3. **Test Extensively**: Cover all target combinations
4. **Document Thoroughly**: Explain target usage in rule descriptions

### Performance

1. **Profile Regularly**: Monitor rule execution times
2. **Optimize Conditionals**: Use efficient JSON Logic patterns
3. **Limit Complexity**: Avoid deeply nested conditions
4. **Cache Results**: Reuse computed values when possible

### Maintenance

1. **Version Control**: Track rule changes carefully
2. **Backward Testing**: Validate legacy compatibility regularly
3. **Monitor Metrics**: Watch for performance regressions
4. **Update Documentation**: Keep examples current

## Advanced Topics

### Custom Target Types

Define domain-specific target types:

```json
{
  "targets": {
    "spell_component": "crystal_shard",
    "spell_focus": "magic_wand",
    "spell_target": "enemy_wizard"
  }
}
```

### Dynamic Target Resolution

Resolve targets at runtime:

```json
{
  "targets": {
    "nearest_enemy": {"resolve": "findNearestEnemy"},
    "best_weapon": {"resolve": "findBestWeapon"}
  }
}
```

### Target Relationships

Model relationships between targets:

```json
{
  "targets": {
    "container": "chest_123",
    "contents": "gold_456",
    "relationship": "contains"
  }
}
```

## Troubleshooting

### Common Error Messages

**"Multi-target data extraction failed"**
- Check resolved parameters structure
- Verify targetIds is valid object
- Ensure isMultiTarget flag is set

**"Payload compatibility validation failed"**
- Review enhanced event schema
- Check for required fields
- Validate target data types

**"Rule execution timeout"**
- Simplify rule conditions
- Optimize JSON Logic expressions
- Check for infinite loops

### Getting Help

- Review system architecture documentation
- Check existing rule examples
- Use debugging tools and logging
- Consult performance monitoring data
- Review integration test patterns
```

### 3. Create API Reference Documentation

**File**: `docs/multi-target-actions/api-reference.md`

```markdown
# Multi-Target Actions API Reference

## CommandProcessor API

### Enhanced Methods

#### `createAttemptActionPayload(actor, turnAction)`

Creates an enhanced event payload with multi-target support.

**Parameters:**
- `actor` (Object): Actor entity performing the action
- `turnAction` (Object): Turn action data from formatting stage

**Returns:** Promise<Object> - Enhanced event payload

**Example:**
```javascript
const payload = await commandProcessor.createAttemptActionPayload(actor, {
  actionDefinitionId: 'combat:throw',
  commandString: 'throw knife at goblin',
  resolvedParameters: {
    isMultiTarget: true,
    targetIds: {
      item: ['knife_123'],
      target: ['goblin_456']
    }
  }
});
```

#### `getPayloadCreationStatistics()`

Returns payload creation metrics for monitoring.

**Returns:** Object - Statistics object

**Properties:**
- `totalPayloadsCreated` (number): Total payloads created
- `multiTargetPayloads` (number): Multi-target payloads created
- `legacyPayloads` (number): Legacy payloads created
- `fallbackPayloads` (number): Fallback payloads created
- `averageCreationTime` (number): Average creation time in ms

## TargetExtractionService API

### Methods

#### `extractTargets(resolvedParameters)`

Extracts target data from resolved parameters.

**Parameters:**
- `resolvedParameters` (Object): Parameters from action formatting

**Returns:** Promise<TargetExtractionResult> - Extraction result

#### `getPerformanceMetrics()`

Returns extraction performance metrics.

**Returns:** Object - Performance metrics

#### `validateExtractedTargets(extractionResult, actionDefinition)`

Validates extracted targets against action requirements.

**Parameters:**
- `extractionResult` (TargetExtractionResult): Extraction result
- `actionDefinition` (Object): Action definition (optional)

**Returns:** Object - Validation result

## TargetExtractionResult API

### Properties

- `targetManager` (TargetManager): Target management instance
- `extractionMetadata` (Object): Extraction metadata

### Methods

#### `hasMultipleTargets()`

Returns whether result contains multiple targets.

**Returns:** boolean

#### `getTargetCount()`

Returns number of targets.

**Returns:** number

#### `getPrimaryTarget()`

Returns primary target ID.

**Returns:** string|null

#### `getTarget(type)`

Returns target ID for specific type.

**Parameters:**
- `type` (string): Target type name

**Returns:** string|null

#### `getTargets()`

Returns all targets as object.

**Returns:** Object

#### `addMetadata(key, value)`

Adds metadata to extraction result.

**Parameters:**
- `key` (string): Metadata key
- `value` (*): Metadata value

#### `getMetadata(key)`

Gets metadata value.

**Parameters:**
- `key` (string): Metadata key

**Returns:** * - Metadata value

## MultiTargetEventBuilder API

### Static Methods

#### `fromTurnAction(actor, turnAction, extractionResult, logger)`

Creates builder from turn action data.

**Parameters:**
- `actor` (Object): Actor entity
- `turnAction` (Object): Turn action data
- `extractionResult` (TargetExtractionResult): Extraction result
- `logger` (Object): Logger instance

**Returns:** MultiTargetEventBuilder

### Instance Methods

#### `build()`

Builds the final event payload.

**Returns:** Object - Event payload

## BackwardCompatibilityService API

### Methods

#### `validatePayloadCompatibility(payload, context)`

Validates payload for backward compatibility.

**Parameters:**
- `payload` (Object): Event payload
- `context` (Object): Validation context

**Returns:** Object - Compatibility validation result

#### `createLegacyAdapter(enhancedPayload)`

Creates legacy format from enhanced payload.

**Parameters:**
- `enhancedPayload` (Object): Enhanced format payload

**Returns:** Object - Legacy format payload

#### `createEnhancedAdapter(legacyPayload, options)`

Creates enhanced format from legacy payload.

**Parameters:**
- `legacyPayload` (Object): Legacy format payload
- `options` (Object): Adaptation options

**Returns:** Object - Enhanced format payload

#### `getCompatibilityMetrics()`

Returns compatibility metrics.

**Returns:** Object - Compatibility metrics

## RulesTestingFramework API

### Methods

#### `runTestSuite(testSuite)`

Runs comprehensive rule test suite.

**Parameters:**
- `testSuite` (Object): Test suite configuration

**Returns:** Promise<Object> - Test results

#### `testRuleWithEvents(rule, testEvents)`

Tests single rule against multiple events.

**Parameters:**
- `rule` (Object): Rule to test
- `testEvents` (Array): Array of test events

**Returns:** Promise<Object> - Test results

#### `validateRulePerformance(rule, loadConfig)`

Validates rule performance under load.

**Parameters:**
- `rule` (Object): Rule to test
- `loadConfig` (Object): Load test configuration

**Returns:** Promise<Object> - Performance results

#### `generateTestEvents(config)`

Generates test events for rule testing.

**Parameters:**
- `config` (Object): Event generation configuration

**Returns:** Array - Test events

## Event Schema Reference

### Enhanced Event Format

```json
{
  "eventName": "core:attempt_action",
  "actorId": "string",
  "actionId": "string",
  "targets": {
    "targetType1": "targetId1",
    "targetType2": "targetId2"
  },
  "targetId": "string",
  "originalInput": "string",
  "timestamp": "number"
}
```

### Legacy Event Format

```json
{
  "eventName": "core:attempt_action", 
  "actorId": "string",
  "actionId": "string",
  "targetId": "string|null",
  "originalInput": "string",
  "timestamp": "number"
}
```

## Error Types

### ExtractionError

Thrown when target extraction fails.

**Properties:**
- `message` (string): Error message
- `resolvedParameters` (Object): Original parameters
- `extractionAttempt` (Object): Extraction attempt details

### CompatibilityError

Thrown when compatibility validation fails.

**Properties:**
- `message` (string): Error message
- `payload` (Object): Problematic payload
- `issues` (Array): Compatibility issues

### ValidationError

Thrown when payload validation fails.

**Properties:**
- `message` (string): Error message
- `payload` (Object): Invalid payload
- `validationErrors` (Array): Validation errors

## Configuration Options

### Performance Tuning

```javascript
{
  payloadCreation: {
    timeout: 1000,
    maxTargets: 20,
    enableCaching: true
  },
  targetExtraction: {
    maxExtractionTime: 50,
    enableValidation: true,
    strictMode: false
  },
  compatibility: {
    enableValidation: true,
    logWarnings: true,
    strictCompatibility: false
  }
}
```

### Monitoring Configuration

```javascript
{
  metrics: {
    enableCollection: true,
    sampleRate: 0.1,
    maxHistorySize: 1000
  },
  logging: {
    logPayloadCreation: true,
    logTargetExtraction: true,
    logCompatibilityIssues: true
  }
}
```
```

### 4. Create Examples and Tutorials

**File**: `docs/multi-target-actions/examples-and-tutorials.md`

```markdown
# Multi-Target Actions Examples and Tutorials

## Tutorial 1: Basic Multi-Target Action

### Scenario: Throwing a Knife at an Enemy

This tutorial demonstrates creating a basic multi-target action where a player throws a weapon at a target.

#### Step 1: Action Formatting

The action formatting stage should produce:

```javascript
{
  actionDefinitionId: 'combat:throw',
  commandString: 'throw knife at goblin',
  resolvedParameters: {
    isMultiTarget: true,
    targetIds: {
      item: ['knife_123'],
      target: ['goblin_456']
    }
  }
}
```

#### Step 2: Enhanced Rule Creation

Create a rule that can access both targets:

```json
{
  "id": "tutorial:throw_weapon",
  "name": "Throw Weapon at Target",
  "description": "Handles throwing weapons at targets",
  "conditions": [
    {
      "type": "json_logic",
      "logic": {
        "and": [
          {"==": [{"var": "event.eventName"}, "core:attempt_action"]},
          {"==": [{"var": "event.actionId"}, "combat:throw"]},
          {"var": "event.targets.item"},
          {"var": "event.targets.target"}
        ]
      }
    }
  ],
  "operations": [
    {
      "type": "validate_throw_action",
      "data": {
        "thrower": {"var": "event.actorId"},
        "weapon": {"var": "event.targets.item"},
        "target": {"var": "event.targets.target"}
      }
    },
    {
      "type": "execute_throw",
      "effects": [
        {
          "type": "remove_item_from_inventory",
          "actor": {"var": "event.actorId"},
          "item": {"var": "event.targets.item"}
        },
        {
          "type": "calculate_throw_damage",
          "weapon": {"var": "event.targets.item"},
          "target": {"var": "event.targets.target"},
          "thrower": {"var": "event.actorId"}
        }
      ]
    }
  ]
}
```

#### Step 3: Testing

```javascript
const testEvent = {
  eventName: 'core:attempt_action',
  actorId: 'player_123',
  actionId: 'combat:throw',
  targets: {
    item: 'knife_123',
    target: 'goblin_456'
  },
  targetId: 'knife_123',
  originalInput: 'throw knife at goblin',
  timestamp: Date.now()
};

const result = await testingFramework.testRuleWithEvents(rule, [testEvent]);
expect(result.passed).toBe(1);
```

## Tutorial 2: Backward Compatible Enhancement

### Scenario: Enhancing a Follow Action

This tutorial shows how to enhance an existing single-target action to support multi-target while maintaining compatibility.

#### Original Legacy Rule

```json
{
  "id": "core:follow_original",
  "conditions": [
    {
      "type": "json_logic",
      "logic": {
        "and": [
          {"==": [{"var": "event.eventName"}, "core:attempt_action"]},
          {"==": [{"var": "event.actionId"}, "core:follow"]}
        ]
      }
    }
  ],
  "operations": [
    {
      "type": "start_following",
      "data": {
        "follower": {"var": "event.actorId"},
        "target": {"var": "event.targetId"}
      }
    }
  ]
}
```

#### Enhanced Compatible Rule

```json
{
  "id": "core:follow_enhanced",
  "conditions": [
    {
      "type": "json_logic",
      "logic": {
        "and": [
          {"==": [{"var": "event.eventName"}, "core:attempt_action"]},
          {"==": [{"var": "event.actionId"}, "core:follow"]}
        ]
      }
    }
  ],
  "operations": [
    {
      "type": "start_following",
      "data": {
        "follower": {"var": "event.actorId"},
        "target": {
          "if": [
            {"var": "event.targets.target"},
            {"var": "event.targets.target"},
            {"var": "event.targetId"}
          ]
        },
        "distance": {
          "if": [
            {"var": "event.targets.distance"},
            {"var": "event.targets.distance"},
            3
          ]
        },
        "mode": {
          "if": [
            {"var": "event.targets.mode"},
            {"var": "event.targets.mode"},
            "normal"
          ]
        }
      }
    }
  ]
}
```

#### Testing Both Formats

```javascript
// Test legacy format
const legacyEvent = {
  eventName: 'core:attempt_action',
  actorId: 'player_123',
  actionId: 'core:follow',
  targetId: 'npc_456',
  originalInput: 'follow NPC',
  timestamp: Date.now()
};

// Test enhanced format
const enhancedEvent = {
  eventName: 'core:attempt_action',
  actorId: 'player_123',
  actionId: 'core:follow',
  targets: {
    target: 'npc_456',
    distance: '5',
    mode: 'stealth'
  },
  targetId: 'npc_456',
  originalInput: 'follow NPC at distance 5 in stealth mode',
  timestamp: Date.now()
};

const legacyResult = await testingFramework.testRuleWithEvents(rule, [legacyEvent]);
const enhancedResult = await testingFramework.testRuleWithEvents(rule, [enhancedEvent]);

expect(legacyResult.passed).toBe(1);
expect(enhancedResult.passed).toBe(1);
```

## Tutorial 3: Complex Multi-Target Scenario

### Scenario: Crafting with Multiple Components

This tutorial demonstrates a complex scenario where an action requires multiple different types of targets.

#### Action Structure

```javascript
{
  actionDefinitionId: 'crafting:forge_weapon',
  commandString: 'forge sword using iron with hammer at forge',
  resolvedParameters: {
    isMultiTarget: true,
    targetIds: {
      tool: ['hammer_123'],
      material: ['iron_ore_456'],
      location: ['forge_789'],
      recipe: ['sword_recipe_012']
    }
  }
}
```

#### Complex Rule Implementation

```json
{
  "id": "tutorial:forge_weapon",
  "name": "Forge Weapon",
  "description": "Complex crafting rule with multiple target types",
  "conditions": [
    {
      "type": "json_logic",
      "logic": {
        "and": [
          {"==": [{"var": "event.eventName"}, "core:attempt_action"]},
          {"==": [{"var": "event.actionId"}, "crafting:forge_weapon"]},
          {"var": "event.targets.tool"},
          {"var": "event.targets.material"},
          {"var": "event.targets.location"},
          {"var": "event.targets.recipe"}
        ]
      }
    }
  ],
  "operations": [
    {
      "type": "validate_crafting_requirements",
      "validations": [
        {
          "name": "tool_available",
          "condition": {
            "in": [
              {"var": "event.targets.tool"},
              {"var": "entities[event.actorId].components['core:inventory'].items"}
            ]
          }
        },
        {
          "name": "material_sufficient",
          "condition": {
            ">=": [
              {"var": "entities[event.targets.material].components['core:item'].quantity"},
              {"var": "recipes[event.targets.recipe].materialRequired"}
            ]
          }
        },
        {
          "name": "location_accessible",
          "condition": {
            "==": [
              {"var": "entities[event.actorId].location"},
              {"var": "event.targets.location"}
            ]
          }
        },
        {
          "name": "recipe_known",
          "condition": {
            "in": [
              {"var": "event.targets.recipe"},
              {"var": "entities[event.actorId].components['core:knowledge'].recipes"}
            ]
          }
        }
      ]
    },
    {
      "type": "execute_crafting",
      "effects": [
        {
          "type": "consume_materials",
          "materials": [
            {
              "id": {"var": "event.targets.material"},
              "quantity": {"var": "recipes[event.targets.recipe].materialRequired"}
            }
          ]
        },
        {
          "type": "apply_tool_durability",
          "tool": {"var": "event.targets.tool"},
          "usage": {"var": "recipes[event.targets.recipe].toolUsage"}
        },
        {
          "type": "create_item",
          "recipe": {"var": "event.targets.recipe"},
          "quality": {
            "var": "calculateCraftingQuality(entities[event.actorId].components['core:skills'].crafting, entities[event.targets.tool].components['core:item'].quality)"
          }
        }
      ]
    }
  ]
}
```

## Tutorial 4: Performance Optimization

### Scenario: Optimizing Rules for Large Target Sets

This tutorial shows how to optimize rules that handle many targets efficiently.

#### Efficient Target Processing

```json
{
  "id": "tutorial:optimize_large_targets",
  "name": "Optimized Large Target Processing",
  "conditions": [
    {
      "type": "json_logic",
      "logic": {
        "and": [
          {"var": "event.targets"},
          {">": [{"var": "event.targets | keys | length"}, 5]}
        ]
      }
    }
  ],
  "operations": [
    {
      "type": "batch_process_targets",
      "optimization": {
        "batchSize": 5,
        "parallelProcessing": true,
        "earlyTermination": true
      },
      "data": {
        "actor": {"var": "event.actorId"},
        "targetBatches": {
          "chunk": [
            {"var": "event.targets | entries"},
            5
          ]
        }
      }
    },
    {
      "type": "performance_monitor",
      "thresholds": {
        "maxProcessingTime": 100,
        "maxMemoryUsage": 1024
      }
    }
  ]
}
```

#### Performance Testing

```javascript
const performanceTest = async () => {
  const largeTargetEvent = {
    eventName: 'core:attempt_action',
    actorId: 'performance_actor',
    actionId: 'test:large_targets',
    targets: Object.fromEntries(
      Array.from({length: 20}, (_, i) => [`target_${i}`, `value_${i}`])
    ),
    targetId: 'target_0',
    originalInput: 'large target test',
    timestamp: Date.now()
  };

  const metrics = await testingFramework.validateRulePerformance(rule, {
    iterations: 100,
    timeout: 200
  });

  console.log(`Average execution time: ${metrics.timing.average}ms`);
  console.log(`Memory usage: ${metrics.memory.peakMB}MB`);
};
```

## Example Use Cases

### Combat System

```json
{
  "action": "combat:dual_wield_attack",
  "targets": {
    "primary_weapon": "sword_123",
    "secondary_weapon": "dagger_456", 
    "primary_target": "orc_789",
    "secondary_target": "goblin_012"
  }
}
```

### Spell Casting

```json
{
  "action": "magic:cast_spell",
  "targets": {
    "spell": "fireball_spell",
    "focus": "magic_staff",
    "component": "sulfur_powder",
    "primary_target": "enemy_group",
    "area": "battlefield_center"
  }
}
```

### Trading System

```json
{
  "action": "commerce:complex_trade",
  "targets": {
    "trader": "merchant_npc",
    "offering": "rare_gem",
    "requesting": "magic_sword",
    "currency": "gold_coins",
    "witness": "guild_representative"
  }
}
```

### Environmental Interaction

```json
{
  "action": "interaction:operate_device",
  "targets": {
    "device": "control_panel",
    "tool": "keycard",
    "power_source": "generator",
    "target_system": "security_doors"
  }
}
```

## Best Practices from Examples

### 1. Consistent Naming

Use descriptive, consistent names for target types:
- `primary_target`, `secondary_target` for multiple targets of same type
- `tool`, `material`, `location` for different functional roles
- `source`, `destination` for movement or transfer actions

### 2. Validation Layers

Always validate targets exist and are appropriate:

```json
{
  "validations": [
    {
      "name": "target_exists",
      "condition": {"var": "entities[event.targets.target]"}
    },
    {
      "name": "target_accessible",
      "condition": {"var": "isAccessible(event.actorId, event.targets.target)"}
    }
  ]
}
```

### 3. Graceful Fallbacks

Provide fallbacks for missing optional targets:

```json
{
  "weaponId": {
    "if": [
      {"var": "event.targets.weapon"},
      {"var": "event.targets.weapon"},
      {"var": "entities[event.actorId].components['core:equipment'].mainHand"}
    ]
  }
}
```

### 4. Performance Monitoring

Include performance checks for complex operations:

```json
{
  "type": "performance_check",
  "thresholds": {
    "maxTargets": 10,
    "maxProcessingTime": 50
  }
}
```

## Troubleshooting Examples

### Common Issues and Solutions

#### Issue: Targets object is undefined

```javascript
// Problem: Rule expects targets but receives legacy format
"condition": {"var": "event.targets.item"}

// Solution: Add fallback check
"condition": {
  "if": [
    {"var": "event.targets"},
    {"var": "event.targets.item"},
    false
  ]
}
```

#### Issue: Performance degradation with many targets

```javascript
// Problem: Processing each target individually
"operations": [
  {
    "type": "foreach",
    "items": {"var": "event.targets | entries"},
    "operation": {"type": "slow_processing"}
  }
]

// Solution: Batch processing
"operations": [
  {
    "type": "batch_process",
    "batchSize": 5,
    "items": {"var": "event.targets | entries"}
  }
]
```

#### Issue: Memory leaks with large target objects

```javascript
// Problem: Storing entire target objects
"data": {"allTargets": {"var": "event.targets"}}

// Solution: Store only necessary target IDs
"data": {"targetIds": {"var": "event.targets | values"}}
```
```

## Testing Requirements

### 1. Documentation Validation

- **Accuracy**: All examples work as documented
- **Completeness**: All system components documented
- **Clarity**: Documentation is clear and understandable
- **Up-to-date**: All information reflects current implementation

### 2. Example Testing

- **Code examples**: All code examples execute correctly
- **Tutorial validation**: Step-by-step tutorials work as described
- **API documentation**: All API methods and parameters accurate
- **Performance claims**: All performance claims validated

### 3. Accessibility Testing

- **Multiple skill levels**: Documentation serves beginners and experts
- **Clear organization**: Information is easy to find and navigate
- **Practical focus**: Documentation enables actual implementation
- **Troubleshooting coverage**: Common issues addressed

## Success Criteria

1. **Complete Coverage**: All system aspects documented thoroughly
2. **Practical Utility**: Documentation enables successful implementation
3. **Accuracy**: All examples and APIs work as documented
4. **Maintainability**: Documentation structure supports easy updates
5. **User Feedback**: Positive feedback from developers using documentation

## Files Created

- `docs/multi-target-actions/system-architecture.md`
- `docs/multi-target-actions/developer-guide.md`
- `docs/multi-target-actions/api-reference.md`
- `docs/multi-target-actions/examples-and-tutorials.md`

## Files Modified

None (new documentation only)

## Validation Steps

1. Review all documentation for accuracy and completeness
2. Test all code examples and tutorials
3. Validate API documentation against implementation
4. Verify links and cross-references work correctly
5. Test documentation with actual developers

## Notes

- Documentation provides comprehensive coverage of multi-target system
- Examples are practical and tested
- API reference is complete and accurate
- Troubleshooting guides address common issues

## Risk Assessment

**Low Risk**: Documentation creation with no impact on system functionality. Documentation can be easily updated or corrected if issues are found.

## Next Steps

After this ticket completion:
1. Move to Ticket 16: Create Migration Utilities and Scripts
2. Develop automated migration tools for existing content
3. Create scripts for system deployment and maintenance