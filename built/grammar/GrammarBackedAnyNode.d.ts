import GrammarBackedNonTerminalNode from "./GrammarBackedNonTerminalNode";
import types from "../types";
declare class GrammarBackedAnyNode extends GrammarBackedNonTerminalNode {
    getKeywordMap(): {};
    getErrors(): types.ParseError[];
    getCatchAllNodeConstructor(line: string): typeof GrammarBackedAnyNode;
}
export default GrammarBackedAnyNode;