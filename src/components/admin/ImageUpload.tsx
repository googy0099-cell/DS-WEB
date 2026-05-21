"use client";

import { useState, useRef } from "react";
import Image from "next/image";

interface Props {
  value: string;
  onChange: (url: string) => void;
}

export default function ImageUpload({ value, onChange }: Props) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (data.url) onChange(data.url);
      else alert(data.error ?? "อัปโหลดไม่สำเร็จ");
    } catch {
      alert("เกิดข้อผิดพลาดในการอัปโหลด");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <div
        className="border-2 border-dashed border-sand rounded-xl p-4 text-center cursor-pointer hover:border-orange transition-colors"
        onClick={() => inputRef.current?.click()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
        onDragOver={(e) => e.preventDefault()}
      >
        {value ? (
          <div className="relative h-32 w-full">
            <Image src={value} alt="preview" fill className="object-contain rounded-lg" />
          </div>
        ) : (
          <div className="text-gray-400 py-4">
            <p className="text-2xl mb-1">📷</p>
            <p className="text-sm">{uploading ? "กำลังอัปโหลด..." : "คลิกหรือลากรูปมาวาง"}</p>
            <p className="text-xs">PNG, JPG, WEBP (max 5MB)</p>
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      {value && (
        <div className="flex gap-2">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="flex-1 text-xs border border-sand rounded-lg px-2 py-1"
            placeholder="URL รูป"
          />
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-red-400 text-xs px-2"
          >
            ลบ
          </button>
        </div>
      )}
    </div>
  );
}
