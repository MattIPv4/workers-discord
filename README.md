# workers-discord

Some wrappers for Discord applications in Workers.

Provides a request handler for Discord interactions at `/interactions` (and a health-check route at `/health`).

Provides a method for registering commands with Discord, with logic for only updating commands with changes.

Request handler includes optional support for Sentry (tested with `workers-sentry`/`toucan-js`).

## Usage

We'll be using TypeScript for this example, but the library can be used with JavaScript as well.

Install the library and the required packages for this example.

```sh
npm install workers-discord discord-api-types
npm install --save-dev typescript tsup dotenv @cloudflare/workers-types wrangler
```

Ensure Typescript is setup with the correct exposed types for Workers.

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ESNext"],
    "types": ["@cloudflare/workers-types"],
    "noEmitOnError": true,
    "skipLibCheck": true,
    "allowSyntheticDefaultImports": true,
    "removeComments": false,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
  }
}
```

Define a `/ping` command that'll show `Pinging...` and then update to `Pong! <current time>` after 5 seconds.

`src/commands/ping.ts`:

```ts
import { InteractionResponseType, MessageFlags, ComponentType } from 'discord-api-types/payloads';
import type { Command } from 'workers-discord';

import { component } from '../components/ping';
import type { CtxWithEnv } from '../env';

const pingCommand: Command<CtxWithEnv> = {
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

export default pingCommand;
```

Define a refresh button component that we'll include in the `/ping` command response, which will update the message when clicked.

`src/components/ping.ts`:

```ts
import { InteractionResponseType, ComponentType, ButtonStyle, type APIButtonComponent } from 'discord-api-types/payloads';
import type { Component } from 'workers-discord';

import type { CtxWithEnv } from '../env';

export const component: APIButtonComponent = {
    type: ComponentType.Button,
    custom_id: 'ping',
    style: ButtonStyle.Secondary,
    label: 'Refresh',
};

const pingComponent: Component<CtxWithEnv> = {
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

export default pingComponent;
```

Create a file to store our environment definition, so that we can use it in commands etc. if needed.

`src/env.ts`:

```ts
export interface Env {
    DISCORD_PUBLIC_KEY: string;
}

export interface CtxWithEnv extends ExecutionContext {
    env: Env;
}
```

Define the Cloudflare Worker request handler with our command and component both registered.

`src/index.ts`:

```ts
import { createHandler } from 'workers-discord';

import pingCommand from './commands/ping';
import pingComponent from './components/ping';
import type { Env, CtxWithEnv } from './env';

let handler: ReturnType<typeof createHandler<CtxWithEnv>>;

const worker: ExportedHandler<Env> = {
    fetch: async (request, env, ctx) => {
        // Create the handler if it doesn't exist yet
        handler ??= createHandler<CtxWithEnv>(
            [ pingCommand ],        // Array of commands to handle interactions for
            [ pingComponent ],      // Array of components to handle interactions for
            env.DISCORD_PUBLIC_KEY, // Discord application public key
            true,                   // Whether to log warnings for any invalid commands/components passed
        );

        // Run the handler, passing the environment to the command/component context
        (ctx as CtxWithEnv).env = env;
        const resp = await handler(request, ctx as CtxWithEnv);
        if (resp) return resp;

        // Fallback for any requests not handled by the handler
        return new Response('Not found', { status: 404 });
    },
};

export default worker;
```

As part of the build process, make sure to register the ping command with Discord.

`tsup.config.ts`:

```js
import { defineConfig } from 'tsup';
import { registerCommands } from 'workers-discord';
import dotenv from 'dotenv';

import pingCommand from './src/commands/ping';

dotenv.config({ path: '.dev.vars' });

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    outDir: 'dist',
    outExtension: () => ({ js: '.js' }),
    onSuccess: async () => {
        await registerCommands(
            process.env.DISCORD_CLIENT_ID!,     // Discord application client ID
            process.env.DISCORD_CLIENT_SECRET!, // Discord application client secret
            [ pingCommand ],                    // Array of commands to register with Discord
            true,                               // Whether to log warnings for any invalid commands passed
            process.env.DISCORD_GUILD_ID,       // Optional guild ID to register guild-specific commands
        );
    },
});
```

Configure Wrangler to use the built worker, and to have our secrets available.

`wrangler.toml`:

```toml
name = "<worker_name>"
main = "dist/index.js"
account_id = "<account_id>"
workers_dev = true
compatibility_date = "2023-10-25"

[build]
command = "npm run build"
watch_dir = "src"
```

`.dev.vars`:

```ini
DISCORD_PUBLIC_KEY=<discord_public_key>
DISCORD_CLIENT_ID=<discord_client_id>
DISCORD_CLIENT_SECRET=<discord_client_secret>
# DISCORD_GUILD_ID=<discord_guild_id>
```

Run `npx wrangler login` to get your account ID, which should be added to `wrangler.toml`.
Then, you can run `npx wrangler dev` to start the development server and register your commands.

_You may want to use a tool like `cloudflared` to expose your development server to the work, so that you can test your commands in Discord._
