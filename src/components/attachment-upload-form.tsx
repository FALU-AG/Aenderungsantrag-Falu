"use client";

import { useActionState } from "react";
import { AttachmentPicker } from "@/components/attachment-picker";
import { uploadAttachment, type AttachmentActionState } from "@/modules/change-requests/actions";

const initialState: AttachmentActionState = {};

export function AttachmentUploadForm({ requestId }: { requestId: string }) {
  const [state, action, pending] = useActionState(uploadAttachment.bind(null, requestId), initialState);
  return (
    <form action={action} className="mt-4 rounded-md border p-4">
      <AttachmentPicker fieldName="file" multiple={false} />
      {state.error && <p role="alert" className="mt-3 text-sm text-red-700">{state.error}</p>}
      {state.success && <p role="status" className="mt-3 text-sm text-green-700">{state.success}</p>}
      <button disabled={pending} className="mt-4 rounded-md bg-[#175f91] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
        {pending ? "Wird hochgeladen…" : "Auswahl hochladen"}
      </button>
    </form>
  );
}
