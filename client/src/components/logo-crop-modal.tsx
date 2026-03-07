import { useState, useRef, useEffect, useCallback } from "react";
import { X, ZoomIn, ZoomOut, Check } from "lucide-react";

interface Props {
  src: string | null;
  open: boolean;
  onSave: (croppedBase64: string) => void;
  onClose: () => void;
}

const CANVAS_SIZE = 320;
const CIRCLE_R = 130;
const OUTPUT_SIZE = 280;

export function LogoCropModal({ src, open, onSave, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [minZoom, setMinZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });

  const clampOffset = useCallback((ox: number, oy: number, z: number, img: HTMLImageElement) => {
    const w = img.naturalWidth * z;
    const h = img.naturalHeight * z;
    const maxX = Math.max(0, (w - CIRCLE_R * 2) / 2);
    const maxY = Math.max(0, (h - CIRCLE_R * 2) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, ox)),
      y: Math.min(maxY, Math.max(-maxY, oy)),
    };
  }, []);

  useEffect(() => {
    if (!src || !open) return;
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const scaleW = (CIRCLE_R * 2) / img.naturalWidth;
      const scaleH = (CIRCLE_R * 2) / img.naturalHeight;
      const mz = Math.max(scaleW, scaleH);
      setMinZoom(mz);
      setZoom(mz);
      setOffset({ x: 0, y: 0 });
    };
    img.src = src;
  }, [src, open]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cx = CANVAS_SIZE / 2;
    const cy = CANVAS_SIZE / 2;

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, CIRCLE_R, 0, Math.PI * 2);
    ctx.clip();

    const w = img.naturalWidth * zoom;
    const h = img.naturalHeight * zoom;
    ctx.drawImage(img, cx - w / 2 + offset.x, cy - h / 2 + offset.y, w, h);
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.arc(cx, cy, CIRCLE_R, 0, Math.PI * 2, true);
    ctx.fillStyle = "rgba(10,14,26,0.78)";
    ctx.fill();
    ctx.restore();

    ctx.beginPath();
    ctx.arc(cx, cy, CIRCLE_R, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }, [zoom, offset]);

  useEffect(() => { draw(); }, [draw]);

  const onMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !imgRef.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    const raw = { x: dragStart.current.ox + dx, y: dragStart.current.oy + dy };
    setOffset(clampOffset(raw.x, raw.y, zoom, imgRef.current));
  };

  const onMouseUp = () => setIsDragging(false);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!imgRef.current) return;
    const delta = e.deltaY < 0 ? 0.08 : -0.08;
    const newZ = Math.min(3, Math.max(minZoom, zoom + delta));
    setZoom(newZ);
    setOffset(clampOffset(offset.x, offset.y, newZ, imgRef.current));
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    setIsDragging(true);
    dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, ox: offset.x, oy: offset.y };
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || !imgRef.current || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - dragStart.current.x;
    const dy = e.touches[0].clientY - dragStart.current.y;
    const raw = { x: dragStart.current.ox + dx, y: dragStart.current.oy + dy };
    setOffset(clampOffset(raw.x, raw.y, zoom, imgRef.current));
  };

  const handleZoom = (delta: number) => {
    if (!imgRef.current) return;
    const newZ = Math.min(3, Math.max(minZoom, zoom + delta));
    setZoom(newZ);
    setOffset(clampOffset(offset.x, offset.y, newZ, imgRef.current));
  };

  const handleSave = () => {
    const img = imgRef.current;
    if (!img) return;

    const offscreen = document.createElement("canvas");
    offscreen.width = OUTPUT_SIZE;
    offscreen.height = OUTPUT_SIZE;
    const ctx = offscreen.getContext("2d");
    if (!ctx) return;

    const scale = OUTPUT_SIZE / (CIRCLE_R * 2);
    const cx = OUTPUT_SIZE / 2;
    const cy = OUTPUT_SIZE / 2;

    ctx.beginPath();
    ctx.arc(cx, cy, OUTPUT_SIZE / 2, 0, Math.PI * 2);
    ctx.clip();

    const w = img.naturalWidth * zoom * scale;
    const h = img.naturalHeight * zoom * scale;
    const ox = offset.x * scale;
    const oy = offset.y * scale;
    ctx.drawImage(img, cx - w / 2 + ox, cy - h / 2 + oy, w, h);

    const result = offscreen.toDataURL("image/jpeg", 0.88);
    onSave(result);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl p-6 flex flex-col gap-5"
        style={{ background: "hsl(222 47% 9%)", border: "1px solid rgba(255,255,255,0.1)" }}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm" style={{ color: "hsl(210 40% 98%)" }}>Ajustar logo</p>
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>Arraste para reposicionar · role para dar zoom</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            style={{ background: "rgba(255,255,255,0.06)" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex justify-center">
          <canvas
            ref={canvasRef}
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            className="rounded-2xl"
            style={{
              cursor: isDragging ? "grabbing" : "grab",
              width: CANVAS_SIZE,
              height: CANVAS_SIZE,
              background: "rgba(255,255,255,0.03)",
              touchAction: "none",
            }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onWheel={onWheel}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={() => setIsDragging(false)}
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => handleZoom(-0.12)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <input
            type="range"
            min={minZoom}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => {
              const z = parseFloat(e.target.value);
              setZoom(z);
              if (imgRef.current) setOffset(clampOffset(offset.x, offset.y, z, imgRef.current));
            }}
            className="flex-1 accent-blue-500"
            style={{ accentColor: "hsl(217 91% 60%)" }}
          />
          <button
            onClick={() => handleZoom(0.12)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all text-muted-foreground hover:text-foreground"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 text-white transition-all"
            style={{ background: "hsl(217 91% 60%)" }}
          >
            <Check className="w-4 h-4" />
            Salvar logo
          </button>
        </div>
      </div>
    </div>
  );
}
