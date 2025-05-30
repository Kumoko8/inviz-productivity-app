interface SkillItemProps {
  name: string;
  progress: number;
  onProgressUpdate: (newProgress: number) => void;
  onMaster: () => void;
}

const SkillItem: React.FC<SkillItemProps> = ({ name, progress, onProgressUpdate, onMaster }) => {
  const handleClick = () => {
    const newProgress = Math.min(progress + 10, 100);
    onProgressUpdate(newProgress);
    if (newProgress === 100) onMaster();
    
  };

  return (
    <div className="flex flex-col gap-2 p-2 border rounded-md bg-white">
      <h4 className="text-md font-semibold">{name}</h4>
      <div className="w-full h-4 bg-gray-200 rounded">
        <div
          className="h-full bg-green-500 rounded transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      <button
        onClick={handleClick}
        className="px-2 py-1 mt-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        {progress < 100 ? "Increase Progress" : "Mark as Mastered"}
      </button>
    </div>
  );
};
export default SkillItem;
