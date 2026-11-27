import { BadgeCheck } from "lucide-react";
import type { ReactNode } from "react";

import type { DealDetail } from "@/api/types";
import { Avatar, CardHeader } from "@/components/ui/primitives";
import { tKey, useI18n } from "@/i18n/I18nProvider";
import { area, decimal, longDate, money } from "@/lib/format";

export function Particulars({ deal }: { deal: DealDetail }) {
  const { t } = useI18n();
  const p = deal.property;
  const fields: [string, ReactNode][] = [
    [t("field.property"), p.title],
    [t("field.type"), tKey(t, "ptype", p.property_type)],
    [t("field.neighborhood"), `${p.neighborhood}, ${p.city}`],
    [t("field.address"), `${p.address}, ${p.zip_code} ${p.city}`],
    [t("field.rooms"), p.property_type === "land" ? "—" : t("field.roomsValue", { beds: p.bedrooms, baths: decimal(p.bathrooms, 0) })],
    [t("field.area"), `${area(p.area_sqm)} · ${t("unit.perSqm", { v: money(p.price_per_sqm) })}`],
    [t("field.plot"), p.plot_sqm ? area(p.plot_sqm) : "—"],
    [t("field.yearBuilt"), p.year_built ?? "—"],
    [t("field.listed"), `${longDate(p.listed_at)} · ${t("unit.daysLong", { n: p.days_on_market })}`],
    [t("field.costs"), `${t("unit.perYear", { v: money(p.tax_annual) })} · ${p.hoa_monthly ? t("unit.perMonth", { v: money(p.hoa_monthly) }) : t("field.noServiceCharge")}`],
    [t("field.client"), deal.client.name],
    [t("field.preApproved"), deal.client.pre_approved_amount ? money(deal.client.pre_approved_amount) : "—"],
    [t("field.channel"), tKey(t, "channel", deal.channel)],
    [t("field.financing"), tKey(t, "financing", deal.financing)],
    [t("field.opened"), longDate(deal.created_at)],
    [
      t("field.agent"),
      deal.agent ? (
        <span className="inline-flex items-center gap-2">
          <Avatar agent={deal.agent} size={20} /> {deal.agent.name}
        </span>
      ) : (
        t("common.unassigned")
      ),
    ],
  ];

  return (
    <section className="card p-5">
      <CardHeader
        title={t("particulars.title")}
        subtitle={t("particulars.subtitle")}
        action={
          <span className="inline-flex items-center gap-1.5 text-xs text-ink-2">
            <BadgeCheck size={14} className="text-brand-text" /> {tKey(t, "client", deal.client.kind)}
          </span>
        }
      />
      <dl className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
        {fields.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="label">{label}</dt>
            <dd className="mt-0.5 truncate text-sm font-medium text-ink">{value}</dd>
          </div>
        ))}
      </dl>
      {p.description && <p className="mt-5 border-t border-line pt-4 text-sm leading-relaxed text-ink-2">{p.description}</p>}
    </section>
  );
}
