"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { formValues, sendJson } from "@/lib/api/client";

type Request = { method: "POST" | "PATCH" | "DELETE"; path: string; body?: unknown };

/**
 * Submits a modal's form to the worker through /api, then re-renders the page with fresh server
 * data and closes the modal. `build` turns the form's named fields into the request.
 */
export function useFormSubmit(
  onDone: () => void,
  build: (values: Record<string, string>, form: HTMLFormElement) => Request,
) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const request = build(formValues(event.currentTarget), event.currentTarget);
      await sendJson(request.method, request.path, request.body);
      router.refresh();
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return { onSubmit, error, saving };
}
