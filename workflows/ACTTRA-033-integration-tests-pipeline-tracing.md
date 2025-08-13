# ACTTRA-033: Create Integration Tests for Pipeline Tracing

## Summary

Create comprehensive integration tests to validate action tracing through the complete discovery pipeline, ensuring all stages capture trace data correctly and integrate with the existing StructuredTrace system.

## Parent Issue

- **Phase**: Phase 5 - Testing & Documentation
- **Specification**: [Action Tracing System Implementation Specification](../specs/action-tracing-implementation.spec.md)
- **Overview**: [ACTTRA-000](./ACTTRA-000-implementation-overview.md)

## Description

This ticket focuses on creating integration tests that validate the action tracing system's behavior through the entire action discovery pipeline. The tests must verify that trace data is captured correctly at each pipeline stage (ComponentFiltering, PrerequisiteEvaluation, MultiTargetResolution, ActionFormatting) and that the enhanced tracing integrates seamlessly with the existing StructuredTrace infrastructure.

## Acceptance Criteria

- [ ] Integration test file created at `tests/integration/actions/tracing/actionTracingPipeline.integration.test.js`
- [ ] Tests cover all pipeline stages with tracing enabled
- [ ] Tests validate data capture at each stage
- [ ] Tests verify integration with existing StructuredTrace system
- [ ] Tests validate verbosity level filtering
- [ ] Tests confirm trace output to files
- [ ] Tests handle both legacy and multi-target actions
- [ ] All tests pass in CI/CD pipeline
- [ ] Performance impact is measured and within limits

## Technical Requirements

### Test File Structure

```javascript
// tests/integration/actions/tracing/actionTracingPipeline.integration.test.js

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ActionTracingIntegrationTestBed } from '../../../common/actions/actionTracingIntegrationTestBed.js';
import fs from 'fs/promises';
import path from 'path';

describe('Action Tracing - Pipeline Integration', () => {
  let testBed;
  const testOutputDir = './test-traces';

  beforeEach(async () => {
    testBed = new ActionTracingIntegrationTestBed();
    await testBed.initialize();
    
    // Ensure test output directory exists
    await fs.mkdir(testOutputDir, { recursive: true });
  });

  afterEach(async () => {
    await testBed.cleanup();
    
    // Clean up test traces
    try {
      await fs.rm(testOutputDir, { recursive: true, force: true });
    } catch (err) {
      // Directory might not exist
    }
  });

  // Test suites...
});
```

### Test Scenarios

#### 1. End-to-End Pipeline Tracing

```javascript
describe('End-to-End Pipeline Tracing', () => {
  it('should trace action through complete discovery pipeline', async () => {
    // Setup: Configure tracing for specific action
    await testBed.configureTracing({
      enabled: true,
      tracedActions: ['core:go'],
      outputDirectory: testOutputDir,
      verbosity: 'detailed'
    });

    // Create test actor and context
    const actor = testBed.createActor('player-1', {
      components: ['core:position', 'core:movement']
    });

    // Execute action discovery with tracing
    const result = await testBed.discoverActions(actor, {
      trace: true
    });

    // Verify actions discovered
    expect(result.validActions).toBeDefined();
    expect(result.validActions.length).toBeGreaterThan(0);

    // Verify trace files created
    const traceFiles = await fs.readdir(testOutputDir);
    expect(traceFiles.length).toBeGreaterThan(0);

    // Verify trace content
    const traceFile = traceFiles.find(f => f.includes('core-go'));
    expect(traceFile).toBeDefined();

    const traceContent = await fs.readFile(
      path.join(testOutputDir, traceFile),
      'utf-8'
    );
    const trace = JSON.parse(traceContent);

    // Verify all pipeline stages captured
    expect(trace.pipeline).toBeDefined();
    expect(trace.pipeline.componentFiltering).toBeDefined();
    expect(trace.pipeline.prerequisiteEvaluation).toBeDefined();
    expect(trace.pipeline.targetResolution).toBeDefined();
    expect(trace.pipeline.formatting).toBeDefined();
  });

  it('should handle multiple actions in single pipeline run', async () => {
    await testBed.configureTracing({
      enabled: true,
      tracedActions: ['core:go', 'core:take', 'core:use'],
      outputDirectory: testOutputDir
    });

    const actor = testBed.createActor('player-1', {
      components: ['core:position', 'core:movement', 'core:inventory']
    });

    const result = await testBed.discoverActions(actor, {
      trace: true
    });

    // Wait for async trace writing
    await testBed.waitForTraceOutput();

    const traceFiles = await fs.readdir(testOutputDir);
    
    // Should have traces for each configured action that was discovered
    const goTrace = traceFiles.find(f => f.includes('core-go'));
    const takeTrace = traceFiles.find(f => f.includes('core-take'));
    
    expect(goTrace).toBeDefined();
    expect(takeTrace).toBeDefined();
  });
});
```

#### 2. ComponentFilteringStage Tracing

```javascript
describe('ComponentFilteringStage Tracing', () => {
  it('should capture component filtering data', async () => {
    await testBed.configureTracing({
      enabled: true,
      tracedActions: ['core:go'],
      includeComponentData: true
    });

    const actor = testBed.createActor('player-1', {
      components: ['core:position', 'core:movement']
    });

    const trace = await testBed.executeStageWithTracing(
      'ComponentFilteringStage',
      { actor }
    );

    expect(trace.stages.component_filtering).toBeDefined();
    expect(trace.stages.component_filtering.actorId).toBe('player-1');
    expect(trace.stages.component_filtering.actorComponents).toContain('core:position');
    expect(trace.stages.component_filtering.actorComponents).toContain('core:movement');
    expect(trace.stages.component_filtering.candidateCount).toBeGreaterThan(0);
  });

  it('should filter components based on action requirements', async () => {
    await testBed.configureTracing({
      enabled: true,
      tracedActions: ['core:take'],
      includeComponentData: true
    });

    const actorWithInventory = testBed.createActor('player-1', {
      components: ['core:position', 'core:inventory']
    });

    const actorWithoutInventory = testBed.createActor('player-2', {
      components: ['core:position']
    });

    const trace1 = await testBed.executeStageWithTracing(
      'ComponentFilteringStage',
      { actor: actorWithInventory }
    );

    const trace2 = await testBed.executeStageWithTracing(
      'ComponentFilteringStage',
      { actor: actorWithoutInventory }
    );

    // Actor with inventory should pass filtering for 'take' action
    expect(trace1.stages.component_filtering.candidateCount).toBeGreaterThan(0);
    
    // Actor without inventory should not have 'take' as candidate
    expect(trace2.stages.component_filtering.candidateCount).toBe(0);
  });
});
```

#### 3. PrerequisiteEvaluationStage Tracing

```javascript
describe('PrerequisiteEvaluationStage Tracing', () => {
  it('should capture prerequisite evaluation details', async () => {
    await testBed.configureTracing({
      enabled: true,
      tracedActions: ['core:use'],
      includePrerequisites: true
    });

    const actor = testBed.createActor('player-1', {
      components: ['core:inventory'],
      data: {
        energy: 10
      }
    });

    const actionDef = testBed.createAction('core:use', {
      prerequisites: [
        { '>=': [{ var: 'actor.energy' }, 5] }
      ]
    });

    const trace = await testBed.executeStageWithTracing(
      'PrerequisiteEvaluationStage',
      { 
        actor,
        candidateActions: [actionDef]
      }
    );

    expect(trace.stages.prerequisite_evaluation).toBeDefined();
    expect(trace.stages.prerequisite_evaluation.prerequisites).toBeDefined();
    expect(trace.stages.prerequisite_evaluation.passed).toBe(true);
    expect(trace.stages.prerequisite_evaluation.actorId).toBe('player-1');
  });

  it('should trace failed prerequisites', async () => {
    await testBed.configureTracing({
      enabled: true,
      tracedActions: ['core:cast_spell'],
      includePrerequisites: true
    });

    const actor = testBed.createActor('player-1', {
      components: ['core:magic'],
      data: {
        mana: 5
      }
    });

    const actionDef = testBed.createAction('core:cast_spell', {
      prerequisites: [
        { '>=': [{ var: 'actor.mana' }, 10] }
      ]
    });

    const trace = await testBed.executeStageWithTracing(
      'PrerequisiteEvaluationStage',
      {
        actor,
        candidateActions: [actionDef]
      }
    );

    expect(trace.stages.prerequisite_evaluation.passed).toBe(false);
    expect(trace.stages.prerequisite_evaluation.prerequisites).toContain(
      expect.objectContaining({ '>=': expect.any(Array) })
    );
  });
});
```

#### 4. MultiTargetResolutionStage Tracing

```javascript
describe('MultiTargetResolutionStage Tracing', () => {
  it('should capture target resolution for legacy actions', async () => {
    await testBed.configureTracing({
      enabled: true,
      tracedActions: ['core:go'],
      includeTargets: true
    });

    const actor = testBed.createActor('player-1', {
      components: ['core:position'],
      position: { x: 0, y: 0 }
    });

    const actionDef = testBed.createLegacyAction('core:go', {
      target: 'core:clear_directions'
    });

    const trace = await testBed.executeStageWithTracing(
      'MultiTargetResolutionStage',
      {
        actor,
        candidateActions: [actionDef],
        actionContext: testBed.createActionContext()
      }
    );

    expect(trace.stages.target_resolution).toBeDefined();
    expect(trace.stages.target_resolution.isLegacy).toBe(true);
    expect(trace.stages.target_resolution.targetCount).toBeGreaterThan(0);
    expect(trace.stages.target_resolution.resolvedTargets).toBeDefined();
  });

  it('should capture multi-target resolution', async () => {
    await testBed.configureTracing({
      enabled: true,
      tracedActions: ['core:examine'],
      includeTargets: true
    });

    const actor = testBed.createActor('player-1', {
      components: ['core:position']
    });

    const actionDef = testBed.createMultiTargetAction('core:examine', {
      targets: {
        object: 'visible_objects',
        character: 'visible_characters'
      }
    });

    // Add some targets to the environment
    testBed.addObject('sword', { visible: true });
    testBed.addCharacter('npc-1', { visible: true });

    const trace = await testBed.executeStageWithTracing(
      'MultiTargetResolutionStage',
      {
        actor,
        candidateActions: [actionDef],
        actionContext: testBed.createActionContext()
      }
    );

    expect(trace.stages.target_resolution.isLegacy).toBe(false);
    expect(trace.stages.target_resolution.targetKeys).toContain('object');
    expect(trace.stages.target_resolution.targetKeys).toContain('character');
    expect(trace.stages.target_resolution.targetCount).toBeGreaterThan(0);
  });
});
```

#### 5. ActionFormattingStage Tracing

```javascript
describe('ActionFormattingStage Tracing', () => {
  it('should capture formatting template and parameters', async () => {
    await testBed.configureTracing({
      enabled: true,
      tracedActions: ['core:go']
    });

    const actor = testBed.createActor('player-1');
    
    const actionDef = testBed.createAction('core:go', {
      commandTemplate: 'go {direction}',
      displayName: 'Go {direction}'
    });

    const actionWithTargets = {
      actionDef,
      targetContexts: [{ direction: 'north', displayName: 'North' }]
    };

    const trace = await testBed.executeStageWithTracing(
      'ActionFormattingStage',
      {
        actor,
        actionsWithTargets: [actionWithTargets]
      }
    );

    expect(trace.stages.formatting).toBeDefined();
    expect(trace.stages.formatting.template).toBe('go {direction}');
    expect(trace.stages.formatting.formattedCommand).toBe('go north');
    expect(trace.stages.formatting.displayName).toContain('North');
    expect(trace.stages.formatting.hasTargets).toBe(true);
    expect(trace.stages.formatting.targetCount).toBe(1);
  });

  it('should handle actions without targets', async () => {
    await testBed.configureTracing({
      enabled: true,
      tracedActions: ['core:rest']
    });

    const actor = testBed.createActor('player-1');
    
    const actionDef = testBed.createAction('core:rest', {
      command: 'rest',
      displayName: 'Rest'
    });

    const actionWithTargets = {
      actionDef,
      targetContexts: []
    };

    const trace = await testBed.executeStageWithTracing(
      'ActionFormattingStage',
      {
        actor,
        actionsWithTargets: [actionWithTargets]
      }
    );

    expect(trace.stages.formatting.hasTargets).toBe(false);
    expect(trace.stages.formatting.targetCount).toBe(0);
    expect(trace.stages.formatting.formattedCommand).toBe('rest');
  });
});
```

#### 6. Verbosity Level Testing

```javascript
describe('Verbosity Level Filtering', () => {
  it('should include minimal data with minimal verbosity', async () => {
    await testBed.configureTracing({
      enabled: true,
      tracedActions: ['core:go'],
      verbosity: 'minimal'
    });

    const actor = testBed.createActor('player-1');
    const result = await testBed.discoverActions(actor, { trace: true });
    
    const trace = await testBed.getLatestTrace('core:go');
    
    expect(trace.actionId).toBeDefined();
    expect(trace.actorId).toBeDefined();
    expect(trace.timestamp).toBeDefined();
    expect(trace.result).toBeDefined();
    
    // Should not include detailed stage data
    expect(trace.pipeline.componentFiltering.actorComponents).toBeUndefined();
  });

  it('should include all data with verbose level', async () => {
    await testBed.configureTracing({
      enabled: true,
      tracedActions: ['core:go'],
      verbosity: 'verbose',
      includeComponentData: true,
      includePrerequisites: true,
      includeTargets: true
    });

    const actor = testBed.createActor('player-1', {
      components: ['core:position', 'core:movement']
    });
    
    const result = await testBed.discoverActions(actor, { trace: true });
    const trace = await testBed.getLatestTrace('core:go');
    
    // Should include all detailed data
    expect(trace.pipeline.componentFiltering.actorComponents).toBeDefined();
    expect(trace.pipeline.componentFiltering.requiredComponents).toBeDefined();
    expect(trace.pipeline.prerequisiteEvaluation).toBeDefined();
    expect(trace.pipeline.targetResolution).toBeDefined();
    expect(trace.pipeline.formatting).toBeDefined();
  });
});
```

#### 7. Performance Impact Testing

```javascript
describe('Performance Impact', () => {
  it('should have minimal overhead when tracing is disabled', async () => {
    await testBed.configureTracing({
      enabled: false,
      tracedActions: []
    });

    const actor = testBed.createActor('player-1');
    
    const startTime = performance.now();
    await testBed.discoverActions(actor, { trace: false });
    const durationWithoutTracing = performance.now() - startTime;
    
    expect(durationWithoutTracing).toBeLessThan(5); // < 5ms
  });

  it('should handle concurrent pipeline processing', async () => {
    await testBed.configureTracing({
      enabled: true,
      tracedActions: ['*'], // Trace all actions
      verbosity: 'standard'
    });

    const actors = [];
    for (let i = 0; i < 10; i++) {
      actors.push(testBed.createActor(`player-${i}`));
    }

    const promises = actors.map(actor => 
      testBed.discoverActions(actor, { trace: true })
    );

    const startTime = performance.now();
    await Promise.all(promises);
    const duration = performance.now() - startTime;
    
    // Should handle 10 concurrent discoveries efficiently
    expect(duration).toBeLessThan(100); // < 100ms total
    
    // Verify all traces were written
    await testBed.waitForTraceOutput();
    const traceFiles = await fs.readdir(testOutputDir);
    expect(traceFiles.length).toBeGreaterThan(0);
  });
});
```

### Test Bed Requirements

Create `tests/common/actions/actionTracingIntegrationTestBed.js`:

```javascript
export class ActionTracingIntegrationTestBed {
  constructor() {
    this.container = null;
    this.discoveryService = null;
    this.entityManager = null;
    this.configLoader = null;
    this.outputDir = './test-traces';
  }

  async initialize() {
    // Setup dependency injection container
    this.container = await this.createTestContainer();
    
    // Get services
    this.discoveryService = this.container.resolve('IActionDiscoveryService');
    this.entityManager = this.container.resolve('IEntityManager');
    this.configLoader = this.container.resolve('IConfigLoader');
    
    // Initialize services
    await this.discoveryService.initialize();
  }

  async configureTracing(config) {
    const fullConfig = {
      actionTracing: {
        enabled: config.enabled || false,
        tracedActions: config.tracedActions || [],
        outputDirectory: config.outputDirectory || this.outputDir,
        verbosity: config.verbosity || 'standard',
        includeComponentData: config.includeComponentData || false,
        includePrerequisites: config.includePrerequisites || false,
        includeTargets: config.includeTargets || false
      }
    };

    await this.configLoader.setConfig(fullConfig);
  }

  createActor(id, options = {}) {
    const actor = this.entityManager.createEntity(id);
    
    if (options.components) {
      options.components.forEach(comp => {
        actor.addComponent(comp, options.data || {});
      });
    }

    return actor;
  }

  createAction(id, definition) {
    return {
      id,
      requiredComponents: definition.requiredComponents || [],
      prerequisites: definition.prerequisites || [],
      commandTemplate: definition.commandTemplate,
      command: definition.command,
      displayName: definition.displayName,
      ...definition
    };
  }

  createLegacyAction(id, definition) {
    return {
      id,
      target: definition.target,
      command: definition.command || id,
      ...definition
    };
  }

  createMultiTargetAction(id, definition) {
    return {
      id,
      targets: definition.targets,
      commandTemplate: definition.commandTemplate,
      ...definition
    };
  }

  async discoverActions(actor, options = {}) {
    return await this.discoveryService.getValidActions(
      actor,
      this.createActionContext(),
      options
    );
  }

  async executeStageWithTracing(stageName, context) {
    // Execute specific pipeline stage with tracing
    const stage = this.container.resolve(`I${stageName}`);
    const trace = this.container.resolve('ITraceContextFactory')();
    
    const enhancedContext = {
      ...context,
      trace
    };

    await stage.execute(enhancedContext);
    
    return trace.getTracedActions().get(context.actionDef?.id);
  }

  createActionContext() {
    return {
      timestamp: Date.now(),
      environment: {},
      gameState: {}
    };
  }

  async waitForTraceOutput(timeout = 100) {
    return new Promise(resolve => setTimeout(resolve, timeout));
  }

  async getLatestTrace(actionId) {
    const files = await fs.readdir(this.outputDir);
    const actionFiles = files.filter(f => 
      f.includes(actionId.replace(':', '-'))
    );
    
    if (actionFiles.length === 0) return null;
    
    // Sort by timestamp in filename
    actionFiles.sort().reverse();
    
    const content = await fs.readFile(
      path.join(this.outputDir, actionFiles[0]),
      'utf-8'
    );
    
    return JSON.parse(content);
  }

  async cleanup() {
    // Cleanup container and services
    if (this.container) {
      await this.container.dispose();
    }
  }
}
```

## Implementation Steps

1. **Create Test Bed** (60 minutes)
   - Setup integration test container
   - Implement service initialization
   - Create helper methods for test data

2. **Implement End-to-End Tests** (60 minutes)
   - Complete pipeline execution tests
   - Multiple action tracing tests
   - Trace file validation

3. **Implement Stage-Specific Tests** (90 minutes)
   - ComponentFilteringStage tests
   - PrerequisiteEvaluationStage tests
   - MultiTargetResolutionStage tests
   - ActionFormattingStage tests

4. **Implement Verbosity Tests** (30 minutes)
   - Test different verbosity levels
   - Validate data filtering
   - Verify output differences

5. **Implement Performance Tests** (30 minutes)
   - Measure tracing overhead
   - Test concurrent processing
   - Validate performance requirements

## Dependencies

### Depends On
- All pipeline stage implementations (ACTTRA-011 through ACTTRA-014)
- ActionAwareStructuredTrace implementation (ACTTRA-009)
- ActionTraceOutputService implementation (ACTTRA-024)

### Blocks
- End-to-end system testing
- Performance optimization work

## Estimated Effort

- **Estimated Hours**: 4 hours
- **Complexity**: Medium
- **Risk**: Medium (due to integration complexity)

## Success Metrics

- [ ] All integration tests pass consistently
- [ ] Full pipeline coverage achieved
- [ ] Performance requirements validated (<5ms overhead)
- [ ] Trace files generated correctly
- [ ] No race conditions in async operations
- [ ] Clear separation between test scenarios

## Notes

- Use real service implementations where possible
- Mock only external dependencies (file system, network)
- Ensure proper async handling throughout tests
- Test both success and failure paths
- Validate trace data structure at each stage
- Consider adding stress tests for high load scenarios

## Related Files

- Source: `src/actions/pipeline/stages/*.js`
- Test: `tests/integration/actions/tracing/actionTracingPipeline.integration.test.js`
- Test Bed: `tests/common/actions/actionTracingIntegrationTestBed.js`
- Similar Tests: `tests/integration/actions/actionDiscoveryService.integration.test.js`

---

**Ticket Status**: Ready for Development
**Priority**: High (Phase 5 - Testing)
**Labels**: testing, integration-test, action-tracing, phase-5, pipeline