import { useEffect, useRef, useState } from "react";

type Service = {
  title: string;
  description: string;
  pricing: string;
  timeline: string;
  sessions: string;
  color: string;
};

const services: Service[] = [
  {
    title: "Test Prep",
    description: "Targeted ACT test preparation that builds both content knowledge and test-day confidence.",
    timeline: "Recommended 6-12 weeks before your ACT test date.",
    sessions: "6 sessions: Diagnostic, Data-based practice, pacing practice, practice test, feedback & next steps.",
    pricing: "$320 online / $400 in-person",
    color: "border-cyan-400",
  },
  {
    title: "Math Tutoring",
    description: "Clear, confidence-building support from foundational skills through advanced coursework.",
    timeline: "Ongoing weekly sessions or focused support for an upcoming unit.",
    sessions: "One-on-one instruction tailored to current coursework, learning style, and goals.",
    pricing: "$60/online session / $80 in-person session",
    color: "border-yellow-400",
  },
  {
    title: "Science Tutoring",
    description: "Concept-first science tutoring that makes complex material feel connected and manageable.",
    timeline: "Flexible support for a course, project, or assessment cycle.",
    sessions: "Visual explanations, guided problem solving, and practice that turns concepts into working knowledge.",
    pricing: "$60/online / $80 in-person",
    color: "border-fuchsia-400",
  },
  {
    title: "Drawing Course",
    description: "A structured course for developing observation, technique, and a personal visual voice.",
    timeline: "A paced multi-session course with room for independent practice.",
    sessions: "Demonstrations, guided exercises, constructive feedback, and a portfolio of finished work.",
    pricing: "$60/online / $80 in-person",
    color: "border-green-400",
  },
];

export default function Services() {
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [showBookingPopup, setShowBookingPopup] = useState(false);
  const [copied, setCopied] = useState(false);
  const detailsRef = useRef<HTMLElement>(null);
  const contactEmail = "tauen8@gmail.com";

  useEffect(() => {
    if (!selectedService) return;

    detailsRef.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
  }, [selectedService]);

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(contactEmail);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy email", err);
    }
  };

  return (
    <main className="min-h-screen bg-black px-6 py-12 text-white md:px-12 md:py-20">
      <section className="mx-auto max-w-6xl">
        <div className="mb-10 max-w-2xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Tutoring Services</p>
          <h1 className="text-4xl font-extrabold text-yellow-300 md:text-6xl">Personalized learning</h1>
          <p className="mt-4 text-lg leading-8 text-gray-300">
            Select an offering to see the structure behind each session.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {services.map((service) => {
            const isSelected = selectedService === service.title;

            return (
              <button
                key={service.title}
                type="button"
                aria-expanded={isSelected}
                onClick={() => setSelectedService(isSelected ? null : service.title)}
                className={`min-h-48 border-t-4 bg-gray-900 p-6 text-left transition-colors hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black ${service.color} ${isSelected ? "bg-gray-800" : ""}`}
              >
                <span className="text-xl font-bold text-white">{service.title}</span>
                <span className="mt-4 block leading-6 text-gray-300">{service.description}</span>
                <span className="mt-6 block text-sm font-semibold text-cyan-300">
                  {isSelected ? "Hide details" : "View details"}
                </span>
              </button>
            );
          })}
        </div>

        {selectedService && (
          <section ref={detailsRef} className="mt-6 border border-gray-700 bg-gray-900 p-6 md:p-8" aria-live="polite">
            {services.filter((service) => service.title === selectedService).map((service) => (
              <div key={service.title}>
                <h2 className="text-2xl font-bold text-white">{service.title}</h2>
                <div className="mt-6 grid gap-6 md:grid-cols-3">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-fuchsia-300">Timeline</h3>
                    <p className="mt-2 leading-6 text-gray-300">{service.timeline}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-fuchsia-300">Session approach</h3>
                    <p className="mt-2 leading-6 text-gray-300">{service.sessions}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-fuchsia-300">Pricing</h3>
                    <p className="mt-2 leading-6 text-gray-300">{service.pricing}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBookingPopup(true)}
                  className="mt-8 inline-flex bg-cyan-300 px-5 py-3 font-semibold text-black transition-colors hover:bg-cyan-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black"
                >
                  Book first session
                </button>
              </div>
            ))}
          </section>
        )}

        {showBookingPopup && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
            onClick={() => setShowBookingPopup(false)}
          >
            <div
              className="w-full max-w-sm border border-gray-700 bg-gray-900 p-6"
              onClick={(event) => event.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-white">Book your first session</h3>
              <p className="mt-2 text-sm leading-6 text-gray-300">Email me to get started:</p>
              <div className="mt-4 flex items-center gap-2 border border-gray-700 bg-black px-3 py-2">
                <span className="flex-1 truncate text-sm text-cyan-300">{contactEmail}</span>
                <button
                  type="button"
                  onClick={copyEmail}
                  className="shrink-0 bg-cyan-300 px-3 py-1 text-xs font-semibold text-black transition-colors hover:bg-cyan-200"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setShowBookingPopup(false)}
                className="mt-6 text-sm font-semibold text-gray-400 transition-colors hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}