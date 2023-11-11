import type {
    APIApplicationCommand,
    APIApplicationCommandOption,
} from 'discord-api-types/payloads';
import equal from 'deep-equal';
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
 * Check which properties of a command have changed
 */
const updatedCommandProps = (oldCmd: CommandMeta, newCmd: CommandMeta) => ({
    name: oldCmd.name !== newCmd.name,
    description: oldCmd.description !== newCmd.description,
    options: !equal(
        oldCmd.options && oldCmd.options.map(consistentCommandOption),
        newCmd.options && newCmd.options.map(consistentCommandOption),
    ),
});

type Filtered<T extends object, V> = Pick<T, {
    [K in keyof T]: T[K] extends V ? K : never
}[keyof T]>;

/**
 * Filter an object to only include properties in a given diff
 */
const objectPatch = <Obj extends Record<string, any>, Diff extends Record<string, boolean>>(obj: Obj, diff: Diff) => Object.entries(obj)
    .reduce((acc, [key, value]) => diff[key] ? { ...acc, [key]: value } : acc, {}) as Pick<Obj, Extract<keyof Filtered<Diff, true>, keyof Obj>>;

/**
 * Register or update commands with Discord
 */
const registerCommands = async <Req extends Request = Request, Ctx extends Context = Context, Sentry extends Toucan | undefined = undefined>(clientId: string, clientSecret: string, commands: Command<Req, Ctx, Sentry>[], warn = false, guildId?: string) => {
    // Validate the provided commands
    const cmds = Object.values(validateCommands<Req, Ctx, Sentry>(commands, warn));

    // Get a token, and our existing commands, from Discord
    const token = await grantToken(clientId, clientSecret);
    const discordCommands = await getCommands(clientId, token, guildId);

    // Remove any commands that no longer exist in the code
    for (const command of discordCommands) {
        if (cmds.find(cmd => cmd.name === command.name)) continue;
        await removeCommand(clientId, token, command.id, guildId);

        // Naive avoidance of rate limits
        await new Promise(resolve => setTimeout(resolve, 250));
    }

    // Register or update the commands with Discord
    const commandData: (Command<Req, Ctx, Sentry> & APIApplicationCommand)[] = [];
    for (const command of cmds) {
        // This command already exists in Discord
        const discordCommand = discordCommands.find(cmd => cmd.name === command.name);
        if (discordCommand) {
            // Get which props have changed
            const cmdDiff = updatedCommandProps(discordCommand, command);

            // Only patch if a prop has changed
            if (Object.values(cmdDiff).includes(true)) {
                // Get the props to patch and do the update
                const cmdPatch = objectPatch(command, cmdDiff);
                const data = await updateCommand(clientId, token, discordCommand.id, cmdPatch, guildId);
                commandData.push({ ...command, ...data });

                // Naive avoidance of rate limits
                await new Promise(resolve => setTimeout(resolve, 250));
                continue;
            }

            // Store the existing command, nothing changed
            commandData.push({ ...discordCommand, ...command });
            continue;
        }

        // Register the new command
        const data = await registerCommand(clientId, token, command, guildId);
        commandData.push({ ...command, ...data });

        // Naive avoidance of rate limits
        await new Promise(resolve => setTimeout(resolve, 250));
    }

    // Done
    return commandData;
};

export default registerCommands;
