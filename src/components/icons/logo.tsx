import React from 'react';

export const Logo = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 100 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 0L0 21.6H8L12 14.4L16 21.6H24L12 0Z"
      className="text-primary"
    />
    <text
      x="28"
      y="18"
      fontFamily="Inter, sans-serif"
      fontSize="18"
      fontWeight="bold"
      className="fill-current text-foreground"
    >
      Aktvia
    </text>
  </svg>
);
