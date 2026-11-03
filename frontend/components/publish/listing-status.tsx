import {
  CircleCheck,
  Handshake,
  CirclePause,
  Clock,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS } from "@/lib/constants";
import type { ListingStatus } from "@/lib/types";

type Tone = "neutral" | "info" | "success" | "warning" | "danger";

const STATUS_STYLE: Record<ListingStatus, { tone: Tone; icon: LucideIcon }> = {
  active: { tone: "success", icon: CircleCheck },
  draft: { tone: "neutral", icon: CirclePause },
  sold: { tone: "info", icon: Handshake },
  expired: { tone: "warning", icon: Clock },
  suspended: { tone: "danger", icon: ShieldAlert },
};

/** Estado con texto + ícono: nunca solo color. */
export function StatusBadge({ status }: { status: ListingStatus }) {
  const style = STATUS_STYLE[status] ?? STATUS_STYLE.draft;
  const Icon = style.icon;
  return (
    <Badge tone={style.tone}>
      <Icon aria-hidden="true" className="size-3.5" />
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

export type ListingAction =
  | "view"
  | "edit"
  | "sold"
  | "pause"
  | "reactivate"
  | "delete";

/** Acciones disponibles según el estado (los suspendidos solo se eliminan). */
export function actionsFor(status: ListingStatus): ListingAction[] {
  switch (status) {
    case "active":
      return ["view", "edit", "sold", "pause", "delete"];
    case "draft":
    case "expired":
    case "sold":
      return ["edit", "reactivate", "delete"];
    case "suspended":
      return ["delete"];
    default:
      return ["edit", "delete"];
  }
}

export function metricsText(views: number, contacts: number): string {
  const v = views === 1 ? "1 vista" : `${views} vistas`;
  const c =
    contacts === 1
      ? "1 contacto por WhatsApp"
      : `${contacts} contactos por WhatsApp`;
  return `${v} · ${c}`;
}
