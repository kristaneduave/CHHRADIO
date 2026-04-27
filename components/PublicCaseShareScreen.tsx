import React, { useEffect, useMemo, useState } from 'react';
import CaseViewScreen from './CaseViewScreen';
import { getCaseShareErrorMessage, getCaseSharePreviewImage, resolvePublicCaseByToken } from '../services/caseShareService';

interface PublicCaseShareScreenProps {
  token: string;
  mode?: 'preview' | 'report';
}

const ensureMetaTag = (attribute: 'name' | 'property', value: string) => {
  if (typeof document === 'undefined') return null;
  let element = document.head.querySelector(`meta[${attribute}="${value}"]`) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, value);
    document.head.appendChild(element);
  }
  return element;
};

const updateMetaContent = (attribute: 'name' | 'property', value: string, content: string) => {
  const element = ensureMetaTag(attribute, value);
  if (element) {
    element.setAttribute('content', content);
  }
};

const buildAppSharePath = (token: string) => `/?publicCaseToken=${encodeURIComponent(token)}`;

const buildPreviewDescription = (resolvedCase: any) => {
  const narrative = [
    resolvedCase.findings,
    resolvedCase.analysis_result?.impression,
    resolvedCase.diagnosis,
  ]
    .find((value) => typeof value === 'string' && String(value).trim().length > 0);

  const normalizedNarrative = typeof narrative === 'string' ? narrative.trim() : '';
  if (!normalizedNarrative) {
    return 'Open the full report in the CHH Radiology app.';
  }

  return `${normalizedNarrative} Open the full report in the app.`.slice(0, 220);
};

const PublicCaseShareScreen: React.FC<PublicCaseShareScreenProps> = ({ token, mode = 'preview' }) => {
  const [caseData, setCaseData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const appSharePath = useMemo(() => buildAppSharePath(token), [token]);

  useEffect(() => {
    let isCancelled = false;

    const loadCase = async () => {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const resolvedCase = await resolvePublicCaseByToken(token);
        if (isCancelled) return;

        if (!resolvedCase) {
          setErrorMessage('This shared case link is unavailable or has expired.');
          setCaseData(null);
          return;
        }

        setCaseData(resolvedCase);
        if (typeof document !== 'undefined') {
          const previewTitle = String(resolvedCase.title || resolvedCase.diagnosis || 'Shared Case').trim() || 'Shared Case';
          const representativeImage = getCaseSharePreviewImage(resolvedCase);
          const description = buildPreviewDescription(resolvedCase);

          document.title = `${previewTitle} | CHH Radiology`;
          updateMetaContent('name', 'description', description);
          updateMetaContent('property', 'og:title', previewTitle);
          updateMetaContent('property', 'og:description', description);
          updateMetaContent('property', 'og:type', 'article');
          updateMetaContent('property', 'og:url', window.location.href);
          updateMetaContent('name', 'twitter:card', representativeImage ? 'summary_large_image' : 'summary');
          updateMetaContent('name', 'twitter:title', previewTitle);
          updateMetaContent('name', 'twitter:description', description);

          if (representativeImage) {
            updateMetaContent('property', 'og:image', representativeImage);
            updateMetaContent('name', 'twitter:image', representativeImage);
          }
        }
      } catch (error: any) {
        if (isCancelled) return;
        setErrorMessage(getCaseShareErrorMessage(error, 'Unable to load this shared case.'));
        setCaseData(null);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadCase();

    return () => {
      isCancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (mode !== 'preview' || !caseData || typeof window === 'undefined') {
      return;
    }

    const redirectTimer = window.setTimeout(() => {
      window.location.replace(appSharePath);
    }, 120);

    return () => {
      window.clearTimeout(redirectTimer);
    };
  }, [appSharePath, caseData, mode]);

  const handleBack = () => {
    if (typeof window === 'undefined') return;
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.assign('/');
  };

  const handleOpenFullReport = () => {
    if (typeof window === 'undefined') return;
    window.location.assign(appSharePath);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#071019] text-slate-200 flex items-center justify-center px-6">
        <div className="w-full max-w-md rounded-3xl border border-white/5 bg-white/[0.04] p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-sky-500/10 text-sky-300">
            <span className="material-icons text-3xl">sync</span>
          </div>
          <h1 className="mt-5 text-xl font-bold text-white">Loading shared case</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            {mode === 'preview'
              ? 'Opening the full report from the shared preview link.'
              : 'Fetching the full public report.'}
          </p>
        </div>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="min-h-screen bg-[#071019] text-slate-200 flex items-center justify-center px-6">
        <div className="w-full max-w-md rounded-3xl border border-white/5 bg-white/[0.04] p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/10 text-rose-300">
            <span className="material-icons text-3xl">link_off</span>
          </div>
          <h1 className="mt-5 text-xl font-bold text-white">Shared case unavailable</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            {errorMessage || 'This public case link is invalid, disabled, or no longer available.'}
          </p>
          <button
            type="button"
            onClick={handleBack}
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-sky-500 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-sky-400"
          >
            Return
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'report') {
    return <CaseViewScreen caseData={caseData} onBack={handleBack} mode="public" />;
  }

  const previewTitle = String(caseData.title || caseData.diagnosis || 'Shared Case').trim() || 'Shared Case';
  const previewImage = getCaseSharePreviewImage(caseData);
  const previewDescription = buildPreviewDescription(caseData);

  return (
    <div className="min-h-screen bg-[#071019] px-4 py-8 text-slate-200 sm:px-6">
      <div className="mx-auto w-full max-w-3xl overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-[0_24px_80px_rgba(2,6,23,0.45)]">
        <div className="border-b border-white/5 px-6 pb-4 pt-6 sm:px-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-sky-300">CHH Radiology Portal</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">{previewTitle}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
            {previewDescription}
          </p>
        </div>

        <div className="p-6 sm:p-8">
          {previewImage ? (
            <img
              src={previewImage}
              alt={previewTitle}
              className="h-[260px] w-full rounded-[1.5rem] border border-white/10 bg-slate-900 object-cover shadow-[0_20px_60px_rgba(2,6,23,0.4)] sm:h-[380px]"
            />
          ) : (
            <div className="flex h-[260px] w-full items-center justify-center rounded-[1.5rem] border border-white/10 bg-[linear-gradient(135deg,#0f2740,#0b1520)] text-slate-300 sm:h-[380px]">
              <div className="text-center">
                <span className="material-icons text-4xl text-sky-300">image</span>
                <p className="mt-3 text-sm font-medium">Representative image unavailable</p>
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleOpenFullReport}
              className="inline-flex items-center justify-center rounded-xl bg-sky-500 px-5 py-3.5 text-sm font-bold text-[#082f49] transition-colors hover:bg-sky-400"
            >
              Open Full Report
            </button>
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-5 py-3.5 text-sm font-bold text-slate-200 transition-colors hover:bg-white/[0.06]"
            >
              Return
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicCaseShareScreen;
