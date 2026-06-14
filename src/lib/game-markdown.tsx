import React from "react";

// Lightweight renderer for the game "วิธีเล่น / รายละเอียด" mini-markdown:
//   ## heading · ### subheading · **bold** · - list item
// Shared by the customer game detail page and the admin editor's live preview so
// the preview matches exactly what customers see.

export function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={i} className="font-semibold text-navy">{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>
  );
}

export function renderMarkdown(text: string) {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("## ")) {
      nodes.push(<h2 key={i} className="text-base font-bold text-navy mt-4 first:mt-0 border-b border-sand pb-1">{line.slice(3)}</h2>);
    } else if (line.startsWith("### ")) {
      nodes.push(<h3 key={i} className="text-sm font-semibold text-navy/80 mt-3">{line.slice(4)}</h3>);
    } else if (line.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith("- ")) { items.push(lines[i].slice(2)); i++; }
      nodes.push(
        <ul key={`ul-${i}`} className="space-y-1.5 mt-1.5">
          {items.map((item, idx) => (
            <li key={idx} className="flex gap-2 text-sm text-gray-700 leading-relaxed">
              <span className="text-orange shrink-0 mt-0.5">•</span>
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    } else if (line.trim() === "") {
      // paragraph break — skip
    } else {
      nodes.push(<p key={i} className="text-sm text-gray-700 leading-relaxed">{renderInline(line)}</p>);
    }
    i++;
  }
  return nodes;
}
