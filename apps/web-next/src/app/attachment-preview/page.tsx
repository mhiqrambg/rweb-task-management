'use client';

import { useEffect, useRef, useState } from 'react';
import { AttachmentDropzone } from '@/components/AttachmentDropzone';
import { AttachmentGallery, type AttachmentImage } from '@/components/AttachmentLightbox';

/** Static-export-compatible UI playground. NO backend request or persistent storage. */
export default function AttachmentPreviewPage() {
  const [images, setImages] = useState<AttachmentImage[]>([]);
  const [simulateError, setSimulateError] = useState(false);
  const urls = useRef(new Set<string>());
  useEffect(() => {
    const created = urls.current;
    return () => { for (const url of created) URL.revokeObjectURL(url); created.clear(); };
  }, []);

  async function simulateLocalUpload(file: File): Promise<void> {
    // This is an explicit local UI simulation, never an API upload.
    await new Promise<void>((resolve) => setTimeout(resolve, 350));
    if (simulateError) throw new Error('Simulasi gagal. Matikan mode error dan pilih Ulangi.');
    const url = URL.createObjectURL(file);
    urls.current.add(url);
    setImages((previous) => [...previous, { id: crypto.randomUUID(), name: file.name, url }]);
  }

  return (
    <main style={{ minHeight: '100vh', background: '#f3f6f8', padding: '32px 16px' }}>
      <div style={{ maxWidth: 910, margin: '0 auto' }}>
        <p className="eyebrow">FE-NEXT · SUPERTHREAD</p>
        <h1>Attachment Dropzone & Lightbox</h1>
        <p className="muted">Halaman pengujian antarmuka Next.js SSG. Gambar hanya disimpan sementara di memori browser; tidak diunggah ke server.</p>
        <label style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 10, margin: '20px 0' }}>
          <input type="checkbox" checked={simulateError} onChange={(event) => setSimulateError(event.target.checked)}
            style={{ width: 18, height: 18 }} /> Simulasikan kegagalan unggah
        </label>
        <AttachmentDropzone onUpload={simulateLocalUpload} />
        <AttachmentGallery images={images} />
        <p className="muted" style={{ marginTop: 18, fontSize: '.84rem' }}>
          Uji: drag-drop, pilih file, batas ukuran, file bukan gambar, unggah, gagal/ulangi, buka Lightbox, tombol panah, dan Escape.
          Halaman ini wajib dikeluarkan dari benchmark produksi final.
        </p>
      </div>
    </main>
  );
}
