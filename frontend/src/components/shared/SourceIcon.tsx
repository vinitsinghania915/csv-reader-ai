import { Database, FileSpreadsheet, Table } from "lucide-react";
import clsx from "clsx";

export type SourceType = "csv" | "tsv" | "excel" | "google_sheets" | string;

const COLORS: Record<string, string> = {
  csv: "text-green-400",
  tsv: "text-emerald-400",
  excel: "text-emerald-500",
  google_sheets: "text-blue-400",
};

const LABEL: Record<string, string> = {
  csv: "CSV",
  tsv: "TSV",
  excel: "Excel",
  google_sheets: "Google Sheets",
};

interface Props {
  source: SourceType;
  size?: number;
  className?: string;
}

export default function SourceIcon({ source, size = 16, className }: Props) {
  const key = (source || "csv").toLowerCase();
  const color = COLORS[key] ?? "text-zinc-400";
  const Icon =
    key === "google_sheets" ? Table : key === "excel" ? FileSpreadsheet : Database;
  return (
    <Icon
      size={size}
      className={clsx(color, className)}
      aria-label={LABEL[key] ?? key}
    />
  );
}

export function sourceLabel(source: SourceType): string {
  return LABEL[(source || "").toLowerCase()] ?? source;
}
