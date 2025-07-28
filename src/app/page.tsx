'use client';
import React, { useState } from 'react';
import Cell from './Cell';

type Direction = 'across' | 'down';
const GRID_SIZE = 10;

interface GridCell {
  letter: string;
}

export default function Grid() {
  const [grid, setGrid] = useState<GridCell[][]>(
    Array.from({ length: GRID_SIZE }, () =>
      Array.from({ length: GRID_SIZE }, () => ({ letter: '' }))
    )
  );

  const [selected, setSelected] = useState<{ row: number; col: number } | null>();

  const [direction, setDirection] = useState<Direction>('across');

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!selected) return;
    const { row, col } = selected;

    // toggle direction on [space]
    if (e.key === ' ') {
      e.preventDefault();
      setDirection((d) => (d === 'across' ? 'down' : 'across'));
      // TODO: if current box is at the end index of row/col AND letter is filled in, jump to next

      return;
    }

    if (e.key === 'Backspace') {
      setGrid((prev) => {
        const newGrid = prev.map((row) => [...row]);
        newGrid[row][col].letter = '';
        return newGrid;
      });
      return;
    }

    // update valid letter
    if (e.key.length === 1 && /^[a-zA-Z]$/.test(e.key)) {
      const letter = e.key.toUpperCase();

      setGrid((prev) => {
        const newGrid = [...prev.map((row) => [...row])]; // React tracks state using object references; make new object to trigger re-render
        newGrid[row][col].letter = letter;
        return newGrid;
      });

      if (direction === 'across' && col < GRID_SIZE - 1) {
        setSelected({ row, col: col + 1 });
      } else if (direction === 'down' && row < GRID_SIZE - 1) {
        setSelected({ row: row + 1, col });
      }
    }
  };

  const handleCellClick = (row: number, col: number) => {
    setSelected({ row, col });
  };

  return (
    <div
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className='outline-none bg-pink-50 flex flex-col items-center justify-center '>
      <div className={`grid grid-cols-${GRID_SIZE} `}>
        {grid.map((rowData, rowIdx) =>
          rowData.map((cell, colIdx) => {
            const isSelected = selected?.row === rowIdx && selected?.col === colIdx;
            console.log('rowIdx, colIdx: ', rowIdx, colIdx);
            return (
              <Cell
                letter={cell.letter}
                key={`${rowIdx}-${colIdx}`}
                isSelected={isSelected}
                onClick={() => handleCellClick(rowIdx, colIdx)}
              />
            );
          })
        )}
      </div>
      <div className=''>
        Mode: <strong>{direction}</strong>
      </div>
    </div>
  );
}
