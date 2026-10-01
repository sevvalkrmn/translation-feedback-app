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
    <header className="mb-6 border-b border-slate-200 pb-5">
      {backHref ? (
        <Link className="mb-3 inline-flex text-sm font-medium text-teal-700 underline" href={backHref}>
          Geri dön
        </Link>
      ) : null}
      <h1 className="text-3xl font-semibold text-slate-950">{title}</h1>
      <p className="mt-2 max-w-3xl text-slate-700">{description}</p>
    </header>
  );
}
