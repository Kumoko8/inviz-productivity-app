export type GroupSkillImportCandidate = {
  characterId: string;
  characterName: string;
  skills: any[];
};

type Props = {
  group: string;
  candidates: GroupSkillImportCandidate[];
  onImport: () => void;
  onSkip: () => void;
};

export default function GroupSkillImportDialog({ group, candidates, onImport, onSkip }: Props) {
  const totalSkills = candidates.reduce((total, candidate) => total + candidate.skills.length, 0);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="group-skill-import-title"
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
      >
        <h2 id="group-skill-import-title" className="text-lg font-semibold text-gray-900">
          Import common skills?
        </h2>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          Add skills shared by existing characters in “{group}” to the newly assigned character{candidates.length === 1 ? '' : 's'}?
          Existing skills will be left unchanged.
        </p>
        <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-sm text-gray-700">
          {candidates.map(candidate => (
            <li key={candidate.characterId}>
              {candidate.characterName}: {candidate.skills.length} skill{candidate.skills.length === 1 ? '' : 's'}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-gray-500">
          {totalSkills} missing skill{totalSkills === 1 ? '' : 's'} will be added, including their subskills.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onSkip} className="rounded bg-gray-200 px-3 py-2 text-sm text-gray-800 hover:bg-gray-300">
            No, thanks
          </button>
          <button type="button" onClick={onImport} className="rounded bg-cyan-600 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-700">
            Import skills
          </button>
        </div>
      </section>
    </div>
  );
}
