import { parse } from "path";
import { readFileSync, writeFileSync } from "fs";
import { start, send, call } from "../core/actor";
import Dot from "./packers/dot_packer";
import Clojure from "./packers/clojure_packer";
import Default from "./packers/default_packer";
import { topLevelAtoms, valueGraphSelector } from "../store/defaultReducer";
import { Graph } from "./graph";

const initialState = { path: "", filename: "Untitled" };

function getState(): any {
  return call("store", "getState").default;
}

function setState(atoms: any[], edges: any[]) {
  const action = { type: "set-atoms-edges", payload: { atoms, edges } };
  send("store", "dispatch", action);
}

function resetCanvas() {
  send("store", "dispatch", { type: "canvas/reset" });
}

function getFilename(path: string) {
  return parse(path).base;
}

function getExtension(path: string) {
  return parse(path).ext;
}

function validPath(path) {
  return typeof path === "string" && path !== "";
}

function changeWindowTitle(filename: string) {
  send("window", "changeTitle", `${filename} - Kosmos`);
}

function nodes() {
  const defaultState = getState();
  return topLevelAtoms(defaultState).map(atom => {
    return valueGraphSelector(defaultState, atom.id);
  });
}

function pack(nodes: any[], ext: string): string {
  if (Clojure.extensions.includes(ext)) {
    return Clojure.pack(nodes);
  }

  if (Dot.extensions.includes(ext)) {
    return Dot.pack(nodes);
  }

  return Default.pack(nodes);
}

function assignPlace(graph: Graph): Graph {
  const walk = (ids: string[], row: number, col: number): number => {
    for(let i = 0; i < ids.length; i++) {
      const id = ids[i];
      row = row + 1;
      graph.nodes[id].col = col;
      graph.nodes[id].row = row;

      if (graph.outNeighbors(id).length > 0)
        row = walk(graph.outNeighbors(id), row - 1, col + 1);
    }
    return row;
  }

  walk(graph.rootNodes(), 0, 0);

  Object.values(graph.nodes).forEach((node: any) => {
    node.x = node.col * 100 + 100;
    node.y = node.row * 40 + 100;
  });

  return graph;
}

function injectIds(graph: Graph): Graph {
  Object.keys(graph.nodes).forEach((id) => {
    graph.nodes[id] = { ...graph.nodes[id], id };
  });

  return graph;
}

function getEdgesList(graph: Graph): any[] {
  let edges = [];

  Object.keys(graph.edges).forEach(sourceId => {
    if (graph.edges[sourceId].length == 0)  return;

    graph.edges[sourceId].forEach(targetId => {
      edges.push({ sourceId, targetId })
    })
  });

  return edges;
}

function unpack(data: string, ext: string): [any, any] {
  let unpackFn: Function;

  if (Clojure.extensions.includes(ext)) {
    unpackFn = Clojure.unpack;
  } else if (Dot.extensions.includes(ext)) {
    unpackFn = Dot.unpack;
  } else {
    unpackFn = Default.unpack;
  }

  const graph = injectIds(assignPlace(unpackFn(data)));
  return [graph.nodes, getEdgesList(graph)];
}

const Workspace = {
  init() {
    return initialState;
  },

  new() {
    setState([], []);
    resetCanvas();
    changeWindowTitle(initialState.filename);
    return initialState;
  },

  save(state) {
    writeFileSync(state.path, pack(nodes(), getExtension(state.path)));
    return state;
  },

  saveAs(state, path) {
    if (!validPath(path)) return state;

    const filename = getFilename(path);
    changeWindowTitle(filename);

    writeFileSync(path, pack(nodes(), getExtension(path)));
    return { path, filename };
  },

  open(state, path) {
    if (!validPath(path)) return state;

    const content = readFileSync(path).toString();
    const [atoms, edges] = unpack(content, getExtension(path));
    resetCanvas();
    setState(atoms, edges);

    const filename = getFilename(path);
    changeWindowTitle(filename);

    return { path, filename };
  },

  hasFile(state) {
    const response = state.path !== "";
    return { state, response };
  },
};

start(Workspace, "workspace");
