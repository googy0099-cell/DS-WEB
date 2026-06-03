"use client";

import { useEffect, useState, use } from "react";
import MenuPageContent from "@/components/orders/MenuPageContent";

type TableInfo = { id: number; number: number; slug: string } | null;

export default function TablePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [tableInfo, setTableInfo] = useState<TableInfo>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/tables/by-slug?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((t) => {
        if (!t) setNotFound(true);
        else setTableInfo(t);
        setLoading(false);
      })
      .catch(() => { setNotFound(true); setLoading(false); });
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="text-4xl animate-pulse">🎲</div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center p-8 text-center">
        <div className="text-6xl mb-4">🎲</div>
        <h1 className="text-xl font-bold text-navy mb-2">ไม่พบโต๊ะนี้</h1>
        <p className="text-gray-400 text-sm">QR Code อาจไม่ถูกต้อง กรุณาสแกนใหม่หรือแจ้งพนักงาน</p>
      </div>
    );
  }

  return (
    <MenuPageContent
      tableId={tableInfo?.id}
      tableNumber={tableInfo?.number}
      tableSlug={slug}
    />
  );
}
