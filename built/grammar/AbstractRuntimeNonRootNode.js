"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const TreeUtils_1 = require("../base/TreeUtils");
const GrammarConstants_1 = require("./GrammarConstants");
const AbstractRuntimeNode_1 = require("./AbstractRuntimeNode");
const GrammarBackedCell_1 = require("./GrammarBackedCell");
const TreeErrorTypes_1 = require("./TreeErrorTypes");
class AbstractRuntimeNonRootNode extends AbstractRuntimeNode_1.default {
    getProgram() {
        return this.getParent().getProgram();
    }
    getGrammarProgram() {
        return this.getDefinition().getProgram();
    }
    getNodeTypeId() {
        return this.getDefinition().getNodeTypeIdFromDefinition();
    }
    getDefinition() {
        // todo: do we need a relative to with this firstWord path?
        return this._getNodeTypeDefinitionByName(this.getFirstWordPath());
    }
    getConstantsObject() {
        return this.getDefinition().getConstantsObject();
    }
    // todo: improve layout (use bold?)
    getLineHints() {
        const def = this.getDefinition();
        const catchAllCellTypeName = def.getCatchAllCellTypeId();
        return `${this.getNodeTypeId()}: ${def.getRequiredCellTypeIds().join(" ")}${catchAllCellTypeName ? ` ${catchAllCellTypeName}...` : ""}`;
    }
    getCompilerNode(targetLanguage) {
        return this.getDefinition().getDefinitionCompilerNode(targetLanguage, this);
    }
    getParsedWords() {
        return this._getGrammarBackedCellArray().map(word => word.getParsed());
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
        const str = compiler.getTransformation();
        return str ? TreeUtils_1.default.formatStr(str, listDelimiter, this.cells) : this.getLine();
    }
    compile(targetLanguage) {
        return this.getCompiledIndentation(targetLanguage) + this.getCompiledLine(targetLanguage);
    }
    getErrors() {
        const errors = this._getGrammarBackedCellArray()
            .map(check => check.getErrorIfAny())
            .filter(i => i);
        const firstWord = this.getFirstWord();
        if (this.getDefinition()._shouldBeJustOne())
            this.getParent()
                .findNodes(firstWord)
                .forEach((node, index) => {
                if (index)
                    errors.push(new TreeErrorTypes_1.NodeTypeUsedMultipleTimesError(node));
            });
        return this._getRequiredNodeErrors(errors);
    }
    get cells() {
        const cells = {};
        this._getGrammarBackedCellArray()
            .slice(1)
            .forEach(cell => {
            if (!cell.isCatchAll())
                cells[cell.getCellTypeName()] = cell.getParsed();
            else {
                if (!cells[cell.getCellTypeName()])
                    cells[cell.getCellTypeName()] = [];
                cells[cell.getCellTypeName()].push(cell.getParsed());
            }
        });
        return cells;
    }
    _getExtraWordCellTypeName() {
        return GrammarConstants_1.GrammarStandardCellTypes.extraWord;
    }
    _getGrammarBackedCellArray() {
        const definition = this.getDefinition();
        const grammarProgram = definition.getProgram();
        const requiredCellTypeIds = definition.getRequiredCellTypeIds();
        const firstCellTypeId = definition.getFirstCellTypeId();
        const numberOfRequiredCells = requiredCellTypeIds.length + 1; // todo: assuming here first cell is required.
        const catchAllCellTypeId = definition.getCatchAllCellTypeId();
        const actualWordCountOrRequiredCellCount = Math.max(this.getWords().length, numberOfRequiredCells);
        const cells = [];
        // A for loop instead of map because "numberOfCellsToFill" can be longer than words.length
        for (let cellIndex = 0; cellIndex < actualWordCountOrRequiredCellCount; cellIndex++) {
            const isCatchAll = cellIndex >= numberOfRequiredCells;
            let cellTypeId;
            if (cellIndex === 0)
                cellTypeId = firstCellTypeId;
            else if (isCatchAll)
                cellTypeId = catchAllCellTypeId;
            else
                cellTypeId = requiredCellTypeIds[cellIndex - 1];
            let cellTypeDefinition = grammarProgram.getCellTypeDefinitionById(cellTypeId);
            let cellConstructor;
            if (cellTypeDefinition)
                cellConstructor = cellTypeDefinition.getCellConstructor();
            else if (cellTypeId)
                cellConstructor = GrammarBackedCell_1.GrammarUnknownCellTypeCell;
            else {
                cellConstructor = GrammarBackedCell_1.GrammarExtraWordCellTypeCell;
                cellTypeId = this._getExtraWordCellTypeName();
                cellTypeDefinition = grammarProgram.getCellTypeDefinitionById(cellTypeId);
            }
            cells[cellIndex] = new cellConstructor(this, cellIndex, cellTypeDefinition, cellTypeId, isCatchAll);
        }
        return cells;
    }
    // todo: just make a fn that computes proper spacing and then is given a node to print
    getLineCellTypes() {
        return this._getGrammarBackedCellArray()
            .map(slot => slot.getCellTypeName())
            .join(" ");
    }
    getLineHighlightScopes(defaultScope = "source") {
        return this._getGrammarBackedCellArray()
            .map(slot => slot.getHighlightScope() || defaultScope)
            .join(" ");
    }
}
exports.default = AbstractRuntimeNonRootNode;
