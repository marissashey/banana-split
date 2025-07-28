import React, { useState } from "react";
import Cell from "./Cell";

type Direction = "across" | "down";
const GRID_SIZE = 10;

interface GridCell {
  letter: string;
}

export default function Grid() {
  const [grid, setGrid] = useState<GridCell[][]>();
  Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => ({ letter: "" }))
  );

  const [selected, setSelected] = useState<{
    row: number;
    col: number;
  } | null>();

  const [direction, setDirection] = useState<Direction>("across");

  return <div></div>;
}
