type CounterClient = { changeRequestCounter: { upsert(args: unknown): Promise<{ nextNumber: number }> } };

export async function generateChangeRequestNumber(tx: CounterClient, date = new Date(), prefix = "CR") {
  const year = Number(new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "Europe/Zurich" }).format(date));
  const counter = await tx.changeRequestCounter.upsert({
    where: { year }, create: { year, nextNumber: 2 }, update: { nextNumber: { increment: 1 } }, select: { nextNumber: true },
  });
  const allocated = counter.nextNumber - 1;
  if (allocated > 999) throw new Error(`Nummernkreis ${year} ist ausgeschöpft.`);
  return `${prefix}-${year}-${String(allocated).padStart(3, "0")}`;
}
