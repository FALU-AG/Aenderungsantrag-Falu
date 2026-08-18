"use client";

import { useActionState } from "react";
import { useForm, useWatch } from "react-hook-form";
import {
  saveChangeRequest,
  type FormState,
} from "@/modules/change-requests/actions";
import { Card } from "@/components/ui/card";
import { AssistedTextField } from "@/components/assisted-text-field";
import { AttachmentPicker } from "@/components/attachment-picker";

type Option = {
  id: string;
  label: string;
  isOther?: boolean;
  active?: boolean;
};
type Values = {
  applicantName: string;
  title: string;
  machineTypeId: string;
  articleNumber: string;
  articleDescription: string;
  reasonIds: string[];
  otherReasonText: string;
  description: string;
};
type Props = {
  machineTypes: { id: string; label: string }[];
  reasons: Option[];
  initial?: Values & {
    id: string;
    version: number;
    number: string;
    createdAt: string;
  };
};
const initialState: FormState = {};

export function ChangeRequestForm({ machineTypes, reasons, initial }: Props) {
  const [state, action, pending] = useActionState(
    saveChangeRequest,
    initialState,
  );
  const { register, control } = useForm<Values>({
    defaultValues: initial ?? {
      applicantName: "",
      title: "",
      machineTypeId: "",
      articleNumber: "",
      articleDescription: "",
      reasonIds: [],
      otherReasonText: "",
      description: "",
    },
  });
  const selected = useWatch({ control, name: "reasonIds" }) ?? [];
  const selectedMachineTypeId = useWatch({ control, name: "machineTypeId" });
  const articleNumber = useWatch({ control, name: "articleNumber" });
  const selectedMachine = machineTypes.find(
    (machine) => machine.id === selectedMachineTypeId,
  );
  const writingContext = [
    selectedMachine ? `Maschinentyp: ${selectedMachine.label}` : "",
    articleNumber ? `Artikel-/Baugruppennummer: ${articleNumber}` : "",
  ]
    .filter(Boolean)
    .join("; ");
  const other = reasons.find((reason) => reason.isOther);
  const showOther = other && selected.includes(other.id);
  const error = (field: string) => state.errors?.[field]?.[0];
  const input =
    "mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100";
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
      <Card className="p-6">
        <h2 className="font-semibold text-slate-950">Allgemein</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          {initial && <ReadOnly label="Nummer" value={initial.number} />}
          <label>
            <span className="text-sm font-medium">Antragsteller *</span>
            <input {...register("applicantName")} className={input} />
            <Error text={error("applicantName")} />
          </label>
          <ReadOnly
            label="Datum"
            value={
              initial?.createdAt ??
              new Intl.DateTimeFormat("de-CH").format(new Date())
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
            />
          </div>
          <label>
            <span className="text-sm font-medium">Maschinentyp *</span>
            <select {...register("machineTypeId")} className={input}>
              <option value="">Bitte wählen</option>
              {machineTypes.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
            <Error text={error("machineTypeId")} />
          </label>
        </div>
      </Card>
      <Card className="p-6">
        <h2 className="font-semibold">Artikel / Baugruppe</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <label>
            <span className="text-sm font-medium">
              Artikel-/Baugruppennummer *
            </span>
            <input {...register("articleNumber")} className={input} />
            <Error text={error("articleNumber")} />
          </label>
          <AssistedTextField
            name="articleDescription"
            label="Artikel-/Baugruppenbezeichnung"
            defaultValue={initial?.articleDescription}
            required
            error={error("articleDescription")}
            maxLength={300}
            context={writingContext}
          />
        </div>
      </Card>
      <Card className="p-6">
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
            />
          </div>
        )}
      </Card>
      <Card className="p-6">
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
          />
        </div>
      </Card>
      <Card className="p-6">
        <h2 className="font-semibold">Anhänge</h2>
        <p className="mb-4 mt-1 text-sm text-slate-500">
          PDF, PNG, JPG, DOCX oder XLSX; maximal 20 MB pro Datei.
        </p>
        <AttachmentPicker />
      </Card>
      <div className="flex justify-end gap-3">
        <button
          type="submit"
          name="intent"
          value="draft"
          disabled={pending}
          className="rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
        >
          Als Entwurf speichern
        </button>
        <button
          type="submit"
          name="intent"
          value="submit"
          disabled={pending}
          className="rounded-md bg-[#175f91] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#124d76] disabled:opacity-50"
        >
          Einreichen
        </button>
      </div>
    </form>
  );
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
