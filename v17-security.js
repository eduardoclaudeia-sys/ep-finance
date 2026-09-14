/* EP Finance V1.7 - desbloqueio por passkey/WebAuthn (Face ID/Touch ID quando suportado) */
(function(global){
  'use strict';
  const b64u={
    enc:buf=>btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''),
    dec:s=>Uint8Array.from(atob(String(s).replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(String(s).length/4)*4,'=')),c=>c.charCodeAt(0))
  };
  const random=n=>crypto.getRandomValues(new Uint8Array(n));
  async function available(){return !!(window.PublicKeyCredential&&navigator.credentials&&window.isSecureContext);}
  async function register(userId,label='EP Finance'){
    if(!(await available())) throw new Error('WebAuthn não suportado neste aparelho/navegador.');
    const challenge=random(32), uid=new TextEncoder().encode(String(userId));
    const cred=await navigator.credentials.create({publicKey:{challenge,rp:{name:'EP Finance'},user:{id:uid,name:String(userId),displayName:label},pubKeyCredParams:[{type:'public-key',alg:-7},{type:'public-key',alg:-257}],authenticatorSelection:{authenticatorAttachment:'platform',residentKey:'preferred',userVerification:'required'},timeout:60000,attestation:'none'}});
    return {credentialId:b64u.enc(cred.rawId),createdAt:new Date().toISOString()};
  }
  async function unlock(credentialId){
    if(!(await available())) throw new Error('WebAuthn não suportado.');
    const cred=await navigator.credentials.get({publicKey:{challenge:random(32),allowCredentials:[{type:'public-key',id:b64u.dec(credentialId)}],userVerification:'required',timeout:60000}});
    return !!cred;
  }
  global.EPV17Security={available,register,unlock};
})(window);
