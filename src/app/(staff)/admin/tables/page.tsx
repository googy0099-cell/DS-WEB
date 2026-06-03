"use client";

import { useEffect, useRef, useState } from "react";
import { QrCode, RefreshCw, Plus, Download, Trash2 } from "lucide-react";
import QRCode from "qrcode";

type Table = { id: number; number: number; slug: string | null };

export default function AdminTablesPage() {
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNumber, setNewNumber] = useState("");
  const [adding, setAdding] = useState(false);
  const [qrDataUrls, setQrDataUrls] = useState<Record<number, string>>({});
  const [baseUrl, setBaseUrl] = useState("");
  const regeneratingRef = useRef<Set<number>>(new Set());
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    setBaseUrl(window.location.origin);
    fetch("/api/tables").then((r) => r.json()).then((data: Table[]) => {
      setTables(data);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!baseUrl || tables.length === 0) return;
    tables.forEach((t) => {
      if (!t.slug || qrDataUrls[t.id]) return;
      const url = `${baseUrl}/table/${t.slug}`;
      QRCode.toDataURL(url, { width: 400, margin: 2, color: { dark: "#1a1f3c", light: "#fffdf4" } })
        .then((dataUrl) => setQrDataUrls((prev) => ({ ...prev, [t.id]: dataUrl })))
        .catch(() => {});
    });
  }, [tables, baseUrl, qrDataUrls]);

  async function addTable() {
    const num = parseInt(newNumber);
    if (!num || isNaN(num)) return;
    setAdding(true);
    const res = await fetch("/api/tables", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ number: num }),
    });
    if (res.ok) {
      const t: Table = await res.json();
      setTables((prev) => [...prev, t].sort((a, b) => a.number - b.number));
      setNewNumber("");
    } else {
      alert("ไม่สามารถเพิ่มโต๊ะได้ (หมายเลขซ้ำ?)");
    }
    setAdding(false);
  }

  async function regenerateSlug(tableId: number) {
    regeneratingRef.current.add(tableId);
    forceUpdate((n) => n + 1);
    const res = await fetch("/api/tables", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: tableId, regenerateSlug: true }),
    });
    if (res.ok) {
      const updated: Table = await res.json();
      setTables((prev) => prev.map((t) => t.id === tableId ? updated : t));
      setQrDataUrls((prev) => { const next = { ...prev }; delete next[tableId]; return next; });
    }
    regeneratingRef.current.delete(tableId);
    forceUpdate((n) => n + 1);
  }

  function downloadQr(tableNumber: number, dataUrl: string) {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `table-${tableNumber}-qr.png`;
    a.click();
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy flex items-center gap-2">
          <QrCode size={24} /> จัดการโต๊ะ & QR Code
        </h1>
        <p className="text-sm text-gray-400 mt-1">สแกน QR แต่ละโต๊ะเพื่อสั่งอาหาร — ลูกค้าต้องสแกนที่ร้านเท่านั้น</p>
      </div>

      {/* Add table */}
      <div className="bg-white rounded-2xl p-4 shadow-sm flex gap-3 items-end">
        <div className="flex-1">
          <p className="text-xs font-medium text-navy mb-1">หมายเลขโต๊ะใหม่</p>
          <input
            type="number"
            value={newNumber}
            onChange={(e) => setNewNumber(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTable()}
            placeholder="เช่น 5"
            className="w-full border border-sand rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange"
          />
        </div>
        <button
          onClick={addTable}
          disabled={adding || !newNumber}
          className="bg-orange text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 disabled:opacity-50"
        >
          <Plus size={16} /> เพิ่มโต๊ะ
        </button>
      </div>

      {/* Table list */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">กำลังโหลด...</div>
      ) : tables.length === 0 ? (
        <div className="text-center py-12 text-gray-400">ยังไม่มีโต๊ะ</div>
      ) : (
        <div className="space-y-4">
          {tables.map((table) => {
            const isRegenerating = regeneratingRef.current.has(table.id);
            const qrUrl = qrDataUrls[table.id];
            const tableUrl = table.slug ? `${baseUrl}/table/${table.slug}` : null;

            return (
              <div key={table.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-sand">
                  <div>
                    <p className="font-bold text-navy text-lg">โต๊ะ {table.number}</p>
                    <p className="text-xs text-gray-400 font-mono mt-0.5">{table.slug ?? "ยังไม่มี slug"}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => regenerateSlug(table.id)}
                      disabled={isRegenerating}
                      title="สร้าง QR Code ใหม่"
                      className="p-2 rounded-lg border border-sand hover:border-orange text-gray-400 hover:text-orange transition-colors disabled:opacity-50"
                    >
                      <RefreshCw size={16} className={isRegenerating ? "animate-spin" : ""} />
                    </button>
                    {qrUrl && (
                      <button
                        onClick={() => downloadQr(table.number, qrUrl)}
                        title="ดาวน์โหลด QR"
                        className="p-2 rounded-lg border border-sand hover:border-navy text-gray-400 hover:text-navy transition-colors"
                      >
                        <Download size={16} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 px-4 py-4">
                  {qrUrl ? (
                    <div className="shrink-0 bg-[#fffdf4] rounded-xl p-2 border border-sand">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={qrUrl} alt={`QR โต๊ะ ${table.number}`} className="w-28 h-28" />
                    </div>
                  ) : (
                    <div className="shrink-0 w-32 h-32 bg-sand/40 rounded-xl flex items-center justify-center text-gray-300">
                      <QrCode size={40} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <p className="text-xs text-gray-500 font-medium">URL สำหรับสั่งอาหาร</p>
                    <p className="text-xs text-navy break-all font-mono bg-sand/40 rounded-lg px-2.5 py-1.5">
                      {tableUrl ?? "—"}
                    </p>
                    <p className="text-[10px] text-gray-400">กด <RefreshCw size={10} className="inline" /> เพื่อสร้าง slug ใหม่ (QR เก่าจะใช้ไม่ได้)</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
