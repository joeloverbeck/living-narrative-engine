// src/core/turns/interfaces/IActorTurnStrategy.js
// --- FILE START ---

/**
 * @typedef {import('./ITurnContext.js').ITurnContext} ITurnContext
 * // ITurnContext provides the strategy with necessary game state, actor info, and services.
 */

/**
 * @interface ITurnAction
 * @description
 * Represents an instance of an action that an actor has decided to take.
 * This object is crucial for a data-driven action system. It standardizes how an
 * actor's intended action is communicated from an IActorTurnStrategy (which decides
 * the action) to the turn state machine (e.g., AwaitingPlayerInputState which
 * receives it and ProcessingCommandState which consumes it).
 *
 * The core of this interface for processing is the `actionDefinitionId` and
 * `resolvedParameters`. The `actionDefinitionId` serves as a unique key to
 * an external data definition (e.g., a JSON file conforming to an action schema)
 * that describes the action's rules, effects, and any templated outputs. The
 * `resolvedParameters` object provides the specific inputs (e.g., target, item)
 * required for this particular instance of the action, as determined by the strategy.
 *
 * The `commandString` is considered secondary, useful for logging, debugging, or
 * displaying a human-readable history of commands, but should not be the primary
 * source for action execution logic.
 *
 * @property {string} actionDefinitionId - Cannot be null or undefined. The unique,
 * namespaced identifier for a data-defined action. This ID directly links to an
 * external definition that specifies the action's behavior, prerequisites,
 * and effects (e.g., "core:wait", "combat:basic_attack", "skill:fireball",
 * "item:use_potion"). Namespacing (e.g., "domain:action_name") is recommended
 * to avoid collisions and organize actions. This is the primary field for action processing.
 * @property {object} [resolvedParameters] - Optional. An object containing key-value
 * pairs for parameters specific to this instance of the action, resolved by the
 * IActorTurnStrategy. These parameters are used by the system when processing
 * the data-defined action linked by `actionDefinitionId`. For example:
 * `{ targetId: "enemy123", itemToUse: "potion_healing", coordinates: { x: 10, y: 5 } }`.
 * The structure of this object is flexible and depends on the requirements of the
 * specific action definition. This, along with `actionDefinitionId`, is a primary field for action processing.
 * @property {string} [commandString] - Optional. The raw input string from a player
 * or a generated command string from an AI. Primarily intended for logging,
 * display in UI command history, or debugging. It is not the primary driver for
 * action execution in a data-driven system. Examples: "attack goblin with sword",
 * "use health potion on self", "move north".
 */

/**
 * @interface IActorTurnStrategy
 * @description
 * Defines the contract for how an actor (human, AI, item with agency, etc.)
 * decides on an action to perform during its turn. Implementations of this
 * interface will encapsulate the specific logic for decision-making,
 * tailored to the nature of the actor.
 *
 * This strategy is a cornerstone of the decoupled turn-handling architecture,
 * enabling actor-agnostic turn states (like `AwaitingPlayerInputState` or an automated
 * `ExecuteChoiceState`) to function consistently regardless of the actor's type.
 * The turn handler (or the current turn state) will invoke `decideAction` on the
 * actor's current strategy to obtain its intended {@link ITurnAction}.
 *
 * @example
 * // For a human player:
 * class HumanPlayerStrategy extends IActorTurnStrategy {
 * // Assume a command parser is available, perhaps via context or injected.
 * // This parser would map input like "attack goblin" to an ITurnAction.
 * async decideAction(context) {
 * const rawInput = await context.getPlayerPromptService().prompt("Your command?");
 * // The parser would identify the action definition (e.g., "core:attack")
 * // and resolve targets/parameters (e.g., { target: "goblin_id" }).
 * // const parsedAction = this.commandParser.parse(rawInput, context);
 * // return parsedAction; // which should be of type ITurnAction
 * // Example return:
 * // return {
 * //   actionDefinitionId: "core:attack",
 * //   resolvedParameters: { targetId: "goblin_id" },
 * //   commandString: rawInput
 * // };
 * }
 * }
 *
 * @example
 * // For an AI agent (e.g., LLM-based):
 * class LLMAIStrategy extends IActorTurnStrategy {
 * constructor(llmService, actionResolver) {
 * super();
 * this.llmService = llmService;
 * this.actionResolver = actionResolver; // Helper to map LLM output to ITurnAction
 * }
 * async decideAction(context) {
 * // Gathers relevant game state from context, constructs a prompt,
 * // calls LLM, and parses the LLM's structured response (e.g., JSON)
 * // into an ITurnAction.
 * // const llmOutput = await this.llmService.generateChoice(context);
 * // return this.actionResolver.mapLLMOutputToTurnAction(llmOutput, context);
 * // Example return from actionResolver:
 * // return {
 * //   actionDefinitionId: "core:use_item",
 * //   resolvedParameters: { itemId: "potion_health_id", targetId: context.getActor().id }
 * // };
 * }
 * }
 */
export class IActorTurnStrategy {
    /**
     * Determines the action an actor will take for the current turn.
     *
     * This method is the core of the strategy. It must rely entirely on the
     * provided {@link ITurnContext} to access:
     * - The current actor (via `context.getActor()`).
     * - The current game state (via `context.getGame()`).
     * - Available action definitions (potentially via a service in the context that
     * allows querying possible actions based on `action-definition.schema.json`).
     * - Any available services, such as logging (`context.getLogger()`),
     * player prompting (`context.getPlayerPromptService()`), etc.
     *
     * The method is asynchronous (`async`) to robustly accommodate operations
     * that may not complete synchronously. This is essential for:
     * - Human-controlled actors: Waiting for input from a user interface.
     * - AI-controlled actors: Potentially making API calls to external services (like LLMs)
     * or performing complex, time-consuming computations.
     *
     * The strategy is responsible for resolving the player's or AI's intent into a
     * specific, data-defined action and any necessary parameters for that action's instance.
     *
     * @async
     * @param {ITurnContext} context - The turn context for the current turn. This object
     * provides all necessary information and capabilities
     * (e.g., `context.getActor()`, `context.getLogger()`,
     * `context.getPlayerPromptService()`, `context.getGame()`,
     * a service to query available/valid actions)
     * that the strategy might need to make an informed decision.
     * @returns {Promise<ITurnAction>} A Promise that resolves to an {@link ITurnAction}
     * object. This object identifies the data-defined action chosen
     * (e.g., via `actionDefinitionId`) and includes any parameters
     * resolved for this specific instance (e.g., `resolvedParameters`).
     * If the actor decides to take no overt action (e.g., a "pass turn"
     * scenario, often represented by a "core:wait" or "core:pass" action),
     * the strategy should still resolve with an appropriate
     * {@link ITurnAction} (e.g., `{ actionDefinitionId: 'core:wait' }`).
     * @throws {Error} If a decision cannot be formulated due to an internal error,
     * invalid state, or failure of a dependency. The calling
     * turn state or handler is expected to catch this error and manage
     * the turn lifecycle accordingly (e.g., by ending the turn with an error).
     */
    async decideAction(context) {
        // This is an interface method and must be implemented by concrete strategy classes.
        const actorId = context?.getActor()?.id || 'Unknown Actor';
        const errorMessage = `IActorTurnStrategy.decideAction(context) called on the abstract class or an incomplete implementation for actor '${actorId}'. Concrete strategies must override this method.`;

        const logger = context?.getLogger ? context.getLogger() : console;
        logger.error(errorMessage, {context});

        throw new Error(errorMessage);
    }
}

// --- FILE END ---