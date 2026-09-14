/* EP Finance V1.7 - importador OFX/CSV com preview e deduplicação */
(function(global){
  'use strict';
  const norm=s=>String(s??'').trim();
  const num=s=>{ let v=norm(s).replace(/[^0-9,.-]/g,''); if(v.includes(',')&&v.includes('.')) v=v.replace(/\./g,'').replace(',','.'); else if(v.includes(',')) v=v.replace(',','.'); const n=Number(v); return Number.isFinite(n)?n:0; };
  const cleanDate=s=>{ const raw=norm(s); let m=raw.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/); if(m)return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`; m=raw.match(/^(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})$/); if(m)return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`; const x=raw.replace(/[^0-9]/g,''); if(x.length>=8) return `${x.slice(0,4)}-${x.slice(4,6)}-${x.slice(6,8)}`; return raw.slice(0,10); };
  const hash=t=>[cleanDate(t.date),Number(t.amount||t.value||0).toFixed(2),norm(t.description||t.memo||t.name).toLowerCase().replace(/\s+/g,' ')].join('|');

  function parseOFX(text){
    const blocks=String(text).match(/<STMTTRN>[\s\S]*?(?=<STMTTRN>|<\/BANKTRANLIST>|$)/gi)||[];
    return blocks.map(b=>{
      const get=tag=>{const m=b.match(new RegExp(`<${tag}>([^<\\r\\n]+)`,'i'));return m?m[1].trim():''};
      const amount=Number(get('TRNAMT'))||0;
      return {date:cleanDate(get('DTPOSTED')),description:get('MEMO')||get('NAME')||'Importado OFX',amount:Math.abs(amount),value:Math.abs(amount),type:amount<0?'expense':'income',source:'ofx',externalId:get('FITID')||null};
    }).filter(x=>x.date&&x.amount);
  }

  function splitCSVLine(line,delim){
    const out=[];let cur='',q=false;
    for(let i=0;i<line.length;i++){const c=line[i]; if(c==='"'){ if(q&&line[i+1]==='"'){cur+='"';i++;} else q=!q;} else if(c===delim&&!q){out.push(cur);cur='';} else cur+=c;} out.push(cur); return out;
  }

  function parseCSV(text){
    const lines=String(text).replace(/^\uFEFF/,'').split(/\r?\n/).filter(Boolean); if(lines.length<2)return[];
    const delim=(lines[0].match(/;/g)||[]).length>(lines[0].match(/,/g)||[]).length?';':',';
    const headers=splitCSVLine(lines[0],delim).map(h=>norm(h).toLowerCase());
    const idx=(names)=>{for(const n of names){const i=headers.findIndex(h=>h.includes(n));if(i>=0)return i}return-1};
    const di=idx(['data','date']), vi=idx(['valor','amount','value']), xi=idx(['descr','hist','memo','lançamento','lancamento','name']), ti=idx(['tipo','type']);
    return lines.slice(1).map(line=>{const c=splitCSVLine(line,delim);const raw=vi>=0?num(c[vi]):0;const explicit=ti>=0?norm(c[ti]).toLowerCase():'';const type=explicit.includes('rece')||explicit.includes('income')||raw>0?'income':'expense';return {date:cleanDate(c[di]),description:xi>=0?norm(c[xi]):'Importado CSV',amount:Math.abs(raw),value:Math.abs(raw),type,source:'csv'};}).filter(x=>x.date&&x.amount);
  }

  function preview(existing,incoming){
    const current=new Set((existing||[]).map(hash));
    return (incoming||[]).map(item=>({...item,_duplicate:current.has(hash(item)),_hash:hash(item)}));
  }

  function merge(data, previewRows){
    const out=window.EPV17Data?window.EPV17Data.migrate(data):JSON.parse(JSON.stringify(data||{})); if(!Array.isArray(out.transactions))out.transactions=[];
    const accepted=(previewRows||[]).filter(x=>!x._duplicate&&!x._skip).map(({_duplicate,_skip,_hash,...x})=>({...x,id:x.id||`tx_imp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`,createdAt:new Date().toISOString(),status:x.date>(window.EPV17Data?.localISO?.()||'9999-12-31')?'scheduled':'realized'}));
    out.transactions.push(...accepted);
    if(out.v17?.importHistory) out.v17.importHistory.push({id:`imp_${Date.now()}`,count:accepted.length,createdAt:new Date().toISOString()});
    return {data:out,accepted};
  }
  global.EPV17Import={parseOFX,parseCSV,preview,merge,hash};
})(window);
