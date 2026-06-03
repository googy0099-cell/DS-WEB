"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import HrNav from "@/components/hr/HrNav";
import { CHECKLIST_TEMPLATES } from "@/lib/hr-checklist-template";

type ChecklistItem = {
  id: number;
  label: string;
  done: boolean;
  photoUrl: string | null;
  requiresPhoto: boolean;
};

type Checklist = {
  id: number;
  type: "OPEN" | "CLOSE";
  items: ChecklistItem[];
};

export default function ChecklistPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [type, setType] = useState<"OPEN" | "CLOSE" | null>(null);
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [loading, setLoading] = useState(false);
  const [cameraItem, setCameraItem] = useState<ChecklistItem | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/api/auth/signin");
  }, [status, router]);

  useEffect(() => {
    if (!type) return;
    setLoading(true);
    fetch(`/api/hr/checklist?type=${type}`)
      .then((r) => r.json())
      .then(setChecklist)
      .finally(() => setLoading(false));
  }, [type]);

  useEffect(() => {
    if (!cameraItem) { stopCamera(); return; }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => setCameraItem(null));
  }, [cameraItem]);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function toggleItem(item: ChecklistItem) {
    if (!checklist) return;
    if (!item.done && item.requiresPhoto) {
      setCameraItem(item);
      return;
    }
    await patchItem(item.id, !item.done);
  }

  async function patchItem(itemId: number, done: boolean, photoBase64?: string) {
    if (!checklist) return;
    const res = await fetch(`/api/hr/checklist/${checklist.id}/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done, photoBase64 }),
    });
    const updated = await res.json();
    setChecklist((c) =>
      c ? { ...c, items: c.items.map((i) => (i.id === updated.id ? { ...i, ...updated, requiresPhoto: i.requiresPhoto } : i)) } : c
    );
  }

  async function capturePhoto() {
    if (!videoRef.current || !cameraItem) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0);
    const photoBase64 = canvas.toDataURL("image/jpeg", 0.75);
    stopCamera();
    await patchItem(cameraItem.id, true, photoBase64);
    setCameraItem(null);
  }

  const doneCount = checklist?.items.filter((i) => i.done).length ?? 0;
  const totalCount = checklist?.items.length ?? 0;
  const allDone = totalCount > 0 && doneCount === totalCount;

  if (status === "loading") return <div className="min-h-screen flex items-center justify-center text-[#f8f1e5]/40 text-sm">กำลังโหลด...</div>;

  return (
    <div className="min-h-screen pb-24 px-4 pt-6">
      <h1 className="text-lg font-bold mb-1">เช็คลิสต์ประจำวัน</h1>
      <p className="text-[#f8f1e5]/50 text-xs mb-5">
        {new Date().toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long" })}
      </p>

      {!type && (
        <div className="grid grid-cols-2 gap-4 mt-8">
          {(["OPEN", "CLOSE"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col items-center gap-3 active:scale-95 transition-transform"
            >
              <span className="text-4xl">{t === "OPEN" ? "🌅" : "🌙"}</span>
              <span className="font-semibold">{t === "OPEN" ? "เปิดร้าน" : "ปิดร้าน"}</span>
              <span className="text-[#f8f1e5]/40 text-xs">{CHECKLIST_TEMPLATES[t].length} รายการ</span>
            </button>
          ))}
        </div>
      )}

      {type && (
        <>
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => { setType(null); setChecklist(null); }} className="text-[#f8f1e5]/40 text-sm">
              ← กลับ
            </button>
            <span className="text-sm font-semibold">
              {type === "OPEN" ? "🌅 เปิดร้าน" : "🌙 ปิดร้าน"}
            </span>
            <span className="text-[#fb8500] text-sm font-bold">{doneCount}/{totalCount}</span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-1.5 bg-white/10 rounded-full mb-5">
            <div
              className="h-1.5 bg-[#fb8500] rounded-full transition-all"
              style={{ width: totalCount ? `${(doneCount / totalCount) * 100}%` : "0%" }}
            />
          </div>

          {loading ? (
            <div className="text-center text-[#f8f1e5]/40 text-sm py-10">กำลังโหลด...</div>
          ) : (
            <div className="flex flex-col gap-3">
              {checklist?.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => toggleItem(item)}
                  className={`flex items-center gap-3 p-4 rounded-2xl border transition-colors text-left ${
                    item.done
                      ? "bg-emerald-500/10 border-emerald-500/30"
                      : "bg-white/5 border-white/10"
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2 ${
                    item.done ? "bg-emerald-500 border-emerald-500" : "border-white/30"
                  }`}>
                    {item.done && <span className="text-white text-xs">✓</span>}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${item.done ? "line-through text-[#f8f1e5]/40" : ""}`}>
                      {item.label}
                    </p>
                    {item.requiresPhoto && !item.done && (
                      <p className="text-[#fb8500] text-xs mt-0.5">📷 ต้องถ่ายรูป</p>
                    )}
                  </div>
                  {item.done && item.photoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.photoUrl} alt="" className="w-10 h-10 rounded-lg object-cover" />
                  )}
                </button>
              ))}
            </div>
          )}

          {allDone && (
            <div className="mt-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-center">
              <p className="text-emerald-400 font-bold">เสร็จสมบูรณ์ ✓</p>
              <p className="text-[#f8f1e5]/50 text-xs mt-1">เช็คลิสต์ครบทุกรายการแล้ว</p>
            </div>
          )}
        </>
      )}

      {/* Camera overlay */}
      {cameraItem && (
        <div className="fixed inset-0 z-50 bg-[#182a47] flex flex-col items-center justify-center gap-5 px-6">
          <p className="text-sm text-[#f8f1e5]/60">ถ่ายรูป: {cameraItem.label}</p>
          <div className="relative w-full max-w-xs aspect-square rounded-3xl overflow-hidden bg-black">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          </div>
          <button
            onClick={capturePhoto}
            className="w-20 h-20 rounded-full bg-[#fb8500] flex items-center justify-center text-3xl shadow-lg active:scale-95 transition-transform"
          >
            📷
          </button>
          <button onClick={() => { setCameraItem(null); stopCamera(); }} className="text-[#f8f1e5]/40 text-sm">
            ยกเลิก
          </button>
        </div>
      )}

      <HrNav />
    </div>
  );
}
