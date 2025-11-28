import React, { useState, useEffect, useRef } from "react";
import { auth, db } from "../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

interface CharacterTextFieldProps {
  selectedCharacter: { name: string } | null;
}

const CharacterTextField: React.FC<CharacterTextFieldProps> = ({ selectedCharacter }) => {
  const [user, setUser] = useState(auth.currentUser);
  const [text, setText] = useState("");
  const [showNotes, setShowNotes] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

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
    const fetchText = async () => {
      if (!user || !selectedCharacter) return;

      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);

      const characterNotes = snap.exists() ? snap.data().characterNotes || {} : {};
      setText(characterNotes[selectedCharacter.name] || "");
    };

    fetchText();
  }, [user, selectedCharacter]);

  // Auto-save with debounce
  useEffect(() => {
    if (!user || !selectedCharacter) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);

      const characterNotes = snap.exists() ? snap.data().characterNotes || {} : {};
      characterNotes[selectedCharacter.name] = text;

      await setDoc(ref, { characterNotes }, { merge: true });
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [text, user, selectedCharacter]);

  useEffect(() => adjustHeight(), [text]);

  if (!selectedCharacter) return null;

  return (
    <div className="w-full max-w-md bg-white rounded-lg shadow-md p-4 border border-cyan-200">
      <button className="collapse-btn" onClick={() => setShowNotes((prev) => !prev)}>
        {showNotes ? "▾" : "▸"}
      </button>

      <label className="block font-semibold mb-2">Notes</label>

      {showNotes && (
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={1}
          className="w-full border rounded-md p-2 resize-none focus:outline-none focus:ring-2 focus:ring-cyan-400 overflow-hidden"
          placeholder="Type your notes here..."
        />
      )}
    </div>
  );
};

export default CharacterTextField;