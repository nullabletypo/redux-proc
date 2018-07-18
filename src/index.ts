import { Observable, BehaviorSubject, Subject, queueScheduler } from 'rxjs'
import { filter, observeOn } from 'rxjs/operators'
import { CommandBus, isCommand, Command, select } from 'command-bus'
import { Middleware } from 'redux'

export interface Source<I = any, S = any> {
  input$: Observable<I>,
  action$: Observable<Command>,
  state$: Observable<S>
}

export interface Processor<I = any, S = any> {
  (src: Source<I, S>): Observable<any>
}

export interface ProcAction<I = any, S = any> {
  type: string
  payload: I
  meta: {
    processor: Processor<I, S>,
  }
}

export type ProcActionCreator<I, S> = I extends void
  ? () => ProcAction<I, S>
  : (input: I) => ProcAction<I, S>


export interface ProcCreator {
  <I = undefined, S = any>(processor: Processor<I, S>): ProcActionCreator<I, S>
}


export interface MiddlewareOptions {
  proxy?: (src: Observable<any>) => Observable<any>
  busInstance?: CommandBus
}

type DefaultOptions<T = MiddlewareOptions> = {
  [P in keyof T]-?: T[P]
}

//
// ─── CONSTANTS ──────────────────────────────────────────────────────────────────
//
const TYPE = '@@REDUX-PROC'

// ─── ACTION CREATOR ──────────────────────────────────────────────────────────────
//
export const proc = ((processor: Processor) => (input?: any) => ({
  type: TYPE,
  payload: input,
  meta: { processor },
})) as ProcCreator

//
// ─── MIDDLEWARE ─────────────────────────────────────────────────────────────────
//
const defaultOptions = (): DefaultOptions => ({
  proxy: ((value: any) => value),
  busInstance: new CommandBus(),
})

export const createReduxProcMiddleware = (opts?: MiddlewareOptions): Middleware => store => next => {
  const { proxy, busInstance } = { ...defaultOptions(), ...opts }
  const registry = new WeakMap<Processor<any, any>, Subject<any>>()
  const actionQueue = new Subject<any>()
  const state$ = new BehaviorSubject(store.getState())
  const action$ = busInstance

  actionQueue.pipe(
    ensureAction,
    observeOn(queueScheduler),
  ).subscribe(action => {
    next(action)
    state$.next(store.getState())
    action$.dispatch(action)
  })

  return action => {
    if (action.type !== TYPE) {
      actionQueue.next(action)
      return action
    }
    if (registry.has(action.meta.processor)) {
      const input$ = registry.get(action.meta.processor)!
      input$.next(action.payload)
      return action
    } else {
      const { meta: { processor }, payload } = action as ProcAction<any, any>
      const input$ = new Subject<any>()
      const source = { action$, state$, input$ }
      const preprocess$ = ensureAction(proxy(processor(source)))
      const process$ = preprocess$.pipe(observeOn(queueScheduler))
      const complete = () => registry.delete(processor)
      registry.set(processor, input$)
      process$.subscribe({ next: store.dispatch, complete })
      input$.next(payload)
      return action
    }
  }
}

//
// ─── UTILS ──────────────────────────────────────────────────────────────────────
//
const ensureAction = filter(isCommand)

export { select }
