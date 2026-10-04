import React, { useState, useEffect, useRef } from "react";
import ToggleArrow from "./ToggleArrow";
import { auth } from "../firebase";
import { updateUserCharacter } from "../services/characterService";

interface CharacterTextFieldProps {
  selectedCharacter: any | null;
  disabled?: boolean;
}

const CharacterTextField: React.FC<CharacterTextFieldProps> = ({ selectedCharacter, disabled = false }) => {
  const [user, setUser] = useState(auth.currentUser);
  const [text, setText] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep user synced
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => setUser(u));
    return unsubscribe;
  }, []);

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }
  };

  // Load notes when character changes
  useEffect(() => {
    // prefer notes stored on the selectedCharacter doc (per-character); fallback to empty
    if (!user || !selectedCharacter) return;
    setText(selectedCharacter.notes || "");
  }, [user, selectedCharacter]);

  // Auto-save with debounce
  useEffect(() => {
    if (!user || !selectedCharacter) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      if (!user || !selectedCharacter || !selectedCharacter.id) return;
      try {
        await updateUserCharacter(user.uid, selectedCharacter.id, { notes: text });
      } catch (err) {
        console.error('CharacterTextField: failed to save notes', err);
      }
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [text, user, selectedCharacter]);

  useEffect(() => adjustHeight(), [text]);

  if (!selectedCharacter) return null;

  return (
    <div className="w-full max-w-md bg-white rounded-lg shadow-md p-4 border border-cyan-200">
      <button
        onClick={() => setShowNotes((prev) => !prev)}
        aria-label={showNotes ? "Hide notes" : "Show notes"}
        className="p-1 bg-white rounded-full w-9 h-9 flex items-center justify-center shadow hover:bg-gray-100"
      >
        <ToggleArrow open={showNotes} size={18} />
      </button>

      <label className="block font-semibold mb-2">Notes</label>

      {showNotes && (
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={1}
          disabled={disabled}
          className="w-full border rounded-md p-2 resize-none focus:outline-none focus:ring-2 focus:ring-cyan-400 overflow-hidden"
          placeholder="Type your notes here..."
        />
      )}
    </div>
  );
};

export default CharacterTextField;