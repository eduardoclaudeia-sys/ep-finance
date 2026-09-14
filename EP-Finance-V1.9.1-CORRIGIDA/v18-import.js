/* EP Finance V1.8 — PDF/OFX/CSV + conciliação e anti-duplicidade */
(function(global){
  'use strict';

  const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const brMoney=s=>{
    let x=String(s??'').trim().replace(/R\$/gi,'').replace(/\s/g,'');
    let negative=/^-/.test(x)||/\bD$/i.test(x);
    x=x.replace(/[DC]$/i,'').replace(/\./g,'').replace(',','.').replace(/[^0-9.-]/g,'');
    const n=Number(x); return Number.isFinite(n)?(negative?-Math.abs(n):n):0;
  };
  function dateISO(raw){
    const s=String(raw??'').trim();
    let m=s.match(/\b(\d{2})[\/-](\d{2})[\/-](\d{4})\b/);
    if(m)return `${m[3]}-${m[2]}-${m[1]}`;
    m=s.match(/\b(\d{2})[\/-](\d{2})[\/-](\d{2})\b/);
    if(m)return `20${m[3]}-${m[2]}-${m[1]}`;
    if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;
    const digits=s.replace(/[^0-9]/g,'');
    if(digits.length>=8 && Number(digits.slice(0,4))>1900)return `${digits.slice(0,4)}-${digits.slice(4,6)}-${digits.slice(6,8)}`;
    return '';
  }
  const walletOf=t=>t?.wallet||'cash';
  const signed=t=>(t.type==='income'?1:-1)*Math.abs(Number(t.value??t.amount??0));
  const fingerprint=t=>`${t.date}|${signed(t).toFixed(2)}|${norm(t.description)}`;
  const amountKey=t=>`${t.date}|${signed(t).toFixed(2)}`;

  function tokens(s){return new Set(norm(s).split(' ').filter(x=>x.length>1));}
  function similarity(a,b){const A=tokens(a),B=tokens(b);if(!A.size||!B.size)return 0;let hit=0;A.forEach(x=>{if(B.has(x))hit++});return hit/Math.max(A.size,B.size);}
  function daysBetween(a,b){return Math.abs((new Date(a+'T12:00:00')-new Date(b+'T12:00:00'))/86400000);}

  function classifyDescription(desc){
    const d=norm(desc);
    if(/salario|pagamento salario|folha/.test(d)) return {category:'Salário',type:'income'};
    if(/ifood|restaurante|lanchonete|mercado|supermercado|padaria/.test(d)) return {category:'Alimentação'};
    if(/uber|99 app|posto|combustivel|gasolina|transporte/.test(d)) return {category:'Transporte'};
    if(/farmacia|drogaria|hospital|clinica/.test(d)) return {category:'Saúde'};
    if(/aluguel|condominio|energia|enel|claro|internet|telefone/.test(d)) return {category:'Moradia'};
    if(/faculdade|curso|escola|livraria/.test(d)) return {category:'Educação'};
    return {category:'Outros'};
  }

  async function fileSignature(file){
    const buf=await file.arrayBuffer();
    const digest=await crypto.subtle.digest('SHA-256',buf);
    return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
  }

  async function pdfLines(file){
    if(!global.pdfjsLib)throw new Error('Leitor de PDF não carregou. Verifique a conexão e tente novamente.');
    global.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
    const bytes=new Uint8Array(await file.arrayBuffer());
    const pdf=await global.pdfjsLib.getDocument({data:bytes}).promise;
    const all=[];
    for(let pageNo=1;pageNo<=pdf.numPages;pageNo++){
      const page=await pdf.getPage(pageNo);const content=await page.getTextContent();
      const groups=[];
      for(const item of content.items||[]){
        const text=String(item.str||'').trim();if(!text)continue;
        const x=Number(item.transform?.[4]||0),y=Number(item.transform?.[5]||0);
        let g=groups.find(r=>Math.abs(r.y-y)<=2.5);
        if(!g){g={y,items:[]};groups.push(g)}
        g.items.push({x,text});
      }
      groups.sort((a,b)=>b.y-a.y);
      for(const g of groups){g.items.sort((a,b)=>a.x-b.x);const line=g.items.map(i=>i.text).join(' ').replace(/\s+/g,' ').trim();if(line)all.push({page:pageNo,text:line});}
    }
    return all;
  }

  function parsePdfLines(lines){
    const rows=[];
    const valueRegex=/(-?\s*(?:R\$\s*)?\d{1,3}(?:\.\d{3})*,\d{2}|-?\s*(?:R\$\s*)?\d+,\d{2})\s*([DC])?\s*$/i;
    const dateRegex=/(\d{2}[\/-]\d{2}(?:[\/-]\d{2,4})?)/;
    let pendingDate='';
    for(const entry of lines){
      let line=entry.text;
      const dm=line.match(dateRegex);
      if(dm){
        let raw=dm[1];
        if(raw.split(/[\/-]/).length===2){
          const now=new Date();raw += `/${now.getFullYear()}`;
        }
        pendingDate=dateISO(raw)||pendingDate;
      }
      const vm=line.match(valueRegex);if(!vm||!pendingDate)continue;
      const lower=norm(line);
      if(/saldo anterior|saldo do dia|saldo disponivel|saldo atual|total /.test(lower))continue;
      let rawValue=brMoney(vm[1]+(vm[2]||''));
      let before=line.slice(0,vm.index).replace(dateRegex,'').replace(/\s+/g,' ').trim();
      if(!before||/^saldo$/i.test(before))continue;
      const debitWords=/debito|compra|pagamento|pix enviado|transferencia enviada|saque|tarifa|boleto|débito/.test(lower);
      const creditWords=/credito|recebido|pix recebido|deposito|salario|estorno|credito em conta/.test(lower);
      let type=rawValue<0?'expense':'income';
      if(vm[2]?.toUpperCase()==='D'||debitWords)type='expense';
      else if(vm[2]?.toUpperCase()==='C'||creditWords)type='income';
      const amount=Math.abs(rawValue);
      if(!amount)continue;
      const guess=classifyDescription(before);
      if(guess.type)type=guess.type;
      rows.push({date:pendingDate,description:before,value:amount,amount,type,category:guess.category,wallet:'cash',payment:'Importado do banco',source:'pdf',sourcePage:entry.page});
    }
    // compact obvious duplicate lines produced by repeated PDF text layers
    const seen=new Set();return rows.filter(r=>{const k=fingerprint(r);if(seen.has(k))return false;seen.add(k);return true;});
  }

  async function parsePDF(file){return parsePdfLines(await pdfLines(file));}

  function normalizeImported(rows){return (rows||[]).map(r=>{
    const guess=classifyDescription(r.description);
    return {...r,date:dateISO(r.date)||r.date,value:Math.abs(Number(r.value??r.amount??0)),amount:Math.abs(Number(r.value??r.amount??0)),category:r.category||guess.category||'Outros',wallet:r.wallet||'cash',payment:r.payment||'Importado do banco'};
  });}

  function preview(existing,incoming){
    const old=existing||[];const exact=new Set(old.map(fingerprint));
    return normalizeImported(incoming).map(item=>{
      let duplicateLevel=exact.has(fingerprint(item))?'exact':'';let match=null;
      if(!duplicateLevel){
        match=old.find(t=>Math.abs(signed(t)-signed(item))<0.005 && t.date && item.date && daysBetween(t.date,item.date)<=2 && similarity(t.description,item.description)>=0.5);
        if(match)duplicateLevel='possible';
      }
      return {...item,_duplicate:Boolean(duplicateLevel),_duplicateLevel:duplicateLevel,_duplicateMatch:match?.description||'',_skip:Boolean(duplicateLevel),_hash:fingerprint(item)};
    });
  }

  function merge(data,rows,meta={}){
    const out=global.EPV17Data?global.EPV17Data.migrate(data):JSON.parse(JSON.stringify(data||{}));
    out.transactions=out.transactions||[];out.v18=out.v18||{};out.v18.importHistory=out.v18.importHistory||[];
    const accepted=[];
    for(const row of rows||[]){
      if(row._skip)continue;
      const {_duplicate,_duplicateLevel,_duplicateMatch,_skip,_hash,...clean}=row;
      const tx={...clean,id:clean.id||`tx_imp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`,importFingerprint:_hash||fingerprint(clean),importedAt:new Date().toISOString(),createdAt:clean.createdAt||new Date().toISOString()};
      out.transactions.push(tx);accepted.push(tx);
    }
    out.v18.importHistory.push({id:`imp_${Date.now().toString(36)}`,fileName:meta.fileName||'',fileSignature:meta.fileSignature||'',fileType:meta.fileType||'',found:Number(meta.found||rows?.length||0),imported:accepted.length,createdAt:new Date().toISOString()});
    return {data:out,accepted};
  }

  global.EPV18Import={parsePDF,preview,merge,fileSignature,classifyDescription,similarity,fingerprint};
})(window);
