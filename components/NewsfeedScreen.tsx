import React from 'react';
import NewsfeedPanel from './NewsfeedPanel';
import { Screen } from '../types';

interface NewsfeedScreenProps {
  currentUserId?: string | null;
  onNavigateToTarget?: (screen: Screen, entityId?: string | null) => void;
  onUnreadCountChange?: (count: number) => void;
}

const NewsfeedScreen: React.FC<NewsfeedScreenProps> = ({ currentUserId, onNavigateToTarget, onUnreadCountChange }) => {
  return (
    <div className="min-h-full bg-app pb-24 xl:pb-10">
      <NewsfeedPanel currentUserId={currentUserId} variant="screen" onNavigateToTarget={onNavigateToTarget} onUnreadCountChange={onUnreadCountChange} />
    </div>
  );
};

export default NewsfeedScreen;
