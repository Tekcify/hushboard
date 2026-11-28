import type { CSSProperties, ReactNode } from "react";

export type CursorGridProps = {
  color?: string;
  gridColor?: string;
  cellSize?: number;
  highlight?: "area" | "cell";
  gridStyle?: "lines" | "dashed" | "dots" | "crosses";
  radius?: number;
  falloff?: "smooth" | "linear" | "sharp";
  holdTime?: number;
  fadeDuration?: number;
  lineWidth?: number;
  maxOpacity?: number;
  fillOpacity?: number;
  gridOpacity?: number;
  spotlight?: number;
  cellGap?: number;
  cellRadius?: number;
  clickPulse?: boolean;
  pulseSpeed?: number;
  ambient?: number;
  edgeFade?: number;
  intro?: boolean;
  lightMode?: boolean;
  children?: ReactNode;
  dpr?: number;
  className?: string;
  style?: CSSProperties;
};

declare const CursorGrid: (props: CursorGridProps) => React.JSX.Element;
export default CursorGrid;
