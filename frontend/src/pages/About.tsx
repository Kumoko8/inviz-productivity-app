import { useEffect, useState } from "react";
import { getDownloadURL, listAll, ref } from "firebase/storage";
import { storage } from "../firebase";

const profile = {
  name: "Taylor Golden",
  experience: "9 years of teaching/tutoring experience 6 - 12th grade",
  expertise: ["Test Prep", "Math", "Science", "Art", "Language"],
  bio: "I was a first year teacher in Memphis, struggling trying to find a way to make lessons come alive. What I envisioned in my mind about how to organize and communicate information wasn't translating well using only a word document. Meanwhile, my students needed confidence. Over time, I developed systems to demonstrate and celebrate growth, while also telling a story, which is what NVZ (No Visible Zenith) is all about. The things we can't see have such a huge impact on what we experience every day.",
};

export default function About() {
  const [imageUrl, setImageUrl] = useState("");
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadAboutImage() {
      try {
        const result = await listAll(ref(storage, "about"));
        const firstImage = result.items.find((item) =>
          /\.(avif|gif|jpe?g|png|webp)$/i.test(item.name)
        );

        if (firstImage && !cancelled) {
          setImageUrl(await getDownloadURL(firstImage));
        }
      } catch (error) {
        console.warn("Could not load image from the about/ folder", error);
      }
    }

    loadAboutImage();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen bg-black px-6 py-12 text-white md:px-12 md:py-20">
      <section className="mx-auto grid max-w-6xl gap-10 md:grid-cols-3 md:items-center md:gap-14">
        <div className="aspect-[3/4] overflow-hidden rounded-lg bg-gray-900">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={`${profile.name} portrait`}
              className={`h-full w-full object-cover transition-opacity duration-500 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
              onLoad={() => setImageLoaded(true)}
            />
          ) : (
            <div className="h-full w-full animate-pulse bg-gray-800" aria-label="Loading portrait" />
          )}
        </div>

        <div className="md:col-span-2">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">About</p>
          <h1 className="text-4xl font-extrabold text-yellow-300 md:text-6xl">{profile.name}</h1>
          <p className="mt-4 text-lg text-gray-300">{profile.experience}</p>

          <div className="mt-8 border-l-2 border-fuchsia-400 pl-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-fuchsia-300">Expertise</h2>
            <p className="mt-2 text-xl text-white">{profile.expertise.join(" · ")}</p>
          </div>

          <p className="mt-8 max-w-2xl text-lg leading-8 text-gray-300">{profile.bio}</p>
        </div>
      </section>
    </main>
  );
}