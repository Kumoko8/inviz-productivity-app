export default function Contact() {
  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white md:px-12 md:py-24">
      <section className="mx-auto max-w-3xl border-t-4 border-cyan-400 bg-gray-900 p-8 md:p-12">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Contact</p>
        <h1 className="mt-4 text-3xl font-extrabold text-yellow-300 md:text-5xl">Taylor Golden</h1>
        <a
          className="mt-6 inline-block text-lg text-white underline decoration-cyan-300 underline-offset-4 hover:text-cyan-200"
          href="mailto:tauen8@gmail.com"
        >
          tauen8@gmail.com
        </a>
      </section>
    </main>
  );
}
