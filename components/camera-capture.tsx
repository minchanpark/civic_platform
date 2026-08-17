"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/i18n-provider";

export function CameraCapture({ onCapture, onStatus }: {
  onCapture: (file: File) => void;
  onStatus: (message: string) => void;
}) {
  const { t } = useI18n();
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    if (!navigator.mediaDevices?.getUserMedia) {
      onStatus(t("camera.unsupported"));
      return;
    }
    void navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" } } })
      .then((nextStream) => {
        if (!active) return nextStream.getTracks().forEach((track) => track.stop());
        stream.current = nextStream;
        if (video.current) video.current.srcObject = nextStream;
        setReady(true);
        onStatus(t("camera.ready"));
      })
      .catch(() => onStatus(t("camera.permission")));
    return () => {
      active = false;
      stream.current?.getTracks().forEach((track) => track.stop());
    };
  }, [onStatus, t]);

  const capture = () => {
    const source = video.current;
    if (!source?.videoWidth || !source.videoHeight) return onStatus(t("camera.wait"));
    const canvas = document.createElement("canvas");
    canvas.width = source.videoWidth;
    canvas.height = source.videoHeight;
    canvas.getContext("2d")?.drawImage(source, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return onStatus(t("camera.error"));
      onCapture(new File([blob], `civicpin-${Date.now()}.jpg`, { type: "image/jpeg", lastModified: Date.now() }));
      stream.current?.getTracks().forEach((track) => track.stop());
      setReady(false);
      onStatus(t("camera.captured"));
    }, "image/jpeg", 0.9);
  };

  return (
    <div className="camera-capture">
      <video ref={video} autoPlay muted playsInline aria-label={t("camera.preview")} />
      <button className="button primary" type="button" disabled={!ready} onClick={capture}>{t("report.capture")}</button>
    </div>
  );
}
