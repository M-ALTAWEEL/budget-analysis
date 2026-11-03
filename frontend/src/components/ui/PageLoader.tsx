import { IbudgiLoader } from "@/components/brand/IbudgiLoader";

/** A page or section that is still loading: the ibudgi "fill up" loader. */
export function PageLoader({ size = 48 }: { size?: number }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <IbudgiLoader size={size} />
    </div>
  );
}
