/**
 * @file Character prompt template for AI character responses
 * @description Defines the standard structure for character AI prompts
 */

/**
 * Standard character prompt template
 * Uses placeholder syntax {variableName} for substitution
 */
export const CHARACTER_PROMPT_TEMPLATE = `<task_definition>
{taskDefinitionContent}
</task_definition>

<character_persona>
{characterPersonaContent}
</character_persona>

<portrayal_guidelines>
{portrayalGuidelinesContent}
</portrayal_guidelines>

<world_context>
{worldContextContent}
</world_context>

<perception_log>
{perceptionLogContent}
</perception_log>

{thoughtsVoiceGuidance}

{thoughtsSection}

{notesVoiceGuidance}

{notesSection}

{goalsSection}

<available_actions_info>
{availableActionsInfoContent}
</available_actions_info>

<final_instructions>
{finalInstructionsContent}
</final_instructions>

<content_policy>
{contentPolicyContent}
</content_policy>

{assistantResponsePrefix}`;

export default CHARACTER_PROMPT_TEMPLATE;
