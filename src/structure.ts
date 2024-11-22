import type {
    RESTPatchAPIWebhookWithTokenMessageJSONBody,
    RESTPatchAPIWebhookWithTokenMessageResult,
    RESTPostAPIWebhookWithTokenJSONBody,
    RESTPostAPIWebhookWithTokenWaitResult,
} from 'discord-api-types/rest';
import type {
    APIInteraction,
    APIMessageComponentInteraction,
    APIApplicationCommandOption,
    ApplicationIntegrationType,
    InteractionContextType,
    APIChatInputApplicationCommandInteraction,
    APIUserApplicationCommandInteraction,
    APIMessageApplicationCommandInteraction,
    APIApplicationCommandInteraction
} from 'discord-api-types/payloads';
import {
    ApplicationCommandType
} from 'discord-api-types/payloads';
import type { Toucan } from 'toucan-js';

export interface Context {
    waitUntil: (promise: Promise<any>) => void;
}

interface Execute<Ctx extends Context = Context, Req extends Request = Request, Sentry extends Toucan | undefined = undefined, Interaction extends APIInteraction = APIInteraction> {
    interaction: Interaction;
    response: (data: any) => Response;
    wait: (promise: Promise<any>) => void;
    edit: (data: RESTPatchAPIWebhookWithTokenMessageJSONBody) => Promise<RESTPatchAPIWebhookWithTokenMessageResult>;
    more: (data: RESTPostAPIWebhookWithTokenJSONBody) => Promise<RESTPostAPIWebhookWithTokenWaitResult>;
    request: Req;
    context: Ctx;
    sentry?: Sentry;
}

export interface CommandMetaBase {
    name: string;
    type?: ApplicationCommandType | undefined;
    contexts?: {
        installation?: ApplicationIntegrationType[],
        interaction?: InteractionContextType[],
    };
}

export interface CommandMetaChatInput extends CommandMetaBase {
    type?: ApplicationCommandType.ChatInput | undefined;
    description: string;
    options?: APIApplicationCommandOption[];
}

export type CommandMeta = CommandMetaBase | CommandMetaChatInput;

interface CommandWithDescription<Ctx extends Context = Context, Req extends Request = Request, Sentry extends Toucan | undefined = undefined> extends CommandMetaChatInput {
    execute: (context: Execute<Ctx, Req, Sentry, APIChatInputApplicationCommandInteraction> & { commands: Commands<Ctx, Req, Sentry> }) => Promise<Response> | Response;
}

interface CommandUserContextMenu<Ctx extends Context = Context, Req extends Request = Request, Sentry extends Toucan | undefined = undefined> extends CommandMetaBase {
    type: ApplicationCommandType.User;
    execute: (context: Execute<Ctx, Req, Sentry, APIUserApplicationCommandInteraction> & { commands: Commands<Ctx, Req, Sentry> }) => Promise<Response> | Response;
}

interface CommandMessageContextMenu<Ctx extends Context = Context, Req extends Request = Request, Sentry extends Toucan | undefined = undefined> extends CommandMetaBase {
    type: ApplicationCommandType.Message;
    execute: (context: Execute<Ctx, Req, Sentry, APIMessageApplicationCommandInteraction> & { commands: Commands<Ctx, Req, Sentry> }) => Promise<Response> | Response;
}

export type Command<Ctx extends Context = Context, Req extends Request = Request, Sentry extends Toucan | undefined = undefined> = CommandWithDescription<Ctx, Req, Sentry> | CommandUserContextMenu<Ctx, Req, Sentry> | CommandMessageContextMenu<Ctx, Req, Sentry>

export interface Commands<Ctx extends Context = Context, Req extends Request = Request, Sentry extends Toucan | undefined = undefined> {
    [name: string]: Command<Ctx, Req, Sentry>;
}

export interface Component<Ctx extends Context = Context, Req extends Request = Request, Sentry extends Toucan | undefined = undefined> {
    name: string;
    execute: (context: Execute<Ctx, Req, Sentry> & { interaction: APIMessageComponentInteraction }) => Promise<Response> | Response;
}

export interface Components<Ctx extends Context = Context, Req extends Request = Request, Sentry extends Toucan | undefined = undefined> {
    [name: string]: Component<Ctx, Req, Sentry>;
}

/**
 * Validate that a given value is a {@link Command} object
 */
const isCommand = (value: any, warn = false): value is Command => {
    if (typeof value !== 'object' || value === null) {
        if (warn)
            console.warn('Expected command to be an object');
        return false;
    }

    if (typeof value.name !== 'string' || !value.name.length) {
        if (warn)
            console.warn('Expected command to have a name');
        return false;
    }

    if ((value.type === undefined || value.type === ApplicationCommandType.ChatInput || value.type === ApplicationCommandType.PrimaryEntryPoint)) {
        if ((typeof value.description !== 'string' || !value.description.length)){
            if (warn)
                console.warn('Expected ChatInput/PrimaryEntryPoint command to have a description');
            return false;
        }
    } else {
        if (value.description) {
            if (warn)
                console.warn('Expected ContextMenu command to have no description');
            return false;
        }

        if (Array.isArray(value.options) ? value.options.length > 0 : value.options !== undefined) {
            if (warn)
                console.warn("Expected ContextMenu command to have no options");
            return false;
        }
    }

    if (typeof value.execute !== 'function') {
        if (warn)
            console.warn('Expected command to have an execute function');
        return false;
    }

    return true;
};

/**
 * Commands can share the same name if they don't share the same type, see https://discord.com/developers/docs/interactions/application-commands#registering-a-command
 */
export const getCommandName = (cmd: Command) => `${cmd.name} (type: ${cmd.type ?? ApplicationCommandType.ChatInput})`
export const getInteractionName = (int: APIApplicationCommandInteraction) => `${int.data.name} (type: ${int.data.type})`

/**
 * Validate that a set of values are {@link Command} objects
 */
export const validateCommands = <Ctx extends Context = Context, Req extends Request = Request, Sentry extends Toucan | undefined = undefined>(cmds: any[], warn = false) =>
    cmds.reduce((acc, cmd) => {
        if (!isCommand(cmd, warn)) return acc;

        const name = getCommandName(cmd)

        // Check the command doesn't already exist
        if (acc[name]) {
            if (warn)
                console.warn(`Command ${name} already exists`);
            return acc;
        }

        // Add the command
        return {
            ...acc,
            [name]: cmd,
        };
    }, {}) as Commands<Ctx, Req, Sentry>;

/**
 * Validate that a given value is a {@link Component} object
 */
const isComponent = (value: any, warn = false): value is Component => {
    if (typeof value !== 'object' || value === null) {
        if (warn)
            console.warn('Expected component to be an object');
        return false;
    }

    if (typeof value.name !== 'string' || !value.name.length) {
        if (warn)
            console.warn('Expected component to have a name');
        return false;
    }

    if (typeof value.execute !== 'function') {
        if (warn)
            console.warn('Expected component to have an execute function');
        return false;
    }

    return true;
};

/**
 * Validate that a set of values are {@link Component} objects
 */
export const validateComponents = <Ctx extends Context = Context, Req extends Request = Request, Sentry extends Toucan | undefined = undefined>(cmps: any[], warn = false) =>
    cmps.reduce((acc, cmp) => {
        if (!isComponent(cmp, warn)) return acc;

        // Check the component doesn't already exist
        if (acc[cmp.name]) {
            if (warn)
                console.warn(`Component ${cmp.name} already exists`);
            return acc;
        }

        // Add the component
        return {
            ...acc,
            [cmp.name]: cmp,
        };
    }, {}) as Components<Ctx, Req, Sentry>;
