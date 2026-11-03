/** Tipos de la API (espejo de backend/app/schemas). */

export type Currency = "ARS" | "USD";
export type Condition = "nuevo" | "usado" | "reacondicionado";
export type ListingStatus =
  | "active"
  | "sold"
  | "expired"
  | "draft"
  | "suspended";
export type Sort = "relevance" | "newest" | "price_asc" | "price_desc";

export interface Category {
  id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  icon: string | null;
  display_order: number;
}

export interface CategoryNode extends Category {
  children: CategoryNode[];
}

export interface CategoryDetail extends Category {
  children: Category[];
  path: Category[];
}

export interface PublicUser {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
}

export interface PublicProfile extends PublicUser {
  active_listings_count: number;
}

export interface Me extends PublicUser {
  phone_masked: string | null;
  phone_verified: boolean;
  email: string | null;
  full_name: string | null;
  role: string;
  whatsapp_optin: boolean;
  profile_pending: boolean;
  has_password: boolean;
}

export interface ListingImage {
  id: string;
  url: string;
  thumb_url: string | null;
  width: number | null;
  height: number | null;
  is_primary: boolean;
  display_order: number;
}

export interface ListingCard {
  id: string;
  slug: string;
  title: string;
  price: string | null;
  price_currency: Currency;
  price_usd_ref: string | null;
  condition: Condition | null;
  department: string | null;
  status: ListingStatus;
  category_slug: string;
  url_path: string;
  thumb_url: string | null;
  created_at: string;
}

export interface Listing extends ListingCard {
  description: string;
  location: string | null;
  category: Category;
  images: ListingImage[];
  seller: PublicUser;
  fx_rate_at_publish: string | null;
  updated_at: string;
  expires_at: string | null;
}

export interface OwnerListing extends Listing {
  views_count: number;
  contacts_count: number;
}

export interface ListingPage {
  items: ListingCard[];
  next_cursor: string | null;
}

export interface ListingInput {
  title: string;
  description: string;
  category_id: string;
  price: string | null;
  price_currency: Currency;
  condition: Condition | null;
  department: string;
  location: string | null;
  status?: "active" | "draft" | "sold";
}

export interface AuthResponse {
  user: Me;
  is_new_user: boolean;
  access_token: string;
  expires_in: number;
}

export interface OtpRequestResponse {
  phone: string;
  channel: string;
  expires_in: number;
  resend_in: number;
}

export interface ContactResponse {
  whatsapp_url: string;
  phone_display: string;
}

export interface Suggestions {
  queries: { text: string }[];
  categories: { name: string; slug: string }[];
}
