import { Button } from "@/components/ui/Button";

export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-2xl border border-berry/30 bg-berry-soft px-5 py-5">
      <p className="text-[15px] text-berry">{message}</p>
      <Button variant="secondary" className="mt-4" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
