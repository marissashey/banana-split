'use client';
import React, { useState, useEffect, useRef } from 'react';

type Direction = 'across' | 'down';
const INITIAL_GRID_SIZE = 10;

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

// Cell Component (inline)
function Cell({ letter, isSelected, direction, showCaret, cellSize, onClick }: CellProps) {
  // More robust font size calculation with debugging
  const fontSize = Math.max(Math.floor(cellSize * 0.5), 16); // Minimum 16px, larger ratio
  const caretSize = Math.max(Math.floor(cellSize * 0.3), 12); // Minimum 12px

  // Debug log to check values
  console.log('Cell debug:', { cellSize, fontSize, letter, isSelected });

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
        color: isSelected ? '#ffffff' : '#111827', // Explicit colors
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
  const [gridRows, setGridRows] = useState(INITIAL_GRID_SIZE);
  const [gridCols, setGridCols] = useState(INITIAL_GRID_SIZE);
  const [grid, setGrid] = useState<GridCell[][]>(() =>
    Array.from({ length: INITIAL_GRID_SIZE }, () =>
      Array.from({ length: INITIAL_GRID_SIZE }, () => ({ letter: '' }))
    )
  );

  const [selected, setSelected] = useState<{ row: number; col: number }>(() => ({
    row: Math.floor((INITIAL_GRID_SIZE - 1) / 2),
    col: Math.floor((INITIAL_GRID_SIZE - 1) / 2),
  }));
  const [direction, setDirection] = useState<Direction>('across');
  const gridRef = useRef<HTMLDivElement>(null);

  // Focus the grid on mount so typing works immediately
  useEffect(() => {
    if (gridRef.current) {
      gridRef.current.focus();
    }
  }, []);

  // Calculate responsive grid size - key fix for layering issue
  const [cellSize, setCellSize] = useState(50); // Default fallback

  useEffect(() => {
    const calculateCellSize = () => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const availableSpace = Math.min(viewportWidth * 0.8, viewportHeight * 0.8);
      const maxDimension = Math.max(gridRows, gridCols);
      const calculatedSize = Math.floor(availableSpace / maxDimension);
      const finalSize = Math.min(Math.max(calculatedSize, 30), 60); // min 30px, max 60px
      setCellSize(finalSize);
    };

    calculateCellSize();
    window.addEventListener('resize', calculateCellSize);
    return () => window.removeEventListener('resize', calculateCellSize);
  }, [gridRows, gridCols]);

  const gridWidth = cellSize * gridCols;
  const gridHeight = cellSize * gridRows;

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
          originalRow < gridRows &&
          originalCol >= 0 &&
          originalCol < gridCols
        ) {
          return { ...grid[originalRow][originalCol] };
        }
        return { letter: '' };
      })
    );

    setGrid(newGrid);
    setGridRows(newRows);
    setGridCols(newCols);

    // Update selected position if we added rows/cols at the beginning
    if (rowOffset > 0 || colOffset > 0) {
      setSelected((prev) => ({
        row: prev.row + rowOffset,
        col: prev.col + colOffset,
      }));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const { row, col } = selected;

    // Arrow key navigation
    if (e.key === 'ArrowUp' && row > 0) {
      e.preventDefault();
      setSelected({ row: row - 1, col });
      return;
    }
    if (e.key === 'ArrowDown' && row < gridRows - 1) {
      e.preventDefault();
      setSelected({ row: row + 1, col });
      return;
    }
    if (e.key === 'ArrowLeft' && col > 0) {
      e.preventDefault();
      setSelected({ row, col: col - 1 });
      return;
    }
    if (e.key === 'ArrowRight' && col < gridCols - 1) {
      e.preventDefault();
      setSelected({ row, col: col + 1 });
      return;
    }

    // Toggle direction on space AND move to next cell in new direction
    if (e.key === ' ') {
      e.preventDefault();
      const newDirection = direction === 'across' ? 'down' : 'across';
      setDirection(newDirection);

      // Move to next cell in the new direction
      if (newDirection === 'across' && col < gridCols - 1) {
        setSelected({ row, col: col + 1 });
      } else if (newDirection === 'down' && row < gridRows - 1) {
        setSelected({ row: row + 1, col });
      }
      return;
    }

    // Backspace handling with expansion
    if (e.key === 'Backspace') {
      e.preventDefault();

      // Clear current cell
      setGrid((prev) => {
        const newGrid = prev.map((row) => [...row]);
        newGrid[row][col].letter = '';
        return newGrid;
      });

      // Move to previous cell, expanding if necessary
      if (direction === 'across') {
        if (col > 0) {
          setSelected({ row, col: col - 1 });
        } else if (row === 0 && col === 0) {
          // Expand left (add column at beginning)
          expandGrid(gridRows, gridCols + 1, 0, 1);
        }
      } else {
        if (row > 0) {
          setSelected({ row: row - 1, col });
        } else if (row === 0 && col === 0) {
          // Expand up (add row at beginning)
          expandGrid(gridRows + 1, gridCols, 1, 0);
        }
      }
      return;
    }

    // Letter input with expansion
    if (e.key.length === 1 && /^[a-zA-Z]$/.test(e.key)) {
      e.preventDefault();
      const letter = e.key.toUpperCase();

      setGrid((prev) => {
        const newGrid = [...prev.map((row) => [...row])];
        newGrid[row][col].letter = letter;
        return newGrid;
      });

      // Move to next cell, expanding if necessary
      if (direction === 'across') {
        if (col < gridCols - 1) {
          setSelected({ row, col: col + 1 });
        } else {
          // Expand right (add column at end)
          expandGrid(gridRows, gridCols + 1);
          setSelected({ row, col: col + 1 });
        }
      } else {
        if (row < gridRows - 1) {
          setSelected({ row: row + 1, col });
        } else {
          // Expand down (add row at end)
          expandGrid(gridRows + 1, gridCols);
          setSelected({ row: row + 1, col });
        }
      }
    }
  };

  const handleCellClick = (row: number, col: number) => {
    setSelected({ row, col });
  };

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
            gridTemplateColumns: `repeat(${gridCols}, ${cellSize}px)`,
            gridTemplateRows: `repeat(${gridRows}, ${cellSize}px)`,
            width: `${gridWidth}px`,
            height: `${gridHeight}px`,
          }}>
          {grid.map((rowData, rowIdx) =>
            rowData.map((cell, colIdx) => {
              const isSelected = selected.row === rowIdx && selected.col === colIdx;
              return (
                <Cell
                  letter={cell.letter}
                  key={`${rowIdx}-${colIdx}`}
                  isSelected={isSelected}
                  direction={direction}
                  showCaret={isSelected}
                  cellSize={cellSize}
                  onClick={() => handleCellClick(rowIdx, colIdx)}
                />
              );
            })
          )}
        </div>

        <div className='text-xl text-gray-700 mt-4'>
          Mode: <strong className='text-gray-900'>{direction}</strong>
        </div>

        <div className='text-sm text-gray-500 text-center max-w-md'>
          Use arrow keys to navigate • Space to toggle direction & move • Type letters to fill •
          Backspace to clear
        </div>

        <div className='text-xs text-gray-400'>
          Grid: {gridRows} × {gridCols} | Cell size: {cellSize}px
        </div>
      </div>
    </div>
  );
}
