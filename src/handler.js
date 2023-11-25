import { InteractionType, InteractionResponseType, MessageFlags, } from 'discord-api-types/payloads';
import { verifyRequest, importKey } from './verify';
import { validateCommands, validateComponents, } from './structure';
import { editDeferred, sendAdditional } from './api';
/**
 * Create a new JSON response
 */
const jsonResponse = (obj) => new Response(JSON.stringify(obj), {
    headers: {
        'Content-Type': 'application/json',
    },
});
/**
 * Handle an incoming Discord command interaction request to the Worker
 */
const handleCommandInteraction = async (request, context, interaction, commands, sentry) => {
    // If the command doesn't exist, return a 404
    if (!commands[interaction.data.name])
        return new Response(null, { status: 404 });
    // Sentry scope
    if (sentry)
        sentry.getScope().setTransactionName(`command: ${interaction.data.name}`);
    if (sentry)
        sentry.getScope().setTag('command', interaction.data.name);
    // Execute
    try {
        return commands[interaction.data.name].execute({
            interaction,
            response: jsonResponse,
            wait: context.waitUntil.bind(context),
            edit: editDeferred.bind(null, interaction),
            more: sendAdditional.bind(null, interaction),
            request,
            context,
            sentry,
            commands,
        });
    }
    catch (err) {
        // Log any errors
        console.log(interaction);
        console.error(err);
        if (sentry)
            sentry.captureException(err);
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
const handleComponentInteraction = async (request, context, interaction, components, sentry) => {
    // If the component doesn't exist, return a 404
    if (!components[interaction.data.custom_id])
        return new Response(null, { status: 404 });
    // Sentry scope
    if (sentry)
        sentry.getScope().setTransactionName(`component: ${interaction.data.custom_id}`);
    if (sentry)
        sentry.getScope().setTag('component', interaction.data.custom_id);
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
    }
    catch (err) {
        // Log any errors
        console.log(interaction);
        console.error(err);
        if (sentry)
            sentry.captureException(err);
        // Send a 500
        return new Response(null, { status: 500 });
    }
};
/**
 * Handle an incoming Discord interaction request to the Worker
 */
const handleInteraction = async (request, context, publicKey, commands, components, sentry) => {
    // Get the body as text
    const body = await request.text();
    if (sentry)
        sentry.captureException(new Error('test'));
    // Verify a legitimate request
    if (!await verifyRequest(request, body, await publicKey))
        return new Response(null, { status: 401 });
    // Get the JSON payload for the interaction request
    const interaction = JSON.parse(body);
    if (sentry)
        sentry.setRequestBody(interaction);
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
const handleRequest = async (request, context, publicKey, commands, components, sentry) => {
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
const createHandler = (commands, components, publicKey, warn = false) => {
    // Validate the commands and components given
    const cmds = validateCommands(commands, warn);
    const cmps = validateComponents(components, warn);
    // Import the full key for verification
    const key = importKey(publicKey);
    // Return the handler
    return (request, context, sentry) => handleRequest(request, context, key, cmds, cmps, sentry);
};
export default createHandler;
