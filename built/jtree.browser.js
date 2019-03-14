"use strict";
let _jtreeLatestTime = 0;
let _jtreeMinTimeIncrement = 0.000000000001;
class AbstractNode {
    _getNow() {
        // We add this loop to restore monotonically increasing .now():
        // https://developer.mozilla.org/en-US/docs/Web/API/Performance/now
        let time = performance.now();
        while (time <= _jtreeLatestTime) {
            if (time === time + _jtreeMinTimeIncrement)
                // Some browsers have different return values for perf.now()
                _jtreeMinTimeIncrement = 10 * _jtreeMinTimeIncrement;
            time += _jtreeMinTimeIncrement;
        }
        _jtreeLatestTime = time;
        return time;
    }
}
class TreeUtils {
    static getPathWithoutFileName(path) {
        const parts = path.split("/"); // todo: change for windows?
        parts.pop();
        return parts.join("/");
    }
    static getClassNameFromFilePath(filename) {
        return filename
            .replace(/\.[^\.]+$/, "")
            .split("/")
            .pop();
    }
    static resolvePath(filePath, programFilepath) {
        // For use in Node.js only
        if (!filePath.startsWith("."))
            return filePath;
        const path = require("path");
        const folder = this.getPathWithoutFileName(programFilepath);
        return path.resolve(folder + "/" + filePath);
    }
    static getFileExtension(url = "") {
        const match = url.match(/\.([^\.]+)$/);
        return (match && match[1]) || "";
    }
    static resolveProperty(obj, path, separator = ".") {
        const properties = Array.isArray(path) ? path : path.split(separator);
        return properties.reduce((prev, curr) => prev && prev[curr], obj);
    }
    static formatStr(str, listDelimiter = " ", parameterMap) {
        return str.replace(/{([^\}]+)}/g, (match, path) => {
            const isList = path.endsWith("*");
            const typePath = path.replace("*", "");
            const arr = parameterMap[typePath];
            if (!arr)
                return "";
            const word = isList ? arr.join(listDelimiter) : arr.shift();
            return word;
        });
    }
    static stripHtml(text) {
        return text && text.replace ? text.replace(/<(?:.|\n)*?>/gm, "") : text;
    }
    static getUniqueWordsArray(allWords) {
        const words = allWords.replace(/\n/g, " ").split(" ");
        const index = {};
        words.forEach(word => {
            if (!index[word])
                index[word] = 0;
            index[word]++;
        });
        return Object.keys(index).map(key => {
            return {
                word: key,
                count: index[key]
            };
        });
    }
    static makeRandomTree(lines = 1000) {
        let str = "";
        let letters = " 123abc".split("");
        while (lines) {
            let indent = " ".repeat(Math.round(Math.random() * 6));
            let bit = indent;
            let rand = Math.floor(Math.random() * 30);
            while (rand) {
                bit += letters[Math.round(Math.min(Math.random() * letters.length, letters.length - 1))];
                rand--;
            }
            bit += "\n";
            str += bit;
            lines--;
        }
        return str;
    }
    static arrayToMap(arr) {
        const map = {};
        arr.forEach(val => (map[val] = true));
        return map;
    }
    static mapValues(object, fn) {
        const result = {};
        Object.keys(object).forEach(key => {
            result[key] = fn(key);
        });
        return result;
    }
    static sortByAccessor(accessor) {
        return (objectA, objectB) => {
            const av = accessor(objectA);
            const bv = accessor(objectB);
            let result = av < bv ? -1 : av > bv ? 1 : 0;
            if (av === undefined && bv !== undefined)
                result = -1;
            else if (bv === undefined && av !== undefined)
                result = 1;
            return result;
        };
    }
}
TreeUtils.BrowserScript = class {
    constructor(fileStr) {
        this._str = fileStr;
    }
    addUseStrict() {
        this._str = `"use strict";\n` + this._str;
        return this;
    }
    removeRequires() {
        this._str = this._str.replace(/(\n|^)const .* \= require\(.*/g, "$1");
        return this;
    }
    removeImports() {
        this._str = this._str.replace(/(\n|^)import .* from .*/g, "$1");
        return this;
    }
    removeExports() {
        this._str = this._str.replace(/(\n|^)export default .*/g, "$1");
        return this;
    }
    changeDefaultExportsToWindowExports() {
        this._str = this._str.replace(/\nexport default (.*)/g, "\nwindow.$1 = $1");
        return this;
    }
    changeNodeExportsToWindowExports() {
        this._str = this._str.replace(/\nmodule\.exports \= (.*)/g, "\nwindow.$1 = $1");
        return this;
    }
    getString() {
        return this._str;
    }
};
// todo: change to enum?
const GrammarConstants = {};
// node types
GrammarConstants.grammar = "@grammar";
GrammarConstants.keyword = "@keyword";
GrammarConstants.wordType = "@wordType";
GrammarConstants.abstract = "@abstract";
// word parsing
GrammarConstants.regex = "@regex"; // temporary?
GrammarConstants.keywordTable = "@keywordTable"; // temporary?
GrammarConstants.enum = "@enum"; // temporary?
GrammarConstants.parseWith = "@parseWith"; // temporary?
// parsing
GrammarConstants.keywords = "@keywords";
GrammarConstants.columns = "@columns";
GrammarConstants.catchAllKeyword = "@catchAllKeyword";
GrammarConstants.defaults = "@defaults";
GrammarConstants.constants = "@constants";
GrammarConstants.group = "@group";
GrammarConstants.any = "@any";
// parser/vm instantiating and executing
GrammarConstants.constructor = "@constructor";
GrammarConstants.constructorJs = "js";
// compiling
GrammarConstants.compilerKeyword = "@compiler";
GrammarConstants.compiler = {};
GrammarConstants.compiler.sub = "@sub"; // replacement instructions
GrammarConstants.compiler.indentCharacter = "@indentCharacter";
GrammarConstants.compiler.listDelimiter = "@listDelimiter";
GrammarConstants.compiler.openChildren = "@openChildren";
GrammarConstants.compiler.closeChildren = "@closeChildren";
// developing
GrammarConstants.description = "@description";
GrammarConstants.frequency = "@frequency";
// errors
GrammarConstants.invalidKeywordError = "invalidKeywordError";
GrammarConstants.invalidConstructorPathError = "invalidConstructorPathError";
class ImmutableNode extends AbstractNode {
    constructor(children, line, parent) {
        super();
        this._parent = parent;
        this._setLine(line);
        this._setChildren(children);
    }
    execute(context) {
        return Promise.all(this.map(child => child.execute(context)));
    }
    getErrors() {
        return [];
    }
    getLineSyntax() {
        return "any ".repeat(this.getWords().length).trim();
    }
    executeSync(context) {
        return this.map(child => child.executeSync(context));
    }
    isNodeJs() {
        return typeof exports !== "undefined";
    }
    getOlderSiblings() {
        return this.getParent().slice(0, this.getIndex());
    }
    getYoungerSiblings() {
        return this.getParent().slice(this.getIndex() + 1);
    }
    getSiblings() {
        return this.getParent().filter(node => node !== this);
    }
    _getUid() {
        if (!this._uid)
            this._uid = ImmutableNode._makeUniqueId();
        return this._uid;
    }
    // todo: rename getMother? grandMother et cetera?
    getParent() {
        return this._parent;
    }
    getPoint() {
        return this._getPoint();
    }
    _getPoint(relativeTo) {
        return {
            x: this._getXCoordinate(relativeTo),
            y: this._getYCoordinate(relativeTo)
        };
    }
    getPointRelativeTo(relativeTo) {
        return this._getPoint(relativeTo);
    }
    getIndentation(relativeTo) {
        return this.getXI().repeat(this._getXCoordinate(relativeTo) - 1);
    }
    *getTopDownArrayIterator() {
        for (let child of this.getChildren()) {
            yield child;
            yield* child.getTopDownArrayIterator();
        }
    }
    getNumberOfLines() {
        let lineCount = 0;
        for (let node of this.getTopDownArrayIterator()) {
            lineCount++;
        }
        return lineCount;
    }
    _getLineNumber(target) {
        let lineNumber = 1;
        for (let node of this.getTopDownArrayIterator()) {
            if (node === target)
                return lineNumber;
            lineNumber++;
        }
        return lineNumber;
    }
    isBlankLine() {
        return !this.length && !this.getLine();
    }
    isEmpty() {
        return !this.length && !this.getContent();
    }
    _getYCoordinate(relativeTo) {
        if (this._cachedLineNumber)
            return this._cachedLineNumber;
        if (this.isRoot(relativeTo))
            return 0;
        const start = relativeTo || this.getRootNode();
        return start._getLineNumber(this);
    }
    isRoot(relativeTo) {
        return relativeTo === this || !this.getParent();
    }
    getRootNode() {
        return this._getRootNode();
    }
    _getRootNode(relativeTo) {
        if (this.isRoot(relativeTo))
            return this;
        return this.getParent()._getRootNode(relativeTo);
    }
    toString(indentCount = 0, language = this) {
        if (this.isRoot())
            return this._childrenToString(indentCount, language);
        const content = language.getXI().repeat(indentCount) + this.getLine(language);
        const value = content + (this.length ? language.getYI() + this._childrenToString(indentCount + 1, language) : "");
        return value;
    }
    getWord(index) {
        const words = this._getLine().split(this.getZI());
        if (index < 0)
            index = words.length + index;
        return words[index];
    }
    _toHtml(indentCount) {
        const path = this.getPathVector().join(" ");
        const classes = {
            nodeLine: "nodeLine",
            xi: "xIncrement",
            yi: "yIncrement",
            nodeChildren: "nodeChildren"
        };
        const edge = this.getXI().repeat(indentCount);
        // Set up the keyword part of the node
        const edgeHtml = `<span class="${classes.nodeLine}" data-pathVector="${path}"><span class="${classes.xi}">${edge}</span>`;
        const lineHtml = this._getLineHtml();
        const childrenHtml = this.length
            ? `<span class="${classes.yi}">${this.getYI()}</span>` +
                `<span class="${classes.nodeChildren}">${this._childrenToHtml(indentCount + 1)}</span>`
            : "";
        return `${edgeHtml}${lineHtml}${childrenHtml}</span>`;
    }
    _getWords(startFrom) {
        if (!this._words)
            this._words = this._getLine().split(this.getZI());
        return startFrom ? this._words.slice(startFrom) : this._words;
    }
    getWords() {
        return this._getWords(0);
    }
    getWordsFrom(startFrom) {
        return this._getWords(startFrom);
    }
    getKeyword() {
        return this.getWords()[0];
    }
    getContent() {
        const words = this.getWordsFrom(1);
        return words.length ? words.join(this.getZI()) : undefined;
    }
    getContentWithChildren() {
        // todo: deprecate
        const content = this.getContent();
        return (content ? content : "") + (this.length ? this.getYI() + this._childrenToString() : "");
    }
    getStack() {
        return this._getStack();
    }
    _getStack(relativeTo) {
        if (this.isRoot(relativeTo))
            return [];
        const parent = this.getParent();
        if (parent.isRoot(relativeTo))
            return [this];
        else
            return parent._getStack(relativeTo).concat([this]);
    }
    getStackString() {
        return this._getStack()
            .map((node, index) => this.getXI().repeat(index) + node.getLine())
            .join(this.getYI());
    }
    getLine(language) {
        if (!this._words && !language)
            return this._getLine(); // todo: how does this interact with "language" param?
        return this.getWords().join((language || this).getZI());
    }
    getColumnNames() {
        return this._getUnionNames();
    }
    getOneHot(column) {
        const clone = this.clone();
        const cols = Array.from(new Set(clone.getColumn(column)));
        clone.forEach(node => {
            const val = node.get(column);
            node.delete(column);
            cols.forEach(col => {
                node.set(column + "_" + col, val === col ? "1" : "0");
            });
        });
        return clone;
    }
    // todo: return array? getPathArray?
    _getKeywordPath(relativeTo) {
        if (this.isRoot(relativeTo))
            return "";
        else if (this.getParent().isRoot(relativeTo))
            return this.getKeyword();
        return this.getParent()._getKeywordPath(relativeTo) + this.getXI() + this.getKeyword();
    }
    getKeywordPathRelativeTo(relativeTo) {
        return this._getKeywordPath(relativeTo);
    }
    getKeywordPath() {
        return this._getKeywordPath();
    }
    getPathVector() {
        return this._getPathVector();
    }
    getPathVectorRelativeTo(relativeTo) {
        return this._getPathVector(relativeTo);
    }
    _getPathVector(relativeTo) {
        if (this.isRoot(relativeTo))
            return [];
        const path = this.getParent()._getPathVector(relativeTo);
        path.push(this.getIndex());
        return path;
    }
    getIndex() {
        return this.getParent()._indexOfNode(this);
    }
    isTerminal() {
        return !this.length;
    }
    _getLineHtml() {
        return this.getWords()
            .map((word, index) => `<span class="word${index ? "" : " keyword"}">${TreeUtils.stripHtml(word)}</span>`)
            .join(`<span class="zIncrement">${this.getZI()}</span>`);
    }
    _getXmlContent(indentCount) {
        if (this.getContent() !== undefined)
            return this.getContentWithChildren();
        return this.length
            ? `${indentCount === -1 ? "" : "\n"}${this._childrenToXml(indentCount > -1 ? indentCount + 2 : -1)}${" ".repeat(indentCount)}`
            : "";
    }
    _toXml(indentCount) {
        const indent = " ".repeat(indentCount);
        const tag = this.getKeyword();
        return `${indent}<${tag}>${this._getXmlContent(indentCount)}</${tag}>${indentCount === -1 ? "" : "\n"}`;
    }
    _toObjectTuple() {
        const content = this.getContent();
        const length = this.length;
        const hasChildrenNoContent = content === undefined && length;
        const hasContentAndHasChildren = content !== undefined && length;
        // If the node has a content and a subtree return it as a string, as
        // Javascript object values can't be both a leaf and a tree.
        const tupleValue = hasChildrenNoContent
            ? this.toObject()
            : hasContentAndHasChildren
                ? this.getContentWithChildren()
                : content;
        return [this.getKeyword(), tupleValue];
    }
    _indexOfNode(needleNode) {
        let result = -1;
        this.find((node, index) => {
            if (node === needleNode) {
                result = index;
                return true;
            }
        });
        return result;
    }
    getSlice(startIndexInclusive, stopIndexExclusive) {
        return new TreeNode(this.slice(startIndexInclusive, stopIndexExclusive)
            .map(child => child.toString())
            .join("\n"));
    }
    getTopDownArray() {
        const arr = [];
        this._getTopDownArray(arr);
        return arr;
    }
    _hasColumns(columns) {
        const words = this.getWords();
        return columns.every((searchTerm, index) => searchTerm === words[index]);
    }
    hasWord(index, word) {
        return this.getWord(index) === word;
    }
    getNodeByColumns(...columns) {
        return this.getTopDownArray().find(node => node._hasColumns(columns));
    }
    getNodeByColumn(index, name) {
        return this.find(node => node.getWord(index) === name);
    }
    _getNodesByColumn(index, name) {
        return this.filter(node => node.getWord(index) === name);
    }
    _getTopDownArray(arr) {
        this.forEach(child => {
            arr.push(child);
            child._getTopDownArray(arr);
        });
    }
    getChildrenFirstArray() {
        const arr = [];
        this._getChildrenFirstArray(arr);
        return arr;
    }
    _getChildrenFirstArray(arr) {
        this.forEach(child => {
            child._getChildrenFirstArray(arr);
            arr.push(child);
        });
    }
    _getXCoordinate(relativeTo) {
        return this._getStack(relativeTo).length;
    }
    getParentFirstArray() {
        const levels = this._getLevels();
        const arr = [];
        levels.forEach(level => {
            level.forEach(item => arr.push(item));
        });
        return arr;
    }
    _getLevels() {
        const levels = [];
        this.getTopDownArray().forEach(node => {
            const level = node._getXCoordinate();
            if (!levels[level])
                levels[level] = [];
            levels[level].push(node);
        });
        return levels;
    }
    _getChildrenArray() {
        if (!this._children)
            this._children = [];
        return this._children;
    }
    _getChildren() {
        return this._getChildrenArray();
    }
    getLines() {
        return this.map(node => node.getLine());
    }
    getChildren() {
        return this._getChildren().slice(0);
    }
    get length() {
        return this._getChildren().length;
    }
    _nodeAt(index) {
        if (index < 0)
            index = this.length + index;
        return this._getChildren()[index];
    }
    nodeAt(indexOrArray) {
        const type = typeof indexOrArray;
        if (type === "number")
            return this._nodeAt(indexOrArray);
        if (indexOrArray.length === 1)
            return this._nodeAt(indexOrArray[0]);
        const first = indexOrArray[0];
        const node = this._nodeAt(first);
        if (!node)
            return undefined;
        return node.nodeAt(indexOrArray.slice(1));
    }
    _toObject() {
        const obj = {};
        this.forEach(node => {
            const tuple = node._toObjectTuple();
            obj[tuple[0]] = tuple[1];
        });
        return obj;
    }
    toHtml() {
        return this._childrenToHtml(0);
    }
    _childrenToHtml(indentCount) {
        return this.map(node => node._toHtml(indentCount)).join(`<span class="yIncrement">${this.getYI()}</span>`);
    }
    _childrenToString(indentCount, language = this) {
        return this.map(node => node.toString(indentCount, language)).join(language.getYI());
    }
    childrenToString() {
        return this._childrenToString();
    }
    // todo: implement
    _getNodeJoinCharacter() {
        return "\n";
    }
    compile(targetExtension) {
        return this.map(child => child.compile(targetExtension)).join(this._getNodeJoinCharacter());
    }
    toXml() {
        return this._childrenToXml(0);
    }
    toJson() {
        return JSON.stringify(this.toObject(), null, " ");
    }
    findNodes(keywordPath) {
        // todo: can easily speed this up
        return this.getTopDownArray().filter(node => {
            if (node._getKeywordPath(this) === keywordPath)
                return true;
            return false;
        });
    }
    format(str) {
        const that = this;
        return str.replace(/{([^\}]+)}/g, (match, path) => that.get(path) || "");
    }
    getColumn(path) {
        return this.map(node => node.get(path));
    }
    getFiltered(fn) {
        const clone = this.clone();
        clone
            .filter(node => !fn(node))
            .forEach(node => {
            node.destroy();
        });
        return clone;
    }
    _isLeafColumn(path) {
        for (let node of this._getChildren()) {
            const nd = node.getNode(path);
            if (nd && nd.length)
                return false;
        }
        return true;
    }
    getNode(keywordPath) {
        return this._getNodeByPath(keywordPath);
    }
    get(keywordPath) {
        const node = this._getNodeByPath(keywordPath);
        return node === undefined ? undefined : node.getContent();
    }
    _getNodeByPath(keywordPath) {
        const xi = this.getXI();
        if (!keywordPath.includes(xi)) {
            const index = this.indexOfLast(keywordPath);
            return index === -1 ? undefined : this._nodeAt(index);
        }
        const parts = keywordPath.split(xi);
        const current = parts.shift();
        const currentNode = this._getChildren()[this._getIndex()[current]];
        return currentNode ? currentNode._getNodeByPath(parts.join(xi)) : undefined;
    }
    getNext() {
        if (this.isRoot())
            return this;
        const index = this.getIndex();
        const parent = this.getParent();
        const length = parent.length;
        const next = index + 1;
        return next === length ? parent._getChildren()[0] : parent._getChildren()[next];
    }
    getPrevious() {
        if (this.isRoot())
            return this;
        const index = this.getIndex();
        const parent = this.getParent();
        const length = parent.length;
        const prev = index - 1;
        return prev === -1 ? parent._getChildren()[length - 1] : parent._getChildren()[prev];
    }
    _getUnionNames() {
        if (!this.length)
            return [];
        const obj = {};
        this.forEach(node => {
            if (!node.length)
                return undefined;
            node.forEach(node => {
                obj[node.getKeyword()] = 1;
            });
        });
        return Object.keys(obj);
    }
    getGraphByKey(key) {
        const graph = this._getGraph((node, id) => node._getNodesByColumn(0, id), node => node.get(key), this);
        graph.push(this);
        return graph;
    }
    getGraph(thisColumnNumber, extendsColumnNumber) {
        const graph = this._getGraph((node, id) => node._getNodesByColumn(thisColumnNumber, id), node => node.getWord(extendsColumnNumber), this);
        graph.push(this);
        return graph;
    }
    _getGraph(getNodesByIdFn, getParentIdFn, cannotContainNode) {
        const parentId = getParentIdFn(this);
        if (!parentId)
            return [];
        const potentialParentNodes = getNodesByIdFn(this.getParent(), parentId);
        if (!potentialParentNodes.length)
            throw new Error(`"${this.getLine()} tried to extend "${parentId}" but "${parentId}" not found.`);
        // Note: If multiple matches, we attempt to extend matching keyword first.
        const keyword = this.getKeyword();
        const parentNode = potentialParentNodes.find(node => node.getKeyword() === keyword) || potentialParentNodes[0];
        // todo: detect loops
        if (parentNode === cannotContainNode)
            throw new Error(`Loop detected between '${this.getLine()}' and '${parentNode.getLine()}'`);
        const graph = parentNode._getGraph(getNodesByIdFn, getParentIdFn, cannotContainNode);
        graph.push(parentNode);
        return graph;
    }
    pathVectorToKeywordPath(pathVector) {
        const path = pathVector.slice(); // copy array
        const names = [];
        let node = this;
        while (path.length) {
            if (!node)
                return names;
            names.push(node.nodeAt(path[0]).getKeyword());
            node = node.nodeAt(path.shift());
        }
        return names;
    }
    toCsv() {
        return this.toDelimited(",");
    }
    toFlatTree() {
        const tree = this.clone();
        tree.forEach(node => {
            // todo: best approach here? set children as content?
            node.deleteChildren();
        });
        return tree;
    }
    _getTypes(header) {
        const matrix = this._getMatrix(header);
        const types = header.map(i => "int");
        matrix.forEach(row => {
            row.forEach((value, index) => {
                const type = types[index];
                if (type === "string")
                    return 1;
                if (value === undefined || value === "")
                    return 1;
                if (type === "float") {
                    if (value.match(/^\-?[0-9]*\.?[0-9]*$/))
                        return 1;
                    types[index] = "string";
                }
                if (value.match(/^\-?[0-9]+$/))
                    return 1;
                types[index] = "string";
            });
        });
        return types;
    }
    toDataTable(header = this._getUnionNames()) {
        const types = this._getTypes(header);
        const parsers = {
            string: i => i,
            float: parseFloat,
            int: parseInt
        };
        const cellFn = (cellValue, rowIndex, columnIndex) => rowIndex ? parsers[types[columnIndex]](cellValue) : cellValue;
        const arrays = this._toArrays(header, cellFn);
        arrays.rows.unshift(arrays.header);
        return arrays.rows;
    }
    toDelimited(delimiter, header = this._getUnionNames()) {
        const regex = new RegExp(`(\\n|\\"|\\${delimiter})`);
        const cellFn = (str, row, column) => !str.toString().match(regex) ? str : `"` + str.replace(/\"/g, `""`) + `"`;
        return this._toDelimited(delimiter, header, cellFn);
    }
    _getMatrix(columns) {
        const matrix = [];
        this.forEach(child => {
            const row = [];
            columns.forEach(col => {
                row.push(child.get(col));
            });
            matrix.push(row);
        });
        return matrix;
    }
    _toArrays(header, cellFn) {
        const skipHeaderRow = 1;
        const headerArray = header.map((columnName, index) => cellFn(columnName, 0, index));
        const rows = this.map((node, rowNumber) => header.map((columnName, columnIndex) => {
            const childNode = node.getNode(columnName);
            const content = childNode ? childNode.getContentWithChildren() : "";
            return cellFn(content, rowNumber + skipHeaderRow, columnIndex);
        }));
        return {
            rows: rows,
            header: headerArray
        };
    }
    _toDelimited(delimiter, header, cellFn) {
        const data = this._toArrays(header, cellFn);
        return data.header.join(delimiter) + "\n" + data.rows.map(row => row.join(delimiter)).join("\n");
    }
    toTable() {
        // Output a table for printing
        return this._toTable(100, false);
    }
    toFormattedTable(maxWidth, alignRight) {
        // Output a table with padding up to maxWidth in each cell
        return this._toTable(maxWidth, alignRight);
    }
    _toTable(maxWidth, alignRight = false) {
        const header = this._getUnionNames();
        const widths = header.map(col => (col.length > maxWidth ? maxWidth : col.length));
        this.forEach(node => {
            if (!node.length)
                return true;
            header.forEach((col, index) => {
                const cellValue = node.get(col);
                if (!cellValue)
                    return true;
                const length = cellValue.toString().length;
                if (length > widths[index])
                    widths[index] = length > maxWidth ? maxWidth : length;
            });
        });
        const cellFn = (cellText, row, col) => {
            const width = widths[col];
            // Strip newlines in fixedWidth output
            const cellValue = cellText.toString().replace(/\n/g, "\\n");
            const cellLength = cellValue.length;
            if (cellLength > width) {
                return cellValue.substr(0, width);
            }
            const padding = " ".repeat(width - cellLength);
            return alignRight ? padding + cellValue : cellValue + padding;
        };
        return this._toDelimited(" ", header, cellFn);
    }
    toSsv() {
        return this.toDelimited(" ");
    }
    toOutline() {
        return this._toOutline(node => node.getLine());
    }
    toMappedOutline(nodeFn) {
        return this._toOutline(nodeFn);
    }
    // Adapted from: https://github.com/notatestuser/treeify.js
    _toOutline(nodeFn) {
        const growBranch = (outlineTreeNode, last, lastStates, nodeFn, callback) => {
            let lastStatesCopy = lastStates.slice(0);
            const node = outlineTreeNode.node;
            if (lastStatesCopy.push([outlineTreeNode, last]) && lastStates.length > 0) {
                let line = "";
                // keywordd on the "was last element" states of whatever we're nested within,
                // we need to append either blankness or a branch to our line
                lastStates.forEach((lastState, idx) => {
                    if (idx > 0)
                        line += lastState[1] ? " " : "│";
                });
                // the prefix varies keywordd on whether the key contains something to show and
                // whether we're dealing with the last element in this collection
                // the extra "-" just makes things stand out more.
                line += (last ? "└" : "├") + nodeFn(node);
                callback(line);
            }
            if (!node)
                return;
            const length = node.length;
            let index = 0;
            node.forEach(node => {
                let lastKey = ++index === length;
                growBranch({ node: node }, lastKey, lastStatesCopy, nodeFn, callback);
            });
        };
        let output = "";
        growBranch({ node: this }, false, [], nodeFn, line => (output += line + "\n"));
        return output;
    }
    copyTo(node, index) {
        return node._setLineAndChildren(this.getLine(), this.childrenToString(), index);
    }
    toMarkdownTable() {
        return this.toMarkdownTableAdvanced(this._getUnionNames(), val => val);
    }
    toMarkdownTableAdvanced(columns, formatFn) {
        const matrix = this._getMatrix(columns);
        const empty = columns.map(col => "-");
        matrix.unshift(empty);
        matrix.unshift(columns);
        const lines = matrix.map((row, rowIndex) => {
            const formattedValues = row.map((val, colIndex) => formatFn(val, rowIndex, colIndex));
            return `|${formattedValues.join("|")}|`;
        });
        return lines.join("\n");
    }
    toTsv() {
        return this.toDelimited("\t");
    }
    getYI() {
        return "\n";
    }
    getZI() {
        return " ";
    }
    getYIRegex() {
        return new RegExp(this.getYI(), "g");
    }
    getXI() {
        return " ";
    }
    _textToContentAndChildrenTuple(text) {
        const lines = text.split(this.getYIRegex());
        const firstLine = lines.shift();
        const children = !lines.length
            ? undefined
            : lines
                .map(line => (line.substr(0, 1) === this.getXI() ? line : this.getXI() + line))
                .map(line => line.substr(1))
                .join(this.getYI());
        return [firstLine, children];
    }
    _getLine() {
        return this._line;
    }
    _setLine(line = "") {
        this._line = line;
        if (this._words)
            delete this._words;
        return this;
    }
    _clearChildren() {
        delete this._children;
        this._clearIndex();
        return this;
    }
    _setChildren(content, circularCheckArray) {
        this._clearChildren();
        if (!content)
            return this;
        // set from string
        if (typeof content === "string")
            return this._parseString(content);
        // set from tree object
        if (content instanceof ImmutableNode) {
            const me = this;
            content.forEach(node => {
                me._setLineAndChildren(node.getLine(), node.childrenToString());
            });
            return this;
        }
        // If we set from object, create an array of inserted objects to avoid circular loops
        if (!circularCheckArray)
            circularCheckArray = [content];
        return this._setFromObject(content, circularCheckArray);
    }
    _setFromObject(content, circularCheckArray) {
        for (let keyword in content) {
            if (!content.hasOwnProperty(keyword))
                continue;
            // Branch the circularCheckArray, as we only have same branch circular arrays
            this._appendFromJavascriptObjectTuple(keyword, content[keyword], circularCheckArray.slice(0));
        }
        return this;
    }
    // todo: refactor the below.
    _appendFromJavascriptObjectTuple(keyword, content, circularCheckArray) {
        const type = typeof content;
        let line;
        let children;
        if (content === null)
            line = keyword + " " + null;
        else if (content === undefined)
            line = keyword;
        else if (type === "string") {
            const tuple = this._textToContentAndChildrenTuple(content);
            line = keyword + " " + tuple[0];
            children = tuple[1];
        }
        else if (type === "function")
            line = keyword + " " + content.toString();
        else if (type !== "object")
            line = keyword + " " + content;
        else if (content instanceof Date)
            line = keyword + " " + content.getTime().toString();
        else if (content instanceof ImmutableNode) {
            line = keyword;
            children = new TreeNode(content.childrenToString(), content.getLine());
        }
        else if (circularCheckArray.indexOf(content) === -1) {
            circularCheckArray.push(content);
            line = keyword;
            const length = content instanceof Array ? content.length : Object.keys(content).length;
            if (length)
                children = new TreeNode()._setChildren(content, circularCheckArray);
        }
        else {
            // iirc this is return early from circular
            return;
        }
        this._setLineAndChildren(line, children);
    }
    _setLineAndChildren(line, children, index = this.length) {
        const nodeConstructor = this.getNodeConstructor(line);
        const newNode = new nodeConstructor(children, line, this);
        const adjustedIndex = index < 0 ? this.length + index : index;
        this._getChildrenArray().splice(adjustedIndex, 0, newNode);
        if (this._index)
            this._makeIndex(adjustedIndex);
        return newNode;
    }
    _parseString(str) {
        if (!str)
            return this;
        const lines = str.split(this.getYIRegex());
        const parentStack = [];
        let currentIndentCount = -1;
        let lastNode = this;
        lines.forEach(line => {
            const indentCount = this._getIndentCount(line);
            if (indentCount > currentIndentCount) {
                currentIndentCount++;
                parentStack.push(lastNode);
            }
            else if (indentCount < currentIndentCount) {
                // pop things off stack
                while (indentCount < currentIndentCount) {
                    parentStack.pop();
                    currentIndentCount--;
                }
            }
            const lineContent = line.substr(currentIndentCount);
            const parent = parentStack[parentStack.length - 1];
            const nodeConstructor = parent.getNodeConstructor(lineContent);
            lastNode = new nodeConstructor(undefined, lineContent, parent);
            parent._getChildrenArray().push(lastNode);
        });
        return this;
    }
    _getIndex() {
        // StringMap<int> {keyword: index}
        // When there are multiple tails with the same keyword, _index stores the last content.
        // todo: change the above behavior: when a collision occurs, create an array.
        return this._index || this._makeIndex();
    }
    getContentsArray() {
        return this.map(node => node.getContent());
    }
    // todo: rename to getChildrenByConstructor(?)
    getChildrenByNodeType(constructor) {
        return this.filter(child => child instanceof constructor);
    }
    // todo: rename to getNodeByConstructor(?)
    getNodeByType(constructor) {
        return this.find(child => child instanceof constructor);
    }
    indexOfLast(keyword) {
        const result = this._getIndex()[keyword];
        return result === undefined ? -1 : result;
    }
    indexOf(keyword) {
        if (!this.has(keyword))
            return -1;
        const length = this.length;
        const nodes = this._getChildren();
        for (let index = 0; index < length; index++) {
            if (nodes[index].getKeyword() === keyword)
                return index;
        }
        return -1;
    }
    toObject() {
        return this._toObject();
    }
    getKeywords() {
        return this.map(node => node.getKeyword());
    }
    _makeIndex(startAt = 0) {
        if (!this._index || !startAt)
            this._index = {};
        const nodes = this._getChildren();
        const newIndex = this._index;
        const length = nodes.length;
        for (let index = startAt; index < length; index++) {
            newIndex[nodes[index].getKeyword()] = index;
        }
        return newIndex;
    }
    _childrenToXml(indentCount) {
        return this.map(node => node._toXml(indentCount)).join("");
    }
    _getIndentCount(str) {
        let level = 0;
        const edgeChar = this.getXI();
        while (str[level] === edgeChar) {
            level++;
        }
        return level;
    }
    clone() {
        return new this.constructor(this.childrenToString(), this.getLine());
    }
    // todo: rename to hasKeyword
    has(keyword) {
        return this._hasKeyword(keyword);
    }
    _hasKeyword(keyword) {
        return this._getIndex()[keyword] !== undefined;
    }
    _getKeywordByIndex(index) {
        // Passing -1 gets the last item, et cetera
        const length = this.length;
        if (index < 0)
            index = length + index;
        if (index >= length)
            return undefined;
        return this._getChildren()[index].getKeyword();
    }
    map(fn) {
        return this.getChildren().map(fn);
    }
    filter(fn) {
        return this.getChildren().filter(fn);
    }
    find(fn) {
        return this.getChildren().find(fn);
    }
    forEach(fn) {
        this.getChildren().forEach(fn);
        return this;
    }
    _clearIndex() {
        delete this._index;
    }
    slice(start, end) {
        return this.getChildren().slice(start, end);
    }
    getKeywordMap() {
        return undefined;
    }
    getCatchAllNodeConstructor(line) {
        return this.constructor;
    }
    // Note: if you have 2 of the same keywords, will attempt to extend matching keyword first
    getExpanded(thisColumnNumber, extendsColumnNumber) {
        return new TreeNode(this.map(child => child._expand(thisColumnNumber, extendsColumnNumber)).join("\n"));
    }
    getInheritanceTree() {
        const paths = {};
        const result = new TreeNode();
        this.forEach(node => {
            const key = node.getWord(0);
            const parentKey = node.getWord(1);
            const parentPath = paths[parentKey];
            paths[key] = parentPath ? [parentPath, key].join(" ") : key;
            result.touchNode(paths[key]);
        });
        return result;
    }
    getNodeConstructor(line) {
        const map = this.getKeywordMap();
        if (!map)
            return this.getCatchAllNodeConstructor(line);
        const firstBreak = line.indexOf(this.getZI());
        const keyword = line.substr(0, firstBreak > -1 ? firstBreak : undefined);
        return map[keyword] || this.getCatchAllNodeConstructor(line);
    }
    static _makeUniqueId() {
        if (this._uniqueId === undefined)
            this._uniqueId = 0;
        this._uniqueId++;
        return this._uniqueId;
    }
}
ImmutableNode.iris = `sepal_length,sepal_width,petal_length,petal_width,species
6.1,3,4.9,1.8,virginica
5.6,2.7,4.2,1.3,versicolor
5.6,2.8,4.9,2,virginica
6.2,2.8,4.8,1.8,virginica
7.7,3.8,6.7,2.2,virginica
5.3,3.7,1.5,0.2,setosa
6.2,3.4,5.4,2.3,virginica
4.9,2.5,4.5,1.7,virginica
5.1,3.5,1.4,0.2,setosa
5,3.4,1.5,0.2,setosa`;
class TreeNode extends ImmutableNode {
    getMTime() {
        if (!this._mtime)
            this._updateMTime();
        return this._mtime;
    }
    _getChildrenMTime() {
        const mTimes = this.map(child => child.getTreeMTime());
        const cmTime = this._getCMTime();
        if (cmTime)
            mTimes.push(cmTime);
        const newestTime = Math.max.apply(null, mTimes);
        return this._setCMTime(newestTime || this._getNow())._getCMTime();
    }
    _getCMTime() {
        return this._cmtime;
    }
    _setCMTime(value) {
        this._cmtime = value;
        return this;
    }
    getTreeMTime() {
        const mtime = this.getMTime();
        const cmtime = this._getChildrenMTime();
        return Math.max(mtime, cmtime);
    }
    _expand(thisColumnNumber, extendsColumnNumber) {
        const graph = this.getGraph(thisColumnNumber, extendsColumnNumber);
        const result = new TreeNode();
        graph.forEach(node => result.extend(node));
        return new TreeNode().appendLineAndChildren(this.getLine(), result);
    }
    macroExpand(macroDefKeyword, macroUsageKeyword) {
        const clone = this.clone();
        const defs = clone.findNodes(macroDefKeyword);
        const allUses = clone.findNodes(macroUsageKeyword);
        const zi = clone.getZI();
        defs.forEach(def => {
            const macroName = def.getWord(1);
            const uses = allUses.filter(node => node.hasWord(1, macroName));
            const params = def.getWordsFrom(2);
            const replaceFn = str => {
                const paramValues = str.split(zi).slice(2);
                let newTree = def.childrenToString();
                params.forEach((param, index) => {
                    newTree = newTree.replace(new RegExp(param, "g"), paramValues[index]);
                });
                return newTree;
            };
            uses.forEach(node => {
                node.replaceNode(replaceFn);
            });
            def.destroy();
        });
        return clone;
    }
    setChildren(children) {
        return this._setChildren(children);
    }
    _updateMTime() {
        this._mtime = this._getNow();
    }
    insertWord(index, word) {
        const wi = this.getZI();
        const words = this._getLine().split(wi);
        words.splice(index, 0, word);
        this.setLine(words.join(wi));
        return this;
    }
    deleteDuplicates() {
        const set = new Set();
        this.getTopDownArray().forEach(node => {
            const str = node.toString();
            if (set.has(str))
                node.destroy();
            else
                set.add(str);
        });
        return this;
    }
    setWord(index, word) {
        const wi = this.getZI();
        const words = this._getLine().split(wi);
        words[index] = word;
        this.setLine(words.join(wi));
        return this;
    }
    deleteChildren() {
        return this._clearChildren();
    }
    setContent(content) {
        if (content === this.getContent())
            return this;
        const newArray = [this.getKeyword()];
        if (content !== undefined) {
            content = content.toString();
            if (content.match(this.getYI()))
                return this.setContentWithChildren(content);
            newArray.push(content);
        }
        this._updateMTime();
        return this._setLine(newArray.join(this.getZI()));
    }
    setContentWithChildren(text) {
        // todo: deprecate
        if (!text.includes(this.getYI())) {
            this._clearChildren();
            return this.setContent(text);
        }
        const lines = text.split(this.getYIRegex());
        const firstLine = lines.shift();
        this.setContent(firstLine);
        // tood: cleanup.
        const remainingString = lines.join(this.getYI());
        const children = new TreeNode(remainingString);
        if (!remainingString)
            children.appendLine("");
        this.setChildren(children);
        return this;
    }
    setKeyword(keyword) {
        return this.setWord(0, keyword);
    }
    setLine(line) {
        if (line === this.getLine())
            return this;
        this._updateMTime();
        // todo: clear parent TMTimes
        this.getParent()._clearIndex();
        return this._setLine(line);
    }
    duplicate() {
        return this.getParent()._setLineAndChildren(this.getLine(), this.childrenToString(), this.getIndex() + 1);
    }
    destroy() {
        ;
        this.getParent()._deleteNode(this);
    }
    set(keywordPath, text) {
        return this.touchNode(keywordPath).setContentWithChildren(text);
    }
    setFromText(text) {
        if (this.toString() === text)
            return this;
        const tuple = this._textToContentAndChildrenTuple(text);
        this.setLine(tuple[0]);
        return this._setChildren(tuple[1]);
    }
    appendLine(line) {
        return this._setLineAndChildren(line);
    }
    appendLineAndChildren(line, children) {
        return this._setLineAndChildren(line, children);
    }
    getNodesByRegex(regex) {
        const matches = [];
        regex = regex instanceof RegExp ? [regex] : regex;
        this._getNodesByLineRegex(matches, regex);
        return matches;
    }
    getNodesByLinePrefixes(columns) {
        const matches = [];
        this._getNodesByLineRegex(matches, columns.map(str => new RegExp("^" + str)));
        return matches;
    }
    _getNodesByLineRegex(matches, regs) {
        const rgs = regs.slice(0);
        const reg = rgs.shift();
        const candidates = this.filter(child => child.getLine().match(reg));
        if (!rgs.length)
            return candidates.forEach(cand => matches.push(cand));
        candidates.forEach(cand => cand._getNodesByLineRegex(matches, rgs));
    }
    concat(node) {
        if (typeof node === "string")
            node = new TreeNode(node);
        return node.map(node => this._setLineAndChildren(node.getLine(), node.childrenToString()));
    }
    _deleteByIndexes(indexesToDelete) {
        this._clearIndex();
        // note: assumes indexesToDelete is in ascending order
        indexesToDelete.reverse().forEach(index => this._getChildrenArray().splice(index, 1));
        return this._setCMTime(this._getNow());
    }
    _deleteNode(node) {
        const index = this._indexOfNode(node);
        return index > -1 ? this._deleteByIndexes([index]) : 0;
    }
    reverse() {
        this._clearIndex();
        this._getChildrenArray().reverse();
        return this;
    }
    shift() {
        if (!this.length)
            return null;
        const node = this._getChildrenArray().shift();
        return node.copyTo(new this.constructor(), 0);
    }
    sort(fn) {
        this._getChildrenArray().sort(fn);
        this._clearIndex();
        return this;
    }
    invert() {
        this.forEach(node => node.getWords().reverse());
        return this;
    }
    _rename(oldKeyword, newKeyword) {
        const index = this.indexOf(oldKeyword);
        if (index === -1)
            return this;
        const node = this._getChildren()[index];
        node.setKeyword(newKeyword);
        this._clearIndex();
        return this;
    }
    // Does not recurse.
    remap(map) {
        this.forEach(node => {
            const keyword = node.getKeyword();
            if (map[keyword] !== undefined)
                node.setKeyword(map[keyword]);
        });
        return this;
    }
    rename(oldKeyword, newKeyword) {
        this._rename(oldKeyword, newKeyword);
        return this;
    }
    renameAll(oldName, newName) {
        this.findNodes(oldName).forEach(node => node.setKeyword(newName));
        return this;
    }
    _deleteByKeyword(keyword) {
        if (!this.has(keyword))
            return this;
        const allNodes = this._getChildren();
        const indexesToDelete = [];
        allNodes.forEach((node, index) => {
            if (node.getKeyword() === keyword)
                indexesToDelete.push(index);
        });
        return this._deleteByIndexes(indexesToDelete);
    }
    delete(keyword = "") {
        const xi = this.getXI();
        if (!keyword.includes(xi))
            return this._deleteByKeyword(keyword);
        const parts = keyword.split(xi);
        const nextKeyword = parts.pop();
        const targetNode = this.getNode(parts.join(xi));
        return targetNode ? targetNode._deleteByKeyword(nextKeyword) : 0;
    }
    deleteColumn(keyword = "") {
        this.forEach(node => node.delete(keyword));
        return this;
    }
    // todo: add more testing.
    extend(nodeOrStr) {
        if (!(nodeOrStr instanceof TreeNode))
            nodeOrStr = new TreeNode(nodeOrStr);
        nodeOrStr.forEach(node => {
            const path = node.getKeyword();
            const content = node.getContent();
            const targetNode = this.touchNode(path).setContent(content);
            if (node.length)
                targetNode.extend(node.childrenToString());
        });
        return this;
    }
    replaceNode(fn) {
        const str = fn(this.toString());
        const parent = this.getParent();
        const index = this.getIndex();
        const newNodes = new TreeNode(str);
        const returnedNodes = [];
        newNodes.forEach((child, childIndex) => {
            const newNode = parent.insertLineAndChildren(child.getLine(), child.childrenToString(), index + childIndex);
            returnedNodes.push(newNode);
        });
        this.destroy();
        return returnedNodes;
    }
    insertLineAndChildren(line, children, index) {
        return this._setLineAndChildren(line, children, index);
    }
    insertLine(line, index) {
        return this._setLineAndChildren(line, undefined, index);
    }
    prependLine(line) {
        return this.insertLine(line, 0);
    }
    pushContentAndChildren(content, children) {
        let index = this.length;
        while (this.has(index.toString())) {
            index++;
        }
        const line = index.toString() + (content === undefined ? "" : this.getZI() + content);
        return this.appendLineAndChildren(line, children);
    }
    deleteBlanks() {
        this.getChildren()
            .filter(node => node.isBlankLine())
            .forEach(node => node.destroy());
        return this;
    }
    _touchNode(keywordPathArray) {
        let contextNode = this;
        keywordPathArray.forEach(keyword => {
            contextNode = contextNode.getNode(keyword) || contextNode.appendLine(keyword);
        });
        return contextNode;
    }
    _touchNodeByString(str) {
        str = str.replace(this.getYIRegex(), ""); // todo: do we want to do this sanitization?
        return this._touchNode(str.split(this.getZI()));
    }
    touchNode(str) {
        return this._touchNodeByString(str);
    }
    sortByColumns(indexOrIndices) {
        indexOrIndices = indexOrIndices instanceof Array ? indexOrIndices : [indexOrIndices];
        const length = indexOrIndices.length;
        this.sort((nodeA, nodeB) => {
            const wordsA = nodeA.getWords();
            const wordsB = nodeB.getWords();
            for (let index = 0; index < length; index++) {
                const col = indexOrIndices[index];
                const av = wordsA[col];
                const bv = wordsB[col];
                if (av === undefined)
                    return -1;
                if (bv === undefined)
                    return 1;
                if (av > bv)
                    return 1;
                else if (av < bv)
                    return -1;
            }
            return 0;
        });
        return this;
    }
    sortBy(nameOrNames) {
        nameOrNames = nameOrNames instanceof Array ? nameOrNames : [nameOrNames];
        const length = nameOrNames.length;
        this.sort((nodeA, nodeB) => {
            if (!nodeB.length && !nodeA.length)
                return 0;
            else if (!nodeA.length)
                return -1;
            else if (!nodeB.length)
                return 1;
            for (let index = 0; index < length; index++) {
                const keyword = nameOrNames[index];
                const av = nodeA.get(keyword);
                const bv = nodeB.get(keyword);
                if (av > bv)
                    return 1;
                else if (av < bv)
                    return -1;
            }
            return 0;
        });
        return this;
    }
    static fromCsv(str) {
        return this.fromDelimited(str, ",", '"');
    }
    static fromJson(str) {
        return new TreeNode(JSON.parse(str));
    }
    static fromSsv(str) {
        return this.fromDelimited(str, " ", '"');
    }
    static fromTsv(str) {
        return this.fromDelimited(str, "\t", '"');
    }
    static fromDelimited(str, delimiter, quoteChar) {
        const rows = this._getEscapedRows(str, delimiter, quoteChar);
        return this._rowsToTreeNode(rows, delimiter, true);
    }
    static _getEscapedRows(str, delimiter, quoteChar) {
        return str.includes(quoteChar)
            ? this._strToRows(str, delimiter, quoteChar)
            : str.split("\n").map(line => line.split(delimiter));
    }
    static fromDelimitedNoHeaders(str, delimiter, quoteChar) {
        const rows = this._getEscapedRows(str, delimiter, quoteChar);
        return this._rowsToTreeNode(rows, delimiter, false);
    }
    static _strToRows(str, delimiter, quoteChar, newLineChar = "\n") {
        const rows = [[]];
        const newLine = "\n";
        const length = str.length;
        let currentCell = "";
        let inQuote = str.substr(0, 1) === quoteChar;
        let currentPosition = inQuote ? 1 : 0;
        let nextChar;
        let isLastChar;
        let currentRow = 0;
        let char;
        let isNextCharAQuote;
        while (currentPosition < length) {
            char = str[currentPosition];
            isLastChar = currentPosition + 1 === length;
            nextChar = str[currentPosition + 1];
            isNextCharAQuote = nextChar === quoteChar;
            if (inQuote) {
                if (char !== quoteChar)
                    currentCell += char;
                else if (isNextCharAQuote) {
                    // Both the current and next char are ", so the " is escaped
                    currentCell += nextChar;
                    currentPosition++; // Jump 2
                }
                else {
                    // If the current char is a " and the next char is not, it's the end of the quotes
                    inQuote = false;
                    if (isLastChar)
                        rows[currentRow].push(currentCell);
                }
            }
            else {
                if (char === delimiter) {
                    rows[currentRow].push(currentCell);
                    currentCell = "";
                    if (isNextCharAQuote) {
                        inQuote = true;
                        currentPosition++; // Jump 2
                    }
                }
                else if (char === newLine) {
                    rows[currentRow].push(currentCell);
                    currentCell = "";
                    currentRow++;
                    if (nextChar)
                        rows[currentRow] = [];
                    if (isNextCharAQuote) {
                        inQuote = true;
                        currentPosition++; // Jump 2
                    }
                }
                else if (isLastChar)
                    rows[currentRow].push(currentCell + char);
                else
                    currentCell += char;
            }
            currentPosition++;
        }
        return rows;
    }
    static multiply(nodeA, nodeB) {
        const productNode = nodeA.clone();
        productNode.forEach((node, index) => {
            node.setChildren(node.length ? this.multiply(node, nodeB) : nodeB.clone());
        });
        return productNode;
    }
    // Given an array return a tree
    static _rowsToTreeNode(rows, delimiter, hasHeaders) {
        const numberOfColumns = rows[0].length;
        const treeNode = new TreeNode();
        const names = this._getHeader(rows, hasHeaders);
        const rowCount = rows.length;
        for (let rowIndex = hasHeaders ? 1 : 0; rowIndex < rowCount; rowIndex++) {
            let row = rows[rowIndex];
            // If the row contains too many columns, shift the extra columns onto the last one.
            // This allows you to not have to escape delimiter characters in the final column.
            if (row.length > numberOfColumns) {
                row[numberOfColumns - 1] = row.slice(numberOfColumns - 1).join(delimiter);
                row = row.slice(0, numberOfColumns);
            }
            else if (row.length < numberOfColumns) {
                // If the row is missing columns add empty columns until it is full.
                // This allows you to make including delimiters for empty ending columns in each row optional.
                while (row.length < numberOfColumns) {
                    row.push("");
                }
            }
            const obj = {};
            row.forEach((cellValue, index) => {
                obj[names[index]] = cellValue;
            });
            treeNode.pushContentAndChildren(undefined, obj);
        }
        return treeNode;
    }
    static _initializeXmlParser() {
        if (this._xmlParser)
            return;
        const windowObj = window;
        if (typeof windowObj.DOMParser !== "undefined")
            this._xmlParser = xmlStr => new windowObj.DOMParser().parseFromString(xmlStr, "text/xml");
        else if (typeof windowObj.ActiveXObject !== "undefined" && new windowObj.ActiveXObject("Microsoft.XMLDOM")) {
            this._xmlParser = xmlStr => {
                const xmlDoc = new windowObj.ActiveXObject("Microsoft.XMLDOM");
                xmlDoc.async = "false";
                xmlDoc.loadXML(xmlStr);
                return xmlDoc;
            };
        }
        else
            throw new Error("No XML parser found");
    }
    static fromXml(str) {
        this._initializeXmlParser();
        const xml = this._xmlParser(str);
        try {
            return this._treeNodeFromXml(xml).getNode("children");
        }
        catch (err) {
            return this._treeNodeFromXml(this._parseXml2(str)).getNode("children");
        }
    }
    static _zipObject(keys, values) {
        const obj = {};
        keys.forEach((key, index) => (obj[key] = values[index]));
        return obj;
    }
    static fromShape(shapeArr, rootNode = new TreeNode()) {
        const part = shapeArr.shift();
        if (part !== undefined) {
            for (let index = 0; index < part; index++) {
                rootNode.appendLine(index.toString());
            }
        }
        if (shapeArr.length)
            rootNode.forEach(node => TreeNode.fromShape(shapeArr.slice(0), node));
        return rootNode;
    }
    static fromDataTable(table) {
        const header = table.shift();
        return new TreeNode(table.map(row => this._zipObject(header, row)));
    }
    static _parseXml2(str) {
        const el = document.createElement("div");
        el.innerHTML = str;
        return el;
    }
    static _treeNodeFromXml(xml) {
        const result = new TreeNode();
        const children = new TreeNode();
        // Set attributes
        if (xml.attributes) {
            for (let index = 0; index < xml.attributes.length; index++) {
                result.set(xml.attributes[index].name, xml.attributes[index].value);
            }
        }
        if (xml.data)
            children.pushContentAndChildren(xml.data);
        // Set content
        if (xml.childNodes && xml.childNodes.length > 0) {
            for (let index = 0; index < xml.childNodes.length; index++) {
                const child = xml.childNodes[index];
                if (child.tagName && child.tagName.match(/parsererror/i))
                    throw new Error("Parse Error");
                if (child.childNodes.length > 0 && child.tagName)
                    children.appendLineAndChildren(child.tagName, this._treeNodeFromXml(child));
                else if (child.tagName)
                    children.appendLine(child.tagName);
                else if (child.data) {
                    const data = child.data.trim();
                    if (data)
                        children.pushContentAndChildren(data);
                }
            }
        }
        if (children.length > 0)
            result.touchNode("children").setChildren(children);
        return result;
    }
    static _getHeader(rows, hasHeaders) {
        const numberOfColumns = rows[0].length;
        const headerRow = hasHeaders ? rows[0] : [];
        const ZI = " ";
        const ziRegex = new RegExp(ZI, "g");
        if (hasHeaders) {
            // Strip any ZIs from column names in the header row.
            // This makes the mapping not quite 1 to 1 if there are any ZIs in names.
            for (let index = 0; index < numberOfColumns; index++) {
                headerRow[index] = headerRow[index].replace(ziRegex, "");
            }
        }
        else {
            // If str has no headers, create them as 0,1,2,3
            for (let index = 0; index < numberOfColumns; index++) {
                headerRow.push(index.toString());
            }
        }
        return headerRow;
    }
    static nest(str, xValue) {
        const YI = "\n";
        const XI = " ";
        const indent = YI + XI.repeat(xValue);
        return str ? indent + str.replace(/\n/g, indent) : "";
    }
}
class AbstractRuntimeNode extends TreeNode {
    getGrammarProgram() { }
    getProgram() {
        return this;
    }
}
class AbstractRuntimeProgram extends AbstractRuntimeNode {
    *getProgramErrorsIterator() {
        let line = 1;
        for (let node of this.getTopDownArrayIterator()) {
            node._cachedLineNumber = line;
            const errs = node.getErrors();
            delete node._cachedLineNumber;
            if (errs.length)
                yield errs;
            line++;
        }
    }
    getProgramErrors() {
        const errors = [];
        let line = 1;
        for (let node of this.getTopDownArray()) {
            node._cachedLineNumber = line;
            const errs = node.getErrors();
            errs.forEach(err => errors.push(err));
            delete node._cachedLineNumber;
            line++;
        }
        return errors;
    }
    // Helper method for selecting potential keywords needed to update grammar file.
    getInvalidKeywords(level = undefined) {
        return Array.from(new Set(this.getProgramErrors()
            .filter(err => err.kind === GrammarConstants.invalidKeywordError)
            .filter(err => (level ? level === err.level : true))
            .map(err => err.subkind)));
    }
    getProgramErrorMessages() {
        return this.getProgramErrors().map(err => err.message);
    }
    getKeywordMap() {
        return this.getDefinition().getRunTimeKeywordMap();
    }
    getCatchAllNodeConstructor(line) {
        // todo: blank line
        // todo: restore didyoumean
        return this.getDefinition().getRunTimeCatchAllNodeConstructor();
    }
    getDefinition() {
        return this.getGrammarProgram();
    }
    getKeywordUsage(filepath = "") {
        // returns a report on what keywords from its language the program uses
        const usage = new TreeNode();
        const grammarProgram = this.getGrammarProgram();
        const keywordDefinitions = grammarProgram.getKeywordDefinitions();
        keywordDefinitions.forEach(child => {
            usage.appendLine([child.getId(), "line-id", "keyword", child.getNodeColumnTypes().join(" ")].join(" "));
        });
        const programNodes = this.getTopDownArray();
        programNodes.forEach((programNode, lineNumber) => {
            const def = programNode.getDefinition();
            const keyword = def.getId();
            const stats = usage.getNode(keyword);
            stats.appendLine([filepath + "-" + lineNumber, programNode.getWords().join(" ")].join(" "));
        });
        return usage;
    }
    getInPlaceSyntaxTree() {
        return this.getTopDownArray()
            .map(child => child.getIndentation() + child.getLineSyntax())
            .join("\n");
    }
    getInPlaceSyntaxTreeWithNodeTypes() {
        return this.getTopDownArray()
            .map(child => child.constructor.name + this.getZI() + child.getIndentation() + child.getLineSyntax())
            .join("\n");
    }
    // todo: refine and make public
    _getSyntaxTreeHtml() {
        const getColor = child => {
            if (child.getLineSyntax().includes("error"))
                return "red";
            return "black";
        };
        const zip = (a1, a2) => {
            let last = a1.length > a2.length ? a1.length : a2.length;
            let parts = [];
            for (let index = 0; index < last; index++) {
                parts.push(`${a1[index]}:${a2[index]}`);
            }
            return parts.join(" ");
        };
        return this.getTopDownArray()
            .map(child => `<div style="white-space: pre;">${child.constructor.name} ${this.getZI()} ${child.getIndentation()} <span style="color: ${getColor(child)};">${zip(child.getLineSyntax().split(" "), child.getLine().split(" "))}</span></div>`)
            .join("");
    }
    getTreeWithNodeTypes() {
        return this.getTopDownArray()
            .map(child => child.constructor.name + this.getZI() + child.getIndentation() + child.getLine())
            .join("\n");
    }
    getWordTypeAtPosition(lineIndex, wordIndex) {
        this._initWordTypeCache();
        const typeNode = this._cache_typeTree.getTopDownArray()[lineIndex - 1];
        return typeNode ? typeNode.getWord(wordIndex - 1) : "";
    }
    _initWordTypeCache() {
        const treeMTime = this.getTreeMTime();
        if (this._cache_programWordTypeStringMTime === treeMTime)
            return undefined;
        this._cache_typeTree = new TreeNode(this.getInPlaceSyntaxTree());
        this._cache_programWordTypeStringMTime = treeMTime;
    }
    getCompiledProgramName(programPath) {
        const grammarProgram = this.getDefinition();
        return programPath.replace(`.${grammarProgram.getExtensionName()}`, `.${grammarProgram.getTargetExtension()}`);
    }
}
/*
A cell contains a word but also the type information for that word.
*/
class GrammarBackedCell {
    constructor(word, type, node, index, expectedPattern, grammarProgram) {
        this._word = word;
        this._type = type;
        this._node = node;
        this._expectedPattern = expectedPattern;
        this._grammarProgram = grammarProgram;
        this._index = index + 1;
    }
    getType() {
        return (this._type && this._type.replace("*", "")) || undefined;
    }
    getWord() {
        return this._word;
    }
    getParsed() {
        return this._getWordTypeClass().parse(this._word);
    }
    isOptional() {
        return this._type && this._type.endsWith("*");
    }
    _getWordTypeClass() {
        return this._grammarProgram.getWordTypes()[this.getType()];
    }
    _getLineNumber() {
        return this._node.getPoint().y;
    }
    getErrorIfAny() {
        const word = this._word;
        if (word === undefined && this.isOptional())
            return undefined;
        const index = this._index;
        const type = this.getType();
        const fullLine = this._node.getLine();
        const line = this._getLineNumber();
        const context = fullLine.split(" ")[0]; // todo: XI
        if (word === undefined)
            return {
                kind: "unfilledColumnError",
                subkind: type,
                level: index,
                context: context,
                message: `unfilledColumnError "${type}" column in "${fullLine}" at line ${line} column ${index}. Expected pattern: "${this._expectedPattern}". definition: ${this._node.getDefinition().toString()}`
            };
        if (type === undefined)
            return {
                kind: "extraWordError",
                subkind: fullLine,
                level: index,
                context: context,
                message: `extraWordError "${word}" in "${fullLine}" at line ${line} column ${index}. Expected pattern: "${this._expectedPattern}".`
            };
        const grammarProgram = this._grammarProgram;
        const runTimeGrammarBackedProgram = this._node.getProgram();
        const wordTypeClass = this._getWordTypeClass();
        if (!wordTypeClass)
            return {
                kind: "grammarDefinitionError",
                subkind: type,
                level: index,
                context: context,
                message: `grammarDefinitionError No column type "${type}" in grammar "${grammarProgram.getExtensionName()}" found in "${fullLine}" on line ${line}. Expected pattern: "${this._expectedPattern}".`
            };
        const isValid = wordTypeClass.isValid(this._word, runTimeGrammarBackedProgram);
        return isValid
            ? undefined
            : {
                kind: "invalidWordError",
                subkind: type,
                level: index,
                context: context,
                message: `invalidWordError in "${fullLine}" at line ${line} column ${index}. "${word}" does not fit in "${type}" column. Expected pattern: "${this._expectedPattern}".`
            };
    }
}
class AbstractRuntimeCodeNode extends AbstractRuntimeNode {
    getProgram() {
        return this.getParent().getProgram();
    }
    getDefinition() {
        return (this.getProgram()
            .getGrammarProgram()
            // todo: do we need a relative to with this keyword path?
            .getDefinitionByKeywordPath(this.getKeywordPath()));
    }
    getCompilerNode(targetLanguage) {
        return this.getDefinition().getDefinitionCompilerNode(targetLanguage, this);
    }
    getParsedWords() {
        return this._getGrammarBackedCellArray().map(word => word.getParsed());
    }
    _getParameterMap() {
        const cells = this._getGrammarBackedCellArray();
        const parameterMap = {};
        cells.forEach(cell => {
            const type = cell.getType();
            if (!parameterMap[type])
                parameterMap[type] = [];
            parameterMap[type].push(cell.getWord());
        });
        return parameterMap;
    }
    getCompiledIndentation(targetLanguage) {
        const compiler = this.getCompilerNode(targetLanguage);
        const indentCharacter = compiler.getIndentCharacter();
        const indent = this.getIndentation();
        return indentCharacter !== undefined ? indentCharacter.repeat(indent.length) : indent;
    }
    getCompiledLine(targetLanguage) {
        const compiler = this.getCompilerNode(targetLanguage);
        const listDelimiter = compiler.getListDelimiter();
        const parameterMap = this._getParameterMap();
        const str = compiler.getTransformation();
        return str ? TreeUtils.formatStr(str, listDelimiter, parameterMap) : this.getLine();
    }
    compile(targetLanguage) {
        return this.getCompiledIndentation(targetLanguage) + this.getCompiledLine(targetLanguage);
    }
    getErrors() {
        // Not enough parameters
        // Too many parameters
        // Incorrect parameter
        return this._getGrammarBackedCellArray()
            .map(check => check.getErrorIfAny())
            .filter(i => i);
    }
    _getGrammarBackedCellArray() {
        const definition = this.getDefinition();
        const grammarProgram = definition.getProgram();
        const parameters = definition.getNodeColumnTypes();
        const expectedPattern = parameters.join(" ");
        const parameterLength = parameters.length;
        const lastParameterType = parameters[parameterLength - 1];
        const lastParameterListType = lastParameterType && lastParameterType.endsWith("*") ? lastParameterType : undefined;
        const words = this.getWordsFrom(1);
        const length = Math.max(words.length, parameterLength);
        const checks = [];
        for (let wordIndex = 0; wordIndex < length; wordIndex++) {
            const word = words[wordIndex];
            const type = wordIndex >= parameterLength ? lastParameterListType : parameters[wordIndex];
            checks[wordIndex] = new GrammarBackedCell(word, type, this, wordIndex, expectedPattern, grammarProgram);
        }
        return checks;
    }
    // todo: just make a fn that computes proper spacing and then is given a node to print
    getLineSyntax() {
        const parameterWords = this._getGrammarBackedCellArray().map(slot => slot.getType());
        return ["keyword"].concat(parameterWords).join(" ");
    }
}
class GrammarBackedErrorNode extends AbstractRuntimeCodeNode {
    getLineSyntax() {
        return "error ".repeat(this.getWords().length).trim();
    }
    getErrors() {
        const parent = this.getParent();
        const context = parent.isRoot() ? "" : parent.getKeyword();
        const locationMsg = context ? `in "${context}" ` : "";
        const point = this.getPoint();
        const keyword = this.getKeyword();
        return [
            {
                kind: GrammarConstants.invalidKeywordError,
                subkind: keyword,
                context: context,
                level: point.x,
                message: `${GrammarConstants.invalidKeywordError} "${keyword}" ${locationMsg}at line ${point.y} column ${point.x}`
            }
        ];
    }
}
class GrammarBackedNonTerminalNode extends AbstractRuntimeCodeNode {
    getKeywordMap() {
        return this.getDefinition().getRunTimeKeywordMap();
    }
    getCatchAllNodeConstructor(line) {
        return this.getDefinition().getRunTimeCatchAllNodeConstructor();
    }
    // todo: implement
    _getNodeJoinCharacter() {
        return "\n";
    }
    compile(targetExtension) {
        const compiler = this.getCompilerNode(targetExtension);
        const openChildrenString = compiler.getOpenChildrenString();
        const closeChildrenString = compiler.getCloseChildrenString();
        const compiledLine = this.getCompiledLine(targetExtension);
        const indent = this.getCompiledIndentation(targetExtension);
        const compiledChildren = this.map(child => child.compile(targetExtension)).join(this._getNodeJoinCharacter());
        return `${indent}${compiledLine}${openChildrenString}
${compiledChildren}
${indent}${closeChildrenString}`;
    }
}
class GrammarBackedAnyNode extends GrammarBackedNonTerminalNode {
    getKeywordMap() {
        return {};
    }
    getErrors() {
        return [];
    }
    getCatchAllNodeConstructor(line) {
        return GrammarBackedAnyNode;
    }
}
class GrammarBackedTerminalNode extends AbstractRuntimeCodeNode {
}
class GrammarCompilerNode extends TreeNode {
    getKeywordMap() {
        const types = [
            GrammarConstants.compiler.sub,
            GrammarConstants.compiler.indentCharacter,
            GrammarConstants.compiler.listDelimiter,
            GrammarConstants.compiler.openChildren,
            GrammarConstants.compiler.closeChildren
        ];
        const map = {};
        types.forEach(type => {
            map[type] = TreeNode;
        });
        return map;
    }
    getTargetExtension() {
        return this.getWord(1);
    }
    getListDelimiter() {
        return this.get(GrammarConstants.compiler.listDelimiter);
    }
    getTransformation() {
        return this.get(GrammarConstants.compiler.sub);
    }
    getIndentCharacter() {
        return this.get(GrammarConstants.compiler.indentCharacter);
    }
    getOpenChildrenString() {
        return this.get(GrammarConstants.compiler.openChildren) || "";
    }
    getCloseChildrenString() {
        return this.get(GrammarConstants.compiler.closeChildren) || "";
    }
}
class GrammarConstNode extends TreeNode {
    getValue() {
        // todo: parse type
        if (this.length)
            return this.childrenToString();
        return this.getWordsFrom(2).join(" ");
    }
    getName() {
        return this.getKeyword();
    }
}
class GrammarConstantsNode extends TreeNode {
    getCatchAllNodeConstructor(line) {
        return GrammarConstNode;
    }
    getConstantsObj() {
        const result = {};
        this.forEach(node => {
            const name = node.getName();
            result[name] = node.getValue();
        });
        return result;
    }
}
class GrammarCustomConstructorNode extends TreeNode {
    _getNodeConstructorFilePath() {
        return this.getWord(2);
    }
    // todo: allow for deeper nesting? use Utils.resolveProperty
    getSubModuleName() {
        return this.getWord(3);
    }
    _getBuiltInConstructors() {
        return {
            ErrorNode: GrammarBackedErrorNode,
            TerminalNode: GrammarBackedTerminalNode,
            NonTerminalNode: GrammarBackedNonTerminalNode,
            AnyNode: GrammarBackedAnyNode
        };
    }
    getErrors() {
        if (this.getDefinedConstructor())
            return [];
        const parent = this.getParent();
        const context = parent.isRoot() ? "" : parent.getKeyword();
        const point = this.getPoint();
        return [
            {
                kind: GrammarConstants.invalidConstructorPathError,
                subkind: this.getKeyword(),
                level: point.x,
                context: context,
                message: `${GrammarConstants.invalidConstructorPathError} no constructor "${this.getLine()}" found at line ${point.y}`
            }
        ];
    }
    getDefinedConstructor() {
        const filepath = this._getNodeConstructorFilePath();
        const builtIns = this._getBuiltInConstructors();
        const builtIn = builtIns[filepath];
        if (builtIn)
            return builtIn;
        const rootPath = this.getRootNode().getTheGrammarFilePath();
        const basePath = TreeUtils.getPathWithoutFileName(rootPath) + "/";
        const fullPath = filepath.startsWith("/") ? filepath : basePath + filepath;
        // todo: remove "window" below?
        if (!this.isNodeJs()) {
            const subModule = this.getSubModuleName();
            let constructor;
            const constructorName = TreeUtils.getClassNameFromFilePath(filepath);
            if (subModule) {
                constructor = TreeUtils.resolveProperty(window[constructorName], subModule);
                if (!constructor)
                    throw new Error(`constructor ${subModule} not found on window.${constructorName}.`);
            }
            else {
                constructor = window[constructorName];
                if (!constructor)
                    throw new Error(`constructor window.${constructorName} deduced from ${filepath} not found.`);
            }
            return constructor;
        }
        const theModule = require(fullPath);
        const subModule = this.getSubModuleName();
        return subModule ? theModule[subModule] : theModule;
    }
}
class GrammarDefinitionErrorNode extends TreeNode {
    getErrors() {
        const parent = this.getParent();
        const context = parent.isRoot() ? "" : parent.getKeyword();
        const point = this.getPoint();
        return [
            {
                kind: GrammarConstants.invalidKeywordError,
                subkind: this.getKeyword(),
                level: point.x,
                context: context,
                message: `${GrammarConstants.invalidKeywordError} "${this.getKeyword()}" at line ${point.y}`
            }
        ];
    }
    getLineSyntax() {
        return ["keyword"].concat(this.getWordsFrom(1).map(word => "any")).join(" ");
    }
}
class AbstractGrammarDefinitionNode extends TreeNode {
    getKeywordMap() {
        const types = [
            GrammarConstants.frequency,
            GrammarConstants.keywords,
            GrammarConstants.columns,
            GrammarConstants.description,
            GrammarConstants.catchAllKeyword,
            GrammarConstants.defaults
        ];
        const map = {};
        types.forEach(type => {
            map[type] = TreeNode;
        });
        map[GrammarConstants.constants] = GrammarConstantsNode;
        map[GrammarConstants.compilerKeyword] = GrammarCompilerNode;
        map[GrammarConstants.constructor] = GrammarCustomConstructorNode;
        return map;
    }
    getId() {
        return this.getWord(1);
    }
    _isNonTerminal() {
        return this._isAnyNode() || this.has(GrammarConstants.keywords) || this.has(GrammarConstants.catchAllKeyword);
    }
    _isAbstract() {
        return false;
    }
    _isAnyNode() {
        return this.has(GrammarConstants.any);
    }
    _getCustomDefinedConstructorNode() {
        return (this.getNodeByColumns(GrammarConstants.constructor, GrammarConstants.constructorJs));
    }
    getDefinedConstructor() {
        if (!this._cache_definedNodeConstructor)
            this._cache_definedNodeConstructor = this._getDefinedNodeConstructor();
        return this._cache_definedNodeConstructor;
    }
    _getDefaultNodeConstructor() {
        if (this._isAnyNode())
            return GrammarBackedAnyNode;
        return this._isNonTerminal() ? GrammarBackedNonTerminalNode : GrammarBackedTerminalNode;
    }
    /* Node constructor is the actual JS class being initiated, different than the Node type. */
    _getDefinedNodeConstructor() {
        const customConstructorDefinition = this._getCustomDefinedConstructorNode();
        if (customConstructorDefinition)
            return customConstructorDefinition.getDefinedConstructor();
        return this._getDefaultNodeConstructor();
    }
    getCatchAllNodeConstructor(line) {
        return GrammarDefinitionErrorNode;
    }
    getProgram() {
        return this.getParent();
    }
    getDefinitionCompilerNode(targetLanguage, node) {
        const compilerNode = this._getCompilerNodes().find(node => node.getTargetExtension() === targetLanguage);
        if (!compilerNode)
            throw new Error(`No compiler for language "${targetLanguage}" for line "${node.getLine()}"`);
        return compilerNode;
    }
    _getCompilerNodes() {
        return this.getChildrenByNodeType(GrammarCompilerNode) || [];
    }
    // todo: remove?
    // for now by convention first compiler is "target extension"
    getTargetExtension() {
        const firstNode = this._getCompilerNodes()[0];
        return firstNode ? firstNode.getTargetExtension() : "";
    }
    getRunTimeKeywordMap() {
        this._initKeywordsMapCache();
        return this._cache_keywordsMap;
    }
    getRunTimeKeywordNames() {
        return Object.keys(this.getRunTimeKeywordMap());
    }
    getRunTimeKeywordMapWithDefinitions() {
        const defs = this._getProgramKeywordDefinitionCache();
        return TreeUtils.mapValues(this.getRunTimeKeywordMap(), key => defs[key]);
    }
    getNodeColumnTypes() {
        const parameters = this.get(GrammarConstants.columns);
        return parameters ? parameters.split(" ") : [];
    }
    /*
     {key<string>: JSKeywordDefClass}
    */
    _initKeywordsMapCache() {
        if (this._cache_keywordsMap)
            return undefined;
        // todo: make this handle extensions.
        const keywordsInScope = this._getKeywordsInScope();
        this._cache_keywordsMap = {};
        // terminals dont have acceptable keywords
        if (!keywordsInScope.length)
            return undefined;
        const allProgramKeywordDefinitions = this._getProgramKeywordDefinitionCache();
        const keywords = Object.keys(allProgramKeywordDefinitions);
        keywords
            .filter(keyword => allProgramKeywordDefinitions[keyword].isOrExtendsAKeywordInScope(keywordsInScope))
            .filter(keyword => !allProgramKeywordDefinitions[keyword]._isAbstract())
            .forEach(keyword => {
            this._cache_keywordsMap[keyword] = allProgramKeywordDefinitions[keyword].getDefinedConstructor();
        });
    }
    _getKeywordsInScope() {
        const keywords = this._getKeywordsNode();
        return keywords ? keywords.getKeywords() : [];
    }
    getTopNodeTypes() {
        const definitions = this._getProgramKeywordDefinitionCache();
        const keywords = this.getRunTimeKeywordMap();
        const arr = Object.keys(keywords).map(keyword => definitions[keyword]);
        arr.sort(TreeUtils.sortByAccessor(definition => definition.getFrequency()));
        arr.reverse();
        return arr.map(definition => definition.getId());
    }
    _getKeywordsNode() {
        return this.getNode(GrammarConstants.keywords);
    }
    _getRunTimeCatchAllKeyword() {
        return "";
    }
    getDefinitionByName(keyword) {
        const definitions = this._getProgramKeywordDefinitionCache();
        return definitions[keyword] || this._getCatchAllDefinition(); // todo: this is where we might do some type of keyword lookup for user defined fns.
    }
    _getCatchAllDefinition() {
        const catchAllKeyword = this._getRunTimeCatchAllKeyword();
        const definitions = this._getProgramKeywordDefinitionCache();
        const def = definitions[catchAllKeyword];
        // todo: implement contraints like a grammar file MUST have a catch all.
        return def ? def : this.getParent()._getCatchAllDefinition();
    }
    _initCatchAllNodeConstructorCache() {
        if (this._cache_catchAllConstructor)
            return undefined;
        this._cache_catchAllConstructor = this._getCatchAllDefinition().getDefinedConstructor();
    }
    getAutocompleteWords(inputStr, additionalWords = []) {
        // todo: add more tests
        const str = this.getRunTimeKeywordNames()
            .concat(additionalWords)
            .join("\n");
        // default is to just autocomplete using all words in existing program.
        return TreeUtils.getUniqueWordsArray(str)
            .filter(obj => obj.word.includes(inputStr) && obj.word !== inputStr)
            .map(obj => obj.word);
    }
    isDefined(keyword) {
        return !!this._getProgramKeywordDefinitionCache()[keyword.toLowerCase()];
    }
    _getProgramKeywordDefinitionCache() { }
    getRunTimeCatchAllNodeConstructor() {
        this._initCatchAllNodeConstructorCache();
        return this._cache_catchAllConstructor;
    }
}
class GrammarKeywordDefinitionNode extends AbstractGrammarDefinitionNode {
    _getRunTimeCatchAllKeyword() {
        return (this.get(GrammarConstants.catchAllKeyword) ||
            this.getParent()._getRunTimeCatchAllKeyword());
    }
    getKeywordMap() {
        const map = super.getKeywordMap();
        map[GrammarConstants.any] = TreeNode;
        map[GrammarConstants.group] = TreeNode;
        return map;
    }
    isOrExtendsAKeywordInScope(keywordsInScope) {
        const chain = this._getKeywordChain();
        return keywordsInScope.some(keyword => chain[keyword]);
    }
    _getKeywordChain() {
        this._initKeywordChainCache();
        return this._cache_keywordChain;
    }
    _getParentKeyword() {
        return this.getWord(2);
    }
    _initKeywordChainCache() {
        if (this._cache_keywordChain)
            return undefined;
        const cache = {};
        cache[this.getId()] = true;
        const parentKeyword = this._getParentKeyword();
        if (parentKeyword) {
            cache[parentKeyword] = true;
            const defs = this._getProgramKeywordDefinitionCache();
            const parentDef = defs[parentKeyword];
            if (!parentDef)
                throw new Error(`${parentKeyword} not found`);
            Object.assign(cache, parentDef._getKeywordChain());
        }
        this._cache_keywordChain = cache;
    }
    _getProgramKeywordDefinitionCache() {
        return this.getParent()._getProgramKeywordDefinitionCache();
    }
    getDoc() {
        return this.getId();
    }
    _getDefaultsNode() {
        return this.get(GrammarConstants.defaults);
    }
    getDefaultFor(name) {
        const defaults = this._getDefaultsNode();
        return defaults ? defaults.get(name) : undefined;
    }
    getDescription() {
        return this.get(GrammarConstants.description) || "";
    }
    getConstantsObject() {
        const constantsNode = this.getNodeByType(GrammarConstantsNode);
        return constantsNode ? constantsNode.getConstantsObj() : {};
    }
    getFrequency() {
        const val = this.get(GrammarConstants.frequency);
        return val ? parseFloat(val) : 0;
    }
}
// todo: add standard types, enum types, from disk types
class AbstractGrammarWordTestNode extends TreeNode {
}
class GrammarRegexTestNode extends AbstractGrammarWordTestNode {
    isValid(str) {
        if (!this._regex)
            this._regex = new RegExp(this.getContent());
        return str.match(this._regex);
    }
}
class GrammarKeywordTableTestNode extends AbstractGrammarWordTestNode {
    _getKeywordTable(runTimeGrammarBackedProgram) {
        // @keywordTable @wordType 1
        const nodeType = this.getWord(1);
        const wordIndex = parseInt(this.getWord(2));
        const table = {};
        runTimeGrammarBackedProgram.findNodes(nodeType).forEach(node => {
            table[node.getWord(wordIndex)] = true;
        });
        return table;
    }
    isValid(str, runTimeGrammarBackedProgram) {
        if (!this._keywordTable)
            this._keywordTable = this._getKeywordTable(runTimeGrammarBackedProgram);
        return this._keywordTable[str] === true;
    }
}
class GrammarEnumTestNode extends AbstractGrammarWordTestNode {
    isValid(str) {
        // @enum c c++ java
        if (!this._map)
            this._map = TreeUtils.arrayToMap(this.getWordsFrom(1));
        return this._map[str];
    }
}
class GrammarWordParserNode extends TreeNode {
    parse(str) {
        const fns = {
            parseInt: parseInt,
            parseFloat: parseFloat
        };
        const fnName = this.getWord(2);
        const fn = fns[fnName];
        if (fn)
            return fn(str);
        return str;
    }
}
class GrammarWordTypeNode extends TreeNode {
    getKeywordMap() {
        const types = [];
        types[GrammarConstants.regex] = GrammarRegexTestNode;
        types[GrammarConstants.keywordTable] = GrammarKeywordTableTestNode;
        types[GrammarConstants.enum] = GrammarEnumTestNode;
        types[GrammarConstants.parseWith] = GrammarWordParserNode;
        return types;
    }
    parse(str) {
        const parser = this.getNode(GrammarConstants.parseWith);
        return parser ? parser.parse(str) : str;
    }
    isValid(str, runTimeGrammarBackedProgram) {
        str = str.replace(/\*$/, ""); // todo: cleanup
        return this.getChildrenByNodeType(AbstractGrammarWordTestNode).every(node => node.isValid(str, runTimeGrammarBackedProgram));
    }
    getId() {
        return this.getWord(1);
    }
    getTypeId() {
        return this.getWord(1);
    }
}
class GrammarWordTypeIntNode extends GrammarWordTypeNode {
    isValid(str) {
        const num = parseInt(str);
        if (isNaN(num))
            return false;
        return num.toString() === str;
    }
    parse(str) {
        return parseInt(str);
    }
}
class GrammarWordTypeBitNode extends GrammarWordTypeNode {
    isValid(str) {
        return str === "0" || str === "1";
    }
    parse(str) {
        return !!parseInt(str);
    }
}
class GrammarWordTypeFloatNode extends GrammarWordTypeNode {
    isValid(str) {
        return !isNaN(parseFloat(str));
    }
    parse(str) {
        return parseFloat(str);
    }
}
class GrammarWordTypeBoolNode extends GrammarWordTypeNode {
    isValid(str) {
        return new Set(["1", "0", "true", "false", "t", "f", "yes", "no"]).has(str.toLowerCase());
    }
    parse(str) {
        return !!parseInt(str);
    }
}
class GrammarWordTypeAnyNode extends GrammarWordTypeNode {
    isValid() {
        return true;
    }
}
GrammarWordTypeNode.types = {
    any: GrammarWordTypeAnyNode,
    float: GrammarWordTypeFloatNode,
    bit: GrammarWordTypeBitNode,
    bool: GrammarWordTypeBoolNode,
    int: GrammarWordTypeIntNode
};
class GrammarRootNode extends AbstractGrammarDefinitionNode {
    _getDefaultNodeConstructor() {
        return undefined;
    }
}
class GrammarAbstractKeywordDefinitionNode extends GrammarKeywordDefinitionNode {
    _isAbstract() {
        return true;
    }
}
// GrammarProgram is a constructor that takes a grammar file, and builds a new
// constructor for new language that takes files in that language to execute, compile, etc.
class GrammarProgram extends AbstractGrammarDefinitionNode {
    getKeywordMap() {
        const map = {};
        map[GrammarConstants.grammar] = GrammarRootNode;
        map[GrammarConstants.wordType] = GrammarWordTypeNode;
        map[GrammarConstants.keyword] = GrammarKeywordDefinitionNode;
        map[GrammarConstants.abstract] = GrammarAbstractKeywordDefinitionNode;
        return map;
    }
    getProgramErrors() {
        const errors = [];
        let line = 1;
        for (let node of this.getTopDownArray()) {
            node._cachedLineNumber = line;
            const errs = node.getErrors();
            errs.forEach(err => errors.push(err));
            delete node._cachedLineNumber;
            line++;
        }
        return errors;
    }
    getNodeConstructor(line) {
        // Todo: we are using 0 + 1 keywords to detect type. Should we ease this or discourage?
        // Todo: this only supports single word type inheritance.
        const parts = line.split(this.getZI());
        let type = parts[0] === GrammarConstants.wordType &&
            (GrammarWordTypeNode.types[parts[1]] || GrammarWordTypeNode.types[parts[2]]);
        return type ? type : super.getNodeConstructor(line);
    }
    getTargetExtension() {
        return this._getGrammarRootNode().getTargetExtension();
    }
    getWordTypes() {
        if (!this._cache_wordTypes)
            this._cache_wordTypes = this._getWordTypes();
        return this._cache_wordTypes;
    }
    _getWordTypes() {
        const types = {};
        // todo: add built in word types?
        this.getChildrenByNodeType(GrammarWordTypeNode).forEach(type => (types[type.getId()] = type));
        return types;
    }
    getProgram() {
        return this;
    }
    getKeywordDefinitions() {
        return this.getChildrenByNodeType(GrammarKeywordDefinitionNode);
    }
    // todo: remove?
    getTheGrammarFilePath() {
        return this.getLine();
    }
    _getGrammarRootNode() {
        return this.getNodeByType(GrammarRootNode);
    }
    getExtensionName() {
        return this._getGrammarRootNode().getId();
    }
    _getKeywordsNode() {
        return this._getGrammarRootNode().getNode(GrammarConstants.keywords);
    }
    getDefinitionByKeywordPath(keywordPath) {
        if (!this._cachedDefinitions)
            this._cachedDefinitions = {};
        if (this._cachedDefinitions[keywordPath])
            return this._cachedDefinitions[keywordPath];
        const parts = keywordPath.split(" ");
        let subject = this;
        let def;
        for (let index = 0; index < parts.length; index++) {
            const part = parts[index];
            def = subject.getRunTimeKeywordMapWithDefinitions()[part];
            if (!def)
                def = subject._getCatchAllDefinition();
            subject = def;
        }
        this._cachedDefinitions[keywordPath] = def;
        return def;
    }
    getDocs() {
        return this.toString();
    }
    _initProgramKeywordDefinitionCache() {
        if (this._cache_keywordDefinitions)
            return undefined;
        const keywordDefinitionMap = {};
        this.getChildrenByNodeType(GrammarKeywordDefinitionNode).forEach(keywordDefinitionNode => {
            keywordDefinitionMap[keywordDefinitionNode.getId()] = keywordDefinitionNode;
        });
        this._cache_keywordDefinitions = keywordDefinitionMap;
    }
    _getProgramKeywordDefinitionCache() {
        this._initProgramKeywordDefinitionCache();
        return this._cache_keywordDefinitions;
    }
    _getRunTimeCatchAllKeyword() {
        return this._getGrammarRootNode().get(GrammarConstants.catchAllKeyword);
    }
    _getRootConstructor() {
        const definedClass = this._getGrammarRootNode().getDefinedConstructor();
        const extendedClass = definedClass || AbstractRuntimeProgram;
        const grammarProgram = this;
        return class extends extendedClass {
            getGrammarProgram() {
                return grammarProgram;
            }
        };
    }
    getRootConstructor() {
        if (!this._cache_rootConstructorClass)
            this._cache_rootConstructorClass = this._getRootConstructor();
        return this._cache_rootConstructorClass;
    }
    toSublimeSyntaxFile() {
        // todo.
        return `%YAML 1.2
---
name: ${this.getExtensionName()}
file_extensions: [${this.getExtensionName()}]
scope: source.${this.getExtensionName()}

contexts:
 main:
   - match: (\A|^) *[^ ]+
     scope: storage.type.tree
     set: [parameters]

 parameters:
   - match: $
     scope: entity.name.type.tree
     pop: true`;
    }
    static newFromCondensed(grammarCode, grammarPath) {
        // todo: handle imports
        const tree = new TreeNode(grammarCode);
        // Expand groups
        const xi = tree.getXI();
        tree.findNodes(`${GrammarConstants.abstract}${xi}${GrammarConstants.group}`).forEach(group => {
            const abstractName = group.getParent().getWord(1);
            group
                .getContent()
                .split(xi)
                .forEach(word => tree.appendLine(`${GrammarConstants.keyword}${xi}${word}${xi}${abstractName}`));
        });
        const expandedGrammarCode = tree.getExpanded(1, 2);
        return new GrammarProgram(expandedGrammarCode, grammarPath);
    }
    static _getBestType(values) {
        const all = fn => {
            for (let i = 0; i < values.length; i++) {
                if (!fn(values[i]))
                    return false;
            }
            return true;
        };
        if (all(str => str === "0" || str === "1"))
            return "bit";
        if (all(str => {
            const num = parseInt(str);
            if (isNaN(num))
                return false;
            return num.toString() === str;
        })) {
            return "int";
        }
        if (all(str => !str.match(/[^\d\.\-]/)))
            return "float";
        const bools = new Set(["1", "0", "true", "false", "t", "f", "yes", "no"]);
        if (all(str => bools.has(str.toLowerCase())))
            return "bool";
        return "any";
    }
    static predictGrammarFile(str, keywords = undefined) {
        const tree = str instanceof TreeNode ? str : new TreeNode(str);
        const xi = " "; // todo: make param?
        keywords = keywords || tree._getUnionNames();
        return keywords //this.getInvalidKeywords()
            .map(keyword => {
            const lines = tree.getColumn(keyword).filter(i => i);
            const cells = lines.map(line => line.split(xi));
            const sizes = new Set(cells.map(c => c.length));
            const max = Math.max(...Array.from(sizes));
            const min = Math.min(...Array.from(sizes));
            let columns = [];
            for (let index = 0; index < max; index++) {
                const set = new Set(cells.map(c => c[index]));
                const values = Array.from(set).filter(c => c);
                const type = GrammarProgram._getBestType(values);
                columns.push(type);
            }
            if (max > min) {
                //columns = columns.slice(0, min)
                let last = columns.pop();
                while (columns[columns.length - 1] === last) {
                    columns.pop();
                }
                columns.push(last + "*");
            }
            const childrenAnyString = tree._isLeafColumn(keyword) ? "" : `\n @any`;
            if (!columns.length)
                return `@keyword ${keyword}${childrenAnyString}`;
            if (columns.length > 1)
                return `@keyword ${keyword}
 @columns ${columns.join(xi)}${childrenAnyString}`;
            return `@keyword ${keyword} ${columns[0]}${childrenAnyString}`;
        })
            .join("\n");
    }
}
const jtree = {};
jtree.program = AbstractRuntimeProgram;
jtree.Utils = TreeUtils;
jtree.TreeNode = TreeNode;
jtree.NonTerminalNode = GrammarBackedNonTerminalNode;
jtree.TerminalNode = GrammarBackedTerminalNode;
jtree.AnyNode = GrammarBackedAnyNode;
jtree.GrammarProgram = GrammarProgram;
jtree.getLanguage = name => require(__dirname + `/../langs/${name}/index.js`);
jtree.getVersion = () => "17.1.3";