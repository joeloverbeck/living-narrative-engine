# AJVVALENH-007: Build Schema Validation Debugger

## Priority: 4 - Medium-Low

## Problem Statement
When validation fails, developers struggle to understand exactly why and where the validation process went wrong. The current system provides error messages but no visibility into the validation decision tree, which schemas were tested, or why certain paths were taken. A validation debugger would provide deep insights into the validation process, making it easier to diagnose and fix issues.

## Current State
- Validation is a black box - input goes in, errors come out
- No visibility into which schemas were tested in anyOf arrays
- No way to see the validation decision path
- Difficult to understand why certain errors are generated
- No tooling to step through validation process

## Technical Requirements

### 1. Validation Debugger Architecture

```javascript
// src/validation/debugger/ValidationDebugger.js
export class ValidationDebugger {
  constructor({ ajvValidator, logger, options = {} }) {
    this.#ajvValidator = ajvValidator;
    this.#logger = logger;
    this.#options = {
      captureDecisionTree: true,
      captureSchemaTests: true,
      captureTimings: true,
      maxDepth: 10,
      ...options
    };
    
    this.#session = null;
    this.#hooks = new Map();
  }
  
  /**
   * Start a debugging session
   */
  startSession(sessionId = uuid()) {
    this.#session = {
      id: sessionId,
      startTime: Date.now(),
      operations: [],
      decisionTree: new DecisionTree(),
      schemaTests: [],
      errors: [],
      warnings: [],
      metrics: {}
    };
    
    this.#attachHooks();
    return sessionId;
  }
  
  /**
   * Debug a validation operation
   */
  async debugValidation(data, schemaId, options = {}) {
    if (!this.#session) {
      this.startSession();
    }
    
    const operation = {
      id: uuid(),
      timestamp: Date.now(),
      data: this.#sanitizeData(data),
      schemaId,
      options,
      trace: []
    };
    
    this.#session.operations.push(operation);
    
    // Wrap validator with debugging hooks
    const debuggedValidator = this.#wrapValidator();
    
    // Perform validation with tracing
    const result = await this.#tracedValidation(
      debuggedValidator,
      data,
      schemaId,
      operation
    );
    
    // Generate debug report
    operation.result = result;
    operation.report = this.#generateReport(operation);
    
    return operation.report;
  }
  
  /**
   * Get detailed trace of validation path
   */
  getValidationTrace() {
    if (!this.#session) {
      return null;
    }
    
    return {
      sessionId: this.#session.id,
      duration: Date.now() - this.#session.startTime,
      operations: this.#session.operations.map(op => ({
        id: op.id,
        schemaId: op.schemaId,
        valid: op.result?.valid,
        errorCount: op.result?.errors?.length || 0,
        trace: op.trace
      })),
      decisionTree: this.#session.decisionTree.serialize(),
      metrics: this.#calculateMetrics()
    };
  }
}
```

### 2. Decision Tree Visualization

```javascript
// src/validation/debugger/DecisionTree.js
export class DecisionTree {
  constructor() {
    this.root = null;
    this.currentNode = null;
    this.nodeCount = 0;
  }
  
  startDecision(type, context) {
    const node = {
      id: ++this.nodeCount,
      type,  // 'anyOf', 'allOf', 'oneOf', 'if/then', etc.
      context,
      children: [],
      result: null,
      timing: { start: performance.now() },
      metadata: {}
    };
    
    if (!this.root) {
      this.root = node;
    } else if (this.currentNode) {
      this.currentNode.children.push(node);
      node.parent = this.currentNode;
    }
    
    this.currentNode = node;
    return node.id;
  }
  
  recordTest(schemaRef, data, path) {
    if (!this.currentNode) return;
    
    this.currentNode.metadata.tests = this.currentNode.metadata.tests || [];
    this.currentNode.metadata.tests.push({
      schemaRef,
      dataPath: path,
      dataSnapshot: this.#truncateData(data),
      timestamp: performance.now()
    });
  }
  
  endDecision(nodeId, result, errors = []) {
    const node = this.#findNode(nodeId);
    if (!node) return;
    
    node.result = result;
    node.errors = errors;
    node.timing.end = performance.now();
    node.timing.duration = node.timing.end - node.timing.start;
    
    // Move back to parent
    if (node.parent) {
      this.currentNode = node.parent;
    }
  }
  
  visualize() {
    return this.#renderTree(this.root, 0);
  }
  
  #renderTree(node, depth = 0) {
    if (!node) return '';
    
    const indent = '  '.repeat(depth);
    const status = node.result ? '✓' : '✗';
    const duration = node.timing?.duration?.toFixed(2) || '?';
    
    let output = `${indent}${status} ${node.type} (${duration}ms)`;
    
    if (node.context) {
      output += ` - ${node.context}`;
    }
    
    if (node.errors?.length > 0) {
      output += `\n${indent}  Errors: ${node.errors.length}`;
    }
    
    if (node.children.length > 0) {
      output += '\n' + node.children
        .map(child => this.#renderTree(child, depth + 1))
        .join('\n');
    }
    
    return output;
  }
}
```

### 3. Schema Test Tracker

```javascript
// src/validation/debugger/SchemaTestTracker.js
export class SchemaTestTracker {
  constructor() {
    this.tests = [];
    this.schemaCache = new Map();
  }
  
  recordSchemaTest(schemaId, data, result, timing) {
    const test = {
      id: uuid(),
      timestamp: Date.now(),
      schemaId,
      schemaType: this.#getSchemaType(schemaId),
      dataType: data?.type || 'unknown',
      dataPath: this.#getCurrentPath(),
      result: result ? 'pass' : 'fail',
      timing,
      errors: result ? [] : this.#captureErrors()
    };
    
    this.tests.push(test);
    
    // Update schema statistics
    this.#updateSchemaStats(schemaId, result);
    
    return test;
  }
  
  getSchemaTestReport() {
    const report = {
      totalTests: this.tests.length,
      bySchema: {},
      byResult: {
        pass: 0,
        fail: 0
      },
      timeline: [],
      hotspots: []
    };
    
    // Aggregate by schema
    this.tests.forEach(test => {
      if (!report.bySchema[test.schemaId]) {
        report.bySchema[test.schemaId] = {
          tests: 0,
          passes: 0,
          fails: 0,
          avgTime: 0,
          errors: []
        };
      }
      
      const schemaStats = report.bySchema[test.schemaId];
      schemaStats.tests++;
      
      if (test.result === 'pass') {
        schemaStats.passes++;
        report.byResult.pass++;
      } else {
        schemaStats.fails++;
        report.byResult.fail++;
        schemaStats.errors.push(...test.errors);
      }
    });
    
    // Calculate averages
    Object.keys(report.bySchema).forEach(schemaId => {
      const stats = report.bySchema[schemaId];
      const timings = this.tests
        .filter(t => t.schemaId === schemaId)
        .map(t => t.timing);
      
      stats.avgTime = timings.reduce((a, b) => a + b, 0) / timings.length;
    });
    
    // Identify hotspots (schemas tested most frequently)
    report.hotspots = Object.entries(report.bySchema)
      .sort((a, b) => b[1].tests - a[1].tests)
      .slice(0, 5)
      .map(([schemaId, stats]) => ({
        schemaId,
        tests: stats.tests,
        failRate: (stats.fails / stats.tests * 100).toFixed(2) + '%'
      }));
    
    return report;
  }
}
```

### 4. Interactive Debugger CLI

```javascript
// scripts/validation-debugger.js
#!/usr/bin/env node

import { ValidationDebugger } from '../src/validation/debugger/ValidationDebugger.js';
import { createInterface } from 'readline';
import chalk from 'chalk';
import { loadOperation } from '../src/utils/fileUtils.js';

class ValidationDebuggerCLI {
  constructor() {
    this.debugger = new ValidationDebugger({
      options: {
        captureDecisionTree: true,
        captureSchemaTests: true,
        captureTimings: true
      }
    });
    
    this.rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: chalk.cyan('validator> ')
    });
  }
  
  async start() {
    console.log(chalk.green('Validation Debugger v1.0.0'));
    console.log(chalk.gray('Type "help" for commands\n'));
    
    this.rl.prompt();
    
    this.rl.on('line', async (line) => {
      const [command, ...args] = line.trim().split(' ');
      
      try {
        await this.handleCommand(command, args);
      } catch (error) {
        console.error(chalk.red('Error:'), error.message);
      }
      
      this.rl.prompt();
    });
  }
  
  async handleCommand(command, args) {
    switch (command) {
      case 'load':
        await this.loadFile(args[0]);
        break;
        
      case 'validate':
        await this.validate(args[0]);
        break;
        
      case 'trace':
        this.showTrace();
        break;
        
      case 'tree':
        this.showDecisionTree();
        break;
        
      case 'tests':
        this.showSchemaTests();
        break;
        
      case 'step':
        await this.stepThrough();
        break;
        
      case 'watch':
        await this.watchFile(args[0]);
        break;
        
      case 'export':
        await this.exportReport(args[0]);
        break;
        
      case 'help':
        this.showHelp();
        break;
        
      case 'exit':
        process.exit(0);
        
      default:
        console.log(chalk.yellow(`Unknown command: ${command}`));
    }
  }
  
  async validate(filePath) {
    console.log(chalk.blue(`\nValidating: ${filePath}`));
    
    const data = await loadOperation(filePath);
    const sessionId = this.debugger.startSession();
    
    console.log(chalk.gray(`Session: ${sessionId}\n`));
    
    // Show real-time validation progress
    this.debugger.on('schemaTest', (test) => {
      const icon = test.result ? chalk.green('✓') : chalk.red('✗');
      console.log(`  ${icon} Testing ${test.schemaId}`);
    });
    
    const report = await this.debugger.debugValidation(
      data,
      'operation.schema.json'
    );
    
    this.displayReport(report);
  }
  
  showDecisionTree() {
    const trace = this.debugger.getValidationTrace();
    if (!trace) {
      console.log(chalk.yellow('No validation session active'));
      return;
    }
    
    console.log(chalk.blue('\nDecision Tree:'));
    console.log(trace.decisionTree);
  }
  
  showSchemaTests() {
    const trace = this.debugger.getValidationTrace();
    if (!trace) {
      console.log(chalk.yellow('No validation session active'));
      return;
    }
    
    console.log(chalk.blue('\nSchema Tests:'));
    
    const tests = this.debugger.getSchemaTestReport();
    
    // Show summary
    console.log(chalk.white('Summary:'));
    console.log(`  Total Tests: ${tests.totalTests}`);
    console.log(`  Passed: ${chalk.green(tests.byResult.pass)}`);
    console.log(`  Failed: ${chalk.red(tests.byResult.fail)}`);
    
    // Show hotspots
    if (tests.hotspots.length > 0) {
      console.log(chalk.white('\nHotspots:'));
      tests.hotspots.forEach(hotspot => {
        console.log(`  ${hotspot.schemaId}: ${hotspot.tests} tests (${hotspot.failRate} fail rate)`);
      });
    }
  }
  
  async stepThrough() {
    console.log(chalk.blue('\nStep-through mode enabled'));
    console.log(chalk.gray('Press Enter to step, "c" to continue, "q" to quit\n'));
    
    this.debugger.enableStepMode();
    
    this.debugger.on('breakpoint', async (context) => {
      console.log(chalk.yellow(`\nBreakpoint: ${context.type}`));
      console.log(`  Schema: ${context.schemaId}`);
      console.log(`  Path: ${context.path}`);
      console.log(`  Data: ${JSON.stringify(context.data, null, 2)}`);
      
      const response = await this.prompt('Step> ');
      
      if (response === 'q') {
        this.debugger.disableStepMode();
      } else if (response === 'c') {
        this.debugger.continue();
      } else {
        this.debugger.step();
      }
    });
  }
  
  displayReport(report) {
    console.log(chalk.blue('\nValidation Report:'));
    console.log('─'.repeat(50));
    
    // Result
    const resultIcon = report.valid ? chalk.green('✓ VALID') : chalk.red('✗ INVALID');
    console.log(`Result: ${resultIcon}`);
    
    // Timing
    console.log(`Duration: ${report.timing.total}ms`);
    console.log(`  Structural: ${report.timing.structural}ms`);
    console.log(`  Content: ${report.timing.content}ms`);
    
    // Errors
    if (report.errors.length > 0) {
      console.log(chalk.red(`\nErrors (${report.errors.length}):`));
      report.errors.slice(0, 5).forEach(error => {
        console.log(`  • ${error.path}: ${error.message}`);
      });
      
      if (report.errors.length > 5) {
        console.log(chalk.gray(`  ... and ${report.errors.length - 5} more`));
      }
    }
    
    // Suggestions
    if (report.suggestions.length > 0) {
      console.log(chalk.yellow(`\nSuggestions:`));
      report.suggestions.forEach(suggestion => {
        console.log(`  → ${suggestion}`);
      });
    }
    
    console.log('─'.repeat(50));
  }
}

// Start CLI
const cli = new ValidationDebuggerCLI();
cli.start();
```

### 5. Web-Based Debugger UI

```html
<!-- tools/validation-debugger/index.html -->
<!DOCTYPE html>
<html>
<head>
  <title>Validation Debugger</title>
  <style>
    .debugger-container {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      padding: 20px;
    }
    
    .input-panel {
      border: 1px solid #ddd;
      padding: 10px;
    }
    
    .output-panel {
      border: 1px solid #ddd;
      padding: 10px;
    }
    
    .decision-tree {
      font-family: monospace;
      white-space: pre;
    }
    
    .schema-test {
      margin: 5px 0;
      padding: 5px;
      border-left: 3px solid #ddd;
    }
    
    .schema-test.pass {
      border-color: green;
    }
    
    .schema-test.fail {
      border-color: red;
    }
    
    .timeline {
      height: 100px;
      position: relative;
      background: #f5f5f5;
    }
    
    .timeline-event {
      position: absolute;
      height: 20px;
      background: #007bff;
      opacity: 0.7;
    }
  </style>
</head>
<body>
  <div class="debugger-container">
    <div class="input-panel">
      <h2>Input Data</h2>
      <textarea id="input-data" rows="20" cols="50">{
  "type": "IF",
  "parameters": {
    "condition": { "==": [1, 1] },
    "then_actions": []
  }
}</textarea>
      <br>
      <button onclick="validate()">Validate</button>
      <button onclick="stepThrough()">Step Through</button>
    </div>
    
    <div class="output-panel">
      <h2>Validation Results</h2>
      <div id="results">
        <!-- Results will be displayed here -->
      </div>
      
      <h3>Decision Tree</h3>
      <div id="decision-tree" class="decision-tree">
        <!-- Tree visualization here -->
      </div>
      
      <h3>Schema Tests</h3>
      <div id="schema-tests">
        <!-- Schema test results here -->
      </div>
      
      <h3>Timeline</h3>
      <div id="timeline" class="timeline">
        <!-- Timeline visualization here -->
      </div>
    </div>
  </div>
  
  <script src="debugger.js"></script>
</body>
</html>
```

## Success Criteria

### Functional Requirements
- [ ] Debugger captures full validation decision tree
- [ ] All schema tests are tracked and reported
- [ ] Step-through debugging works
- [ ] Timeline visualization shows validation flow
- [ ] Performance metrics are accurate

### Quality Requirements
- [ ] Debugging overhead <10% performance impact
- [ ] Reports are clear and actionable
- [ ] CLI tool is intuitive to use
- [ ] Web UI provides visual insights

## Test Requirements

### Unit Tests
- Test decision tree construction
- Test schema test tracking
- Test report generation
- Test performance impact

### Integration Tests
- Test with real validation scenarios
- Test step-through functionality
- Test export functionality
- Test with complex nested validations

## Dependencies
- Requires validation system to be hookable
- Should work with both current and future validation systems
- May need AJV plugin development

## Estimated Complexity
- **Effort**: 10-12 hours
- **Risk**: Medium (requires deep AJV integration)
- **Testing**: 3-4 hours

## Implementation Notes

### Key Features
1. **Real-time Tracking**: See validation as it happens
2. **Decision Visualization**: Understand why certain paths were taken
3. **Performance Profiling**: Identify slow schemas
4. **Interactive Debugging**: Step through validation
5. **Export Capability**: Save debug sessions for analysis

### Integration Points
1. Hook into AJV validation process
2. Wrap schema validators
3. Intercept error generation
4. Track timing at each step

## Definition of Done
- [ ] Core debugger implemented
- [ ] Decision tree tracking works
- [ ] Schema test tracking works
- [ ] CLI tool functional
- [ ] Web UI basic functionality
- [ ] Tests passing
- [ ] Documentation complete
- [ ] Performance impact acceptable

## Related Tickets
- AJVVALENH-003: Implement Pre-validation Type Checker
- AJVVALENH-006: Create Two-Phase Validation System
- AJVVALENH-008: Create Operation Validator CLI Tool

## Notes
This debugger will be invaluable for understanding complex validation failures and optimizing schema design. It transforms validation from a black box into a transparent, debuggable process. The tool should be designed to work with both the current anyOf approach and future discriminated union patterns.