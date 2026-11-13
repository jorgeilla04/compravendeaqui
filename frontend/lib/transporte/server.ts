import { cache } from "react";

import { serverGet } from "@/lib/api";
import type {
  Paquete,
  PaqueteResumen,
  Transportista,
} from "@/lib/transporte/types";

const get = <T>(path: string) =>
  serverGet<T>(path, undefined, 60).catch(() => null);

export const getTransportista = cache((slug: string) =>
  get<Transportista>(`/transporte/${encodeURIComponent(slug)}`),
);

export const getPaquetes = cache((slug: string) =>
  get<PaqueteResumen[]>(`/transporte/${encodeURIComponent(slug)}/paquetes`),
);

export const getPaquete = cache((slug: string, paquete: string) =>
  get<Paquete>(
    `/transporte/${encodeURIComponent(slug)}/paquetes/${encodeURIComponent(paquete)}`,
  ),
);
