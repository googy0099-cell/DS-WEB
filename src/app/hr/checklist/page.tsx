"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import HrNav from "@/components/hr/HrNav";

type ChecklistItem = {
  id: number;
  label: string;
  section: string | null;
  done: boolean;
  photoUrl: string | null;
  requiresPhoto: boolean;
  doneByStaff: { user: { firstName: string } } | null;
};

type Checklist = {
  id: number;
  type: "OPEN" | "CLOSE";
  items: ChecklistItem[];
};

type Section = { name: string | null; items: ChecklistItem[] };

function groupBySections(items: ChecklistItem[]): Section[] {
  const sections: Section[] = [];
  let current: Section | null = null;
  for (const item of items) {
    if (!current || current.name !== item.section) {
      current = { name: item.section, items: [] };
      sections.push(current);
    }
    current.items.push(item);
  }
  return sections;
}

export default function ChecklistPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [type, setType] = useState<"OPEN" | "CLOSE" | null>(null);
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [cameraItem, setCameraItem] = useState<ChecklistItem | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/api/auth/signin");
  }, [status, router]);

  useEffect(() => {
    if (!type) return;
    setLoading(true);
    setLoadError("");
    fetch(`/api/hr/checklist?type=${type}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) { setLoadError(data.error ?? "โหลดข้อมูลไม่สำเร็จ"); return; }
        setChecklist(data);
      })
      .catch(() => setLoadError("เกิดข้อผิดพลาด กรุณาลองใหม่"))
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
    if (!item.done && item.requiresPhoto) { setCameraItem(item); return; }
    await patchItem(item.id, !item.done);
  }

  async function patchItem(itemId: number, done: boolean, photoBase64?: string) {
    if (!checklist) return;
    setSavingId(itemId);
    const res = await fetch(`/api/hr/checklist/${checklist.id}/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done, photoBase64 }),
    });
    const updated = await res.json();
    setChecklist((c) =>
      c ? { ...c, items: c.items.map((i) => (i.id === updated.id ? { ...i, ...updated } : i)) } : c
    );
    setSavingId(null);
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
  const sections = checklist ? groupBySections(checklist.items) : [];

  if (status === "loading") return (
    <div className="min-h-screen flex items-center justify-center text-[#f8f1e5]/40 text-sm">กำลังโหลด...</div>
  );

  return (
    <div className="min-h-screen pb-24 px-4 pt-6">
      <h1 className="text-lg font-bold mb-1">เช็คลิสต์ประจำวัน</h1>
      <p className="text-[#f8f1e5]/50 text-xs mb-5">
        {new Date().toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      </p>

      {/* Type selector */}
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
            </button>
          ))}
        </div>
      )}

      {/* Checklist view */}
      {type && (
        <>
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => { setType(null); setChecklist(null); }} className="text-[#f8f1e5]/40 text-sm">
              ← กลับ
            </button>
            <span className="text-sm font-semibold">{type === "OPEN" ? "🌅 เปิดร้าน" : "🌙 ปิดร้าน"}</span>
            <span className="text-[#fb8500] text-sm font-bold">{doneCount}/{totalCount}</span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 bg-white/10 rounded-full mb-5">
            <div
              className={`h-2 rounded-full transition-all ${allDone ? "bg-emerald-500" : "bg-[#fb8500]"}`}
              style={{ width: totalCount ? `${(doneCount / totalCount) * 100}%` : "0%" }}
            />
          </div>

          {loading ? (
            <div className="text-center text-[#f8f1e5]/40 text-sm py-10">กำลังโหลด...</div>
          ) : loadError ? (
            <div className="text-center text-red-400 text-sm py-10 bg-red-500/10 rounded-2xl px-4">
              ❌ {loadError}
            </div>
          ) : (
            <div className="space-y-4">
              {sections.map((sec, si) => (
                <div key={si}>
                  {sec.name && (
                    <p className="text-xs font-bold text-[#fb8500]/80 uppercase tracking-wider mb-2 px-1">
                      {sec.name}
                    </p>
                  )}
                  <div className="flex flex-col gap-2">
                    {sec.items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => toggleItem(item)}
                        disabled={savingId === item.id}
                        className={`flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-colors ${
                          item.done
                            ? "bg-emerald-500/10 border-emerald-500/30"
                            : "bg-white/5 border-white/10 active:bg-white/10"
                        } ${savingId === item.id ? "opacity-50" : ""}`}
                      >
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2 ${
                          item.done ? "bg-emerald-500 border-emerald-500" : "border-white/30"
                        }`}>
                          {item.done && <span className="text-white text-xs font-bold">✓</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium leading-snug ${item.done ? "line-through text-[#f8f1e5]/40" : ""}`}>
                            {item.label}
                          </p>
                          {item.requiresPhoto && !item.done && (
                            <p className="text-[#fb8500] text-xs mt-0.5">📷 ต้องถ่ายรูป</p>
                          )}
                          {item.done && item.doneByStaff && (
                            <p className="text-[#f8f1e5]/30 text-xs mt-0.5">โดย {item.doneByStaff.user.firstName}</p>
                          )}
                        </div>
                        {item.done && item.photoUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.photoUrl} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {allDone && (
            <div className="mt-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-center">
              <p className="text-emerald-400 font-bold text-lg">เสร็จสมบูรณ์ ✓</p>
              <p className="text-[#f8f1e5]/50 text-xs mt-1">เช็คลิสต์ครบทุกรายการแล้ว</p>
              {type === "CLOSE" && (
                <p className="text-emerald-400/70 text-xs mt-2">สามารถเช็คเอาท์ได้แล้ว</p>
              )}
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
