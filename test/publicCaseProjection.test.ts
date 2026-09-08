import { describe, expect, it } from 'vitest';
import { publicCaseForViewer, toPublicCase } from '../utils/publicCaseProjection';
describe('public case compatibility', () => {
  it.each(['interesting_case','aunt_minnie','rare_pathology'])('preserves teaching content and legacy images for %s',submission_type=>{
    const result=publicCaseForViewer(toPublicCase({id:'case',submission_type,title:'Title',findings:'Findings',image_url:'image.png',
      patient_initials:'SECRET',patient_age:'42',created_by:'SECRET',viber_shared_at:'SECRET',
      analysis_result:{patientId:'SECRET',unknown:'SECRET',references:[{title:'Book',page:'7',patientId:'SECRET'}],imagesMetadata:[{description:'Caption',private:'SECRET'}]}}));
    expect(result.submission_type).toBe(submission_type);expect(result.image_urls).toEqual(['image.png']);
    expect(result.analysis_result.imagesMetadata).toEqual([{description:'Caption'}]);
    expect(JSON.stringify(result)).not.toContain('SECRET');expect(result.patient_initials).toBeNull();
  });
});
