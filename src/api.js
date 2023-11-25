import { RouteBases, Routes, } from 'discord-api-types/rest';
/**
 * Make a request to a Discord API endpoint
 */
const api = async (endpoint, method, token, data) => {
    const res = await fetch(`${RouteBases.api}${endpoint}`, {
        method,
        body: data !== undefined ? JSON.stringify(data) : undefined,
        headers: {
            ...(token !== undefined && { Authorization: `${token.token_type} ${token.access_token}` }),
            ...(data !== undefined && { 'Content-Type': 'application/json' }),
        },
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Received unexpected status code ${res.status} from ${method} ${endpoint} - ${text}`);
    }
    return res;
};
/**
 * Perform an OAuth2 token exchange
 */
export const grantToken = (clientId, clientSecret) => api(`${Routes.oauth2TokenExchange()}?grant_type=client_credentials&scope=applications.commands.update`, 'POST', { token_type: 'Basic', access_token: btoa(clientId + ':' + clientSecret) })
    .then(res => res.json());
/**
 * Get an application's commands
 */
export const getCommands = async (applicationId, token, guildId) => api(guildId ? Routes.applicationGuildCommands(applicationId, guildId) : Routes.applicationCommands(applicationId), 'GET', token)
    .then(res => res.json());
/**
 * Register a new command for an application
 */
export const registerCommand = async (applicationId, token, data, guildId) => api(guildId ? Routes.applicationGuildCommands(applicationId, guildId) : Routes.applicationCommands(applicationId), 'POST', token, data)
    .then(res => res.json());
/**
 * Update an existing command for an application
 */
export const updateCommand = async (applicationId, token, commandId, data, guildId) => api(guildId ? Routes.applicationGuildCommand(applicationId, guildId, commandId) : Routes.applicationCommand(applicationId, commandId), 'PATCH', token, data)
    .then(res => res.json());
/**
 * Remove an existing command for an application
 */
export const removeCommand = async (applicationId, token, commandId, guildId) => api(guildId ? Routes.applicationGuildCommand(applicationId, guildId, commandId) : Routes.applicationCommand(applicationId, commandId), 'DELETE', token)
    .then(() => { });
/**
 * Send an additional response to an interaction
 */
export const sendAdditional = async (interaction, data) => api(`${Routes.webhook(interaction.application_id, interaction.token)}?wait=true`, 'POST', undefined, data)
    .then(res => res.json());
/**
 * Edit a deferred response to an interaction
 */
export const editDeferred = async (interaction, data) => api(`${Routes.webhookMessage(interaction.application_id, interaction.token, interaction.message?.id || '@original')}?wait=true`, 'PATCH', undefined, data)
    .then(res => res.json());
