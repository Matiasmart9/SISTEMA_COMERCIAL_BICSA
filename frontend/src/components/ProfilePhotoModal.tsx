import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Camera,
  Trash2,
  Upload,
  X,
  Check,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Move,
  Crop,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface ProfilePhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
  userName: string;
  currentAvatarUrl?: string | null;
  onSuccess: (newAvatarUrl: string | null) => void;
}

const VIEWPORT_SIZE = 280;
const CROP_RADIUS = 110; // Círculo de 220px de diámetro dentro de los 280px
const OUTPUT_SIZE = 256;

export default function ProfilePhotoModal({
  isOpen,
  onClose,
  userId,
  userName,
  currentAvatarUrl,
  onSuccess,
}: ProfilePhotoModalProps) {
  const { user: authUser, updateUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Estados
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentAvatarUrl || null);
  const [isRemoved, setIsRemoved] = useState<boolean>(false);
  const [hasNewFile, setHasNewFile] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  // Estados del Modo Recorte / Centrado
  const [isCropping, setIsCropping] = useState<boolean>(false);
  const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [rotation, setRotation] = useState<number>(0);

  // Referencias para drag del mouse / touch
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    if (isOpen) {
      setPreviewUrl(currentAvatarUrl || null);
      setIsRemoved(false);
      setHasNewFile(false);
      setIsCropping(false);
      setLoadedImage(null);
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setRotation(0);
      setSaving(false);
    }
  }, [isOpen, currentAvatarUrl]);

  const isSelf = !userId || (authUser && authUser.id === userId);

  const initials = userName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase() || 'U';

  // Manejo de carga de archivo
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor seleccione un archivo de imagen válido (JPG, PNG, WEBP)');
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => toast.error('Error al leer el archivo');
    reader.onload = (event) => {
      const img = new Image();
      img.onerror = () => toast.error('No se pudo decodificar la imagen');
      img.onload = () => {
        setLoadedImage(img);
        setZoom(1);
        setPan({ x: 0, y: 0 });
        setRotation(0);
        setIsCropping(true);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);

    // Reset input para permitir recargar el mismo archivo si se desea
    e.target.value = '';
  };

  // Dibuja la imagen interactiva en el canvas de recorte
  const drawCropper = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !loadedImage) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = VIEWPORT_SIZE;
    const H = VIEWPORT_SIZE;
    const cx = W / 2;
    const cy = H / 2;
    const R = CROP_RADIUS;

    ctx.clearRect(0, 0, W, H);

    // Escala base para cubrir el círculo
    const baseScale = Math.max((2 * R) / loadedImage.width, (2 * R) / loadedImage.height);
    const s = baseScale * zoom;

    // Dibujar imagen con transformación (pan, zoom, rotación)
    ctx.save();
    ctx.translate(cx + pan.x, cy + pan.y);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(s, s);
    ctx.drawImage(loadedImage, -loadedImage.width / 2, -loadedImage.height / 2);
    ctx.restore();

    // Dibujar máscara oscura con recorte circular transparente
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    // arc en sentido antihorario para restar el círculo del rectángulo
    ctx.arc(cx, cy, R, 0, Math.PI * 2, true);
    ctx.fill();

    // Anillo guía blanco de recorte
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Cruz sutil de centrado
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1;
    ctx.moveTo(cx - 10, cy);
    ctx.lineTo(cx + 10, cy);
    ctx.moveTo(cx, cy - 10);
    ctx.lineTo(cx, cy + 10);
    ctx.stroke();

    ctx.restore();
  }, [loadedImage, zoom, pan, rotation]);

  useEffect(() => {
    if (isCropping && loadedImage) {
      drawCropper();
    }
  }, [isCropping, loadedImage, drawCropper]);

  // Genera el dataURL cuadrado 256x256 exacto según el recorte
  const generateCroppedDataUrl = (): string | null => {
    if (!loadedImage) return null;

    const outCanvas = document.createElement('canvas');
    outCanvas.width = OUTPUT_SIZE;
    outCanvas.height = OUTPUT_SIZE;
    const outCtx = outCanvas.getContext('2d');
    if (!outCtx) return null;

    const outCx = OUTPUT_SIZE / 2;
    const outCy = OUTPUT_SIZE / 2;
    const ratio = OUTPUT_SIZE / (2 * CROP_RADIUS);

    const baseScale = Math.max(
      (2 * CROP_RADIUS) / loadedImage.width,
      (2 * CROP_RADIUS) / loadedImage.height
    );
    const s = baseScale * zoom;

    outCtx.save();
    outCtx.imageSmoothingEnabled = true;
    outCtx.imageSmoothingQuality = 'high';
    outCtx.translate(outCx + pan.x * ratio, outCy + pan.y * ratio);
    outCtx.rotate((rotation * Math.PI) / 180);
    outCtx.scale(s * ratio, s * ratio);
    outCtx.drawImage(loadedImage, -loadedImage.width / 2, -loadedImage.height / 2);
    outCtx.restore();

    return outCanvas.toDataURL('image/jpeg', 0.85);
  };

  // Confirmar recorte y volver a vista previa
  const handleApplyCrop = () => {
    const croppedUrl = generateCroppedDataUrl();
    if (croppedUrl) {
      setPreviewUrl(croppedUrl);
      setIsRemoved(false);
      setHasNewFile(true);
      setIsCropping(false);
    }
  };

  // Eventos de arrastre (Pointer / Mouse / Touch)
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    panStartRef.current = { ...pan };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPan({
      x: panStartRef.current.x + dx,
      y: panStartRef.current.y + dy,
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Ignorar si ya se liberó
      }
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((prev) => Math.min(3, Math.max(1, Number((prev + delta).toFixed(2)))));
  };

  const handleRemovePhoto = () => {
    setPreviewUrl(null);
    setIsRemoved(true);
    setHasNewFile(false);
    setIsCropping(false);
    setLoadedImage(null);
  };

  const handleSave = async () => {
    setSaving(true);
    let finalAvatar = previewUrl;

    // Si aún está en la pantalla de recorte y da guardar, aplicar recorte automáticamente
    if (isCropping && loadedImage) {
      finalAvatar = generateCroppedDataUrl();
    } else if (isRemoved) {
      finalAvatar = null;
    }

    try {
      if (isSelf) {
        const res = await api.put('/usuarios/perfil/avatar', { avatarUrl: finalAvatar });
        updateUser({ avatarUrl: res.data.avatarUrl });
        toast.success(finalAvatar ? 'Foto de perfil actualizada con éxito' : 'Foto de perfil eliminada');
        onSuccess(res.data.avatarUrl);
      } else {
        const res = await api.patch(`/usuarios/${userId}/avatar`, { avatarUrl: finalAvatar });
        toast.success(finalAvatar ? `Foto actualizada para ${userName}` : `Foto eliminada para ${userName}`);
        onSuccess(res.data.avatar_url ?? finalAvatar);
      }
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Error al guardar foto de perfil');
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = (isRemoved && currentAvatarUrl) || hasNewFile || isCropping;

  if (!isOpen) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999999,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#ffffff',
          borderRadius: 20,
          maxWidth: 440,
          width: '100%',
          padding: '24px 26px',
          boxShadow: '0 24px 48px -12px rgba(0, 0, 0, 0.28), 0 0 0 1px rgba(0, 0, 0, 0.05)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Cabecera del Modal */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: '#FFF0E6',
                color: '#EA4800',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isCropping ? <Crop size={20} /> : <Camera size={20} />}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 700, color: 'var(--ink)' }}>
                {isCropping
                  ? 'Ajustar y Centrar Foto'
                  : isSelf
                  ? 'Mi Foto de Perfil'
                  : `Foto de ${userName}`}
              </h3>
              <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--ink-muted)' }}>
                {isCropping
                  ? 'Arrastre para centrar el encuadre en el círculo'
                  : 'Personaliza la imagen visible en el sistema'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost"
            style={{ padding: 6, borderRadius: '50%' }}
            title="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {/* MODO 1: EDITOR DE RECORTE Y CENTRADO INTERACTIVO */}
        {isCropping && loadedImage ? (
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                background: '#0F172A',
                borderRadius: 'var(--radius-lg)',
                padding: '10px 0',
                marginBottom: 14,
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <canvas
                ref={canvasRef}
                width={VIEWPORT_SIZE}
                height={VIEWPORT_SIZE}
                style={{
                  cursor: isDraggingRef.current ? 'grabbing' : 'grab',
                  touchAction: 'none',
                  borderRadius: 'var(--radius-md)',
                }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onWheel={handleWheel}
              />
              <div
                style={{
                  position: 'absolute',
                  bottom: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  background: 'rgba(0, 0, 0, 0.65)',
                  color: '#fff',
                  padding: '3px 9px',
                  borderRadius: 14,
                  fontSize: '0.72rem',
                  pointerEvents: 'none',
                }}
              >
                <Move size={12} />
                <span>Arrastrar para encuadrar</span>
              </div>
            </div>

            {/* Controles de Zoom y Rotación */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <ZoomOut size={16} color="var(--ink-muted)" />
              <input
                type="range"
                min="1"
                max="3"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                style={{
                  flex: 1,
                  accentColor: 'var(--primary)',
                  cursor: 'pointer',
                }}
                title="Zoom"
              />
              <ZoomIn size={16} color="var(--ink-muted)" />

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setRotation((prev) => (prev + 90) % 360)}
                style={{ padding: '4px 8px', fontSize: '0.74rem', gap: 4 }}
                title="Girar imagen 90°"
              >
                <RotateCw size={13} />
                <span>Girar</span>
              </button>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setPan({ x: 0, y: 0 });
                  setZoom(1);
                  setRotation(0);
                }}
                style={{ padding: '4px 8px', fontSize: '0.74rem' }}
                title="Restablecer posición inicial"
              >
                Centrar
              </button>
            </div>

            {/* Acciones de Recorte */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', borderTop: '1px solid var(--line)', paddingTop: 14 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => fileInputRef.current?.click()}
                style={{ fontSize: '0.8rem' }}
              >
                <Upload size={14} />
                <span>Cambiar imagen</span>
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={handleApplyCrop}
                style={{ minWidth: 140, justifyContent: 'center' }}
              >
                <Check size={16} />
                <span>Aplicar encuadre</span>
              </button>
            </div>
          </div>
        ) : (
          /* MODO 2: VISTA PREVIA Y ACCIONES PRINCIPALES */
          <div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '22px 0 18px',
                background: '#F8FAFC',
                borderRadius: 'var(--radius-lg)',
                border: '1px dashed #CBD5E1',
                marginBottom: 18,
              }}
            >
              <div
                style={{
                  position: 'relative',
                  width: 106,
                  height: 106,
                  borderRadius: '50%',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
                  overflow: 'hidden',
                  background: '#EA4800',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '3.5px solid #ffffff',
                }}
              >
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt={userName}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <span style={{ fontSize: '2.1rem', fontWeight: 800, color: '#ffffff', letterSpacing: 1 }}>
                    {initials}
                  </span>
                )}
              </div>

              <div style={{ marginTop: 12, textAlign: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: '0.94rem', color: 'var(--ink)' }}>
                  {userName}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>
                  {previewUrl ? 'Foto activa recortada' : 'Mostrando iniciales predeterminadas'}
                </div>
              </div>
            </div>

            {/* Botones de acción */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => fileInputRef.current?.click()}
                style={{ flex: 1, minWidth: 150, justifyContent: 'center' }}
              >
                <Upload size={16} />
                <span>{previewUrl ? 'Cambiar imagen' : 'Subir imagen'}</span>
              </button>

              {previewUrl && (
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleRemovePhoto}
                  style={{ justifyContent: 'center' }}
                  title="Quitar foto y usar iniciales"
                >
                  <Trash2 size={16} />
                  <span>Eliminar</span>
                </button>
              )}
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={onClose}
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving || !hasChanges}
                style={{ minWidth: 130, justifyContent: 'center' }}
              >
                {saving ? (
                  <span>Guardando...</span>
                ) : (
                  <>
                    <Check size={16} />
                    <span>Guardar foto</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Input de archivo oculto */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/png, image/jpeg, image/jpg, image/webp"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>
    </div>,
    document.body
  );
}
