import {
  configureStore, getDefaultMiddleware, Store, combineReducers,
} from "@reduxjs/toolkit";
import * as Executor from "../repl";
import * as ClojurePacker  from "../workspace/packers/clojure_packer";
import {
  reducer as canvasReducer,
  middlewares as canvasMiddlewares,
} from "../canvas";
import {
  reducer as interfaceReducer,
  middlewares as interfaceMiddlewares,
} from "../interface";
import defaultReducer from "./defaultReducer";
import { valueGraphSelector } from "./defaultReducer";

////////////////////////////////////////////////////////////////////////////////

const rootReducer = combineReducers({
  default: defaultReducer,
  canvas: canvasReducer,
  interface: interfaceReducer,
});

const evaluateMiddleware = ({ dispatch, getState }) => next => action => {
  next(action);

  if (action.type === "eval-selected-atom") {
    const state = getState();
    const node = valueGraphSelector(state.default, state.canvas.selectedAtomId);

    Executor.execute(ClojurePacker.pack([node])).then(result => {
      dispatch({ type: "add-evaluation-entry", payload: result });
    });
  }
};

const middleware = [
  ...getDefaultMiddleware(),
  evaluateMiddleware,
  ...canvasMiddlewares,
  ...interfaceMiddlewares,
];

export type ApplicationState = ReturnType<typeof rootReducer>;

export const createApplicationStore = (): Store<ApplicationState> => {
  return configureStore({ reducer: rootReducer, middleware });
};

