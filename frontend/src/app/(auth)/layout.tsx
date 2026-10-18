import { AuthGate } from "@/components/auth/AuthGate";
import { SampleTank } from "@/components/overview/BudgetTank";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <div className="min-h-screen lg:grid lg:grid-cols-2">
        <div className="flex flex-col px-6 py-10 sm:px-12">
          <span className="font-display text-xl font-bold tracking-tight">BudgetBuddy</span>
          <div className="my-auto w-full max-w-sm py-12">{children}</div>
        </div>
        <aside className="hidden flex-col justify-center bg-pine px-16 text-white lg:flex">
          <p className="max-w-md font-display text-4xl leading-tight font-semibold">
            See how much of your allowance is left, and whether it will last the month.
          </p>
          <div className="mt-12 max-w-md">
            <SampleTank />
          </div>
        </aside>
      </div>
    </AuthGate>
  );
}
