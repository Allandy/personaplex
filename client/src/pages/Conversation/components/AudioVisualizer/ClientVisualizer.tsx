import { FC, RefObject, useCallback, useEffect, useRef, useState } from "react";
import { clamp } from "../../hooks/audioUtils";
import { type ThemeType } from "../../hooks/useSystemTheme";

type AudioVisualizerProps = {
  analyser: AnalyserNode | null;
  parent: RefObject<HTMLElement>;
  theme: ThemeType;
};

const MAX_INTENSITY = 255;

const COLORS = [
  "#dbeafe",
  "#bfdbfe",
  "#93c5fd",
  "#60a5fa",
  "#3b82f6",
  "#2563eb",
  "#1d4ed8",
  "#1e40af",
  "#1e3a8a",
  "#1d4ed8",
];

export const ClientVisualizer: FC<AudioVisualizerProps> = ({ analyser, parent, theme }) => {
  const [canvasWidth, setCanvasWidth] = useState(parent.current ? Math.min(parent.current.clientWidth, parent.current.clientHeight) : 0);
  const requestRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const drawBars = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      volume: number,
      height: number,
      width: number,
      gap: number,
    ) => {
      const barHeight = height / 10 - gap;
      for (let i = 1; i <= 10; i++) {
        const barY = y + height + gap + Math.min(1, width / 30) - (i * barHeight + i * gap);
        ctx.fillStyle = COLORS[i - 1];
        ctx.strokeStyle = theme === "dark" ? "#e2e8f0" : "#cbd5e1";
        ctx.lineWidth = Math.min(1, height / 100);
        if (i <= volume) {
          ctx.fillRect(x, barY, width, barHeight);
        }
        ctx.strokeRect(x, barY, width, barHeight);
      }
    },
    [theme],
  );

  const draw = useCallback((ctx: CanvasRenderingContext2D, audioData: Uint8Array, x: number, y: number, width: number, height: number) => {
    const stereoGap = Math.floor(width / 30);
    const barGap = Math.floor(height / 30);
    const padding = Math.floor(width / 30);
    const maxBarHeight = Math.floor(height - padding * 2);
    const maxBarWidth = Math.floor(
      width / 2.5 - stereoGap - padding * 2,
    );

    const centerX = x + width / 2;
    const averageIntensity = Math.sqrt(
      audioData.reduce((acc, curr) => acc + curr * curr, 0) / audioData.length,
    );
    const intensity = clamp(
      averageIntensity * 1.4,
      averageIntensity,
      MAX_INTENSITY,
    );
    const volume = Math.floor((intensity * 10) / MAX_INTENSITY);
    ctx.fillStyle = theme === "dark" ? "#0f172a" : "#f8fafc";
    ctx.fillRect(x, y, width, height);

    drawBars(
      ctx,
      centerX - maxBarWidth - stereoGap / 2,
      y,
      volume,
      maxBarHeight,
      maxBarWidth,
      barGap,
    );
    drawBars(
      ctx,
      centerX + stereoGap / 2,
      y,
      volume,
      maxBarHeight,
      maxBarWidth,
      barGap,
    );
  }, [drawBars, theme]);

  const visualizeData = useCallback(() => {
    const width = parent.current ? Math.min(parent.current.clientWidth, parent.current.clientHeight) : 0;
    if (width !== canvasWidth) {
      setCanvasWidth(width);
    }
    requestRef.current = window.requestAnimationFrame(() => visualizeData());
    if (!canvasRef.current) {
      return;
    }
    const audioData = new Uint8Array(140);
    analyser?.getByteFrequencyData(audioData);

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) {
      return;
    }
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    draw(ctx, audioData, 0, 0, width, width);
  }, [analyser, canvasWidth, draw, parent]);

  useEffect(() => {
    visualizeData();
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [visualizeData, analyser]);

  return (
    <canvas
      ref={canvasRef}
      className="max-h-full max-w-full"
      width={canvasWidth}
      height={canvasWidth}
    />
  );
};
