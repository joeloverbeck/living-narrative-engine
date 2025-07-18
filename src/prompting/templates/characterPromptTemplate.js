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

{assistantResponsePrefix}`;

export default CHARACTER_PROMPT_TEMPLATE;
