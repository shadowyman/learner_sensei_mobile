import {
  StateDB,
  stateDiagram_default,
  stateRenderer_v3_unified_default,
  styles_default
} from "./chunk-YM2GSNQK.js";
import "./chunk-WED7IBYT.js";
import "./chunk-ZDDRUEZS.js";
import "./chunk-B4VXXNUP.js";
import "./chunk-QSJJZ2XM.js";
import "./chunk-IRJSULMR.js";
import "./chunk-7JOMXJO5.js";
import "./chunk-KHNGFO66.js";
import "./chunk-FEDZGZM6.js";
import "./chunk-JBDWG4UP.js";
import "./chunk-WO6FJVUL.js";
import {
  __name
} from "./chunk-MLHWAWB4.js";
import "./chunk-AHW2NVWD.js";
import "./chunk-DLJ4GP37.js";

// node_modules/mermaid/dist/chunks/mermaid.core/stateDiagram-v2-SNKRMT2F.mjs
var diagram = {
  parser: stateDiagram_default,
  get db() {
    return new StateDB(2);
  },
  renderer: stateRenderer_v3_unified_default,
  styles: styles_default,
  init: __name((cnf) => {
    if (!cnf.state) {
      cnf.state = {};
    }
    cnf.state.arrowMarkerAbsolute = cnf.arrowMarkerAbsolute;
  }, "init")
};
export {
  diagram
};
//# sourceMappingURL=stateDiagram-v2-SNKRMT2F-HWUKUPQ5.js.map
