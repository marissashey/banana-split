'use client';
import React, { useReducer, useEffect, useRef } from 'react';

type Direction = 'across' | 'down';
const INITIAL_GRID_SIZE = 10;
const INITIAL_CELL_SIZE = 50;

interface GridCell {
  letter: string;
}

interface CellProps {
  letter: string;
  isSelected: boolean;
  direction: Direction;
  showCaret: boolean;
  cellSize: number;
  onClick: () => void;
}

interface GameState {
  grid: GridCell[][];
  gridRows: number;
  gridCols: number;
  selected: { row: number; col: number };
  direction: Direction;
  cellSize: number;
}

type GameAction =
  | { type: 'SET_CELL_SIZE'; payload: number }
  | { type: 'SELECT_CELL'; payload: { row: number; col: number } }
  | { type: 'TOGGLE_DIRECTION' }
  | { type: 'MOVE_CURSOR'; payload: { row: number; col: number } }
  | { type: 'SET_LETTER'; payload: { row: number; col: number; letter: string } }
  | { type: 'CLEAR_LETTER'; payload: { row: number; col: number } }
  | {
      type: 'EXPAND_GRID';
      payload: { newRows: number; newCols: number; rowOffset?: number; colOffset?: number };
    }
  | { type: 'ARROW_MOVE'; payload: 'up' | 'down' | 'left' | 'right' };

// todo: look into this and why adding one thing at a time angers TS
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
  cellSize: 50,
});

function gameReducer(state: GameState, action: GameAction): GameState {
  // TODO: fix wraparound when adding new column bug
  switch (action.type) {
    case 'SET_CELL_SIZE':
      return { ...state, cellSize: action.payload };
    case 'TOGGLE_DIRECTION':
      return { ...state, direction: state.direction === 'across' ? 'down' : 'across' };
    case 'MOVE_CURSOR':
      return { ...state, selected: action.payload };
    case 'SELECT_CELL':
      return { ...state, selected: action.payload };
    case 'SET_LETTER': {
      const { row, col, letter } = action.payload;

      const newGrid = state.grid.map((gridRow, rowIdx) =>
        gridRow.map((cell, colIdx) => (rowIdx === row && colIdx === col ? { letter } : { ...cell }))
      );
      return {
        ...state,
        grid: newGrid,
      };
    }
    case 'CLEAR_LETTER': {
      const { row, col } = action.payload;

      const newGrid = state.grid.map((gridRow, rowIdx) =>
        gridRow.map((cell, colIdx) =>
          rowIdx === row && colIdx === col ? { letter: '' } : { ...cell }
        )
      );
      return {
        ...state,
        grid: newGrid,
      };
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
          } else {
            return { letter: '' };
          }
        })
      );
      return {
        ...state,
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

      switch (action.payload) {
        case 'up':
          if (row > 0) newRow = row - 1;
          break;
        case 'down':
          if (row < state.gridRows - 1) newRow = row + 1;
          break;
        case 'left':
          if (col > 0) newCol = col - 1;
          break;
        case 'right':
          if (col < state.gridCols - 1) newCol = col + 1;
          break;
      }
      return { ...state, selected: { row: newRow, col: newCol } };
    }
    default:
      return state;
  }
}
function Cell({ letter, isSelected, direction, showCaret, cellSize, onClick }: CellProps) {
  const fontSize = Math.max(Math.floor(cellSize * 0.5), 16); // Minimum 16px, larger ratio
  const caretSize = Math.max(Math.floor(cellSize * 0.3), 12); // Minimum 12px

  // console.log('Cell debug:', { cellSize, fontSize, letter, isSelected });

  return (
    <div
      onClick={onClick}
      className={`
        relative border border-black cursor-pointer 
        flex items-center justify-center
        font-bold transition-colors duration-200
        ${
          isSelected
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'bg-white text-gray-900 hover:bg-gray-50'
        }
      `}
      style={{
        width: `${cellSize}px`,
        height: `${cellSize}px`,
        fontSize: `${fontSize}px`,
        lineHeight: '1',
        color: isSelected ? '#ffffff' : '#111827',
      }}>
      <span className='select-none' style={{ fontSize: `${fontSize}px` }}>
        {letter}
      </span>

      {/* Direction caret - fixed positioning and visibility */}
      {showCaret && isSelected && (
        <div
          className={`absolute font-bold pointer-events-none z-10 ${
            direction === 'across'
              ? 'right-1 top-1/2 -translate-y-1/2'
              : 'bottom-1 left-1/2 -translate-x-1/2'
          }`}
          style={{
            fontSize: `${caretSize}px`,
            color: '#ffffff',
            textShadow: '0 0 3px rgba(0,0,0,0.8)', // Stronger shadow
            filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.9))',
          }}>
          {direction === 'across' ? '›' : '⌄'}
        </div>
      )}
    </div>
  );
}

// Main Grid Component
export default function Grid() {
  const [state, dispatch] = useReducer(gameReducer, createInitialState());
  const gridRef = useRef<HTMLDivElement>(null);

  // Focus the grid on mount so typing works immediately
  useEffect(() => {
    if (gridRef.current) {
      gridRef.current.focus();
    }
  }, []);

  // Calculate responsive grid size - key fix for layering issue

  useEffect(() => {
    const calculateCellSize = () => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const availableSpace = Math.min(viewportWidth * 0.8, viewportHeight * 0.8);
      const maxDimension = Math.max(state.gridRows, state.gridCols);
      const calculatedSize = Math.floor(availableSpace / maxDimension);
      const finalSize = Math.min(Math.max(calculatedSize, 30), 60); // min 30px, max 60px

      dispatch({ type: 'SET_CELL_SIZE', payload: finalSize });
    };

    calculateCellSize();
    window.addEventListener('resize', calculateCellSize);
    return () => window.removeEventListener('resize', calculateCellSize);
  }, [state.gridRows, state.gridCols]);

  // const cellSize = INITIAL_CELL_SIZE; // TODO: REPLACE ?????

  const expandGrid = (
    newRows: number,
    newCols: number,
    rowOffset: number = 0,
    colOffset: number = 0
  ) => {
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
  };

  const handleSpacePress = () => {
    dispatch({ type: 'TOGGLE_DIRECTION' });
    const newDirection = state.direction === 'across' ? 'across' : 'down';
    const { row, col } = state.selected;

    // if not in last row/col, move cursor there
    if (newDirection === 'across' && col < state.gridCols - 1) {
      dispatch({ type: 'MOVE_CURSOR', payload: { row, col: col + 1 } });
    } else if (newDirection === 'down' && row < state.gridRows - 1) {
      dispatch({ type: 'MOVE_CURSOR', payload: { row: row + 1, col } });
    }
  };

  const handleBackspace = () => {
    const { row, col } = state.selected;
    dispatch({ type: 'CLEAR_LETTER', payload: { row, col } });

    if (state.direction === 'across') {
      if (col > 0) {
        dispatch({ type: 'MOVE_CURSOR', payload: { row, col: col - 1 } });
      } else if (row === 0 && col === 0) {
        // TODO: not sure why it's && ????????????
        dispatch({
          type: 'EXPAND_GRID',
          payload: { newRows: state.gridRows, newCols: state.gridCols + 1, colOffset: 1 },
        });
      }
    } else {
      if (row > 0) {
        dispatch({ type: 'MOVE_CURSOR', payload: { row: row - 1, col } });
      } else if (row === 0 && col === 0) {
        // TODO: not sure why it's && ????????????
        dispatch({
          type: 'EXPAND_GRID',
          payload: { newRows: state.gridRows + 1, newCols: state.gridCols, rowOffset: 1 },
        });
      }
    }
  };

  const handleLetterInput = (letter: string) => {
    const { row, col } = state.selected;
    dispatch({ type: 'SET_LETTER', payload: { row, col, letter } });

    if (state.direction === 'across') {
      if (col < state.gridCols - 1) {
        dispatch({ type: 'MOVE_CURSOR', payload: { row, col: col + 1 } });
      } else {
        // Expand right
        dispatch({
          type: 'EXPAND_GRID',
          payload: { newRows: state.gridRows, newCols: state.gridCols + 1 },
        });
        dispatch({ type: 'MOVE_CURSOR', payload: { row, col: col + 1 } });
      }
    } else {
      if (row < state.gridRows - 1) {
        dispatch({ type: 'MOVE_CURSOR', payload: { row: row + 1, col } });
      } else {
        // Expand down
        dispatch({
          type: 'EXPAND_GRID',
          payload: { newRows: state.gridRows + 1, newCols: state.gridCols },
        });
        dispatch({ type: 'MOVE_CURSOR', payload: { row: row + 1, col } });
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const { row, col } = state.selected;
    e.preventDefault();

    // Arrow key navigation // TODO: ADD EXPAND GRID IF NOT ENOUGH
    if (e.key === 'ArrowUp') dispatch({ type: 'ARROW_MOVE', payload: 'up' });
    else if (e.key === 'ArrowDown') dispatch({ type: 'ARROW_MOVE', payload: 'down' });
    else if (e.key === 'ArrowLeft') dispatch({ type: 'ARROW_MOVE', payload: 'left' });
    else if (e.key === 'ArrowRight') dispatch({ type: 'ARROW_MOVE', payload: 'right' });
    // Toggle direction on space AND move to next cell in new direction
    else if (e.key === ' ') handleSpacePress();
    // Backspace handling with expansion
    else if (e.key === 'Backspace') handleBackspace();
    // Letter input with expansion
    else if (e.key.length === 1 && /^[a-zA-Z]$/.test(e.key)) handleLetterInput(e.key.toUpperCase());
  };

  const handleCellClick = (row: number, col: number) => {
    dispatch({ type: 'SELECT_CELL', payload: { row, col } });
  };

  const gridWidth = state.cellSize * state.gridCols;
  const gridHeight = state.cellSize * state.gridRows;

  return (
    <div className='min-h-screen w-screen bg-pink-50 flex items-center justify-center p-4'>
      <div
        ref={gridRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className='outline-none flex flex-col items-center justify-center gap-4 w-full h-full'>
        <div
          className='border-2 border-black shadow-lg bg-white overflow-hidden'
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${state.gridCols}, ${state.cellSize}px)`,
            gridTemplateRows: `repeat(${state.gridRows}, ${state.cellSize}px)`,
            width: `${gridWidth}px`,
            height: `${gridHeight}px`,
          }}>
          {state.grid.map((rowData, rowIdx) =>
            rowData.map((cell, colIdx) => {
              const isSelected = state.selected.row === rowIdx && state.selected.col === colIdx;
              return (
                <Cell
                  letter={cell.letter}
                  key={`${rowIdx}-${colIdx}`}
                  isSelected={isSelected}
                  direction={state.direction}
                  showCaret={isSelected}
                  cellSize={state.cellSize}
                  onClick={() => handleCellClick(rowIdx, colIdx)}
                />
              );
            })
          )}
        </div>

        <div className='text-xl text-gray-700 mt-4'>
          Mode: <strong className='text-gray-900'>{state.direction}</strong>
        </div>

        <div className='text-sm text-gray-500 text-center max-w-md'>
          Use arrow keys to navigate • Space to toggle direction & move • Type letters to fill •
          Backspace to clear
        </div>

        <div className='text-xs text-gray-400'>
          Grid: {state.gridRows} × {state.gridCols} | Cell size: {state.cellSize}px
        </div>
      </div>
    </div>
  );
}
