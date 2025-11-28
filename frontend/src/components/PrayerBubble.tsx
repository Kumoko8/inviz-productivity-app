import React, { useState, useEffect } from "react";
import { Prayer } from "../types/character";
import {
    getPrayers,
    addPrayer,
    updatePrayer
} from "../services/prayerService";
import { auth } from "../firebase";

const colors = [
    "#7dd3fc",
    "#fda4af",
    "#a5b4fc",
    "#fcd34d",
    "#86efac",
    "#f9a8d4",
    "#c4b5fd"
];

// simple contrast helper: returns black or white depending on background color
function getContrastColor(hexColor: string) {
    if (!hexColor) return "#000";
    // strip #
    const hex = hexColor.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    // relative luminance formula
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return luminance > 0.6 ? "#000" : "#fff";
}

const PrayerBubble: React.FC = () => {
    const user = auth.currentUser;

    const [open, setOpen] = useState(false);
    const [prayers, setPrayers] = useState<Prayer[]>([]);

    // For creating NEW prayers
    const [text, setText] = useState("");
    const [color, setColor] = useState(colors[0]);

    // For EDITING an existing prayer
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingText, setEditingText] = useState("");
    const [editingColor, setEditingColor] = useState(colors[0]);

    // Load prayers from Firestore
    useEffect(() => {
        if (!user) return;
        getPrayers(user.uid).then(setPrayers);
    }, [user]);

    const handleSubmit = async () => {
        if (!user) return;

        // Updating existing prayer
        if (editingId) {
            await updatePrayer(user.uid, editingId, {
                text: editingText,
                color: editingColor
            });
            // Adding NEW prayer
        } else {
            if (!text.trim()) return;
            await addPrayer(user.uid, text, color);
        }

        // Refresh list
        const updated = await getPrayers(user.uid);
        setPrayers(updated);

        // Reset fields
        setText("");
        setColor(colors[0]);
        setEditingId(null);
        setEditingText("");
        setEditingColor(colors[0]);
    };

    // Which text/color should the input be tied to?
    const currentText = editingId ? editingText : text;
    const currentColor = editingId ? editingColor : color;
    const currentTextColor = getContrastColor(currentColor);

    return (
        <div className="w-full max-w-md mt-6">
            {/* Toggle button */}
            <button
                className="px-3 py-1 bg-purple-500 text-white rounded-md mb-3"
                onClick={() => setOpen(!open)}
            >
                {open ? " Prayers ▾ " : "Prayers ▸"}
            </button>

            {open && (
                <div className="p-4 border rounded-md bg-white shadow-md">
                    {/* Input - textarea background changes instantly to selected color */}
                    <textarea
                        className="w-full border p-2 rounded"
                        placeholder="Write your prayer..."
                        value={currentText}
                        onChange={(e) =>
                            editingId ? setEditingText(e.target.value) : setText(e.target.value)
                        }
                        style={{
                            background: currentColor,
                            color: currentTextColor,
                            transition: "background-color 150ms linear, color 150ms linear"
                        }}
                        rows={4}
                    />

                    {/* Color picker */}
                    <div className="flex gap-2 my-2">
                        {colors.map((c) => (
                            <div
                                key={c}
                                onClick={() => {
                                    // change the appropriate color state immediately
                                    editingId ? setEditingColor(c) : setColor(c);
                                }}
                                className="w-6 h-6 rounded-full cursor-pointer border"
                                style={{ background: c }}
                            />
                        ))}
                    </div>

                    {/* Add / Update button */}
                    <div className="flex items-center gap-3">
                        <button
                            className="px-3 py-1 bg-cyan-500 text-white rounded"
                            onClick={handleSubmit}
                        >
                            {editingId ? "Update Prayer" : "Add Prayer"}
                        </button>

                        {/* small preview bubble so user sees chosen color aside from background */}
                        <div
                            className="w-8 h-8 rounded-full shadow"
                            style={{ background: currentColor }}
                            aria-hidden
                        />
                    </div>

                    {/* Floating bubbles */}
                    <div className="flex flex-wrap gap-3 mt-4">
                        {prayers.map((p) => (
                            <div
                                key={p.id}
                                onClick={() => {
                                    setEditingId(p.id);
                                    setEditingText(p.text);
                                    setEditingColor(p.color);
                                }}
                                title={p.text}
                                className="w-10 h-10 rounded-full cursor-pointer shadow prayer-float"
                                style={{ background: p.color, animationDelay: `${(Math.random() * 2).toFixed(2)}s` }}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PrayerBubble;