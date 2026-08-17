"use client";

import { useEffect, useState } from "react";

export function ProtectedPhoto({ issueId, accessToken, alt, kind = "report", loadingText = "사진을 불러오는 중…", errorText = "사진을 불러올 수 없습니다." }: { issueId: string; accessToken: string; alt: string; kind?: "report" | "resolution"; loadingText?: string; errorText?: string }) {
  const photoKey = `${issueId}:${kind}`;
  const [result, setResult] = useState<{ issueId: string; url: string | null; failed: boolean }>({
    issueId: "",
    url: null,
    failed: false,
  });

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    void fetch(`/api/issues/${encodeURIComponent(issueId)}/photo${kind === "resolution" ? "?kind=resolution" : ""}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    }).then(async (response) => {
      if (!response.ok) throw new Error("Photo unavailable");
      const nextUrl = URL.createObjectURL(await response.blob());
      if (!active) {
        URL.revokeObjectURL(nextUrl);
        return;
      }
      objectUrl = nextUrl;
      setResult({ issueId: photoKey, url: nextUrl, failed: false });
    }).catch(() => {
      if (active) setResult({ issueId: photoKey, url: null, failed: true });
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [accessToken, issueId, kind, photoKey]);

  if (result.issueId === photoKey && result.failed) return <p className="photo-placeholder">{errorText}</p>;
  if (result.issueId !== photoKey || !result.url) return <div className="photo-placeholder" aria-label={loadingText}>{loadingText}</div>;
  // The authenticated Blob URL is intentionally not sent through Next's image optimizer.
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="issue-photo" src={result.url} alt={alt} />;
}
