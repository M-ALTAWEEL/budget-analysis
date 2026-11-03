import { IbudgiLoader } from "@/components/brand/IbudgiLoader";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand text-on-brand hover:bg-brand-dark",
  secondary: "bg-surface text-ink border border-line hover:border-ink/40",
  danger: "bg-surface text-berry border border-berry/40 hover:bg-berry-soft",
  ghost: "text-muted hover:text-ink hover:bg-ink/5",
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
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-[15px] font-semibold transition-[color,background-color,border-color,transform] active:scale-[0.97] disabled:cursor-not-allowed disabled:active:scale-100 disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
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
