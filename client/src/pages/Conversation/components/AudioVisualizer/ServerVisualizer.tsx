import { FC, RefObject, useCallback, useEffect, useRef, useState } from "react";
import { useSocketContext } from "../../SocketContext";
import { type ThemeType } from "../../hooks/useSystemTheme";

type AudioVisualizerProps = {
  analyser: AnalyserNode | null;
  parent: RefObject<HTMLElement>;
  theme: ThemeType;
};

const drawRoundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) => {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
};

export const ServerVisualizer: FC<AudioVisualizerProps> = ({ analyser, parent, theme }) => {
  const [canvasWidth, setCanvasWidth] = useState(parent.current ? Math.min(parent.current.clientWidth, parent.current.clientHeight) : 0);
  const requestRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { socketStatus } = useSocketContext();

  const draw = useCallback((width: number, audioData: Uint8Array, ctx: CanvasRenderingContext2D) => {
    const padding = Math.max(8, Math.floor(width * 0.08));
    const drawWidth = width - padding * 2;
    const drawHeight = width - padding * 2;
    const centerY = width / 2;
    const barCount = 14;
    const gap = Math.max(3, Math.floor(drawWidth * 0.01));
    const barWidth = (drawWidth - gap * (barCount - 1)) / barCount;
    const minHeight = Math.max(10, Math.floor(drawHeight * 0.08));
    const maxHeight = Math.max(minHeight + 1, Math.floor(drawHeight * 0.72));

    ctx.clearRect(0, 0, width, width);
    ctx.fillStyle = theme === "dark" ? "#0f172a" : "#f8fafc";
    drawRoundedRect(ctx, padding / 2, padding / 2, width - padding, width - padding, Math.max(12, width * 0.06));
    ctx.fill();

    for (let i = 0; i < barCount; i++) {
      const dataIndex = Math.floor((i / barCount) * audioData.length);
      const value = audioData[dataIndex] / 255;
      const barHeight = minHeight + value * (maxHeight - minHeight);
      const x = padding + i * (barWidth + gap);
      const y = centerY - barHeight / 2;

      ctx.fillStyle = socketStatus === "connected" ? "#5b9e7a" : "#94a3b8";
      drawRoundedRect(ctx, x, y, barWidth, barHeight, Math.max(4, barWidth * 0.4));
      ctx.fill();
    }

    ctx.strokeStyle = theme === "dark" ? "#334155" : "#d1d5db";
    ctx.lineWidth = Math.max(1, width * 0.01);
    drawRoundedRect(ctx, padding / 2, padding / 2, width - padding, width - padding, Math.max(12, width * 0.06));
    ctx.stroke();
  }, [socketStatus, theme]);

  const visualizeData = useCallback(() => {
    const width = parent.current ? Math.min(parent.current.clientWidth, parent.current.clientHeight) : 0;
    if (width !== canvasWidth) {
      setCanvasWidth(width);
    }
    requestRef.current = window.requestAnimationFrame(() => visualizeData());
    if (!canvasRef.current) {
      return;
    }
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) {
      return;
    }
    const audioData = new Uint8Array(140);
    analyser?.getByteFrequencyData(audioData);
    draw(width, audioData, ctx);
  }, [analyser, canvasWidth, draw, parent]);

  useEffect(() => {
    if (!analyser) {
      return;
    }
    analyser.smoothingTimeConstant = 0.9;
    visualizeData();
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [visualizeData, analyser]);

  return (
    <canvas
      className="max-h-full max-w-full"
      ref={canvasRef}
      width={canvasWidth}
      height={canvasWidth}
    />
  );
};
