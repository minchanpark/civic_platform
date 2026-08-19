"use client";

import Link from "next/link";
import { redirect, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useRef, useState } from "react";
import { CitizenFooter, CitizenHeader } from "@/components/citizen-shell";
import { IssueMap } from "@/components/issue-map";
import { CameraCapture } from "@/components/camera-capture";
import { useAuth } from "@/components/auth-provider";
import { useI18n } from "@/components/i18n-provider";
import { districtAtPosition } from "@/lib/district-boundaries";
import { signInWithPhoneOnly } from "@/lib/supabase/client";
import {
  CITIZEN_AGE_GROUPS,
  CITIZEN_GENDERS,
  CONTACT_EMAIL_PATTERN,
  DISTRICTS,
  TAOYUAN_BOUNDS,
  district as findDistrict,
  issueCategory,
  normalizeCellPhone,
  type CitizenAgeGroup,
  type CitizenGender,
} from "@/lib/issues";
import type { MessageKey } from "@/lib/i18n";

type Position = { latitude: number; longitude: number };
type SubmitResult = {
  issue?: { id: string; ticketNumber: string; status: string; createdAt: string };
  error?: string;
};

type FieldId = "district" | "latitude" | "longitude" | "address" | "realName" | "gender" | "ageGroup" | "cellPhone" | "lineId" | "contactEmail" | "title" | "body" | "photo" | "recurrence";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FIELD_ERROR_KEYS: Record<FieldId, MessageKey> = {
  district: "report.error.district", latitude: "report.error.latitude", longitude: "report.error.longitude", address: "report.error.address",
  realName: "report.error.realName", gender: "report.error.gender", ageGroup: "report.error.ageGroup",
  cellPhone: "report.error.cellPhone", lineId: "report.error.lineId", contactEmail: "report.error.contactEmail",
  title: "report.error.title", body: "report.error.body",
  photo: "report.error.photo", recurrence: "report.error.recurrence",
};

function ReportForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const recurrence = searchParams.get("mode") === "recurrence";
  const sourceParam = searchParams.get("source") ?? "";
  const sourceIssueId = recurrence && UUID.test(sourceParam) ? sourceParam : "";
  const { loading, session, user } = useAuth();
  const phoneVerified = Boolean(user?.phone && user.phone_confirmed_at);
  const { t } = useI18n();
  const category = issueCategory(searchParams.get("category") ?? "")?.id ?? "";
  const queryDistrict = findDistrict(searchParams.get("district") ?? "")?.id;
  const [districtId, setDistrictId] = useState(queryDistrict ?? "");
  const [mapDistrictId, setMapDistrictId] = useState(queryDistrict ?? "");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [addressLookup, setAddressLookup] = useState({ key: "", address: "", loading: false });
  const [realName, setRealName] = useState("");
  const [gender, setGender] = useState<CitizenGender | "">("");
  const [ageGroup, setAgeGroup] = useState<CitizenAgeGroup | "">("");
  const [cellPhoneInput, setCellPhone] = useState("");
  const [lineId, setLineId] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [recurrenceToken, setRecurrenceToken] = useState("");
  const [captureExpiresAt, setCaptureExpiresAt] = useState("");
  const [preparingEvidence, setPreparingEvidence] = useState(false);
  const [evidenceMessage, setEvidenceMessage] = useState(() => t("report.evidencePrompt"));
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [invalidFields, setInvalidFields] = useState<FieldId[]>([]);
  const submissionKey = useRef<string | null>(null);
  const errorSummary = useRef<HTMLDivElement>(null);
  const cellPhone = cellPhoneInput || user?.phone || "";
  if (!category) redirect("/#category-title");
  const latitudeNumber = Number(latitude);
  const longitudeNumber = Number(longitude);
  const mapDistrict = findDistrict(mapDistrictId);
  const position: Position | null = latitude && longitude
    && latitudeNumber >= TAOYUAN_BOUNDS.south && latitudeNumber <= TAOYUAN_BOUNDS.north
    && longitudeNumber >= TAOYUAN_BOUNDS.west && longitudeNumber <= TAOYUAN_BOUNDS.east
    ? { latitude: latitudeNumber, longitude: longitudeNumber }
    : null;
  const positionKey = position ? `${position.latitude.toFixed(6)},${position.longitude.toFixed(6)}` : "";
  const address = addressLookup.key === positionKey ? addressLookup.address : "";
  const addressLoading = addressLookup.key === positionKey && addressLookup.loading;

  const updatePosition = (next: Position) => {
    const nextDistrictId = queryDistrict ?? districtAtPosition(next.latitude, next.longitude) ?? "";
    setLatitude(String(next.latitude));
    setLongitude(String(next.longitude));
    if (!queryDistrict) setDistrictId(nextDistrictId);
    setInvalidFields((fields) => fields.filter((field) => field !== "latitude"
      && field !== "longitude"
      && (field !== "district" || !nextDistrictId)));
  };

  useEffect(() => {
    if (!positionKey) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setAddressLookup({ key: positionKey, address: "", loading: true });
      try {
        const response = await fetch(`/api/geocode?latitude=${encodeURIComponent(latitudeNumber)}&longitude=${encodeURIComponent(longitudeNumber)}`, { signal: controller.signal });
        const result = await response.json() as { address?: string };
        if (!response.ok || !result.address) throw new Error();
        setAddressLookup({ key: positionKey, address: result.address, loading: false });
        setInvalidFields((fields) => fields.filter((field) => field !== "address"));
      } catch {
        if (!controller.signal.aborted) setAddressLookup({ key: positionKey, address: "", loading: false });
      }
    }, 400);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [latitudeNumber, longitudeNumber, positionKey]);

  const selectPhoto = (nextPhoto: File | null) => {
    setPhoto(nextPhoto);
    setInvalidFields((fields) => fields.filter((field) => field !== "photo"));
  };

  const startRecurrenceCapture = async () => {
    const normalizedPhone = normalizeCellPhone(cellPhone);
    if (!normalizedPhone) return setEvidenceMessage(t("report.error.cellPhone"));
    let activeSession = session;
    if (!activeSession || activeSession.user.phone !== normalizedPhone) {
      try {
        activeSession = await signInWithPhoneOnly(normalizedPhone);
      } catch {
        return setEvidenceMessage(t("report.authRequired"));
      }
    }
    if (!activeSession?.user.phone_confirmed_at) return setEvidenceMessage(t("report.authRequired"));
    if (!sourceIssueId) return setEvidenceMessage(t("report.sourceUnavailable"));
    if (!navigator.geolocation) return setEvidenceMessage(t("report.geoUnavailable"));
    setPreparingEvidence(true);
    setEvidenceMessage(t("report.geoChecking"));
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        setLatitude(String(coords.latitude));
        setLongitude(String(coords.longitude));
        const response = await fetch("/api/recurrence-token", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${activeSession.access_token}` },
          body: JSON.stringify({ sourceIssueId, latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy }),
        });
        const result = await response.json() as { token?: string; expiresAt?: string; error?: string };
        if (!response.ok || !result.token || !result.expiresAt) {
          throw new Error(response.status === 403 ? t("report.sourceUnavailable")
            : response.status === 400 ? t("report.outsideSource") : t("report.captureError"));
        }
        setRecurrenceToken(result.token);
        setCaptureExpiresAt(result.expiresAt);
        setPhoto(null);
        setInvalidFields((fields) => fields.filter((field) => field !== "recurrence"));
        setEvidenceMessage(t("report.captureReady"));
      } catch (error) {
        setRecurrenceToken("");
        setCaptureExpiresAt("");
        setEvidenceMessage(error instanceof Error ? error.message : t("report.captureError"));
      } finally {
        setPreparingEvidence(false);
      }
    }, () => {
      setPreparingEvidence(false);
      setEvidenceMessage(t("report.geoPermission"));
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 });
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedPhone = normalizeCellPhone(cellPhone);
    const nextInvalid: FieldId[] = [];
    if (!districtId) nextInvalid.push("district");
    if (!latitude || latitudeNumber < TAOYUAN_BOUNDS.south || latitudeNumber > TAOYUAN_BOUNDS.north) nextInvalid.push("latitude");
    if (!longitude || longitudeNumber < TAOYUAN_BOUNDS.west || longitudeNumber > TAOYUAN_BOUNDS.east) nextInvalid.push("longitude");
    if (!address) nextInvalid.push("address");
    if ([...realName.trim()].length < 1 || [...realName.trim()].length > 100) nextInvalid.push("realName");
    if (!gender) nextInvalid.push("gender");
    if (!ageGroup) nextInvalid.push("ageGroup");
    if (!normalizedPhone) nextInvalid.push("cellPhone");
    if ([...lineId.trim()].length > 50) nextInvalid.push("lineId");
    if (contactEmail.trim() && !CONTACT_EMAIL_PATTERN.test(contactEmail.trim())) nextInvalid.push("contactEmail");
    if ([...title.trim()].length < 5) nextInvalid.push("title");
    if ([...body.trim()].length < 10) nextInvalid.push("body");
    if (!photo) nextInvalid.push("photo");
    if (recurrence && (!recurrenceToken || !captureExpiresAt || new Date(captureExpiresAt).getTime() <= Date.now())) nextInvalid.push("recurrence");
    if (nextInvalid.length) {
      setInvalidFields(nextInvalid);
      setMessage(t("report.errorSummary"));
      requestAnimationFrame(() => errorSummary.current?.focus());
      return;
    }
    if (!position || !photo || !normalizedPhone) return;

    let activeSession = session;
    if (!activeSession || activeSession.user.phone !== normalizedPhone) {
      try {
        activeSession = await signInWithPhoneOnly(normalizedPhone);
      } catch {
        setMessage(t("report.authRequired"));
        return;
      }
    }
    if (!activeSession?.user.phone_confirmed_at || !activeSession.user.phone) {
      setMessage(t("report.authRequired"));
      return;
    }

    const form = new FormData();
    submissionKey.current ??= crypto.randomUUID();
    form.set("submissionKey", submissionKey.current);
    form.set("category", category);
    form.set("districtId", districtId);
    form.set("latitude", String(position.latitude));
    form.set("longitude", String(position.longitude));
    form.set("realName", realName);
    form.set("gender", gender);
    form.set("ageGroup", ageGroup);
    form.set("cellPhone", normalizedPhone);
    form.set("lineId", lineId);
    form.set("contactEmail", contactEmail);
    form.set("title", title);
    form.set("body", body);
    form.set("photo", photo);
    if (recurrence) form.set("recurrenceToken", recurrenceToken);

    setSubmitting(true);
    setMessage(t("report.saving"));
    try {
      const response = await fetch("/api/issues", {
        method: "POST",
        headers: { Authorization: `Bearer ${activeSession.access_token}` },
        body: form,
      });
      const result = await response.json() as SubmitResult;
      if (!response.ok || !result.issue) throw new Error(t("report.submitError"));
      router.push(`/tickets/${encodeURIComponent(result.issue.ticketNumber)}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("report.submitError"));
      setSubmitting(false);
    }
  };

  if (loading) {
    return <main className="centered-page"><p role="status">{t("common.authLoading")}</p></main>;
  }

  const detailFields = (
    <>
      <label>
        {t("report.titleField")} <span className="character-count">{[...title].length}/80</span>
        <input id="title" minLength={5} maxLength={80} required value={title} aria-invalid={invalidFields.includes("title")} aria-describedby={invalidFields.includes("title") ? "title-error" : undefined} onChange={(event) => { setTitle(event.target.value); setInvalidFields((fields) => fields.filter((field) => field !== "title")); }} placeholder={t("report.titlePlaceholder")} />
        {invalidFields.includes("title") && <span id="title-error" className="field-error">{t(FIELD_ERROR_KEYS.title)}</span>}
      </label>
      <label>
        {t("report.bodyField")} <span className="character-count">{[...body].length}/2,000</span>
        <textarea id="body" minLength={10} maxLength={2000} required value={body} aria-invalid={invalidFields.includes("body")} aria-describedby={invalidFields.includes("body") ? "body-error" : undefined} onChange={(event) => { setBody(event.target.value); setInvalidFields((fields) => fields.filter((field) => field !== "body")); }} placeholder={t("report.bodyPlaceholder")} />
        {invalidFields.includes("body") && <span id="body-error" className="field-error">{t(FIELD_ERROR_KEYS.body)}</span>}
      </label>
    </>
  );

  return (
    <main className="citizen-page">
      <CitizenHeader />

      <div className="report-layout page-width">
        <div className="page-intro report-heading">
          <Link className="back-link" href="/">← {t("common.backHome")}</Link>
          <p className="eyebrow">REPORT AN ISSUE</p>
          <h1>{t("report.title")}</h1>
          <p>{t("report.intro")}</p>
        </div>

        <form className="report-form" noValidate onSubmit={(event) => void submit(event)} aria-busy={submitting}>
          {invalidFields.length > 0 && (
            <div ref={errorSummary} className="error-summary" role="alert" tabIndex={-1}>
              <h2>{t("report.errorSummary")}</h2>
              <ul>{invalidFields.map((field) => <li key={field}><a href={`#${field}`}>{t(FIELD_ERROR_KEYS[field])}</a></li>)}</ul>
            </div>
          )}
          <section className="form-section" aria-labelledby="location-label">
            <div className="step-number" aria-hidden="true">1</div>
            <div className="form-section-content">
              <h2 id="location-label">{t("report.location")}</h2>
              <p>{t("report.locationHelp")}</p>
              <label>
                {t("report.district")}
                <select id="district" required value={districtId} disabled={Boolean(queryDistrict)} aria-invalid={invalidFields.includes("district")} aria-describedby={invalidFields.includes("district") ? "district-error" : undefined} onChange={(event) => { setDistrictId(event.target.value); setMapDistrictId(event.target.value); setInvalidFields((fields) => fields.filter((field) => field !== "district")); }}>
                  <option value="">{t("common.select")}</option>
                  {DISTRICTS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
                {invalidFields.includes("district") && <span id="district-error" className="field-error">{t(FIELD_ERROR_KEYS.district)}</span>}
              </label>
              <IssueMap
                draft={position}
                center={mapDistrict}
                zoom={mapDistrict ? 14 : 10}
                onMapClick={recurrence ? undefined : updatePosition}
                onCurrentLocation={updatePosition}
                ariaLabel={t("report.mapAria")}
                currentLocation={{
                  button: t("map.currentLocation"),
                  locating: t("map.locating"),
                  unavailable: t("map.locationUnavailable"),
                  outside: t("map.locationOutside"),
                }}
                locateOnLoad
              />
              <div className="coordinate-grid">
                <label>
                  {t("report.latitude")}
                  <input
                    id="latitude"
                    type="number"
                    min={TAOYUAN_BOUNDS.south}
                    max={TAOYUAN_BOUNDS.north}
                    step="0.000001"
                    required
                    readOnly={recurrence}
                    aria-invalid={invalidFields.includes("latitude")}
                    aria-describedby={invalidFields.includes("latitude") ? "latitude-error" : undefined}
                    value={latitude}
                    onChange={(event) => { setLatitude(event.target.value); setInvalidFields((fields) => fields.filter((field) => field !== "latitude")); }}
                  />
                  {invalidFields.includes("latitude") && <span id="latitude-error" className="field-error">{t(FIELD_ERROR_KEYS.latitude)}</span>}
                </label>
                <label>
                  {t("report.longitude")}
                  <input
                    id="longitude"
                    type="number"
                    min={TAOYUAN_BOUNDS.west}
                    max={TAOYUAN_BOUNDS.east}
                    step="0.000001"
                    required
                    readOnly={recurrence}
                    aria-invalid={invalidFields.includes("longitude")}
                    aria-describedby={invalidFields.includes("longitude") ? "longitude-error" : undefined}
                    value={longitude}
                    onChange={(event) => { setLongitude(event.target.value); setInvalidFields((fields) => fields.filter((field) => field !== "longitude")); }}
                  />
                  {invalidFields.includes("longitude") && <span id="longitude-error" className="field-error">{t(FIELD_ERROR_KEYS.longitude)}</span>}
                </label>
              </div>
              <div id="address" className="selection-note location-summary" role="status" aria-live="polite">
                {position ? (
                  <>
                    <span>{t("report.location")}: {position.latitude.toFixed(5)}, {position.longitude.toFixed(5)}</span>
                    <span><strong>{t("report.address")}:</strong> {addressLoading ? t("report.addressLoading") : address || t("report.addressUnavailable")}</span>
                    <small>{t("report.addressAttribution")} <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a></small>
                  </>
                ) : t("report.locationEmpty")}
                {invalidFields.includes("address") && <span id="address-error" className="field-error">{t(FIELD_ERROR_KEYS.address)}</span>}
              </div>
            </div>
          </section>

          <section className="form-section" aria-labelledby="contact-label">
            <div className="step-number" aria-hidden="true">2</div>
            <div className="form-section-content">
              <h2 id="contact-label">{t("report.citizenInformation")}</h2>
              <p>{t("report.citizenHelp")}</p>
              <div className="privacy-notice">
                <strong>{t("report.privacyTitle")}</strong>
                <p>{t("report.privacy")}</p>
                <p>{t("report.geocodingPrivacy")}</p>
              </div>
              <div className="contact-grid">
                <label>
                  {t("report.realName")}
                  <input id="realName" name="realName" autoComplete="name" maxLength={100} required value={realName} aria-invalid={invalidFields.includes("realName")} aria-describedby={invalidFields.includes("realName") ? "realName-error" : undefined} onChange={(event) => { setRealName(event.target.value); setInvalidFields((fields) => fields.filter((field) => field !== "realName")); }} />
                  {invalidFields.includes("realName") && <span id="realName-error" className="field-error">{t(FIELD_ERROR_KEYS.realName)}</span>}
                </label>
                <label>
                  {t("report.gender")}
                  <select id="gender" name="gender" required value={gender} aria-invalid={invalidFields.includes("gender")} aria-describedby={invalidFields.includes("gender") ? "gender-error" : undefined} onChange={(event) => { setGender(event.target.value as CitizenGender | ""); setInvalidFields((fields) => fields.filter((field) => field !== "gender")); }}>
                    <option value="">{t("common.select")}</option>
                    {CITIZEN_GENDERS.map((value) => <option key={value} value={value}>{t(`report.gender.${value}`)}</option>)}
                  </select>
                  {invalidFields.includes("gender") && <span id="gender-error" className="field-error">{t(FIELD_ERROR_KEYS.gender)}</span>}
                </label>
                <label>
                  {t("report.ageGroup")}
                  <select id="ageGroup" name="ageGroup" required value={ageGroup} aria-invalid={invalidFields.includes("ageGroup")} aria-describedby={invalidFields.includes("ageGroup") ? "ageGroup-error" : undefined} onChange={(event) => { setAgeGroup(event.target.value as CitizenAgeGroup | ""); setInvalidFields((fields) => fields.filter((field) => field !== "ageGroup")); }}>
                    <option value="">{t("common.select")}</option>
                    {CITIZEN_AGE_GROUPS.map((value) => <option key={value} value={value}>{t(`report.age.${value}`)}</option>)}
                  </select>
                  {invalidFields.includes("ageGroup") && <span id="ageGroup-error" className="field-error">{t(FIELD_ERROR_KEYS.ageGroup)}</span>}
                </label>
                <label>
                  {t("report.cellPhone")}
                  <input id="cellPhone" name="cellPhone" type="tel" autoComplete="tel" maxLength={21} required readOnly={phoneVerified} value={cellPhone} placeholder="0912-345-678" aria-invalid={invalidFields.includes("cellPhone")} aria-describedby={invalidFields.includes("cellPhone") ? "cellPhone-error" : undefined} onChange={(event) => { setCellPhone(event.target.value); setInvalidFields((fields) => fields.filter((field) => field !== "cellPhone")); }} />
                  {invalidFields.includes("cellPhone") && <span id="cellPhone-error" className="field-error">{t(FIELD_ERROR_KEYS.cellPhone)}</span>}
                </label>
                <label>
                  {t("report.lineIdOptional")}
                  <input id="lineId" name="lineId" maxLength={50} spellCheck={false} value={lineId} aria-invalid={invalidFields.includes("lineId")} aria-describedby={invalidFields.includes("lineId") ? "lineId-error" : undefined} onChange={(event) => { setLineId(event.target.value); setInvalidFields((fields) => fields.filter((field) => field !== "lineId")); }} />
                  {invalidFields.includes("lineId") && <span id="lineId-error" className="field-error">{t(FIELD_ERROR_KEYS.lineId)}</span>}
                </label>
                <label>
                  {t("report.contactEmailOptional")}
                  <input id="contactEmail" name="contactEmail" type="email" autoComplete="email" maxLength={320} value={contactEmail} aria-invalid={invalidFields.includes("contactEmail")} aria-describedby={invalidFields.includes("contactEmail") ? "contactEmail-error" : undefined} onChange={(event) => { setContactEmail(event.target.value); setInvalidFields((fields) => fields.filter((field) => field !== "contactEmail")); }} />
                  {invalidFields.includes("contactEmail") && <span id="contactEmail-error" className="field-error">{t(FIELD_ERROR_KEYS.contactEmail)}</span>}
                </label>
              </div>
            </div>
          </section>

          <section className="form-section" aria-labelledby="details-label">
            <div className="step-number" aria-hidden="true">3</div>
            <div className="form-section-content">
              <h2 id="details-label">{t("report.details")}</h2>
              {recurrence && (
                <fieldset id="recurrence" className="recurrence-choice" aria-describedby="recurrence-help">
                  <legend>{t("report.recurrence")}</legend>
                  <p id="recurrence-help">{t("report.recurrenceFlow")}</p>
                  {!recurrenceToken && (
                    <button className="button tertiary" type="button" disabled={preparingEvidence || !sourceIssueId} onClick={() => void startRecurrenceCapture()}>
                      {preparingEvidence ? t("report.submitting") : t("report.prepareCamera")}
                    </button>
                  )}
                  <p className="form-message" role="status" aria-live="polite">{evidenceMessage}</p>
                  {invalidFields.includes("recurrence") && <span className="field-error">{t(FIELD_ERROR_KEYS.recurrence)}</span>}
                </fieldset>
              )}
              {recurrence ? (
                <div className="file-field">
                  <strong>{t("report.livePhoto")}</strong>
                  {recurrenceToken ? <CameraCapture key={recurrenceToken} onCapture={selectPhoto} onStatus={setEvidenceMessage} /> : <p id="photo-help">{t("report.cameraPrepareHelp")}</p>}
                  {photo && <small>{photo.name} · {(photo.size / 1024 / 1024).toFixed(1)} MB</small>}
                  {invalidFields.includes("photo") && <span id="photo-error" className="field-error">{t(FIELD_ERROR_KEYS.photo)}</span>}
                </div>
              ) : null}
              {(!recurrence || photo) && detailFields}
              {!recurrence && (
                <fieldset className="file-field">
                  <legend>{t("report.photo")}</legend>
                  <div className="photo-inputs">
                    <label className="button secondary photo-source-button">
                      {t("report.choosePhoto")}
                      <input
                        id="photo"
                        className="visually-hidden"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        aria-invalid={invalidFields.includes("photo")}
                        aria-describedby={invalidFields.includes("photo") ? "photo-error photo-help" : "photo-help"}
                        onChange={(event) => selectPhoto(event.target.files?.[0] ?? null)}
                      />
                    </label>
                    <label className="button secondary photo-source-button">
                      {t("report.takePhoto")}
                      <input
                        id="camera-photo"
                        className="visually-hidden"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        capture="environment"
                        aria-invalid={invalidFields.includes("photo")}
                        aria-describedby={invalidFields.includes("photo") ? "photo-error photo-help" : "photo-help"}
                        onChange={(event) => selectPhoto(event.target.files?.[0] ?? null)}
                      />
                    </label>
                  </div>
                  <small id="photo-help">{photo ? `${photo.name} · ${(photo.size / 1024 / 1024).toFixed(1)} MB` : t("report.photoHelp")}</small>
                  {invalidFields.includes("photo") && <span id="photo-error" className="field-error">{t(FIELD_ERROR_KEYS.photo)}</span>}
                </fieldset>
              )}
            </div>
          </section>

          {(!recurrence || photo) && (
            <div className="submit-bar">
              <button className="button primary" type="submit" disabled={submitting}>
                {submitting ? t("report.submitting") : t("report.submit")}
              </button>
            </div>
          )}
          <p className="form-message" role="status" aria-live="polite">{message}</p>
        </form>
      </div>
      <CitizenFooter />
    </main>
  );
}

export default function ReportPage() {
  return <Suspense fallback={<ReportFallback />}><ReportForm /></Suspense>;
}

function ReportFallback() {
  const { t } = useI18n();
  return <main className="centered-page"><p role="status">{t("report.preparing")}</p></main>;
}
