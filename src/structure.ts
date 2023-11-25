import type {
    RESTPatchAPIWebhookWithTokenMessageJSONBody,
    RESTPatchAPIWebhookWithTokenMessageResult,
    RESTPostAPIWebhookWithTokenJSONBody,
    RESTPostAPIWebhookWithTokenWaitResult,
} from 'discord-api-types/rest';
import type {
    APIInteraction,
    APIApplicationCommandInteraction,
    APIMessageComponentInteraction,
    APIApplicationCommandOption,
} from 'discord-api-types/payloads';
import type { Toucan } from 'toucan-js';

export interface Context {
    waitUntil: (promise: Promise<unknown>) => void;
}

interface Execute<Ctx extends Context = Context, Req extends Request = Request, Sentry extends Toucan | undefined = undefined> {
    interaction: APIInteraction;
    response: (data: unknown) => Response;
    wait: (promise: Promise<unknown>) => void;
    edit: (data: RESTPatchAPIWebhookWithTokenMessageJSONBody) => Promise<RESTPatchAPIWebhookWithTokenMessageResult>;
    more: (data: RESTPostAPIWebhookWithTokenJSONBody) => Promise<RESTPostAPIWebhookWithTokenWaitResult>;
    request: Req;
    context: Ctx;
    sentry?: Sentry;
}

export interface CommandMeta {
    name: string;
    description: string;
    options?: APIApplicationCommandOption[];
}

export interface Command<Ctx extends Context = Context, Req extends Request = Request, Sentry extends Toucan | undefined = undefined> extends CommandMeta {
    execute: (context: Execute<Ctx, Req, Sentry> & { interaction: APIApplicationCommandInteraction; commands: Commands<Ctx, Req, Sentry> }) => Promise<Response> | Response;
}

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
const isCommand = (value: unknown, warn = false): value is Command => {
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

    if (typeof value.description !== 'string' || !value.description.length) {
        if (warn)
            console.warn('Expected command to have a description');
        return false;
    }

    if (typeof value.execute !== 'function') {
        if (warn)
            console.warn('Expected command to have an execute function');
        return false;
    }

    return true;
};

/**
 * Validate that a set of values are {@link Command} objects
 */
export const validateCommands = <Ctx extends Context = Context, Req extends Request = Request, Sentry extends Toucan | undefined = undefined>(cmds: unknown[], warn = false) =>
    cmds.reduce((acc, cmd) => {
        if (!isCommand(cmd, warn)) return acc;

        // Check the command doesn't already exist
        if (acc[cmd.name]) {
            if (warn)
                console.warn(`Command ${cmd.name} already exists`);
            return acc;
        }

        // Add the command
        return {
            ...acc,
            [cmd.name]: cmd,
        };
    }, {}) as Commands<Ctx, Req, Sentry>;

/**
 * Validate that a given value is a {@link Component} object
 */
const isComponent = (value: unknown, warn = false): value is Component => {
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
export const validateComponents = <Ctx extends Context = Context, Req extends Request = Request, Sentry extends Toucan | undefined = undefined>(cmps: unknown[], warn = false) =>
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
