import { Context } from './context';

type Check = (ctx: Context) => Promise<boolean> | boolean;

const isOwner: Check = async ctx => {
    let owner = await ctx.bot.getOwner();
    return ctx.author.id === owner;
};

function invert(check: Check): Check {
    return async ctx => !(await check(ctx));
}

export { Check, isOwner, invert};