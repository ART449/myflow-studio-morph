import React, { useEffect, useMemo } from 'react';

export function VideoModal({ open, videoBlob, onClose, onEdit, onDownloadVideo, onDownloadWAV, onShare }) {
  const url = useMemo(() => {
    if (!open || !videoBlob) return '';
    return URL.createObjectURL(videoBlob);
  }, [open, videoBlob]);

  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  if (!open) return null;
  return (
    <div className="modal open" id="modalVid">
      <h2>🎬 Tu clip</h2>
      <video id="clipVid" playsInline controls src={url} />
      <div className="modalRow">
        <button onClick={onShare}>📲 Compartir</button>
        <button onClick={onDownloadVideo}>⬇ Guardar video</button>
      </div>
      <div className="modalRow">
        <button onClick={onDownloadWAV} style={{ flex: 1, background: 'var(--ylw)', color: 'var(--bg)', borderColor: 'var(--ylw)' }}>
          ⬇ Descargar WAV
        </button>
      </div>
      <div className="modalRow">
        <button onClick={onEdit} style={{ flex: 1 }}>🎛 Editar audio</button>
        <button onClick={onClose} style={{ flex: 1 }}>↺ Otra</button>
      </div>
    </div>
  );
}
