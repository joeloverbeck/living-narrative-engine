/**
 * @file Character prompt template for AI character responses
 * @description Defines the standard structure for character AI prompts
 * @version 2.0 - Constraint-first architecture (LLMROLPROARCANA-001)
 */

/**
 * Standard character prompt template - Version 2.0
 * Uses placeholder syntax {variableName} for substitution
 * 
 * ARCHITECTURE: Constraint-First Design
 * Places critical formatting and behavior rules at the beginning
 * to mitigate attention decay in long prompts (>6000 tokens)
 * 
 * Section Order (by design):
 * 1. System Constraints - Critical output format and behavior rules
 * 2. Content Policy - Mature content guidelines  
 * 3. Task Definition - What the character needs to do
 * 4. Character Identity - Persona, portrayal guidelines, goals
 * 5. World State - Location, entities, perception
 * 6. Execution Context - Available actions
 */
export const CHARACTER_PROMPT_TEMPLATE = `<system_constraints>
{finalInstructionsContent}
</system_constraints>

<content_policy>
{contentPolicyContent}
</content_policy>

<task_definition>
{taskDefinitionContent}
</task_definition>

<character_persona>
{characterPersonaContent}
</character_persona>

<portrayal_guidelines>
{portrayalGuidelinesContent}
</portrayal_guidelines>

{goalsSection}

<world_context>
{worldContextContent}
</world_context>

{perceptionLogVoiceGuidance}

<perception_log>
{perceptionLogContent}
</perception_log>

{thoughtsVoiceGuidance}

{thoughtsSection}

{notesVoiceGuidance}

{notesSection}

<available_actions_info>
{availableActionsInfoContent}
</available_actions_info>

{assistantResponsePrefix}`;

export default CHARACTER_PROMPT_TEMPLATE;
