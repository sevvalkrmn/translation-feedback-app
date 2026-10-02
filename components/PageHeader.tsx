import Link from "next/link";

export function PageHeader({
  title,
  description,
  backHref
}: {
  title: string;
  description: string;
  backHref?: string;
}) {
  return (
    <header className="mb-7 border-b border-slate-200 pb-5">
      {backHref ? (
        <Link className="mb-3 inline-flex rounded-sm text-sm font-medium text-teal-800 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500" href={backHref}>
          Geri dön
        </Link>
      ) : null}
      <h1 className="text-2xl font-semibold text-slate-950 sm:text-3xl">{title}</h1>
      <p className="mt-2 max-w-3xl leading-7 text-slate-700">{description}</p>
    </header>
  );
}
