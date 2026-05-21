"use client";

interface Props {
  amount: number;
  className?: string;
}

export default function ThaiPrice({ amount, className }: Props) {
  return <span className={className}>฿{amount.toLocaleString("th-TH")}</span>;
}
