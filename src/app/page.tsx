'use client';
import React, { useReducer, useEffect, useRef, useState } from 'react';
// import { randomUUID } from 'crypto';
// import toast, { Toaster } from 'react-hot-toast';

type Direction = 'across' | 'down';
const INITIAL_GRID_SIZE = 10; // number of tiles on a side (starts as square)
const MAX_GRID_AREA = 400; // total number of tiles (area in tiles)

// Easier letter distribution - more common letters, fewer difficult ones
const generateDailyTiles = (random = false): string[] => {
  const easyLetterDistribution = {
    A: 8,
    B: 2,
    C: 2,
    D: 3,
    E: 12,
    F: 2,
    G: 2,
    H: 2,
    I: 8,
    J: 1,
    K: 1,
    L: 4,
    M: 2,
    N: 6,
    O: 8,
    P: 2,
    Q: 1,
    R: 6,
    S: 4,
    T: 6,
    U: 4,
    V: 2,
    W: 2,
    X: 1,
    Y: 1,
    Z: 1,
  };

  const allLetters: string[] = [];
  Object.entries(easyLetterDistribution).forEach(([letter, count]) => {
    for (let i = 0; i < count; i++) {
      allLetters.push(letter);
    }
  });

  const now = new Date();
  const utcMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  // console.log('utcMidnight: ', utcMidnight);

  const randomOffset = random ? Math.floor(Math.random() * 1000000) : 0;

  const seededRandom = (seed: number) => {
    const raw = Math.sin(seed) * 10000;
    return raw - Math.floor(raw); // get number after decimal place (between 0-1)
  };

  // fisher-yates shuffling
  for (let i = allLetters.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom(utcMidnight + i + randomOffset) * (i + 1)); // inside Math.floor: random # from 0 to i

    [allLetters[i], allLetters[j]] = [allLetters[j], allLetters[i]];
  }

  return allLetters.slice(0, 16);
};

const DEMO_TILES = 'HELLOWRLD'.split('');

const validateWordWithAPI = async (word: string): Promise<boolean> => {
  try {
    const response = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${word.toLowerCase()}`
    );
    return response.ok;
  } catch (error) {
    return word.length >= 2;
  }
};

interface GridCell {
  letter: string;
}
interface Tile {
  letter: string;
  isUsed: boolean;
  id: number;
  isNew?: boolean;
}
interface GameState {
  grid: GridCell[][];
  gridRows: number;
  gridCols: number;
  selected: { row: number; col: number };
  direction: Direction;
  tiles: Tile[];
  gameStartTime: number;
  gameEndTime: number | null;
  isGameEnded: boolean;
  gameWon: boolean;
  isPaused: boolean;
  peelMode: boolean;
  peelLetter: string;
  showToast: string;
  persistentToast: boolean;
  gameStarted: boolean;
  isDemoMode: boolean;
  demoCompleted: boolean;
  demoTime: number | null;
  gamePhase: 'start' | 'demo' | 'game' | 'random';
}

type GameAction =
  | { type: 'START_GAME' }
  | { type: 'START_DEMO' }
  | { type: 'START_RANDOM' }
  | { type: 'EXIT_DEMO' }
  | { type: 'COMPLETE_DEMO' }
  | { type: 'CONTINUE_TO_GAME' }
  | { type: 'SELECT_CELL'; payload: { row: number; col: number } }
  | { type: 'TOGGLE_DIRECTION' }
  | { type: 'MOVE_CURSOR'; payload: { row: number; col: number } }
  | { type: 'SET_LETTER'; payload: { row: number; col: number; letter: string } }
  | { type: 'CLEAR_LETTER'; payload: { row: number; col: number } }
  | { type: 'USE_TILE'; payload: string }
  | { type: 'RETURN_TILE'; payload: string }
  | { type: 'PEEL_TILE'; payload: string }
  | { type: 'END_GAME'; payload?: { won: boolean } }
  | { type: 'GIVE_UP' }
  | { type: 'TOGGLE_PAUSE' }
  | { type: 'RESET_GAME' }
  | { type: 'START_PEEL'; payload: string }
  | { type: 'CANCEL_PEEL' }
  | { type: 'SHOW_TOAST'; payload: { message: string; persistent?: boolean } }
  | { type: 'HIDE_TOAST' }
  | { type: 'TOGGLE_DEMO' }
  | {
      type: 'EXPAND_GRID';
      payload: { newRows: number; newCols: number; rowOffset?: number; colOffset?: number };
    }
  | { type: 'ARROW_MOVE'; payload: 'up' | 'down' | 'left' | 'right' };

const generateRandomTiles = (count: number): string[] => {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return Array.from({ length: count }, () => letters[Math.floor(Math.random() * letters.length)]);
};

const createInitialState = (): GameState => ({
  grid: Array.from({ length: INITIAL_GRID_SIZE }, () =>
    Array.from({ length: INITIAL_GRID_SIZE }, () => ({ letter: '' }))
  ),
  gridRows: INITIAL_GRID_SIZE,
  gridCols: INITIAL_GRID_SIZE,
  selected: {
    row: Math.floor((INITIAL_GRID_SIZE - 1) / 2),
    col: Math.floor((INITIAL_GRID_SIZE - 1) / 2),
  },
  direction: 'across',
  tiles: generateDailyTiles().map((letter, index) => ({
    letter,
    isUsed: false,
    id: index,
  })),
  gameStartTime: Date.now(),
  gameEndTime: null,
  isGameEnded: false,
  gameWon: false,
  isPaused: false,
  peelMode: false,
  peelLetter: '',
  showToast: '',
  persistentToast: false,
  gameStarted: false,
  isDemoMode: false,
  demoCompleted: false,
  demoTime: null,
  gamePhase: 'start',
});

// reducer: function that houses all the logic of how the state gets updated. pass it state and action arguments -> returns next state
function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START_GAME':
      return {
        ...state,
        gameStarted: true,
        gameStartTime: Date.now(),
        gamePhase: 'game',
        tiles: generateDailyTiles().map((letter, index) => ({
          letter,
          isUsed: false,
          id: index,
        })),
        grid: Array.from({ length: INITIAL_GRID_SIZE }, () =>
          Array.from({ length: INITIAL_GRID_SIZE }, () => ({ letter: '' }))
        ),
      };

    case 'START_RANDOM':
      return {
        ...state,
        gameStarted: true,
        gameStartTime: Date.now(),
        gamePhase: 'game',
        tiles: generateDailyTiles(true).map((letter, index) => ({
          letter,
          isUsed: false,
          id: index,
        })),
        grid: Array.from({ length: INITIAL_GRID_SIZE }, () =>
          Array.from({ length: INITIAL_GRID_SIZE }, () => ({ letter: '' }))
        ),
      };

    case 'START_DEMO':
      return {
        ...state,
        isDemoMode: true,
        gameStarted: true,
        gameStartTime: Date.now(),
        gamePhase: 'demo',
        tiles: DEMO_TILES.map((letter, index) => ({
          letter,
          isUsed: false,
          id: index,
        })),
        grid: Array.from({ length: INITIAL_GRID_SIZE }, () =>
          Array.from({ length: INITIAL_GRID_SIZE }, () => ({ letter: '' }))
        ),
      };

    case 'EXIT_DEMO':
      return {
        ...createInitialState(),
        gamePhase: 'start',
      };

    case 'COMPLETE_DEMO':
      return {
        ...state,
        demoCompleted: true,
        demoTime: Date.now() - state.gameStartTime,
        isGameEnded: true,
      };

    case 'CONTINUE_TO_GAME':
      return {
        ...createInitialState(),
        gameStarted: true,
        gameStartTime: Date.now(),
        gamePhase: 'game',
      };

    case 'SELECT_CELL':
      return { ...state, selected: action.payload };

    case 'TOGGLE_DIRECTION':
      return { ...state, direction: state.direction === 'across' ? 'down' : 'across' };

    case 'TOGGLE_PAUSE':
      return { ...state, isPaused: !state.isPaused };

    case 'MOVE_CURSOR':
      return { ...state, selected: action.payload };

    case 'USE_TILE': {
      const letter = action.payload;
      const availableTileIndex = state.tiles.findIndex(
        (tile) => tile.letter === letter && !tile.isUsed
      );
      if (availableTileIndex === -1) return state;
      const newTiles = [...state.tiles];
      newTiles[availableTileIndex] = { ...newTiles[availableTileIndex], isUsed: true };
      return { ...state, tiles: newTiles };
    }

    case 'RETURN_TILE': {
      const letter = action.payload;
      const usedTileIndex = state.tiles.findIndex((tile) => tile.letter === letter && tile.isUsed);
      console.log('RETURN_TILE>letter:', letter);
      if (usedTileIndex === -1) return state;
      const newTiles = [...state.tiles];
      newTiles[usedTileIndex] = { ...newTiles[usedTileIndex], isUsed: false };
      return { ...state, tiles: newTiles };
    }

    case 'START_PEEL':
      return { ...state, peelMode: true, peelLetter: action.payload };

    case 'CANCEL_PEEL':
      return { ...state, peelMode: false, peelLetter: '', showToast: '', persistentToast: false };

    case 'PEEL_TILE': {
      const letter = action.payload;
      const tileToRemove = state.tiles.find((tile) => tile.letter === letter && !tile.isUsed);
      if (!tileToRemove) return state;

      const updatedTiles = state.tiles.filter((tile) => tile.id !== tileToRemove.id);
      const maxId = Math.max(...state.tiles.map((t) => t.id), 0);
      const newTiles = generateRandomTiles(3).map((newLetter, index) => ({
        letter: newLetter,
        isUsed: false,
        id: maxId + index + 1,
        isNew: true,
      }));

      return {
        ...state,
        tiles: [...updatedTiles, ...newTiles],
        peelMode: false,
        peelLetter: '',
        showToast: '',
        persistentToast: false,
      };
    }

    case 'END_GAME':
      const won = action.payload?.won ?? false;
      return {
        ...state,
        gameEndTime: Date.now(),
        isGameEnded: true,
        gameWon: won,
      };

    case 'GIVE_UP':
      return { ...state, gameEndTime: Date.now(), isGameEnded: true, gameWon: false };

    case 'RESET_GAME':
      return createInitialState();

    case 'SHOW_TOAST':
      return {
        ...state,
        showToast: action.payload.message,
        persistentToast: action.payload.persistent || false,
      };

    case 'HIDE_TOAST':
      return { ...state, showToast: '', persistentToast: false };

    case 'SET_LETTER': {
      const { row, col, letter } = action.payload;
      const newGrid = state.grid.map((gridRow, rowIdx) =>
        gridRow.map((cell, colIdx) => (rowIdx === row && colIdx === col ? { letter } : { ...cell }))
      );
      return { ...state, grid: newGrid };
    }

    case 'CLEAR_LETTER': {
      const { row, col } = action.payload;
      const newGrid = state.grid.map((gridRow, rowIdx) =>
        gridRow.map((cell, colIdx) =>
          rowIdx === row && colIdx === col ? { letter: '' } : { ...cell }
        )
      );
      return { ...state, grid: newGrid };
    }

    case 'EXPAND_GRID': {
      const { newRows, newCols, rowOffset = 0, colOffset = 0 } = action.payload;
      const newGrid = Array.from({ length: newRows }, (_, rowIdx) =>
        Array.from({ length: newCols }, (_, colIdx) => {
          const originalRow = rowIdx - rowOffset;
          const originalCol = colIdx - colOffset;
          if (
            originalRow >= 0 &&
            originalRow < state.gridRows &&
            originalCol >= 0 &&
            originalCol < state.gridCols
          ) {
            return { ...state.grid[originalRow][originalCol] };
          }
          return { letter: '' };
        })
      );
      return {
        ...state,
        grid: newGrid,
        gridRows: newRows,
        gridCols: newCols,
        selected: {
          row: state.selected.row + rowOffset,
          col: state.selected.col + colOffset,
        },
      };
    }

    case 'ARROW_MOVE': {
      const { row, col } = state.selected;
      let newRow = row;
      let newCol = col;
      let needsExpansion = false;
      let expansionConfig = {
        newRows: state.gridRows,
        newCols: state.gridCols,
        rowOffset: 0,
        colOffset: 0,
      };

      switch (action.payload) {
        case 'up':
          if (row > 0) {
            newRow = row - 1;
          } else {
            // At top edge - expand upward
            needsExpansion = true;
            expansionConfig = {
              newRows: state.gridRows + 1,
              newCols: state.gridCols,
              rowOffset: 1,
              colOffset: 0,
            };
            newRow = 0;
          }
          break;
        case 'down':
          if (row < state.gridRows - 1) {
            newRow = row + 1;
          } else {
            // At bottom edge - expand downward
            needsExpansion = true;
            expansionConfig = {
              newRows: state.gridRows + 1,
              newCols: state.gridCols,
              rowOffset: 0,
              colOffset: 0,
            };
            newRow = row + 1;
          }
          break;
        case 'left':
          if (col > 0) {
            newCol = col - 1;
          } else {
            // At left edge - expand leftward
            needsExpansion = true;
            expansionConfig = {
              newRows: state.gridRows,
              newCols: state.gridCols + 1,
              rowOffset: 0,
              colOffset: 1,
            };
            newCol = 0;
          }
          break;
        case 'right':
          if (col < state.gridCols - 1) {
            newCol = col + 1;
          } else {
            // At right edge - expand rightward
            needsExpansion = true;
            expansionConfig = {
              newRows: state.gridRows,
              newCols: state.gridCols + 1,
              rowOffset: 0,
              colOffset: 0,
            };
            newCol = col + 1;
          }
          break;
      }

      if (needsExpansion) {
        const expandedState = gameReducer(state, {
          type: 'EXPAND_GRID',
          payload: expansionConfig,
        });
        return { ...expandedState, selected: { row: newRow, col: newCol } };
      }

      return { ...state, selected: { row: newRow, col: newCol } };
    }

    default:
      return state;
  }
}

function extractWords(grid: GridCell[][], rows: number, cols: number): string[] {
  const words: string[] = [];

  for (let row = 0; row < rows; row++) {
    let currentWord = '';
    for (let col = 0; col < cols; col++) {
      const letter = grid[row][col].letter;
      if (letter) {
        currentWord += letter;
      } else {
        if (currentWord.length > 1) words.push(currentWord);
        currentWord = '';
      }
    }
    if (currentWord.length > 1) words.push(currentWord);
  }

  for (let col = 0; col < cols; col++) {
    let currentWord = '';
    for (let row = 0; row < rows; row++) {
      const letter = grid[row][col].letter;
      if (letter) {
        currentWord += letter;
      } else {
        if (currentWord.length > 1) words.push(currentWord);
        currentWord = '';
      }
    }
    if (currentWord.length > 1) words.push(currentWord);
  }

  return words;
}

function CustomToast({
  message,
  onClose,
  persistent,
}: {
  message: string;
  onClose: () => void;
  persistent?: boolean;
}) {
  useEffect(() => {
    console.log('toast message: ', message);
    if (!persistent) {
      const timer = setTimeout(onClose, 2000);
      return () => clearTimeout(timer);
    }
  }, [onClose, persistent]);

  return (
    <div className='border fixed top-8 left-1/2 transform -translate-x-1/2 bg-yellow-800 text-yellow-50 px-4 py-2 rounded text-sm z-50 shadow-lg'>
      {message}
    </div>

    // <div></div>
  );
}

function Timer({
  startTime,
  endTime,
  isEnded,
  isPaused,
}: {
  startTime: number;
  endTime: number | null;
  isEnded: boolean;
  isPaused: boolean;
}) {
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    if (isEnded || isPaused) return;
    const interval = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isEnded, isPaused]);

  const elapsed = (endTime || currentTime) - startTime;
  const minutes = Math.floor(elapsed / 60000);
  const seconds = Math.floor((elapsed % 60000) / 1000);

  return (
    <div className='font-mono text-yellow-700'>
      {minutes}:{seconds.toString().padStart(2, '0')}
    </div>
  );
}

function Cell({
  letter,
  isSelected,
  direction,
  onClick,
}: {
  letter: string;
  isSelected: boolean;
  direction: Direction;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`
        w-10 h-10 border border-black cursor-pointer 
        flex items-center justify-center font-bold text-lg
        transition-colors duration-150 relative
        ${
          isSelected
            ? 'bg-yellow-600 text-white border-black'
            : letter
            ? 'bg-white hover:bg-yellow-50'
            : 'bg-yellow-25 hover:bg-yellow-100'
        }
      `}>
      <span className='select-none'>{letter}</span>
      {isSelected && (
        <div
          className={`absolute text-white text-xs ${
            direction === 'across' ? 'top-0 right-1' : 'bottom-0 left-1'
          }`}>
          {direction === 'across' ? '→' : '↓'}
        </div>
      )}
    </div>
  );
}

function Tile({ letter, isUsed, isNew }: { letter: string; isUsed: boolean; isNew?: boolean }) {
  return (
    <div className='relative'>
      {isNew && !isUsed && (
        <div className='absolute -bottom-1 left-1/2 transform -translate-x-1/2 text-xs text-yellow-700 px-1 py-0.5 rounded text-s font-extrabold z-10'>
          new!
        </div>
      )}
      <div
        className={`
        flex items-center justify-center w-8 h-8 rounded text-sm font-bold shadow-sm
        ${
          isUsed
            ? 'bg-yellow-100 text-yellow-400 line-through border border-yellow-200'
            : 'bg-white border border-yellow-300 text-yellow-800 hover:bg-yellow-50'
        }
      `}>
        {letter}
      </div>
    </div>
  );
}

export default function SimpleBananagrams() {
  const [state, dispatch] = useReducer(gameReducer, createInitialState());
  const [isValidating, setIsValidating] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.focus();
    }
  }, [state.gamePhase, state.demoCompleted]);

  useEffect(() => {
    if (gridRef.current && (state.gameStarted || state.gamePhase === 'game')) {
      gridRef.current.focus();
    }
  }, [state.gameStarted, state.gamePhase]);

  const isLetterAvailable = (letter: string): boolean => {
    return state.tiles.some((tile) => tile.letter === letter && !tile.isUsed);
  };

  const handleBananasClick = async () => {
    const availableTiles = state.tiles.filter((tile) => !tile.isUsed);

    if (availableTiles.length > 0) {
      dispatch({ type: 'SHOW_TOAST', payload: { message: 'Use all tiles first' } });
      return;
    }

    setIsValidating(true);
    const words = extractWords(state.grid, state.gridRows, state.gridCols);

    if (words.length === 0) {
      dispatch({ type: 'SHOW_TOAST', payload: { message: 'No words found' } });
      setIsValidating(false);
      return;
    }

    const validationPromises = words.map((word) => validateWordWithAPI(word));
    const validationResults = await Promise.all(validationPromises);
    const allWordsValid = validationResults.every((isValid) => isValid);
    setIsValidating(false);

    if (allWordsValid) {
      if (state.isDemoMode) {
        dispatch({ type: 'COMPLETE_DEMO' });
      } else {
        dispatch({ type: 'END_GAME', payload: { won: true } });
      }
    } else {
      const invalidWords = words.filter((_, index) => !validationResults[index]);
      dispatch({ type: 'SHOW_TOAST', payload: { message: `Invalid: ${invalidWords.join(', ')}` } });
    }
  };

  const handleLetterInput = (letter: string) => {
    if (!isLetterAvailable(letter)) return;

    // add while loop: while not at end of row/col (don't expand) and unoccupied not found, keep looking
    // - if unoccupied found, move there
    // - otherwise, add an unoccupied row/col

    function advanceCursorExpandGrid() {
      if (state.direction === 'across') {
        console.log('advancing cursor across');

        let destColIdx = col + 1;

        // Check if we're already at the last column
        if (destColIdx >= state.gridCols) {
          // Need to expand grid first
          dispatch({
            type: 'EXPAND_GRID',
            payload: { newRows: state.gridRows, newCols: state.gridCols + 1 },
          });
          dispatch({ type: 'MOVE_CURSOR', payload: { row, col: destColIdx } });
          return;
        }

        // Look for empty position in subsequent columns
        while (destColIdx < state.gridCols && state.grid[row][destColIdx].letter !== '') {
          destColIdx++;
        }

        // If we found an empty spot within current grid
        if (destColIdx < state.gridCols) {
          dispatch({ type: 'MOVE_CURSOR', payload: { row, col: destColIdx } });
        } else {
          // All positions to the right are occupied, need to expand
          dispatch({
            type: 'EXPAND_GRID',
            payload: { newRows: state.gridRows, newCols: state.gridCols + 1 },
          });
          dispatch({ type: 'MOVE_CURSOR', payload: { row, col: destColIdx } });
        }
      } else if (state.direction === 'down') {
        console.log('advancing cursor DOWN');

        let destRowIdx = row + 1;

        // Check if we're already at the last row
        if (destRowIdx >= state.gridRows) {
          // Need to expand grid first
          dispatch({
            type: 'EXPAND_GRID',
            payload: { newRows: state.gridRows + 1, newCols: state.gridCols },
          });
          dispatch({ type: 'MOVE_CURSOR', payload: { row: destRowIdx, col } });
          return;
        }

        // Look for empty position in subsequent rows
        while (destRowIdx < state.gridRows && state.grid[destRowIdx][col].letter !== '') {
          destRowIdx++;
        }

        // If we found an empty spot within current grid
        if (destRowIdx < state.gridRows) {
          dispatch({ type: 'MOVE_CURSOR', payload: { row: destRowIdx, col } });
        } else {
          // All positions below are occupied, need to expand
          dispatch({
            type: 'EXPAND_GRID',
            payload: { newRows: state.gridRows + 1, newCols: state.gridCols },
          });
          dispatch({ type: 'MOVE_CURSOR', payload: { row: destRowIdx, col } });
        }
      }
    }

    const { row, col } = state.selected;
    console.log('row, col: ', row, col);
    const currentLetter = state.grid[row][col].letter;

    // ALready has a letter in this spot
    if (currentLetter) {
      dispatch({ type: 'RETURN_TILE', payload: currentLetter });
      advanceCursorExpandGrid(); // TODO: debug this not working
    }

    dispatch({ type: 'USE_TILE', payload: letter });
    dispatch({ type: 'SET_LETTER', payload: { row, col, letter } });
    advanceCursorExpandGrid();
  };

  const handleBackspace = () => {
    const { row, col } = state.selected;
    const currentLetter = state.grid[row][col].letter;

    if (currentLetter) {
      dispatch({ type: 'RETURN_TILE', payload: currentLetter });
      dispatch({ type: 'CLEAR_LETTER', payload: { row, col } });
    }
    if (state.direction === 'across' && col > 0) {
      dispatch({ type: 'MOVE_CURSOR', payload: { row, col: col - 1 } });
    } else if (state.direction === 'down' && row > 0) {
      dispatch({ type: 'MOVE_CURSOR', payload: { row: row - 1, col } });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (state.gamePhase === 'start') {
      if (e.key === ' ') {
        e.preventDefault();
        dispatch({ type: 'START_GAME' });
      } else if (e.key.toUpperCase() === 'D') {
        e.preventDefault();
        dispatch({ type: 'START_DEMO' });
      }
      return;
    }

    if (state.demoCompleted) {
      if (e.key === ' ') {
        e.preventDefault();
        dispatch({ type: 'CONTINUE_TO_GAME' });
      }
      return;
    }

    if (state.isPaused) {
      if (e.key === ' ') {
        e.preventDefault();
        dispatch({ type: 'TOGGLE_PAUSE' });
      } else if (e.key.toUpperCase() === 'Q') {
        e.preventDefault();
        dispatch({ type: 'RESET_GAME' });
      } else if (e.key.toUpperCase() === 'D') {
        e.preventDefault();
        dispatch({ type: 'RESET_GAME' });
        dispatch({ type: 'START_DEMO' });
      }
      return;
    }

    if (state.isGameEnded && !state.demoCompleted) {
      if (e.key === ' ') {
        e.preventDefault();
        dispatch({ type: 'RESET_GAME' });
      }
      return;
    }

    if (e.ctrlKey || e.metaKey || e.altKey) return;

    // Demo mode controls
    if (state.isDemoMode && !state.isGameEnded) {
      if (e.key === 'Escape') {
        e.preventDefault();
        dispatch({ type: 'EXIT_DEMO' });
        return;
      } else if (e.key === 'B') {
        e.preventDefault();
        handleBananasClick();
        return;
      } else if (e.key === 'T') {
        e.preventDefault();
        if (state.peelMode) {
          dispatch({ type: 'CANCEL_PEEL' });
        } else {
          dispatch({ type: 'START_PEEL', payload: '' });
          dispatch({
            type: 'SHOW_TOAST',
            payload: {
              message: 'type [letter] to trade OR press [esc] to cancel',
              persistent: true,
            },
          });
        }
        return;
      }
    }

    // Game mode controls
    if (!state.isDemoMode && state.gameStarted && !state.isGameEnded) {
      if (e.key === 'Escape') {
        e.preventDefault();
        dispatch({ type: 'TOGGLE_PAUSE' });
        return;
      } else if (e.key === 'B') {
        e.preventDefault();
        handleBananasClick();
        return;
      } else if (e.key === 'T') {
        e.preventDefault();
        if (state.peelMode) {
          dispatch({ type: 'CANCEL_PEEL' });
        } else {
          dispatch({ type: 'START_PEEL', payload: '' });
          dispatch({
            type: 'SHOW_TOAST',
            payload: {
              message: 'type [letter] to trade OR press [esc] to cancel',
              persistent: true,
            },
          });
        }
        return;
      }
    }

    // Peel mode handling
    if (state.peelMode) {
      if (e.key === 'Escape') {
        e.preventDefault();
        dispatch({ type: 'CANCEL_PEEL' });
        return;
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault();
        const letter = e.key.toUpperCase();
        if (isLetterAvailable(letter)) {
          dispatch({ type: 'PEEL_TILE', payload: letter });
        }
        return;
      }
    }

    // Regular game controls
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      dispatch({ type: 'ARROW_MOVE', payload: 'up' });
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      dispatch({ type: 'ARROW_MOVE', payload: 'down' });
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      dispatch({ type: 'ARROW_MOVE', payload: 'left' });
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      dispatch({ type: 'ARROW_MOVE', payload: 'right' });
    } else if (e.key === ' ') {
      e.preventDefault();
      dispatch({ type: 'TOGGLE_DIRECTION' });
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      handleBackspace();
    } else if (e.key.length === 1 && /^[a-zA-Z]$/.test(e.key) && !state.peelMode) {
      e.preventDefault();
      const letter = e.key.toUpperCase();
      const { row, col } = state.selected;
      if (isLetterAvailable(letter) || state.grid[row][col].letter === letter) {
        handleLetterInput(letter);
      }
    }
  };

  const availableTilesCount = state.tiles.filter((tile) => !tile.isUsed).length;

  // Start screen
  if (state.gamePhase === 'start') {
    return (
      <div
        ref={containerRef}
        className='min-h-screen bg-yellow-25 flex items-center justify-center'
        tabIndex={0}
        onKeyDown={handleKeyDown}
        style={{ outline: 'none' }}>
        <div className='text-center bg-white rounded-lg p-12 border border-yellow-200 shadow-lg'>
          <h1 className='text-4xl font-bold text-yellow-800 mb-8'>Not Bananagrams</h1>
          <p className='text-yellow-700 mb-2'>[d]=demo mode</p>
          <p className='text-yellow-700 mb-4'>[space]=start today&apos;s game</p>
        </div>
      </div>
    );
  }

  // Demo completion screen
  if (state.demoCompleted && state.demoTime) {
    const minutes = Math.floor(state.demoTime / 60000);
    const seconds = Math.floor((state.demoTime % 60000) / 1000);
    return (
      <div
        ref={containerRef}
        className='min-h-screen bg-yellow-25 flex items-center justify-center'
        tabIndex={0}
        onKeyDown={handleKeyDown}
        style={{ outline: 'none' }}>
        <div className='bg-white rounded-lg p-8 text-center border border-yellow-200 shadow-lg'>
          <h2 className='text-3xl font-bold mb-4 text-yellow-800'>Yay!</h2>
          <p className='text-yellow-700 mb-4'>
            Demo mode solve time: {minutes}:{seconds.toString().padStart(2, '0')}
          </p>
          <p className='text-yellow-700 mb-2'>Ready to begin today&apos;s game?</p>
          <p className='text-yellow-600 text-sm'>[space]=continue</p>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-yellow-25 flex flex-col items-center p-4'>
      {state.showToast && (
        <CustomToast
          message={state.showToast}
          onClose={() => dispatch({ type: 'HIDE_TOAST' })}
          persistent={state.persistentToast}
        />
      )}

      {/* Pause Overlay */}
      {state.isPaused && (
        <div className='fixed inset-0 bg-yellow-25 flex items-center justify-center z-50'>
          <div className='text-center bg-white rounded-lg p-8 border border-yellow-200 shadow-lg'>
            <h2 className='text-2xl font-bold mb-4 text-yellow-800'>Paused</h2>
            <p className='text-yellow-700 mb-2'>[space]=resume game</p>
            <p className='text-yellow-700 mb-2'>[D]=demo mode</p>
            <p className='text-yellow-700'>[Q]=quit</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className='flex items-center justify-between w-full max-w-md mb-6'>
        <Timer
          startTime={state.gameStartTime}
          endTime={state.gameEndTime}
          isEnded={state.isGameEnded}
          isPaused={state.isPaused}
        />
        <div className='text-sm text-yellow-600'>{availableTilesCount} left</div>
      </div>

      {/* Demo mode indicator */}
      {state.isDemoMode && !state.isGameEnded && (
        <div className='text-sm text-yellow-700 mb-2 bg-yellow-100 px-3 py-1 rounded-full'>
          Demo Mode
        </div>
      )}

      {/* Grid Label */}
      <div className='text-xs text-yellow-500 mb-1 self-start ml-4'>grid</div>

      {/* Game Grid */}
      <div
        ref={gridRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className='outline-none mb-6'
        style={{ outline: 'none' }}>
        <div
          className='border border-black inline-block bg-white shadow-lg rounded-lg overflow-hidden'
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${state.gridCols}, 40px)`,
            gridTemplateRows: `repeat(${state.gridRows}, 40px)`,
          }}>
          {state.grid.map((rowData, rowIdx) =>
            rowData.map((cell, colIdx) => {
              const isSelected = state.selected.row === rowIdx && state.selected.col === colIdx;
              return (
                <Cell
                  key={`${rowIdx}-${colIdx}`}
                  letter={cell.letter}
                  isSelected={isSelected}
                  direction={state.direction}
                  onClick={() =>
                    dispatch({ type: 'SELECT_CELL', payload: { row: rowIdx, col: colIdx } })
                  }
                />
              );
            })
          )}
        </div>
      </div>

      {/* Tiles - Display each tile individually */}
      <div className='grid grid-cols-8 gap-2 mb-6 p-4 bg-yellow-100 rounded-lg'>
        {state.tiles.map((tile) => (
          <Tile key={tile.id} letter={tile.letter} isUsed={tile.isUsed} isNew={tile.isNew} />
        ))}
      </div>

      {/* Controls */}
      <div className='text-sm text-yellow-600 text-center max-w-md'>
        {(state.isDemoMode || (!state.isDemoMode && state.gameStarted)) && !state.isGameEnded ? (
          <div>
            <br />
            inputs are case-sensitive
            <br />
            lowercase=letters&emsp;•&emsp;UPPERCASE=shortcuts <hr />
            [esc]=pause/help/quit&emsp;•&emsp;[B]=bananas!&emsp;•&emsp;[T]=trade
            <br />
          </div>
        ) : (
          ''
        )}
      </div>

      {/* Victory/End Modal */}
      {state.isGameEnded && state.gameEndTime && !state.demoCompleted && (
        <div className='fixed inset-0 bg-yellow-900 bg-opacity-50 flex items-center justify-center z-50'>
          <div className='bg-white rounded-lg p-8 text-center border border-yellow-200 shadow-lg'>
            {state.gameWon ? (
              <>
                <h2 className='text-3xl font-bold mb-4 text-yellow-800'>Yay!</h2>
                <div className='mb-4'>
                  <span className='text-yellow-700'>Time: </span>
                  <Timer
                    startTime={state.gameStartTime}
                    endTime={state.gameEndTime}
                    isEnded={true}
                    isPaused={false}
                  />
                </div>
              </>
            ) : (
              <h2 className='text-2xl font-bold mb-4 text-yellow-800'>Nice try</h2> // this is never reached
            )}
            {/* <button
              onClick={() => dispatch({ type: 'RESET_GAME' })}
              className='mt-4 px-6 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700'>
              New Game
            </button> */}
            <p className='text-yellow-600 text-sm mt-4'>[space]=play again</p>
          </div>
        </div>
      )}
    </div>
  );
}
