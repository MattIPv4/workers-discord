import {
    InteractionType,
    InteractionResponseType,
    MessageFlags,
    type APIInteraction,
    type APIApplicationCommandInteraction,
    type APIMessageComponentInteraction,
} from 'discord-api-types/payloads';
import type { Toucan } from 'toucan-js';
import { isValidRequest, PlatformAlgorithm } from 'discord-verify';

import {
    validateCommands,
    validateComponents,
    type Context,
    type Command,
    type Commands,
    type Component,
    type Components,
    getInteractionName,
} from './structure';
import { editDeferred, sendAdditional } from './api';

/**
 * Create a new JSON response
 */
const jsonResponse = (obj: any) => new Response(JSON.stringify(obj), {
    headers: {
        'Content-Type': 'application/json',
    },
});

/**
 * Handle an incoming Discord command interaction request to the Worker
 */
const handleCommandInteraction = async <Ctx extends Context = Context, Req extends Request = Request, Sentry extends Toucan | undefined = undefined>(request: Req, context: Ctx, interaction: APIApplicationCommandInteraction, commands: Commands<Ctx, Req, Sentry>, sentry?: Sentry) => {
    const name = getInteractionName(interaction);

    // If the command doesn't exist, return a 404
    if (!commands[name])
        return new Response(null, { status: 404 });

    // Sentry scope
    if (sentry) sentry.getScope().setTransactionName(`command: ${name}`);
    if (sentry) sentry.getScope().setTag('command', name);

    // Execute
    try {
        return commands[name].execute({
            interaction: interaction as any,
            response: jsonResponse,
            wait: context.waitUntil.bind(context),
            edit: editDeferred.bind(null, interaction),
            more: sendAdditional.bind(null, interaction),
            request,
            context,
            sentry,
            commands,
        });
    } catch (err) {
        // Log any errors
        console.log(interaction);
        console.error(err);
        if (sentry) sentry.captureException(err);

        // Send an ephemeral message to the user
        return jsonResponse({
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
                content: 'An unexpected error occurred when executing the command.',
                flags: MessageFlags.Ephemeral,
            },
        });
    }
};

/**
 * Handle an incoming Discord component interaction request to the Worker
 */
const handleComponentInteraction = async <Ctx extends Context = Context, Req extends Request = Request, Sentry extends Toucan | undefined = undefined>(request: Req, context: Ctx, interaction: APIMessageComponentInteraction, components: Components<Ctx, Req, Sentry>, sentry?: Sentry) => {
    // If the component doesn't exist, return a 404
    if (!components[interaction.data.custom_id])
        return new Response(null, { status: 404 });

    // Sentry scope
    if (sentry) sentry.getScope().setTransactionName(`component: ${interaction.data.custom_id}`);
    if (sentry) sentry.getScope().setTag('component', interaction.data.custom_id);

    // Execute
    try {
        return components[interaction.data.custom_id].execute({
            interaction,
            response: jsonResponse,
            wait: context.waitUntil.bind(context),
            edit: editDeferred.bind(null, interaction),
            more: sendAdditional.bind(null, interaction),
            request,
            context,
            sentry,
        });
    } catch (err) {
        // Log any errors
        console.log(interaction);
        console.error(err);
        if (sentry) sentry.captureException(err);

        // Send a 500
        return new Response(null, { status: 500 });
    }
};

/**
 * Handle an incoming Discord interaction request to the Worker
 */
const handleInteraction = async <Ctx extends Context = Context, Req extends Request = Request, Sentry extends Toucan | undefined = undefined>(request: Req, context: Ctx, publicKey: string, commands: Commands<Ctx, Req, Sentry>, components: Components<Ctx, Req, Sentry>, sentry?: Sentry) => {
    // Verify a legitimate request
    if (!await isValidRequest(request, publicKey, PlatformAlgorithm.Cloudflare))
        return new Response(null, { status: 401 });

    // Get the JSON payload for the interaction request
    const interaction = await request.json() as APIInteraction;
    if (sentry) sentry.setRequestBody(interaction);

    // Handle different interaction types
    switch (interaction.type) {
        // Handle a PING
        case InteractionType.Ping:
            return jsonResponse({
                type: InteractionResponseType.Pong,
            });

        // Handle a command
        case InteractionType.ApplicationCommand:
            return handleCommandInteraction(request, context, interaction, commands, sentry);

        // Handle a component
        case InteractionType.MessageComponent:
            return handleComponentInteraction(request, context, interaction, components, sentry);

        // Unknown
        default:
            return new Response(null, { status: 501 });
    }
};

/**
 * Handle an incoming request to the Worker
 *
 *   - POST /interactions
 *   - GET  /health
 */
const handleRequest = async <Ctx extends Context = Context, Req extends Request = Request, Sentry extends Toucan | undefined = undefined>(request: Req, context: Ctx, publicKey: string, commands: Commands<Ctx, Req, Sentry>, components: Components<Ctx, Req, Sentry>, sentry?: Sentry) => {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/interactions')
        return handleInteraction(request, context, publicKey, commands, components, sentry);

    if (request.method === 'GET' && url.pathname === '/health')
        return new Response('OK', {
            headers: {
                'Content-Type': 'text/plain',
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                Expires: '0',
                'Surrogate-Control': 'no-store',
            },
        });
};

/**
 * Create a new Worker fetch handler for Discord interactions
 */
const createHandler = <Ctx extends Context = Context, Req extends Request = Request, Sentry extends Toucan | undefined = undefined>(commands: Command<Ctx, Req, Sentry>[], components: Component<Ctx, Req, Sentry>[], publicKey: string, warn = false) => {
    // Validate the commands and components given
    const cmds = validateCommands<Ctx, Req, Sentry>(commands, warn);
    const cmps = validateComponents<Ctx, Req, Sentry>(components, warn);

    // Return the handler
    return (request: Req, context: Ctx, sentry?: Sentry) => handleRequest(request, context, publicKey, cmds, cmps, sentry);
};

export default createHandler;
