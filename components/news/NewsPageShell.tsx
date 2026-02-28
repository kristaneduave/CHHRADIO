import React from 'react';

interface NewsPageShellProps {
  title: string;
  headerAction?: React.ReactNode;
  searchFilterBar: React.ReactNode;
  topUtilityRegion?: React.ReactNode;
  feedRegion: React.ReactNode;
}

const NewsPageShell: React.FC<NewsPageShellProps> = ({
  title,
  headerAction,
  searchFilterBar,
  topUtilityRegion,
  feedRegion,
}) => {
  return (
    <div className="flex min-h-full flex-col pb-24">
      <div className="bg-app/90 backdrop-blur-xl">
        <div className="px-6 pt-6 pb-2">
          <div className="mx-auto w-full max-w-md">
            <header className="flex items-center justify-between min-h-[32px]">
              <h1 className="text-3xl font-bold text-white">{title}</h1>
              {headerAction}
            </header>
          </div>
        </div>
        <div className="px-6 pt-2 pb-4">
          <div className="mx-auto w-full max-w-md space-y-3">
            {searchFilterBar}
            {topUtilityRegion}
          </div>
        </div>
      </div>

      <div className="px-6">
        <div className="mx-auto w-full max-w-md">
          {feedRegion}
        </div>
      </div>
    </div>
  );
};

export default NewsPageShell;
