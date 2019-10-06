// When used as an library it wont have these ugly ../
const { Command, Argument, userConverter } = require('../../../dist/index');

module.exports = (bot) => {
    const category = 'Extra';

    bot.addCommand(new Command({
        category,
        name: 'userinfo',
        help: 'Sends info about given user',
        args: [
            new Argument('user', {converter: userConverter})
        ],
        async func(ctx, user) {
            if (!user) await ctx.send('User not found');
            else await ctx.send('User tag: ' + user.tag);
        }
    }));
};