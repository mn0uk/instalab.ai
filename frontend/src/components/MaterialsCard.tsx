import type { MaterialsResult } from "../api/types";
import SectionCard from "./SectionCard";

export default function MaterialsCard({ data }: { data: MaterialsResult }) {
  return (
    <SectionCard
      title="Materials and budget"
      subtitle={`Estimated total: ${data.budget_total.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${data.currency}`}
    >
      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
              <th className="px-2 py-1">Item</th>
              <th className="px-2 py-1">Supplier</th>
              <th className="px-2 py-1">Catalog</th>
              <th className="px-2 py-1">Qty</th>
              <th className="px-2 py-1">Unit price</th>
              <th className="px-2 py-1">Source</th>
            </tr>
          </thead>
          <tbody>
            {data.line_items.map((li, i) => (
              <tr key={i} className="border-b border-slate-100 align-top">
                <td className="px-2 py-1">
                  <div className="font-medium">{li.name}</div>
                  {li.notes && <div className="text-xs text-slate-500">{li.notes}</div>}
                </td>
                <td className="px-2 py-1 text-xs text-slate-700">{li.supplier ?? "-"}</td>
                <td className="px-2 py-1 text-xs text-slate-700">{li.catalog_number ?? "-"}</td>
                <td className="px-2 py-1 text-xs text-slate-700">{li.quantity ?? "-"}</td>
                <td className="px-2 py-1 text-xs text-slate-700">
                  {li.unit_price != null ? `${li.unit_price} ${li.currency}` : "-"}
                </td>
                <td className="px-2 py-1 text-xs">
                  {li.source_url ? (
                    <a
                      href={li.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline text-slate-700"
                    >
                      link
                    </a>
                  ) : (
                    "-"
                  )}
                </td>
              </tr>
            ))}
            {data.line_items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-2 py-3 text-xs text-slate-500">
                  No line items returned.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {data.lead_time_risks.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-700">Lead time risks</p>
          <ul className="list-disc pl-5 text-xs text-slate-700">
            {data.lead_time_risks.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {data.substitution_notes.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-700">Substitution notes</p>
          <ul className="list-disc pl-5 text-xs text-slate-700">
            {data.substitution_notes.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}
    </SectionCard>
  );
}
