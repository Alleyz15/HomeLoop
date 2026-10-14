import { ValuationForm } from "./valuation-form";

export default function ValuationPage() {
  return (
    <section className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Value your home
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Free, and based on real transactions published by NAPIC. We do not ask
          for your house number at this stage, only the road.
        </p>
      </div>
      <ValuationForm />
    </section>
  );
}
