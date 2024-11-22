import type {
    APIApplicationCommand,
    APIApplicationCommandOption,
    ApplicationIntegrationType,
    InteractionContextType,
} from 'discord-api-types/payloads';
import { ApplicationCommandType } from 'discord-api-types/payloads';
import type { RESTPatchAPIApplicationCommandJSONBody } from 'discord-api-types/rest';
import { dequal } from 'dequal';
import type { Toucan } from 'toucan-js';

import {
    grantToken,
    getCommands,
    registerCommand,
    updateCommand,
    removeCommand,
} from './api';
import {
    validateCommands,
    type Context,
    type Command,
    type CommandMeta,
} from './structure';

interface Option {
    type: number;
    name: string;
    description: string;
    required: boolean;
    choices: any[];
    options: Option[];
}

const ratelimit = 20_000 / 5;

/**
 * Ensure a command option object has a consistent structure
 *
 * Useful when doing deep-equal checks for command option equality
 */
const consistentCommandOption = (obj: APIApplicationCommandOption): Option => ({
    type: obj.type,
    name: obj.name,
    description: obj.description,
    required: !!obj.required,
    choices: ('choices' in obj && obj.choices) || [],
    options: ('options' in obj && obj.options?.map(consistentCommandOption)) || [],
});

/**
 * Ensure an array of context types is consistent
 *
 * Useful when doing deep-equal checks for context type equality
 */
const consistentContexts = (arr: number[] | undefined) => arr && [ ...new Set(arr) ].sort();

/**
 * Get the patch required to update a command
 */
const updatedCommandProps = (oldCmd: CommandMeta, newCmd: CommandMeta) => {
    type Patch = Partial<{
        name: string;
        description: string;
        // ApplicationCommandType.PrimaryEntryPoint is not assignable to RESTPatchAPIApplicationCommandJSONBody
        type?: RESTPatchAPIApplicationCommandJSONBody['type'];
        options: APIApplicationCommandOption[];
        integration_types: ApplicationIntegrationType[];
        contexts: InteractionContextType[];
    }>;
    const patch: Patch = {};

    if (oldCmd.name !== newCmd.name) patch.name = newCmd.name;
    if (oldCmd.type !== (newCmd.type ?? ApplicationCommandType.ChatInput)) patch.type = newCmd.type as Patch['type'];

    if ((oldCmd as APIApplicationCommand).description !== (newCmd as APIApplicationCommand).description) patch.description = (newCmd as APIApplicationCommand).description;
    if (!dequal(
        (oldCmd as APIApplicationCommand).options?.map(consistentCommandOption),
        (newCmd as APIApplicationCommand).options?.map(consistentCommandOption),
    )) patch.options = (newCmd as APIApplicationCommand).options;
    if (!dequal(
        consistentContexts(oldCmd.contexts?.installation),
        consistentContexts(newCmd.contexts?.installation),
    )) patch.integration_types = newCmd.contexts?.installation;
    if (!dequal(
        consistentContexts(oldCmd.contexts?.interaction),
        consistentContexts(newCmd.contexts?.interaction),
    )) patch.contexts = newCmd.contexts?.interaction;

    return patch;
};

/**
 * Register or update commands with Discord
 */
const registerCommands = async <Ctx extends Context = Context, Req extends Request = Request, Sentry extends Toucan | undefined = undefined>(clientId: string, clientSecret: string, commands: Command<Ctx, Req, Sentry>[], warn = false, guildId?: string) => {
    // Validate the provided commands
    const cmds = Object.values(validateCommands<Ctx, Req, Sentry>(commands, warn));

    // Get a token, and our existing commands, from Discord
    const token = await grantToken(clientId, clientSecret);
    const discordCommands = await getCommands(clientId, token, guildId);

    // Remove any commands that no longer exist in the code
    const toRemove = discordCommands.filter(cmd => !cmds.find(c => c.name === cmd.name));
    for (let i = 0; i < toRemove.length; i++) {
        // Naive avoidance of rate limits
        if (i >= 5) await new Promise(resolve => setTimeout(resolve, ratelimit));

        // Remove the command
        const command = toRemove[i];
        await removeCommand(clientId, token, command.id, guildId);
    }

    // Track the commands we've registered or updated
    const commandData: (Command<Ctx, Req, Sentry> & { discord: APIApplicationCommand })[] = [];

    // Patch any commands that already exist in Discord
    const toPatch = cmds.reduce((arr, command) => {
        const discord = discordCommands.find(c => c.name === command.name && c.type === (command.type ?? ApplicationCommandType.ChatInput));
        if (!discord) return arr;

        const diff = updatedCommandProps({
            name: discord.name,
            description: discord.description,
            type: discord.type,
            options: discord.options,
            contexts: {
                installation: discord.integration_types,
                interaction: discord.contexts ?? undefined,
            }
        }, command);
        if (!Object.keys(diff).length) {
            commandData.push({ ...command, discord });
            return arr;
        }

        return [ ...arr, { command, discord, diff } ];
    }, [] as { command: Command<Ctx, Req, Sentry>; discord: APIApplicationCommand; diff: Partial<RESTPatchAPIApplicationCommandJSONBody> }[]);
    for (let i = 0; i < toPatch.length; i++) {
        // Naive avoidance of rate limits
        if (i >= 5) await new Promise(resolve => setTimeout(resolve, ratelimit));

        // Get the props to patch and do the update
        const { command, discord, diff } = toPatch[i];
        const data = await updateCommand(clientId, token, discord.id, diff, guildId);
        commandData.push({ ...command, discord: { ...discord, ...data } });
    }

    // Register any commands that're new in the code
    const toRegister = cmds.filter(cmd => !discordCommands.find(c => c.name === cmd.name && c.type === (cmd.type ?? ApplicationCommandType.ChatInput)));
    for (let i = 0; i < toRegister.length; i++) {
        // Naive avoidance of rate limits
        if (i >= 5) await new Promise(resolve => setTimeout(resolve, ratelimit));

        // Register the new command
        const command = toRegister[i];
        const data = await registerCommand(clientId, token, {
            name: command.name,
            description: (command as any).description,
            type: command.type,
            options: (command as any).options,
            integration_types: command.contexts?.installation,
            contexts: command.contexts?.interaction,
        }, guildId);
        commandData.push({ ...command, discord: data });
    }

    // Done
    return commandData;
};

export default registerCommands;
