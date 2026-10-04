import { useState } from "react";
import { fetchAnimUrl as loadAnimationUrl } from "../utils/storageUtils";

export default function useCharacterTransform({
  selectedCharacter,
  setUserCharacters,
  saveCharacter,
  setAnimationUrl,
}: {
  selectedCharacter: any;
  setUserCharacters: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  saveCharacter: (c: any) => Promise<void>;
  setAnimationUrl: (url: string) => void;
}) {
  const [transformPlaying, setTransformPlaying] = useState(false);
  const [transformOverlayUrl, setTransformOverlayUrl] = useState<string | null>(null);

  const transformIndex = typeof selectedCharacter?.transformIndex === "number" ? selectedCharacter.transformIndex : 0;
  const thresholds = selectedCharacter?.transformThresholds ?? [];
  const tempAnims = selectedCharacter?.transformTempAnimations ?? [];
  const finalAnims = selectedCharacter?.transformAnimations ?? [];
  const nextThreshold = thresholds[transformIndex];
  const hasMoreTransforms = transformIndex < thresholds.length;
  const transformReady = !!(
    selectedCharacter &&
    hasMoreTransforms &&
    typeof nextThreshold === "number" &&
    selectedCharacter.level >= nextThreshold
  );
  const controlsDisabled = transformReady || transformPlaying;

  const handleTransform = async () => {
    if (!selectedCharacter) return;
    const tempPath = tempAnims[transformIndex] || selectedCharacter.animation || "";
    try {
      setTransformPlaying(true);
      if (tempPath) {
        console.debug('useCharacterTransform.handleTransform: attempting to load temp animation', { id: selectedCharacter.id, tempPath, transformIndex });
        const url = await loadAnimationUrl(tempPath);
        if (url) {
          setTransformOverlayUrl(url);
        } else {
          console.warn('useCharacterTransform.handleTransform: could not resolve temp animation url', { id: selectedCharacter.id, tempPath, transformIndex });
          // fallback to finalizing if temp animation unavailable
          await finalizeTransform();
        }
      } else {
        // no temp animation, finalize immediately
        await finalizeTransform();
      }
    } catch (err) {
      console.error("Error loading transform temp animation", err);
      await finalizeTransform();
    }
  };

  const finalizeTransform = async () => {
    if (!selectedCharacter) return;
    const finalPath = finalAnims[transformIndex] || selectedCharacter.animation;
    const updated = { ...selectedCharacter, animation: finalPath, transformIndex: transformIndex + 1 } as any;
    setUserCharacters((prev) => ({ ...prev, [updated.id]: updated }));
    try {
      await saveCharacter(updated);
      if (updated.animation) {
        try {
          const url = await loadAnimationUrl(updated.animation);
          setAnimationUrl(url);
        } catch (err) {
          console.warn("Could not load new animation after transform", err);
        }
      }
    } catch (err) {
      console.error("Error finalizing transform", err);
    }
    setTransformOverlayUrl(null);
    setTransformPlaying(false);
  };

  return {
    transformPlaying,
    transformOverlayUrl,
    transformReady,
    controlsDisabled,
    handleTransform,
    finalizeTransform,
    setTransformOverlayUrl,
    setTransformPlaying,
  };
}
