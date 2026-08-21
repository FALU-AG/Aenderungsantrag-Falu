export function PageHeading({ title, description }: { title: string; description: string }) {
  return <div className="mb-5 sm:mb-7"><h1 className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">{title}</h1><p className="mt-1 text-sm text-slate-600">{description}</p></div>;
}
