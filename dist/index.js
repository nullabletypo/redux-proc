"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const command_bus_1 = require("command-bus");
exports.select = command_bus_1.select;
//
// ─── CONSTANTS ──────────────────────────────────────────────────────────────────
//
const TYPE = '@@REDUX-PROC';
// ─── ACTION CREATOR ──────────────────────────────────────────────────────────────
//
exports.proc = ((processor) => (input) => ({
    type: TYPE,
    payload: input,
    meta: { processor },
}));
//
// ─── MIDDLEWARE ─────────────────────────────────────────────────────────────────
//
const defaultOptions = () => ({
    proxy: ((value) => value),
    busInstance: new command_bus_1.CommandBus(),
});
exports.createReduxProcMiddleware = (opts) => store => next => {
    const { proxy, busInstance } = Object.assign({}, defaultOptions(), opts);
    const registry = new WeakMap();
    const actionQueue$ = new rxjs_1.Subject();
    const state$ = new rxjs_1.BehaviorSubject(store.getState());
    const action$ = busInstance;
    actionQueue$.pipe(ensureAction, operators_1.observeOn(rxjs_1.queueScheduler)).subscribe(action => {
        action$.dispatch(action);
    });
    return action => {
        next(action);
        state$.next(store.getState());
        if (action.type !== TYPE) {
            actionQueue$.next(action);
            return action;
        }
        if (registry.has(action.meta.processor)) {
            const input$ = registry.get(action.meta.processor);
            input$.next(action.payload);
            return action;
        }
        else {
            const { meta: { processor }, payload } = action;
            const input$ = new rxjs_1.Subject();
            const source = { action$, state$, input$ };
            const preprocess$ = ensureAction(proxy(processor(source)));
            const process$ = preprocess$.pipe(operators_1.observeOn(rxjs_1.queueScheduler));
            const complete = () => registry.delete(processor);
            registry.set(processor, input$);
            process$.subscribe({ next: store.dispatch, complete });
            input$.next(payload);
            return action;
        }
        return action;
    };
};
//
// ─── UTILS ──────────────────────────────────────────────────────────────────────
//
const ensureAction = operators_1.filter(command_bus_1.isCommand);
//# sourceMappingURL=index.js.map