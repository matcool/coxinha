// When used as an library it wont have these ugly ../
const { Command, Argument } = require('../../../dist/command');

module.exports = (bot) => {
    const category = 'Extra';

    bot.addCommand(new Command({
        category,
        name: 'extra',
        help: 'i can\'t think of any other commands\nthis is just an example anyway',
        async func(ctx) {
            await ctx.send('Wassup');
        }
    }));
};