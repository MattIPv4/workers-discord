import {
    RouteBases,
    Routes,
    type RESTPostOAuth2AccessTokenResult,
    type RESTGetAPIApplicationCommandsResult,
    type RESTPostAPIApplicationCommandsJSONBody,
    type RESTPostAPIApplicationCommandsResult,
    type RESTPatchAPIApplicationCommandJSONBody,
    type RESTPatchAPIApplicationCommandResult,
    type RESTPostAPIWebhookWithTokenJSONBody,
    type RESTPostAPIWebhookWithTokenWaitResult,
    type RESTPatchAPIWebhookWithTokenMessageJSONBody,
    type RESTPatchAPIWebhookWithTokenMessageResult,
} from 'discord-api-types/rest';
import { type APIInteraction } from 'discord-api-types/payloads';

type Token = Pick<RESTPostOAuth2AccessTokenResult, 'access_token' | 'token_type'>;

/**
 * Make a request to a Discord API endpoint
 */
const api = async (endpoint: string, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', token?: Token, data?: any) => {
    const res = await fetch(
        `${RouteBases.api}${endpoint}`,
        {
            method,
            body: data !== undefined ? JSON.stringify(data) : undefined,
            headers: {
                ...(token !== undefined && { Authorization: `${token.token_type} ${token.access_token}` }),
                ...(data !== undefined && { 'Content-Type': 'application/json' }),
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
 */
export const grantToken = (clientId: string, clientSecret: string) =>
    api(`${Routes.oauth2TokenExchange()}?grant_type=client_credentials&scope=applications.commands.update`, 'POST', { token_type: 'Basic', access_token: btoa(clientId + ':' + clientSecret) })
        .then(res => res.json() as Promise<RESTPostOAuth2AccessTokenResult>);

/**
 * Get an application's commands
 */
export const getCommands = async (applicationId: string, token: Token, guildId?: string) =>
    api(guildId ? Routes.applicationGuildCommands(applicationId, guildId) : Routes.applicationCommands(applicationId), 'GET', token)
        .then(res => res.json() as Promise<RESTGetAPIApplicationCommandsResult>);

/**
 * Register a new command for an application
 */
export const registerCommand = async (applicationId: string, token: Token, data: RESTPostAPIApplicationCommandsJSONBody, guildId?: string) =>
    api(guildId ? Routes.applicationGuildCommands(applicationId, guildId) : Routes.applicationCommands(applicationId), 'POST', token, data)
        .then(res => res.json() as Promise<RESTPostAPIApplicationCommandsResult>);

/**
 * Update an existing command for an application
 */
export const updateCommand = async (applicationId: string, token: Token, commandId: string, data: RESTPatchAPIApplicationCommandJSONBody, guildId?: string) =>
    api(guildId ? Routes.applicationGuildCommand(applicationId, guildId, commandId) : Routes.applicationCommand(applicationId, commandId), 'PATCH', token, data)
        .then(res => res.json() as Promise<RESTPatchAPIApplicationCommandResult>);

/**
 * Remove an existing command for an application
 */
export const removeCommand = async (applicationId: string, token: Token, commandId: string, guildId?: string) =>
    api(guildId ? Routes.applicationGuildCommand(applicationId, guildId, commandId) : Routes.applicationCommand(applicationId, commandId), 'DELETE', token)
        .then(() => {});

/**
 * Send an additional response to an interaction
 */
export const sendAdditional = async (interaction: APIInteraction, data: RESTPostAPIWebhookWithTokenJSONBody) =>
    api(`${Routes.webhook(interaction.application_id, interaction.token)}?wait=true`, 'POST', undefined, data)
        .then(res => res.json() as Promise<RESTPostAPIWebhookWithTokenWaitResult>);

/**
 * Edit a deferred response to an interaction
 */
export const editDeferred = async (interaction: APIInteraction, data: RESTPatchAPIWebhookWithTokenMessageJSONBody) =>
    api(`${Routes.webhookMessage(interaction.application_id, interaction.token, interaction.message?.id || '@original')}?wait=true`, 'PATCH', undefined, data)
        .then(res => res.json() as Promise<RESTPatchAPIWebhookWithTokenMessageResult>);
