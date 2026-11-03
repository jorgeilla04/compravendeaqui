import {
  BadgeCheck,
  Baby,
  Bike,
  Briefcase,
  Car,
  House,
  Package,
  PawPrint,
  Shirt,
  Smartphone,
  Sofa,
  Tractor,
  Wrench,
  type LucideIcon,
} from "lucide-react";

/** Íconos por categoría: el backend guarda el nombre de lucide. */
const ICONS: Record<string, LucideIcon> = {
  car: Car,
  house: House,
  smartphone: Smartphone,
  sofa: Sofa,
  shirt: Shirt,
  bike: Bike,
  wrench: Wrench,
  tractor: Tractor,
  "paw-print": PawPrint,
  baby: Baby,
  briefcase: Briefcase,
  "badge-check": BadgeCheck,
  package: Package,
};

export function CategoryIcon({
  name,
  className,
}: {
  name: string | null;
  className?: string;
}) {
  const Icon = (name && ICONS[name]) || Package;
  return <Icon aria-hidden="true" className={className} />;
}
