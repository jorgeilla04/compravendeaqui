import type { CategoryNode, Listing, ListingCard } from "@/lib/types";

export const card = (overrides: Partial<ListingCard> = {}): ListingCard => ({
  id: "l1",
  slug: "toyota-corolla-abc123",
  title: "Toyota Corolla XEI 2018",
  price: "15900",
  price_currency: "USD",
  price_usd_ref: "15900",
  condition: "usado",
  department: "Capital",
  status: "active",
  category_slug: "autos",
  url_path: "/autos/toyota-corolla-abc123",
  thumb_url: null,
  created_at: "2026-11-01T10:00:00Z",
  ...overrides,
});

export const categories: CategoryNode[] = [
  {
    id: "c1",
    parent_id: null,
    name: "Vehículos",
    slug: "vehiculos",
    icon: "car",
    display_order: 0,
    children: [
      {
        id: "c2",
        parent_id: "c1",
        name: "Autos",
        slug: "autos",
        icon: null,
        display_order: 0,
        children: [],
      },
    ],
  },
];

export const listing = (overrides: Partial<Listing> = {}): Listing => ({
  ...card(),
  description: "Impecable, único dueño.\nService al día.",
  location: "Barrio Centro",
  category: {
    id: "c2",
    parent_id: "c1",
    name: "Autos",
    slug: "autos",
    icon: null,
    display_order: 0,
  },
  images: [
    {
      id: "i1",
      url: "http://localhost:9000/a.webp",
      thumb_url: "http://localhost:9000/a_t.webp",
      width: 1600,
      height: 1200,
      is_primary: true,
      display_order: 0,
    },
    {
      id: "i2",
      url: "http://localhost:9000/b.webp",
      thumb_url: null,
      width: 1600,
      height: 1200,
      is_primary: false,
      display_order: 1,
    },
  ],
  seller: {
    id: "u1",
    username: "carlos",
    display_name: "Carlos Vende",
    avatar_url: null,
    created_at: "2025-03-01T00:00:00Z",
  },
  fx_rate_at_publish: "1200",
  updated_at: "2026-11-01T10:00:00Z",
  expires_at: "2027-01-30T10:00:00Z",
  ...overrides,
});
