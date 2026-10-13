import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type PlaceholderPageProps = {
  title: string;
};

export function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <section className="flex w-full flex-col gap-6">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Coming soon</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            This page is part of the initial HomeLoop scaffold.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
