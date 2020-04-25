import { Context } from './context';
import { User } from 'discord.js';

type Converter = (arg: string, ctx?: Context) => Promise<any> | any;

async function userConverter(arg: string, ctx: Context): Promise<User> | null {
    let user: User = null;
    try {
        // Look by id
        user = await ctx.bot.users.fetch(arg);
    } catch {
        // Look by mention
        let match = arg.match(/<@!?(\d{18})>/);
        if (match) {
            try {
                user = await ctx.bot.users.fetch(match[1]);
            } catch {
                user = null;
            }
        }
        // Look by name
        if (!match || user === null) {
            user = ctx.bot.users.cache.find(user => user.username === arg);
        }
    }
    return user;
};

export { Converter, userConverter };