"use client";

import { useActionState, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import {
  saveChangeRequest,
  type FormState,
} from "@/modules/change-requests/actions";
import { Card } from "@/components/ui/card";
import { AssistedTextField } from "@/components/assisted-text-field";
import { AttachmentPicker } from "@/components/attachment-picker";
import { formatDateZurich } from "@/lib/date-time";

type Option = {
  id: string;
  label: string;
  isOther?: boolean;
  active?: boolean;
};
type Values = {
  applicantName: string;
  title: string;
  machineTypeIds: string[];
  articleNumber: string;
  articleDescription: string;
  reasonIds: string[];
  otherReasonText: string;
  description: string;
};
type Props = {
  machineTypes: { id: string; label: string; active: boolean }[];
  reasons: Option[];
  defaultApplicantName?: string;
  initial?: Values & {
    id: string;
    version: number;
    number: string;
    createdAt: string;
  };
};
const initialState: FormState = {};

export function ChangeRequestForm({ machineTypes, reasons, initial, defaultApplicantName = "" }: Props) {
  const [state, action, pending] = useActionState(
    saveChangeRequest,
    initialState,
  );
  const { register, control, setValue } = useForm<Values>({
    defaultValues: initial ?? {
      applicantName: defaultApplicantName,
      title: "",
      machineTypeIds: [],
      articleNumber: "",
      articleDescription: "",
      reasonIds: [],
      otherReasonText: "",
      description: "",
    },
  });
  const selected = useWatch({ control, name: "reasonIds" }) ?? [];
  const selectedMachineTypeIds = useWatch({ control, name: "machineTypeIds" }) ?? [];
  const articleNumber = useWatch({ control, name: "articleNumber" });
  const selectedMachines = machineTypes.filter((machine) => selectedMachineTypeIds.includes(machine.id));
  const writingContext = [
    selectedMachines.length ? `Maschinentypen: ${selectedMachines.map(({ label }) => label).join(", ")}` : "",
    articleNumber ? `Artikel-/Baugruppennummer: ${articleNumber}` : "",
  ]
    .filter(Boolean)
    .join("; ");
  const other = reasons.find((reason) => reason.isOther);
  const showOther = other && selected.includes(other.id);
  const error = (field: string) => state.errors?.[field]?.[0];
  const input =
    "mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100";
  return (
    <form action={action} className="space-y-5">
      {initial && (
        <>
          <input type="hidden" name="id" value={initial.id} />
          <input type="hidden" name="version" value={initial.version} />
        </>
      )}
      {state.message && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {state.message}
        </div>
      )}
      <Card className="p-4 sm:p-6">
        <h2 className="font-semibold text-slate-950">Allgemein</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          {initial && <ReadOnly label="Nummer" value={initial.number} />}
          <label>
            <span className="text-sm font-medium">Antragsteller *</span>
            <input {...register("applicantName")} placeholder="z. B. Marc Wyss" className={input} />
            <Error text={error("applicantName")} />
          </label>
          <ReadOnly
            label="Datum"
            value={
              initial?.createdAt ??
              formatDateZurich(new Date())
            }
          />
          <div className="md:col-span-2">
            <AssistedTextField
              name="title"
              label="Titel"
              defaultValue={initial?.title}
              required
              error={error("title")}
              maxLength={200}
              context={writingContext}
              placeholder="z. B. Riemenspanner hält Spannung nicht"
            />
          </div>
          <div>
            <span className="text-sm font-medium">Maschinentyp(en) *</span>
            <MachineTypeMultiSelect
              options={machineTypes}
              selectedIds={selectedMachineTypeIds}
              onChange={(machineTypeIds) => setValue("machineTypeIds", machineTypeIds, { shouldDirty: true })}
            />
            {selectedMachineTypeIds.map((id) => <input key={id} type="hidden" name="machineTypeIds" value={id} />)}
            <Error text={error("machineTypeIds")} />
          </div>
        </div>
      </Card>
      <Card className="p-4 sm:p-6">
        <h2 className="font-semibold">Artikel / Baugruppe</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <label>
            <span className="text-sm font-medium">
              Artikel-/Baugruppennummer *
            </span>
            <input {...register("articleNumber")} placeholder="z. B. CBX.220.259-C" className={input} />
            <Error text={error("articleNumber")} />
          </label>
          <label>
            <span className="text-sm font-medium">Artikel-/Baugruppenbezeichnung *</span>
            <input {...register("articleDescription")} required maxLength={300} placeholder="z. B. Halteplatte Riemenspanner" className={input} />
            <Error text={error("articleDescription")} />
          </label>
        </div>
      </Card>
      <Card className="p-4 sm:p-6">
        <h2 className="font-semibold">Änderungsgrund *</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {reasons.map((reason) => (
            <label
              key={reason.id}
              className={`flex gap-3 rounded-md border border-slate-200 p-3 text-sm ${reason.active === false ? "bg-slate-50 text-slate-500" : ""}`}
            >
              {reason.active === false ? (
                <>
                  <input
                    type="checkbox"
                    checked
                    disabled
                    className="mt-0.5 size-4"
                  />
                  <input type="hidden" name="reasonIds" value={reason.id} />
                </>
              ) : (
                <input
                  type="checkbox"
                  value={reason.id}
                  {...register("reasonIds")}
                  className="mt-0.5 size-4 accent-blue-700"
                />
              )}
              <span>
                {reason.label}
                {reason.active === false ? " (historischer Grund)" : ""}
              </span>
            </label>
          ))}
        </div>
        <Error text={error("reasonIds")} />
        {showOther && (
          <div className="mt-5">
            <AssistedTextField
              name="otherReasonText"
              label="Sonstiger Änderungsgrund"
              defaultValue={initial?.otherReasonText}
              required
              error={error("otherReasonText")}
              maxLength={500}
              placeholder="z. B. Anforderung aus einem Serviceeinsatz"
            />
          </div>
        )}
      </Card>
      <Card className="p-4 sm:p-6">
        <h2 className="font-semibold">Beschreibung</h2>
        <div className="mt-4">
          <AssistedTextField
            name="description"
            label="Beschreibung und Begründung der Änderung"
            defaultValue={initial?.description}
            required
            multiline
            rows={7}
            error={error("description")}
            maxLength={10000}
            context={writingContext}
            placeholder="z. B. Der Riemen verliert nach kurzer Laufzeit die erforderliche Spannung."
          />
        </div>
      </Card>
      <Card className="p-4 sm:p-6">
        <h2 className="font-semibold">Anhänge</h2>
        <p className="mb-4 mt-1 text-sm text-slate-500">
          PDF, PNG, JPG, DOCX oder XLSX; maximal 20 MB pro Datei.
        </p>
        <AttachmentPicker />
      </Card>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="submit"
          name="intent"
          value="draft"
          disabled={pending}
          className="min-h-11 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
        >
          Als Entwurf speichern
        </button>
        <button
          type="submit"
          name="intent"
          value="submit"
          disabled={pending}
          className="min-h-11 rounded-md bg-[#175f91] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#124d76] disabled:opacity-50"
        >
          Einreichen
        </button>
      </div>
    </form>
  );
}
function MachineTypeMultiSelect({ options, selectedIds, onChange }: { options: { id: string; label: string; active: boolean }[]; selectedIds: string[]; onChange: (ids: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = options.filter(({ id }) => selectedIds.includes(id));
  const visible = options.filter(({ label }) => label.toLocaleLowerCase("de-CH").includes(search.trim().toLocaleLowerCase("de-CH")));
  const toggle = (id: string) => onChange(selectedIds.includes(id) ? selectedIds.filter((value) => value !== id) : [...selectedIds, id]);
  return <div className="relative mt-1.5">
    <div className="flex min-h-11 flex-wrap gap-2 rounded-md border border-slate-300 bg-white p-2">
      {selected.map((machine) => <span key={machine.id} className="inline-flex min-h-8 items-center gap-1 rounded-full bg-blue-50 px-2.5 text-sm font-medium text-[#175f91]">{machine.label}{!machine.active && <span className="text-xs text-slate-500">historisch</span>}<button type="button" aria-label={`${machine.label} entfernen`} onClick={() => toggle(machine.id)} className="grid size-6 place-items-center rounded-full hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-[#175f91]"><X className="size-3.5" aria-hidden="true" /></button></span>)}
      <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)} className="inline-flex min-h-8 flex-1 items-center justify-between gap-2 rounded px-2 text-left text-sm text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#175f91]"><span>{selected.length ? "Maschine hinzufügen…" : "Maschine auswählen…"}</span><ChevronDown className="size-4 shrink-0" aria-hidden="true" /></button>
    </div>
    {open && <div role="dialog" aria-label="Maschinentypen auswählen" className="absolute z-30 mt-2 w-full min-w-0 rounded-lg border border-slate-200 bg-white p-3 shadow-xl">
      <input value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Maschinentyp suchen" placeholder="Maschinentyp suchen…" className="mb-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-blue-100" />
      <div className="max-h-64 overflow-y-auto">{visible.map((machine) => { const checked = selectedIds.includes(machine.id); const unavailable = !machine.active && !checked; return <button key={machine.id} type="button" disabled={unavailable} onClick={() => toggle(machine.id)} className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-left text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"><span className={`grid size-5 place-items-center rounded border ${checked ? "border-[#175f91] bg-[#175f91] text-white" : "border-slate-300"}`}>{checked && <Check className="size-3.5" aria-hidden="true" />}</span><span>{machine.label}{!machine.active ? " (historisch)" : ""}</span></button> })}{!visible.length && <p className="p-3 text-sm text-slate-500">Keine Maschinentypen gefunden.</p>}</div>
      <button type="button" onClick={() => setOpen(false)} className="mt-3 min-h-11 w-full rounded-md bg-[#175f91] px-4 text-sm font-semibold text-white">Auswahl übernehmen</button>
    </div>}
  </div>;
}
function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm font-medium">{label}</p>
      <p className="mt-1.5 rounded-md bg-slate-100 px-3 py-2.5 text-sm text-slate-700">
        {value}
      </p>
    </div>
  );
}
function Error({ text }: { text?: string }) {
  return text ? <p className="mt-1 text-sm text-red-700">{text}</p> : null;
}
