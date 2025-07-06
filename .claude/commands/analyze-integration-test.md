# Analyze Integration Test

Comprehensive analysis of integration test suites to identify system flaws and improvement opportunities.

## Test Suite Path: $ARGUMENTS

## Analysis Process

### 1. **Validate Input**

- Verify the test file exists and is readable
- Confirm it's an integration test (path contains `/integration/` or filename contains `.integration.`)
- Check for valid Jest test structure
- Exit with clear error if validation fails

### 2. **Test Suite Discovery**

- Read and parse the test file
- Extract all describe blocks and their hierarchies
- List all test cases (it/test blocks) with descriptions
- Identify beforeEach/afterEach setup patterns
- Map imported modules to understand systems under test
- Extract mock configurations and dependencies

### 3. **Coverage Analysis**

- **Component Mapping**
  - List all components/services being tested
  - Identify their roles in the system
  - Check import paths to understand module structure

- **Scenario Coverage**
  - Categorize tests: happy path, edge cases, error conditions
  - Check for missing standard scenarios
  - Analyze assertion density and quality

- **Integration Points**
  - Map component interactions from test setup
  - Identify external dependencies
  - Analyze mock boundaries

### 4. **System Behavior Analysis**

- **Behavioral Contracts**
  - Extract expected behaviors from test descriptions
  - Map inputs to expected outputs
  - Identify state transformations

- **Data Flow Patterns**
  - Trace data through the system based on test cases
  - Identify transformation points
  - Map validation boundaries

- **Error Handling**
  - Catalog error scenarios tested
  - Check for comprehensive error coverage
  - Identify missing error cases

### 5. **Flaw Detection**

- **Test Quality Issues**
  - Overly complex setup (>50 lines) indicates system complexity
  - Excessive mocking suggests tight coupling
  - Brittle assertions on implementation details
  - Tests that test the mocks instead of the system

- **System Design Issues**
  - Circular dependencies evident in imports
  - God objects (too many responsibilities)
  - Missing abstraction layers
  - Violation of single responsibility principle

- **Performance Indicators**
  - Tests with timeouts or async complexity
  - Resource-intensive setup/teardown
  - Missing performance assertions

### 6. **Improvement Recommendations**

- **Architectural Improvements**
  - Based on coupling analysis
  - Suggest better separation of concerns
  - Recommend design patterns where applicable

- **Code Quality**
  - Identify refactoring opportunities
  - Suggest better abstractions
  - Recommend consistency improvements

- **Test Improvements**
  - Additional scenarios to cover
  - Better test organization
  - Improved assertion strategies

### 7. **Generate Report**

Create a markdown report with the following structure:

```markdown
# Integration Test Analysis Report

## Executive Summary

- Test Suite: [file path]
- Analysis Date: [current date]
- Overall Health Score: [1-10]
- Critical Issues: [count]
- Improvement Opportunities: [count]

## Test Suite Overview

- Total Test Cases: [number]
- Systems Under Test: [list with brief descriptions]
- Test Organization: [structure summary]
- Setup Complexity: [low/medium/high with metrics]

## Coverage Analysis

### Scenario Coverage

- Happy Path: [percentage and list]
- Edge Cases: [percentage and list]
- Error Handling: [percentage and list]
- Missing Scenarios: [list with priority]

### Component Coverage

- Tested Components: [list with test count each]
- Integration Points: [mapped relationships]
- Mock Boundaries: [analysis of what's real vs mocked]

## System Behavior Analysis

### Core Behaviors Tested

[For each major behavior:]

- Behavior: [description]
- Test Coverage: [which tests cover this]
- Completeness: [gaps identified]

### Data Flow Insights

- Input Patterns: [common patterns observed]
- Transformations: [key data transformations]
- Output Validation: [how outputs are verified]

## Identified Flaws

### Critical Issues

[For each critical issue:]

1. **[Issue Name]**
   - Description: [detailed explanation]
   - Evidence: [specific test references]
   - Impact: [system-wide effects]
   - Recommendation: [specific fix]

### Design Concerns

[For each design issue:]

1. **[Concern Name]**
   - Current State: [description]
   - Problems: [specific issues]
   - Suggested Improvement: [actionable recommendation]

## Improvement Opportunities

### Quick Wins (Low Effort, High Impact)

1. [Improvement with implementation steps]

### Strategic Improvements (Higher Effort, Long-term Benefits)

1. [Improvement with roadmap]

## Technical Debt Indicators

- Complexity Metrics: [specific measurements]
- Coupling Analysis: [tight coupling instances]
- Maintainability Concerns: [specific areas]

## Recommended Next Steps

1. [Prioritized action item]
2. [Prioritized action item]
3. [Prioritized action item]

## Appendix: Detailed Test Analysis

[Optional detailed breakdown of each test]
```

### 8. **Save Report**

- Save to `reports/integration-test-analysis-[timestamp].md`
- Display summary in console
- Provide path to full report

## Validation Commands

```bash
# Verify report was generated
ls reports/integration-test-analysis-*.md

# Check report structure
head -50 reports/integration-test-analysis-*.md
```

## Usage Example

```
# Analyze a specific integration test
claude --use-command analyze-integration-test tests/integration/EndToEndMemoryFlow.test.js
```

## Quality Checklist

- [ ] All test cases analyzed
- [ ] System behaviors identified
- [ ] Flaws categorized by severity
- [ ] Actionable recommendations provided
- [ ] Report is well-structured and readable
- [ ] Technical debt quantified
- [ ] Next steps are clear and prioritized
