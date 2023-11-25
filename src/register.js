import equal from 'deep-equal';
import { grantToken, getCommands, registerCommand, updateCommand, removeCommand, } from './api';
import { validateCommands, } from './structure';
const ratelimit = 20_000 / 5;
/**
 * Ensure a command option object has a consistent structure
 *
 * Useful when doing deep-equal checks for command option equality
 */
const consistentCommandOption = (obj) => ({
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
const updatedCommandProps = (oldCmd, newCmd) => ({
    name: oldCmd.name !== newCmd.name,
    description: oldCmd.description !== newCmd.description,
    options: !equal(oldCmd.options && oldCmd.options.map(consistentCommandOption), newCmd.options && newCmd.options.map(consistentCommandOption)),
});
/**
 * Filter an object to only include properties in a given diff
 */
const objectPatch = (obj, diff) => Object.entries(obj)
    .reduce((acc, [key, value]) => diff[key] ? { ...acc, [key]: value } : acc, {});
/**
 * Register or update commands with Discord
 */
const registerCommands = async (clientId, clientSecret, commands, warn = false, guildId) => {
    // Validate the provided commands
    const cmds = Object.values(validateCommands(commands, warn));
    // Get a token, and our existing commands, from Discord
    const token = await grantToken(clientId, clientSecret);
    const discordCommands = await getCommands(clientId, token, guildId);
    // Remove any commands that no longer exist in the code
    const toRemove = discordCommands.filter(cmd => !cmds.find(c => c.name === cmd.name));
    for (let i = 0; i < toRemove.length; i++) {
        // Naive avoidance of rate limits
        if (i >= 5)
            await new Promise(resolve => setTimeout(resolve, ratelimit));
        // Remove the command
        const command = toRemove[i];
        await removeCommand(clientId, token, command.id, guildId);
    }
    // Track the commands we've registered or updated
    const commandData = [];
    // Patch any commands that already exist in Discord
    const toPatch = cmds.reduce((arr, command) => {
        const discord = discordCommands.find(c => c.name === command.name);
        if (!discord)
            return arr;
        const diff = updatedCommandProps(discord, command);
        if (!Object.values(diff).includes(true)) {
            commandData.push({ ...discord, ...command });
            return arr;
        }
        return [...arr, { command, discord, diff }];
    }, []);
    for (let i = 0; i < toPatch.length; i++) {
        // Naive avoidance of rate limits
        if (i >= 5)
            await new Promise(resolve => setTimeout(resolve, ratelimit));
        // Get the props to patch and do the update
        const { command, discord, diff } = toPatch[i];
        const commandRecord = { ...command };
        const cmdPatch = objectPatch(commandRecord, diff);
        const data = await updateCommand(clientId, token, discord.id, cmdPatch, guildId);
        commandData.push({ ...command, ...data });
    }
    // Register any commands that're new in the code
    const toRegister = cmds.filter(cmd => !discordCommands.find(c => c.name === cmd.name));
    for (let i = 0; i < toRegister.length; i++) {
        // Naive avoidance of rate limits
        if (i >= 5)
            await new Promise(resolve => setTimeout(resolve, ratelimit));
        // Register the new command
        const command = toRegister[i];
        const data = await registerCommand(clientId, token, command, guildId);
        commandData.push({ ...command, ...data });
    }
    // Done
    return commandData;
};
export default registerCommands;
