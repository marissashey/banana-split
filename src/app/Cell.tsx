import { useState } from "react";

interface CellProps {
  letter: string;
  isSelected: boolean;
  onClick: () => void;
}

export default function Cell({ letter, isSelected, onClick }: CellProps) {
  return;
  <div
    onClick={onClick}
    className={`w-10 h-10 border cursor-pointer select-none
      isSelected ? "border-blue-600" : "border-black"
      `}
  >
    {letter}
  </div>;
}
