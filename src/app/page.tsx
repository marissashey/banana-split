'use client';
import React, { useReducer, useEffect, useRef, useState } from 'react';

type Direction = 'across' | 'down';
const INITIAL_GRID_SIZE = 10;
const MAX_GRID_AREA = 400;

const generateDailyTiles = (random = false): string[] => {
  // Bananagrams-style distribution (exactly 16 tiles)
  const bananagramsDistribution = {
    A: 2,
    B: 1,
    C: 1,
    D: 1,
    E: 2,
    F: 0,
    G: 0,
    H: 1,
    I: 1,
    J: 0,
    K: 0,
    L: 1,
    M: 1,
    N: 1,
    O: 1,
    P: 0,
    Q: 0,
    R: 1,
    S: 1,
    T: 1,
    U: 1,
    V: 0,
    W: 0,
    X: 0,
    Y: 0,
    Z: 0,
  };

  const allLetters: string[] = [];
  Object.entries(bananagramsDistribution).forEach(([letter, count]) => {
    for (let i = 0; i < count; i++) {
      allLetters.push(letter);
    }
  });

  const now = new Date();
  const utcMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const randomOffset = random ? Math.floor(Math.random() * 1000000) : 0;

  const seededRandom = (seed: number) => {
    const raw = Math.sin(seed) * 10000;
    return raw - Math.floor(raw);
  };

  for (let i = allLetters.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom(utcMidnight + i + randomOffset) * (i + 1));
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
  // Use similar distribution for random tiles (favor common letters)
  const commonLetters = 'AAEEIOUTRNSLDHCMBG';
  return Array.from(
    { length: count },
    () => commonLetters[Math.floor(Math.random() * commonLetters.length)]
  );
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
        gamePhase: 'random',
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
      let expansionConfig: {
        newRows: number;
        newCols: number;
        rowOffset?: number;
        colOffset?: number;
      } = {
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

function generateShareableResult(
  grid: GridCell[][],
  rows: number,
  cols: number,
  startTime: number,
  endTime: number
): string {
  const date = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const elapsed = endTime - startTime;
  const minutes = Math.floor(elapsed / 60000);
  const seconds = Math.floor((elapsed % 60000) / 1000);
  const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  const words = extractWords(grid, rows, cols);

  // Find the bounding box of all letters
  let minRow = rows,
    maxRow = -1,
    minCol = cols,
    maxCol = -1;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (grid[row][col].letter) {
        minRow = Math.min(minRow, row);
        maxRow = Math.max(maxRow, row);
        minCol = Math.min(minCol, col);
        maxCol = Math.max(maxCol, col);
      }
    }
  }

  // Generate compact grid representation using Unicode box characters
  let gridStr = '';
  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      const letter = grid[row][col].letter;
      if (letter) {
        gridStr += letter;
      } else {
        gridStr += '□'; // Empty box character
      }
    }
    if (row < maxRow) gridStr += '\n';
  }

  return `Word Grid ${date}
⏱️ ${timeStr}
📝 ${words.length} words

${gridStr}

#WordGrid`;
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
    if (!persistent) {
      const timer = setTimeout(onClose, 2000);
      return () => clearTimeout(timer);
    }
  }, [onClose, persistent]);

  return (
    <div className='fixed top-4 left-1/2 transform -translate-x-1/2 bg-orange-500 text-gray-800 border border-gray-600 px-3 py-2 font-mono text-sm z-50 shadow-lg'>
      {message}
    </div>
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
    <div className='font-mono text-blue-600'>
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
        w-8 h-8 border cursor-pointer 
        flex items-center justify-center font-mono font-bold text-sm
        transition-colors duration-75 relative
        ${
          isSelected
            ? 'bg-blue-400 text-white border-blue-500'
            : letter
            ? 'bg-white hover:bg-gray-100 border-gray-400 text-gray-800'
            : 'bg-gray-200 hover:bg-gray-300 border-gray-400'
        }
      `}>
      <span className='select-none'>{letter}</span>
      {isSelected && (
        <div
          className={`absolute text-white text-xs font-bold ${
            direction === 'across' ? 'top-0 right-0.5' : 'bottom-0 left-0.5'
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
        <div className='absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full z-10'></div>
      )}
      <div
        className={`
        flex items-center justify-center w-7 h-7 font-mono font-bold text-sm border
        ${
          isUsed
            ? 'bg-gray-300 text-gray-500 line-through border-gray-400'
            : 'bg-white border-gray-400 text-gray-800 hover:bg-gray-100'
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
  const [copySuccess, setCopySuccess] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.focus();
    }
  }, [state.gamePhase, state.demoCompleted]);

  useEffect(() => {
    if (
      gridRef.current &&
      (state.gameStarted || state.gamePhase === 'game' || state.gamePhase === 'random')
    ) {
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

    function advanceCursorExpandGrid() {
      if (state.direction === 'across') {
        let destColIdx = col + 1;
        if (destColIdx >= state.gridCols) {
          dispatch({
            type: 'EXPAND_GRID',
            payload: { newRows: state.gridRows, newCols: state.gridCols + 1 },
          });
          dispatch({ type: 'MOVE_CURSOR', payload: { row, col: destColIdx } });
          return;
        }
        while (destColIdx < state.gridCols && state.grid[row][destColIdx].letter !== '') {
          destColIdx++;
        }
        if (destColIdx < state.gridCols) {
          dispatch({ type: 'MOVE_CURSOR', payload: { row, col: destColIdx } });
        } else {
          dispatch({
            type: 'EXPAND_GRID',
            payload: { newRows: state.gridRows, newCols: state.gridCols + 1 },
          });
          dispatch({ type: 'MOVE_CURSOR', payload: { row, col: destColIdx } });
        }
      } else if (state.direction === 'down') {
        let destRowIdx = row + 1;
        if (destRowIdx >= state.gridRows) {
          dispatch({
            type: 'EXPAND_GRID',
            payload: { newRows: state.gridRows + 1, newCols: state.gridCols },
          });
          dispatch({ type: 'MOVE_CURSOR', payload: { row: destRowIdx, col } });
          return;
        }
        while (destRowIdx < state.gridRows && state.grid[destRowIdx][col].letter !== '') {
          destRowIdx++;
        }
        if (destRowIdx < state.gridRows) {
          dispatch({ type: 'MOVE_CURSOR', payload: { row: destRowIdx, col } });
        } else {
          dispatch({
            type: 'EXPAND_GRID',
            payload: { newRows: state.gridRows + 1, newCols: state.gridCols },
          });
          dispatch({ type: 'MOVE_CURSOR', payload: { row: destRowIdx, col } });
        }
      }
    }

    const { row, col } = state.selected;
    const currentLetter = state.grid[row][col].letter;

    if (currentLetter) {
      dispatch({ type: 'RETURN_TILE', payload: currentLetter });
      advanceCursorExpandGrid();
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

  const handleCopyResult = async () => {
    if (state.gamePhase !== 'game' || !state.gameEndTime) return;

    const shareText = generateShareableResult(
      state.grid,
      state.gridRows,
      state.gridCols,
      state.gameStartTime,
      state.gameEndTime
    );

    try {
      await navigator.clipboard.writeText(shareText);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = shareText;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (state.gamePhase === 'start') {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        dispatch({ type: 'START_GAME' });
      } else if (e.key.toUpperCase() === 'T') {
        e.preventDefault();
        dispatch({ type: 'START_DEMO' });
      } else if (e.key.toUpperCase() === 'R') {
        e.preventDefault();
        dispatch({ type: 'START_RANDOM' });
      } else if (e.key.toUpperCase() === 'D') {
        e.preventDefault();
        dispatch({ type: 'START_GAME' });
      }
      return;
    }

    if (state.demoCompleted) {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        dispatch({ type: 'CONTINUE_TO_GAME' });
      }
      return;
    }

    if (state.isPaused) {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        dispatch({ type: 'TOGGLE_PAUSE' });
      } else if (e.key.toUpperCase() === 'Q') {
        e.preventDefault();
        dispatch({ type: 'RESET_GAME' });
      } else if (e.key.toUpperCase() === 'T') {
        e.preventDefault();
        dispatch({ type: 'RESET_GAME' });
        dispatch({ type: 'START_DEMO' });
      } else if (e.key.toUpperCase() === 'R') {
        e.preventDefault();
        dispatch({ type: 'RESET_GAME' });
        dispatch({ type: 'START_RANDOM' });
      } else if (e.key.toUpperCase() === 'D') {
        e.preventDefault();
        dispatch({ type: 'RESET_GAME' });
        dispatch({ type: 'START_GAME' });
      }
      return;
    }

    if (state.isGameEnded && !state.demoCompleted) {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        dispatch({ type: 'RESET_GAME' });
      }
      return;
    }

    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (state.isDemoMode && !state.isGameEnded) {
      if (e.key === 'Escape') {
        e.preventDefault();
        dispatch({ type: 'EXIT_DEMO' });
        return;
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleBananasClick();
        return;
      } else if (e.key === '`') {
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

    if (!state.isDemoMode && state.gameStarted && !state.isGameEnded) {
      if (e.key === 'Escape') {
        e.preventDefault();
        dispatch({ type: 'TOGGLE_PAUSE' });
        return;
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleBananasClick();
        return;
      } else if (e.key === '`') {
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
        className='min-h-screen bg-gray-100 flex items-center justify-center'
        tabIndex={0}
        onKeyDown={handleKeyDown}
        style={{ outline: 'none' }}>
        <div className='text-center bg-white border-2 border-gray-400 p-8 font-mono shadow-lg'>
          <h1 className='text-3xl font-bold text-gray-800 mb-6'>word grid</h1>
          <p className='text-blue-600 mb-2 text-sm'>[T] tutorial mode</p>
          <p className='text-blue-600 mb-2 text-sm'>[D] daily game</p>
          <p className='text-blue-600 mb-4 text-sm'>[R] random game</p>
          <p className='text-gray-500 text-xs'>[SPACE] also starts daily game</p>
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
        className='min-h-screen bg-gray-100 flex items-center justify-center'
        tabIndex={0}
        onKeyDown={handleKeyDown}
        style={{ outline: 'none' }}>
        <div className='bg-white border-2 border-gray-400 p-8 text-center font-mono shadow-lg'>
          <h2 className='text-2xl font-bold mb-4 text-gray-800'>tutorial complete!</h2>
          <p className='text-gray-600 mb-4 text-sm'>
            time: {minutes}:{seconds.toString().padStart(2, '0')}
          </p>
          <p className='text-gray-600 mb-2 text-sm'>ready for today&apos;s game?</p>
          <p className='text-blue-600 text-xs'>[SPACE] continue</p>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-gray-100 flex flex-col items-center p-4 font-mono'>
      {state.showToast && (
        <CustomToast
          message={state.showToast}
          onClose={() => dispatch({ type: 'HIDE_TOAST' })}
          persistent={state.persistentToast}
        />
      )}

      {/* Pause Overlay */}
      {state.isPaused && (
        <div className='fixed inset-0 bg-gray-100 flex items-center justify-center z-50'>
          <div className='text-center bg-white border-2 border-gray-400 p-8 font-mono shadow-lg'>
            <h2 className='text-xl font-bold mb-4 text-gray-800'>paused</h2>
            {state.gamePhase === 'demo' && (
              <>
                <p className='text-blue-600 mb-2 text-sm'>[SPACE] resume tutorial game</p>
                <p className='text-blue-600 mb-2 text-sm'>[D] daily game</p>
                <p className='text-blue-600 mb-2 text-sm'>[R] random game</p>
              </>
            )}
            {state.gamePhase === 'game' && (
              <>
                <p className='text-blue-600 mb-2 text-sm'>[SPACE] resume daily game</p>
                <p className='text-blue-600 mb-2 text-sm'>[T] tutorial mode</p>
                <p className='text-blue-600 mb-2 text-sm'>[R] random game</p>
              </>
            )}
            {state.gamePhase === 'random' && (
              <>
                <p className='text-blue-600 mb-2 text-sm'>[SPACE] resume random game</p>
                <p className='text-blue-600 mb-2 text-sm'>[T] tutorial mode</p>
                <p className='text-blue-600 mb-2 text-sm'>[D] daily game</p>
              </>
            )}
            <p className='text-blue-600 text-sm'>[Q] quit</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className='flex items-center justify-between w-full max-w-lg mb-4 bg-white border border-gray-400 px-4 py-2'>
        <Timer
          startTime={state.gameStartTime}
          endTime={state.gameEndTime}
          isEnded={state.isGameEnded}
          isPaused={state.isPaused}
        />
        <div className='text-xs text-orange-600'>{availableTilesCount} tiles</div>
      </div>

      {/* Demo mode indicator */}
      {state.isDemoMode && !state.isGameEnded && (
        <div className='text-xs text-blue-600 mb-2 bg-white border border-gray-400 px-3 py-1'>
          tutorial mode
        </div>
      )}

      {/* Game Grid */}
      <div
        ref={gridRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className='outline-none mb-4'
        style={{ outline: 'none' }}>
        <div
          className='border-2 border-gray-400 inline-block bg-white p-2'
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${state.gridCols}, 32px)`,
            gridTemplateRows: `repeat(${state.gridRows}, 32px)`,
            gap: '1px',
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

      {/* Tiles */}
      <div className='bg-white border border-gray-400 p-3 mb-4 max-w-lg'>
        <div className='text-xs text-blue-600 mb-2'>tiles</div>
        <div className='grid grid-cols-8 gap-1'>
          {state.tiles.map((tile) => (
            <Tile key={tile.id} letter={tile.letter} isUsed={tile.isUsed} isNew={tile.isNew} />
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className='text-xs text-gray-600 text-left max-w-lg bg-white border border-gray-400 p-3'>
        {state.gameStarted && !state.isGameEnded ? (
          <div>
            <div className='text-blue-600 mb-2'>how to play</div>
            <div className='mb-5'>
              [type] every tile to build a crossword
              <br />
              every word must connect and be valid
            </div>
            <div className='mb-1'>• [SPACE] change direction</div>
            <div className='mb-1'>• [arrow keys/mouse] move</div>

            <div className='mb-1'>• [`] trade tile, [ENTER] check words</div>
            <div className='border-t border-gray-300 pt-2 text-orange-600'>
              [ESC] pause • [ENTER] submit • [`] trade
            </div>
          </div>
        ) : (
          ''
        )}
      </div>

      {/* Victory/End Modal */}
      {state.isGameEnded && state.gameEndTime && !state.demoCompleted && (
        <div
          className='fixed inset-0 bg-gray-100 bg-opacity-90 flex items-center justify-center z-50'
          tabIndex={0}
          onKeyDown={handleKeyDown}
          ref={(el) => el?.focus()}>
          <div className='bg-white border-2 border-gray-400 p-8 text-center font-mono shadow-lg max-w-md'>
            {state.gameWon ? (
              <>
                <h2 className='text-2xl font-bold mb-4 text-gray-800'>victory!</h2>
                <div className='mb-4 text-gray-600'>
                  <span className='text-orange-600'>time: </span>
                  <Timer
                    startTime={state.gameStartTime}
                    endTime={state.gameEndTime}
                    isEnded={true}
                    isPaused={false}
                  />
                </div>

                {/* Daily game sharing */}
                {state.gamePhase === 'game' && (
                  <div className='mb-4'>
                    <div className='bg-gray-50 border border-gray-300 p-3 mb-3 text-xs text-left font-mono whitespace-pre-line'>
                      {generateShareableResult(
                        state.grid,
                        state.gridRows,
                        state.gridCols,
                        state.gameStartTime,
                        state.gameEndTime
                      )}
                    </div>
                    <button
                      onClick={handleCopyResult}
                      className='bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 text-sm border border-blue-600 font-mono'>
                      {copySuccess ? 'Copied!' : 'Copy Result'}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <h2 className='text-xl font-bold mb-4 text-orange-600'>nice try</h2>
            )}
            <p className='text-blue-600 text-xs'>[SPACE] return to menu</p>
          </div>
        </div>
      )}
    </div>
  );
}
