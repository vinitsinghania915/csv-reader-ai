"use client";

import { useCallback, useState } from "react";
import { useDropzone, FileRejection } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import { CloudUpload, FileSpreadsheet, AlertCircle } from "lucide-react";
import clsx from "clsx";

interface UploadZoneProps {
  onUpload: (files: File[]) => void;
  onConnectGoogleSheet?: () => void;
  maxSizeMB?: number;
}

export default function UploadZone({
  onUpload,
  onConnectGoogleSheet,
  maxSizeMB = 2048,
}: UploadZoneProps) {
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[], fileRejections: FileRejection[]) => {
    setError(null);
    if (fileRejections.length > 0) {
      const { errors } = fileRejections[0];
      if (errors[0].code === 'file-too-large') {
        setError(`File is too large. Max size is ${maxSizeMB}MB.`);
      } else {
        setError(errors[0].message);
      }
      return;
    }

    if (acceptedFiles.length > 0) {
      onUpload(acceptedFiles);
    }
  }, [maxSizeMB, onUpload]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'text/tab-separated-values': ['.tsv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxSize: maxSizeMB * 1024 * 1024,
    multiple: false,
  });

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-4">
      <div {...getRootProps()}>
        <motion.div
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          className={clsx(
            "relative overflow-hidden cursor-pointer w-full p-12 flex flex-col items-center justify-center gap-4 text-center transition-colors duration-300",
            "border-2 border-dashed rounded-2xl glass-card",
            isDragActive && !isDragReject ? "border-indigo-400 bg-indigo-500/5" : "border-zinc-700/80 hover:border-indigo-500/50",
            isDragReject && "border-red-500/50 bg-red-500/5"
          )}
        >
        <input {...getInputProps()} />
        
        <div className={clsx(
          "p-4 rounded-full transition-colors duration-300",
          isDragActive && !isDragReject ? "bg-indigo-500/20 text-indigo-400" : "bg-zinc-800/80 text-zinc-400",
          isDragReject && "bg-red-500/20 text-red-500"
        )}>
          <CloudUpload size={32} />
        </div>

        <div>
          <h3 className="text-xl font-medium text-zinc-100 mb-2">
            {isDragActive ? "Drop your data here" : "Click or drag to upload"}
          </h3>
          <p className="text-sm text-zinc-400 max-w-xs mx-auto mb-4">
            Supports CSV, TSV, and Excel files up to {maxSizeMB} MB
          </p>
          <button type="button" className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg text-sm font-medium transition shadow-lg shadow-indigo-500/20">
            Browse Files
          </button>
        </div>

        <div className="flex items-center gap-4 mt-4 opacity-60">
          <span className="flex items-center gap-1.5 text-xs text-green-400 bg-green-400/10 px-2 py-1 rounded-md">
            <span className="w-2 h-2 rounded-full bg-green-400" /> CSV
          </span>
          <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-md">
            <span className="w-2 h-2 rounded-full bg-emerald-400" /> Excel
          </span>
        </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm"
          >
            <AlertCircle size={18} />
            <p>{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-center gap-4 mt-2">
        <div className="h-px flex-1 bg-zinc-800" />
        <span className="text-xs text-zinc-500 uppercase tracking-widest font-semibold">Or connect</span>
        <div className="h-px flex-1 bg-zinc-800" />
      </div>

      <button
        type="button"
        onClick={onConnectGoogleSheet}
        disabled={!onConnectGoogleSheet}
        className="flex items-center justify-center gap-3 w-full py-3.5 px-4 rounded-xl border border-zinc-700 hover:border-zinc-600 bg-zinc-800/40 hover:bg-zinc-800 transition-colors text-zinc-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <FileSpreadsheet className="text-blue-400" size={20} />
        Connect Google Sheet
      </button>
    </div>
  );
}
