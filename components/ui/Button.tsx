import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

const base =
  "inline-flex items-center justify-center gap-2 rounded-2xl font-display font-bold text-base min-h-[44px] px-5 py-3 transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none select-none shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

const variants = {
  primary:
    "bg-brand-600 text-white hover:bg-brand-700 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:bg-brand-800 focus-visible:ring-brand-400",
  accent:
    "bg-accent-700 text-white hover:bg-accent-800 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:bg-accent-900 focus-visible:ring-accent-400",
  secondary:
    "bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50 hover:border-neutral-300 active:bg-neutral-100 shadow-none focus-visible:ring-brand-300",
  danger:
    "bg-red-600 text-white hover:bg-red-700 hover:shadow-md active:bg-red-800 focus-visible:ring-red-400",
  ghost: "text-neutral-600 hover:bg-neutral-100 active:bg-neutral-200 shadow-none",
};

export type ButtonVariant = keyof typeof variants;

export function buttonClass(variant: ButtonVariant = "primary", className = "") {
  return `${base} ${variants[variant]} ${className}`.trim();
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  return <button className={buttonClass(variant, className)} {...props} />;
}

interface ButtonLinkProps {
  href: string;
  variant?: ButtonVariant;
  className?: string;
  children: ReactNode;
}

export function ButtonLink({ href, variant = "primary", className, children }: ButtonLinkProps) {
  return (
    <Link href={href} className={buttonClass(variant, className)}>
      {children}
    </Link>
  );
}
