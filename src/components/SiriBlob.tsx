import React, { useEffect, useRef } from "react";

interface SiriBlobProps {
  status: string;
  isSpeaking: boolean;
  isListening: boolean;
  isVoiceMode?: boolean;
}

/**
 * Decorative background Siri orb.
 * Always mounted — renders as a full-viewport, pointer-events-none
 * absolute layer so it NEVER consumes layout height.
 * Intensity/speed scale with voice state.
 */
export const SiriBlob: React.FC<SiriBlobProps> = ({ status, isSpeaking, isListening, isVoiceMode = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const micActive = isVoiceMode && status === "connected" && isListening;

  /* ── Mic setup ── */
  useEffect(() => {
    if (!micActive) {
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      audioContextRef.current?.close().catch(() => {});
      audioContextRef.current = null;
      analyserRef.current = null;
      dataArrayRef.current = null;
      return;
    }
    const initMic = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        const AC = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AC();
        audioContextRef.current = ctx;
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.78;
        src.connect(analyser);
        analyserRef.current = analyser;
        dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
      } catch { /* silent */ }
    };
    initMic();
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      audioContextRef.current?.close().catch(() => {});
    };
  }, [micActive]);

  /* ── Canvas render ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf: number;
    let time = 0;
    let smoothAmp = 0.04;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    const drawLayer = (
      cx: number, cy: number,
      radius: number, amp: number, offset: number,
      grad: CanvasGradient,
      freqData: Uint8Array | null
    ) => {
      ctx.save();
      ctx.fillStyle = grad;
      ctx.beginPath();
      const N = 100;
      for (let i = 0; i < N; i++) {
        const angle = (i / N) * Math.PI * 2;
        let w = Math.sin(angle * 3 + time * 1.1 + offset) * 0.4
              + Math.cos(angle * 5 - time * 1.7 + offset * 1.4) * 0.25
              + Math.sin(angle * 7 + time * 2.2 - offset * 1.8) * 0.15;
        if (freqData?.length) {
          const fi = Math.floor((i < N/2 ? i : N - i) * (freqData.length / (N / 2)));
          w += (freqData[fi % freqData.length] / 255) * 1.0;
        } else if (isSpeaking) {
          w += Math.sin(angle * 4 + time * 5) * Math.cos(angle * 2 - time * 2.8) * 0.18;
        }
        const r = radius + w * amp * 34;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    const render = () => {
      const W = canvas.width / (window.devicePixelRatio || 1);
      const H = canvas.height / (window.devicePixelRatio || 1);
      ctx.clearRect(0, 0, W, H);

      /* Position blob in lower-center of viewport */
      const cx = W * 0.5;
      const cy = H * 0.72;
      const BASE = Math.min(W, H) * 0.32; // responsive radius

      /* Target amplitude based on state */
      const isVoiceActive = isVoiceMode && (status === "connected" || status === "connecting");
      let targetAmp = isVoiceActive ? 0.08 : 0.035; // always subtle when text-only
      if (isVoiceMode && status === "connecting") targetAmp = 0.14;
      if (isVoiceMode && status === "connected") {
        if (isSpeaking) targetAmp = 0.42 + 0.28 * Math.sin(time * 3.8) * Math.cos(time * 1.9);
        else if (isListening) {
          if (dataArrayRef.current && analyserRef.current) {
            analyserRef.current.getByteFrequencyData(dataArrayRef.current);
            const avg = dataArrayRef.current.reduce((a, b) => a + b, 0) / dataArrayRef.current.length;
            targetAmp = Math.max(0.09, avg / 75);
          } else targetAmp = 0.22;
        }
      }

      smoothAmp += (targetAmp - smoothAmp) * 0.13;
      time += 0.03 + smoothAmp * 0.07;

      const aRot = time * 0.3;

      /* Global opacity — very subtle in text mode, vibrant in voice */
      const globalOpacity = isVoiceActive ? 0.82 : 0.38;
      ctx.globalAlpha = globalOpacity;
      ctx.globalCompositeOperation = "screen";

      /* Ambient glow */
      ctx.save();
      const ambient = ctx.createRadialGradient(cx, cy, 0, cx, cy, BASE * (2.4 + smoothAmp));
      ambient.addColorStop(0, "rgba(88,86,214,0.22)");
      ambient.addColorStop(0.4, "rgba(255,45,85,0.10)");
      ambient.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = ambient;
      ctx.beginPath();
      ctx.arc(cx, cy, BASE * (2.6 + smoothAmp), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      /* Layer 1 — Cyan */
      const gCyan = ctx.createLinearGradient(
        cx - BASE * Math.cos(aRot), cy - BASE * Math.sin(aRot),
        cx + BASE * Math.cos(aRot), cy + BASE * Math.sin(aRot)
      );
      gCyan.addColorStop(0, "rgba(0,122,255,0.75)");
      gCyan.addColorStop(0.5, "rgba(90,200,250,0.55)");
      gCyan.addColorStop(1, "rgba(52,199,89,0)");

      /* Layer 2 — Purple/Pink */
      const gPurple = ctx.createLinearGradient(
        cx - BASE * Math.sin(aRot), cy + BASE * Math.cos(aRot),
        cx + BASE * Math.sin(aRot), cy - BASE * Math.cos(aRot)
      );
      gPurple.addColorStop(0, "rgba(175,82,222,0.68)");
      gPurple.addColorStop(0.5, "rgba(255,45,85,0.48)");
      gPurple.addColorStop(1, "rgba(255,204,0,0)");

      /* Layer 3 — Amber */
      const gAmber = ctx.createLinearGradient(
        cx - BASE * Math.cos(aRot + 0.8), cy - BASE * Math.sin(aRot + 0.8),
        cx + BASE * Math.cos(aRot + 0.8), cy + BASE * Math.sin(aRot + 0.8)
      );
      gAmber.addColorStop(0, "rgba(255,149,0,0.6)");
      gAmber.addColorStop(0.5, "rgba(255,204,0,0.42)");
      gAmber.addColorStop(1, "rgba(255,45,85,0)");

      /* Layer 4 — White core */
      const gCore = ctx.createRadialGradient(
        cx - 8 * Math.sin(time), cy - 8 * Math.cos(time), 0,
        cx, cy, BASE * (1.05 + smoothAmp)
      );
      gCore.addColorStop(0, "rgba(255,255,255,0.88)");
      gCore.addColorStop(0.3, "rgba(255,59,48,0.5)");
      gCore.addColorStop(0.8, "rgba(88,86,214,0.12)");
      gCore.addColorStop(1, "rgba(0,0,0,0)");

      drawLayer(cx, cy, BASE * 1.12, smoothAmp * 1.0, 0,   gCyan,   dataArrayRef.current);
      drawLayer(cx, cy, BASE * 0.98, smoothAmp * 1.1, 2.4, gPurple, dataArrayRef.current);
      drawLayer(cx, cy, BASE * 0.88, smoothAmp * 1.2, 1.1, gAmber,  dataArrayRef.current);
      drawLayer(cx, cy, BASE * 0.72, smoothAmp * 0.9, 4.8, gCore,   null);

      /* Glass dome overlay — drawn in normal mode */
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = globalOpacity * 0.55;

      /* Specular top highlight */
      const specGrad = ctx.createRadialGradient(
        cx - BASE * 0.22, cy - BASE * 0.32, 0,
        cx - BASE * 0.22, cy - BASE * 0.32, BASE * 0.7
      );
      specGrad.addColorStop(0, "rgba(255,255,255,0.28)");
      specGrad.addColorStop(0.6, "rgba(255,255,255,0.06)");
      specGrad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = specGrad;
      ctx.beginPath();
      ctx.ellipse(cx - BASE * 0.18, cy - BASE * 0.26, BASE * 0.62, BASE * 0.38, -0.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";

      raf = requestAnimationFrame(render);
    };

    render();
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(raf);
    };
  }, [status, isSpeaking, isListening]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none z-0"
      style={{ display: "block" }}
    />
  );
};
