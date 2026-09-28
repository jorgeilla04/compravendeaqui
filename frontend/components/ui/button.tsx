import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Variantes de botón según DESIGN.md:
 * primary (azul), accent (verde CTA), whatsapp (verde WhatsApp — solo contacto),
 * ghost y destructive. Touch target mínimo 44px (h-11) en la variante default.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-input text-base font-semibold transition-colors duration-200 ease-out-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-secondary",
        accent: "bg-accent text-accent-foreground hover:brightness-95",
        whatsapp:
          "rounded-pill bg-whatsapp text-whatsapp-foreground hover:brightness-95",
        ghost: "text-foreground hover:bg-muted",
        destructive:
          "bg-destructive text-destructive-foreground hover:brightness-95",
        outline:
          "border border-border bg-transparent text-foreground hover:bg-muted",
      },
      size: {
        default: "h-11 px-5 py-2",
        sm: "h-9 px-3 text-meta",
        lg: "h-12 px-7 text-h3",
        icon: "size-11",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
