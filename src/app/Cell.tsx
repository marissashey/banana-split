import { useState } from "react";

interface CellProps {
  letter: string;
  isSelected: boolean;
  onClick: () => void;
}

export default function Cell({ letter, isSelected, onClick }: CellProps) {
  const cellClass = `
  w-10 h-10 border border-black text-xl font-bold cursor-pointer flex items-center justify-center
  ${isSelected ? "bg-blue-600" : "bg-white"}
  `.trim();

  return (
    <div onClick={onClick} className={cellClass}>
      {letter}
    </div>
  );
}
