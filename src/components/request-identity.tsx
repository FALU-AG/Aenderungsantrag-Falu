export function RequestIdentity({ creatorName, applicantName, createdAt }: { creatorName: string; applicantName: string; createdAt: string }) {
  return <>
    <IdentityItem label="Erstellt von" value={creatorName} />
    <IdentityItem label="Antragsteller" value={applicantName || "–"} />
    <IdentityItem label="Erstellt am" value={createdAt} />
  </>;
}

function IdentityItem({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-medium uppercase text-slate-500">{label}</dt><dd className="mt-1 text-sm">{value}</dd></div>;
}
