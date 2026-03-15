'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { Camera, Upload, X, Sparkles, Loader2 } from 'lucide-react'
import { fileToBase64 } from '@/lib/utils'

interface ImageUploadProps {
  value: string | null
  base64Value: string | null
  onChange: (url: string | null, base64: string | null, mediaType: string | null) => void
  onAnalyze?: (base64: string, mediaType: string) => void
  analyzing?: boolean
}

export function ImageUpload({ value, base64Value, onChange, onAnalyze, analyzing }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(value ?? null)

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return
    const objectUrl = URL.createObjectURL(file)
    setPreview(objectUrl)
    const b64 = await fileToBase64(file)
    onChange(null, b64, file.type)
  }

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) await handleFile(file)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) await handleFile(file)
  }

  const handleRemove = () => {
    setPreview(null)
    onChange(null, null, null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="stack-3">
      {preview ? (
        <div className="upload-preview-wrap">
          <Image
            src={preview}
            alt="Vista previa"
            width={400}
            height={192}
            className="upload-preview-img"
          />
          <div className="upload-preview-actions">
            <button type="button" onClick={handleRemove} className="upload-btn-remove">
              <X style={{ width: 16, height: 16 }} />
              Quitar
            </button>
            {onAnalyze && base64Value && (
              <button
                type="button"
                onClick={() => onAnalyze(base64Value, 'image/jpeg')}
                disabled={analyzing}
                className="upload-btn-analyze"
              >
                {analyzing ? (
                  <Loader2 style={{ width: 16, height: 16, animation: 'spin 0.6s linear infinite' }} />
                ) : (
                  <Sparkles style={{ width: 16, height: 16 }} />
                )}
                {analyzing ? 'Analizando...' : 'Analizar con IA'}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div
          className="upload-zone"
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
        >
          <Camera style={{ width: 40, height: 40, color: 'var(--muted)' }} />
          <p className="upload-title">Agrega una foto</p>
          <p className="upload-hint">Toca para seleccionar o arrastra una imagen</p>
          <div className="upload-tags-row">
            <span className="upload-tag upload-tag-amber">
              <Upload style={{ width: 12, height: 12 }} />
              Subir foto
            </span>
            {onAnalyze && (
              <span className="upload-tag upload-tag-purple">
                <Sparkles style={{ width: 12, height: 12 }} />
                IA lista
              </span>
            )}
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  )
}
