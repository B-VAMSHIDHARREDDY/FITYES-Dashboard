import { motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { useDeals, useUpdateProperty } from "@/api/hooks";
import type { ListingStatus, Property } from "@/api/types";
import { Avatar, Pill } from "@/components/ui";
import { errorText, stageLabel } from "@/i18n/domain";
import { tKey, useI18n } from "@/i18n/I18nProvider";
import { area, decimal, longDate, money } from "@/lib/format";
import { sound } from "@/lib/sound";
import { LISTING_TONE } from "@/lib/stages";

import { Cover } from "./Cover";
import { photoFor } from "./photos";

export function PropertyDrawer({ property, onClose }: { property: Property; onClose: () => void }) {
  const { t } = useI18n();
  const update = useUpdateProperty(property.id);
  const [p, setP] = useState(property);
  const [price, setPrice] = useState(String(property.list_price));
  const [shot, setShot] = useState(0);
  const gallery = [0, 1, 2, 3].map((o) => photoFor(property.property_type, property.id, o));
  const photo = gallery[shot];
  const { data: deals } = useDeals(null, property.title, 50);
  const related = deals?.items.filter((d) => d.property_id === p.id) ?? [];

  useEffect(() => sound.whoosh(), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = (body: { list_price?: number; status?: ListingStatus }) =>
    update.mutate(body, { onSuccess: (next) => { setP(next); setPrice(String(next.list_price)); } });

  const priceNum = Number(price);
  const priceChanged = Number.isFinite(priceNum) && priceNum > 0 && priceNum !== p.list_price;

  const facts: [string, string | number][] = [
    [t("field.type"), tKey(t, "ptype", p.property_type)],
    [t("field.rooms"), p.property_type === "land" ? "—" : `${p.bedrooms} / ${decimal(p.bathrooms, 0)}`],
    [t("field.area"), area(p.area_sqm)],
    [t("field.pricePerSqm"), money(p.price_per_sqm)],
    [t("field.plot"), p.plot_sqm ? area(p.plot_sqm) : "—"],
    [t("field.yearBuilt"), p.year_built ?? "—"],
    [t("field.dom"), t("unit.daysLong", { n: p.days_on_market })],
    [t("field.listed"), longDate(p.listed_at)],
    [t("field.code"), p.code],
  ];

  return (
    <>
      <motion.div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.aside
        role="dialog"
        aria-modal="true"
        aria-label={p.title}
        className="fixed top-0 right-0 bottom-0 z-50 flex w-full max-w-md flex-col overflow-y-auto border-l border-line bg-surface-solid p-5 shadow-2xl"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
      >
        <div className="flex items-center justify-between">
          <Pill tone={LISTING_TONE[p.status]} dot>{tKey(t, "listing", p.status)}</Pill>
          <button className="icon-btn" onClick={onClose} aria-label={t("common.close")}><X size={16} /></button>
        </div>
        <div className="mt-4">
          <Cover key={photo.src} p={p} photo={photo} className="h-56" size="full" eager />
          <div className="mt-2 grid grid-cols-4 gap-2">
            {gallery.map((g, i) => (
              <button
                key={g.src + i}
                onClick={() => setShot(i)}
                aria-label={t("photo.show", { n: i + 1 })}
                aria-pressed={shot === i}
                className={`overflow-hidden rounded-lg ring-2 transition ${shot === i ? "ring-brand-text" : "ring-transparent opacity-70 hover:opacity-100"}`}
              >
                <Cover p={p} photo={g} className="h-14 rounded-none" />
              </button>
            ))}
          </div>
          <a href={photo.source} target="_blank" rel="noreferrer noopener" className="mt-1.5 block truncate text-[10px] text-ink-3 hover:text-ink">
            {t("photo.credit", { author: photo.author, license: photo.license })} · Wikimedia Commons
          </a>
        </div>
        <h2 className="mt-4 text-xl font-medium">{p.title}</h2>
        <p className="text-sm text-ink-3">{p.address}, {p.zip_code} {p.city} · {p.neighborhood}</p>
        <p className="tabular mt-3 text-3xl font-semibold tracking-tight">{money(p.sold_price ?? p.list_price)}</p>
        {p.sold_price && <p className="text-xs text-ink-3">{t("drawer.soldOn", { date: p.sold_at ? longDate(p.sold_at) : "—", price: money(p.list_price) })}</p>}

        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl border border-line p-4 text-sm">
          {facts.map(([k, v]) => (
            <div key={k}>
              <dt className="label">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
        </dl>

        {p.agent && (
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-line p-3">
            <Avatar agent={p.agent} size={34} />
            <div><p className="text-sm font-medium">{p.agent.name}</p><p className="text-xs text-ink-3">{p.agent.title}</p></div>
          </div>
        )}

        {p.status !== "sold" && (
          <div className="mt-4 rounded-2xl border border-line p-4">
            <p className="text-sm font-medium">{t("drawer.manage")}</p>
            <div className="mt-3 flex gap-2">
              <input className="field tabular flex-1" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))} aria-label={t("drawer.listPrice")} />
              <button className="btn btn-primary" disabled={!priceChanged || update.isPending} onClick={() => save({ list_price: priceNum })}>{t("drawer.updatePrice")}</button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {(["active", "off_market"] as const).filter((s) => s !== p.status).map((s) => (
                <button key={s} className="btn btn-ghost" disabled={update.isPending} onClick={() => save({ status: s })}>
                  {t("drawer.mark", { status: tKey(t, "listing", s) })}
                </button>
              ))}
            </div>
            {update.isError && <p className="mt-2 text-xs text-bad">{errorText(t, update.error)}</p>}
          </div>
        )}

        {related.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-sm font-medium">{t("drawer.deals")}</p>
            {related.map((d) => (
              <Link key={d.id} to={`/deals/${d.id}`} className="mb-2 flex items-center justify-between rounded-xl border border-line p-3 text-sm hover:border-brand-text/40">
                <span>{d.client_name}</span>
                <Pill tone="brand">{stageLabel(t, d.stage)}</Pill>
              </Link>
            ))}
          </div>
        )}

        {p.description && <p className="mt-4 text-sm leading-relaxed text-ink-2">{p.description}</p>}
      </motion.aside>
    </>
  );
}
