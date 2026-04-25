import { ReactNode } from "react";

export default function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="bg-white border border-slate-200 rounded-lg">
      <header className="px-5 py-3 border-b border-slate-200">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </header>
      <div className="p-5 text-sm text-slate-800 space-y-3">{children}</div>
    </section>
  );
}
