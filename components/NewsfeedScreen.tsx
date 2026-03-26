import React, { useState } from 'react';
import NewsfeedPanel from './NewsfeedPanel';
import { Screen } from '../types';
import MobilePullToRefresh from './mobile/MobilePullToRefresh';

interface NewsfeedScreenProps {
  currentUserId?: string | null;
  onNavigateToTarget?: (screen: Screen, entityId?: string | null) => void;
  onUnreadCountChange?: (count: number) => void;
}

const NewsfeedScreen: React.FC<NewsfeedScreenProps> = ({ currentUserId, onNavigateToTarget, onUnreadCountChange }) => {
  const [refreshToken, setRefreshToken] = useState(0);

  return (
    <MobilePullToRefresh
      onRefresh={() => setRefreshToken((value) => value + 1)}
      indicatorLabel="Pull to refresh feed"
      className="min-h-full bg-transparent pb-24 xl:pb-10"
    >
      <NewsfeedPanel
        currentUserId={currentUserId}
        variant="screen"
        refreshToken={refreshToken}
        onNavigateToTarget={onNavigateToTarget}
        onUnreadCountChange={onUnreadCountChange}
      />
    </MobilePullToRefresh>
  );
};

export default NewsfeedScreen;
