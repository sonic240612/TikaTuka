interface DiceFaceProps {
  value: number;
  size?: number;
  type?: 'normal' | 'shield';
  rolling?: boolean;
}

const DOT_POSITIONS: Record<number, number[]> = {
  1: [5],
  2: [3, 7],
  3: [3, 5, 7],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9],
};

export default function DiceFace({ value, size = 64, type = 'normal', rolling = false }: DiceFaceProps) {
  const dots = DOT_POSITIONS[value] || [];

  return (
    <div
      className={`dice-face ${type} ${rolling ? 'rolling' : ''}`}
      style={{ width: size, height: size }}
    >
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((pos) => (
        <div key={pos} className={`dice-dot ${dots.includes(pos) ? 'filled' : ''}`} />
      ))}
    </div>
  );
}
