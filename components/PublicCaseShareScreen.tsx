import React, { useEffect, useState } from 'react';
import CaseViewScreen from './CaseViewScreen';
import { getCaseShareErrorMessage, getCaseSharePreviewImage, resolvePublicCaseByToken } from '../services/caseShareService';

interface PublicCaseShareScreenProps {
  token: string;
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

const PublicCaseShareScreen: React.FC<PublicCaseShareScreenProps> = ({ token }) => {
  const [caseData, setCaseData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

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
          const pageTitle = String(resolvedCase.title || 'Shared Case').trim() || 'Shared Case';
          const representativeImage = getCaseSharePreviewImage(resolvedCase);
          const descriptionParts = [
            resolvedCase.modality,
            resolvedCase.organ_system,
            resolvedCase.analysis_result?.patientId || resolvedCase.diagnosis,
            resolvedCase.findings || resolvedCase.analysis_result?.impression,
          ]
            .filter((value) => typeof value === 'string' && String(value).trim().length > 0)
            .map((value) => String(value).trim());
          const description = descriptionParts.join(' • ').slice(0, 280);

          document.title = `${pageTitle} | CHH Radiology`;
          updateMetaContent('name', 'description', description || 'Shared radiology case report from CHH Radiology.');
          updateMetaContent('property', 'og:title', `${pageTitle} | CHH Radiology`);
          updateMetaContent('property', 'og:description', description || 'Shared radiology case report from CHH Radiology.');
          updateMetaContent('property', 'og:type', 'article');
          updateMetaContent('property', 'og:url', window.location.href);
          updateMetaContent('name', 'twitter:card', representativeImage ? 'summary_large_image' : 'summary');
          updateMetaContent('name', 'twitter:title', `${pageTitle} | CHH Radiology`);
          updateMetaContent('name', 'twitter:description', description || 'Shared radiology case report from CHH Radiology.');

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

  const handleBack = () => {
    if (typeof window === 'undefined') return;
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.assign('/');
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
            Fetching the public report link and assembling the full case details.
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

  return <CaseViewScreen caseData={caseData} onBack={handleBack} mode="public" />;
};

export default PublicCaseShareScreen;
