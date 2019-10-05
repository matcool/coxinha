const { Bot, Command, isOwner } = require('../../dist/index');
const path = require('path');
const fs = require('fs');

const bot = new Bot('js!', {
    disableEveryone: true
});

bot.on('ready', () => {
    console.log(`Logged in as ${bot.user.tag}!`);
});

bot.addCommand(new Command({
    name: 'kill',
    hidden: true,
    help: 'End the bot\'s connection with discord',
    checks: [
        isOwner
    ],
    async func(ctx) {
        await ctx.send('Bye');
        await ctx.bot.destroy();
    }
}));

bot.addCommand(new Command({
    name: 'reload',
    hidden: true,
    checks: [
        isOwner
    ],
    async func(ctx) {
        fs.readdir(path.join(__dirname, 'modules'), (err, files) => {
            if (err) return console.log(err);
            for (let file of files) {
                let modulePath = path.join(__dirname, 'modules', file);
                ctx.bot.unloadModule(modulePath);
                ctx.bot.loadModule(modulePath);
            }
            ctx.send('reloaded');
        });
    }
}))

fs.readdir(path.join(__dirname, 'modules'), (err, files) => {
    if (err) return console.log(err);
    for (let file of files) {
        let modulePath = path.join(__dirname, 'modules', file);
        bot.loadModule(modulePath);
    }
});

bot.login('token');