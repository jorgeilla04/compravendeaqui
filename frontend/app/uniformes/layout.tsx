import Link from "next/link";

import { CartLink } from "@/components/uniformes/cart-link";
import { CartProvider } from "@/lib/uniformes/cart";

export default function UniformesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CartProvider>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
          <Link
            href="/uniformes"
            className="font-heading text-h3 font-semibold text-foreground hover:text-primary"
          >
            Uniformes escolares
          </Link>
          <CartLink />
        </div>
        {children}
      </div>
    </CartProvider>
  );
}
