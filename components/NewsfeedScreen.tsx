import React from 'react';
import NewsfeedPanel from './NewsfeedPanel';

const NewsfeedScreen: React.FC = () => {
  return (
    <div className="min-h-screen bg-app pb-24">
      <NewsfeedPanel variant="screen" />
    </div>
  );
};

export default NewsfeedScreen;
