"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";
import { api, errorMessage } from "@/lib/api";
import type { CategoryNode } from "@/lib/types";

import { CategoryStep } from "./category-step";
import {
  emptyDraft,
  hasErrors,
  toListingInput,
  validateCategory,
  validateDetails,
  validatePricing,
  type DraftErrors,
  type DraftField,
  type ListingDraft,
} from "./listing-draft";
import { DetailsFields, PriceLocationFields } from "./listing-fields";
import { checkPhotoFiles, moveToFront } from "./photo-files";
import { PhotosStep, type LocalPhoto } from "./photos-step";
import {
  progressText,
  publishListing,
  type PublishProgress,
} from "./publish-flow";
import { ReviewStep } from "./review-step";
import { StepIndicator } from "./step-indicator";

export const STEPS = [
  "Categoría",
  "Detalles",
  "Precio",
  "Fotos",
  "Revisar",
] as const;

const HEADINGS = [
  "Elegí la categoría",
  "Contá qué vendés",
  "Poné precio y ubicación",
  "Subí fotos",
  "Revisá tu aviso",
];

const LAST = STEPS.length - 1;

/** Validación del paso `step`; Fotos y Revisar no bloquean. */
export function validateStep(
  step: number,
  draft: ListingDraft,
  tree: CategoryNode[],
): DraftErrors {
  if (step === 0) return validateCategory(draft, tree);
  if (step === 1) return validateDetails(draft);
  if (step === 2) return validatePricing(draft);
  return {};
}

let photoSeq = 0;

export function PublishWizard() {
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [draft, setDraft] = React.useState<ListingDraft>(emptyDraft);
  const [errors, setErrors] = React.useState<DraftErrors>({});

  const [tree, setTree] = React.useState<CategoryNode[]>([]);
  const [treeLoading, setTreeLoading] = React.useState(true);
  const [treeError, setTreeError] = React.useState<string | null>(null);

  const [photos, setPhotos] = React.useState<LocalPhoto[]>([]);
  const [photoErrors, setPhotoErrors] = React.useState<string[]>([]);

  const [progress, setProgress] = React.useState<PublishProgress | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const submitting = React.useRef(false);

  const headingRef = React.useRef<HTMLHeadingElement>(null);
  const formRef = React.useRef<HTMLFormElement>(null);
  const mounted = React.useRef(false);

  const loadTree = React.useCallback(async () => {
    setTreeLoading(true);
    setTreeError(null);
    try {
      setTree(await api<CategoryNode[]>("/categories"));
    } catch (error) {
      setTreeError(errorMessage(error));
    } finally {
      setTreeLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadTree();
  }, [loadTree]);

  // Revocar las vistas previas al salir de la pantalla.
  const photosRef = React.useRef(photos);
  photosRef.current = photos;
  React.useEffect(
    () => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.url)),
    [],
  );

  // Al cambiar de paso, llevar el foco al título del paso (lectores de pantalla).
  React.useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    headingRef.current?.focus();
    window.scrollTo?.({ top: 0 });
  }, [step]);

  const patch = React.useCallback((changes: Partial<ListingDraft>) => {
    setDraft((d) => ({ ...d, ...changes }));
    setErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(changes)) {
        delete next[key as DraftField];
        if (key === "categoryId") delete next.category;
      }
      return next;
    });
  }, []);

  const focusFirstError = () => {
    setTimeout(() => {
      const invalid = formRef.current?.querySelector<HTMLElement>(
        "[aria-invalid='true']",
      );
      (invalid ?? headingRef.current)?.focus();
    }, 0);
  };

  const goTo = (target: number) => {
    setErrors({});
    setSubmitError(null);
    setStep(Math.max(0, Math.min(LAST, target)));
  };

  const next = () => {
    const stepErrors = validateStep(step, draft, tree);
    if (hasErrors(stepErrors)) {
      setErrors(stepErrors);
      focusFirstError();
      return;
    }
    goTo(step + 1);
  };

  // --- Categoría ---
  const pickParent = (parent: CategoryNode) =>
    patch({ parentId: parent.id, categoryId: null });
  const pickCategory = (
    category: CategoryNode,
    parent: CategoryNode | null,
  ) => {
    patch({ parentId: parent?.id ?? category.id, categoryId: category.id });
    goTo(1);
  };

  // --- Fotos ---
  const addPhotos = (files: File[]) => {
    const { accepted, errors: rejected } = checkPhotoFiles(
      files,
      photos.length,
    );
    setPhotoErrors(rejected);
    if (accepted.length === 0) return;
    setPhotos((current) => [
      ...current,
      ...accepted.map((file) => ({
        id: `photo-${(photoSeq += 1)}`,
        file,
        url: URL.createObjectURL(file),
      })),
    ]);
  };
  const removePhoto = (id: string) => {
    setPhotoErrors([]);
    setPhotos((current) => {
      const photo = current.find((p) => p.id === id);
      if (photo) URL.revokeObjectURL(photo.url);
      return current.filter((p) => p.id !== id);
    });
  };
  const makeCover = (id: string) =>
    setPhotos((current) =>
      moveToFront(
        current,
        current.findIndex((p) => p.id === id),
      ),
    );

  // --- Publicar ---
  const publish = async () => {
    if (submitting.current) return;
    // Revalidar todo por si algo cambió al volver a pasos anteriores.
    for (let s = 0; s < LAST; s += 1) {
      const stepErrors = validateStep(s, draft, tree);
      if (hasErrors(stepErrors)) {
        goTo(s);
        setErrors(stepErrors);
        return;
      }
    }
    submitting.current = true;
    setSubmitError(null);
    try {
      const result = await publishListing(
        toListingInput(draft),
        photos.map((p) => p.file),
        setProgress,
      );
      if (result.kind === "published") {
        router.push(result.listing.url_path);
        return;
      }
      const notice =
        result.kind === "photos-failed" ? "fotos-pendientes" : "sin-publicar";
      router.push(`/avisos/${result.listing.id}/editar?aviso=${notice}`);
    } catch (error) {
      submitting.current = false;
      setProgress(null);
      setSubmitError(errorMessage(error));
    }
  };

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (step === LAST) void publish();
    else next();
  };

  const busy = progress !== null;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-4">
        <h1 className="font-heading text-h1 font-semibold text-foreground">
          Publicá tu aviso
        </h1>
        <StepIndicator steps={STEPS} current={step} />
      </div>

      <form
        ref={formRef}
        noValidate
        onSubmit={onSubmit}
        className="flex flex-col gap-6"
        aria-labelledby="wizard-step-title"
      >
        <h2
          id="wizard-step-title"
          ref={headingRef}
          tabIndex={-1}
          className="font-heading text-h2 font-semibold text-foreground focus-visible:outline-none"
        >
          {HEADINGS[step]}
        </h2>

        {step === 0 ? (
          <CategoryStep
            tree={tree}
            loading={treeLoading}
            loadError={treeError}
            onRetry={() => void loadTree()}
            parentId={draft.parentId}
            categoryId={draft.categoryId}
            error={errors.category}
            onPickParent={pickParent}
            onPickCategory={pickCategory}
            onClearParent={() => patch({ parentId: null, categoryId: null })}
          />
        ) : null}
        {step === 1 ? (
          <DetailsFields draft={draft} errors={errors} onChange={patch} />
        ) : null}
        {step === 2 ? (
          <PriceLocationFields draft={draft} errors={errors} onChange={patch} />
        ) : null}
        {step === 3 ? (
          <PhotosStep
            photos={photos}
            errors={photoErrors}
            onAdd={addPhotos}
            onRemove={removePhoto}
            onMakeCover={makeCover}
          />
        ) : null}
        {step === 4 ? (
          <ReviewStep
            draft={draft}
            tree={tree}
            photos={photos}
            onEditStep={goTo}
          />
        ) : null}

        {submitError ? <FormMessage>{submitError}</FormMessage> : null}
        {progress ? (
          <p role="status" className="text-base font-semibold text-foreground">
            {progressText(progress)}
          </p>
        ) : null}

        <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
          {step > 0 ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => goTo(step - 1)}
              disabled={busy}
            >
              <ArrowLeft aria-hidden="true" />
              Atrás
            </Button>
          ) : (
            <span />
          )}
          {step === LAST ? (
            <Button
              type="submit"
              variant="accent"
              size="lg"
              disabled={busy}
              className="flex-1 sm:flex-none"
            >
              {busy ? "Publicando…" : "Publicar aviso"}
            </Button>
          ) : (
            <Button type="submit" className="flex-1 sm:flex-none">
              Siguiente
              <ArrowRight aria-hidden="true" />
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
