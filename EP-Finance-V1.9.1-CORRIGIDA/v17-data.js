/* EP Finance V1.7 - camada de dados aditiva e retrocompatível */
(function (global) {
  'use strict';

  const clone = (v) => JSON.parse(JSON.stringify(v));
  const uid = (prefix='id') => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,9)}`;
  const localISO = (d=new Date()) => {
    const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), day=String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  };
  const addMonths = (iso, n) => {
    const [y,m,d]=String(iso).split('-').map(Number);
    const dt=new Date(y,m-1+n,1);
    const last=new Date(dt.getFullYear(),dt.getMonth()+1,0).getDate();
    dt.setDate(Math.min(d,last));
    return localISO(dt);
  };
  const addDays = (iso, n) => {
    const [y,m,d]=String(iso).split('-').map(Number);
    const dt=new Date(y,m-1,d+n); return localISO(dt);
  };

  function ensureShape(data) {
    const out = data && typeof data === 'object' ? clone(data) : {};
    if (!Array.isArray(out.transactions)) out.transactions=[];
    if (!Array.isArray(out.bills)) out.bills=[];
    if (!Array.isArray(out.goals)) out.goals=[];
    if (!Array.isArray(out.investments)) out.investments=[];
    if (!out.settings || typeof out.settings !== 'object') out.settings={};
    if (!out.v17 || typeof out.v17 !== 'object') out.v17={};
    if (!Array.isArray(out.v17.series)) out.v17.series=[];
    if (!Array.isArray(out.v17.importHistory)) out.v17.importHistory=[];
    if (!out.v17.security || typeof out.v17.security !== 'object') out.v17.security={};
    out.v17.schemaVersion = 1;
    return out;
  }

  function makeTransaction(base, extra={}) {
    const amount = Number(base.amount ?? base.value ?? 0);
    return {
      ...base,
      id: base.id || uid('tx'),
      amount: Number.isFinite(amount) ? amount : 0,
      date: base.date || localISO(),
      createdAt: base.createdAt || new Date().toISOString(),
      ...extra,
    };
  }

  function createInstallments(data, baseTx, count) {
    const out=ensureShape(data);
    count=Math.max(2, Math.min(120, Number(count)||2));
    const total=Number(baseTx.amount ?? baseTx.value ?? 0);
    const cents=Math.round(total*100);
    const each=Math.trunc(cents/count);
    const remainder=cents-(each*count);
    const seriesId=uid('installment');
    const start=baseTx.date || localISO();
    const generated=[];
    for(let i=0;i<count;i++){
      const part=(each+(i===count-1?remainder:0))/100;
      generated.push(makeTransaction(baseTx, {
        id:uid('tx'), amount:part, value:part,
        date:addMonths(start,i),
        seriesId, seriesType:'installment', installmentNumber:i+1, installmentCount:count,
        description:`${baseTx.description||baseTx.title||'Movimentação'} (${i+1}/${count})`,
        status:addMonths(start,i) > localISO() ? 'scheduled' : (baseTx.status||'realized')
      }));
    }
    out.transactions.push(...generated);
    out.v17.series.push({id:seriesId,type:'installment',count,createdAt:new Date().toISOString()});
    return {data:out, generated};
  }

  function createRecurring(data, baseTx, opts={}) {
    const out=ensureShape(data);
    const frequency=opts.frequency||'monthly';
    const count=Math.max(1,Math.min(240,Number(opts.count)||12));
    const seriesId=uid('recurring');
    const start=baseTx.date||localISO();
    const generated=[];
    for(let i=0;i<count;i++){
      let date=start;
      if(frequency==='weekly') date=addDays(start,i*7);
      else if(frequency==='yearly') date=addMonths(start,i*12);
      else date=addMonths(start,i);
      generated.push(makeTransaction(baseTx,{
        id:uid('tx'), date, seriesId, seriesType:'recurring', recurringFrequency:frequency,
        recurringIndex:i+1, recurringCount:count,
        status:date > localISO() ? 'scheduled' : (baseTx.status||'realized')
      }));
    }
    out.transactions.push(...generated);
    out.v17.series.push({id:seriesId,type:'recurring',frequency,count,createdAt:new Date().toISOString()});
    return {data:out,generated};
  }

  function deleteSeries(data, seriesId, mode='future') {
    const out=ensureShape(data); const today=localISO();
    out.transactions = out.transactions.filter(tx => {
      if(tx.seriesId!==seriesId) return true;
      if(mode==='all') return false;
      return String(tx.date||'') < today;
    });
    return out;
  }

  function migrate(data){ return ensureShape(data); }

  global.EPV17Data={migrate,ensureShape,createInstallments,createRecurring,deleteSeries,localISO,addMonths};
})(window);
