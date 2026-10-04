import React from "react";

type Props = {
    open?: boolean;
    size?: number;
    className?: string;
};

const ToggleArrow: React.FC<Props> = ({ open = false, size = 20, className = "" }) => {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={`transform transition-transform duration-200 ${open ? 'rotate-90' : ''} ${className}`}
            aria-hidden
        >
            <path d="M8 5l8 7-8 7" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
};

export default ToggleArrow;
