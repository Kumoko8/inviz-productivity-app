import { useState } from "react";
import { storage, db } from "../firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, updateDoc } from "firebase/firestore";

function UploadVideo({ characterId }: { characterId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);

    const fileRef = ref(storage, `animations/${characterId}.mp4`);
    await uploadBytes(fileRef, file);

    const url = await getDownloadURL(fileRef);
    await updateDoc(doc(db, "characters", characterId), { animation: url });

    console.log(url);

    setUploading(false);
    alert("Upload complete!");
  };

  return (
    <div>
      <input type="file" accept="video/mp4" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      <button onClick={handleUpload} disabled={uploading}>
        {uploading ? "Uploading..." : "Upload Video"}
      </button>
    </div>
  );
}

export default UploadVideo;