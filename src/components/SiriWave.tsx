import React, { useEffect, useRef } from "react";

interface SiriWaveProps {
  isActive: boolean;
  isConnecting?: boolean;
}

export const SiriWave: React.FC<SiriWaveProps> = ({ isActive, isConnecting = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let phase = 0;

    const resizeCanvas = () => {
      if (canvas && canvas.parentElement) {
        canvas.width = canvas.parentElement.clientWidth || window.innerWidth;
      }
      canvas.height = 100; // Height of the animation area
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Wave parameters: [color, amplitudeMultiplier, frequencyMultiplier, speed]
    const waves = [
      { color: "rgba(0, 122, 255, 0.75)", amp: 0.8, freq: 0.015, speed: 0.08 },  // iOS Blue
      { color: "rgba(168, 85, 247, 0.65)", amp: 0.6, freq: 0.02, speed: -0.06 },  // Violet
      { color: "rgba(236, 72, 153, 0.6)", amp: 0.5, freq: 0.025, speed: 0.09 },   // Pink
      { color: "rgba(6, 182, 212, 0.5)", amp: 0.4, freq: 0.012, speed: -0.04 }    // Cyan
    ];

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = "screen";

      const width = canvas.width;
      const height = canvas.height;
      const centerY = height / 2;

      phase += 0.02; // Base phase increment speed

      waves.forEach((w) => {
        ctx.beginPath();
        ctx.strokeStyle = w.color;
        ctx.lineWidth = 3;

        // Add subtle shadow glow
        ctx.shadowColor = w.color;
        ctx.shadowBlur = 12;

        for (let x = 0; x < width; x++) {
          // Attenuation envelope: taper at the edges
          const envelope = Math.sin((x / width) * Math.PI);
          
          // Determine scale of amplitude (quieter if connecting, pulsing if active)
          const scale = isConnecting ? 0.35 : isActive ? 1.0 : 0.05;
          
          // Generate complex wave
          const y =
            centerY +
            envelope *
              w.amp *
              28 * // Max height scale
              scale *
              Math.sin(x * w.freq + phase * w.speed * 8);

          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      });

      // Reset shadow for performance
      ctx.shadowBlur = 0;

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, [isActive, isConnecting]);

  return (
    <div className="w-full relative overflow-hidden bg-gradient-to-b from-[#F2F2F7] to-[#F2F2F7]/50 dark:from-[#1C1C1E] dark:to-transparent py-3 border-b border-black/5 dark:border-white/5 flex flex-col justify-center items-center">
      <canvas ref={canvasRef} className="block w-full h-[100px]" />
      <div className="absolute inset-x-0 bottom-2 text-center text-[12px] font-semibold tracking-tight text-gray-500 dark:text-gray-400 animate-pulse">
        {isConnecting ? "Connecting voice..." : "Voice session active — speak now"}
      </div>
    </div>
  );
};
