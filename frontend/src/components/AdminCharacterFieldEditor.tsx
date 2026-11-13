import React, { useEffect, useState } from "react";
import {
  describeFirestoreValue, isJsonValue, readCharacterFields, writeCharacterField,
  type CharacterDocumentTarget,
} from "../services/adminCharacterFields";

const ARRAY_FIELDS = [
  { key: "transformThresholds", label: "Transformation thresholds", kind: "number" },
  { key: "transformAnimations", label: "Form animations", kind: "string" },
  { key: "transformTempAnimations", label: "Transformation animations", kind: "string" },
  { key: "actionAnimations", label: "Action animations", kind: "string" },
  { key: "woundedAnimations", label: "Wounded animations", kind: "string" },
  { key: "damageAnimations", label: "Damage animations", kind: "string" },
  { key: "defeatAnimations", label: "Defeat animations", kind: "string" },
] as const;

type Props = {
  target: CharacterDocumentTarget;
  previewValues: Record<string, unknown>;
  onSaved: (target: CharacterDocumentTarget, field: string, value: unknown) => void;
};

const AdminCharacterFieldEditor: React.FC<Props> = ({ target, previewValues, onSaved }) => {
  const [document, setDocument] = useState<Record<string, unknown> | null>(null);
  const [field, setField] = useState(ARRAY_FIELDS[0].key as string);
  const [newField, setNewField] = useState("");
  const [entries, setEntries] = useState<string[]>([]);
  const [json, setJson] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reload, setReload] = useState(0);
  const targetKey = target.kind === "base" ? `base:${target.id}` : `custom:${target.uid}:${target.id}`;

  useEffect(() => {
    let active = true;
    setDocument(null);
    setError(null);
    setMessage(null);
    setField(ARRAY_FIELDS[0].key);
    readCharacterFields(target).then(data => {
      if (active) setDocument(data);
    }).catch(err => {
      console.error("Could not load character document", err);
      if (active) setError("Could not load the character document. Please try again.");
    });
    return () => { active = false; };
  }, [targetKey, reload]);

  const arrayField = ARRAY_FIELDS.find(item => item.key === field);
  const value = document && Object.prototype.hasOwnProperty.call(document, field) ? document[field] : undefined;
  const arrayEditable = arrayField && (value === undefined || (
    Array.isArray(value) && value.every(item =>
      arrayField.kind === "string" ? typeof item === "string" : typeof item === "number" && Number.isFinite(item)
    )
  ));
  const editable = value === undefined || isJsonValue(value);
  const previewValue = previewValues[field];
  const hasPreviewArray = arrayField && Array.isArray(previewValue) && previewValue.length > 0 && previewValue.every(item =>
    arrayField.kind === "string" ? typeof item === "string" : typeof item === "number" && Number.isFinite(item)
  );

  useEffect(() => {
    const current = document && Object.prototype.hasOwnProperty.call(document, field) ? document[field] : undefined;
    setEntries(Array.isArray(current) ? current.map(String) : []);
    setJson(current === undefined ? "null" : isJsonValue(current) ? JSON.stringify(current, null, 2) : "");
    setError(null);
  }, [document, field]);

  const save = async () => {
    if (!document || !field || !editable || saving) return;
    let next: unknown;
    if (arrayEditable) {
      if (arrayField.kind === "number") {
        if (entries.some(entry => !/^\d+$/.test(entry.trim()) || !Number.isSafeInteger(Number(entry)) || Number(entry) < 1)) {
          setError("Thresholds must be positive whole numbers.");
          return;
        }
        next = entries.map(Number);
      } else {
        next = entries.map(entry => entry.trim());
      }
    } else {
      try {
        next = JSON.parse(json);
        if (!isJsonValue(next)) throw new Error("Not a JSON value");
      } catch {
        setError("Enter a valid JSON value.");
        return;
      }
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await writeCharacterField(target, field, next);
      setDocument(prev => prev ? { ...prev, [field]: next } : prev);
      onSaved(target, field, next);
      setMessage("Saved. Reload the dashboard to apply all changes to character data.");
    } catch (err) {
      console.error("Could not save character field", err);
      setError("Could not save this field. Check your connection and permissions, then try again.");
    } finally {
      setSaving(false);
    }
  };

  const otherFields = document ? Object.keys(document).filter(key => !ARRAY_FIELDS.some(item => item.key === key)).sort() : [];

  return (
    <div className="mt-4 border rounded p-3 text-left">
      <h4 className="font-semibold">Edit character document</h4>
      <p className="text-xs text-gray-600 mt-1">
        {target.kind === "base"
          ? "Shared base document: changes can affect other users. Existing per-character overrides may take precedence."
          : "Custom character document in your account only."}
        {" "}Document ID: {target.id}
      </p>
      {error && <p role="alert" className="text-sm text-red-700 mt-2">{error}</p>}
      {!document && (
        <button type="button" onClick={() => setReload(n => n + 1)} className="mt-2 text-sm underline">
          {error ? "Retry loading" : "Loading document..."}
        </button>
      )}
      {document && (
        <>
          <label className="block text-sm mt-3" htmlFor="admin-character-field">Field</label>
          <select id="admin-character-field" value={field} disabled={saving} onChange={e => { setField(e.target.value); setMessage(null); }} className="w-full border rounded px-2 py-1">
            {ARRAY_FIELDS.map(item => <option key={item.key} value={item.key}>{item.label} ({item.key})</option>)}
            {otherFields.map(key => <option key={key} value={key}>{key}</option>)}
            {field && !ARRAY_FIELDS.some(item => item.key === field) && !otherFields.includes(field) && <option value={field}>{field} (new)</option>}
          </select>
          {arrayEditable ? (
            <div className="mt-2">
              <p className="text-xs text-gray-600">Entries are ordered by form. Removing an entry shifts later entries; use an empty path to preserve a slot.</p>
              {value === undefined && hasPreviewArray && (
                <div className="mt-2 text-xs text-gray-600">
                  This field is not saved in this document; the preview uses fallback values.{" "}
                  <button type="button" disabled={saving} onClick={() => setEntries(previewValue.map(String))} className="underline">Copy preview values</button>
                </div>
              )}
              {entries.map((entry, index) => (
                <div key={index} className="flex items-center gap-2 mt-2">
                  <label htmlFor={`admin-character-entry-${index}`} className="text-sm w-8">{index + 1}</label>
                  <input id={`admin-character-entry-${index}`} value={entry} disabled={saving} type={arrayField.kind === "number" ? "number" : "text"} min={arrayField.kind === "number" ? 1 : undefined}
                    onChange={e => setEntries(prev => prev.map((v, i) => i === index ? e.target.value : v))}
                    className="min-w-0 flex-1 border rounded px-2 py-1 text-sm" placeholder={arrayField.kind === "string" ? "Storage path" : "Level"} />
                  <button type="button" disabled={saving} onClick={() => setEntries(prev => prev.filter((_, i) => i !== index))} aria-label={`Remove entry ${index + 1}`} className="text-sm text-red-700 underline">Remove</button>
                </div>
              ))}
              <button type="button" disabled={saving} onClick={() => setEntries(prev => [...prev, ""])} className="mt-2 text-sm underline">Add entry</button>
            </div>
          ) : editable ? (
            <>
              <label htmlFor="admin-character-json" className="block text-sm mt-2">JSON value</label>
              <textarea id="admin-character-json" value={json} disabled={saving} onChange={e => setJson(e.target.value)} rows={6} className="w-full border rounded p-2 font-mono text-sm" />
            </>
          ) : (
            <div className="mt-2">
              <p className="text-sm text-amber-700">This field contains a Firestore-specific value and is read-only here.</p>
              <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded bg-gray-100 p-2 text-xs">{JSON.stringify(describeFirestoreValue(value), null, 2)}</pre>
            </div>
          )}
          <div className="mt-3 flex gap-2 items-center">
            <button type="button" disabled={!editable || saving} onClick={save} className="px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-50">{saving ? "Saving..." : "Save field"}</button>
            {message && <span role="status" className="text-xs text-green-700">{message}</span>}
          </div>
          <div className="mt-4 border-t pt-2">
            <label htmlFor="admin-character-new-field" className="block text-sm">Add a field</label>
            <div className="flex gap-2">
              <input id="admin-character-new-field" value={newField} disabled={saving} onChange={e => setNewField(e.target.value)} className="min-w-0 flex-1 border rounded px-2 py-1 text-sm" />
              <button type="button" disabled={saving} onClick={() => {
                const name = newField.trim();
                if (!name) { setError("Enter a field name."); return; }
                if (Object.prototype.hasOwnProperty.call(document, name)) { setError("That field already exists. Select it above to edit it."); return; }
                setField(name);
                setNewField("");
                setError(null);
              }} className="px-2 py-1 border rounded text-sm">Edit new field</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminCharacterFieldEditor;
