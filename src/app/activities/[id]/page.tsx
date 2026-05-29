import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

type Block =
  | { type: "heading"; value: string }
  | { type: "text"; value: string }
  | { type: "image"; url: string; caption?: string; size?: "small" | "medium" | "full"; align?: "left" | "center" | "right" }
  | { type: "image-set"; images: { url: string; caption?: string }[] }
  | { type: "button"; url: string; label: string }
  | { type: "highlight"; value: string; color: "orange" | "green" | "blue" }
  | { type: "divider" };

function parseBlocks(content: string | null): Block[] | null {
  if (!content) return null;
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) return parsed as Block[];
  } catch {}
  return null;
}

const highlightColors = {
  orange: "bg-orange/10 border-orange/30 text-orange-900",
  green: "bg-green-50 border-green-200 text-green-900",
  blue: "bg-blue-50 border-blue-200 text-blue-900",
};

function RenderBlocks({ blocks }: { blocks: Block[] }) {
  return (
    <div className="space-y-5">
      {blocks.map((block, i) => {
        if (block.type === "heading") {
          return <h2 key={i} className="text-2xl font-bold text-navy leading-snug">{block.value}</h2>;
        }
        if (block.type === "text") {
          return <p key={i} className="text-gray-600 leading-relaxed whitespace-pre-line">{block.value}</p>;
        }
        if (block.type === "image") {
          const maxW = block.size === "small" ? "max-w-xs" : block.size === "medium" ? "max-w-md" : "max-w-full";
          const mx = block.align === "left" ? "mr-auto" : block.align === "right" ? "ml-auto" : "mx-auto";
          return (
            <figure key={i} className={`rounded-2xl overflow-hidden shadow-sm w-full ${maxW} ${mx}`}>
              <div className="relative w-full aspect-video">
                <Image src={block.url} alt={block.caption ?? ""} fill className="object-cover" />
              </div>
              {block.caption && (
                <figcaption className="text-center text-xs text-gray-400 py-2 bg-white">{block.caption}</figcaption>
              )}
            </figure>
          );
        }
        if (block.type === "image-set") {
          return (
            <div key={i} className="grid grid-cols-3 gap-2">
              {block.images.map((img, j) => (
                <figure key={j} className="rounded-xl overflow-hidden shadow-sm">
                  <div className="relative w-full aspect-square">
                    <Image src={img.url} alt={img.caption ?? ""} fill className="object-cover" />
                  </div>
                  {img.caption && (
                    <figcaption className="text-center text-[10px] text-gray-400 py-1 bg-white leading-tight">{img.caption}</figcaption>
                  )}
                </figure>
              ))}
            </div>
          );
        }
        if (block.type === "button") {
          return (
            <div key={i}>
              <a
                href={block.url}
                target={block.url.startsWith("http") ? "_blank" : "_self"}
                rel="noopener noreferrer"
                className="inline-block bg-orange text-white font-bold px-6 py-3 rounded-xl hover:bg-orange/90 transition-colors"
              >
                {block.label}
              </a>
            </div>
          );
        }
        if (block.type === "highlight") {
          return (
            <div key={i} className={`border-l-4 rounded-xl p-4 ${highlightColors[block.color ?? "orange"]}`}>
              <p className="text-sm leading-relaxed whitespace-pre-line">{block.value}</p>
            </div>
          );
        }
        if (block.type === "divider") {
          return <hr key={i} className="border-sand" />;
        }
        return null;
      })}
    </div>
  );
}

export default async function ActivityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const act = await db.activity.findUnique({
    where: { id: Number(id), isActive: true },
  });
  if (!act) notFound();

  const blocks = parseBlocks(act.content);

  return (
    <>
      <Navbar />
      <div className="pt-16 min-h-screen bg-cream">
        {act.imageUrl ? (
          <div className="w-full bg-sand flex justify-center overflow-hidden">
            <Image
              src={act.imageUrl}
              alt={act.title}
              width={1200}
              height={600}
              className="w-full max-h-48 object-contain"
            />
          </div>
        ) : (
          <div className="w-full h-32 bg-navy flex items-center justify-center">
            <span className="text-6xl">{act.emoji}</span>
          </div>
        )}

        <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">
          <Link href="/activities" className="text-sm text-navy/50 hover:text-navy flex items-center gap-1">
            ← กิจกรรมทั้งหมด
          </Link>

          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-xs bg-orange/10 text-orange px-2.5 py-1 rounded-full font-semibold">
                {act.tag}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-navy leading-tight">
              {act.emoji} {act.title}
            </h1>
            <p className="text-orange font-semibold text-sm mt-2">{act.date}</p>
          </div>

          {act.desc && (
            <p className="text-gray-600 text-base leading-relaxed border-l-4 border-orange/30 pl-4">
              {act.desc}
            </p>
          )}

          {/* Blocks or plain text */}
          {blocks ? (
            <RenderBlocks blocks={blocks} />
          ) : act.content ? (
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">{act.content}</p>
            </div>
          ) : null}

          {/* Legacy link button (for old activities without blocks) */}
          {!blocks && act.link && (
            <a
              href={act.link}
              target={act.link.startsWith("http") ? "_blank" : "_self"}
              rel="noopener noreferrer"
              className="inline-block bg-orange text-white font-bold px-6 py-3 rounded-xl hover:bg-orange/90 transition-colors"
            >
              {act.linkLabel || "ดูรายละเอียดเพิ่มเติม →"}
            </a>
          )}

          <Link href="/activities" className="inline-block text-navy/50 text-sm hover:text-navy">
            ← ดูกิจกรรมทั้งหมด
          </Link>
        </div>

        <Footer />
      </div>
    </>
  );
}
