# workers-discord

Some wrappers for Discord applications in Workers.

Provides a request handler for Discord interactions at `/interactions` (and a health-check route at `/health`).

Provides a method for registering commands with Discord, with logic for only updating commands with changes.

Request handler includes optional support for Sentry (tested with `workers-sentry`/`toucan-js`).

## Usage

`components/ping.js`:

```js
import { InteractionResponseType, ComponentType, ButtonStyle } from 'discord-api-types/payloads';

export const component = {
    type: ComponentType.Button,
    custom_id: 'ping',
    style: ButtonStyle.Secondary,
    label: 'Refresh',
};

export default {
    name: 'ping',
    execute: async ({ response }) => response({
        type: InteractionResponseType.UpdateMessage,
        data: {
            content: `Pong! \`${new Date().toISOString()}\``,
            components: [
                {
                    type: ComponentType.ActionRow,
                    components: [ component ],
                },
            ],
        },
    }),
};
```

`commands/ping.js`:

```js
import { InteractionResponseType, MessageFlags, ComponentType } from 'discord-api-types/payloads';

import { component } from '../components/ping.js';

export default {
    name: 'ping',
    description: 'Ping the application to check if it is online.',
    execute: ({ response, wait, edit }) => {
        wait((async () => {
            await new Promise(resolve => setTimeout(resolve, 5000));

            await edit({
                content: `Pong! \`${new Date().toISOString()}\``,
                components: [
                    {
                        type: ComponentType.ActionRow,
                        components: [ component ],
                    },
                ],
            });
        })());

        return response({
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
                content: 'Pinging...',
                flags: MessageFlags.Ephemeral,
            },
        });
    },
};

```

`index.js`:

```js
import { createHandler } from 'workers-discord';

import pingCommand from './commands/ping.js';
import pingComponent from './components/ping.js';

const handler = createHandler(
    [ pingCommand ],        // Array of commands to handle interactions for
    [ pingComponent ],      // Array of components to handle interactions for
    '<client_public_key>',  // Discord application public key
    true,                   // Whether to log warnings for any invalid commands/components passed
);

export default {
    fetch: async (request, env, ctx) => {
        ctx.env = env;                                      // Pass the environment to the command/component context
        const resp = await handler(request, ctx);
        if (resp) return resp;

        return new Response('Not found', { status: 404 });  // Fallback for any requests not handled by the handler
    },
};
```

`build.js`:

```js
import { registerCommands } from 'workers-discord';

import pingCommand from './commands/ping.js';

await registerCommands(
    '<client_id>',          // Discord application client ID
    '<client_secret>',      // Discord application client secret
    [ pingCommand ],        // Array of commands to register with Discord
    true,                   // Whether to log warnings for any invalid commands passed
    '<optional_guild_id>',  // Optional guild ID to register guild-specific commands
);
```
