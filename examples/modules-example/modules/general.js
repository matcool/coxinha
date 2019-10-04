// When used as an library it wont have these ugly ../
const { Command, Argument } = require('../../../dist/index');

module.exports = (bot) => {
    const category = 'General';

    bot.addCommand(new Command({
        category,
        name: 'say',
        help: 'Says something given',
        args: [
            new Argument('message', {
                combined: true
            })
        ],
        async func(ctx, message) {
            await ctx.send(message);
        }
    }));
};