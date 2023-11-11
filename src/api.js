import { RouteBases, Routes } from 'discord-api-types/rest';

/**
 * @typedef {Pick<import('discord-api-types/rest').RESTPostOAuth2AccessTokenResult, 'access_token' | 'token_type'>} Token
 */

/**
 * Make a request to a Discord API endpoint
 *
 * @param {string} endpoint Endpoint to request
 * @param {'GET' | 'POST' | 'PATCH' | 'DELETE'} method HTTP method to use
 * @param {Token} [token] Optional authorization token
 * @param {any} [data] Data to send as JSON
 * @returns {Promise<Response>}
 */
const api = async (endpoint, method, token = undefined, data = undefined) => {
    const res = await fetch(
        `${RouteBases.api}${endpoint}`,
        {
            method,
            body: data !== undefined ? JSON.stringify(data) : undefined,
            headers: {
                Authorization: token !== undefined
                    ? `${token.token_type} ${token.access_token}`
                    : undefined,
                'Content-Type': data !== undefined
                    ? 'application/json'
                    : undefined,
            },
        },
    );

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Received unexpected status code ${res.status} from ${method} ${endpoint} - ${text}`);
    }

    return res;
};

/**
 * Perform an OAuth2 token exchange
 *
 * @param {string} clientId Client ID
 * @param {string} clientSecret Client secret
 * @returns {Promise<import('discord-api-types/rest').RESTPostOAuth2AccessTokenResult>}
 */
export const grantToken = (clientId, clientSecret) => {
    const auth = Buffer.from(clientId + ':' + clientSecret).toString('base64');
    return api(`${Routes.oauth2TokenExchange()}?grant_type=client_credentials&scope=applications.commands.update`, 'POST', { token_type: 'Basic', access_token: auth })
        .then(res => res.json());
};

/**
 * Get an application's commands
 *
 * @param {string} applicationId Application ID
 * @param {Token} token OAuth2 token
 * @param {string} [guildId] Optional guild ID, to fetch guild-specific commands
 * @returns {Promise<import('discord-api-types/rest').RESTGetAPIApplicationCommandsResult>}
 */
export const getCommands = async (applicationId, token, guildId = undefined) =>
    api(guildId ? Routes.applicationGuildCommands(applicationId, guildId) : Routes.applicationCommands(applicationId), 'GET', token)
        .then(res => res.json());

/**
 * Register a new command for an application
 *
 * @param {string} applicationId Application ID
 * @param {Token} token OAuth2 token
 * @param {import('discord-api-types/rest').RESTPostAPIApplicationCommandsJSONBody} data Command data
 * @param {string} [guildId] Optional guild ID, to register a guild-specific command
 * @returns {Promise<import('discord-api-types/rest').RESTPostAPIApplicationCommandsResult>}
 */
export const registerCommand = async (applicationId, token, data, guildId = undefined) =>
    api(guildId ? Routes.applicationGuildCommands(applicationId, guildId) : Routes.applicationCommands(applicationId), 'POST', token, data)
        .then(res => res.json());

/**
 * Update an existing command for an application
 *
 * @param {string} applicationId Application ID
 * @param {Token} token OAuth2 token
 * @param {string} commandId Command ID
 * @param {import('discord-api-types/rest').RESTPatchAPIApplicationCommandJSONBody} data Command data
 * @param {string} [guildId] Optional guild ID, to update a guild-specific command
 * @returns {Promise<import('discord-api-types/rest').RESTPatchAPIApplicationCommandResult>}
 */
export const updateCommand = async (applicationId, token, commandId, data, guildId = undefined) =>
    api(guildId ? Routes.applicationGuildCommand(applicationId, guildId, commandId) : Routes.applicationCommand(applicationId, commandId), 'PATCH', token, data)
        .then(res => res.json());

/**
 * Remove an existing command for an application
 *
 * @param {string} applicationId Application ID
 * @param {Token} token OAuth2 token
 * @param {string} commandId Command ID
 * @param {string} [guildId] Optional guild ID, to remove a guild-specific command
 * @returns {Promise<void>}
 */
export const removeCommand = async (applicationId, token, commandId, guildId = undefined) =>
    api(guildId ? Routes.applicationGuildCommand(applicationId, guildId, commandId) : Routes.applicationCommand(applicationId, commandId), 'DELETE', token)
        .then(() => undefined);

/**
 * Send an additional response to an interaction
 *
 * @param {import('discord-api-types/payloads').APIApplicationCommandInteraction} interaction Command interaction to respond to
 * @param {import('discord-api-types/rest').RESTPostAPIWebhookWithTokenJSONBody} data Message data
 * @returns {Promise<import('discord-api-types/rest').RESTPostAPIWebhookWithTokenWaitResult>}
 */
export const sendAdditional = async (interaction, data) =>
    api(`${Routes.webhook(interaction.application_id, interaction.token)}?wait=true`, 'POST', undefined, data)
        .then(res => res.json());

/**
 * Edit a deferred response to an interaction
 *
 * @param {import('discord-api-types/payloads').APIApplicationCommandInteraction} interaction Command interaction to edit
 * @param {import('discord-api-types/rest').RESTPatchAPIWebhookWithTokenMessageJSONBody} data Message data
 * @returns {Promise<import('discord-api-types/rest').RESTPatchAPIWebhookWithTokenMessageResult>}
 */
export const editDeferred = async (interaction, data) =>
    api(`${Routes.webhookMessage(interaction.application_id, interaction.token, interaction.message?.id || '@original')}?wait=true`, 'PATCH', undefined, data)
        .then(res => res.json());
