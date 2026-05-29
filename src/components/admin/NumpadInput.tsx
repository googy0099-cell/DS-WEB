"use client";
import { useState } from "react";

type Props = {
  value: number | string;
  onChange: (val: number) => void;
  placeholder?: string;
  className?: string;
  allowDecimal?: boolean;
  label?: string;
};

export default function NumpadInput({
  value, onChange, placeholder = "0", className = "", allowDecimal = false, label,
}: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  function handleOpen() {
    setDraft(value !== 0 && value !== "" ? String(value) : "");
    setOpen(true);
  }

  function press(key: string) {
    if (key === "⌫") {
      setDraft((d) => d.slice(0, -1));
      return;
    }
    if (key === ".") {
      if (!allowDecimal || draft.includes(".")) return;
      setDraft((d) => (d === "" ? "0." : d + "."));
      return;
    }
    // Digit
    setDraft((d) => {
      if (d === "0") return key === "0" ? "0" : key;
      return d + key;
    });
  }

  function confirm() {
    onChange(parseFloat(draft) || 0);
    setOpen(false);
  }

  const display = value !== 0 && value !== "" ? String(value) : "";

  return (
    <>
      <input
        readOnly
        type="text"
        inputMode="none"
        value={display}
        placeholder={placeholder}
        onClick={handleOpen}
        className={`cursor-pointer ${className}`}
      />

      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-[200] flex items-end sm:items-center justify-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-xs p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {label && (
              <p className="text-xs font-semibold text-gray-400 mb-2 text-center">{label}</p>
            )}

            {/* Display */}
            <div className="bg-sand/30 rounded-2xl px-4 py-3 text-right mb-4 min-h-[60px] flex items-center justify-end">
              {draft ? (
                <span className="text-3xl font-bold text-navy font-mono tracking-wide">{draft}</span>
              ) : (
                <span className="text-xl text-gray-300">0</span>
              )}
            </div>

            {/* Numpad grid */}
            <div className="grid grid-cols-3 gap-2">
              {["7", "8", "9", "4", "5", "6", "1", "2", "3"].map((k) => (
                <button
                  key={k}
                  onClick={() => press(k)}
                  className="bg-sand/40 hover:bg-sand active:scale-95 text-navy font-bold text-xl py-4 rounded-2xl transition-all select-none"
                >
                  {k}
                </button>
              ))}
              {allowDecimal ? (
                <button
                  onClick={() => press(".")}
                  className="bg-sand/40 hover:bg-sand active:scale-95 text-navy font-bold text-xl py-4 rounded-2xl transition-all select-none"
                >
                  .
                </button>
              ) : (
                <button
                  onClick={() => setDraft("")}
                  className="bg-sand/20 hover:bg-sand/40 active:scale-95 text-gray-400 text-sm py-4 rounded-2xl transition-all select-none"
                >
                  ล้าง
                </button>
              )}
              <button
                onClick={() => press("0")}
                className="bg-sand/40 hover:bg-sand active:scale-95 text-navy font-bold text-xl py-4 rounded-2xl transition-all select-none"
              >
                0
              </button>
              <button
                onClick={() => press("⌫")}
                className="bg-sand/40 hover:bg-sand active:scale-95 text-navy font-bold text-xl py-4 rounded-2xl transition-all select-none"
              >
                ⌫
              </button>
            </div>

            <button
              onClick={confirm}
              className="w-full bg-orange text-white font-bold py-4 rounded-2xl text-base mt-3 active:scale-95 transition-transform select-none"
            >
              ✓ ยืนยัน
            </button>
          </div>
        </div>
      )}
    </>
  );
}
