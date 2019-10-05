# Coxinha
Basic command system for discord.js written in typescript

Sample bot in examples/
# Example
```js
const { Bot, Command, Argument } = require('coxinha');

// ! is the prefix
const bot = new Bot('!');

bot.on('ready', () => {
    console.log(`Logged in as ${bot.user.tag}!`);
});

bot.addCommand(new Command({
    name: 'ping',
    aliases: ['pong'],
    help: 'Sends "Pong!"',
    async func(ctx) {
        await ctx.send('Pong!');
    }
}));

bot.addCommand(new Command({
    name: 'say',
    help: 'Sends given message',
    args: [
        // Combined means it'll be multiple words
        new Argument('message', {combined: true})
    ],
    async func(ctx, msg) {
        await ctx.send(msg);
    }
}));

bot.login('token');
```