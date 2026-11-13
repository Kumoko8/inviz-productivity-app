import React from "react";
import Tooltip from "@mui/material/Tooltip";

const SkipTransformAnimationButton: React.FC<{ onSkip: () => void; disabled?: boolean }> = ({ onSkip, disabled }) => (
  <Tooltip title="The transformation will be applied immediately and cannot be undone." describeChild>
    <button
      onClick={() => { if (!disabled) onSkip(); }}
      aria-disabled={disabled || undefined}
      className="px-4 py-2 bg-gray-700 hover:bg-gray-800 aria-disabled:opacity-50 text-white rounded"
    >
      Skip animation
    </button>
  </Tooltip>
);

export default SkipTransformAnimationButton;
