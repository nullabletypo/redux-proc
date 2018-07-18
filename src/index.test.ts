import { proc, createReduxProcMiddleware, select } from './index'
import { createStore, applyMiddleware } from 'redux'
import { merge, of } from 'rxjs'
import { mapTo, concatMap, withLatestFrom, tap } from 'rxjs/operators'
import { create } from 'command-bus'

//
// ─── PROCESS ────────────────────────────────────────────────────────────────────
//
const actions = {
  inc: create<number>('inc'),
  dec: create<number>('dec'),
  reInc: create<number>('reInc'),
}

const usecase = {
  ...actions,
  inc: proc<number, State>(({ action$, input$, state$ }) => {
    const inc$ = input$.pipe(
      concatMap(amount => of(amount).pipe(
        withLatestFrom(state$, (_, state) => state),
        tap(state => expect(state.count).toBe(0)),
        mapTo(actions.inc(amount)),
      )),
    )
    // select event from action$
    const reInc$ = select(action$, actions.inc).pipe(
      withLatestFrom(state$, (_, state) => state),
      tap(state => expect(state.count).toBe(10)),
      mapTo(actions.reInc(1)),
    )
    return merge(inc$, reInc$)
  }),
}

//
// ─── STATE ──────────────────────────────────────────────────────────────────────
//
interface Counter {
  count: number
}

interface Log {
  action: any
  state: Counter
}

interface State extends Counter {
  history: Log[]
}


const reducer = (state: State = { count: 0, history: [] }, action: any): State => {
  if (action.type === actions.inc.type || action.type === actions.reInc.type) {
    const count = state.count + action.payload
    const log = { state: { count }, action }
    const history = [...state.history, log]
    return { ...state, count, history }
  }
  if (action.type === actions.dec.type) {
    const count = state.count - action.payload
    const log = { state: { count }, action }
    const history = [...state.history, log]
    return { ...state, count, history }
  }
  return state
}

//
// ─── TEST ───────────────────────────────────────────────────────────────────────
//
test('action -> action / state$ / callstack', () => {
  expect.assertions(3)
  const reduxProc = createReduxProcMiddleware()
  const middleware = applyMiddleware(reduxProc)
  const store = createStore(reducer, middleware)
  store.dispatch(usecase.inc(10))
  store.dispatch(usecase.dec(10))
  const { history } = store.getState()
  expect(history).toEqual([
    { action: actions.inc(10), state: { count: 10 } },
    { action: actions.reInc(1), state: { count: 11 } },
    { action: actions.dec(10), state: { count: 1 } },
  ])
})
