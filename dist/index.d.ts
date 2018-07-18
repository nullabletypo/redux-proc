import { Observable } from 'rxjs';
import { CommandBus, Command, select } from 'command-bus';
import { Middleware } from 'redux';
export interface Source<I = any, S = any> {
    input$: Observable<I>;
    action$: Observable<Command>;
    state$: Observable<S>;
}
export interface Processor<I = any, S = any> {
    (src: Source<I, S>): Observable<any>;
}
export interface ProcAction<I = any, S = any> {
    type: string;
    payload: I;
    meta: {
        processor: Processor<I, S>;
    };
}
export declare type ProcActionCreator<I, S> = I extends void ? () => ProcAction<I, S> : (input: I) => ProcAction<I, S>;
export interface ProcCreator {
    <I = undefined, S = any>(processor: Processor<I, S>): ProcActionCreator<I, S>;
}
export interface MiddlewareOptions {
    proxy?: (src: Observable<any>) => Observable<any>;
    busInstance?: CommandBus;
}
export declare const proc: ProcCreator;
export declare const createReduxProcMiddleware: (opts?: MiddlewareOptions | undefined) => Middleware<{}, any, import("redux").Dispatch<import("redux").AnyAction>>;
export { select };
