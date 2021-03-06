const { Bot, Command, Argument, Paginator } = require('../dist/index');
const Discord = require('discord.js');

const bot = new Bot('!');

bot.on('ready', () => {
    console.log(`Logged in as ${bot.user.tag}!`);
});

bot.addCommand(new Command({
    name: 'test',
    help: 'Test command to test argument parsing',
    hidden: true,
    args: [
        new Argument('required'),
        new Argument('optional', { optional: true }),
        new Argument('optional+combined', { optional: true, combined: true }),
    ],
    async func(ctx, a, b, c) {
        let toStr = obj => obj === undefined ? 'undefined' : JSON.stringify(obj);
        await ctx.send(`syntax: \`${this.syntax}\`
required: ${toStr(a)}
optional: ${toStr(b)}
optional+combined: ${toStr(c)}`);
    }
}));

bot.addCommand(new Command({
    name: 'ping',
    aliases: ['pong'],
    help: 'Sends "Pong!"',
    async func(ctx) {
        await ctx.send('Pong!');
    }
}));

bot.addCommand(new Command({
    name: 'numbers',
    help: 'Paginator test',
    async func(ctx) {
        function getPage(i) {
            const embed = new Discord.MessageEmbed()
                .setDescription(`You are currently on ${i + 1}! Congratulations.`)
                .setFooter(`Page ${i + 1}/10`);
            return embed;
        }
        let pag = new Paginator(getPage, 10, {idle: 10000});
        await pag.start(ctx);
    }
}));

bot.login('token');