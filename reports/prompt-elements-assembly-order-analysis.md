# Analysis Report: PromptElements and PromptAssemblyOrder Configuration

## Executive Summary

This report analyzes the current implementation of `promptElements` and `promptAssemblyOrder` properties in the LLM configuration system. The analysis reveals that these properties are indeed causing unnecessary configuration clutter and limiting flexibility, as suspected. I recommend consolidating these properties into a standardized prompt template system.

## Current System Analysis

### Configuration Redundancy

The `llm-configs.json` file contains identical `promptElements` and `promptAssemblyOrder` entries for all four LLM configurations:
- openrouter-claude-sonnet-4-toolcalling
- openrouter-claude-sonnet-4
- openrouter-qwen3-235b-a22b
- openrouter-valkyrie-49b-v1

Each configuration repeats the same 16 prompt elements and identical assembly order, consuming approximately 320 lines of JSON configuration.

### System Architecture

The prompt building pipeline follows this flow:

1. **Configuration Loading**: `LlmConfigManager` loads the LLM configuration including `promptElements` and `promptAssemblyOrder`
2. **Content Generation**: `AIPromptContentProvider` generates content for each element key (e.g., `taskDefinitionContent`, `characterPersonaContent`)
3. **Assembly**: `PromptBuilder` orchestrates the assembly using:
   - `AssemblerRegistry` to map element keys to assembler implementations
   - `PromptAssembler` to concatenate elements in the specified order
4. **Element Processing**: Different assemblers handle different element types:
   - `StandardElementAssembler` for most elements
   - Specialized assemblers for perception log, thoughts, notes, goals, and indexed choices

### Key Findings

1. **Static Content**: Elements like `task_definition`, `portrayal_guidelines`, `content_policy`, and `final_instructions` always contain the same static content loaded from `corePromptText.json`

2. **Fixed Structure**: The prompt structure is effectively hardcoded - all prompts follow the same pattern with the same elements in the same order

3. **Limited Flexibility**: The current system makes it difficult to:
   - Create prompts with different structures
   - Add new prompt types that don't need all elements
   - Experiment with different prompt formats

4. **Over-Engineering**: The assembler pattern with dynamic element registration is overly complex for what is essentially a static template with variable substitution

## Recommended Solution

### Option 1: Hardcoded Prompt Template (Recommended)

Replace the configurable element system with a single prompt template file that explicitly defines the structure:

```javascript
// src/prompting/templates/characterPromptTemplate.js
export const CHARACTER_PROMPT_TEMPLATE = `
<task_definition>
{taskDefinitionContent}
</task_definition>

<character_persona>
{characterPersonaContent}
</character_persona>

<portrayal_guidelines>
{portrayalGuidelinesContent}
</portrayal_guidelines>

<content_policy>
{contentPolicyContent}
</content_policy>

<world_context>
{worldContextContent}
</world_context>

<perception_log>
{perceptionLogContent}
</perception_log>

<thoughts>
{thoughtsContent}
</thoughts>

<notes>
{notesContent}
</notes>

<goals>
{goalsContent}
</goals>

<available_actions_info>
{availableActionsInfoContent}
</available_actions_info>

<indexed_choices>
{indexedChoicesContent}
</indexed_choices>

<user_input>
{userInputContent}
</user_input>

<final_instructions>
{finalInstructionsContent}
</final_instructions>

{assistantResponsePrefix}
`;
```

**Benefits:**
- Removes 1,200+ lines of configuration duplication
- Makes prompt structure immediately visible and understandable
- Simplifies the codebase by removing the assembler pattern
- Allows easy creation of alternative prompt templates
- Maintains the exact same output format

**Implementation Changes Required:**
1. Create prompt template files
2. Simplify PromptBuilder to use template substitution
3. Remove promptElements and promptAssemblyOrder from LLM configs
4. Remove assembler registry and individual assemblers
5. Update tests to use the new template system

### Option 2: Prompt Template References in Config

Keep a minimal configuration that references template names:

```json
{
  "configs": {
    "openrouter-claude-sonnet-4": {
      // ... other config ...
      "promptTemplate": "character-v1"
    }
  }
}
```

Then maintain a library of prompt templates that can be selected per configuration.

**Benefits:**
- Allows different LLMs to use different prompt structures if needed
- Maintains some configurability without duplication
- Still removes the complex assembler pattern

### Option 3: Enhanced Current System (Not Recommended)

Keep the current system but extract common configurations:

```json
{
  "promptTemplates": {
    "default": {
      "promptElements": [...],
      "promptAssemblyOrder": [...]
    }
  },
  "configs": {
    "openrouter-claude-sonnet-4": {
      "promptTemplate": "default"
    }
  }
}
```

**Why Not Recommended:**
- Still maintains unnecessary complexity
- Doesn't address the fundamental over-engineering issue
- Keeps configuration that never changes

## Impact Analysis

### Positive Impacts

1. **Code Simplification**: Remove ~500-1000 lines of assembler code and tests
2. **Configuration Reduction**: Remove ~1,200 lines of duplicate JSON configuration
3. **Maintainability**: Easier to understand and modify prompt structure
4. **Performance**: Slightly faster prompt assembly (though negligible in practice)
5. **Flexibility**: Easier to create new prompt types for different use cases

### Risks and Mitigations

1. **Breaking Change**: This is a significant architectural change
   - Mitigation: Implement in phases with thorough testing
   
2. **Test Updates**: Many tests rely on the current assembler pattern
   - Mitigation: Update tests incrementally, maintaining coverage

3. **Future Extensibility**: Hardcoding might limit future flexibility
   - Mitigation: Design template system to support multiple templates from the start

## Conclusion

The current `promptElements` and `promptAssemblyOrder` system is over-engineered for its actual use case. All LLM configurations use identical prompt structures, making the configurability unnecessary overhead. 

I strongly recommend Option 1 (Hardcoded Prompt Template) as it:
- Dramatically simplifies the codebase
- Makes the prompt structure transparent and maintainable
- Removes significant configuration duplication
- Maintains all current functionality while enabling easier future enhancements

The implementation would involve refactoring the prompt building system to use template substitution instead of dynamic assembly, resulting in a cleaner, more maintainable solution that better serves the project's needs.