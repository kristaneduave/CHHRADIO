import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CaseViewScreen from './CaseViewScreen';
import { publicCaseForViewer, toPublicCase } from '../utils/publicCaseProjection';
const { exportPdf }=vi.hoisted(()=>({exportPdf:vi.fn()}));
vi.mock('../services/pdfServiceLoader',()=>({loadGenerateCasePDF:async()=>exportPdf,prefetchGenerateCasePDF:async()=>undefined}));
vi.mock('../services/supabase',()=>({supabase:{auth:{getUser:async()=>({data:{user:{id:'admin'}}})}}}));
vi.mock('../services/caseInteractionService',()=>({fetchCaseComments:async()=>[],submitCaseComment:vi.fn()}));
beforeEach(()=>{exportPdf.mockReset();exportPdf.mockResolvedValue(undefined);});
describe('public report rendering and PDF compatibility',()=>{
  it.each(['interesting_case','rare_pathology','aunt_minnie'])('renders and exports %s without structured patient identifiers',async submission_type=>{
    const data=publicCaseForViewer(toPublicCase({id:'synthetic',title:'Synthetic teaching case',submission_type,status:'published',
      created_at:'2026-09-08T00:00:00Z',findings:'Teaching findings',radiologic_clinchers:'Teaching clincher',
      image_url:'https://example.test/image.png',patient_initials:'PRIVATE_INITIALS',patient_age:'77',
      analysis_result:{patientId:'PRIVATE_ID',impression:'Teaching impression',references:[{title:'Reference',sourceType:'Textbook',page:'2'}]}}));
    const view=render(<CaseViewScreen caseData={data} mode="public" onBack={()=>undefined}/>);
    expect(screen.queryByText('PACS Patient ID')).not.toBeInTheDocument();
    expect(screen.queryByRole('button',{name:/Export PDF/})).not.toBeInTheDocument();
    // Shared reports intentionally have no export control. Guest-library viewing uses
    // the internal layout with the same sanitized record and retains PDF export.
    view.rerender(<CaseViewScreen caseData={data} mode="internal" onBack={()=>undefined}/>);
    const button=await screen.findByRole('button',{name:/Export PDF/});
    fireEvent.click(button);
    await waitFor(()=>expect(exportPdf).toHaveBeenCalledTimes(1));
    expect(JSON.stringify(exportPdf.mock.calls)).not.toContain('PRIVATE_');
    expect(exportPdf.mock.calls[0][0].submissionType).toBe(submission_type);
    expect(exportPdf.mock.calls[0][2][0].url).toBe('https://example.test/image.png');
  });
});
