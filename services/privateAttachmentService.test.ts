import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPrivateAttachmentReference, parsePrivateAttachment, resolvePrivateAttachment, setPrivateAttachmentPrincipal } from './privateAttachmentService';
const { getSession, createSignedUrl } = vi.hoisted(() => ({ getSession: vi.fn(), createSignedUrl: vi.fn() }));
vi.mock('./supabase', () => ({ supabase: { auth:{getSession},storage:{from:()=>({createSignedUrl})} } }));
const project = 'https://project.supabase.co';
const ref = 'storage://resident-census-evidence/user/file.pdf';
beforeEach(()=>{vi.stubEnv('VITE_SUPABASE_URL',project); getSession.mockReset();createSignedUrl.mockReset();
  getSession.mockResolvedValue({data:{session:{user:{id:'user'}}}});setPrivateAttachmentPrincipal('user');});
describe('private attachment links', () => {
  it('resolves legacy URLs and canonical references without persisting signed URLs', () => {
    const path='user/file with spaces.pdf';const canonical=createPrivateAttachmentReference('resident-census-evidence',path);
    expect(parsePrivateAttachment(canonical,project)).toEqual({bucket:'resident-census-evidence',path});
    expect(parsePrivateAttachment(`${project}/storage/v1/object/public/resident-census-evidence/${encodeURI(path)}`,project)).toEqual({bucket:'resident-census-evidence',path});
    for(const bad of ['https://evil.example/file','storage://case-images/file',ref+'?token=secret','storage://resident-census-evidence/user/%2e%2e%2ffile']) {
      expect(()=>parsePrivateAttachment(bad,project)).toThrow();
    }
  });
  it('signs afresh for each opening for 600 seconds', async () => {
    createSignedUrl.mockResolvedValue({data:{signedUrl:'https://signed.example/first'},error:null});
    expect(await resolvePrivateAttachment(ref)).toContain('first');
    createSignedUrl.mockResolvedValue({data:{signedUrl:'https://signed.example/refreshed'},error:null});
    expect(await resolvePrivateAttachment(ref)).toContain('refreshed');
    expect(createSignedUrl).toHaveBeenCalledWith('user/file.pdf',600);
    expect(createSignedUrl).toHaveBeenCalledTimes(2);
  });
  it('never falls back to public URLs on denial or session change', async () => {
    createSignedUrl.mockResolvedValue({error:{message:'denied'},data:null});
    await expect(resolvePrivateAttachment(ref)).rejects.toThrow('access denied');
    createSignedUrl.mockImplementation(async()=>{setPrivateAttachmentPrincipal('other');return {data:{signedUrl:'secret'}};});
    await expect(resolvePrivateAttachment(ref)).rejects.toThrow('session changed');
    getSession.mockResolvedValue({data:{session:null}});
    await expect(resolvePrivateAttachment(ref)).rejects.toThrow('Sign in');
  });
});
