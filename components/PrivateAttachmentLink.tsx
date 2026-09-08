import React, { useState } from 'react';
import { resolvePrivateAttachment } from '../services/privateAttachmentService';
import { toastError } from '../utils/toast';

export default function PrivateAttachmentLink({ reference, children, className, allowLocalPreview = false }: {
  reference: string; children: React.ReactNode; className?: string; allowLocalPreview?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const open = async () => {
    // Reserve a tab during the user gesture; asynchronous signing otherwise trips popup blockers.
    const tab = window.open('about:blank', '_blank');
    if (!tab) { toastError('Allow popups to open attachments.'); return; }
    tab.opener = null;
    setLoading(true);
    try {
      const url = allowLocalPreview && reference.startsWith('blob:') ? reference : await resolvePrivateAttachment(reference);
      if (!tab.closed) tab.location.replace(url);
    } catch {
      tab.close();
      toastError('Attachment unavailable', 'Check your connection and access, then try again.');
    } finally { setLoading(false); }
  };
  return <button type="button" className={className} onClick={() => void open()} disabled={loading} aria-busy={loading}>
    {children}
  </button>;
}
