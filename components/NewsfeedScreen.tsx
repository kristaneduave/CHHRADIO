import React from 'react';
import NewsfeedPanel from './NewsfeedPanel';
import { Screen } from '../types';

interface NewsfeedScreenProps {
  onNavigateToTarget?: (screen: Screen, entityId?: string | null) => void;
  onUnreadCountChange?: (count: number) => void;
}

const NewsfeedScreen: React.FC<NewsfeedScreenProps> = ({ onNavigateToTarget, onUnreadCountChange }) => {
  return (
    <div className="min-h-full bg-app pb-24 xl:pb-10">
      <NewsfeedPanel variant="screen" onNavigateToTarget={onNavigateToTarget} onUnreadCountChange={onUnreadCountChange} />
    </div>
  );
};

export default NewsfeedScreen;
