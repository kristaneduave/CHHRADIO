import React from 'react';

interface LoadingLogoProps {
  sizeClass?: string;
  className?: string;
}

const LoadingLogo: React.FC<LoadingLogoProps> = ({ sizeClass = 'h-12 w-12', className = '' }) => {
  return (
    <img
      src="/logo-radcore.svg"
      alt="Loading"
      className={`${sizeClass} object-contain logo-flicker ${className}`.trim()}
      draggable={false}
    />
  );
};

export default LoadingLogo;
