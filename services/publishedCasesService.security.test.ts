import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchPublishedCasesBundle, getCachedPublishedCasesBundle, setPublishedCasesPrincipal } from './publishedCasesService';
const { rpc }=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock('./supabase',()=>({supabase:{rpc}}));
beforeEach(()=>{rpc.mockReset();setPublishedCasesPrincipal(`test-${Math.random()}`);});
describe('case cache identity isolation',()=>{
  it('clears cached internal records when signing out',async()=>{
    rpc.mockResolvedValue({data:[{id:'case',analysis_result:{patientId:'PRIVATE'}}],error:null});
    await fetchPublishedCasesBundle();expect(getCachedPublishedCasesBundle()).not.toBeNull();
    setPublishedCasesPrincipal(null);expect(getCachedPublishedCasesBundle()).toBeNull();
    rpc.mockResolvedValue({data:[{id:'case',analysis_result:{}}],error:null});
    expect(JSON.stringify(await fetchPublishedCasesBundle())).not.toContain('PRIVATE');
  });
  it('rejects late internal responses and cannot repopulate a new identity cache',async()=>{
    let finish!: (value: unknown)=>void;
    rpc.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
    const old=fetchPublishedCasesBundle();
    const rejected=expect(old).rejects.toThrow('Session changed');
    setPublishedCasesPrincipal(null);
    rpc.mockResolvedValue({data:[{id:'public-case'}],error:null});
    await fetchPublishedCasesBundle();
    finish({data:[{id:'PRIVATE'}],error:null});await rejected;
    expect(getCachedPublishedCasesBundle()?.rawCases[0].id).toBe('public-case');
    setPublishedCasesPrincipal('next');await fetchPublishedCasesBundle();
    expect(getCachedPublishedCasesBundle()?.rawCases[0].id).toBe('public-case');
  });
});
