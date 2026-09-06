import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getGenerator } from "@/lib/generators";
import { estimateCredits } from "@/lib/credits";
import { getSessionUser } from "@/lib/session";
import { ensureUserRecord, listBrands, toAccountView } from "@/lib/firestore";
import { StudioClient, type GeneratorView } from "@/components/studio-client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: RouteParams): Promise<Metadata> {
  const { id } = await params;
  const generator = getGenerator(id);
  if (!generator) return { title: "Not found" };
  return { title: generator.name, description: generator.blurb };
}

export default async function StudioPage({ params }: RouteParams) {
  const { id } = await params;
  const generator = getGenerator(id);
  if (!generator) notFound();

  const user = await getSessionUser();
  // The layout redirects when signed out; this narrows the type.
  if (!user) return null;

  const [record, brands] = await Promise.all([
    ensureUserRecord(user),
    listBrands(user.uid),
  ]);

  // `instruction` is a function and cannot cross the server/client boundary,
  // so only the serialisable half of the generator is handed down.
  const view: GeneratorView = {
    id: generator.id,
    name: generator.name,
    icon: generator.icon,
    category: generator.category,
    blurb: generator.blurb,
    format: generator.format,
    maxTokens: generator.maxTokens,
    fields: generator.fields,
  };

  return (
    <StudioClient
      generator={view}
      brands={brands}
      account={toAccountView(record)}
      estimate={estimateCredits(generator.maxTokens)}
    />
  );
}
