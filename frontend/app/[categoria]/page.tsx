import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { SearchResults } from "@/components/search/search-results";
import { apiQuery, parseFilters } from "@/components/search/params";
import { FormMessage } from "@/components/ui/form";
import { serverGet } from "@/lib/api";
import { SITE_URL } from "@/lib/constants";
import { jsonLd } from "@/lib/seo";
import type { CategoryDetail, CategoryNode, ListingPage } from "@/lib/types";

type Props = {
  params: { categoria: string };
  searchParams: Record<string, string | string[] | undefined>;
};

async function getCategory(slug: string) {
  if (!/^[a-z0-9-]{1,100}$/.test(slug)) return null;
  return serverGet<CategoryDetail>(`/categories/${slug}`, undefined, 3600);
}

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const category = await getCategory(params.categoria);
  if (!category) return {};
  const hasFilters = Object.keys(parseFilters(searchParams)).length > 0;
  const title = `${category.name} en San Juan`;
  const description = `Avisos de ${category.name.toLowerCase()} en San Juan: comprá y vendé cerca tuyo y contactá por WhatsApp.`;
  return {
    title,
    description,
    alternates: { canonical: `/${category.slug}` },
    openGraph: { title, description, url: `${SITE_URL}/${category.slug}` },
    robots: hasFilters ? { index: false, follow: true } : undefined,
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const category = await getCategory(params.categoria);
  if (!category) notFound();

  const filters = { ...parseFilters(searchParams), category: category.slug };
  const [page, categories] = await Promise.all([
    serverGet<ListingPage>("/listings", apiQuery(filters), 60).catch(
      () => null,
    ),
    serverGet<CategoryNode[]>("/categories", undefined, 3600).catch(() => []),
  ]);

  const crumbs = [
    { name: "Inicio", href: "/" },
    ...category.path.map((c) => ({ name: c.name, href: `/${c.slug}` })),
  ];
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: `${SITE_URL}${crumb.href}`,
    })),
  };

  return (
    <div className="flex flex-col gap-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbLd) }}
      />
      <Breadcrumbs items={crumbs} />
      <h1 className="font-heading text-h1 font-semibold">
        {category.name} en San Juan
      </h1>
      {category.children.length > 0 ? (
        <nav aria-label="Subcategorías">
          <ul className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
            {category.children.map((child) => (
              <li key={child.id} className="shrink-0 snap-start">
                <Link
                  href={`/${child.slug}`}
                  className="inline-flex min-h-10 items-center rounded-pill border border-border bg-card px-4 text-meta font-semibold text-foreground hover:border-primary"
                >
                  {child.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
      {page ? (
        <SearchResults
          basePath={`/${category.slug}`}
          filters={filters}
          initial={page}
          categories={categories ?? []}
          lockCategory
        />
      ) : (
        <FormMessage>
          No pudimos cargar los avisos. Probá de nuevo en unos segundos.
        </FormMessage>
      )}
    </div>
  );
}
