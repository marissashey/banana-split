import React from 'react';

interface CellProps {
  letter: string;
  isSelected: boolean;
  direction: 'across' | 'down';
  showCaret: boolean;
  onClick: () => void;
}

export default function Cell({ letter, isSelected, direction, showCaret, onClick }: CellProps) {
  return (
    <div
      onClick={onClick}
      className={`
        relative border border-black bg-white cursor-pointer 
        flex items-center justify-center
        font-bold text-gray-900 transition-colors duration-200
        hover:bg-gray-50
        ${isSelected ? 'bg-blue-600 text-white hover:bg-blue-700' : ''}
      `}
      style={{
        fontSize: 'min(2vw, 1.5rem)',
        aspectRatio: '1',
        minHeight: 0,
      }}>
      {letter}

      {/* Direction caret */}
      {showCaret && isSelected && (
        <div
          className={`absolute text-white font-bold ${
            direction === 'across'
              ? 'right-1 top-1/2 transform -translate-y-1/2'
              : 'bottom-1 left-1/2 transform -translate-x-1/2'
          }`}
          style={{ fontSize: 'min(1vw, 0.75rem)' }}>
          {direction === 'across' ? '›' : '⌄'}
        </div>
      )}

      <style jsx>{`
        @media (max-width: 768px) {
          div {
            font-size: min(3vw, 1.2rem) !important;
          }

          div .absolute {
            font-size: min(1.5vw, 0.6rem) !important;
          }
        }

        @media (max-height: 600px) {
          div {
            font-size: min(2.5vh, 1rem) !important;
          }

          div .absolute {
            font-size: min(1.25vh, 0.5rem) !important;
          }
        }
      `}</style>
    </div>
  );
}
