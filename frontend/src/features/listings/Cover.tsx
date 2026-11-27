import { Building, Home, LandPlot, type LucideIcon, Warehouse } from "lucide-react";
import { useState } from "react";

import type { Property, PropertyType } from "@/api/types";
import { cn } from "@/lib/cn";

import { type ListingPhoto, photoFor } from "./photos";

const TYPE_ICON: Record<PropertyType, LucideIcon> = {
  single_family: Home,
  condo: Building,
  townhouse: Warehouse,
  multi_family: Building,
  land: LandPlot,
};

/**
 * Listing photo with a deterministic gradient placeholder: the gradient shows while the
 * image loads (or if it fails), then the photo fades in. Zooms gently when a parent `.group` is hovered.
 */
export function Cover({
  p,
  className = "h-36",
  offset = 0,
  photo,
  eager = false,
  size = "thumb",
}: {
  p: Property;
  className?: string;
  offset?: number;
  photo?: ListingPhoto;
  eager?: boolean;
  /** `thumb` (480px) for cards/thumbnails, `full` (800px) for the large view. */
  size?: "thumb" | "full";
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const img = photo ?? photoFor(p.property_type, p.id, offset);
  const angle = 110 + ((p.id * 47) % 90);
  const Icon = TYPE_ICON[p.property_type];

  return (
    <div
      className={cn("relative overflow-hidden rounded-xl", className)}
      style={{
        // palette-only placeholder: chalk → ink wash, angle varies per listing
        background: `linear-gradient(${angle}deg, var(--surface-muted), var(--track)), var(--surface-solid)`,
      }}
    >
      {(!loaded || failed) && <Icon className="absolute right-3 bottom-3 text-ink-3" size={34} strokeWidth={1.5} aria-hidden />}
      {!failed && (
        <img
          src={size === "full" ? img.src : img.thumb}
          alt={p.title}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={cn(
            "absolute inset-0 size-full object-cover transition-[opacity,transform] duration-500 ease-out group-hover:scale-[1.04]",
            loaded ? "opacity-100" : "opacity-0",
          )}
        />
      )}
      {/* soft bottom shade keeps overlaid badges/credits legible on bright photos */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/25 to-transparent" />
    </div>
  );
}
