import React from 'react';
import NewsfeedPanel from './NewsfeedPanel';
import { Screen } from '../types';

interface NewsfeedScreenProps {
  onNavigateToTarget?: (screen: Screen, entityId?: string | null) => void;
}

const NewsfeedScreen: React.FC<NewsfeedScreenProps> = ({ onNavigateToTarget }) => {
  return (
    <div className="min-h-screen bg-app pb-24">
      <NewsfeedPanel variant="screen" onNavigateToTarget={onNavigateToTarget} />
    </div>
  );
};

export default NewsfeedScreen;
