import { Context } from './context';

type Check = (ctx: Context) => Promise<boolean> | boolean;

const Checks = {
    async isOwner(ctx: Context) {
        let owner = await ctx.bot.getOwner();
        return ctx.author.id === owner;
    }
};

Object.freeze(Checks);

const CheckUtils = {
    invert(check: Check): Check {
        return async ctx => !(await check(ctx));
    },
    all(...checks: Check[]): Check {
        return async ctx => {
            for (let check of checks) {
                if (!await check(ctx)) return false;
            }
            return true;
        };
    },
    any(...checks: Check[]): Check {
        return async ctx => {
            for (let check of checks) {
                if (await check(ctx)) return true;
            }
            return false;
        };
    }
}

Object.freeze(CheckUtils);

export { Check, Checks, CheckUtils };