# GOAPIMPL-009: Create Modder Authoring Guide

**Status**: Ready
**Priority**: MEDIUM
**Estimated Effort**: 2 days
**Dependencies**: GOAPIMPL-006 (Specification), GOAPIMPL-007 (Examples)
**Blocks**: None
**Parent**: GOAPSPECANA-001

## Problem Statement

Modders need a practical, tutorial-style guide to author refinement methods without needing to understand the full technical specification. This guide must:

1. Be accessible to non-developers
2. Provide step-by-step authoring workflows
3. Include common patterns and templates
4. Cover testing and debugging from modder perspective
5. Use clear, non-technical language
6. Focus on practical "how-to" rather than theory

Without this guide, modders will struggle to create effective refinement methods and may make common mistakes.

## Objective

Create a comprehensive, accessible authoring guide that enables modders to create refinement methods for planning tasks, covering all common patterns, testing strategies, and troubleshooting.

## Acceptance Criteria

- [ ] Complete authoring guide created at `docs/modding/authoring-refinement-methods.md`
- [ ] Guide is written in accessible, non-technical language
- [ ] Step-by-step workflows for common tasks
- [ ] Pattern library with copy-paste templates
- [ ] Testing section with practical examples
- [ ] Debugging section with common issues and solutions
- [ ] Guide uses examples from GOAPIMPL-007
- [ ] Guide is comprehensible to non-developers

## Document Structure

```markdown
# Authoring Refinement Methods for Planning Tasks

## 1. Introduction
   - What are refinement methods?
   - When do you need them?
   - How they work (high-level, non-technical)

## 2. Getting Started
   - Where refinement methods live in mods
   - File naming conventions
   - Basic structure template
   - Your first refinement method

## 3. Writing Simple Sequential Methods
   - Step-by-step workflow
   - Action references
   - Target bindings
   - Parameters
   - Complete example

## 4. Adding Conditional Logic
   - When to use conditionals
   - If-then-else structure
   - Common condition patterns
   - Complete example

## 5. Working with Parameters
   - Task parameters (what you get from planning)
   - Using parameters in actions
   - Transforming parameters
   - Storing results for later steps
   - Complete example

## 6. Multiple Methods per Task
   - Why multiple methods?
   - Applicability conditions
   - Method selection
   - Fallback behavior
   - Complete example

## 7. Common Patterns and Templates
   - Acquisition pattern (get item from somewhere)
   - Movement pattern (go somewhere and do something)
   - State accumulation pattern (use results from previous steps)
   - Conditional acquisition pattern (check before acquiring)
   - Copy-paste templates

## 8. Testing Your Refinement Methods
   - Manual testing strategies
   - How to verify methods work
   - Common test scenarios
   - Debug logging

## 9. Debugging Common Issues
   - Method not being selected
   - Condition always evaluates to false
   - Parameter not found
   - Action not executing
   - Troubleshooting checklist

## 10. Best Practices
    - Keep methods simple
    - Use descriptive names
    - Document complex logic
    - Test edge cases
    - Performance tips

## 11. Advanced Topics
    - Nested conditionals
    - Complex parameter transformations
    - Performance optimization
    - Method composition patterns
```

## Tasks

### 1. Write Introduction Section
- [ ] Explain what refinement methods are (in simple terms)
- [ ] Describe when refinement methods are needed
- [ ] Provide high-level overview of how they work
- [ ] Explain relationship to planning tasks and actions
- [ ] Set expectations for the guide
- [ ] Use concrete game scenario examples

### 2. Write Getting Started Section
- [ ] Document file locations (`mods/modId/refinement-methods/`)
- [ ] Explain file naming conventions
- [ ] Provide minimal refinement method template
- [ ] Walk through creating first refinement method
- [ ] Show how to reference from task
- [ ] Provide validation checklist

### 3. Write Simple Sequential Methods Section
- [ ] Provide step-by-step authoring workflow
- [ ] Explain action references (how to find actions)
- [ ] Document target bindings (with examples)
- [ ] Explain parameters (how to pass values to actions)
- [ ] Provide complete worked example (consume_nourishing_item simple)
- [ ] Include copy-paste template

### 4. Write Conditional Logic Section
- [ ] Explain when to use conditionals (in non-technical terms)
- [ ] Document if-then-else structure with visual diagram
- [ ] Provide common condition patterns:
  - Item in inventory
  - Actor at location
  - Actor knows about entity
  - Component value check
- [ ] Provide complete worked example (conditional acquisition)
- [ ] Include copy-paste template for conditionals

### 5. Write Parameters Section
- [ ] Explain what task parameters are
- [ ] Show how to access parameters (`task.params.item`)
- [ ] Document parameter use in action bindings
- [ ] Explain parameter transformations (simple examples)
- [ ] Document state accumulation with `storeResultAs`
- [ ] Provide complete worked example (multi-step with state)
- [ ] Include common parameter access patterns

### 6. Write Multiple Methods Section
- [ ] Explain why multiple methods are useful
- [ ] Document applicability conditions
- [ ] Explain method selection process (non-technical)
- [ ] Show fallback behavior examples
- [ ] Provide complete worked example (arm_self with multiple methods)
- [ ] Include template for multiple methods

### 7. Create Pattern Library
- [ ] Document acquisition pattern (get item, bring it back)
- [ ] Document movement pattern (go somewhere, do action)
- [ ] Document state accumulation pattern (use previous results)
- [ ] Document conditional acquisition pattern (check then get)
- [ ] Provide copy-paste template for each pattern
- [ ] Annotate templates with customization points
- [ ] Reference working examples from GOAPIMPL-007

### 8. Write Testing Section
- [ ] Document manual testing workflow
- [ ] Provide testing checklist:
  - Method gets selected
  - Actions execute in order
  - Parameters resolve correctly
  - Conditionals branch correctly
- [ ] Show how to verify execution (event logs, debug output)
- [ ] Provide test scenario examples
- [ ] Document common test cases (success, failure, edge cases)

### 9. Write Debugging Section
- [ ] List common issues with solutions:
  - Method not selected → Check applicability condition
  - Condition false → Check variable path, log values
  - Parameter undefined → Check task params, parameter path
  - Action not executing → Check action gates, target binding
- [ ] Provide troubleshooting flowchart
- [ ] Show how to use debug logging
- [ ] Document how to inspect state at each step
- [ ] Provide "what to check" checklist

### 10. Write Best Practices Section
- [ ] Keep methods simple (avoid complexity)
- [ ] Use descriptive method and step names
- [ ] Document complex conditional logic
- [ ] Test edge cases (empty inventory, missing items)
- [ ] Performance tips (avoid expensive conditions)
- [ ] Maintainability tips (use patterns, avoid duplication)

### 11. Write Advanced Topics Section
- [ ] Nested conditionals (when and how)
- [ ] Complex parameter transformations (computed values)
- [ ] Performance optimization (condition ordering)
- [ ] Method composition patterns (reusable methods)
- [ ] Document when to use advanced features vs. keeping it simple

### 12. Create Worksheets and Checklists
- [ ] Refinement method planning worksheet
- [ ] Action reference finder
- [ ] Parameter binding checklist
- [ ] Testing checklist
- [ ] Debugging checklist
- [ ] Place in separate files or appendices

### 13. Integrate Examples from GOAPIMPL-007
- [ ] Reference complete examples throughout guide
- [ ] Link to example files
- [ ] Use example code snippets in explanations
- [ ] Create cross-reference table (pattern → example)

### 14. Review and Polish
- [ ] Ensure language is accessible (no jargon)
- [ ] Check all examples are correct and complete
- [ ] Verify copy-paste templates work
- [ ] Add table of contents and section links
- [ ] Proofread for clarity
- [ ] Get feedback from test modders (if possible)

## Expected Outputs

1. **Modder Authoring Guide**: `docs/modding/authoring-refinement-methods.md`
   - Complete guide (20-25 pages)
   - Accessible language
   - Step-by-step workflows
   - Visual diagrams
   - Copy-paste templates
   - Complete examples

2. **Pattern Library**: Embedded in guide or separate file
   - 4-6 common patterns with templates
   - Annotated customization points
   - Working examples

3. **Worksheets and Checklists**: Appendices or separate files
   - Planning worksheet
   - Testing checklist
   - Debugging checklist

## Success Metrics

- Guide is comprehensible to non-developers
- Modders can create basic refinement methods from guide alone
- All templates are working and copy-pastable
- Common issues have clear solutions
- Testing section enables effective verification
- Debugging section helps solve most common problems
- Examples are realistic and helpful

## Notes

- Write for modders, not developers
- Focus on practical "how-to", not theory
- Use game scenarios, not abstract examples
- Provide lots of copy-paste templates
- Visual aids help (diagrams, flowcharts)
- Step-by-step workflows are key
- Testing and debugging are critical sections

## Key Spec References

- **GOAPIMPL-007**: Examples to reference throughout guide
- **GOAPIMPL-006**: Specification (for technical accuracy, but simplify for modders)
- **Existing**: Modding guides in `docs/modding/` (for tone and style)
