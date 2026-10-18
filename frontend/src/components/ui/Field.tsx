import { useId } from "react";

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  suffix?: string; // e.g. the currency code next to an amount
}

export function Field({ label, hint, suffix, className = "", ...props }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <div className="flex items-center rounded-xl border border-line bg-surface transition-shadow focus-within:border-pine focus-within:ring-3 focus-within:ring-pine/20">
        <input
          id={id}
          aria-describedby={hintId}
          {...props}
          className="h-11 w-full min-w-0 rounded-xl bg-transparent px-3.5 text-[15px] outline-none placeholder:text-muted/70"
        />
        {suffix && <span className="pe-3.5 text-sm text-muted">{suffix}</span>}
      </div>
      {hint && (
        <p id={hintId} className="mt-1.5 text-sm text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
}

export function Select({ label, className = "", children, ...props }: SelectProps) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        {...props}
        className="h-11 w-full rounded-xl border border-line bg-surface px-3 text-[15px] outline-none transition-shadow focus:border-pine focus:ring-3 focus:ring-pine/20"
      >
        {children}
      </select>
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl bg-berry-soft px-3.5 py-2.5 text-sm text-berry">
      {message}
    </p>
  );
}
