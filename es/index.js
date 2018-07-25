import { BehaviorSubject, Subject, queueScheduler } from 'rxjs';
import { filter, observeOn } from 'rxjs/operators';
import { CommandBus, isCommand, select } from 'command-bus';
//
// ─── CONSTANTS ──────────────────────────────────────────────────────────────────
//
const TYPE = '@@REDUX-PROC';
// ─── ACTION CREATOR ──────────────────────────────────────────────────────────────
//
export const proc = ((processor) => (input) => ({
    type: TYPE,
    payload: input,
    meta: { processor },
}));
//
// ─── MIDDLEWARE ─────────────────────────────────────────────────────────────────
//
const defaultOptions = () => ({
    proxy: ((value) => value),
    busInstance: new CommandBus(),
});
export const createReduxProcMiddleware = (opts) => store => next => {
    const { proxy, busInstance } = Object.assign({}, defaultOptions(), opts);
    const registry = new WeakMap();
    const actionQueue$ = new Subject();
    const state$ = new BehaviorSubject(store.getState());
    const action$ = busInstance;
    actionQueue$.pipe(ensureAction, observeOn(queueScheduler)).subscribe(action => {
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
            const input$ = new Subject();
            const source = { action$, state$, input$ };
            const preprocess$ = ensureAction(proxy(processor(source)));
            const process$ = preprocess$.pipe(observeOn(queueScheduler));
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
const ensureAction = filter(isCommand);
export { select };
//# sourceMappingURL=index.js.map