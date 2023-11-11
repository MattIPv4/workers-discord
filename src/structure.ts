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

// @ts-ignore -- consumers may not have toucan-js, and may not set skipLibCheck
import type { Toucan } from 'toucan-js';

export interface Context {
    waitUntil: (promise: Promise<any>) => void;
}

interface Execute<Req extends Request = Request, Ctx extends Context = Context, Sentry extends Toucan | undefined = undefined> {
    interaction: APIInteraction;
    response: (data: any) => Response;
    wait: (promise: Promise<any>) => void;
    edit: (data: RESTPatchAPIWebhookWithTokenMessageJSONBody) => Promise<RESTPatchAPIWebhookWithTokenMessageResult>;
    more: (data: RESTPostAPIWebhookWithTokenJSONBody) => Promise<RESTPostAPIWebhookWithTokenWaitResult>;
    request: Req;
    context: Ctx;
    sentry: Sentry;
}

export interface CommandMeta {
    name: string;
    description: string;
    options?: APIApplicationCommandOption[];
}

export interface Command<Req extends Request = Request, Ctx extends Context = Context, Sentry extends Toucan | undefined = undefined> extends CommandMeta {
    execute: (context: Execute<Req, Ctx, Sentry> & { interaction: APIApplicationCommandInteraction; commands: Commands<Req, Ctx, Sentry> }) => Promise<Response> | Response;
}

export interface Commands<Req extends Request = Request, Ctx extends Context = Context, Sentry extends Toucan | undefined = undefined> {
    [name: string]: Command<Req, Ctx, Sentry>;
}

export interface Component<Req extends Request = Request, Ctx extends Context = Context, Sentry extends Toucan | undefined = undefined> {
    name: string;
    execute: (context: Execute<Req, Ctx, Sentry> & { interaction: APIMessageComponentInteraction }) => Promise<Response> | Response;
}

export interface Components<Req extends Request = Request, Ctx extends Context = Context, Sentry extends Toucan | undefined = undefined> {
    [name: string]: Component<Req, Ctx, Sentry>;
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
export const validateCommands = <Req extends Request = Request, Ctx extends Context = Context, Sentry extends Toucan | undefined = undefined>(cmds: any[], warn = false) =>
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
    }, {}) as Commands<Req, Ctx, Sentry>;

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
export const validateComponents = <Req extends Request = Request, Ctx extends Context = Context, Sentry extends Toucan | undefined = undefined>(cmps: any[], warn = false) =>
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
    }, {}) as Components<Req, Ctx, Sentry>;
