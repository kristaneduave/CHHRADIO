import React from 'react';
import NewsfeedPanel from './NewsfeedPanel';

interface NotificationCenterProps {
  onClose: () => void;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end p-4 sm:p-6 bg-app/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-surface border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in slide-in-from-right-10 duration-300">
        <NewsfeedPanel variant="modal" onClose={onClose} />
      </div>
    </div>
  );
};

export default NotificationCenter;
