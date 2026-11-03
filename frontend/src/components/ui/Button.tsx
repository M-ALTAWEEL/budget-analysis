import { IbudgiLoader } from "@/components/brand/IbudgiLoader";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand text-on-brand hover:bg-brand-dark",
  secondary: "bg-surface text-brand border border-line hover:bg-brand-soft",
  danger: "bg-surface text-berry border border-berry/40 hover:bg-berry-soft",
  ghost: "text-muted hover:text-ink hover:bg-sunken",
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
}

export function Button({
  variant = "primary",
  loading = false,
  disabled,
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-control px-5 text-[15px] font-semibold transition-[color,background-color,border-color,transform] duration-200 ease-smooth active:scale-[0.97] disabled:cursor-not-allowed disabled:active:scale-100 disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
    >
      {loading && (
        // aria-busy on the button already says it is working.
        <span aria-hidden className="-my-1 flex">
          <IbudgiLoader size={24} variant="inherit" />
        </span>
      )}
      {children}
    </button>
  );
}
