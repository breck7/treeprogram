//tooling product SweeperCraft.browser.js

const { AbstractTreeComponentRootNode, AbstractTreeComponent } = require("../TreeComponentFramework")
const jtree = require("../../products/jtree.node.js")

"use strict"

declare type int = number
declare type Row = int[]
declare type Board = Row[]
declare type Coordinate = int[]
declare type gameState = 0 | 1 | 2
declare type char = string

declare var Mousetrap: any
declare var Figlet: any
declare var jQuery: any
declare var FontsBanner: any

// A fn which renders a view. Otherwise runs headless.
declare type renderFn = (game: SweeperCraftGame) => void

// Permalink looks like: rows/{int}/columns/{int}/layout/{base64encodedBoard}
declare type gamePermalink = string

// Example board string could look like the below, where the 1's represent mines:
// 0100
// 0010
declare type boardString = string

interface GameOptions {
  board?: Board
}

class SweeperCraftGame {
  constructor(board: Board, renderFn: renderFn) {
    this._setBoard(board)
    this._resetBoard()
    this._clicks = []
    this._renderFn = renderFn
    this._render()
  }

  private _clicks: int[][]
  private _renderFn: Function
  private _startTime: int
  private _replayInterval: any
  private _flags: Board
  private _numberOfMines: int
  private _shouldReveal: boolean
  private _board: Board
  private _numberOfRows: int
  private _numberOfColumns: int
  private _numberOfNonMines: int
  private _state: gameState
  private _endTime: int
  private _flagLock: boolean
  private _clicked: Board

  retry() {
    this._startTime = null
    this._resetBoard()
    this._clicks = []
    this._render()
  }

  watchReplay(speedInMs: int = 250) {
    this._resetBoard()
    this._render()
    let step = 0
    const stepCount = this._clicks.length
    this._replayInterval = setInterval(() => {
      if (step >= stepCount) {
        clearInterval(this._replayInterval)
        return
      }
      this._click(this._clicks[step][0], this._clicks[step][1])
      this._render()
      step++
    }, speedInMs)
  }

  getGameMessage() {
    if (this.isLost()) return "You Lost :("
    else if (this.isWon()) return "You won!"
    return ""
  }

  getGameStateClass() {
    if (this.isLost()) return "gameLost"
    else if (this.isWon()) return "gameWon"
    return ""
  }

  getBoard() {
    return this._board
  }

  getNumberOfMoves() {
    return this._clicks.length
  }

  getNumberOfFlags() {
    return SweeperCraftGame.sum(this._flags)
  }

  getNumberOfMines(subtractFlags = false) {
    return this._numberOfMines - (subtractFlags ? this.getNumberOfFlags() : 0)
  }

  toggleFlag(row: int, col: int) {
    this._flags[row][col] = this._flags[row][col] ? 0 : 1
    this._render()
  }

  // Whether to show all bombs when the game is completed.
  shouldReveal() {
    return this._shouldReveal
  }

  click(row: int, column: int) {
    // Begin the timer once the user makes their first click.
    if (!this._startTime) this._startTime = Date.now()

    // noop
    if (this.wasClicked(row, column)) return

    this._clicks.push([row, column, Date.now()])
    this._click(row, column)
    this._render()
  }

  hasBomb(row: int, column: int) {
    return this._board[row][column] === 1
  }

  getNeighborBombCount(row: int, column: int) {
    return this._getNeighbors(row, column)
      .map(pos => (this.hasBomb(pos[0], pos[1]) ? 1 : 0))
      .reduce((sum, currentVal) => sum + currentVal, 0)
  }

  wasClicked(row: int, column: int): boolean {
    return this._clicked[row][column] === 1
  }

  isFlagged(row: int, column: int): boolean {
    return this._flags[row][column] === 1
  }

  isLost() {
    return this._state === 2
  }

  isWon() {
    return this._state === 1
  }

  isFlagLockOn() {
    return this._flagLock === true
  }

  toggleFlagLock() {
    this._flagLock = !this._flagLock
    this._render()
  }

  isOver() {
    return this._state > 0
  }

  getGameTime() {
    if (!this._startTime) return 0
    return Math.round(((this.isOver() ? this._endTime : Date.now()) - this._startTime) / 1000)
  }

  toPermalink(): gamePermalink {
    return SweeperCraftGame.toPermalink(this._board)
  }

  // Deletes the last click from history and replays the remaining clicks.
  undo() {
    this._resetClicked()
    this._resetState()
    this._clicks.pop()
    this._clicks.forEach(c => {
      this._click(c[0], c[1])
    })
    this._render()
  }

  // Generates a gameboard link where a bomb represents a flag.
  getCraftPermalink() {
    return SweeperCraftGame.toPermalink(this._flags)
  }

  win() {
    this._shouldReveal = true
    let row = 0
    let col
    while (row < this._numberOfRows) {
      col = 0
      while (col < this._numberOfColumns) {
        if (!this.hasBomb(row, col)) this._click(row, col)
        col++
      }
      row++
    }
    this._render()
  }

  _setBoard(board: Board) {
    if (!(board instanceof Array)) throw new Error("Invalid Board. Board must be an Array.")
    if (!board.length) throw new Error("Invalid Board. No rows in Board. Expected: Row[]")
    if (!board[0].length) throw new Error("Invalid Board. No columns in row. Expected Row to be: int[]")
    this._board = board
  }

  _resetBoard() {
    clearInterval(this._replayInterval)
    this._numberOfMines = SweeperCraftGame.sum(this._board)
    this._numberOfRows = this._board.length
    this._numberOfColumns = this._board[0].length
    this._numberOfNonMines = this._numberOfRows * this._numberOfColumns - this._numberOfMines
    this._resetClicked()
    this._shouldReveal = false
    this._flags = this._zeroedBoard()
    this._resetState()
  }

  _resetState() {
    this._state = 0
  }

  _zeroedBoard() {
    return SweeperCraftGame.getZeroedBoard(this._numberOfRows, this._numberOfColumns)
  }

  _resetClicked() {
    this._clicked = this._zeroedBoard()
  }

  _click(row: int, column: int) {
    this._clicked[row][column] = 1
    if (this.hasBomb(row, column)) {
      this._lose()
    } else if (this.getNeighborBombCount(row, column) === 0) {
      this._clickNeighbors(row, column)
    }

    if (!this.isOver() && SweeperCraftGame.sum(this._clicked) === this._numberOfNonMines) {
      this._win()
    }
  }

  _clickNeighbors(row: int, column: int) {
    this._getNeighbors(row, column).map(coordinate => {
      const row = coordinate[0]
      const col = coordinate[1]
      if (this._clicked[row][col]) return
      this._clicked[row][col] = 1
      const bombCount = this.getNeighborBombCount(row, col)
      if (!bombCount) this._clickNeighbors(row, col)
    })
  }

  _render() {
    if (this._renderFn) this._renderFn(this)
  }

  _getNeighbors(row: int, column: int) {
    return SweeperCraftGame.getNeighbors(row, column, this._numberOfRows, this._numberOfColumns)
  }

  _win() {
    this._endTime = Date.now()
    this._state = 1
  }

  _lose() {
    this._endTime = Date.now()
    this._state = 2
  }

  // encode 6 bits
  static _bitsToChar(sixBits: string): char {
    // Pad
    if (sixBits.length < 6) sixBits += "0".repeat(6 - sixBits.length)
    const code = parseInt(sixBits, 2)

    return this._permalinkArr[code]
  }

  // decode 6 bits
  static _charToSixBits(singleChar: char): string {
    let num = this._getPermalinkMap()[singleChar]
    let str = num.toString(2)

    if (str.length < 6) str = "0".repeat(6 - str.length) + str
    return str
  }

  static toPermalink(board: Board): gamePermalink {
    const numRows = board.length
    const numCols = board[0].length
    const c = board.map(row => row.join("")).join("")
    const strLength = c.length
    var layout = ""
    for (let i = 0; i < strLength; i = i + 6) {
      layout += SweeperCraftGame._bitsToChar(c.substr(i, 6))
    }

    return "rows/" + numRows + "/columns/" + numCols + "/layout/" + layout
  }

  static isValidPermalink(link: string) {
    return link.match("rows/")
  }

  static boardFromPermalink(link: gamePermalink): Board {
    const options: any = linkToObject(link)
    const numRows = parseInt(options.rows)
    const numCols = parseInt(options.columns)

    // If no layout provided, just generate a random board.
    if (!options.layout) {
      const numMines = options.mines ? parseInt(options.mines) : 0
      return SweeperCraftGame.getRandomBoard(numRows, numCols, numMines)
    }

    const layout = options.layout
    var board = SweeperCraftGame.getZeroedBoard(numRows, numCols)

    const expectedSquares = numRows * numCols
    var boardStr = ""
    for (let i = 0; i < layout.length; i++) {
      boardStr += SweeperCraftGame._charToSixBits(layout[i])
    }

    boardStr = boardStr.substr(0, expectedSquares)
    board = []
    for (var i = 0; i < numRows; i++) {
      board.push(
        boardStr
          .substr(i * numCols, numCols)
          .split("")
          .map(c => parseInt(c))
      )
    }
    return board
  }

  static boardFromString(str: boardString): Board {
    const sanitizedString = str.replace(/\r/g, "").trim()
    const nonMineChar = _detectNonMineCharacter(sanitizedString)

    return sanitizedString.split("\n").map(row => row.split("").map(c => (c === nonMineChar ? 0 : 1)))
  }

  // Return the sum of an array of arrays of numbers
  static sum(grid: Board): number {
    return grid.reduce((sum, row) => sum + row.reduce((rowSum, col) => rowSum + col, 0), 0)
  }

  static getNeighbors(row: int, column: int, numberOfRows: int, numberOfColumns: int): Coordinate[] {
    const neighbors = []
    const aboveRow = row - 1
    const belowRow = row + 1
    const leftCol = column - 1
    const rightCol = column + 1

    if (aboveRow >= 0) {
      neighbors.push([aboveRow, column])
      if (leftCol >= 0) neighbors.push([aboveRow, leftCol])
      if (rightCol < numberOfColumns) neighbors.push([aboveRow, rightCol])
    }

    if (leftCol >= 0) neighbors.push([row, leftCol])
    if (rightCol < numberOfColumns) neighbors.push([row, rightCol])

    if (belowRow < numberOfRows) {
      neighbors.push([belowRow, column])
      if (leftCol >= 0) neighbors.push([belowRow, leftCol])
      if (rightCol < numberOfColumns) neighbors.push([belowRow, rightCol])
    }

    return neighbors
  }

  static boardFromWords(sentence: string): Board {
    const words = sentence.split(/ /g)
    const lines = []
    const bombChar = "#"
    let maxWidth = 0
    let boardString = ""

    words.forEach(word => {
      const line = Figlet.write(word, "banner")
      const length = line.split(/\n/)[0].length
      if (length > maxWidth) maxWidth = length
      boardString += "\n" + line.replace(/ /g, "0")
    })

    const rows = boardString.trim().split(/\n/g)

    const board = SweeperCraftGame.getZeroedBoard(rows.length, maxWidth)
    for (let row = 0; row < board.length; row++) {
      for (let col = 0; col < maxWidth; col++) {
        if (rows[row][col] === bombChar) board[row][col] = 1
      }
    }

    return board
  }

  static getRandomBoard(rows: int, cols: int, mines: int): Board {
    const numberOfSquares = rows * cols
    if (!rows || !cols) throw new Error("Rows and cols must be greater than 0.")
    if (mines > numberOfSquares) throw new Error("Number of mines can't be more than the number of squares.")

    const board = SweeperCraftGame.getZeroedBoard(rows, cols)

    while (mines) {
      let num = getRandomInt(0, numberOfSquares)
      let row = Math.floor(num / cols)
      let col = num % cols
      if (!board[row][col]) {
        board[row][col] = 1
        mines--
      }
    }

    return board
  }

  static getZeroedBoard(rows: int, cols: int): Board {
    const board = []
    while (rows) {
      board.push(Array(cols).fill(0))
      rows--
    }
    return board
  }

  static _permalinkMap: any
  static _permalinkArr = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-.".split("")

  // todo: what is this?
  static _getPermalinkMap() {
    if (!this._permalinkMap) {
      this._permalinkMap = {}
      this._permalinkArr.forEach((l, i) => {
        this._permalinkMap[l] = i
      })
    }
    return this._permalinkMap
  }
}

// Simple algo to guess which character represents a mine-free square.
const _detectNonMineCharacter = (str: string): string => {
  const matches = str.match(/([^01\n])/)

  // Convention is to have a 0 represent a mine free square.
  if (!matches) return "0"

  // If there is a char other than 1's, 0's, and newlines, use the first char as the mine free char.
  return str.substr(0, 1)
}

// Parses a pretty url into a matching objecte. Example: color/blue/height/2 becomes {color: blue, height: 2}
const linkToObject = (link: string): Object => {
  const parts = link.replace(/^\//, "").split("/")
  const obj: any = {}
  const length = parts.length
  for (var index = 0; index < length; index = index + 2) {
    obj[parts[index]] = parts[index + 1]
  }
  return obj
}

// Returns a random integer between min (included) and max (excluded)
// Using Math.round() will give you a non-uniform distribution!
const getRandomInt = (min: int, max: int) => Math.floor(Math.random() * (max - min)) + min

class SweeperCraftApp extends AbstractTreeComponentRootNode {
  createParser() {
    return new jtree.TreeNode.Parser(undefined, {
      header: header,
      shortcutsTable: shortcutsTable
    })
  }

  private _game: SweeperCraftGame

  getGame() {
    return this._game
  }

  static getDefaultStartState() {
    return `header
board
controls
shortcutsTable`
  }

  private _isFirstRender = true
  renderAndGetRenderResult(stumpNode?: any) {
    if (!this._isFirstRender) {
      this._firstRender(stumpNode)
      this._isFirstRender = false
    }

    return super.renderAndGetRenderResult(stumpNode)
  }

  _getKeyboardShortcuts() {
    return {
      u: () => this._mainGame.undo(),
      s: () => this._mainGame.win(),
      l: () => this._mainGame.toggleFlagLock(),
      r: () => {
        if (this._mainGame.isOver()) this._mainGame.watchReplay()
      },
      "?": () => jQuery("#shortcuts").toggle(),
      e: () => {
        location.hash = SweeperCraftGame.toPermalink(SweeperCraftGame.getRandomBoard(9, 9, 10))
      },
      m: () => {
        location.hash = SweeperCraftGame.toPermalink(SweeperCraftGame.getRandomBoard(16, 16, 44))
      },
      h: () => {
        location.hash = SweeperCraftGame.toPermalink(SweeperCraftGame.getRandomBoard(16, 30, 99))
      },
      w: () => {
        const phrase = prompt("Enter a word or phrase to turn into a board:")
        if (!phrase) return

        const board = SweeperCraftGame.boardFromWords(phrase)
        const link = SweeperCraftGame.toPermalink(board)
        location.hash = link
      }
    }
  }

  private _loadFromHash(stumpNode: any) {
    const link = location.hash.replace(/^\#/, "")
    let board
    if (!link) board = SweeperCraftGame.getRandomBoard(9, 9, 10)
    else board = SweeperCraftGame.boardFromPermalink(link)
    this._mainGame = new SweeperCraftGame(board, game => {
      this.renderAndGetRenderResult(stumpNode)
    })
  }

  private _mainGame: SweeperCraftGame

  private _firstRender(stumpNode: any) {
    window.addEventListener("error", err => {
      jQuery("#errors").html(`Something went wrong: ${err.message}. <a href=''>Refresh</a>`)
    })

    const keyboardShortcuts: any = this._getKeyboardShortcuts()
    Object.keys(keyboardShortcuts).forEach(key => {
      Mousetrap.bind(key, keyboardShortcuts[key])
    })

    Figlet.loadFont("banner", FontsBanner)

    window.addEventListener("hashchange", () => this._loadFromHash(stumpNode))

    // Initialize first game
    if (SweeperCraftGame.isValidPermalink(location.hash.replace(/^#/, ""))) this._loadFromHash(stumpNode)
    else location.hash = SweeperCraftGame.toPermalink(SweeperCraftGame.getRandomBoard(9, 9, 10))

    // Skip reactjs for updating timer
    setInterval(() => {
      if (this._mainGame) jQuery(".timer").html(this._mainGame.getGameTime().toString())
    }, 1000)
  }
}

class header extends AbstractTreeComponent {
  getStumpCode() {
    const game = this.getRoot().getGame()
    return `div
 id header
 div
  class logo
  a SweeperCraft
   href #
 div
  span ${game.getNumberOfMines(true)}
   id minesLeft
  span ${game.getNumberOfMoves()}
   id moves
  span ${game.getGameTime()}
   class timer
  span ${this.getGameMessage()}
    id gameStatus`
  }
}

class board extends AbstractTreeComponent {}

class row extends AbstractTreeComponent {}

class square extends AbstractTreeComponent {}

class controls extends AbstractTreeComponent {
  getStumpCode() {
    const parts = []
    const game = this.getRoot().getGame()

    if (game.isOver())
      parts.push(`div Restart
 class button`) // onclick game.retry()

    if (game.isFlagLockOn()) parts.push(`span Flag lock on`)

    return parts.join("\n")
  }
}

class shortcutsTable extends AbstractTreeComponent {
  getStumpCode() {
    const game = this.getRoot().getGame()
    let craftDiv = ""
    if (game.getNumberOfFlags() && !game.getNumberOfMoves()) {
      const craftLink = game.getCraftPermalink()
      craftDiv = `Your game link: <a href="#${craftLink}">${craftLink}</a>`
    }
    return `div
 id shortcuts
 div ${craftDiv}
 table
  tbody
   tr
    td ?
    td Show/Hide Keyboard Shortcuts
   tr
    td u
    td Undo
   tr
    td l
    td Toggle Flag Lock
   tr
    td r
    td Watch instant replay
   tr
    td s
    td Solve game
   tr
    td n
    td New easy board
   tr
    td m
    td New medium board
   tr
    td h
    tr New hard board
   tr
    td w
    td New board from word`
  }
}

export { SweeperCraftApp, SweeperCraftGame }