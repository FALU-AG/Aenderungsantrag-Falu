"use client";

import { Eye, EyeOff } from "lucide-react";
import { useId, useState, type InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
  error?: string;
};

export function PasswordInput({ label, error, className = "", id, ...props }: Props) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(false);
  return <div>
    <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">{label}</label>
    <div className="relative mt-1">
      <input {...props} id={inputId} type={visible ? "text" : "password"} aria-invalid={Boolean(error)} aria-describedby={error ? `${inputId}-error` : undefined} className={`min-h-11 w-full rounded-md border border-slate-300 py-2 pl-3 pr-12 text-sm focus:border-[#175f91] focus:outline-none focus:ring-2 focus:ring-[#175f91]/25 ${className}`} />
      <button type="button" aria-label={visible ? "Passwort ausblenden" : "Passwort anzeigen"} onClick={() => setVisible((value) => !value)} className="absolute inset-y-0 right-0 grid min-h-11 min-w-11 place-items-center rounded-r-md text-slate-500 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#175f91]">
        {visible ? <EyeOff className="size-5" aria-hidden="true" /> : <Eye className="size-5" aria-hidden="true" />}
      </button>
    </div>
    {error && <p id={`${inputId}-error`} className="mt-1 text-sm text-red-700">{error}</p>}
  </div>;
}
