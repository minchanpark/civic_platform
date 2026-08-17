"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function DistrictQr({ path, alt }: { path: string; alt: string }) {
  const [source, setSource] = useState("");
  useEffect(() => {
    const url = new URL(path, window.location.origin).toString();
    void QRCode.toDataURL(url, { errorCorrectionLevel: "M", margin: 2, width: 220 })
      .then(setSource)
      .catch(() => setSource(""));
  }, [path]);
  if (!source) return <div className="qr-placeholder" role="status">QR…</div>;
  // Generated locally from the visible report URL; no third-party image request is made.
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="district-qr" src={source} alt={alt} width={220} height={220} />;
}
