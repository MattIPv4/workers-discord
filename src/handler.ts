import {
    ApplicationWebhookType,
    InteractionType,
    InteractionResponseType,
    MessageFlags,
    type APIInteraction,
    type APIApplicationCommandInteraction,
    type APIMessageComponentInteraction,
    type APIWebhookEvent,
} from 'discord-api-types/payloads';
import type { Toucan } from 'toucan-js';
import { isValidRequest, PlatformAlgorithm } from 'discord-verify';

import {
    validateCommands,
    validateComponents,
    validateEvents,
    type Context,
    type Command,
    type Commands,
    type Component,
    type Components,
    type Event,
    type Events,
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
 * Handle an incoming Discord webhook event to the Worker
 */
const handleWebhookEvent = async <Ctx extends Context = Context, Req extends Request = Request, Sentry extends Toucan | undefined = undefined>(request: Req, context: Ctx, webhook: APIWebhookEvent, events: Events<Ctx, Req, Sentry>, sentry?: Sentry) => {
    if (!events[webhook.event.type])
        return new Response(null, { status: 204, headers: { 'Content-Type': 'application/json' } });

    // Sentry scope
    if (sentry) sentry.getScope().setTransactionName(`event: ${webhook.event.type}`);
    if (sentry) sentry.getScope().setTag('event', webhook.event.type);

    // Execute
    try {
        events[webhook.event.type].execute({
            webhook: webhook as any,
            wait: context.waitUntil.bind(context),
            request,
            context,
            sentry,
        });
        return new Response(null, { status: 204, headers: { 'Content-Type': 'application/json' } });
    } catch (err) {
        // Log any errors
        console.log(webhook);
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
 * Handle an incoming Discord webhook event to the Worker
 */
const handleWebhook = async <Ctx extends Context = Context, Req extends Request = Request, Sentry extends Toucan | undefined = undefined>(request: Req, context: Ctx, publicKey: string, events: Events<Ctx, Req, Sentry>, sentry?: Sentry) => {
    // Verify a legitimate request
    if (!await isValidRequest(request, publicKey, PlatformAlgorithm.Cloudflare))
        return new Response(null, { status: 401 });

    // Get the JSON payload for the webhook event
    const webhook = await request.json() as APIWebhookEvent;
    if (sentry) sentry.setRequestBody(webhook);

    // Handle different webhook event types
    switch (webhook.type) {
        // Handle a PING
        case ApplicationWebhookType.Ping:
            return new Response(null, { status: 204, headers: { 'Content-Type': 'application/json' } });

        // Handle an event
        case ApplicationWebhookType.Event:
            return handleWebhookEvent(request, context, webhook, events, sentry);

        // Unknown
        default:
            return new Response(null, { status: 501 });
    }
};

/**
 * Handle an incoming request to the Worker
 *
 *   - POST /interactions
 *   - POST /webhooks
 *   - GET  /health
 */
const handleRequest = async <Ctx extends Context = Context, Req extends Request = Request, Sentry extends Toucan | undefined = undefined>(request: Req, context: Ctx, publicKey: string, commands: Commands<Ctx, Req, Sentry>, components: Components<Ctx, Req, Sentry>, events: Events<Ctx, Req, Sentry>, sentry?: Sentry) => {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/interactions')
        return handleInteraction(request, context, publicKey, commands, components, sentry);

    if (request.method === 'POST' && url.pathname === '/webhooks')
        return handleWebhook(request, context, publicKey, events, sentry);

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
const createHandler = <Ctx extends Context = Context, Req extends Request = Request, Sentry extends Toucan | undefined = undefined>(commands: Command<Ctx, Req, Sentry>[], components: Component<Ctx, Req, Sentry>[], events: Event<Ctx, Req, Sentry>[], publicKey: string, warn = false) => {
    // Validate the commands, components and events given
    const cmds = validateCommands<Ctx, Req, Sentry>(commands, warn);
    const cmps = validateComponents<Ctx, Req, Sentry>(components, warn);
    const evts = validateEvents<Ctx, Req, Sentry>(events, warn);

    // Return the handler
    return (request: Req, context: Ctx, sentry?: Sentry) => handleRequest(request, context, publicKey, cmds, cmps, evts, sentry);
};

export default createHandler;
