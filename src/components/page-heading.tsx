export function PageHeading({ title, description }: { title: string; description: string }) {
  return <div className="mb-7"><h1 className="text-2xl font-bold tracking-tight text-slate-950">{title}</h1><p className="mt-1 text-sm text-slate-600">{description}</p></div>;
}
