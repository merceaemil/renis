"use client";

import { useEffect, useState } from "react";
import type { GradeClassification } from "@renis/core/grade-classifications";
import { apiFetch } from "@/lib/api";
import { useT } from "@/lib/i18n/LocaleProvider";
import type { TranslationKey } from "@/lib/i18n";

type Settings = {
  id: string;
  code: string;
  name: string;
  gradeClassifications: GradeClassification[];
  logoObjectKey: string | null;
  signatureInstitutionObjectKey: string | null;
  signatureMinistryObjectKey: string | null;
  logoUrl: string | null;
  signatureInstitutionUrl: string | null;
  signatureMinistryUrl: string | null;
  defaults: GradeClassification[];
};

const ASSET_PREVIEW: Record<
  "logo" | "signature-institution" | "signature-ministry",
  { urlKey: keyof Pick<Settings, "logoUrl" | "signatureInstitutionUrl" | "signatureMinistryUrl">; tall?: boolean }
> = {
  logo: { urlKey: "logoUrl" },
  "signature-institution": { urlKey: "signatureInstitutionUrl", tall: true },
  "signature-ministry": { urlKey: "signatureMinistryUrl", tall: true },
};

export function InstitutionSettingsForm({
  institutionId,
  accessToken,
  backHref,
}: {
  institutionId: string;
  accessToken: string;
  backHref: string;
}) {
  const t = useT();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [bands, setBands] = useState<GradeClassification[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);

  const assetLabelKey: Record<
    "logo" | "signature-institution" | "signature-ministry",
    TranslationKey
  > = {
    logo: "settings.asset.logo",
    "signature-institution": "settings.asset.signatureInstitution",
    "signature-ministry": "settings.asset.signatureMinistry",
  };

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const res = await apiFetch(`/api/institutions/${institutionId}/settings`, {
        accessToken,
      });
      if (!res.ok) {
        setError(t("settings.couldNotLoad"));
        setLoading(false);
        return;
      }
      const data: Settings = await res.json();
      setSettings(data);
      setBands(data.gradeClassifications);
      setLoading(false);
    })();
  }, [institutionId, accessToken]);

  async function saveClassifications(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const res = await apiFetch(`/api/institutions/${institutionId}/settings`, {
      method: "PATCH",
      accessToken,
      body: JSON.stringify({ gradeClassifications: bands }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? t("settings.saveFailed"));
      return;
    }
    setBands(data.gradeClassifications);
    setMessage(t("settings.classificationsSaved"));
  }

  async function uploadAsset(
    asset: "logo" | "signature-institution" | "signature-ministry",
    file: File
  ) {
    setUploading(asset);
    setError(null);
    const fd = new FormData();
    fd.append("asset", asset);
    fd.append("file", file);
    const res = await fetch(`/api/institutions/${institutionId}/branding`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: fd,
    });
    const data = await res.json();
    setUploading(null);
    if (!res.ok) {
      setError(data.error ?? t("settings.uploadFailed"));
      return;
    }
    setMessage(t("settings.uploaded", { asset: t(assetLabelKey[asset]) }));
    const preview = ASSET_PREVIEW[asset];
    setSettings((prev) =>
      prev
        ? {
            ...prev,
            [preview.urlKey]: data.previewUrl as string,
            ...(asset === "logo"
              ? { logoObjectKey: data.key as string }
              : asset === "signature-institution"
                ? { signatureInstitutionObjectKey: data.key as string }
                : { signatureMinistryObjectKey: data.key as string }),
          }
        : prev
    );
    const settingsRes = await apiFetch(
      `/api/institutions/${institutionId}/settings`,
      { accessToken }
    );
    if (settingsRes.ok) setSettings(await settingsRes.json());
  }

  function resetDefaults() {
    if (settings) setBands([...settings.defaults]);
  }

  if (loading) return <p className="text-slate-500">{t("common.loading")}</p>;
  if (!settings)
    return <p className="text-red-700">{error ?? t("common.notFound")}</p>;

  return (
    <div className="space-y-8 max-w-3xl">
      <p className="text-sm text-slate-600">
        <a href={backHref} className="text-renis-primary hover:underline">
          {t("common.back")}
        </a>
        {" · "}
        <strong>{settings.name}</strong> ({settings.code})
      </p>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
          {message}
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-medium text-slate-900 mb-2">
          {t("settings.brandingHeading")}
        </h2>
        <p className="text-sm text-slate-600 mb-4">
          {t("settings.brandingHelp")}
        </p>
        <div className="grid gap-4 md:grid-cols-3 text-sm">
          {(
            [
              "logo",
              "signature-institution",
              "signature-ministry",
            ] as const
          ).map((asset) => {
            const label = t(assetLabelKey[asset]);
            const previewUrl = settings[ASSET_PREVIEW[asset].urlKey];
            const tall = ASSET_PREVIEW[asset].tall;
            return (
              <label
                key={asset}
                className="flex flex-col gap-2 rounded-lg border border-dashed border-slate-300 p-3 cursor-pointer hover:bg-slate-50"
              >
                <span className="font-medium text-slate-700">{label}</span>
                <div
                  className={`flex items-center justify-center rounded-md border border-slate-200 bg-slate-50 overflow-hidden ${
                    tall ? "h-28" : "h-24"
                  }`}
                >
                  {previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewUrl}
                      alt={label}
                      className="max-h-full max-w-full object-contain p-2"
                    />
                  ) : (
                    <span className="text-xs text-slate-400 px-2 text-center">
                      {t("settings.noImage")}
                    </span>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="text-xs"
                  disabled={!!uploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadAsset(asset, f);
                    e.target.value = "";
                  }}
                />
                {uploading === asset ? (
                  <span className="text-slate-500">
                    {t("settings.uploading")}
                  </span>
                ) : previewUrl ? (
                  <span className="text-xs text-slate-500">
                    {t("settings.clickToReplace")}
                  </span>
                ) : null}
              </label>
            );
          })}
        </div>
        <p className="text-xs text-slate-500 mt-3">
          {t("settings.ministryHint", {
            var: "MINISTRY_LOGO_OBJECT_KEY",
          })}
        </p>
      </section>

      <form
        onSubmit={(e) => void saveClassifications(e)}
        className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="flex flex-wrap justify-between gap-2 mb-4">
          <h2 className="font-medium text-slate-900">
            {t("settings.classificationsHeading")}
          </h2>
          <button
            type="button"
            onClick={resetDefaults}
            className="text-sm text-renis-primary hover:underline"
          >
            {t("settings.resetDefaults")}
          </button>
        </div>
        <p className="text-sm text-slate-600 mb-4">
          {t("settings.classificationsHelp")}
        </p>
        <div className="space-y-2 mb-4">
          {bands.map((b, i) => (
            <div key={i} className="grid grid-cols-3 gap-2 items-center">
              <input
                type="number"
                step={0.01}
                min={0}
                max={20}
                className="rounded border border-slate-300 px-2 py-1"
                value={b.min}
                onChange={(e) => {
                  const next = [...bands];
                  next[i] = { ...b, min: Number(e.target.value) };
                  setBands(next);
                }}
              />
              <input
                type="number"
                step={0.01}
                min={0}
                max={20}
                className="rounded border border-slate-300 px-2 py-1"
                value={b.max}
                onChange={(e) => {
                  const next = [...bands];
                  next[i] = { ...b, max: Number(e.target.value) };
                  setBands(next);
                }}
              />
              <input
                className="rounded border border-slate-300 px-2 py-1"
                value={b.label}
                onChange={(e) => {
                  const next = [...bands];
                  next[i] = { ...b, label: e.target.value };
                  setBands(next);
                }}
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          className="text-sm text-slate-600 hover:underline mb-4"
          onClick={() =>
            setBands([
              ...bands,
              { min: 0, max: 20, label: t("settings.newBand") },
            ])
          }
        >
          {t("settings.addBand")}
        </button>
        <div>
          <button
            type="submit"
            className="rounded-lg bg-renis-primary px-4 py-2 text-sm text-white hover:opacity-90"
          >
            {t("settings.saveClassifications")}
          </button>
        </div>
      </form>
    </div>
  );
}
